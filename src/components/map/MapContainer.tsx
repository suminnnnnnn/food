'use client';

const INITIAL_CENTER = { lat: 37.5665, lng: 126.9780 };
const INITIAL_LEVEL = 5;

import { useEffect, useState, useRef } from 'react';
import { Map, CustomOverlayMap, MarkerClusterer, Polygon, useKakaoLoader } from 'react-kakao-maps-sdk';
import { supabase } from '@/lib/supabase/client';
import { Restaurant } from '@/types';
import { MapBounds } from '@/hooks/useMapBounds';
import RestaurantInfoCard from '@/components/ui/RestaurantInfoCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Dices, Flame, Play, MapPin, Utensils, Heart, Home, User } from 'lucide-react';
import { MichelinIcon } from '@/components/icons/CustomIcons';
import { Swiper, SwiperSlide } from 'swiper/react';
import NearHotplacesView from '@/components/ui/NearHotplacesView';
import FavoritesView from '@/components/ui/FavoritesView';
import MyPageView from '@/components/ui/MyPageView';
import BottomTabBar from '@/components/ui/BottomTabBar';
import OverlayContainer from '@/components/ui/OverlayContainer';
import RestaurantSubmissionBottomSheet from '@/components/ui/RestaurantSubmissionBottomSheet';

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
  hideDefaultSidebar?: boolean;
  hideOmniSearch?: boolean;
  hideGameFAB?: boolean;
  externalHoveredRestaurantId?: string | null;
  externalSelectedRestaurant?: Restaurant | null;
  onExternalSelectedChange?: (restaurant: Restaurant | null) => void;
}

export default function MapContainer({ 
  restaurants, 
  onBoundsChange,
  hideDefaultSidebar = false,
  hideOmniSearch = false,
  hideGameFAB = false,
  externalHoveredRestaurantId = null,
  externalSelectedRestaurant = null,
  onExternalSelectedChange
}: MapContainerProps) {
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const [loading, mapError] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_JS_API_KEY as string,
    libraries: ['services', 'clusterer', 'drawing'],
  });
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Restaurant[] | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(INITIAL_LEVEL);
  const [regionClusters, setRegionClusters] = useState<any[]>([]);
  const [activePolygons, setActivePolygons] = useState<{lat: number, lng: number}[][] | null>(null);
  const [polygonOpacity, setPolygonOpacity] = useState<number>(0.8);
  // 스마트 탭 시스템 및 제보하기 상태 추가
  const [activeTab, setActiveTab] = useState<any>('home');
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const isMountedRef = useRef(false);

  // 즐겨찾기(localStorage) 마운트 시 데이터 복원
  useEffect(() => {
    const saved = localStorage.getItem('modoo-matjip-favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
    isMountedRef.current = true;
  }, []);

  // 즐겨찾기 상태 변경 시 localStorage 동기화
  useEffect(() => {
    if (isMountedRef.current) {
      localStorage.setItem('modoo-matjip-favorites', JSON.stringify(favorites));
    }
  }, [favorites]);

  // 카테고리 필터링 상태 추가
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [hoveredRestaurantId, setHoveredRestaurantId] = useState<string | null>(null);
  const [mapHoveredRestaurantId, setMapHoveredRestaurantId] = useState<string | null>(null);

  // 내부 및 외부 호버 상태의 이중화 통합 연동 변수
  const effectiveHoveredId = externalHoveredRestaurantId || hoveredRestaurantId;

  // 외부 선택 식당이 변경될 때의 지도 연동 반응 훅
  useEffect(() => {
    if (externalSelectedRestaurant) {
      setSelectedRestaurant(externalSelectedRestaurant);
      if (map) {
        map.setLevel(4, { animate: true });
        map.panTo(new kakao.maps.LatLng(externalSelectedRestaurant.lat, externalSelectedRestaurant.lng));
      }
    } else if (externalSelectedRestaurant === null && onExternalSelectedChange) {
      setSelectedRestaurant(null);
    }
  }, [externalSelectedRestaurant, map]);

  // 내부에서 식당을 클릭했을 때 외부 상태까지 통합 전파하는 핸들러
  const handleSelectRestaurant = (r: Restaurant | null) => {
    setSelectedRestaurant(r);
    if (onExternalSelectedChange) {
      onExternalSelectedChange(r);
    }
  };

  const [sonarPing, setSonarPing] = useState<number>(0);
  const [mapTheme, setMapTheme] = useState<'theme-silver' | 'theme-navy' | 'theme-sand' | ''>('');

  // 로컬스토리지 즐겨찾기 목록 초기 로드 및 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('favorite_restaurants');
        if (saved) {
          setFavorites(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Failed to load favorites from localStorage', e);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('favorite_restaurants', JSON.stringify(favorites));
      } catch (e) {
        console.error('Failed to save favorites to localStorage', e);
      }
    }
  }, [favorites]);

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

    const isSelected = selectedRestaurant?.id === restaurant.id;
    const isHovered = effectiveHoveredId === restaurant.id;
    const isMapHovered = mapHoveredRestaurantId === restaurant.id;
    const isHighlighted = isSelected || isHovered || isMapHovered;

    // 공통 하단 포인터 (마커 꼬리)
    const renderPointer = (bgColor: string) => (
      <div className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 w-[14px] h-[14px] ${bgColor} rotate-45 z-0 shadow-sm rounded-[2px] transition-colors duration-300`}></div>
    );

    // 1. 유튜브 프로필형 (최우선 노출, 그라데이션 링 가이드)
    if (hasVideo && profileImg) {
      const containerClass = isHighlighted 
        ? 'p-[3px] bg-gradient-to-r from-red-600 to-orange-500 shadow-[0_0_20px_rgba(239,68,68,0.65)] scale-110' 
        : 'border-[3px] border-white shadow-[0_5px_15px_rgba(0,0,0,0.35)]';
      const pointerColor = isHighlighted ? 'bg-orange-500' : 'bg-white';

      return (
        <div className="relative flex flex-col items-center pb-[8px]">
          <div className={`relative w-12 h-12 rounded-full bg-white z-10 overflow-hidden transition-all duration-300 ${containerClass}`}>
            {isHighlighted ? (
              <div className="w-full h-full rounded-full overflow-hidden bg-white">
                <img src={profileImg} className="w-full h-full object-cover no-filter" alt="youtuber" />
              </div>
            ) : (
              <img src={profileImg} className="w-full h-full object-cover no-filter" alt="youtuber" />
            )}
          </div>
          {renderPointer(pointerColor)}
        </div>
      );
    }
    
    // 2. 또간집 특화 로고형
    if (isDdogan) {
      const borderClass = isHighlighted 
        ? 'border-transparent shadow-[0_0_20px_rgba(239,68,68,0.65)] scale-110' 
        : 'border-[3px] border-white shadow-[0_5px_15px_rgba(0,0,0,0.35)]';
      const bgColor = isHighlighted ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-[#00c73c]';
      const pointerColor = isHighlighted ? 'bg-orange-500' : 'bg-[#00c73c]';

      return (
        <div className="relative flex flex-col items-center pb-[8px]">
          <div className={`relative w-11 h-11 rounded-full flex items-center justify-center border-[3px] z-10 transition-all duration-300 ${bgColor} ${borderClass}`}>
            <span className="text-white font-extrabold text-[13px] tracking-tighter">또간집</span>
          </div>
          {renderPointer(pointerColor)}
        </div>
      );
    }
    
    // 3. 미쉐린 아이콘형
    if (isMichelin) {
      const borderClass = isHighlighted 
        ? 'border-transparent shadow-[0_0_20px_rgba(239,68,68,0.65)] scale-110' 
        : 'border-[3px] border-white shadow-[0_5px_15px_rgba(0,0,0,0.35)]';
      const bgColor = isHighlighted ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-[#b9110c]';
      const pointerColor = isHighlighted ? 'bg-orange-500' : 'bg-[#b9110c]';

      return (
        <div className="relative flex flex-col items-center pb-[8px]">
          <div className={`relative w-11 h-11 rounded-full flex items-center justify-center border-[3px] z-10 transition-all duration-300 ${bgColor} ${borderClass}`}>
            <MichelinIcon size={24} color="white" />
          </div>
          {renderPointer(pointerColor)}
        </div>
      );
    }
    
    // 4. 블루리본 아이콘형
    if (isBlueRibbon) {
      const borderClass = isHighlighted 
        ? 'border-transparent shadow-[0_0_20px_rgba(239,68,68,0.65)] scale-110' 
        : 'border-[3px] border-white shadow-[0_5px_15px_rgba(0,0,0,0.35)]';
      const bgColor = isHighlighted ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-[#005bab]';
      const pointerColor = isHighlighted ? 'bg-orange-500' : 'bg-[#005bab]';

      return (
        <div className="relative flex flex-col items-center pb-[8px]">
          <div className={`relative w-11 h-11 rounded-full flex items-center justify-center border-[3px] z-10 transition-all duration-300 ${bgColor} ${borderClass}`}>
             <span className="text-white font-extrabold text-[12px] tracking-tighter">리본</span>
          </div>
          {renderPointer(pointerColor)}
        </div>
      );
    }

    // 5. 기본형 (카테고리 아이콘 등)
    const borderClass = isHighlighted 
      ? 'border-transparent shadow-[0_0_20px_rgba(239,68,68,0.65)] scale-110' 
      : 'border-[2.5px] border-white shadow-[0_5px_15px_rgba(0,0,0,0.3)]';
    const bgColor = isHighlighted ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-zinc-800';
    const pointerColor = isHighlighted ? 'bg-orange-500' : 'bg-zinc-800';

    return (
      <div className="relative flex flex-col items-center pb-[8px]">
        <div className={`relative w-9 h-9 rounded-full flex items-center justify-center border-[2.5px] z-10 transition-all duration-300 ${bgColor} ${borderClass}`}>
          <MapPin size={16} color="white" />
        </div>
        {renderPointer(pointerColor)}
      </div>
    );
  };

  // 카테고리에 따른 맛집 필터링
  const filteredRestaurants = restaurants.filter(r => {
    if (activeCategory === '전체') return true;
    const cat = r.category || '';
    if (activeCategory === '아시안') {
      return cat.includes('아시안') || 
             cat.includes('태국') || 
             cat.includes('베트남') || 
             cat.includes('동남아') || 
             cat.includes('인도') || 
             cat.includes('아시아') || 
             cat.includes('퓨전') || 
             cat.includes('세계') || 
             cat.includes('멕시코') || 
             cat.includes('타코');
    }
    return cat.includes(activeCategory);
  });

  if (loading) return <div className="w-full h-screen bg-gray-50 flex items-center justify-center">Loading Maps...</div>;
  if (mapError) return <div className="w-full h-screen bg-gray-50 flex items-center justify-center text-red-500 font-bold">Failed to load Kakao Maps: {mapError.message}</div>;

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gray-100 dark:bg-zinc-950">
      
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
        {!hideDefaultSidebar && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="hidden md:flex absolute top-6 left-6 bottom-6 w-[380px] z-20 flex-col bg-zinc-950/85 backdrop-blur-2xl rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden"
          >
            {/* Sidebar Header & Filters */}
            <div className="pt-7 pb-4 px-7 shrink-0 bg-white/[0.02] border-b border-white/5 backdrop-blur-md z-10">
              <div className="flex items-center gap-3 mb-5">
                <img 
                  src="/favicon_perfect_gradient.png" 
                  className="w-6 h-6 object-contain rounded-md shadow-sm" 
                  alt="모두의맛집" 
                />
                <h2 className="text-[22px] font-extrabold text-white tracking-tight">
                  우리 동네 맛집
                </h2>
              </div>
              
              {/* Filter Chips */}
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {['전체', '한식', '일식', '중식', '양식', '아시안'].map((category) => {
                  const isActive = activeCategory === category;
                  return (
                    <button
                      key={category}
                      onClick={() => {
                        setActiveCategory(category);
                        setSelectedCluster(null);
                      }}
                      className={`whitespace-nowrap px-4 py-2 text-[13px] font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        isActive
                          ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 ring-1 ring-white/10'
                          : 'bg-white/5 text-zinc-300 border border-white/5 hover:text-white hover:bg-white/10 hover:border-white/10 shadow-sm'
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              {selectedCluster && (
                <button 
                  onClick={() => setSelectedCluster(null)}
                  className="w-full mt-4 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-white/10 shadow-sm backdrop-blur-md"
                >
                  ← 클러스터 해제하고 지도 전체보기
                </button>
              )}
            </div>

            {/* Sidebar Contents */}
            <div className="flex-1 overflow-y-auto relative z-0 bg-transparent" style={{ scrollbarWidth: 'none' }}>
              <div className="p-4 space-y-4">
                {(selectedCluster || filteredRestaurants).map(r => (
                  <div 
                    key={r.id}
                    onClick={() => {
                      handleSelectRestaurant(r);
                      map?.setLevel(4, { animate: true });
                      map?.panTo(new kakao.maps.LatLng(r.lat, r.lng));
                    }}
                    onMouseEnter={() => setHoveredRestaurantId(r.id)}
                    onMouseLeave={() => setHoveredRestaurantId(null)}
                    className="group relative bg-white/[0.03] backdrop-blur-md rounded-3xl cursor-pointer border border-white/10 hover-acrylic-glow flex flex-col overflow-hidden"
                  >
                    {/* Instagram-style Feed Header (Youtuber Info & Heart Bookmark) */}
                    {r.videos?.[0]?.youtuber && (
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-transparent shrink-0 z-10">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {r.videos[0].youtuber.profile_image ? (
                            <div className="instagram-story-ring shrink-0">
                              <img 
                                src={r.videos[0].youtuber.profile_image} 
                                className="w-7 h-7 rounded-full object-cover border-2 border-zinc-900 shadow-sm"
                                alt={r.videos[0].youtuber.name} 
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border-2 border-zinc-900 shrink-0">
                              {r.videos[0].youtuber.name[0]}
                            </div>
                          )}
                          <span className="text-[13.5px] font-extrabold text-zinc-100 truncate tracking-tight ml-1">
                            {r.videos[0].youtuber.name}
                          </span>
                        </div>

                        {/* Elastic Heart Toggle Button */}
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={(e) => {
                            e.stopPropagation(); // 카드 이동 전파 차단
                            const isFav = favorites.includes(r.id);
                            if (isFav) {
                              setFavorites(favorites.filter(id => id !== r.id));
                            } else {
                              setFavorites([...favorites, r.id]);
                            }
                          }}
                          className="p-1.5 rounded-full hover:bg-white/5 transition-colors shrink-0"
                        >
                          <Heart 
                            size={18} 
                            className={`transition-all duration-300 ${
                              favorites.includes(r.id)
                                ? 'text-red-500 fill-current drop-shadow-[0_0_6px_rgba(239,68,68,0.45)]'
                                : 'text-zinc-500 hover:text-red-500'
                            }`} 
                          />
                        </motion.button>
                      </div>
                    )}

                    {/* Thumbnail - 16:9 ratio */}
                    <div className="relative w-full aspect-video shrink-0 overflow-hidden bg-zinc-950 ring-1 ring-white/5">
                      {r.videos?.[0]?.thumbnail ? (
                        <img 
                           src={r.videos[0].thumbnail} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                          alt={r.name}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-gradient-to-br from-zinc-900 to-zinc-800">
                          <Utensils size={36} />
                        </div>
                      )}

                      {/* Shorts badge */}
                      {r.videos?.[0]?.is_short && (
                        <div className="absolute bottom-3 right-3 bg-red-600/90 backdrop-blur-md text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-0.5 border border-red-500/30 shadow-[0_2px_8px_rgba(220,38,38,0.3)]">
                          <Play size={8} fill="currentColor"/> SHORTS
                        </div>
                      )}
                    </div>

                    {/* Info Section */}
                    <div className="p-4 flex flex-col space-y-2">
                      {/* Fork & Knife, Restaurant Name, Category & View Count */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="p-1 bg-white/5 rounded-lg text-brand-orange shrink-0">
                            <Utensils size={14} className="stroke-[2.5]" />
                          </div>
                          <h4 className="font-extrabold text-[15px] text-zinc-100 truncate tracking-tight">{r.name}</h4>
                          <span className="text-[11px] font-semibold text-zinc-400 shrink-0">| {r.category}</span>
                        </div>
                        {r.videos?.[0]?.view_count !== undefined ? (
                          <span className="text-[11px] font-extrabold bg-orange-950/30 text-orange-400 px-2 py-0.5 rounded-md shrink-0">
                            조회수 {formatViewCount(r.videos[0].view_count)}회
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md shrink-0">
                            조회수 0회
                          </span>
                        )}
                      </div>

                      {/* Video Title */}
                      {r.videos?.[0]?.title && (
                        <p className="text-sm font-semibold text-zinc-300 line-clamp-2 leading-relaxed mt-1">
                          {r.videos[0].title}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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

      {/* 실제 지도 렌더링 영역 (테마 필터 격리 적용) */}
      <div className={`absolute inset-0 w-full h-full transition-colors duration-700 ${mapTheme}`}>
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
            const clustered = filteredRestaurants.filter(r => {
              const rLatLng = new kakao.maps.LatLng(r.lat, r.lng);
              return bounds.contain(rLatLng);
            });
            setSelectedRestaurant(null);
            setSelectedCluster(clustered);
          }}
          styles={[{ // 스텔스 클러스터 커스텀 디자인 (극도의 미니멀리즘)
            width: '32px', height: '32px',
            background: 'rgba(24, 24, 27, 0.95)', // 솔리드 블랙/무채색 다크(zinc-900)
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
          {zoomLevel <= 10 && filteredRestaurants.map((restaurant) => (
            <CustomOverlayMap
              key={restaurant.id}
              position={{ lat: restaurant.lat, lng: restaurant.lng }}
              clickable={true}
              yAnchor={1} // 핀의 꼬리가 마커 위치에 오도록 (하단 정렬)
              zIndex={mapHoveredRestaurantId === restaurant.id ? 100 : (selectedRestaurant?.id === restaurant.id ? 50 : (effectiveHoveredId === restaurant.id ? 30 : 10))}
            >
              <div 
                onClick={() => {
                  handleSelectRestaurant(restaurant);
                  map?.panTo(new kakao.maps.LatLng(restaurant.lat, restaurant.lng));
                }} 
                onMouseEnter={() => setMapHoveredRestaurantId(restaurant.id)}
                onMouseLeave={() => setMapHoveredRestaurantId(null)}
                className={`relative cursor-pointer transition-all duration-300 origin-bottom ${
                  selectedRestaurant?.id === restaurant.id 
                    ? 'scale-125 z-50' 
                    : mapHoveredRestaurantId === restaurant.id 
                      ? 'scale-110 -translate-y-2 z-40 drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)]' 
                      : effectiveHoveredId === restaurant.id
                        ? 'scale-110 z-30 drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)]'
                        : 'z-10 hover:scale-110'
                }`}
              >
                {getMarkerUI(restaurant)}

                {/* 마커 직접 호버(Hover) 시 상단에 생성되는 초프리미엄 인포윈도우 말풍선 카드 */}
                {mapHoveredRestaurantId === restaurant.id && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 w-[280px] rounded-3xl bg-zinc-900/95 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col select-none z-[120] text-left overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                  >
                    {/* 은은한 둥근 그라데이션 테두리 */}
                    <div 
                      className="absolute inset-0 rounded-3xl pointer-events-none" 
                      style={{
                        padding: '1.2px',
                        background: 'linear-gradient(to right, rgba(220, 38, 38, 0.35), rgba(249, 115, 22, 0.35))',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                      }}
                    />

                    {/* 하단 화살표 정렬 꼬리 */}
                    <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-zinc-900 rotate-45 border-r border-b border-orange-500/20" />

                    {/* Instagram-style Feed Header (Youtuber Info & Heart Bookmark) */}
                    {restaurant.videos?.[0]?.youtuber && (
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-transparent shrink-0 z-10">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {restaurant.videos[0].youtuber.profile_image ? (
                            <div className="instagram-story-ring shrink-0">
                              <img 
                                src={restaurant.videos[0].youtuber.profile_image} 
                                className="w-7 h-7 rounded-full object-cover border-2 border-zinc-900 shadow-sm"
                                alt={restaurant.videos[0].youtuber.name} 
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border-2 border-zinc-900 shrink-0">
                              {restaurant.videos[0].youtuber.name[0]}
                            </div>
                          )}
                          <span className="text-[13.5px] font-extrabold text-zinc-100 truncate tracking-tight ml-1">
                            {restaurant.videos[0].youtuber.name}
                          </span>
                        </div>

                        {/* Elastic Heart Toggle Button */}
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={(e) => {
                            e.stopPropagation(); // 카드 이동 전파 차단
                            const isFav = favorites.includes(restaurant.id);
                            if (isFav) {
                              setFavorites(favorites.filter(id => id !== restaurant.id));
                            } else {
                              setFavorites([...favorites, restaurant.id]);
                            }
                          }}
                          className="p-1.5 rounded-full hover:bg-white/5 transition-colors shrink-0"
                        >
                          <Heart 
                            size={18} 
                            className={`transition-all duration-300 ${
                              favorites.includes(restaurant.id)
                                ? 'text-red-500 fill-current drop-shadow-[0_0_6px_rgba(239,68,68,0.45)]'
                                : 'text-zinc-500 hover:text-red-500'
                            }`} 
                          />
                        </motion.button>
                      </div>
                    )}

                    {/* Thumbnail - 16:9 ratio */}
                    <div className="relative w-full aspect-video shrink-0 overflow-hidden bg-zinc-950 ring-1 ring-white/5">
                      {restaurant.videos?.[0]?.thumbnail ? (
                        <img 
                          src={restaurant.videos[0].thumbnail} 
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                          alt={restaurant.name}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-gradient-to-br from-zinc-900 to-zinc-800">
                          <Utensils size={36} />
                        </div>
                      )}

                      {/* Shorts badge */}
                      {restaurant.videos?.[0]?.is_short && (
                        <div className="absolute bottom-3 right-3 bg-red-600/90 backdrop-blur-md text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-0.5 border border-red-500/30 shadow-[0_2px_8px_rgba(220,38,38,0.3)]">
                          <Play size={8} fill="currentColor"/> SHORTS
                        </div>
                      )}
                    </div>

                    {/* Info Section */}
                    <div className="p-4 flex flex-col space-y-2">
                      {/* Fork & Knife, Restaurant Name, Category & View Count */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="p-1 bg-white/5 rounded-lg text-brand-orange shrink-0">
                            <Utensils size={14} className="stroke-[2.5]" />
                          </div>
                          <h4 className="font-extrabold text-[15px] text-zinc-100 truncate tracking-tight">{restaurant.name}</h4>
                          <span className="text-[11px] font-semibold text-zinc-400 shrink-0">| {restaurant.category}</span>
                        </div>
                        {restaurant.videos?.[0]?.view_count !== undefined ? (
                          <span className="text-[11px] font-extrabold bg-orange-950/30 text-orange-400 px-2 py-0.5 rounded-md shrink-0">
                            조회수 {formatViewCount(restaurant.videos[0].view_count)}회
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md shrink-0">
                            조회수 0회
                          </span>
                        )}
                      </div>

                      {/* Video Title */}
                      {restaurant.videos?.[0]?.title && (
                        <p className="text-sm font-semibold text-zinc-300 line-clamp-2 leading-relaxed mt-1">
                          {restaurant.videos[0].title}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 클릭(선택) 시에만 표시되는 마커 밀착형 식당명 라벨 */}
                {selectedRestaurant?.id === restaurant.id && (
                  <div className="absolute top-full -mt-0.5 left-1/2 -translate-x-1/2 bg-zinc-950/95 text-white text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg shadow-[0_4px_15px_rgba(0,0,0,0.35)] border border-orange-500/50 whitespace-nowrap z-50">
                    {restaurant.name}
                  </div>
                )}
              </div>
            </CustomOverlayMap>
          ))}
        </MarkerClusterer>
      </Map>
      </div>

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
                      handleSelectRestaurant(r);
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
        onClose={() => handleSelectRestaurant(null)} 
      />

      {/* 모바일 탭 컨텐츠 오버레이 바텀시트 */}
      <OverlayContainer activeTab={activeTab} onClose={() => setActiveTab('home')}>
        {activeTab === 'near' && (
          <NearHotplacesView
            displayedRestaurants={restaurants}
            favorites={favorites}
            toggleFavorite={(id) => {
              const isFav = favorites.includes(id);
              if (isFav) setFavorites(favorites.filter(favId => favId !== id));
              else setFavorites([...favorites, id]);
            }}
            onSelectRestaurant={(r) => {
              setSelectedRestaurant(r);
              setActiveTab('home'); // 지도로 가기 위해 홈 탭으로 전환
              map?.setLevel(4, { animate: true });
              map?.panTo(new kakao.maps.LatLng(r.lat, r.lng));
            }}
            onNavigateDetail={(id) => {
              const target = restaurants.find(r => r.id === id);
              if (target) {
                setSelectedRestaurant(target);
                setActiveTab('home');
                map?.setLevel(4, { animate: true });
                map?.panTo(new kakao.maps.LatLng(target.lat, target.lng));
              }
            }}
            onOpenSubmission={() => setIsSubmissionOpen(true)}
            onTagClick={(tag) => {
              setActiveCategory(tag);
              setActiveTab('home');
            }}
          />
        )}
        {activeTab === 'favorites' && (
          <FavoritesView
            onSelectRestaurant={(lat, lng, id) => {
              const target = restaurants.find(r => r.id === id);
              if (target) {
                setSelectedRestaurant(target);
                setActiveTab('home');
                map?.setLevel(4, { animate: true });
                map?.panTo(new kakao.maps.LatLng(lat, lng));
              }
            }}
            onNavigateDetail={(id) => {
              const target = restaurants.find(r => r.id === id);
              if (target) {
                setSelectedRestaurant(target);
                setActiveTab('home');
                map?.setLevel(4, { animate: true });
                map?.panTo(new kakao.maps.LatLng(target.lat, target.lng));
              }
            }}
          />
        )}
        {activeTab === 'mypage' && (
          <MyPageView onOpenSubmission={() => setIsSubmissionOpen(true)} />
        )}
      </OverlayContainer>

      {/* 모바일 하단 내비게이션 스마트 탭바 */}
      <BottomTabBar activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* 나만의 핫플 제보하기 바텀시트 */}
      <RestaurantSubmissionBottomSheet isOpen={isSubmissionOpen} onClose={() => setIsSubmissionOpen(false)} />
    </div>
  );
}
