'use client';

const INITIAL_CENTER = { lat: 37.5665, lng: 126.9780 };
const INITIAL_LEVEL = 5;

import { useEffect, useState, useRef } from 'react';
import { Map, CustomOverlayMap, MarkerClusterer, Polygon } from 'react-kakao-maps-sdk';
import { supabase } from '@/lib/supabase/client';
import { Restaurant } from '@/types';
import { MapBounds } from '@/hooks/useMapBounds';
import RestaurantInfoCard from '@/components/ui/RestaurantInfoCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Dices, Flame, Play, MapPin, Utensils } from 'lucide-react';
import { MichelinIcon } from '@/components/icons/CustomIcons';
import { Swiper, SwiperSlide } from 'swiper/react';

const formatViewCount = (count: number) => {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace('.0', '')}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}천`;
  return count.toString();
};
import { EffectCoverflow } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-coverflow';

interface MapContainerProps {
  restaurants: Restaurant[];
  onBoundsChange: (bounds: MapBounds) => void;
}

export default function MapContainer({ restaurants, onBoundsChange }: MapContainerProps) {
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Restaurant[] | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(INITIAL_LEVEL);
  const [regionClusters, setRegionClusters] = useState<any[]>([]);
  const [activePolygons, setActivePolygons] = useState<{lat: number, lng: number}[][] | null>(null);
  const [polygonOpacity, setPolygonOpacity] = useState<number>(0.8);
  const [hoveredRestaurantId, setHoveredRestaurantId] = useState<string | null>(null);
  const [sonarPing, setSonarPing] = useState<number>(0);
  const [mapTheme, setMapTheme] = useState<'theme-silver' | 'theme-navy' | 'theme-sand' | ''>('theme-silver');

  // 줌 레벨에 따른 행정구역 클러스터 데이터 로드
  useEffect(() => {
    async function fetchRegionClusters() {
      if (zoomLevel <= 10) {
        setRegionClusters([]);
        setActivePolygons(null);
        return;
      }
      // 레벨 12 이상은 시/도(depth 1)
      // 레벨 11은 시/군/구(depth 2)
      const depth = zoomLevel > 11 ? 1 : 2;
      
      const { data, error } = await supabase.rpc('get_restaurant_clusters', { p_depth: depth });
      if (data) {
        setRegionClusters(data);
      }
    }
    fetchRegionClusters();
  }, [zoomLevel]);

  // 폴리곤 포커스 플래시(Focus Flash) 애니메이션 (1.5초 후 자연스럽게 페이드아웃)
  useEffect(() => {
    if (activePolygons) {
      setPolygonOpacity(0.8);
      const fadeTimer = setTimeout(() => {
        let currentOpacity = 0.8;
        const interval = setInterval(() => {
          currentOpacity -= 0.05;
          if (currentOpacity <= 0) {
            clearInterval(interval);
            setActivePolygons(null);
          } else {
            setPolygonOpacity(currentOpacity);
          }
        }, 50);
        return () => clearInterval(interval);
      }, 1000);
      return () => clearTimeout(fadeTimer);
    }
  }, [activePolygons]);

  // SDK 로드 확인 및 동적 주입
  useEffect(() => {
    let script = document.querySelector(`script[src*="dapi.kakao.com"]`) as HTMLScriptElement;
    
    const handleLoad = () => {
      window.kakao.maps.load(() => {
        setIsSdkLoaded(true);
      });
    };

    if (!script) {
      script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY}&libraries=services,clusterer,drawing&autoload=false`;
      script.async = true;
      document.head.appendChild(script);
      script.addEventListener('load', handleLoad);
    } else {
      if (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === 'function') {
        handleLoad();
      } else {
        script.addEventListener('load', handleLoad);
      }
    }

    return () => {
      script.removeEventListener('load', handleLoad);
    };
  }, []);

  // 지도 범위 변경
  useEffect(() => {
    if (!map) return;
    const handleIdle = () => {
      // 1. 남한 영역 경계 제한 (Boundary Lock)
      const center = map.getCenter();
      let lat = center.getLat();
      let lng = center.getLng();
      let outOfBounds = false;

      // 남한 대략적 경계 (제주도 남단 ~ 고성 북단, 백령도 서단 ~ 독도 동단)
      if (lat < 33.1) { lat = 33.1; outOfBounds = true; }
      else if (lat > 38.6) { lat = 38.6; outOfBounds = true; }
      if (lng < 124.6) { lng = 124.6; outOfBounds = true; }
      else if (lng > 131.9) { lng = 131.9; outOfBounds = true; }

      if (outOfBounds) {
        // 경계를 벗어나면 부드럽게 한계점(Edge)으로 되돌려 보냄
        map.panTo(new kakao.maps.LatLng(lat, lng));
        return; 
      }

      // 2. 정상 범위 내일 경우 기존 로직 수행
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      
      // 레이더 스캔(Sonar) 애니메이션 트리거
      setSonarPing(Date.now());
      setZoomLevel(map.getLevel());
      
      // 약간 더 넓은 영역(Buffer Zone)을 서버에 요청하여 마커를 미리 당겨옵니다 (Pre-fetching UX)
      const latPadding = (ne.getLat() - sw.getLat()) * 0.3;
      const lngPadding = (ne.getLng() - sw.getLng()) * 0.3;
      
      onBoundsChange({ 
        swLat: sw.getLat() - latPadding, 
        swLng: sw.getLng() - lngPadding, 
        neLat: ne.getLat() + latPadding, 
        neLng: ne.getLng() + lngPadding 
      });
    };
    kakao.maps.event.addListener(map, 'idle', handleIdle);
    handleIdle();

    return () => {
      kakao.maps.event.removeListener(map, 'idle', handleIdle);
    };
  }, [map, onBoundsChange]);

  // 현 위치로 이동
  const moveToCurrentLocation = () => {
    if (!map) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locPosition = new kakao.maps.LatLng(position.coords.latitude, position.coords.longitude);
          map.panTo(locPosition);
        },
        (error) => {
          console.error("현 위치 에러", error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }
  };

  // 오늘 뭐 먹지? (랜덤 뽑기)
  const pickRandomRestaurant = () => {
    if (restaurants.length === 0 || !map) {
      alert('현재 화면에 보이는 식당이 없습니다.');
      return;
    }
    const randomIdx = Math.floor(Math.random() * restaurants.length);
    const target = restaurants[randomIdx];
    
    // 부드러운 줌인 및 이동
    map.setLevel(3, { animate: true });
    setTimeout(() => {
      map.panTo(new kakao.maps.LatLng(target.lat, target.lng));
      setSelectedRestaurant(target);
    }, 400); // 줌 애니메이션 대기
  };

  // 커스텀 마커 UI 렌더러 (Premium Design Benchmark)
  const getMarkerUI = (restaurant: Restaurant) => {
    const isMichelin = restaurant.content_tags?.some(t => t.source === 'michelin');
    const isBlueRibbon = restaurant.content_tags?.some(t => t.source === 'blueribbon');
    const isDdogan = restaurant.content_tags?.some(t => t.source === 'ddoganjib');
    const hasVideo = restaurant.videos && restaurant.videos.length > 0;
    const profileImg = restaurant.videos?.[0]?.youtuber?.profile_image;

    // 공통 하단 포인터 (마커 꼬리)
    const renderPointer = (bgColor: string) => (
      <div className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 w-[14px] h-[14px] ${bgColor} rotate-45 z-0 shadow-sm rounded-[2px]`}></div>
    );

    // 1. 유튜브 프로필형 (가장 우선순위 높음)
    if (hasVideo && profileImg) {
      return (
        <div className="relative flex flex-col items-center pb-[8px]">
          <div className="relative w-12 h-12 rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.35)] border-[3px] border-white bg-white z-10 overflow-hidden">
            <img src={profileImg} className="w-full h-full object-cover no-filter" alt="youtuber" />
          </div>
          {renderPointer('bg-white')}
          {/* 유튜브 뱃지 */}
          <div className="absolute bottom-[6px] -right-1 bg-red-600 rounded-full p-1 border-2 border-white z-20 shadow-sm">
            <Play size={10} color="white" fill="currentColor" />
          </div>
        </div>
      );
    }
    
    // 2. 또간집 특화 로고형
    if (isDdogan) {
      return (
        <div className="relative flex flex-col items-center pb-[8px]">
          <div className="relative w-11 h-11 bg-[#00c73c] rounded-full flex items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.35)] border-[3px] border-white z-10">
            <span className="text-white font-extrabold text-[13px] tracking-tighter">또간집</span>
          </div>
          {renderPointer('bg-[#00c73c]')}
        </div>
      );
    }
    
    // 3. 미쉐린 아이콘형
    if (isMichelin) {
      return (
        <div className="relative flex flex-col items-center pb-[8px]">
          <div className="relative w-11 h-11 bg-[#b9110c] rounded-full flex items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.35)] border-[3px] border-white z-10">
            <MichelinIcon size={24} color="white" />
          </div>
          {renderPointer('bg-[#b9110c]')}
        </div>
      );
    }

    // 4. 블루리본 아이콘형
    if (isBlueRibbon) {
      return (
        <div className="relative flex flex-col items-center pb-[8px]">
          <div className="relative w-11 h-11 bg-[#005bab] rounded-full flex items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.35)] border-[3px] border-white z-10">
             <span className="text-white font-extrabold text-[12px] tracking-tighter">리본</span>
          </div>
          {renderPointer('bg-[#005bab]')}
        </div>
      );
    }

    // 5. 기본형 (카테고리 아이콘 등)
    return (
      <div className="relative flex flex-col items-center pb-[8px]">
        <div className="relative w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.3)] border-[2.5px] border-white z-10">
          <MapPin size={16} color="white" />
        </div>
        {renderPointer('bg-gray-800')}
      </div>
    );
  };

  if (!isSdkLoaded) return <div className="w-full h-screen bg-gray-50 flex items-center justify-center">Loading Maps...</div>;

  return (
    <div className={`w-full h-screen relative overflow-hidden transition-colors duration-700 ${mapTheme || 'bg-gray-100'}`}>
      
      {/* 맵 스킨 선택 플로팅 UI (좌측 중앙) */}
      <div className="absolute left-4 top-1/3 -translate-y-1/2 z-20 flex flex-col gap-3 bg-white/80 backdrop-blur-md p-2.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50">
        <button 
          onClick={() => setMapTheme('theme-silver')}
          className={`w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 shadow-inner transition-transform hover:scale-110 ${mapTheme === 'theme-silver' ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}
          title="미니멀 실버"
        />
        <button 
          onClick={() => setMapTheme('theme-navy')}
          className={`w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 shadow-inner transition-transform hover:scale-110 ${mapTheme === 'theme-navy' ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}
          title="미드나잇 네이비"
        />
        <button 
          onClick={() => setMapTheme('theme-sand')}
          className={`w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 shadow-inner transition-transform hover:scale-110 ${mapTheme === 'theme-sand' ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}
          title="웜 샌드"
        />
        <button 
          onClick={() => setMapTheme('')}
          className={`w-8 h-8 rounded-full bg-white border border-gray-200 shadow-inner flex items-center justify-center transition-transform hover:scale-110 ${mapTheme === '' ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}
          title="기본 스킨"
        >
          <span className="text-[10px] font-bold text-gray-400">기본</span>
        </button>
      </div>

      {/* 데스크탑 좌측 스마트 사이드바 (Practical, Info-First) */}
      <AnimatePresence>
        {!selectedRestaurant && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="hidden md:flex absolute top-6 left-6 bottom-6 w-[380px] z-20 flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] border border-white/60 dark:border-slate-700/50 overflow-hidden"
          >
            {/* Sidebar Header & Filters */}
            <div className="pt-7 pb-4 px-7 shrink-0 bg-gradient-to-b from-white to-white/90 dark:from-slate-900 dark:to-slate-900/90 border-b border-gray-100/80 dark:border-slate-800 z-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[22px] font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {zoomLevel > 11 ? '전국 맛집' : (selectedCluster ? '선택된 지역' : '현재 화면 핫플')}
                </h2>
                <span className="text-[11px] font-bold bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-3 py-1.5 rounded-full shadow-sm">
                  {(selectedCluster || restaurants).length}곳 발견
                </span>
              </div>
              
              {/* Filter Chips */}
              <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
                <button className="whitespace-nowrap px-4 py-2 bg-gray-900 text-white text-[13px] font-bold rounded-xl shadow-md shadow-gray-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  🔥 조회수순
                </button>
                <button className="whitespace-nowrap px-4 py-2 bg-white text-gray-600 hover:text-gray-900 text-[13px] font-bold rounded-xl border border-gray-200 shadow-sm hover:shadow hover:bg-gray-50 active:scale-[0.98] transition-all">
                  ⭐ 미쉐린
                </button>
                <button className="whitespace-nowrap px-4 py-2 bg-white text-gray-600 hover:text-gray-900 text-[13px] font-bold rounded-xl border border-gray-200 shadow-sm hover:shadow hover:bg-gray-50 active:scale-[0.98] transition-all">
                  📺 흑백요리사
                </button>
              </div>

              {selectedCluster && (
                <button 
                  onClick={() => setSelectedCluster(null)}
                  className="w-full mt-4 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-gray-200/60 shadow-sm"
                >
                  ← 클러스터 해제하고 지도 전체보기
                </button>
              )}
            </div>

            {/* Sidebar List (Custom Scrollbar) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 relative z-0 bg-gray-50/50 dark:bg-slate-900/50" style={{ scrollbarWidth: 'none' }}>
              {(selectedCluster || restaurants).map(r => (
                <div 
                  key={r.id}
                  onClick={() => {
                    setSelectedRestaurant(r);
                    map?.setLevel(4, { animate: true });
                    map?.panTo(new kakao.maps.LatLng(r.lat, r.lng));
                  }}
                  onMouseEnter={() => setHoveredRestaurantId(r.id)}
                  onMouseLeave={() => setHoveredRestaurantId(null)}
                  className="group relative bg-white dark:bg-slate-800/90 rounded-[20px] p-3 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 flex gap-4 items-center border border-gray-100/80 dark:border-slate-700/80"
                >
                  {/* Thumbnail */}
                  <div className="relative w-[100px] h-[100px] shrink-0 rounded-2xl overflow-hidden bg-gray-100 ring-1 ring-black/5 dark:ring-white/10">
                    {r.videos?.[0]?.thumbnail ? (
                      <img 
                        src={r.videos[0].thumbnail} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        alt={r.name}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-50 to-gray-100">
                        <Utensils size={32} />
                      </div>
                    )}
                    {/* 쇼츠 배지 */}
                    {r.videos?.[0]?.is_short && (
                      <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-white/10">
                        <Play size={8} fill="currentColor"/> SHORTS
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col flex-1 min-w-0 space-y-2">
                    {/* 1. Title & Category */}
                    <div className="flex items-baseline gap-1.5">
                      <h4 className="font-extrabold text-[16px] text-gray-900 dark:text-white truncate tracking-tight">{r.name}</h4>
                      <span className="text-[12px] font-medium text-gray-400 shrink-0">| {r.category}</span>
                    </div>
                    
                    {/* 2. View Count (🔥 조회수 245만뷰) */}
                    {r.videos?.[0]?.view_count ? (
                      <div className="flex items-center text-[13px] font-bold text-gray-700 dark:text-gray-300">
                        <Flame size={14} className="text-orange-500 mr-1 shrink-0" />
                        <span className="truncate tracking-tight">조회수 {formatViewCount(r.videos[0].view_count)}뷰</span>
                      </div>
                    ) : r.content_tags?.some((t: any) => t.source === 'michelin') ? (
                      <div className="flex items-center text-[13px] font-bold text-red-600 dark:text-red-400">
                        <span className="mr-1 text-[14px]">⭐</span>
                        <span className="truncate tracking-tight">미쉐린 가이드 2024</span>
                      </div>
                    ) : null}
                    
                    {/* 3. Youtuber / Source Info (📺 성시경 먹을텐데 추천 맛집) */}
                    {r.videos?.[0]?.youtuber ? (
                      <div className="flex items-center text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                        <span className="mr-1.5 text-[14px] opacity-90">📺</span>
                        <span className="truncate">{r.videos[0].youtuber.name} 추천 맛집</span>
                      </div>
                    ) : r.content_tags?.[0] ? (
                      <div className="flex items-center text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                        <span className="mr-1.5 text-[14px] opacity-90">📌</span>
                        <span className="truncate">#{r.content_tags[0].label} 핫플</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 중앙 Sonar Sweep 레이더 효과 (UX Optimized) */}
      <AnimatePresence mode="popLayout">
        {sonarPing > 0 && (
          <div key={sonarPing} className="absolute top-1/2 left-1/2 pointer-events-none z-10 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={`${sonarPing}-${i}`}
                initial={{ scale: 0, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ 
                  duration: 1.4, 
                  delay: i * 0.15, 
                  ease: [0.25, 1, 0.5, 1]
                }}
                className="absolute w-[800px] h-[800px] rounded-full border-[2.5px] border-cyan-400 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.5)]"
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <Map
        key="place-map-v2"
        center={INITIAL_CENTER}
        level={INITIAL_LEVEL}
        style={{ width: '100%', height: '100%' }}
        onCreate={setMap}
        onClick={() => {
          setSelectedRestaurant(null);
          setSelectedCluster(null);
          setActivePolygons(null);
        }}
        isPanto={true}
      >
        {/* 활성화된 행정구역 폴리곤 하이라이트 (GeoJSON 기반 실제 경계) */}
        {activePolygons && activePolygons.map((path, idx) => (
          <Polygon
            key={`polygon-${idx}`}
            path={path}
            strokeWeight={2}
            strokeColor="#06b6d4" // cyan-500
            strokeOpacity={polygonOpacity}
            strokeStyle="solid"
            fillColor="#06b6d4"
            fillOpacity={polygonOpacity * 0.2}
          />
        ))}

        {/* 줌 아웃 시 행정구역 기반 커스텀 오버레이 (Phase 3 & 4) */}
        {zoomLevel > 10 && map && regionClusters.filter(cluster => {
          const bounds = map.getBounds();
          const p = new kakao.maps.LatLng(cluster.center_lat, cluster.center_lng);
          return bounds.contain(p);
        }).map((cluster, idx) => (
          <CustomOverlayMap
            key={`region-${idx}`}
            position={{ lat: cluster.center_lat, lng: cluster.center_lng }}
          >
            <div 
              onClick={() => {
                // 부드러운 줌인 및 마우스 이동
                map?.setLevel(zoomLevel - 3, { animate: true });
                map?.panTo(new kakao.maps.LatLng(cluster.center_lat, cluster.center_lng));

                // GeoJSON 다운로드 및 폴리곤 추출
                const fetchPolygon = async () => {
                  try {
                    let depthLevel = zoomLevel > 11 ? 1 : 2;
                    let url = '';
                    if (depthLevel === 1) url = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_provinces_geo_simple.json';
                    else url = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo_simple.json';
                    
                    const res = await fetch(url);
                    const geojson = await res.json();
                    
                    let targetName = cluster.region_name;
                    if (depthLevel === 1) {
                      const nameMap: Record<string, string> = {
                        '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시',
                        '광주': '광주광역시', '대전': '대전광역시', '울산': '울산광역시', '세종특별자치시': '세종특별자치시',
                        '경기': '경기도', '강원특별자치도': '강원도', '강원': '강원도', '충북': '충청북도', '충남': '충청남도',
                        '전북특별자치도': '전라북도', '전북': '전라북도', '전남': '전라남도', '경북': '경상북도', '경남': '경상남도',
                        '제주특별자치도': '제주특별자치도', '제주': '제주특별자치도'
                      };
                      targetName = nameMap[targetName] || targetName;
                    }

                    const feature = geojson.features.find((f: any) => f.properties.name === targetName);
                    
                    if (feature) {
                      const geometry = feature.geometry;
                      let paths: {lat: number, lng: number}[][] = [];
                      if (geometry.type === 'Polygon') {
                        paths.push(geometry.coordinates[0].map((c: any) => ({ lat: c[1], lng: c[0] })));
                      } else if (geometry.type === 'MultiPolygon') {
                        geometry.coordinates.forEach((poly: any) => {
                          paths.push(poly[0].map((c: any) => ({ lat: c[1], lng: c[0] })));
                        });
                      }
                      setActivePolygons(paths);
                    } else {
                      setActivePolygons(null);
                    }
                  } catch (e) {
                    console.error("Polygon fetch error", e);
                    setActivePolygons(null);
                  }
                };
                fetchPolygon();
              }}
              className="px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white rounded-full font-bold shadow-[0_4px_15px_rgba(0,0,0,0.3)] border border-cyan-400/40 cursor-pointer hover:scale-105 transition-all flex items-center gap-2 z-20"
            >
              <span className="text-[14px] tracking-tight whitespace-nowrap">{cluster.region_name}</span>
              <span className="text-cyan-400 text-[12px] bg-cyan-400/10 px-2 py-0.5 rounded-full">{cluster.count}곳</span>
            </div>
          </CustomOverlayMap>
        ))}

        {/* 미니멀 스텔스 클러스터러 (동네 수준 레벨 10 이하에서만 활성화) */}
        <MarkerClusterer
          averageCenter={true}
          minLevel={10} // 지도 레벨 10부터 클러스터링 시작 (거리에 따라 뭉침)
          disableClickZoom={true} 
          onClusterclick={(_, cluster) => {
            if (!map) return;
            const bounds = cluster.getBounds();
            // 클러스터 영역 내에 있는 식당들만 필터링
            const clustered = restaurants.filter(r => {
              const rLatLng = new kakao.maps.LatLng(r.lat, r.lng);
              return bounds.contain(rLatLng);
            });
            setSelectedRestaurant(null);
            setSelectedCluster(clustered);
          }}
          styles={[{ // 스텔스 클러스터 커스텀 디자인 (극도의 미니멀리즘)
            width: '32px', height: '32px',
            background: 'rgba(15, 23, 42, 0.95)', // 솔리드 블랙/네이비
            borderRadius: '50%',
            color: '#fff',
            textAlign: 'center',
            fontWeight: '600',
            fontSize: '13px',
            lineHeight: '32px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }]}
        >
          {/* 동네 단위(레벨 10 이하)에서만 핀/마커 렌더링 */}
          {zoomLevel <= 10 && restaurants.map((restaurant) => (
            <CustomOverlayMap
              key={restaurant.id}
              position={{ lat: restaurant.lat, lng: restaurant.lng }}
              clickable={true}
              yAnchor={1} // 핀의 꼬리가 마커 위치에 오도록 (하단 정렬)
              zIndex={hoveredRestaurantId === restaurant.id ? 100 : (selectedRestaurant?.id === restaurant.id ? 50 : 10)}
            >
              <div 
                onClick={() => {
                  setSelectedRestaurant(restaurant);
                  map?.panTo(new kakao.maps.LatLng(restaurant.lat, restaurant.lng));
                }} 
                className={`relative cursor-pointer transition-all duration-300 origin-bottom ${
                  selectedRestaurant?.id === restaurant.id 
                    ? 'scale-125 z-50' 
                    : hoveredRestaurantId === restaurant.id 
                      ? 'scale-110 -translate-y-2 z-40 drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)]' 
                      : 'z-10 hover:scale-110'
                }`}
              >
                {getMarkerUI(restaurant)}
                
                {/* 마커 호버/선택 시 표시되는 라벨 */}
                <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-gray-900 text-[11px] font-bold px-2 py-1 rounded-md shadow-sm whitespace-nowrap opacity-90 border border-gray-100">
                  {restaurant.name}
                </div>
              </div>
            </CustomOverlayMap>
          ))}
        </MarkerClusterer>
      </Map>

      {/* 우측 하단 플로팅 액션 버튼 (FAB) 그룹 */}
      <div className={`absolute right-4 z-20 flex flex-col gap-3 transition-all duration-300 ${!selectedRestaurant ? 'bottom-[140px]' : 'bottom-10'}`}>
        {/* 랜덤 뽑기 버튼 */}
        <button 
          onClick={pickRandomRestaurant}
          className="p-3.5 bg-brand-600 text-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-brand-500 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center"
          title="오늘 뭐 먹지? (랜덤 뽑기)"
        >
          <Dices size={22} />
        </button>

        {/* 현 위치 버튼 */}
        <button 
          onClick={moveToCurrentLocation}
          className="p-3.5 bg-white text-gray-800 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center"
          title="현 위치로 이동"
        >
          <Navigation size={22} fill="currentColor" className="text-gray-700" />
        </button>
      </div>

      {/* 바텀 스와이프 리스트 (모바일 전용) */}
      <AnimatePresence>
        {!selectedRestaurant && restaurants.length > 0 && (
          <motion.div 
            initial={{ y: 150, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 150, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="md:hidden absolute bottom-6 left-0 w-full z-10 px-0 flex flex-col items-center"
          >
            {selectedCluster && (
              <div className="mb-3 bg-gray-900/80 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-[12px] font-medium shadow-lg border border-white/10 flex items-center gap-2 cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => setSelectedCluster(null)}>
                <span>📍 이 지역의 핫플 {selectedCluster.length}곳</span>
                <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-[10px]">✕</span>
              </div>
            )}
            <Swiper
              effect={'coverflow'}
              grabCursor={true}
              centeredSlides={true}
              slidesPerView={'auto'}
              coverflowEffect={{
                rotate: 25,
                stretch: 0,
                depth: 150,
                modifier: 1,
                slideShadows: false,
              }}
              modules={[EffectCoverflow]}
              onSlideChange={(swiper) => {
                // 스와이프할 때마다 지도의 마커를 해당 식당으로 부드럽게 이동시킵니다.
                const source = selectedCluster || restaurants;
                const target = source[swiper.activeIndex];
                if (target && map) {
                  map.panTo(new kakao.maps.LatLng(target.lat, target.lng));
                }
              }}
              className="w-full py-4"
            >
              {(selectedCluster || restaurants).map(r => (
                <SwiperSlide key={r.id} style={{ width: '280px' }} className="px-2">
                  <div 
                    onClick={() => {
                      setSelectedRestaurant(r);
                      map?.setLevel(4, { animate: true });
                      map?.panTo(new kakao.maps.LatLng(r.lat, r.lng));
                    }}
                    className="w-full bg-white/95 backdrop-blur-xl rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] p-3.5 flex gap-3.5 cursor-pointer border-[1.5px] border-white/80 active:scale-95 transition-transform"
                  >
                    <img 
                      src={r.videos?.[0]?.thumbnail || 'https://via.placeholder.com/150'} 
                      className="w-20 h-20 rounded-2xl object-cover shadow-inner bg-gray-100 flex-shrink-0 no-filter" 
                      alt={r.name}
                    />
                    <div className="flex flex-col justify-center flex-1 min-w-0 pr-1">
                      <h4 className="font-extrabold text-[15px] text-gray-900 truncate tracking-tight">{r.name}</h4>
                      <span className="text-[12px] font-medium text-gray-500 truncate mt-0.5">{r.category}</span>
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {r.content_tags?.slice(0, 2).map((t, i) => (
                          <span key={i} className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md font-bold truncate max-w-[80px]">
                            #{t.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 식당 상세 정보 카드 Overlay */}
      <RestaurantInfoCard 
        restaurant={selectedRestaurant} 
        onClose={() => setSelectedRestaurant(null)} 
      />
    </div>
  );
}
