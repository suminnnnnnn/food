'use client';

const INITIAL_CENTER = { lat: 37.5665, lng: 126.9780 };
const INITIAL_LEVEL = 5;

import { useEffect, useState, useRef, useMemo } from 'react';
import { Map, CustomOverlayMap, MapMarker, MarkerClusterer, Polygon, Polyline, useKakaoLoader } from 'react-kakao-maps-sdk';

import { supabase } from '@/lib/supabase/client';
import { Restaurant, ItineraryItem, Itinerary } from '@/types';
import { MapBounds } from '@/hooks/useMapBounds';
import RestaurantInfoCard from '@/components/ui/RestaurantInfoCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Dices, Flame, Play, MapPin, Utensils, Heart, Star, Home, User, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, List, X, Calendar, Search, Plus, MapPinPlus, CalendarRange, Eye } from 'lucide-react';
import { MichelinIcon } from '@/components/icons/CustomIcons';
import { Swiper, SwiperSlide } from 'swiper/react';
import NearHotplacesView from '@/components/ui/NearHotplacesView';
import FavoritesView from '@/components/ui/FavoritesView';
import MyPageView from '@/components/ui/MyPageView';
import BottomTabBar from '@/components/ui/BottomTabBar';
import OverlayContainer from '@/components/ui/OverlayContainer';
import RestaurantSubmissionBottomSheet from '@/components/ui/RestaurantSubmissionBottomSheet';
import LoginModal from '@/components/ui/LoginModal';
import ItineraryPlannerBottomSheet from '@/components/ui/ItineraryPlannerBottomSheet';
import FloatingItineraryPanel from '@/components/ui/FloatingItineraryPanel';
import CustomModal from '@/components/ui/CustomModal';
import { saveLocalItinerary } from '@/lib/supabase/itineraries';
import { getRouteBufferPolygon, isPointInPolygon, getDistance } from '@/lib/geoUtils';



const formatViewCount = (count: number) => {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace('.0', '')}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}천`;
  return count.toString();
};

const getBestVideo = (videos: any[] | undefined, preferredType?: string) => {
  if (!videos || videos.length === 0) return null;
  
  let targetVideos = videos;
  if (preferredType === '쇼츠 리뷰') {
    const shorts = videos.filter(v => v.is_short);
    if (shorts.length > 0) targetVideos = shorts;
  } else if (preferredType === '롱폼 리뷰') {
    const longs = videos.filter(v => !v.is_short);
    if (longs.length > 0) targetVideos = longs;
  }

  return targetVideos.reduce((best, curr) => (best.view_count || 0) > (curr.view_count || 0) ? best : curr, targetVideos[0]);
};

// OSRM API를 사용해 두 점 사이의 실제 도로망 위경도 좌표 목록 조회
async function fetchOSRMRoute(ptA: { lat: number; lng: number }, ptB: { lat: number; lng: number }): Promise<{ lat: number; lng: number }[]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${ptA.lng},${ptA.lat};${ptB.lng},${ptB.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates as [number, number][];
      return coordinates.map((coord: [number, number]) => ({
        lat: coord[1],
        lng: coord[0]
      }));
    }
  } catch (e) {
    console.error("OSRM Route fetch failed", e);
  }
  // 에러 또는 빈 응답 시 단순 직선으로 폴백
  return [ptA, ptB];
}

// OSRM API를 사용해 경유지를 포함한 세 점 사이의 실제 도로망 위경도 좌표 목록 조회
async function fetchOSRMRouteWithWaypoint(
  ptA: { lat: number; lng: number },
  waypoint: { lat: number; lng: number },
  ptB: { lat: number; lng: number }
): Promise<{ lat: number; lng: number }[]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${ptA.lng},${ptA.lat};${waypoint.lng},${waypoint.lat};${ptB.lng},${ptB.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates as [number, number][];
      return coordinates.map((coord: [number, number]) => ({
        lat: coord[1],
        lng: coord[0]
      }));
    }
  } catch (e) {
    console.error("OSRM Route with waypoint fetch failed", e);
  }
  return [ptA, waypoint, ptB];
}

// 카카오 Places 서비스를 이용해 특정 중심점 좌표 기준 가장 가까운 지하철역(SW8) 정보 조회
function findNearbySubwayStation(lat: number, lng: number): Promise<{ name: string; lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      resolve(null);
      return;
    }
    try {
      const ps = new window.kakao.maps.services.Places();
      ps.categorySearch('SW8', (data: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
          const station = data[0];
          resolve({
            name: station.place_name,
            lat: parseFloat(station.y),
            lng: parseFloat(station.x)
          });
        } else {
          resolve(null);
        }
      }, {
        location: new window.kakao.maps.LatLng(lat, lng),
        radius: 2000, // 2km 반경 탐색
        sort: window.kakao.maps.services.SortBy.ACCURACY
      });
    } catch (e) {
      console.error("Subway search error", e);
      resolve(null);
    }
  });
}

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
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [activeSort, setActiveSort] = useState<'latest' | 'views'>('latest');
  const [activeVideoType, setActiveVideoType] = useState<'영상 전체' | '쇼츠 리뷰' | '롱폼 리뷰'>('영상 전체');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isVideoTypeOpen, setIsVideoTypeOpen] = useState(false);
  const [hoveredRestaurantId, setHoveredRestaurantId] = useState<string | null>(null);
  const [mapHoveredRestaurantId, setMapHoveredRestaurantId] = useState<string | null>(null);
  const [sonarPing, setSonarPing] = useState<number>(0);
  const [mapTheme, setMapTheme] = useState<'theme-silver' | 'theme-navy' | 'theme-sand' | ''>('');
  const [loading, mapError] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_JS_API_KEY as string,
    libraries: ['services', 'clusterer', 'drawing'],
  });
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Restaurant[] | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(INITIAL_LEVEL);
  // 스마트 탭 시스템 및 제보하기 상태 추가
  const [activeTab, setActiveTab] = useState<any>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [desktopView, setDesktopView] = useState<'list' | 'mypage'>('list');
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
  const [submissionTarget, setSubmissionTarget] = useState<{id: string, name: string} | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<{ name: string; email: string; provider: 'kakao' | 'google' | 'naver'; avatarUrl?: string } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isItineraryPlannerOpen, setIsItineraryPlannerOpen] = useState(false);
  const [editingItinerary, setEditingItinerary] = useState<any>(null);
  const [activeItinerary, setActiveItinerary] = useState<any>(null);
  const [activeItineraryDay, setActiveItineraryDay] = useState<number>(1);
  // 3차 기획: 지도 드로잉 일정 만들기 상태
  const [isPlanningMode, setIsPlanningMode] = useState<boolean>(false);
  const [activePlanningItinerary, setActivePlanningItinerary] = useState<any>(null);
  const [planningActiveDay, setPlanningActiveDay] = useState<number>(1);
  const [editingItemForMemo, setEditingItemForMemo] = useState<any>(null); // 플로팅 패널의 메모 수정용
  const [showMemoModal, setShowMemoModal] = useState<boolean>(false);
  const [inputVisitTime, setInputVisitTime] = useState<string>('');
  const [inputMemo, setInputMemo] = useState<string>('');
  // 3차 보완: 장소 검색 모달 및 스팟 기반 1km 추천 상태
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedPlanningItemId, setSelectedPlanningItemId] = useState<string | null>(null);
  const [recommendedRestaurantsForSelectedSpot, setRecommendedRestaurantsForSelectedSpot] = useState<{ restaurant: Restaurant; distance: number; type: 'near' | 'on_the_way' }[]>([]);
  // OSRM 실제 도로망 기반 구간별 경로 좌표 상태 (각 구간의 좌표 배열의 배열)
  const [planningRouteCoordinates, setPlanningRouteCoordinates] = useState<any[]>([]);
  const [customWaypoints, setCustomWaypoints] = useState<Record<string, { lat: number; lng: number }>>({});
  const [activeRouteCoordinates, setActiveRouteCoordinates] = useState<{ lat: number; lng: number }[][]>([]);
  const [nearRouteRestaurants, setNearRouteRestaurants] = useState<Restaurant[]>([]);

  // 신규 일정 수립 날짜/제목 설정 폼 상태
  const [showInitPlanningModal, setShowInitPlanningModal] = useState<boolean>(false);
  const [newItineraryTitle, setNewItineraryTitle] = useState<string>('');
  const [newItineraryStartDate, setNewItineraryStartDate] = useState<string>('');
  const [newItineraryEndDate, setNewItineraryEndDate] = useState<string>('');
  const [newItineraryCompanion, setNewItineraryCompanion] = useState<string>('연인과');
  const [newItineraryTheme, setNewItineraryTheme] = useState<string>('맛집 탐방');
  const [newItineraryTransport, setNewItineraryTransport] = useState<string>('대중교통/도보');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<number>(5); // 5 = 6월, 6 = 7월
  const [isFabMenuOpen, setIsFabMenuOpen] = useState<boolean>(false);
  const [heroRestaurantId, setHeroRestaurantId] = useState<string | null>(null);

  // 캘린더 날짜 렌더링 헬퍼 함수
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    const firstDayIndex = date.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let i = 1; i <= lastDay; i++) {
      const yyyy = year;
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    return days;
  };

  const handleCalendarDaySelect = (dateStr: string) => {
    if (!newItineraryStartDate || (newItineraryStartDate && newItineraryEndDate)) {
      setNewItineraryStartDate(dateStr);
      setNewItineraryEndDate('');
    } else {
      const selectedDate = new Date(dateStr);
      const firstDate = new Date(newItineraryStartDate);
      
      if (selectedDate < firstDate) {
        setNewItineraryEndDate(newItineraryStartDate);
        setNewItineraryStartDate(dateStr);
      } else {
        setNewItineraryEndDate(dateStr);
      }
    }
  };

  const getDayStatus = (dateStr: string) => {
    if (!newItineraryStartDate) return 'normal';
    if (newItineraryStartDate === dateStr) return 'start';
    if (newItineraryEndDate === dateStr) return 'end';
    if (newItineraryEndDate && new Date(dateStr) > new Date(newItineraryStartDate) && new Date(dateStr) < new Date(newItineraryEndDate)) {
      return 'in-range';
    }
    return 'normal';
  };

  // 특정 스팟을 탭했을 때 주변 1km 및 가는길 1km 맛집 추천 업데이트 로직
  const handleSelectPlanningItem = (item: ItineraryItem) => {
    setSelectedPlanningItemId(item.id);
    if (!activePlanningItinerary) return;

    const dayData = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay);
    if (!dayData) return;

    const items = dayData.items;
    const idx = items.findIndex((it: any) => it.id === item.id);
    if (idx === -1) return;

    const nearRecommendations: { restaurant: Restaurant; distance: number; type: 'near' | 'on_the_way' }[] = [];
    const onTheWayRecommendations: { restaurant: Restaurant; distance: number; type: 'near' | 'on_the_way' }[] = [];

    // 이전 장소가 존재할 경우 가는 길(이전 장소 -> 스팟) 5km 다각형 버퍼 생성
    let wayPolygon: { lat: number; lng: number }[] | null = null;
    if (idx > 0) {
      const prevItem = items[idx - 1];
      wayPolygon = getRouteBufferPolygon(
        { lat: prevItem.lat, lng: prevItem.lng },
        { lat: item.lat, lng: item.lng }
      );
    }

    restaurants.forEach((restaurant) => {
      // 1. 스팟 자체의 반경 5km 이내 거리 계산
      const dist = getDistance(item.lat, item.lng, restaurant.lat, restaurant.lng);
      if (dist <= 5.0) {
        nearRecommendations.push({ restaurant, distance: dist, type: 'near' });
      } else if (wayPolygon && isPointInPolygon({ lat: restaurant.lat, lng: restaurant.lng }, wayPolygon)) {
        // 2. 가는 길 5km 다각형 내부 포함 여부
        onTheWayRecommendations.push({ restaurant, distance: dist, type: 'on_the_way' });
      }
    });

    const merged = [...nearRecommendations, ...onTheWayRecommendations]
      .filter((v, i, a) => a.findIndex(t => t.restaurant.id === v.restaurant.id) === i)
      .sort((a, b) => a.distance - b.distance);

    setRecommendedRestaurantsForSelectedSpot(merged);
  };

  const handleSearchPlaces = () => {
    if (!searchQuery.trim() || !window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      alert('검색어를 입력해 주세요.');
      return;
    }

    setIsSearching(true);
    const ps = new window.kakao.maps.services.Places();
    
    ps.keywordSearch(searchQuery, (data: any, status: any) => {
      setIsSearching(false);
      if (status === window.kakao.maps.services.Status.OK) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
        alert('검색 결과가 없습니다.');
      }
    });
  };

  const handleStartNewPlanning = () => {
    if (!newItineraryTitle.trim()) {
      alert('일정 명칭을 입력해 주세요.');
      return;
    }
    if (!newItineraryStartDate || !newItineraryEndDate) {
      alert('여행 기간을 입력해 주세요.');
      return;
    }
    const start = new Date(newItineraryStartDate);
    const end = new Date(newItineraryEndDate);
    if (end < start) {
      alert('종료일은 시작일보다 빠를 수 없습니다.');
      return;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const generatedDays = Array.from({ length: diffDays }, (_, i) => ({
      day: i + 1,
      items: []
    }));

    const newItinerary: any = {
      id: `itinerary-${Date.now()}`,
      title: newItineraryTitle,
      start_date: newItineraryStartDate,
      end_date: newItineraryEndDate,
      companion: newItineraryCompanion,
      theme: newItineraryTheme,
      transport: newItineraryTransport,
      days: generatedDays,
      created_at: new Date().toISOString()
    };

    setEditingItinerary(null);
    setActivePlanningItinerary(newItinerary);
    setPlanningActiveDay(1);
    setIsPlanningMode(true);
    setShowInitPlanningModal(false);
    setActiveTab('home');
  };

  // 계획 모드 또는 활성 일정 모드 OSRM 실제 도로망 경로 구간 좌표 계산
  useEffect(() => {
    if (!isPlanningMode || !activePlanningItinerary) {
      setPlanningRouteCoordinates([]);
      return;
    }

    const dayData = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay);
    const dayItems = dayData?.items || [];
    if (dayItems.length === 0) {
      setPlanningRouteCoordinates([]);
      return;
    }

    let isMounted = true;

    async function calculateRoutes() {
      const routeSegments: {
        targetId: string;
        ptA: { lat: number; lng: number; name: string };
        ptB: { lat: number; lng: number; name: string };
        coordinates: { lat: number; lng: number }[];
      }[] = [];

      // 1. 2일차 이상일 때 전날 마지막 스팟 연계 경로 계산 (0번째 세그먼트로 보관)
      if (planningActiveDay >= 2) {
        const prevDayData = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay - 1);
        const prevDayItems = prevDayData?.items || [];
        const lastSpot = prevDayItems[prevDayItems.length - 1];

        if (lastSpot) {
          const ptA = lastSpot;
          const ptB = dayItems[0];
          const transport = ptB.transportType || (activePlanningItinerary.transport === '자차/렌터카' ? 'car' : 'walk');
          const waypoint = customWaypoints[ptB.id];

          let segmentCoords: { lat: number; lng: number }[] = [];

          if (waypoint) {
            segmentCoords = await fetchOSRMRouteWithWaypoint(
              { lat: ptA.lat, lng: ptA.lng },
              waypoint,
              { lat: ptB.lat, lng: ptB.lng }
            );
          } else if (transport === 'transit') {
            const dist = getDistance(ptA.lat, ptA.lng, ptB.lat, ptB.lng);
            if (dist >= 3.0) {
              const stationA = await findNearbySubwayStation(ptA.lat, ptA.lng);
              const stationB = await findNearbySubwayStation(ptB.lat, ptB.lng);

              if (stationA && stationB && stationA.name !== stationB.name) {
                const part1 = await fetchOSRMRoute({ lat: ptA.lat, lng: ptA.lng }, { lat: stationA.lat, lng: stationA.lng });
                const part2 = await fetchOSRMRoute({ lat: stationA.lat, lng: stationA.lng }, { lat: stationB.lat, lng: stationB.lng });
                const part3 = await fetchOSRMRoute({ lat: stationB.lat, lng: stationB.lng }, { lat: ptB.lat, lng: ptB.lng });
                segmentCoords = [...part1, ...part2.slice(1), ...part3.slice(1)];
              } else {
                segmentCoords = await fetchOSRMRoute({ lat: ptA.lat, lng: ptA.lng }, { lat: ptB.lat, lng: ptB.lng });
              }
            } else {
              segmentCoords = await fetchOSRMRoute({ lat: ptA.lat, lng: ptA.lng }, { lat: ptB.lat, lng: ptB.lng });
            }
          } else {
            segmentCoords = await fetchOSRMRoute({ lat: ptA.lat, lng: ptA.lng }, { lat: ptB.lat, lng: ptB.lng });
          }
          routeSegments.push({
            targetId: ptB.id,
            ptA: { lat: ptA.lat, lng: ptA.lng, name: ptA.name },
            ptB: { lat: ptB.lat, lng: ptB.lng, name: ptB.name },
            coordinates: segmentCoords
          });
        }
      }

      // 2. 당일 장소들 간의 구간 경로 계산
      if (dayItems.length >= 2) {
        for (let i = 0; i < dayItems.length - 1; i++) {
          const ptA = dayItems[i];
          const ptB = dayItems[i + 1];
          const transport = ptB.transportType || (activePlanningItinerary.transport === '자차/렌터카' ? 'car' : 'walk');
          const waypoint = customWaypoints[ptB.id];

          let segmentCoords: { lat: number; lng: number }[] = [];

          if (waypoint) {
            segmentCoords = await fetchOSRMRouteWithWaypoint(
              { lat: ptA.lat, lng: ptA.lng },
              waypoint,
              { lat: ptB.lat, lng: ptB.lng }
            );
          } else if (transport === 'transit') {
            const dist = getDistance(ptA.lat, ptA.lng, ptB.lat, ptB.lng);
            if (dist >= 3.0) {
              const stationA = await findNearbySubwayStation(ptA.lat, ptA.lng);
              const stationB = await findNearbySubwayStation(ptB.lat, ptB.lng);

              if (stationA && stationB && stationA.name !== stationB.name) {
                const part1 = await fetchOSRMRoute({ lat: ptA.lat, lng: ptA.lng }, { lat: stationA.lat, lng: stationA.lng });
                const part2 = await fetchOSRMRoute({ lat: stationA.lat, lng: stationA.lng }, { lat: stationB.lat, lng: stationB.lng });
                const part3 = await fetchOSRMRoute({ lat: stationB.lat, lng: stationB.lng }, { lat: ptB.lat, lng: ptB.lng });
                segmentCoords = [...part1, ...part2.slice(1), ...part3.slice(1)];
              } else {
                segmentCoords = await fetchOSRMRoute({ lat: ptA.lat, lng: ptA.lng }, { lat: ptB.lat, lng: ptB.lng });
              }
            } else {
              segmentCoords = await fetchOSRMRoute({ lat: ptA.lat, lng: ptA.lng }, { lat: ptB.lat, lng: ptB.lng });
            }
          } else {
            segmentCoords = await fetchOSRMRoute({ lat: ptA.lat, lng: ptA.lng }, { lat: ptB.lat, lng: ptB.lng });
          }
          routeSegments.push({
            targetId: ptB.id,
            ptA: { lat: ptA.lat, lng: ptA.lng, name: ptA.name },
            ptB: { lat: ptB.lat, lng: ptB.lng, name: ptB.name },
            coordinates: segmentCoords
          });
        }
      }

      if (isMounted) {
        setPlanningRouteCoordinates(routeSegments);
      }
    }

    calculateRoutes();
    return () => {
      isMounted = false;
    };
  }, [isPlanningMode, activePlanningItinerary, planningActiveDay, customWaypoints]);

  // OSRM 실제 경로(planningRouteCoordinates)가 변경될 때마다 주변 맛집을 실시간 조회하여 갱신
  useEffect(() => {
    if (!isPlanningMode || !activePlanningItinerary || planningRouteCoordinates.length === 0) {
      setNearRouteRestaurants([]);
      return;
    }

    const flatCoordinates = planningRouteCoordinates.flatMap(seg => seg.coordinates).map((pt) => [pt.lng, pt.lat]);
    if (flatCoordinates.length < 2) {
      setNearRouteRestaurants([]);
      return;
    }

    let isMounted = true;

    async function fetchNearRouteRestaurants() {
      try {
        // 교통수단별 버퍼 반경 정의 (도보 200m -> 0.2, 대중교통 500m -> 0.5, 자차 2km -> 2.0)
        const dayData = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay);
        const dayItems = dayData?.items || [];
        const transport = dayItems[0]?.transportType || (activePlanningItinerary.transport === '자차/렌터카' ? 'car' : 'walk');
        const radiusKm = transport === 'car' ? 2.0 : transport === 'transit' ? 0.5 : 0.2;

        const res = await fetch('/api/restaurants/near-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coordinates: flatCoordinates,
            radiusKm
          })
        });

        const json = await res.json();
        if (json.success && json.data && isMounted) {
          setNearRouteRestaurants(json.data);
        }
      } catch (e) {
        console.error("Failed to fetch near route restaurants", e);
      }
    }

    // 과도한 API 호출 방지를 위해 디바운스 적용
    const timer = setTimeout(() => {
      fetchNearRouteRestaurants();
    }, 450);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [planningRouteCoordinates, isPlanningMode, activePlanningItinerary, planningActiveDay]);

  const isMountedRef = useRef(false);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const storyScrollRef = useRef<HTMLDivElement>(null);





  // 로컬스토리지에서 로그인 유저 세션 정보 복원
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('modoo-matjip-user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error("Failed to parse user session", e);
        }
      }
    }
  }, []);

  // 마이페이지 등에서 활성화한 일정을 리슨하여 지도에 렌더링하고 첫 번째 장소로 이동
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleActivateItinerary = (e: Event) => {
      const customEvent = e as CustomEvent;
      const itinerary = customEvent.detail;
      if (itinerary) {
        setActiveItinerary(itinerary);
        setActiveItineraryDay(1);
        setActiveTab('home'); // 지도 탭으로 이동
        
        // 첫 번째 장소 좌표로 지도 포커스 및 줌 레벨 최적화
        const firstItem = itinerary.days?.[0]?.items?.[0];
        if (firstItem && map) {
          setTimeout(() => {
            map.setLevel(4, { animate: true });
            map.panTo(new kakao.maps.LatLng(firstItem.lat, firstItem.lng));
          }, 300);
        }
      }
    };

    window.addEventListener('activateItinerary', handleActivateItinerary);
    return () => {
      window.removeEventListener('activateItinerary', handleActivateItinerary);
    };
  }, [map]);

  // 활성화된 일정의 일차가 변경될 때 해당 일차의 첫 장소로 지도 카메라 이동
  useEffect(() => {
    if (activeItinerary) {
      const dayItems = activeItinerary.days.find((d: any) => d.day === activeItineraryDay)?.items || [];
      const firstItem = dayItems[0];
      if (firstItem && map) {
        map.panTo(new kakao.maps.LatLng(firstItem.lat, firstItem.lng));
      }
    }
  }, [activeItineraryDay, activeItinerary, map]);


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

  // 3차 기획: 1km 버퍼 다각형 리스트 연산
  const activePlanningBufferPolygons = (() => {
    if (!activePlanningItinerary) return [];
    const dayData = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay);
    if (!dayData || dayData.items.length < 2) return [];

    const polygons: { lat: number; lng: number }[][] = [];
    for (let i = 0; i < dayData.items.length - 1; i++) {
      const pA = dayData.items[i];
      const pB = dayData.items[i + 1];
      const poly = getRouteBufferPolygon({ lat: pA.lat, lng: pA.lng }, { lat: pB.lat, lng: pB.lng });
      polygons.push(poly.map(p => ({ lat: p.lat, lng: p.lng })));
    }
    return polygons;
  })();

  // 3차 기획: 임의의 맛집이 활성화된 계획 버퍼 내에 속하는지 체크
  const isRestaurantInPlanningBuffer = (restaurant: Restaurant) => {
    if (activePlanningBufferPolygons.length === 0) return false;
    return activePlanningBufferPolygons.some(poly => 
      isPointInPolygon({ lat: restaurant.lat, lng: restaurant.lng }, poly)
    );
  };

  // 3차 기획: 맛집을 경로 선분 중 최적의 인덱스에 삽입(경유지 삽입)
  const insertRestaurantToPlanningRoute = (restaurant: Restaurant) => {
    if (!activePlanningItinerary) return;

    setActivePlanningItinerary((prev: any) => {
      const updatedDays = prev.days.map((d: any) => {
        if (d.day === planningActiveDay) {
          const items = d.items;
          let insertIdx = items.length;

          // 2개 이상의 장소가 있을 때 최적의 수직 인접 선분 구간 탐색
          if (items.length >= 2) {
            let minIncrease = Infinity;
            for (let i = 0; i < items.length - 1; i++) {
              const pA = items[i];
              const pB = items[i + 1];
              // getDistance 사용
              const distA_P = getDistance(pA.lat, pA.lng, restaurant.lat, restaurant.lng);
              const distP_B = getDistance(restaurant.lat, restaurant.lng, pB.lat, pB.lng);
              const distA_B = getDistance(pA.lat, pA.lng, pB.lat, pB.lng);
              
              const increase = distA_P + distP_B - distA_B;
              if (increase < minIncrease) {
                minIncrease = increase;
                insertIdx = i + 1; // A와 B 사이에 쏙 삽입
              }
            }
          }

          const newItem: ItineraryItem = {
            id: `db-${restaurant.id}-${Date.now()}`,
            name: restaurant.name,
            category: restaurant.category || '음식점',
            address: restaurant.address,
            lat: restaurant.lat,
            lng: restaurant.lng,
            is_custom_spot: false,
            restaurant_id: restaurant.id
          };

          const newItems = [...items];
          newItems.splice(insertIdx, 0, newItem);
          return { ...d, items: newItems };
        }
        return d;
      });
      return { ...prev, days: updatedDays };
    });
  };

  // 지도 드로잉용 일정에 장소(일반 장소 또는 맛집) 직접 추가
  const addPlaceToPlanning = (item: Omit<ItineraryItem, 'id'>) => {
    if (!activePlanningItinerary) return;
    
    setActivePlanningItinerary((prev: any) => {
      const updatedDays = prev.days.map((d: any) => {
        if (d.day === planningActiveDay) {
          const newItem: ItineraryItem = {
            ...item,
            id: `${item.is_custom_spot ? 'kakao' : 'db'}-${Date.now()}`
          };
          return { ...d, items: [...d.items, newItem] };
        }
        return d;
      });
      return { ...prev, days: updatedDays };
    });
  };


  // 즐겨찾기 상태 변경 시 localStorage 동기화
  useEffect(() => {
    if (isMountedRef.current) {
      localStorage.setItem('modoo-matjip-favorites', JSON.stringify(favorites));
    }
  }, [favorites]);

  // 마우스 드래그 가로 스크롤 상태
  const filterDrag = useRef({ isDown: false, startX: 0, scrollLeft: 0, hasDragged: false });
  const storyDrag = useRef({ isDown: false, startX: 0, scrollLeft: 0, hasDragged: false });

  const getDragHandlers = (dragRef: React.MutableRefObject<any>) => ({
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      dragRef.current.isDown = true;
      dragRef.current.hasDragged = false;
      dragRef.current.startX = e.pageX - el.offsetLeft;
      dragRef.current.scrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
      dragRef.current.isDown = false;
      e.currentTarget.style.cursor = 'grab';
    },
    onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => {
      dragRef.current.isDown = false;
      e.currentTarget.style.cursor = 'grab';
    },
    onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragRef.current.isDown) return;
      e.preventDefault();
      const el = e.currentTarget;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - dragRef.current.startX) * 1.5;
      if (Math.abs(walk) > 3) {
        dragRef.current.hasDragged = true;
        el.scrollLeft = dragRef.current.scrollLeft - walk;
      }
    },
    onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragRef.current.hasDragged) {
        e.stopPropagation();
        e.preventDefault();
        dragRef.current.hasDragged = false;
      }
    }
  });

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

  // restaurants 데이터 갱신 시 현재 선택된 식당 정보 동기화 (영상 제보 등 즉각 반영)
  useEffect(() => {
    if (selectedRestaurant) {
      const updated = restaurants.find(r => r.id === selectedRestaurant.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedRestaurant)) {
        setSelectedRestaurant(updated);
        if (onExternalSelectedChange) {
          onExternalSelectedChange(updated);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants]);

  // 내부에서 식당을 클릭했을 때 외부 상태까지 통합 전파하는 핸들러
  const handleSelectRestaurant = (r: Restaurant | null) => {
    setSelectedRestaurant(r);
    if (onExternalSelectedChange) {
      onExternalSelectedChange(r);
    }
  };

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

  // 맛집 총 조회수 기반 Solid 컴팩트 Teardrop 핀 마커 UI 렌더러
  const getMarkerUI = (restaurant: Restaurant) => {
    const testViewsMap: Record<string, number> = {
      '유즈라멘': 1500000,
      '호수집': 780000,
      '도동집': 55000,
      '오근내7닭갈비': 1200000,
      '일미장어': 250000,
      '서부고려족발': 35000,
      '명동칼국수': 950000,
      '서울역철도떡볶이': 1800000,
      '충무칼국수': 45000,
      '그릴': 12000
    };

    const dbTotalViews = restaurant.videos?.reduce((sum, vid) => sum + (vid.view_count || 0), 0) || 0;
    const totalViews = testViewsMap[restaurant.name] !== undefined ? testViewsMap[restaurant.name] : dbTotalViews;

    let viewLevel: 1 | 2 | 3 = 1;
    if (totalViews >= 1000000) viewLevel = 3;
    else if (totalViews >= 100000) viewLevel = 2;

    const isSelected = selectedRestaurant?.id === restaurant.id;
    const isHovered = effectiveHoveredId === restaurant.id;
    const isMapHovered = mapHoveredRestaurantId === restaurant.id;
    const isBufferPlanningRecommended = isPlanningMode && nearRouteRestaurants.some(r => r.id === restaurant.id);
    const isHighlighted = isSelected || isHovered || isMapHovered || isBufferPlanningRecommended;

    // 줌 아웃 시 미니 도트 (호버/선택 시 복원)
    if (zoomLevel >= 8 && !isHighlighted) {
      const dotSize = viewLevel === 3 ? 'w-3.5 h-3.5' : viewLevel === 2 ? 'w-2.5 h-2.5' : 'w-2 h-2';
      return (
        <div className="relative flex items-center justify-center w-5 h-5 select-none">
          {viewLevel === 3 && (
            <div className="absolute w-3.5 h-3.5 rounded-full bg-red-500/35 animate-ping pointer-events-none" />
          )}
          <div className={`relative rounded-full bg-gradient-to-br from-red-500 to-orange-500 border border-white/70 shadow-md ${dotSize}`} />
        </div>
      );
    }

    // ─── Solid 컴팩트 Teardrop 핀 ──────────────────────────────────────
    const PIN_SIZE = isBufferPlanningRecommended ? 36 : (isHighlighted ? 34 : 28);

    const glowShadow = isBufferPlanningRecommended
      ? '0 0 24px 8px rgba(249,115,22,0.7)' // 오렌지 네온 빔
      : (isHighlighted
        ? '0 0 18px 5px rgba(239,68,68,0.6)'
        : viewLevel === 3
          ? '0 3px 12px rgba(239,68,68,0.45)'
          : '0 3px 10px rgba(0,0,0,0.22)');

    const ringColor = isBufferPlanningRecommended
      ? 'rgba(251,146,60,1)' // 강렬한 오렌지 테두리
      : (viewLevel === 3
        ? 'rgba(252,165,165,0.9)'
        : viewLevel === 2
          ? 'rgba(253,186,116,0.85)'
          : 'rgba(255,255,255,0.75)');

    return (
      <div
        className="relative flex flex-col items-center select-none transition-all duration-200"
        style={{ paddingBottom: PIN_SIZE * 0.38 }}
      >
        {/* 추천 맛집 뱃지 */}
        {isBufferPlanningRecommended && (
          <div className="absolute z-30 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[7px] font-black tracking-tight px-1.5 py-[2px] rounded-full border border-white shadow-[0_0_12px_#f97316] whitespace-nowrap"
            style={{ top: -14, right: -(PIN_SIZE * 0.5) }}>
            경로추천 ✨
          </div>
        )}

        {/* 조회수 정보 뱃지 — 우측 상단 고정 */}
        {!isBufferPlanningRecommended && viewLevel === 3 && (
          <div className="absolute z-30 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[8px] font-black tracking-tight px-1.5 py-[2px] rounded-full border border-white/80 shadow-[0_2px_8px_rgba(239,68,68,0.6)] animate-pulse whitespace-nowrap"
            style={{ top: -10, right: -(PIN_SIZE * 0.65) }}>
            100만+
          </div>
        )}
        {!isBufferPlanningRecommended && viewLevel === 2 && (
          <div className="absolute z-30 bg-zinc-900/90 backdrop-blur-sm text-white text-[8px] font-black tracking-tight px-1.5 py-[2px] rounded-full border border-white/20 shadow-[0_2px_6px_rgba(0,0,0,0.4)] whitespace-nowrap"
            style={{ top: -10, right: -(PIN_SIZE * 0.65) }}>
            10만+
          </div>
        )}

        {/* 3차 기획: 경로상 추천 맛집 이중 펄스 링 */}
        {isBufferPlanningRecommended && (
          <>
            <div
              className="absolute animate-ping pointer-events-none z-0 rounded-full bg-orange-500/30"
              style={{ width: PIN_SIZE * 1.5, height: PIN_SIZE * 1.5, top: -(PIN_SIZE * 0.25), left: -(PIN_SIZE * 0.25) }}
            />
            <div
              className="absolute animate-pulse pointer-events-none z-0 rounded-full bg-red-500/15 border border-orange-500/30"
              style={{ width: PIN_SIZE * 1.25, height: PIN_SIZE * 1.25, top: -(PIN_SIZE * 0.125), left: -(PIN_SIZE * 0.125) }}
            />
          </>
        )}

        {/* 3단계 후방 펄스 링 */}
        {!isBufferPlanningRecommended && viewLevel === 3 && (
          <div
            className="absolute animate-ping pointer-events-none z-0 rounded-full bg-red-500/20"
            style={{ width: PIN_SIZE, height: PIN_SIZE, top: 0, left: 0 }}
          />
        )}

        {/* Teardrop 핀 본체 */}
        <div
          className="relative z-10 transition-all duration-200"
          style={{ width: PIN_SIZE, height: PIN_SIZE }}
        >
          <div
            className={`absolute inset-0 flex items-center justify-center ${isBufferPlanningRecommended ? 'bg-gradient-to-br from-orange-500 to-red-600' : 'bg-gradient-to-br from-red-500 to-orange-500'}`}
            style={{
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              boxShadow: `0 0 0 1.5px ${ringColor}, ${glowShadow}`,
            }}
          >
            {/* 마커 중앙 구멍 (Inner Hole) */}
            <div 
              className="bg-white rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)]" 
              style={{ width: PIN_SIZE * 0.35, height: PIN_SIZE * 0.35 }}
            />
          </div>
        </div>

        {/* 4단계: 줌 레벨 1~4 상세 텍스트 렌더링 */}
        {(zoomLevel <= 4 || isHighlighted) && (
          <div className="absolute top-full mt-2 flex flex-col items-center pointer-events-none z-20">
            <div className="bg-white/95 backdrop-blur-md px-2 py-0.5 rounded shadow-sm border border-gray-200/50 whitespace-nowrap">
              <span className="text-xs font-bold text-gray-800 tracking-tight">{restaurant.name}</span>
            </div>
          </div>
        )}
      </div>
    );
  };


  // 카테고리, 영상 포맷 필터 및 정렬 로직 (useMemo 적용)
  const filteredRestaurants = useMemo(() => {
    let result = restaurants.filter(r => {
      // 1. 음식 종류 필터
      let catMatch = false;
      if (activeCategory === '전체') {
        catMatch = true;
      } else {
        const cat = r.category || '';
        if (activeCategory === '아시안') {
          catMatch = cat.includes('아시안') || cat.includes('태국') || cat.includes('베트남') || cat.includes('동남아') || cat.includes('인도') || cat.includes('아시아') || cat.includes('퓨전') || cat.includes('세계') || cat.includes('멕시코') || cat.includes('타코');
        } else if (activeCategory === '카페/디저트') {
          catMatch = cat.includes('카페') || cat.includes('디저트') || cat.includes('베이커리') || cat.includes('커피');
        } else if (activeCategory === '술집') {
          catMatch = cat.includes('술집') || cat.includes('주점') || cat.includes('포차') || cat.includes('이자카야');
        } else {
          catMatch = cat.includes(activeCategory);
        }
      }
      if (!catMatch) return false;

      // 2. 영상 포맷 필터
      if (activeVideoType !== '영상 전체') {
        if (!r.videos || r.videos.length === 0) return false;
        
        if (activeVideoType === '쇼츠 리뷰') {
          // 식당의 여러 영상 중 쇼츠가 하나라도 있으면 포함
          const hasShorts = r.videos.some(vid => vid.is_short === true);
          if (!hasShorts) return false;
        } else if (activeVideoType === '롱폼 리뷰') {
          // 식당의 여러 영상 중 롱폼이 하나라도 있으면 포함
          const hasLongForm = r.videos.some(vid => vid.is_short !== true);
          if (!hasLongForm) return false;
        }
      }

      return true;
    });

    if (activeSort === 'latest') {
      result = result.sort((a, b) => {
        const vidA = getBestVideo(a.videos, activeVideoType);
        const vidB = getBestVideo(b.videos, activeVideoType);
        if (!vidA && !vidB) return 0;
        if (!vidA) return 1;
        if (!vidB) return -1;
        return new Date(vidB.published_at).getTime() - new Date(vidA.published_at).getTime();
      });
    } else if (activeSort === 'views') {
      result = result.sort((a, b) => {
        const vidA = getBestVideo(a.videos, activeVideoType);
        const vidB = getBestVideo(b.videos, activeVideoType);
        if (!vidA && !vidB) return 0;
        if (!vidA) return 1;
        if (!vidB) return -1;
        return (vidB.view_count || 0) - (vidA.view_count || 0);
      });
    }
    return result;
  }, [restaurants, activeCategory, activeSort, activeVideoType]);

  if (loading) return <div className="w-full h-screen bg-gray-50 flex items-center justify-center">Loading Maps...</div>;
  if (mapError) return <div className="w-full h-screen bg-gray-50 flex items-center justify-center text-red-500 font-bold">Failed to load Kakao Maps: {mapError.message}</div>;

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gray-100 dark:bg-zinc-950">
      {/* 글로벌 SVG 그라데이션 정의 */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="red-orange-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF0000" />
            <stop offset="100%" stopColor="#FF7A00" />
          </linearGradient>
        </defs>
      </svg>
      


      {/* 데스크탑 좌측 스마트 사이드바 (Practical, Info-First) */}
      <AnimatePresence>
        {!hideDefaultSidebar && !isSidebarCollapsed && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="hidden md:flex absolute top-6 left-6 bottom-6 w-[420px] z-20 flex-col bg-zinc-950/70 backdrop-blur-md text-white rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] border border-white/10"
          >
            {/* Sidebar Header & Filters */}
            <div 
              onClick={() => { setIsSortOpen(false); setIsCategoryOpen(false); setIsVideoTypeOpen(false); }}
              className={`w-full pt-7 pb-4 px-7 shrink-0 bg-white/[0.02] border-b border-white/5 backdrop-blur-md z-10 rounded-t-[28px] flex flex-col justify-between ${
                desktopView === 'list' && filteredRestaurants.some(r => r.videos && r.videos.length > 0) ? 'aspect-video' : 'gap-5'
              }`}
            >
              {desktopView === 'list' ? (
                <>
                  <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <img 
                        src="/favicon_perfect_gradient.png" 
                        className="w-6 h-6 object-contain rounded-md shadow-sm" 
                        alt="모두의맛집" 
                      />
                      <h2 className="text-[22px] font-extrabold text-white tracking-tight">
                        우리 동네 맛집
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 프로필 연동형 마이페이지 전환 버튼 */}
                      <button
                        onClick={() => setDesktopView('mypage')}
                        className="overflow-hidden bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl transition-all border border-white/10 hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm w-9.5 h-9.5 shrink-0"
                        title="마이페이지"
                      >
                        {user?.avatarUrl ? (
                          <img 
                            src={user.avatarUrl} 
                            alt={user.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={18} className="stroke-[2.5]" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Instagram Story Slider (Moved above filters) */}
                  {desktopView === 'list' && filteredRestaurants.some(r => r.videos && r.videos.length > 0) && (
                    <div className="pt-3 px-1 pb-2 shrink-0 select-none">
                      <div ref={storyScrollRef} {...getDragHandlers(storyDrag)} className="flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-1 select-none cursor-grab px-1 -mx-1">
                        {filteredRestaurants
                          .filter(r => r.videos && r.videos.length > 0)
                          .map(r => {
                            const bestVid = getBestVideo(r.videos, activeVideoType);
                            if (!bestVid) return null;
                            const isActive = selectedRestaurant?.id === r.id;
                            return (
                              <div
                                key={`story-${r.id}`}
                                onClick={() => {
                                  handleSelectRestaurant(r);
                                  map?.setLevel(4, { animate: true });
                                  map?.panTo(new kakao.maps.LatLng(r.lat, r.lng));
                                }}
                                className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0 group"
                              >
                                <div className={`p-[2px] flex items-center justify-center rounded-full bg-gradient-to-tr ${isActive ? 'from-red-600 to-brand-orange scale-105 shadow-[0_0_15px_rgba(239,68,68,0.45)]' : 'from-red-500/80 to-orange-500/80'} hover:scale-105 transition-all duration-300`}>
                                  <div className="p-0.5 flex items-center justify-center bg-zinc-950 rounded-full">
                                    <img
                                      src={bestVid.youtuber.profile_image}
                                      className="w-10 h-10 rounded-full object-cover shadow-inner"
                                      alt={bestVid.youtuber.name}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(bestVid.youtuber.name)}&background=random&color=fff&size=128`;
                                      }}
                                    />
                                  </div>
                                </div>
                                <span className={`text-[10px] max-w-[58px] truncate text-center ${isActive ? 'font-black text-brand-orange-light' : 'font-bold text-zinc-400 group-hover:text-zinc-200'}`}>
                                  {bestVid.youtuber.name}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Filter Pills (Moved below stories, redesigned as pills) */}
                  <div className="flex items-center flex-wrap gap-2 shrink-0 pb-3 border-b border-white/5 relative z-[50] px-1">
                    {/* 정렬 드롭다운 */}
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsSortOpen(!isSortOpen); setIsCategoryOpen(false); setIsVideoTypeOpen(false); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 rounded-full text-[12px] font-bold text-zinc-300 transition-all shadow-sm whitespace-nowrap"
                      >
                        {activeSort === 'latest' ? '최신순' : '조회수순'}
                        <ChevronDown size={13} className={`transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {isSortOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full left-0 mt-2 p-1.5 min-w-[120px] bg-zinc-900 border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100]"
                          >
                            {['latest', 'views'].map((sort) => (
                              <button
                                key={sort}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSort(sort as any);
                                  setIsSortOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-bold transition-all ${activeSort === sort ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                              >
                                {sort === 'latest' ? '최신순' : '조회수순'}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* 영상 포맷 드롭다운 */}
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsVideoTypeOpen(!isVideoTypeOpen); setIsSortOpen(false); setIsCategoryOpen(false); }}
                        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all shadow-sm whitespace-nowrap ${activeVideoType !== '영상 전체' ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30' : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 text-zinc-300'}`}
                      >
                        {activeVideoType}
                        <ChevronDown size={13} className={`transition-transform duration-200 ${isVideoTypeOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {isVideoTypeOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full left-0 mt-2 p-1.5 min-w-[120px] bg-zinc-900 border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] max-h-[200px] overflow-y-auto"
                          >
                            {['영상 전체', '쇼츠 리뷰', '롱폼 리뷰'].map((type) => (
                              <button
                                key={type}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveVideoType(type as any);
                                  setSelectedCluster(null);
                                  setIsVideoTypeOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-bold transition-all ${activeVideoType === type ? 'bg-gradient-to-r from-red-600/20 to-orange-500/20 text-brand-orange-light' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                              >
                                {type}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* 카테고리 드롭다운 */}
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsCategoryOpen(!isCategoryOpen); setIsSortOpen(false); setIsVideoTypeOpen(false); }}
                        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all shadow-sm whitespace-nowrap ${activeCategory !== '전체' ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30' : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 text-zinc-300'}`}
                      >
                        {activeCategory}
                        <ChevronDown size={13} className={`transition-transform duration-200 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {isCategoryOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full left-0 mt-2 p-1.5 min-w-[120px] bg-zinc-900 border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full"
                          >
                            {['전체', '한식', '일식', '중식', '양식', '아시안', '분식', '카페/디저트', '술집'].map((category) => (
                              <button
                                key={category}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveCategory(category);
                                  setSelectedCluster(null);
                                  setIsCategoryOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-bold transition-all ${activeCategory === category ? 'bg-gradient-to-r from-red-600/20 to-orange-500/20 text-brand-orange-light' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                              >
                                {category}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {selectedCluster && (
                    <button 
                      onClick={() => setSelectedCluster(null)}
                      className="w-full mt-4 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-white/10 shadow-sm backdrop-blur-md"
                    >
                      ← 클러스터 해제하고 지도 전체보기
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  {/* 뒤로 가기 단추 */}
                  <button
                    onClick={() => setDesktopView('list')}
                    className="p-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl transition-all border border-white/10 hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm"
                  >
                    <ArrowLeft size={18} className="stroke-[2.5]" />
                  </button>
                  <h2 className="text-[20px] font-extrabold text-white tracking-tight">
                    마이페이지
                  </h2>
                </div>
              )}
            </div>

            {/* Sidebar Contents */}
            <div className="flex-1 overflow-y-auto relative z-0 bg-transparent rounded-b-[28px]" style={{ scrollbarWidth: 'none' }}>
              <div className="p-4 space-y-3">
                {desktopView === 'list' ? (
                  (() => {
                    const feedList = selectedCluster || filteredRestaurants;

                    return (
                      <div className="space-y-4">
                        {feedList.map(r => {
                          const vid = getBestVideo(r.videos, activeVideoType);
                          const isFav = favorites.includes(r.id);
                          const isSelected = selectedRestaurant?.id === r.id;

                          return (
                            <div
                              key={r.id}
                              onClick={() => {
                                handleSelectRestaurant(r);
                                map?.panTo(new kakao.maps.LatLng(r.lat, r.lng));
                              }}
                              onMouseEnter={() => setHoveredRestaurantId(r.id)}
                              onMouseLeave={() => setHoveredRestaurantId(null)}
                              className={`group relative w-full rounded-2xl overflow-hidden cursor-pointer border transition-all duration-300 backdrop-blur-[20px] bg-zinc-900/50 hover:scale-[1.015] hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)] ${
                                isSelected 
                                  ? 'border-orange-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                                  : 'border-white/10 hover:border-orange-500/30'
                              }`}
                            >
                              {/* 호버 시 은은하게 반짝이는 그라데이션 광채 보더 효과 */}
                              <div 
                                className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
                                style={{
                                  padding: '1.2px',
                                  background: 'linear-gradient(to right, rgba(220, 38, 38, 0.4), rgba(249, 115, 22, 0.4))',
                                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                                  WebkitMaskComposite: 'xor',
                                  maskComposite: 'exclude',
                                }}
                              />

                              {/* 16:9 대형 썸네일 영역 */}
                              <div className="relative w-full aspect-video bg-zinc-950 overflow-hidden rounded-t-2xl">
                                {vid?.thumbnail ? (
                                  <img 
                                    src={vid.thumbnail}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    alt={r.name}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-gradient-to-br from-zinc-900 to-zinc-800">
                                    <Utensils size={36} />
                                  </div>
                                )}

                                {/* 썸네일 그라데이션 오버레이 (텍스트 가독성용) */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

                                {/* 우상단: 즐겨찾기 버튼 */}
                                <motion.button
                                  whileTap={{ scale: 0.8 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isFav) {
                                      setFavorites(favorites.filter(id => id !== r.id));
                                    } else {
                                      setFavorites([...favorites, r.id]);
                                    }
                                  }}
                                  className="absolute top-3 right-3 p-1.5 bg-black/50 backdrop-blur-xl rounded-full border border-white/15 hover:bg-white/10 transition-colors shadow-md z-10"
                                >
                                  <Star 
                                    size={13}
                                    stroke={isFav ? 'url(#red-orange-grad)' : 'currentColor'}
                                    fill={isFav ? 'url(#red-orange-grad)' : 'none'}
                                    strokeWidth={isFav ? 2.5 : 2}
                                    className={`transition-all duration-300 ${
                                      isFav
                                        ? 'drop-shadow-[0_0_4px_rgba(255,75,0,0.45)]'
                                        : 'text-zinc-400 hover:text-red-500'
                                    }`}
                                  />
                                </motion.button>

                                {/* 우하단: Shorts 배지 */}
                                {vid?.is_short && (
                                  <div className="absolute bottom-3 right-3 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-white/20 shadow-lg z-10 flex items-center gap-0.5">
                                    <Play size={8} fill="currentColor" /> SHORTS
                                  </div>
                                )}
                              </div>

                              {/* 하단 정보 영역 */}
                              <div className="p-4 flex flex-col space-y-2.5">
                                {/* 식당명 + 카테고리 */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <h4 className="font-extrabold text-[16px] text-zinc-100 truncate tracking-tight group-hover:text-white transition-colors">
                                      {r.name}
                                    </h4>
                                    {r.category && (
                                      <span className="text-[10px] font-semibold text-zinc-500 shrink-0">
                                        {r.category}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 영상 제목 */}
                                {vid?.title && (
                                  <p className="text-[12.5px] font-medium text-zinc-400 line-clamp-2 leading-relaxed tracking-tight">
                                    {vid.title}
                                  </p>
                                )}

                                {/* 유튜버 프로필 + 채널명 · 조회수 메타데이터 한 줄 */}
                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                                  {vid?.youtuber && (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {vid.youtuber.profile_image ? (
                                        <img 
                                          src={vid.youtuber.profile_image}
                                          className="w-4 h-4 rounded-full object-cover border border-white/10 shrink-0"
                                          alt={vid.youtuber.name}
                                        />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center text-[8px] font-bold text-zinc-300 border border-white/10 shrink-0">
                                          {vid.youtuber.name[0]}
                                        </div>
                                      )}
                                      <span className="font-bold text-zinc-400 truncate max-w-[120px]">
                                        {vid.youtuber.name}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {vid?.youtuber && (
                                    <span className="text-zinc-600 shrink-0">·</span>
                                  )}

                                  {vid?.view_count !== undefined && vid.view_count > 0 ? (
                                    <span className="font-medium text-zinc-400">
                                      조회수 {formatViewCount(vid.view_count)}회
                                    </span>
                                  ) : (
                                    <span className="font-medium text-zinc-400">
                                      조회수 0회
                                    </span>
                                  )}
                                </div>

                                {/* AI 방문 꿀팁 배지 (칩) - 최대 3개 노출 */}
                                {(() => {
                                  const tips = [];
                                  if (r.parking && r.parking !== '정보 없음') tips.push({ type: 'parking', icon: '🚗', label: '주차', text: r.parking });
                                  if (r.reservation && r.reservation !== '정보 없음') tips.push({ type: 'reservation', icon: '📅', label: '예약', text: r.reservation });
                                  if (r.packaging && r.packaging !== '정보 없음') tips.push({ type: 'packaging', icon: '🥡', label: '포장', text: r.packaging });
                                  if (r.business_hours && r.business_hours !== '정보 없음') tips.push({ type: 'business_hours', icon: '⏰', label: '영업', text: r.business_hours });

                                  if (tips.length === 0) return null;

                                  return (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                      {tips.slice(0, 3).map((tip, idx) => (
                                        <div 
                                          key={idx}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/5 text-[10px] font-bold text-zinc-300 hover:bg-white/[0.08] transition-colors"
                                          title={`${tip.label}: ${tip.text}`}
                                        >
                                          <span>{tip.icon}</span>
                                          <span className="max-w-[70px] truncate">{tip.text}</span>
                                        </div>
                                      ))}
                                      {tips.length > 3 && (
                                        <span className="text-[9px] font-bold text-zinc-500 pl-0.5">+{tips.length - 3}</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : (
                  <MyPageView 
                    onOpenSubmission={() => {
                      if (!user) {
                        setIsLoginModalOpen(true);
                      } else {
                        setIsSubmissionOpen(true);
                      }
                    }} 
                    onOpenItineraryPlanner={(itinerary) => {
                      if (itinerary) {
                        setEditingItinerary(itinerary);
                        setActivePlanningItinerary(itinerary);
                        setPlanningActiveDay(1);
                        setIsPlanningMode(true);
                      } else {
                        setNewItineraryTitle('');
                        setNewItineraryStartDate('');
                        setNewItineraryEndDate('');
                        setShowInitPlanningModal(true);
                      }
                    }}
                    user={user}
                    onLogout={() => {
                      setUser(null);
                      localStorage.removeItem('modoo-matjip-user');
                    }}
                    onTriggerLogin={() => setIsLoginModalOpen(true)}
                  />
                )}
              </div>
            </div>
            {/* 우측 경계선 밀착 결합형 세로 반원 접기 단추 */}
            <motion.button
              onClick={() => {
                if (selectedRestaurant) {
                  handleSelectRestaurant(null);
                } else {
                  setIsSidebarCollapsed(true);
                }
              }}
              animate={{ x: selectedRestaurant ? 428 : 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-full top-1/2 -translate-y-1/2 w-[22px] h-[64px] bg-zinc-950/85 backdrop-blur-2xl border-y border-r border-white/10 rounded-r-2xl flex items-center justify-center cursor-pointer text-orange-500 hover:text-orange-400 shadow-[6px_0_15px_-3px_rgba(0,0,0,0.4)] z-50 group"
              whileHover={{ width: '26px' }}
              whileTap={{ scale: 0.95 }}
              title={selectedRestaurant ? "상세 정보 닫기" : "사이드바 접기"}
            >
              <ChevronLeft size={16} className="stroke-[3.0] transition-transform group-hover:-translate-x-0.5" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 좌측 중앙 아크릴 오렌지 글로우 "열기" 버튼 */}
      <AnimatePresence>
        {isSidebarCollapsed && (
          <motion.button
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 250 }}
            onClick={() => setIsSidebarCollapsed(false)}
            className="absolute top-1/2 -translate-y-1/2 left-6 z-20 w-14 h-14 bg-zinc-950/80 backdrop-blur-md hover:bg-zinc-900/90 text-orange-500 hover:text-orange-400 rounded-full shadow-[0_0_24px_rgba(255,107,0,0.45)] border border-orange-500/30 transition-all hover:scale-110 active:scale-95 flex items-center justify-center group cursor-pointer"
            title="사이드바 열기"
          >
            <List size={22} className="stroke-[2.5] transition-transform group-hover:scale-110" />
          </motion.button>
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
          }}
          isPanto={true}
        >


        {/* 3차 기획: 실시간 일정 드로잉 경로 버퍼 다각형(Polygon) 렌더링 */}
        {isPlanningMode && activePlanningBufferPolygons.map((path, idx) => (
          <Polygon
            key={`buffer-poly-${idx}`}
            path={path}
            strokeWeight={1}
            strokeColor="#ff6b00"
            strokeOpacity={0.4}
            strokeStyle="solid"
            fillColor="#ef4444"
            fillOpacity={0.12}
          />
        ))}

        {/* 3차 기획: OSRM 실제 도로망 경로 및 드래그 조절점 렌더링 */}
        {isPlanningMode && activePlanningItinerary && (() => {
          const dayItems = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay)?.items || [];
          if (dayItems.length < 2) return null;

          // OSRM 경로 세그먼트들이 존재하면 실제 도로망으로 렌더링
          if (planningRouteCoordinates && planningRouteCoordinates.length > 0) {
            return (
              <>
                {planningRouteCoordinates.map((seg, sIdx) => {
                  const midPoint = seg.coordinates[Math.floor(seg.coordinates.length / 2)] || {
                    lat: (seg.ptA.lat + seg.ptB.lat) / 2,
                    lng: (seg.ptA.lng + seg.ptB.lng) / 2
                  };

                  return (
                    <div key={`route-segment-group-${seg.targetId}-${sIdx}`}>
                      {/* OSRM 세그먼트 경로선 */}
                      <Polyline
                        path={seg.coordinates}
                        strokeWeight={5}
                        strokeColor="#ef4444"
                        strokeOpacity={0.85}
                        strokeStyle="solid"
                      />

                      {/* 드래그형 Snap-to-Road 경로 조절점 */}
                      <MapMarker
                        position={midPoint}
                        draggable={true}
                        onDragEnd={(marker) => {
                          const newPos = marker.getPosition();
                          setCustomWaypoints((prev) => ({
                            ...prev,
                            [seg.targetId]: { lat: newPos.getLat(), lng: newPos.getLng() }
                          }));
                        }}
                        image={{
                          src: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
                          size: { width: 24, height: 35 },
                          options: { offset: { x: 12, y: 35 } }
                        }}
                        title={`${seg.ptB.name} 가는 경로 조절점 (드래그하여 원하는 골목길로 경로 수정)`}
                      />
                    </div>
                  );
                })}
              </>
            );
          }

          // OSRM이 로드되기 전이나 에러 시의 단순 직선 폴백
          const linePath = dayItems.map((item: any) => ({ lat: item.lat, lng: item.lng }));
          return (
            <Polyline
              path={linePath}
              strokeWeight={5}
              strokeColor="#ef4444"
              strokeOpacity={0.6}
              strokeStyle="solid"
            />
          );
        })()}

        {/* 3차 기획: 실시간 일정 드로잉 일차별 스팟 순서 마커 */}
        {isPlanningMode && activePlanningItinerary && (() => {
          const dayItems = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay)?.items || [];
          return dayItems.map((item: any, idx: number) => (
            <CustomOverlayMap
              key={`planning-overlay-${item.id}`}
              position={{ lat: item.lat, lng: item.lng }}
              clickable={true}
              yAnchor={0.5}
            >
              <div 
                onClick={() => {
                  map?.panTo(new kakao.maps.LatLng(item.lat, item.lng));
                }}
                className="relative cursor-pointer flex flex-col items-center group scale-100 hover:scale-110 transition-transform z-40"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-black text-[9px] flex items-center justify-center shadow-lg border border-white/20">
                  {idx + 1}
                </div>
                <div className="mt-1 px-2 py-0.5 bg-zinc-950/90 border border-white/10 rounded-md text-white font-bold text-[8px] shadow whitespace-nowrap">
                  {item.name}
                </div>
              </div>
            </CustomOverlayMap>
          ));
        })()}

        {/* 활성화된 일정의 경로선(Polyline) 및 일차별 순서 마커 */}
        {activeItinerary && (() => {
          const dayItems = activeItinerary.days.find((d: any) => d.day === activeItineraryDay)?.items || [];
          const linePath = dayItems.map((item: any) => ({ lat: item.lat, lng: item.lng }));
          if (linePath.length < 2) return null;
          return (
            <Polyline
              path={linePath}
              strokeWeight={5}
              strokeColor="#FF6F00"
              strokeOpacity={0.8}
              strokeStyle="solid"
            />
          );
        })()}

        {activeItinerary && (() => {
          const dayItems = activeItinerary.days.find((d: any) => d.day === activeItineraryDay)?.items || [];
          return dayItems.map((item: any, idx: number) => (
            <CustomOverlayMap
              key={item.id}
              position={{ lat: item.lat, lng: item.lng }}
              clickable={true}
              yAnchor={0.5}
            >
              <div 
                onClick={() => {
                  map?.panTo(new kakao.maps.LatLng(item.lat, item.lng));
                  if (item.restaurant_id) {
                    const rest = restaurants.find(r => r.id === item.restaurant_id);
                    if (rest) setSelectedRestaurant(rest);
                  }
                }}
                className="relative cursor-pointer flex flex-col items-center group scale-100 hover:scale-110 transition-transform"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-black text-xs flex items-center justify-center shadow-lg border border-white/20">
                  {idx + 1}
                </div>
                <div className="mt-1 px-2.5 py-1 bg-zinc-950/85 backdrop-blur-md border border-white/10 rounded-lg text-white font-bold text-[9px] shadow-md whitespace-nowrap">
                  {item.name}
                </div>
              </div>
            </CustomOverlayMap>
          ));
        })()}

        {/* 맛집 핀/마커 클러스터링 적용 */}
        <MarkerClusterer 
          averageCenter={true} 
          minLevel={8}
          disableClickZoom={true}
          onClusterclick={(_target, cluster) => {
            if (map) {
              const currentLevel = map.getLevel();
              map.setLevel(currentLevel - 2, { 
                anchor: cluster.getCenter(),
                animate: { duration: 500 } 
              });
            }
          }}
          calculator={[10, 50, 100]}
          styles={[
            { // < 10
              width: '40px', height: '40px',
              background: 'linear-gradient(135deg, rgba(255, 165, 0, 0.7), rgba(255, 99, 71, 0.7))',
              borderRadius: '20px',
              color: '#fff',
              textAlign: 'center',
              fontWeight: '900',
              lineHeight: '40px',
              boxShadow: '0 4px 10px rgba(255, 69, 0, 0.3)'
            },
            { // 10 ~ 49
              width: '50px', height: '50px',
              background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.8), rgba(255, 69, 0, 0.8))',
              borderRadius: '25px',
              color: '#fff',
              textAlign: 'center',
              fontWeight: '900',
              lineHeight: '50px',
              boxShadow: '0 6px 15px rgba(255, 69, 0, 0.4)'
            },
            { // 50 ~ 99
              width: '60px', height: '60px',
              background: 'linear-gradient(135deg, rgba(255, 100, 0, 0.9), rgba(220, 20, 60, 0.9))',
              borderRadius: '30px',
              color: '#fff',
              textAlign: 'center',
              fontWeight: '900',
              lineHeight: '60px',
              boxShadow: '0 8px 20px rgba(255, 0, 0, 0.5)'
            },
            { // >= 100
              width: '70px', height: '70px',
              background: 'linear-gradient(135deg, rgba(255, 69, 0, 1), rgba(178, 34, 34, 1))',
              borderRadius: '35px',
              color: '#fff',
              textAlign: 'center',
              fontWeight: '900',
              lineHeight: '70px',
              boxShadow: '0 10px 25px rgba(255, 0, 0, 0.6)'
            }
          ]}
        >
          {filteredRestaurants.map((restaurant) => (
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
              draggable={isPlanningMode}
              onDragStart={(e) => {
                if (isPlanningMode) {
                  e.dataTransfer.setData('text/plain', JSON.stringify(restaurant));
                }
              }}
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
              {mapHoveredRestaurantId === restaurant.id && (() => {
                const bestVid = getBestVideo(restaurant.videos);
                return (
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
                    {bestVid?.youtuber && (
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-transparent shrink-0 z-10">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {bestVid.youtuber.profile_image ? (
                            <div className="instagram-story-ring shrink-0">
                              <img 
                                src={bestVid.youtuber.profile_image} 
                                className="w-7 h-7 rounded-full object-cover border-2 border-zinc-900 shadow-sm"
                                alt={bestVid.youtuber.name} 
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border-2 border-zinc-900 shrink-0">
                              {bestVid.youtuber.name[0]}
                            </div>
                          )}
                          <span className="text-[13.5px] font-extrabold text-zinc-100 truncate tracking-tight ml-1">
                            {bestVid.youtuber.name}
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
                          <Star 
                            size={18} 
                            stroke={favorites.includes(restaurant.id) ? 'url(#red-orange-grad)' : 'currentColor'}
                            fill={favorites.includes(restaurant.id) ? 'url(#red-orange-grad)' : 'none'}
                            strokeWidth={favorites.includes(restaurant.id) ? 2.5 : 2}
                            className={`transition-all duration-300 ${
                              favorites.includes(restaurant.id)
                                ? 'drop-shadow-[0_0_6px_rgba(255,75,0,0.45)]'
                                : 'text-zinc-500 hover:text-red-500'
                            }`} 
                          />
                        </motion.button>
                      </div>
                    )}

                    {/* Thumbnail & Autoplay Video - 16:9 ratio */}
                    <div className="relative w-full aspect-video shrink-0 overflow-hidden bg-zinc-950 ring-1 ring-white/5">
                      {bestVid?.youtube_video_id ? (
                        <iframe 
                          src={`https://www.youtube.com/embed/${bestVid.youtube_video_id}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=${bestVid.youtube_video_id}`}
                          className="w-full h-[150%] -translate-y-[16.6%] border-0 pointer-events-none"
                          allow="autoplay"
                        />
                      ) : bestVid?.thumbnail ? (
                        <img 
                          src={bestVid.thumbnail} 
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                          alt={restaurant.name}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-gradient-to-br from-zinc-900 to-zinc-800">
                          <Utensils size={36} />
                        </div>
                      )}

                      {/* Shorts badge */}
                      {bestVid?.is_short && (
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
                          <div className="p-1 bg-white/5 rounded-lg shrink-0 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="url(#red-orange-grad)">
                              <path d="M7 2C4.8 2 3 3.8 3 6c0 1.8 1.2 3.3 2.8 3.8l.7 10.7c.1.8.8 1.5 1.5 1.5s1.4-.7 1.5-1.5l.7-10.7C11.8 9.3 13 7.8 13 6c0-2.2-1.8-4-4-4H7z" />
                              <rect x="15" y="2" width="2.2" height="20" rx="1.1" />
                              <rect x="18.8" y="2" width="2.2" height="20" rx="1.1" />
                            </svg>
                          </div>
                          <h4 className="font-extrabold text-[15px] text-zinc-100 truncate tracking-tight">{restaurant.name}</h4>
                        </div>
                        {bestVid?.view_count !== undefined ? (
                          <span className="text-[11px] font-extrabold bg-red-950/20 px-2 py-0.5 rounded-md shrink-0 border border-red-500/10">
                            <span className="bg-gradient-to-r from-red-400 to-brand-orange bg-clip-text text-transparent">
                              조회수 {formatViewCount(bestVid.view_count)}회
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md shrink-0">
                            조회수 0회
                          </span>
                        )}
                      </div>

                      {/* Video Title */}
                      {bestVid?.title && (
                        <p className="text-sm font-semibold text-zinc-300 line-clamp-2 leading-relaxed mt-1">
                          {bestVid.title}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
              
            </div>
          </CustomOverlayMap>
        ))}
        </MarkerClusterer>
      </Map>
      </div>

      {/* 우측 하단 프리미엄 액션 버튼 (FAB) 그룹 (항시 노출 세로 정렬 구조) */}
      <div className={`absolute right-4 z-20 flex flex-col items-end gap-2.5 transition-all duration-300 ${!selectedRestaurant ? 'bottom-[140px]' : 'bottom-10'}`}>
        
        {/* 맛집 제보 */}
        <div className="flex items-center gap-2 group">
          <span className="text-[10px] font-black text-white bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-white/5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">맛집 제보</span>
          <button
            onClick={() => {
              if (!user) {
                setIsLoginModalOpen(true);
              } else {
                setIsSubmissionOpen(true);
              }
            }}
            className="p-3 bg-zinc-900 text-orange-500 hover:text-orange-400 rounded-full border border-white/10 hover:border-orange-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
            title="맛집 제보하기"
          >
            <MapPinPlus size={18} />
          </button>
        </div>

        {/* 일정 만들기 */}
        <div className="flex items-center gap-2 group">
          <span className="text-[10px] font-black text-white bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-white/5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">일정 만들기</span>
          <button
            onClick={() => {
              setNewItineraryTitle('');
              setNewItineraryStartDate('');
              setNewItineraryEndDate('');
              setShowInitPlanningModal(true);
            }}
            className="p-3 bg-zinc-900 text-orange-500 hover:text-orange-400 rounded-full border border-white/10 hover:border-orange-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
            title="일정 만들기"
          >
            <CalendarRange size={18} />
          </button>
        </div>

        {/* 오늘 뭐먹지 (랜덤 뽑기) */}
        <div className="flex items-center gap-2 group">
          <span className="text-[10px] font-black text-white bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-white/5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">오늘 뭐 먹지?</span>
          <button
            onClick={pickRandomRestaurant}
            className="p-3 bg-zinc-900 text-orange-500 hover:text-orange-400 rounded-full border border-white/10 hover:border-orange-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
            title="오늘 뭐 먹지?"
          >
            <Dices size={18} />
          </button>
        </div>

        {/* 현 위치 */}
        <div className="flex items-center gap-2 group">
          <span className="text-[10px] font-black text-white bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-white/5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">현 위치</span>
          <button
            onClick={moveToCurrentLocation}
            className="p-3 bg-zinc-900 text-orange-500 hover:text-orange-400 rounded-full border border-white/10 hover:border-orange-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
            title="현 위치로 이동"
          >
            <Navigation size={18} fill="currentColor" />
          </button>
        </div>
      </div>

      {/* 퀵-슬라이더 덱 (클러스터 클릭 시 데스크탑/모바일 공통 플로팅 팝업) */}
      <AnimatePresence>
        {!selectedRestaurant && selectedCluster && selectedCluster.length > 0 && (
          <motion.div 
            initial={{ y: 150, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 150, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-8 md:translate-x-0 w-full max-w-sm z-30 px-4 flex flex-col items-center select-none"
          >
            <div className="w-full bg-[#18181b]/80 backdrop-blur-xl border border-white/10 rounded-[28px] p-4 shadow-[0_24px_50px_rgba(0,0,0,0.5)]">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[12px] font-black text-white/90 tracking-tight flex items-center gap-1.5">
                  📍 이 지역의 맛집 핫플 <span className="text-brand-orange-light">{selectedCluster.length}곳</span>
                </span>
                <button 
                  onClick={() => setSelectedCluster(null)}
                  className="p-1 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 transition-colors cursor-pointer"
                  title="닫기"
                >
                  <X size={12} className="stroke-[2.5]" />
                </button>
              </div>

              {/* Swiper 가로 슬라이더 */}
              <Swiper
                grabCursor={true}
                slidesPerView={'auto'}
                spaceBetween={12}
                className="w-full py-0.5"
              >
                {selectedCluster.map(r => {
                  const bestVid = getBestVideo(r.videos);
                  return (
                    <SwiperSlide key={r.id} style={{ width: '260px' }} className="shrink-0">
                      <div 
                        onClick={() => {
                          handleSelectRestaurant(r);
                          map?.setLevel(4, { animate: true });
                          map?.panTo(new kakao.maps.LatLng(r.lat, r.lng));
                        }}
                        className="w-full bg-zinc-950/75 hover:bg-zinc-950/90 backdrop-blur-md rounded-2xl p-3 flex gap-3 cursor-pointer border border-white/5 hover:border-white/10 active:scale-[0.97] transition-all"
                      >
                        <img 
                          src={bestVid?.thumbnail || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80'} 
                          className="w-16 h-16 rounded-xl object-cover shadow-inner bg-zinc-900 flex-shrink-0" 
                          alt={r.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80';
                          }}
                        />
                        <div className="flex flex-col justify-center flex-1 min-w-0">
                          <h4 className="font-extrabold text-[13.5px] text-white truncate tracking-tight">{r.name}</h4>
                          <span className="text-[11px] font-semibold text-zinc-400 truncate mt-0.5">{r.category}</span>
                          {bestVid?.view_count !== undefined && (
                            <span className="text-[9.5px] font-bold mt-1">
                              <span className="bg-gradient-to-r from-red-400 to-brand-orange bg-clip-text text-transparent">
                                조회수 {formatViewCount(bestVid.view_count)}회
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 식당 상세 정보 카드 Overlay */}
      <RestaurantInfoCard 
        restaurant={selectedRestaurant} 
        onClose={() => handleSelectRestaurant(null)} 
        isSidebarCollapsed={isSidebarCollapsed || hideDefaultSidebar}
        onRequestVideoSubmit={(restaurant) => {
          setSubmissionTarget({ id: restaurant.id, name: restaurant.name });
          setIsSubmissionOpen(true);
        }}
        favorites={favorites}
        toggleFavorite={(id) => {
          const isFav = favorites.includes(id);
          if (isFav) setFavorites(favorites.filter(favId => favId !== id));
          else setFavorites([...favorites, id]);
        }}
        isPlanningMode={isPlanningMode}
        isRecommendedRouteItem={selectedRestaurant ? isRestaurantInPlanningBuffer(selectedRestaurant) : false}
        onAddToPlanning={(rest) => {
          addPlaceToPlanning({
            name: rest.name,
            category: rest.category || '음식점',
            address: rest.address,
            lat: rest.lat,
            lng: rest.lng,
            is_custom_spot: false,
            restaurant_id: rest.id
          });
          handleSelectRestaurant(null);
        }}
        onInsertToPlanningRoute={(rest) => {
          insertRestaurantToPlanningRoute(rest);
          handleSelectRestaurant(null);
        }}
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
          <MyPageView 
            onOpenSubmission={() => {
              if (!user) {
                setIsLoginModalOpen(true);
              } else {
                setIsSubmissionOpen(true);
              }
            }} 
            onOpenItineraryPlanner={(itinerary) => {
              if (itinerary) {
                setEditingItinerary(itinerary);
                setActivePlanningItinerary(itinerary);
                setPlanningActiveDay(1);
                setIsPlanningMode(true);
              } else {
                setNewItineraryTitle('');
                setNewItineraryStartDate('');
                setNewItineraryEndDate('');
                setShowInitPlanningModal(true);
              }
            }}
            user={user}
            onLogout={() => {
              setUser(null);
              localStorage.removeItem('modoo-matjip-user');
            }}
            onTriggerLogin={() => setIsLoginModalOpen(true)}
          />
        )}
      </OverlayContainer>

      {/* 지도 위 일정 컨트롤 플로팅 바 */}
      <AnimatePresence>
        {activeItinerary && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-zinc-950/80 backdrop-blur-xl border border-white/10 px-4 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-2xl z-30 min-w-[320px] max-w-[90%]"
          >
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">일정 진행 중</span>
              <h5 className="text-xs font-black text-white truncate mt-0.5">{activeItinerary.title}</h5>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                disabled={activeItineraryDay === 1}
                onClick={() => setActiveItineraryDay(prev => Math.max(prev - 1, 1))}
                className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-black text-orange-400 min-w-[40px] text-center">
                Day {activeItineraryDay}
              </span>
              <button
                disabled={activeItineraryDay === activeItinerary.days.length}
                onClick={() => setActiveItineraryDay(prev => Math.min(prev + 1, activeItinerary.days.length))}
                className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
              
              <div className="w-px h-6 bg-white/10 mx-1" />
              
              <button
                onClick={() => setActiveItinerary(null)}
                className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                title="일정 지도 표시 종료"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 모바일 하단 내비게이션 스마트 탭바 */}
      <BottomTabBar activeTab={activeTab} onChangeTab={setActiveTab} />


      {/* 나만의 핫플 제보하기 바텀시트 */}
      <RestaurantSubmissionBottomSheet 
        isOpen={isSubmissionOpen} 
        onClose={() => {
          setIsSubmissionOpen(false);
          setSubmissionTarget(null);
        }} 
        initialRestaurant={submissionTarget}
      />

      {/* SNS 로그인 유도 모달 */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(mockUser) => {
          setUser(mockUser);
          localStorage.setItem('modoo-matjip-user', JSON.stringify(mockUser));
        }}
      />

      {/* 미식 일정 계획하기 바텀시트 */}
      <ItineraryPlannerBottomSheet
        isOpen={isItineraryPlannerOpen}
        onClose={() => {
          setIsItineraryPlannerOpen(false);
          setEditingItinerary(null);
        }}
        user={user}
        onSave={(itinerary) => {
          saveLocalItinerary(itinerary);
          window.dispatchEvent(new Event('itinerariesUpdated'));
          setActiveItinerary(itinerary);
          setActiveItineraryDay(1);
        }}
        editingItinerary={editingItinerary}
      />

      {/* 3차 기획: 지도 드로잉용 플로팅 패널 */}
      <AnimatePresence>
        {isPlanningMode && activePlanningItinerary && (
          <FloatingItineraryPanel
            itinerary={activePlanningItinerary}
            activeDay={planningActiveDay}
            onActiveDayChange={setPlanningActiveDay}
            onRemoveItem={(itemId) => {
              setActivePlanningItinerary((prev: any) => {
                const updatedDays = prev.days.map((d: any) => {
                  if (d.day === planningActiveDay) {
                    return {
                      ...d,
                      items: d.items.filter((item: any) => item.id !== itemId)
                    };
                  }
                  return d;
                });
                return { ...prev, days: updatedDays };
              });
              if (selectedPlanningItemId === itemId) {
                setSelectedPlanningItemId(null);
                setRecommendedRestaurantsForSelectedSpot([]);
              }
            }}
            onMoveUp={(index) => {
              if (index === 0) return;
              setActivePlanningItinerary((prev: any) => {
                const updatedDays = prev.days.map((d: any) => {
                  if (d.day === planningActiveDay) {
                    const newItems = [...d.items];
                    const temp = newItems[index];
                    newItems[index] = newItems[index - 1];
                    newItems[index - 1] = temp;
                    return { ...d, items: newItems };
                  }
                  return d;
                });
                return { ...prev, days: updatedDays };
              });
            }}
            onMoveDown={(index) => {
              setActivePlanningItinerary((prev: any) => {
                const updatedDays = prev.days.map((d: any) => {
                  if (d.day === planningActiveDay) {
                    if (index === d.items.length - 1) return d;
                    const newItems = [...d.items];
                    const temp = newItems[index];
                    newItems[index] = newItems[index + 1];
                    newItems[index + 1] = temp;
                    return { ...d, items: newItems };
                  }
                  return d;
                });
                return { ...prev, days: updatedDays };
              });
            }}
            onEditItemMemo={(item) => {
              setEditingItemForMemo(item);
              setInputVisitTime(item.visit_time || '');
              setInputMemo(item.memo || '');
              setShowMemoModal(true);
            }}
            onSave={() => {
              if (activePlanningItinerary.days.every((d: any) => d.items.length === 0)) {
                alert('최소 한 개 이상의 장소를 일정에 추가해 주세요.');
                return;
              }
              saveLocalItinerary(activePlanningItinerary);
              window.dispatchEvent(new Event('itinerariesUpdated'));
              setActiveItinerary(activePlanningItinerary);
              setActiveItineraryDay(1);
              setIsPlanningMode(false);
              setActivePlanningItinerary(null);
              alert('일정이 성공적으로 저장되었습니다!');
            }}
            onClose={() => {
              if (confirm('편집 중인 일정을 취소하고 종료하시겠습니까? 저장되지 않은 변경사항은 삭제됩니다.')) {
                setIsPlanningMode(false);
                setActivePlanningItinerary(null);
                setSelectedPlanningItemId(null);
                setRecommendedRestaurantsForSelectedSpot([]);
              }
            }}
            selectedItemId={selectedPlanningItemId}
            onSelectItem={handleSelectPlanningItem}
            recommendedRestaurants={(() => {
              const currentPlanningItem = (() => {
                if (!activePlanningItinerary) return [];
                const dayData = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay);
                const dayItems = dayData?.items || [];
                if (selectedPlanningItemId) {
                  return dayItems.find((it: any) => it.id === selectedPlanningItemId) || dayItems[0];
                }
                return dayItems[0];
              })();

              return nearRouteRestaurants.map(restaurant => {
                const distance = currentPlanningItem 
                  ? getDistance(currentPlanningItem.lat, currentPlanningItem.lng, restaurant.lat, restaurant.lng) 
                  : 0;
                return {
                  restaurant,
                  distance,
                  type: 'near' as const
                };
              }).sort((a, b) => a.distance - b.distance);
            })()}
            onAddRecommendedRestaurant={(res) => {
              insertRestaurantToPlanningRoute(res);
              alert(`${res.name} 맛집을 최적 경로 중간에 경유지로 추가했습니다 ✨`);
              setTimeout(() => {
                if (selectedPlanningItemId) {
                  setActivePlanningItinerary((currentItinerary: any) => {
                    if (!currentItinerary) return currentItinerary;
                    const dayData = currentItinerary.days.find((d: any) => d.day === planningActiveDay);
                    const curItem = dayData?.items.find((it: any) => it.id === selectedPlanningItemId);
                    if (curItem) {
                      handleSelectPlanningItem(curItem);
                    }
                    return currentItinerary;
                  });
                }
              }, 100);
            }}
            onRestaurantDrop={(res) => {
              addPlaceToPlanning({
                name: res.name,
                category: res.category || '음식점',
                address: res.address,
                lat: res.lat,
                lng: res.lng,
                is_custom_spot: false,
                restaurant_id: res.id
              });
              alert(`${res.name} 맛집이 패널에 추가되었습니다 📌`);
            }}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            onSearchPlaces={handleSearchPlaces}
            onAddPlaceFromSearch={(place) => {
              addPlaceToPlanning({
                name: place.place_name,
                category: place.category_name.split(' > ').pop() || '관광지',
                address: place.address_name || place.road_address_name,
                lat: parseFloat(place.y),
                lng: parseFloat(place.x),
                place_url: place.place_url,
                is_custom_spot: true
              });
              alert(`${place.place_name}을(를) 일정 코스에 추가하였습니다.`);
            }}
            favorites={favorites}
            restaurants={restaurants}
            onUpdateItinerary={(updated) => setActivePlanningItinerary(updated)}
            onResetCustomWaypoints={() => {
              setCustomWaypoints({});
              alert('경로 Rerouting이 초기화되어 최초 실제 도로망 경로로 복구되었습니다 🔄');
            }}
          />
        )}
      </AnimatePresence>

      {/* 3차 기획: 상세 메모 및 시간 편집 서브 모달 */}
      <CustomModal isOpen={showMemoModal} onClose={() => setShowMemoModal(false)}>
        <div className="p-5 text-white bg-zinc-950 border border-white/10 rounded-3xl flex flex-col gap-4">
          <div className="pb-3 border-b border-white/5 flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-zinc-200">시간/메모 추가 및 변경</h4>
              {editingItemForMemo && (
                <p className="text-[10px] text-orange-400 font-semibold mt-0.5">{editingItemForMemo.name}</p>
              )}
            </div>
            <button onClick={() => setShowMemoModal(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase">방문 예정 시간</label>
            <input
              type="text"
              placeholder="예: 19:30"
              value={inputVisitTime}
              onChange={e => setInputVisitTime(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase">상세 팁/메모</label>
            <textarea
              placeholder="예: 전방 50m 소소버스투어 핑크색 깃발찾기"
              value={inputMemo}
              onChange={e => setInputMemo(e.target.value)}
              rows={3}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 resize-none"
            />
          </div>

          <button
            onClick={() => {
              if (!editingItemForMemo) return;
              setActivePlanningItinerary((prev: any) => {
                const updatedDays = prev.days.map((d: any) => {
                  if (d.day === planningActiveDay) {
                    return {
                      ...d,
                      items: d.items.map((item: any) => {
                        if (item.id === editingItemForMemo.id) {
                          return {
                            ...item,
                            visit_time: inputVisitTime || undefined,
                            memo: inputMemo || undefined
                          };
                        }
                        return item;
                      })
                    };
                  }
                  return d;
                });
                return { ...prev, days: updatedDays };
              });
              setShowMemoModal(false);
              setEditingItemForMemo(null);
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-xs font-bold text-white shadow-lg"
          >
            적용하기
          </button>
        </div>
      </CustomModal>

      {/* 신규 일정 생성 정보 설정 모달 (캘린더 기간 및 제목 설정) */}
      <CustomModal 
        isOpen={showInitPlanningModal} 
        onClose={() => setShowInitPlanningModal(false)}
        title="여행일정 등록"
        subtitle="일정에 따른 맛집 정보를 알려드립니다."
      >
        <div className="flex flex-col gap-4 w-full text-white">
          {/* 일정 제목 명칭 입력 */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">여행 제목 (일정 명칭)</label>
            <input
              type="text"
              placeholder="예: 부산 2박3일 여행 투어"
              value={newItineraryTitle}
              onChange={e => setNewItineraryTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
            />
          </div>

          {/* 달력 레인지 선택 컴포넌트 (월 단위 슬라이더 전환 및 프리미엄 캡슐 효과) */}
          <div className="border-t border-b border-white/5 py-4">
            <div className="flex items-center justify-between px-2 mb-3">
              <button
                type="button"
                onClick={() => setCurrentCalendarMonth(prev => prev === 6 ? 5 : 6)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer hover:border-orange-500/30"
              >
                &larr;
              </button>
              <h5 className="text-[12px] font-black text-zinc-200 tracking-wider">
                {currentCalendarMonth === 5 ? '2026년 6월' : '2026년 7월'}
              </h5>
              <button
                type="button"
                onClick={() => setCurrentCalendarMonth(prev => prev === 5 ? 6 : 5)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer hover:border-orange-500/30"
              >
                &rarr;
              </button>
            </div>

            <div className="min-h-[190px]">
              <div className="grid grid-cols-7 gap-y-1 gap-x-0 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map(w => (
                  <span key={w} className="text-[9px] font-bold text-zinc-500 py-1">{w}</span>
                ))}
                {getDaysInMonth(2026, currentCalendarMonth).map((dateStr, idx) => {
                  if (!dateStr) return <div key={`empty-${currentCalendarMonth}-${idx}`} className="py-2" />;
                  const dateObj = new Date(dateStr);
                  const dayNum = dateObj.getDate();
                  const status = getDayStatus(dateStr);
                  const isSun = dateObj.getDay() === 0;
                  const isSat = dateObj.getDay() === 6;
                  const hasBothRangeSelected = newItineraryStartDate && newItineraryEndDate;

                  return (
                    <div key={dateStr} className="relative py-1 flex items-center justify-center">
                      {status === 'in-range' && (
                        <div className="absolute inset-y-1 left-0 right-0 bg-[#ff6f00]/10 border-y border-[#ff6f00]/20 backdrop-blur-[2px]" />
                      )}
                      {status === 'start' && hasBothRangeSelected && (
                        <div className="absolute inset-y-1 left-1/2 right-0 bg-[#ff6f00]/10 border-y border-[#ff6f00]/20 backdrop-blur-[2px]" />
                      )}
                      {status === 'end' && hasBothRangeSelected && (
                        <div className="absolute inset-y-1 left-0 right-1/2 bg-[#ff6f00]/10 border-y border-[#ff6f00]/20 backdrop-blur-[2px]" />
                      )}

                      <button
                        type="button"
                        onClick={() => handleCalendarDaySelect(dateStr)}
                        className={`w-7 h-7 text-[10px] font-black transition-all flex items-center justify-center cursor-pointer relative z-10 ${
                          status === 'start' || status === 'end'
                            ? 'bg-gradient-to-r from-red-600/70 to-orange-500/70 text-white rounded-full shadow-md shadow-orange-500/10 scale-105 border border-white/20'
                            : status === 'in-range'
                              ? 'text-orange-400 font-black'
                              : isSun
                                ? 'text-red-400 hover:bg-white/5 rounded-full'
                                : isSat
                                  ? 'text-sky-400 hover:bg-white/5 rounded-full'
                                  : 'text-zinc-300 hover:bg-white/5 rounded-full'
                        }`}
                      >
                        {dayNum}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 추가 유용한 정보 입력 세션 */}
          <div className="space-y-3 pt-1">
            {/* 1. 동행인 */}
            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">누구와 가나요?</span>
              <div className="flex gap-1.5 flex-wrap">
                {['혼자', '연인과', '친구와', '가족과'].map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setNewItineraryCompanion(item)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all cursor-pointer ${
                      newItineraryCompanion === item
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                        : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 테마 */}
            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">여행 테마/스타일</span>
              <div className="flex gap-1.5 flex-wrap">
                {['맛집 탐방', '여유로운 힐링', '바쁜 명소 관광'].map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setNewItineraryTheme(item)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all cursor-pointer ${
                      newItineraryTheme === item
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                        : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 이동 수단 */}
            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">이동 수단</span>
              <div className="flex gap-1.5 flex-wrap">
                {['자차/렌터카', '대중교통/도보', '복합(자차+도보)'].map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setNewItineraryTransport(item)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all cursor-pointer ${
                      newItineraryTransport === item
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                        : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 하단 최종 등록 단추 */}
          <button
            onClick={handleStartNewPlanning}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-[0.98] text-[11px] font-black text-white shadow-lg shadow-red-500/20 transition-all flex items-center justify-center cursor-pointer border border-white/10"
          >
            일정 등록
          </button>
        </div>
      </CustomModal>
    </div>
  );
}


