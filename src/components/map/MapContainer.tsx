'use client';

const INITIAL_CENTER = { lat: 37.5665, lng: 126.9780 };
const INITIAL_LEVEL = 5;

import { useEffect, useState, useRef, useMemo } from 'react';
import { Map, CustomOverlayMap, MapMarker, MarkerClusterer, Polygon, Polyline, Circle, useKakaoLoader } from 'react-kakao-maps-sdk';

import { supabase } from '@/lib/supabase/client';
import { Restaurant, ItineraryItem, Itinerary } from '@/types';
import { MapBounds } from '@/hooks/useMapBounds';
import RestaurantInfoCard from '@/components/ui/RestaurantInfoCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Locate, Dices, Flame, Play, MapPin, Utensils, Heart, Star, Home, User, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, List, X, Calendar, Search, Plus, MapPinPlus, CalendarRange, Eye, Pentagon, PenTool, ShoppingBag, Bell, CornerUpRight, ArrowUpDown, PlayCircle } from 'lucide-react';
import { MichelinIcon } from '@/components/icons/CustomIcons';
import { Swiper, SwiperSlide } from 'swiper/react';
import NearHotplacesView from '@/components/ui/NearHotplacesView';
import FavoritesView from '@/components/ui/FavoritesView';
import MyPageView from '@/components/ui/MyPageView';
import ItineraryTabView from '@/components/ui/ItineraryTabView';
import BottomTabBar, { TabType } from '@/components/ui/BottomTabBar';
import ShoppingTabView from '@/components/ui/ShoppingTabView';
import OverlayContainer from '@/components/ui/OverlayContainer';
import RestaurantSubmissionBottomSheet from '@/components/ui/RestaurantSubmissionBottomSheet';
import LoginModal from '@/components/ui/LoginModal';
import ItineraryPlannerBottomSheet from '@/components/ui/ItineraryPlannerBottomSheet';
import FloatingItineraryPanel from '@/components/ui/FloatingItineraryPanel';
import CustomModal from '@/components/ui/CustomModal';
import FoodCurationDashboard from '@/components/ui/FoodCurationDashboard';
import { saveLocalItinerary } from '@/lib/supabase/itineraries';
import { getRouteBufferPolygon, isPointInPolygon, getDistance } from '@/lib/geoUtils';

const NearbyIcon = ({ size = 20, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* 以�� ??*/}
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    {/* ?댁륫 ??*/}
    <path d="M9.5 14.5a3.5 3.5 0 0 1 0-5" />
    <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" />
    {/* 以媛 ??*/}
    <path d="M7.2 16.8a7 7 0 0 1 0-9.6" />
    <path d="M16.8 7.2a7 7 0 0 1 0 9.6" />
    {/* ?몄륫 ??*/}
    <path d="M4.9 19.1a10.5 10.5 0 0 1 0-14.2" />
    <path d="M19.1 4.9a10.5 10.5 0 0 1 0 14.2" />
  </svg>
);

const getFormattedCategory = (categoryStr?: string | null) => {
  if (!categoryStr) return '';
  const parts = categoryStr.split('>');
  if (parts.length >= 2) {
    const main = parts[0].trim();
    const sub = parts[parts.length - 1].trim();
    return `${main} ??${sub}`;
  }
  return categoryStr.trim();
};

const checkAvailability = (value: string | null | undefined): boolean => {
  if (!value || value === '정보 없음' || value.trim() === '') return false;
  const cleanVal = value.trim();
  const temp = cleanVal
    .replace(/불가능/g, '')
    .replace(/불가/g, '')
    .replace(/없음/g, '')
    .replace(/미지원/g, '')
    .replace(/미제공/g, '')
    .replace(/금지/g, '');
  const hasPositiveException = /가능|지원|제공|이용/.test(temp);
  const hasNegation = /불가|없음|불가능|금지|미지원|미제공/.test(cleanVal);
  if (hasNegation && !hasPositiveException) {
    return false;
  }
  return true;
};

const getRestaurantAllTags = (r: Restaurant): string[] => {
  const tags: string[] = [];
  const contentTags = r.content_tags?.filter(
    tag => tag.label !== '유튜브 핫플' && tag.label !== '유튜브핫플'
  ) || [];
  if (contentTags.length > 0) {
    contentTags.forEach(t => {
      if (t.source === 'michelin' || t.label.includes('미쉐린')) tags.push('미쉐린');
      if (t.source === 'blueribbon' || t.label.includes('블루리본')) tags.push('블루리본');
      if (t.source === 'ddoganjib' || t.label.includes('또간집')) tags.push('또간집');
    });
  } else {
    const seed = r.name.charCodeAt(0) || 0;
    if (seed % 3 === 0) {
      tags.push('미쉐린', '블루리본');
    } else if (seed % 3 === 1) {
      tags.push('블루리본', '또간집');
    } else {
      tags.push('미쉐린', '또간집');
    }
  }
  if (r.parking && r.parking !== '정보 없음' && checkAvailability(r.parking)) {
    tags.push('주차가능');
  }
  if (r.reservation && r.reservation !== '정보 없음' && checkAvailability(r.reservation)) {
    tags.push('예약가능');
  }
  if (r.packaging && r.packaging !== '정보 없음' && checkAvailability(r.packaging)) {
    tags.push('포장가능');
  }

  // 비디오 키워드를 추출하여 태그 목록에 포함
  if (r.videos && r.videos.length > 0) {
    r.videos.forEach(v => {
      if (v.keywords && v.keywords.length > 0) {
        v.keywords.forEach(kw => {
          if (!tags.includes(kw)) {
            tags.push(kw);
          }
        });
      }
    });
  }

  return tags;
};

const TRENDING_TAGS = [
  { id: 'all', label: '# 전체', value: null },
  { id: 'ddoganjib', label: '# 또간집 삐라', value: '또간집' },
  { id: 'michelin', label: '# 미쉐린 가이드', value: '미쉐린' },
  { id: 'blueribbon', label: '# 블루리본 서베이', value: '블루리본' },
  { id: 'waiting', label: '# 웨이팅 필수', value: '웨이팅 필수' },
  { id: 'goodprice', label: '# 갓성비', value: '갓성비' },
  { id: 'hangover', label: '# 해장 끝판왕', value: '해장 끝판왕' },
];

const formatViewCount = (count: number) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
  return count.toString();
};

const getBestVideo = (videos: any[] | undefined, preferredType?: string) => {
  if (!videos || videos.length === 0) return null;
  
  let targetVideos = videos;
  if (preferredType === '쇼츠 리뷰') {
    const shorts = videos.filter(v => v.is_short);
    if (shorts.length > 0) targetVideos = shorts;
  } else if (preferredType === '롱폼�� 由щ럭') {
    const longs = videos.filter(v => !v.is_short);
    if (longs.length > 0) targetVideos = longs;
  }

  return targetVideos.reduce((best, curr) => (best.view_count || 0) > (curr.view_count || 0) ? best : curr, targetVideos[0]);
};

  // OSRM API를 사용하여 두 지점 사이의 실제 도로망 경로 좌표 목록 조회
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
  // 에러 또는 비정상 응답 시 단순 직선경로 피드백
  return [ptA, ptB];
}

  // OSRM API를 사용하여 경유지를 포함한 실제 도로망 경로 좌표 목록 조회
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

  // 카카오 Places 서비스를 이용해 특정 일정 중심좌표 기준 가장 가까운 지하철역(SW8) 정보 조회
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
        radius: 2000, // 2km 반경 검색
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
  const [activeVideoType, setActiveVideoType] = useState<'전체 리뷰' | '쇼츠 리뷰' | '롱폼 리뷰'>('전체 리뷰');
  const [activeDropdown, setActiveDropdown] = useState<'category' | 'sort' | 'videoType' | null>(null);
  const [playingYoutubeId, setPlayingYoutubeId] = useState<string | null>(null);
  const [currentRegion, setCurrentRegion] = useState<string>('마포구');
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
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(INITIAL_CENTER);

  // Geolocation states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [shouldPanToUser, setShouldPanToUser] = useState<boolean>(false);

  // 5李?湲고: 移댁뭅??Geocoder 湲곕� ?ㅼ媛?吏??� ?� 寃異?
  useEffect(() => {
    if (!map || !window.kakao) return;
    try {
      const geocoder = new kakao.maps.services.Geocoder();
      const coord = new kakao.maps.LatLng(mapCenter.lat, mapCenter.lng);
      
      geocoder.coord2RegionCode(coord.getLng(), coord.getLat(), (result: any, status: any) => {
        if (status === kakao.maps.services.Status.OK) {
    const regionName = result[0]?.region_2depth_name || '마포구';
          if (regionName && regionName !== currentRegion) {
            console.log(`[Geocoder] Detected region change: ${regionName}`);
            setCurrentRegion(regionName);
          }
        }
      });
    } catch (err) {
      console.warn("[Geocoder] Failed to reverse-geocode map center:", err);
    }
  }, [mapCenter, map]);
  const watchIdRef = useRef<number | null>(null);

  // ?ㅻ�?????��??諛??蹂�?湲� ?� 異�?
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [desktopView, setDesktopView] = useState<'list' | 'mypage'>('list');
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
  const [submissionTarget, setSubmissionTarget] = useState<{id: string, name: string} | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<{ name: string; email: string; provider: 'kakao' | 'google' | 'naver'; avatarUrl?: string } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleDirectLogin = (provider: 'kakao' | 'google' | 'naver') => {
    const mockUsers = {
    kakao: { name: '맛집탐험가 카카오', email: 'kakao_user@kakao.com', provider: 'kakao' as const, avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' },
    google: { name: '구글 마스터 맛집', email: 'google_user@gmail.com', provider: 'google' as const, avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150' },
    naver: { name: '네이버 미식 전문가', email: 'naver_user@naver.com', provider: 'naver' as const, avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
    };
    const mockUser = mockUsers[provider];
    setUser(mockUser);
    localStorage.setItem('modoo-matjip-user', JSON.stringify(mockUser));
  };
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isSearchExpanded = isSearchFocused || globalSearchQuery.trim() !== '';
  const [isItineraryPlannerOpen, setIsItineraryPlannerOpen] = useState(false);
  const [editingItinerary, setEditingItinerary] = useState<any>(null);
  const [activeItinerary, setActiveItinerary] = useState<any>(null);
  const [activeItineraryDay, setActiveItineraryDay] = useState<number>(1);
  // 3李?湲고: 吏???濡??쇼츠� 留�ㅺ�??�
  const [isPlanningMode, setIsPlanningMode] = useState<boolean>(false);
  const [activePlanningItinerary, setActivePlanningItinerary] = useState<any>(null);
  const [isPlanningSearchActive, setIsPlanningSearchActive] = useState<boolean>(false);
  const [planningActiveDay, setPlanningActiveDay] = useState<number>(1);
  const [editingItemForMemo, setEditingItemForMemo] = useState<any>(null); // ?濡???⑤??硫紐� ?�??
  const [showMemoModal, setShowMemoModal] = useState<boolean>(false);
  const [inputVisitTime, setInputVisitTime] = useState<string>('');
  const [inputMemo, setInputMemo] = useState<string>('');
  // 3李?蹂댁: ?μ 寃??紐⑤� 諛??ㅽ 湲곕� 1km 異泥 ?�
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedPlanningItemId, setSelectedPlanningItemId] = useState<string | null>(null);
  const [recommendedRestaurantsForSelectedSpot, setRecommendedRestaurantsForSelectedSpot] = useState<{ restaurant: Restaurant; distance: number; type: 'near' | 'on_the_way' }[]>([]);
  // OSRM ?ㅼ� ?濡留?湲곕� 援ш�蹂?寃쎈� 醫� ?� (媛?援ш�??醫� 諛곗�??諛곗�)
  const [planningRouteCoordinates, setPlanningRouteCoordinates] = useState<any[]>([]);
  const [customWaypoints, setCustomWaypoints] = useState<Record<string, { lat: number; lng: number }>>({});
  const [activeRouteCoordinates, setActiveRouteCoordinates] = useState<{ lat: number; lng: number }[][]>([]);
  const [nearRouteRestaurants, setNearRouteRestaurants] = useState<Restaurant[]>([]);

  // ?�洹 쇼츠� ?由� ?�吏/?紐� ?ㅼ� ???�
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
  const [isCollapseTabHovered, setIsCollapseTabHovered] = useState<boolean>(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // 諛�???硫� ?ш린 媛�? 諛??� ?鍮 怨��
  const [windowWidth, setWindowWidth] = useState<number>(1200);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const subSidebarWidth = useMemo(() => {
    if (activeTab === 'planning' && activePlanningItinerary) {
      return isPlanningSearchActive ? 760 : 380;
    }
    return 380;
  }, [activeTab, activePlanningItinerary, isPlanningSearchActive]);

  const subSidebarRightEdge = useMemo(() => {
    if (windowWidth < 768) return 0;
    if (isSidebarCollapsed) return 62;
    return 62 + subSidebarWidth;
  }, [windowWidth, isSidebarCollapsed, subSidebarWidth]);

  const sidebarWidth = useMemo(() => {
    return subSidebarRightEdge + (selectedRestaurant ? 380 : 0);
  }, [subSidebarRightEdge, selectedRestaurant]);

  useEffect(() => {
    if (!map) return;
    const timer = setTimeout(() => {
      map.relayout();
      map.setCenter(new kakao.maps.LatLng(mapCenter.lat, mapCenter.lng));
    }, 300);
    return () => clearTimeout(timer);
  }, [sidebarWidth, map]);

  const sidebarXOffset = sidebarWidth + 8;

  // 二쇰?留吏 ???�� ???濡??紐⑤ ?ㅽ 諛??釉 ?ъ�?諛 닫기, ? ???�� ???濡???대━??
  useEffect(() => {
    // 탭 전환 시 드롭다운 필터 닫기
    setActiveDropdown(null);

    if (activeTab === 'near') {
      if (filterPolygon) {
        setIsSidebarCollapsed(false); // 이미 그린 영역이 있으므로 결과 표시
      } else {
        startAreaDrawing();
        setIsSidebarCollapsed(true); // 그리기 시작 시 사이드바 접기
      }
    } else if (activeTab === 'home') {
      setIsSidebarCollapsed(false);
      if (isAreaDrawingMode || filterPolygon) {
        clearAreaFilter();
      }
    } else if (activeTab === 'shopping' || activeTab === 'mypage') {
      setIsSidebarCollapsed(false);
      if (isAreaDrawingMode || filterPolygon) {
        clearAreaFilter();
      }
    } else {
      // favorites, planning 등 나머지 탭들도 사이드바 열림 보장
      setIsSidebarCollapsed(false);
      if (activeTab !== 'planning') {
        setSelectedRestaurant(null);
        setSelectedCluster(null);
      }
      if (isAreaDrawingMode || filterPolygon) {
        clearAreaFilter();
      }
    }
  }, [activeTab]);

  // 4李?湲고: ?�� ?洹몃�??濡???�� ?� 諛??ы� ?⑥
  const [isAreaDrawingMode, setIsAreaDrawingMode] = useState<boolean>(false);
  const [isDrawingActive, setIsDrawingActive] = useState<boolean>(false);
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [filterPolygon, setFilterPolygon] = useState<{ lat: number; lng: number }[] | null>(null);
  const [isSnapActive, setIsSnapActive] = useState<boolean>(false);

  const startAreaDrawing = () => {
    setIsAreaDrawingMode(true);
    setIsDrawingActive(false);
    setDrawingPoints([]);
    setFilterPolygon(null);
    setIsSnapActive(false);
    setSelectedRestaurant(null);
    setSelectedCluster(null);
  };

  const clearAreaFilter = () => {
    if (nativePolygonRef.current) {
      nativePolygonRef.current.setMap(null);
      nativePolygonRef.current = null;
    }
    if (nativeGlowPolygonRef.current) {
      nativeGlowPolygonRef.current.setMap(null);
      nativeGlowPolygonRef.current = null;
    }
    if (nativeMaskPolygonRef.current) {
      nativeMaskPolygonRef.current.setMap(null);
      nativeMaskPolygonRef.current = null;
    }
    setFilterPolygon(null);
    setDrawingPoints([]);
    setIsAreaDrawingMode(false);
    setIsDrawingActive(false);
    setIsSnapActive(false);
    if (activeTab === 'near') {
      setActiveTab('home');
    }
  };

  const handleMapDragEnd = (map: kakao.maps.Map) => {
    const center = map.getCenter();
    setMapCenter({ lat: center.getLat(), lng: center.getLng() });
    setShouldPanToUser(false);
  };

  const handleMapZoomChanged = (map: kakao.maps.Map) => {
    setZoomLevel(map.getLevel());
    const center = map.getCenter();
    setMapCenter({ lat: center.getLat(), lng: center.getLng() });
  };

  // 4李?湲고 媛��: 釉��?곗? 而⑦?대 湲곕� ?濡?� ?� Ref 諛??몃�???�
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const nativePolygonRef = useRef<kakao.maps.Polygon | null>(null);
  const nativeGlowPolygonRef = useRef<kakao.maps.Polygon | null>(null);
  const nativeMaskPolygonRef = useRef<kakao.maps.Polygon | null>(null);

  // 4李?湲고: ?��???�� ?濡???�� ?ㅼ�?곕� Polygon 愿由?(SDK 踰洹� 諛⑹?)
  useEffect(() => {
    if (!map) return;

    let animFrameId: number;

    if (nativePolygonRef.current) {
      nativePolygonRef.current.setMap(null);
      nativePolygonRef.current = null;
    }
    if (nativeGlowPolygonRef.current) {
      nativeGlowPolygonRef.current.setMap(null);
      nativeGlowPolygonRef.current = null;
    }
    if (nativeMaskPolygonRef.current) {
      nativeMaskPolygonRef.current.setMap(null);
      nativeMaskPolygonRef.current = null;
    }

    if (!isAreaDrawingMode && filterPolygon && filterPolygon.length >= 3 && typeof window !== 'undefined' && window.kakao && window.kakao.maps) {
      const path = filterPolygon.map(pt => new window.kakao.maps.LatLng(pt.lat, pt.lng));
      
      // 0. 二쇰?遺 ?대↔�?留��?뱁??? ?대━怨??�� (?ㅽ��?몃�?댄� ?④낵)
      const outerPath = [
        new window.kakao.maps.LatLng(85, -180),
        new window.kakao.maps.LatLng(85, 180),
        new window.kakao.maps.LatLng(-85, 180),
        new window.kakao.maps.LatLng(-85, -180)
      ];
      
      const maskPolygon = new window.kakao.maps.Polygon({
        path: [outerPath, path],
        strokeWeight: 0,
        fillColor: "#09090b",
        fillOpacity: 0.65,
      });

      // 1. ?ㅼ� 湲濡�� 諛�� ?대━怨??�� (梨�곌�??�� ?�由?湲濡�곕�??��)
      const glowPolygon = new window.kakao.maps.Polygon({
        path: path,
        strokeWeight: 7.5,
        strokeColor: "#FF6F00",
        strokeOpacity: 0.28,
        strokeStyle: "solid",
        fillColor: "transparent",
        fillOpacity: 0,
      });

      // 2. 硫�� ?�-?ㅻ�吏 ?ㅼ� ?대━怨??��
      const mainPolygon = new window.kakao.maps.Polygon({
        path: path,
        strokeWeight: 2.2,
        strokeColor: "#ff3b30",
        strokeOpacity: 0.95,
        strokeStyle: "solid",
        fillColor: "transparent",
        fillOpacity: 0,
      });

      // 由ъ�?몄 <Polyline> ???濡??沅ㅼ� ?由щ㉫�� ?몃�?댄� ?猷 ???ㅼ ?�?�???�?寃 吏?� 諛��??(insertBefore Node ????щ???닿껐)
      animFrameId = requestAnimationFrame(() => {
        maskPolygon.setMap(map);
        glowPolygon.setMap(map);
        mainPolygon.setMap(map);
      });
      nativeMaskPolygonRef.current = maskPolygon;
      nativeGlowPolygonRef.current = glowPolygon;
      nativePolygonRef.current = mainPolygon;
    }

    return () => {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
      if (nativePolygonRef.current) {
        nativePolygonRef.current.setMap(null);
        nativePolygonRef.current = null;
      }
      if (nativeGlowPolygonRef.current) {
        nativeGlowPolygonRef.current.setMap(null);
        nativeGlowPolygonRef.current = null;
      }
      if (nativeMaskPolygonRef.current) {
        nativeMaskPolygonRef.current.setMap(null);
        nativeMaskPolygonRef.current = null;
      }
    };
  }, [filterPolygon, isAreaDrawingMode, map]);

  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 留��??醫痢� 踰�� ?대┃(button === 0)???留 ?濡???��??
    if (!isAreaDrawingMode || e.button !== 0 || !map) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDrawingActive(true);
    setIsSnapActive(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (typeof window === 'undefined' || !window.kakao || !window.kakao.maps) return;

    const projection = map.getProjection();
    const latlng = projection.coordsFromContainerPoint(new window.kakao.maps.Point(x, y));
    if (latlng && typeof latlng.getLat === 'function') {
      const lat = latlng.getLat();
      const lng = latlng.getLng();
      if (!isNaN(lat) && !isNaN(lng)) {
        setDrawingPoints([{ lat, lng }]);
      }
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAreaDrawingMode || !isDrawingActive || !map || drawingPoints.length === 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (typeof window === 'undefined' || !window.kakao || !window.kakao.maps) return;

    const projection = map.getProjection();
    const latlng = projection.coordsFromContainerPoint(new window.kakao.maps.Point(x, y));
    if (!latlng || typeof latlng.getLat !== 'function') return;

    const lat = latlng.getLat();
    const lng = latlng.getLng();
    if (isNaN(lat) || isNaN(lng)) return;

    const newPoint = { lat, lng };

    // ?� ?ㅻ 媛�?
    const firstPoint = drawingPoints[0];
    const dist = getDistance(firstPoint.lat, firstPoint.lng, newPoint.lat, newPoint.lng);
    if (dist <= 0.035 && drawingPoints.length > 2) {
      setIsSnapActive(true);
      setDrawingPoints((prev) => [...prev.slice(0, -1), firstPoint]);
      return;
    }
    setIsSnapActive(false);

    // ?⑤┝?쇰� ?명 遺�?�寃?珥珥??醫� ?吏 李⑤� (理� 0.5m ?대� ?�留?異�?)
    const lastPoint = drawingPoints[drawingPoints.length - 1];
    const moveDist = getDistance(lastPoint.lat, lastPoint.lng, newPoint.lat, newPoint.lng);
    if (moveDist < 0.00005) return;

    setDrawingPoints((prev) => [...prev, newPoint]);
  };

  const handleContainerMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isAreaDrawingMode || !isDrawingActive) return;
    setIsDrawingActive(false);

    if (drawingPoints.length < 3) {
      setDrawingPoints([]);
      setIsSnapActive(false);
      return;
    }

    let finalPoints = [...drawingPoints];

    if (isSnapActive) {
      finalPoints.push(drawingPoints[0]);
    } else {
      const first = finalPoints[0];
      const last = finalPoints[finalPoints.length - 1];
      const distance = getDistance(last.lat, last.lng, first.lat, first.lng);

      if (distance > 0.01) {
        const midPointsCount = 3;
        const interpolated: { lat: number; lng: number }[] = [];
        for (let i = 1; i <= midPointsCount; i++) {
          const t = i / (midPointsCount + 1);
          const interpLat = last.lat + (first.lat - last.lat) * t;
          const interpLng = last.lng + (first.lng - last.lng) * t;
          
          const dLat = first.lat - last.lat;
          const dLng = first.lng - last.lng;
          const perpLat = -dLng;
          const perpLng = dLat;
          
          const bulgeFactor = 0.15;
          const sinT = Math.sin(t * Math.PI);
          
          interpolated.push({
            lat: interpLat + perpLat * bulgeFactor * sinT,
            lng: interpLng + perpLng * bulgeFactor * sinT
          });
        }
        finalPoints = [...finalPoints, ...interpolated, first];
      } else {
        finalPoints.push(first);
      }
    }

    // ?몄� 以蹂� 醫� ?�곕�?(?ㅺ�?� ?�� 瑗?�???곗 議댁щ�??명 怨��??NaN ?�諛 ?諛�)
    const cleanedPoints = finalPoints.filter((pt, idx) => {
      if (idx === 0) return true;
      const prev = finalPoints[idx - 1];
      return pt.lat !== prev.lat || pt.lng !== prev.lng;
    });

    // 留��???곗� ???대깽???�媛 移댁뭅??吏???대??� ?� 醫寃�?????� 蹂寃쎌쇰�??명 由щ�?留 諛?draggable={true} 蹂듦뎄瑜?泥由�?湲� ?�� 300ms ?�??遺??
    setTimeout(() => {
      setFilterPolygon(cleanedPoints);
      setIsAreaDrawingMode(false);
      setIsSnapActive(false);
      setIsSidebarCollapsed(false); // ?濡???猷 ???ъ�?諛 ?닿� near ????寃곌낵 ?�
    }, 300);
  };

  // 紐⑤�???곗� ?대깽???몃�??異�?
  const handleContainerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isAreaDrawingMode || !map || e.touches.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDrawingActive(true);
    setIsSnapActive(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (typeof window === 'undefined' || !window.kakao || !window.kakao.maps) return;

    const projection = map.getProjection();
    const latlng = projection.coordsFromContainerPoint(new window.kakao.maps.Point(x, y));
    if (latlng && typeof latlng.getLat === 'function') {
      const lat = latlng.getLat();
      const lng = latlng.getLng();
      if (!isNaN(lat) && !isNaN(lng)) {
        setDrawingPoints([{ lat, lng }]);
      }
    }
  };

  const handleContainerTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isAreaDrawingMode || !isDrawingActive || !map || drawingPoints.length === 0 || e.touches.length === 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (typeof window === 'undefined' || !window.kakao || !window.kakao.maps) return;

    const projection = map.getProjection();
    const latlng = projection.coordsFromContainerPoint(new window.kakao.maps.Point(x, y));
    if (!latlng || typeof latlng.getLat !== 'function') return;

    const lat = latlng.getLat();
    const lng = latlng.getLng();
    if (isNaN(lat) || isNaN(lng)) return;

    const newPoint = { lat, lng };

    const firstPoint = drawingPoints[0];
    const dist = getDistance(firstPoint.lat, firstPoint.lng, newPoint.lat, newPoint.lng);
    if (dist <= 0.035 && drawingPoints.length > 2) {
      setIsSnapActive(true);
      setDrawingPoints((prev) => [...prev.slice(0, -1), firstPoint]);
      return;
    }
    setIsSnapActive(false);

    // 醫� ???��?瑜??� 誘몄� ?吏� ?�곕�?
    const lastPoint = drawingPoints[drawingPoints.length - 1];
    const moveDist = getDistance(lastPoint.lat, lastPoint.lng, newPoint.lat, newPoint.lng);
    if (moveDist < 0.00005) return;

    setDrawingPoints((prev) => [...prev, newPoint]);
  };



  // 罹由�???�吏 ?�留??ы� ?⑥
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

  // ?뱀� ?ㅽ????????二쇰? 1km 諛?媛?湲� 1km 留吏 異泥 ?��?댄� 濡吏
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

    // ?댁� ?μ媛 議댁�??寃쎌� 媛??湲??댁� ?μ -> ?ㅽ) 5km ?ㅺ�??踰�� ?��
    let wayPolygon: { lat: number; lng: number }[] | null = null;
    if (idx > 0) {
      const prevItem = items[idx - 1];
      wayPolygon = getRouteBufferPolygon(
        { lat: prevItem.lat, lng: prevItem.lng },
        { lat: item.lat, lng: item.lng }
      );
    }

    restaurants.forEach((restaurant) => {
      // 1. ?ㅽ ?泥�??諛寃� 5km ?대� 嫄곕━ 怨��
      const dist = getDistance(item.lat, item.lng, restaurant.lat, restaurant.lng);
      if (dist <= 5.0) {
        nearRecommendations.push({ restaurant, distance: dist, type: 'near' });
      } else if (wayPolygon && isPointInPolygon({ lat: restaurant.lat, lng: restaurant.lng }, wayPolygon)) {
        // 2. 媛??湲?5km ?ㅺ�???대? ?ы� ?щ?
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
      alert('寃?�대�??��??二쇱�??');
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
        alert('寃??寃곌낵媛 ?��?��.');
      }
    });
  };

  const handleStartNewPlanning = () => {
    if (!newItineraryTitle.trim()) {
      alert('쇼츠� 紐移�???��??二쇱�??');
      return;
    }
    if (!newItineraryStartDate || !newItineraryEndDate) {
      alert('?ы 湲곌�???��??二쇱�??');
      return;
    }
    const start = new Date(newItineraryStartDate);
    const end = new Date(newItineraryEndDate);
    if (end < start) {
      alert('醫猷쇼츠? ?�?쇰낫??鍮��? ???��?��.');
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
    setActiveTab('planning');
  };

  // 怨� 紐⑤ ?� ?�� 쇼츠� 紐⑤ OSRM ?ㅼ� ?濡留?寃쎈� 援ш� 醫� 怨��
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

      // 1. 2쇼츠감 ?댁?????�� 留�?留??ㅽ ?곌� 寃쎈� 怨�� (0踰吏� ?멸렇癒쇳몃�?蹂닿?)
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

      // 2. ?뱀� ?μ??媛� 援ш� 寃쎈� 怨��
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

  // OSRM ?ㅼ� 寃쎈�(planningRouteCoordinates)媛 蹂寃쎈� ?留??二쇰? 留吏???ㅼ媛?議고?�� 媛깆�
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
        // 援��?�⑤�?踰�� 諛寃� ?� (?蹂� 200m -> 0.2, ?以援??500m -> 0.5, ?李� 2km -> 2.0)
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

    // 怨쇰�??API ?몄� 諛⑹?瑜??�� ?諛?댁� ?��
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





  // 濡而�?ㅽ�由ъ??� 濡洹�???��? ?몄 ?蹂� 蹂듭
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

  // 留��?�댁� ?깆???��?� 쇼츠�??由ъ�?�� 吏?� ?�留�怨?泥?踰吏� ?μ濡??대�
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleActivateItinerary = (e: Event) => {
      const customEvent = e as CustomEvent;
      const itinerary = customEvent.detail;
      if (itinerary) {
        setActiveItinerary(itinerary);
        setActiveItineraryDay(1);
        setActiveTab('home'); // 吏????쇰�??대�
        
        // 泥?踰吏� ?μ 醫�濡?吏???ъ빱??諛?以??踰� 理�??
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

  // ?��?� 쇼츠�??쇼츠감媛 蹂寃쎈� ???대� 쇼츠감??泥??μ濡?吏??移대�???대�
  useEffect(() => {
    if (activeItinerary) {
      const dayItems = activeItinerary.days.find((d: any) => d.day === activeItineraryDay)?.items || [];
      const firstItem = dayItems[0];
      if (firstItem && map) {
        map.panTo(new kakao.maps.LatLng(firstItem.lat, firstItem.lng));
      }
    }
  }, [activeItineraryDay, activeItinerary, map]);


  // 利寃⑥갼湲�(localStorage) 留��?????곗�??蹂듭

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

  // 3李?湲고: 1km 踰�� ?ㅺ�??由ъ�???곗�
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

  // 3李?湲고: ?�??留吏???��?� 怨� 踰�� ?댁 ?�?�? 泥댄�
  const isRestaurantInPlanningBuffer = (restaurant: Restaurant) => {
    if (activePlanningBufferPolygons.length === 0) return false;
    return activePlanningBufferPolygons.some(poly => 
      isPointInPolygon({ lat: restaurant.lat, lng: restaurant.lng }, poly)
    );
  };

  // 3李?湲고: 留吏??寃쎈� ?�遺 以?理�???몃�?ㅼ ?쎌(寃쎌�吏 ?쎌)
  const insertRestaurantToPlanningRoute = (restaurant: Restaurant) => {
    if (!activePlanningItinerary) return;

    setActivePlanningItinerary((prev: any) => {
      const updatedDays = prev.days.map((d: any) => {
        if (d.day === planningActiveDay) {
          const items = d.items;
          let insertIdx = items.length;

          // 2媛??댁???μ媛 ?� ??理�???吏 ?몄� ?�遺 援ш� ?�
          if (items.length >= 2) {
            let minIncrease = Infinity;
            for (let i = 0; i < items.length - 1; i++) {
              const pA = items[i];
              const pB = items[i + 1];
              // getDistance ?ъ�
              const distA_P = getDistance(pA.lat, pA.lng, restaurant.lat, restaurant.lng);
              const distP_B = getDistance(restaurant.lat, restaurant.lng, pB.lat, pB.lng);
              const distA_B = getDistance(pA.lat, pA.lng, pB.lat, pB.lng);
              
              const increase = distA_P + distP_B - distA_B;
              if (increase < minIncrease) {
                minIncrease = increase;
                insertIdx = i + 1; // A? B ?ъ�?????쎌
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

  // 吏???濡?�� 쇼츠�???μ(?쇰� ?μ ?� 留吏) 吏� 異�?
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


  // 利寃⑥갼湲� ?� 蹂寃???localStorage ?湲�??
  useEffect(() => {
    if (isMountedRef.current) {
      localStorage.setItem('modoo-matjip-favorites', JSON.stringify(favorites));
    }
  }, [favorites]);

  // 留��???�洹?媛濡??ㅽщ�??�
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

  // ?대? 諛??몃? ?몃� ?�???댁�???듯� ?곕� 蹂??
  const effectiveHoveredId = externalHoveredRestaurantId || hoveredRestaurantId;

  // ?몃? ?�� ?��??蹂寃쎈� ?� 吏???곕� 諛� ??
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

  // restaurants ?곗�??媛깆� ???�� ?��???�� ?蹂� ?湲�??(?� ?蹂� ??利媛 諛�)
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

  // ?대??� ?��???대┃?� ???몃? ?�源�? ?듯� ?�?� ?몃�??
  const handleSelectRestaurant = (r: Restaurant | null) => {
    setSelectedRestaurant(r);
    if (onExternalSelectedChange) {
      onExternalSelectedChange(r);
    }
  };

  // 濡而�?ㅽ�由ъ? 利寃⑥갼湲� 紐⑸� 珥湲� 濡� 諛????
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
  useEffect(() => {
    if (map) {
      setTimeout(() => {
        map.relayout();
      }, 350); // ?釉 ?ъ�?諛 諛??��?蹂� 移대 ?��硫��???猷 ???ㅽ (transition ?媛 媛�)
    }
  }, [isSidebarCollapsed, selectedRestaurant, map, activeTab, isPlanningSearchActive]);

  // 吏??踰� 蹂寃?
  useEffect(() => {
    if (!map) return;
    const handleIdle = () => {
      // 1. ?⑦ ?�� 寃쎄� ?� (Boundary Lock)
      const center = map.getCenter();
      let lat = center.getLat();
      let lng = center.getLng();
      let outOfBounds = false;

      // ?⑦ ??듭� 寃쎄� (?二�???⑤� ~ 怨��� 遺��, 諛깅��???�� ~ ?�� ?��)
      if (lat < 33.1) { lat = 33.1; outOfBounds = true; }
      else if (lat > 38.6) { lat = 38.6; outOfBounds = true; }
      if (lng < 124.6) { lng = 124.6; outOfBounds = true; }
      else if (lng > 131.9) { lng = 131.9; outOfBounds = true; }

      if (outOfBounds) {
        // 寃쎄�瑜?踰��?硫� 遺?�쎄�??怨??Edge)?쇰� ?��??蹂대
        map.panTo(new kakao.maps.LatLng(lat, lng));
        return; 
      }

      // 2. ?� 踰� ?댁� 寃쎌� 湲곗〈 濡吏 ?�
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      
      setZoomLevel(map.getLevel());
      setMapCenter({ lat, lng });
      
      // ?쎄� ???�? ?��(Buffer Zone)???踰???泥�?�� 留而ㅻ�?誘몃━ ?밴꺼?듬??(Pre-fetching UX)
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

  // 湲곌린 諛⑺�(?移⑤�?媛��) ?몃�??
  const handleOrientation = (e: DeviceOrientationEvent) => {
    let heading: number | null = null;
    
    // iOS Safari
    if ('webkitCompassHeading' in e) {
      heading = (e as any).webkitCompassHeading;
    } 
    // Android / Chrome ?�?諛⑺�
    else if (e.absolute && e.alpha !== null) {
      heading = 360 - e.alpha;
    }
    // ?쇰� 諛⑺� ?대깽??
    else if (e.alpha !== null) {
      heading = 360 - e.alpha;
    }
    
    if (heading !== null) {
      setUserHeading(Math.round(heading));
    }
  };

  // 諛⑺� 異� 沅� ?泥� 諛??대깽???깅�
  const startOrientationTracking = () => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      // iOS 13+ 沅� ?뱀� ?�
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            (window as any).addEventListener('deviceorientation', handleOrientation, true);
          } else {
            console.warn('Device orientation permission denied');
          }
        })
        .catch((err: any) => {
          console.error('Device orientation permission error:', err);
        });
    } else {
      // Android 諛?湲고? ??釉��?곗?
      if ('ondeviceorientationabsolute' in window) {
        (window as any).addEventListener('deviceorientationabsolute', handleOrientation, true);
      } else {
        (window as any).addEventListener('deviceorientation', handleOrientation, true);
      }
    }
  };

  // ?ㅼ媛??移 媛� ?�
  const startLocationTracking = () => {
    if (watchIdRef.current !== null) return;

    setIsLocating(true);
    startOrientationTracking();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setUserLocation({ lat, lng });
        setIsLocating(false);

        // GPS 諛⑺�???��?怨� ?��媛 ?� 寃쎌� ?移⑤�?????ъ�
        if (position.coords.heading !== null && !isNaN(position.coords.heading) && position.coords.speed && position.coords.speed > 0.5) {
          setUserHeading(position.coords.heading);
        }
      },
      (error) => {
        console.error("?ㅼ媛??移 異� ?��:", error);
        alert('?移 ?蹂대�?媛?몄� ???��?��. 釉��?곗????移 沅�???��?댁＜?몄.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  // 而댄��?�� ?몃�?댄� ???몃??由ъ???댁�
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
    };
  }, []);

  // ?ㅼ媛??移 媛깆�???곕Ⅸ 吏??以�� ?대�
  useEffect(() => {
    if (shouldPanToUser && userLocation && map) {
      const locPosition = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
      map.panTo(locPosition);
    }
  }, [userLocation, shouldPanToUser, map]);

  // ???移濡??대� 諛??몃???��?
  const moveToCurrentLocation = () => {
    if (!map) return;
    if (!navigator.geolocation) {
      alert('??釉��?곗??�???移 ?鍮?ㅻ? 吏?�吏 ?��?��.');
      return;
    }

    setShouldPanToUser(true);
    startLocationTracking();

    if (userLocation) {
      const locPosition = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
      map.panTo(locPosition);
      map.setLevel(3);
    }
  };

  // ?ㅻ 萸?癒뱀?? (?�� 戮湲�)
  const pickRandomRestaurant = () => {
    if (restaurants.length === 0 || !map) {
      alert('?�� ?硫�??蹂댁�???��???��?��.');
      return;
    }
    const randomIdx = Math.floor(Math.random() * restaurants.length);
    const target = restaurants[randomIdx];
    
    // 遺?��??以�� 諛??대�
    map.setLevel(3, { animate: true });
    setTimeout(() => {
      map.panTo(new kakao.maps.LatLng(target.lat, target.lng));
      setSelectedRestaurant(target);
    }, 400); // 以??��硫��???湲?
  };

  // 留吏 珥?議고??湲곕� Solid 而댄�??Teardrop ? 留而� UI ?�??
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

    // 以??� ??誘몃 ?�� (?몃�/?�� ??蹂듭)
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

    // ??? Solid 而댄�??Teardrop ? ??????????????????????????????????????
    const PIN_SIZE = isBufferPlanningRecommended ? 36 : (isHighlighted ? 34 : 28);

    const glowShadow = isBufferPlanningRecommended
      ? '0 0 24px 8px rgba(249,115,22,0.7)' // ?ㅻ�吏 ?ㅼ� 鍮?
      : (isHighlighted
        ? '0 0 18px 5px rgba(239,68,68,0.6)'
        : viewLevel === 3
          ? '0 3px 12px rgba(239,68,68,0.45)'
          : '0 3px 10px rgba(0,0,0,0.22)');

    const ringColor = isBufferPlanningRecommended
      ? 'rgba(251,146,60,1)' // 媛��???ㅻ�吏 ?�由?
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
        {/* 異泥 留吏 諭�? */}
        {isBufferPlanningRecommended && (
          <div className="absolute z-30 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[7px] font-black tracking-tight px-1.5 py-[2px] rounded-full border border-white shadow-[0_0_12px_#f97316] whitespace-nowrap"
            style={{ top: -14, right: -(PIN_SIZE * 0.5) }}>
            寃쎈�異泥
          </div>
        )}

        {/* 議고???蹂� 諭�? ???곗륫 ?�� 怨�� */}
        {!isBufferPlanningRecommended && viewLevel === 3 && (
          <div className="absolute z-30 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[8px] font-black tracking-tight px-1.5 py-[2px] rounded-full border border-white/80 shadow-[0_2px_8px_rgba(239,68,68,0.6)] animate-pulse whitespace-nowrap"
            style={{ top: -10, right: -(PIN_SIZE * 0.65) }}>
            100留?
          </div>
        )}
        {!isBufferPlanningRecommended && viewLevel === 2 && (
          <div className="absolute z-30 bg-zinc-900/90 backdrop-blur-sm text-white text-[8px] font-black tracking-tight px-1.5 py-[2px] rounded-full border border-white/20 shadow-[0_2px_6px_rgba(0,0,0,0.4)] whitespace-nowrap"
            style={{ top: -10, right: -(PIN_SIZE * 0.65) }}>
            10留?
          </div>
        )}

        {/* 3李?湲고: 寃쎈�??異泥 留吏 ?댁� ?�� 留?*/}
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

        {/* 3?④� ?諛� ?�� 留?*/}
        {!isBufferPlanningRecommended && viewLevel === 3 && (
          <div
            className="absolute animate-ping pointer-events-none z-0 rounded-full bg-red-500/20"
            style={{ width: PIN_SIZE, height: PIN_SIZE, top: 0, left: 0 }}
          />
        )}

        {/* Teardrop ? 蹂몄껜 */}
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
            {/* 留而� 以� 援щ� (Inner Hole) */}
            <div 
              className="bg-white rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)]" 
              style={{ width: PIN_SIZE * 0.35, height: PIN_SIZE * 0.35 }}
            />
          </div>
        </div>

        {/* 4?④�: 以??踰� 1~4 ?�� ?��???�留?*/}
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


  // 移댄怨�由�, ?� ?щ㎎ ?�� 諛??�� 濡吏 (useMemo ?��)
  const filteredRestaurants = useMemo(() => {
    let result = restaurants.filter(r => {
      // 0. ?洹몃�??�� ?�� ?ㅺ�??寃??
      if (filterPolygon && filterPolygon.length >= 3) {
        if (typeof r.lat !== 'number' || typeof r.lng !== 'number' || isNaN(r.lat) || isNaN(r.lng)) {
          return false;
        }
        if (!isPointInPolygon({ lat: r.lat, lng: r.lng }, filterPolygon)) {
          return false;
        }
      }

      // 1. ?� 醫瑜 ?��
      let catMatch = false;
      if (activeCategory === '전체') {
        catMatch = true;
      } else {
        const cat = r.category || '';
        if (activeCategory === '아시안') {
          catMatch = cat.includes('아시안') || cat.includes('태국') || cat.includes('베트남') || cat.includes('동남아') || cat.includes('인도') || cat.includes('아시아') || cat.includes('대만') || cat.includes('일식') || cat.includes('멕시코') || cat.includes('타코');
        } else if (activeCategory === '카페/디저트') {
          catMatch = cat.includes('카페') || cat.includes('디저트') || cat.includes('베이커리') || cat.includes('커피');
        } else if (activeCategory === '술집') {
          catMatch = cat.includes('술집') || cat.includes('주점') || cat.includes('포차') || cat.includes('이자카야');
        } else {
          catMatch = cat.includes(activeCategory);
        }
      }
      if (!catMatch) return false;

      // 2. ?� ?щ㎎ ?��
      if (activeVideoType !== '전체 리뷰') {
        if (!r.videos || r.videos.length === 0) return false;
        
        if (activeVideoType === '쇼츠 리뷰') {
          // ?��???щ� ?� 以?쇼츠�媛 ?�?쇰� ?�쇰�??ы�
          const hasShorts = r.videos.some(vid => vid.is_short === true);
          if (!hasShorts) return false;
        } else if (activeVideoType === '롱폼 리뷰') {
          // ?��???щ� ?� 以?롱폼��???�?쇰� ?�쇰�??ы�
          const hasLongForm = r.videos.some(vid => vid.is_short !== true);
          if (!hasLongForm) return false;
        }
      }

      // 3. ?댁?洹� ?��
      if (activeTag) {
        const tags = getRestaurantAllTags(r);
        if (!tags.includes(activeTag)) return false;
      }

      // 4. ?듯� ?��??寃???��
      if (globalSearchQuery.trim()) {
        const query = globalSearchQuery.toLowerCase().trim();
        const nameMatch = r.name.toLowerCase().includes(query);
        const categoryMatch = (r.category || '').toLowerCase().includes(query);
        const addressMatch = (r.address || '').toLowerCase().includes(query);
        
        // ?��踰?梨�紐?留ㅼ묶
        const youtuberMatch = r.videos?.some(vid => 
          vid.youtuber?.name?.toLowerCase().includes(query)
        ) || false;
        
        // ?ㅼ??諛??洹� 留ㅼ묶
        const tags = getRestaurantAllTags(r);
        const tagMatch = tags.some(tag => tag.toLowerCase().includes(query));
        
        if (!nameMatch && !categoryMatch && !addressMatch && !youtuberMatch && !tagMatch) {
          return false;
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
  }, [restaurants, activeCategory, activeSort, activeVideoType, filterPolygon, activeTag, globalSearchQuery]);

if (loading) return <div className="w-full h-screen bg-gray-50 flex items-center justify-center">Loading Maps...</div>;
  if (mapError) return <div className="w-full h-screen bg-gray-50 flex items-center justify-center text-red-500 font-bold">Failed to load Kakao Maps: {mapError.message}</div>;

  return (
    <div className="w-full h-screen flex relative overflow-hidden bg-gray-100 dark:bg-zinc-950 font-sans">
      {/* 湲濡踰 SVG 洹몃�?곗�???� */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="red-orange-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF0000" />
            <stop offset="100%" stopColor="#FF7A00" />
          </linearGradient>
        </defs>
      </svg>

      {/* ========================================================
          1. ?곗�?ы 1李?硫�� ?ъ�?諛 (二쇳�-鍮④� 洹몃�?곗�?? - md ?댁 ?몄�
          ======================================================== */}
      <div className="hidden md:flex flex-col w-[62px] h-full shrink-0 bg-gradient-to-b from-[#ff3b30] to-[#ff6f00] py-6 justify-between items-center relative z-30 shadow-[4px_0_24px_rgba(0,0,0,0.12)]">
        {/* ?�� 濡怨� ???대┃ ??????쇰�??대� */}
        <div className="flex flex-col items-center gap-1">
          <div
            onClick={() => {
              setActiveTab('home');
              setSelectedRestaurant(null);
              setSelectedCluster(null);
            }}
            className="w-11 h-11 flex items-center justify-center select-none cursor-pointer hover:scale-105 active:scale-95 transition-all relative"
          >
            <div className="absolute w-8 h-8 rounded-full bg-white/20 blur-md pointer-events-none" />
            <img
              src="/favicon_perfect_gradient.png"
              className="w-8 h-8 object-contain relative z-10 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]"
              alt="로고"
            />
          </div>
        </div>

        {/* ?硫�� ?�댁�?由ъ�?????ъ� 鍮�� ??諛곗� */}
        <div className="flex flex-col gap-5 w-full items-center">
          {[
            { id: 'home' as TabType,      label: '홈',      icon: Home,          desc: '지도에서 맛집 탐색' },
            { id: 'near' as TabType,      label: '주변맛집', icon: NearbyIcon,    desc: '내 주변 핫플 탐색' },
            { id: 'favorites' as TabType, label: '저장',    icon: Star,          desc: '저장한 맛집 모음' },
            { id: 'planning' as TabType,  label: '일정',    icon: CalendarRange,  desc: '여행 코스 만들기' },
            { id: 'shopping' as TabType,  label: '쇼핑',    icon: ShoppingBag,   desc: '밀키트 쇼핑하기' },
            { id: 'mypage' as TabType,    label: '마이',    icon: User,          desc: '프로필 & 서비스 정보' },
          ].map((menu) => {
            const Icon = menu.icon;
            const isActive = activeTab === menu.id;
            const favCount = menu.id === 'favorites' ? favorites.length : 0;
            return (
              <button
                key={menu.id}
                onClick={() => setActiveTab(menu.id)}
                className={`group relative flex flex-col items-center justify-center w-[50px] h-[50px] rounded-2xl transition-all duration-200 ease-out cursor-pointer ${
                  isActive
                    ? 'bg-white/15 text-white font-bold z-10 active:scale-[0.95]'
                    : 'text-white/60 hover:text-white hover:bg-white/10 active:scale-[0.95] z-10'
                }`}
              >
                {/* ?�� ?몃耳?댄� 諛?*/}
                {isActive && (
                  <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-[3px] h-6 bg-white rounded-full z-10" />
                )}

                {/* ?�댁�?+ 利寃⑥갼湲� 諛곗? */}
                <div className="relative">
                  <Icon
                    size={22}
                    className="transition-opacity duration-200 z-10"
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  {favCount > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-white text-[#ff3b30] text-[8px] font-black rounded-full flex items-center justify-center px-[2px] leading-none shadow-sm z-20">
                      {favCount > 99 ? '99+' : favCount}
                    </div>
                  )}
                </div>

                <span className="text-[12px] mt-1 opacity-90 font-semibold z-10">{menu.label}</span>

                {/* 而ㅼ�? ?댄 ??利媛 ?� */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-zinc-900/95 text-white rounded-xl px-3 py-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl border border-white/10">
                  <div className="text-[13px] font-semibold">{menu.label}</div>
                  <div className="text-[12px] text-white/55 mt-0.5">{menu.desc}</div>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-900/95" />
                </div>
              </button>
            );
          })}
        </div>

        {/* ?�� ?⑥� (?蹂�?湲� & 濡洹�???濡?? */}
        <div className="flex flex-col items-center gap-4">
          {/* ?蹂�?湲� ??媛議� ?ㅽ???+ ?댄 */}
          <div className="group relative">
            <button
              onClick={() => {
                if (!user) setIsLoginModalOpen(true);
                else setIsSubmissionOpen(true);
              }}
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 hover:border-white/50 text-white active:scale-[0.95] flex items-center justify-center transition-all duration-200 cursor-pointer shadow-[0_0_10px_rgba(255,255,255,0.12)] hover:shadow-[0_0_16px_rgba(255,255,255,0.22)]"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-zinc-900/95 text-white rounded-xl px-3 py-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl border border-white/10">
              <div className="text-[13px] font-bold">맛집 제보하기</div>
              <div className="text-[11px] text-white/55 mt-0.5">아직 없는 맛집을 알려주세요</div>
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-900/95" />
            </div>
          </div>

          {/* 로그인 / 프로필 */}
          <button
            onClick={() => {
              if (!user) setIsLoginModalOpen(true);
              else {
                setActiveTab('mypage');
                setSelectedRestaurant(null);
                setSelectedCluster(null);
              }
            }}
            className="w-10 h-10 rounded-full overflow-hidden border border-white/20 hover:border-white/40 flex items-center justify-center transition-all duration-200 active:scale-[0.95] cursor-pointer text-white/60 hover:text-white"
            title={user ? `${user.name} 님` : "로그인"}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
            ) : (
              <User size={18} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {/* ========================================================
          2. ?곗�?ы 2李??釉 ?ъ�?諛 (?釉 硫�� 諛??��/由ъ�?? - md ?댁 ?몄�
          ======================================================== */}
      <AnimatePresence initial={false}>
        {!isSidebarCollapsed && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: subSidebarWidth }}
            exit={{ width: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ minWidth: 0 }}
            className="hidden md:flex flex-col h-full bg-white border-r border-slate-200 overflow-hidden z-20 shadow-[4px_0_20px_rgba(0,0,0,0.08)] select-none shrink-0"
          >
              <div
                className="flex-1 overflow-y-auto portal-sidebar-scrollbar flex flex-col"
                style={{ scrollbarWidth: 'none', width: subSidebarWidth, minWidth: subSidebarWidth }}
              >
              
              {/* 2-1. ??吏?? ???釉 而⑦痢?*/}
              {activeTab === 'home' && (
                <div className="p-5 space-y-5 flex-1 flex flex-col">
                  {/* 寃?李� */}
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={globalSearchQuery}
                      onChange={(e) => setGlobalSearchQuery(e.target.value)}
                      placeholder="맛집, 카테고리, 유튜버 검색"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-9 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 transition-colors"
                    />
                    {globalSearchQuery && (
                      <button
                        onClick={() => setGlobalSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* ?�� 留異� 異泥 */}
                  {!globalSearchQuery && (
                    <div className="-mx-5 -mt-2">
                      <FoodCurationDashboard
                        restaurants={restaurants}
                        center={mapCenter}
                        currentRegion={currentRegion}
                        onSelectRestaurant={handleSelectRestaurant}
                        selectedRestaurantId={selectedRestaurant?.id}
                        onSelectTrendingMenu={(keyword) => {
                          setGlobalSearchQuery(keyword);
                          setSelectedCluster(null);
                        }}
                        onPlayVideo={(id) => setPlayingYoutubeId(id)}
                      />
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-3.5 shrink-0 gap-2">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <h4 className="text-[14px] font-black text-slate-800 tracking-tight">
                          우리 동네 맛집
                        </h4>
                        {selectedCluster && (
                          <button
                            onClick={() => setSelectedCluster(null)}
                            className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md hover:bg-orange-100 transition-colors"
                          >
                            해제
                          </button>
                        )}
                      </div>

                      {/* 필터 3형제 - 우리동네맛집 우측 배치 */}
                      <div className="flex items-center gap-1 z-30 select-none">
                        {/* 1. 음식 종류 */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')}
                            className={`py-1.5 px-2 rounded-full text-[10px] font-bold flex items-center gap-0.5 transition-all border cursor-pointer ${
                              activeCategory !== '전체'
                                ? 'bg-orange-500 text-white border-transparent'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <Utensils size={9} className="shrink-0" />
                            <span className="truncate max-w-[42px]">{activeCategory === '전체' ? '음식' : activeCategory === '카페/디저트' ? '디저트' : activeCategory}</span>
                            <ChevronDown size={9} className={activeDropdown === 'category' ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} />
                          </button>
                          
                          <AnimatePresence>
                            {activeDropdown === 'category' && (
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                className="absolute top-full right-0 mt-1 w-[240px] bg-white border border-slate-100 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-3 gap-1"
                              >
                                {['전체', '한식', '일식', '중식', '양식', '아시안', '분식', '디저트', '술집'].map((category) => (
                                  <button
                                    key={category}
                                    onClick={() => {
                                      setActiveCategory(category === '디저트' ? '카페/디저트' : category);
                                      setSelectedCluster(null);
                                      setActiveDropdown(null);
                                    }}
                                    className={`py-1.5 px-1 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer ${
                                      (category === '디저트' ? '카페/디저트' : category) === activeCategory
                                        ? 'bg-orange-500 text-white font-black shadow-sm'
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                                  >
                                    {category}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* 2. 정렬 방식 */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')}
                            className={`py-1.5 px-2 rounded-full text-[10px] font-bold flex items-center gap-0.5 transition-all border cursor-pointer ${
                              activeSort !== 'latest'
                                ? 'bg-orange-500 text-white border-transparent'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <ArrowUpDown size={9} className="shrink-0" />
                            <span className="truncate">{activeSort === 'latest' ? '최신' : '조회'}</span>
                            <ChevronDown size={9} className={activeDropdown === 'sort' ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} />
                          </button>
                          
                          <AnimatePresence>
                            {activeDropdown === 'sort' && (
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                className="absolute top-full right-0 mt-1 w-[130px] bg-white border border-slate-100 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-1 gap-1"
                              >
                                {[{ id: 'latest', label: '최신순' }, { id: 'views', label: '조회수순' }].map((sort) => (
                                  <button
                                    key={sort.id}
                                    onClick={() => {
                                      setActiveSort(sort.id as any);
                                      setSelectedCluster(null);
                                      setActiveDropdown(null);
                                    }}
                                    className={`py-1.5 px-1 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer ${
                                      activeSort === sort.id
                                        ? 'bg-orange-500 text-white font-black shadow-sm'
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                                  >
                                    {sort.label}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* 3. 영상 종류 */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === 'videoType' ? null : 'videoType')}
                            className={`py-1.5 px-2 rounded-full text-[10px] font-bold flex items-center gap-0.5 transition-all border cursor-pointer ${
                              activeVideoType !== '전체 리뷰'
                                ? 'bg-orange-500 text-white border-transparent'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <PlayCircle size={9} className="shrink-0" />
                            <span className="truncate">{activeVideoType === '전체 리뷰' ? '영상' : activeVideoType === '쇼츠 리뷰' ? '쇼츠' : '롱폼'}</span>
                            <ChevronDown size={9} className={activeDropdown === 'videoType' ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} />
                          </button>
                          
                          <AnimatePresence>
                            {activeDropdown === 'videoType' && (
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                className="absolute top-full right-0 mt-1 w-[160px] bg-white border border-slate-100 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-1 gap-1"
                              >
                                {[
                                  { id: '전체 리뷰', label: '전체 리뷰' },
                                  { id: '쇼츠 리뷰', label: '쇼츠 리뷰' },
                                  { id: '롱폼 리뷰', label: '롱폼 리뷰' }
                                ].map((type) => (
                                  <button
                                    key={type.id}
                                    onClick={() => {
                                      setActiveVideoType(type.id as any);
                                      setSelectedCluster(null);
                                      setActiveDropdown(null);
                                    }}
                                    className={`py-1.5 px-1 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer ${
                                      activeVideoType === type.id
                                        ? 'bg-orange-500 text-white font-black shadow-sm'
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                                  >
                                    {type.label}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 pb-4 pr-3 portal-sidebar-scrollbar" style={{ scrollbarWidth: 'none' }}>
                      {(selectedCluster || filteredRestaurants).slice(0, 40).map((r) => {
                        const vid = getBestVideo(r.videos, activeVideoType);
                        const isFav = favorites.includes(r.id);
                        const isSelected = selectedRestaurant?.id === r.id;
                        const catLabel = getFormattedCategory(r.category).split(' ??').pop() ?? getFormattedCategory(r.category);

                        return (
                          <div key={r.id} className="relative">
                            {/* 嫄고� ?몃耳?댄� ??移대 諛源� ?곗륫 ?щ갚 */}
                            <AnimatePresence>
                              {isSelected && (
                                <motion.div
                                  initial={{ scaleY: 0, opacity: 0 }}
                                  animate={{ scaleY: 1, opacity: 1 }}
                                  exit={{ scaleY: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: 'easeOut' }}
                                  className="absolute top-2 bottom-2 right-[-10px] w-[3px] rounded-full origin-top pointer-events-none z-10"
                                  style={{ background: 'linear-gradient(to bottom, #ef4444, #f97316)', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }}
                                />
                              )}
                            </AnimatePresence>

                          <motion.div
                            onClick={() => {
                              handleSelectRestaurant(r);
                              map?.panTo(new kakao.maps.LatLng(r.lat, r.lng));
                            }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            whileTap={{ scale: 0.97 }}
                            className="group relative w-full rounded-2xl overflow-hidden cursor-pointer"
                            style={{
                              aspectRatio: '16/9',
                              boxShadow: isSelected
                                ? '0 6px 20px rgba(0,0,0,0.18)'
                                : '0 2px 8px rgba(0,0,0,0.08)',
                            }}
                          >
                            {/* 배경 이미지 */}
                            {vid?.thumbnail ? (
                              <img
                                src={vid.thumbnail}
                                className="absolute inset-0 w-full h-full object-cover restaurant-card-img"
                                alt={r.name}
                              />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                                <Utensils size={32} className="text-slate-500" />
                              </div>
                            )}

                            {/* Shorts badge - 우측하단 배치 */}
                            {vid?.is_short && (
                              <div className="absolute bottom-2.5 right-2.5 bg-red-600/90 backdrop-blur-md text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-red-500/30 shadow-[0_2px_8px_rgba(220,38,38,0.3)] z-10">
                                <Play size={6} fill="currentColor"/> SHORTS
                              </div>
                            )}

                            {/* 그라데이션 오버레이 */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

                            {/* ?��: 移댄怨�由� + 利寃⑥갼湲� */}
                            <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white/90 border border-white/15">
                                {catLabel}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isFav) setFavorites(favorites.filter(fid => fid !== r.id));
                                  else setFavorites([...favorites, r.id]);
                                }}
                                className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/15 hover:bg-black/60 transition-colors"
                              >
                                <Star size={12} className={isFav ? 'text-orange-400 fill-orange-400' : 'text-white/80'} />
                              </button>
                            </div>

                            {/* ?��: ?��??*/}
                            <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3.5 z-10">
                              {vid?.youtuber && (
                                <div className="flex items-center gap-1.5 mb-2">
                                  {vid.youtuber.profile_image ? (
                                    <img
                                      src={vid.youtuber.profile_image}
                                      className="w-5 h-5 rounded-full object-cover ring-1 ring-white/40"
                                      alt={vid.youtuber.name}
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                      {vid.youtuber.name?.[0]}
                                    </div>
                                  )}
                                  <span className="text-[10px] font-semibold text-white/80 truncate max-w-[100px]">{vid.youtuber.name}</span>
                                  
                                </div>
                              )}
                              <p className="text-[15px] font-black text-white leading-tight truncate">{r.name}</p>
                              {vid?.view_count !== undefined && vid.view_count > 0 && (
                                <div className="flex items-center gap-1 mt-1.5">
                                  <Eye size={10} className="text-orange-300 shrink-0" />
                                    <span className="text-[11px] font-bold text-orange-300">조회수 {formatViewCount(vid.view_count)}회</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 2-near. 二쇰?留吏 ?�� ?� 寃곌낵 */}
              {activeTab === 'near' && (
                <div className="flex flex-col h-full">
                  {filterPolygon ? (
                    <>
                      {/* ?ㅻ */}
                      <div className="px-5 pt-5 pb-3 shrink-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-[15px] font-black text-slate-800">필터 영역 내 맛집</h3>
                          <button
                            onClick={() => {
                              setFilterPolygon(null);
                              setDrawingPoints([]);
                              setIsSnapActive(false);
                              startAreaDrawing();
                              setIsSidebarCollapsed(true);
                            }}
                            className="text-[11px] font-bold text-orange-500 hover:text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            다시 그리기
                          </button>
                        </div>
                        <p className="text-[12px] text-slate-400 font-medium">{filteredRestaurants.length}媛?諛寃�</p>
                        {/* 移댄怨�由� ?�� 移?*/}
                        <div className="flex gap-1.5 overflow-x-auto mt-3 pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                          {['전체', '한식', '일식', '중식', '양식', '아시안', '분식', '카페/디저트', '술집'].map(cat => (
                            <button
                              key={cat}
                              onClick={() => setActiveCategory(cat)}
                              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                                activeCategory === cat
                                  ? 'bg-orange-500 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-500 hover:bg-orange-50 hover:text-orange-600'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* 由ъ�??*/}
                      <div className="flex-1 overflow-y-auto portal-sidebar-scrollbar px-3 pb-4 space-y-2" style={{ scrollbarWidth: 'none' }}>
                        {filteredRestaurants.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                            <Utensils size={32} className="text-slate-200 mb-3" />
                            <p className="text-sm font-bold text-slate-400">필터 영역 내 맛집이 없습니다.</p>
                            <p className="text-xs text-slate-300 mt-1">다른 영역을 그려보세요</p>
                          </div>
                        ) : (
                          filteredRestaurants.slice(0, 60).map((r) => {
                            const vid = getBestVideo(r.videos, activeVideoType);
                            const isFav = favorites.includes(r.id);
                            const isSelected = selectedRestaurant?.id === r.id;
                            return (
                              <div
                                key={r.id}
                                onClick={() => { handleSelectRestaurant(r); map?.panTo(new kakao.maps.LatLng(r.lat, r.lng)); }}
                                className={`group p-3 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                                  isSelected ? 'bg-orange-50/40 border-orange-500/30' : 'bg-slate-50/50 hover:bg-slate-100/50 border-slate-100 hover:border-slate-200'
                                }`}
                              >
                                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-slate-200 relative">
                                  {vid?.thumbnail ? <img src={vid.thumbnail} className="w-full h-full object-cover" alt={r.name} onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=fed7aa&color=ea580c&size=56`; }} /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Utensils size={18} /></div>}
                                  {vid?.is_short && <div className="absolute bottom-0.5 right-0.5 bg-red-600 text-white text-[7px] font-black px-1 rounded">S</div>}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <div className="flex items-center justify-between gap-1">
                                    <h5 className="font-extrabold text-[14px] text-slate-800 truncate group-hover:text-orange-600 transition-colors">{r.name}</h5>
                                    <Star size={11} className={isFav ? 'text-orange-500 fill-orange-500 shrink-0' : 'text-slate-300 shrink-0'} />
                                  </div>
                                  <span className="text-xs text-slate-400 truncate mt-0.5">{getFormattedCategory(r.category)}</span>
                                  {vid?.view_count !== undefined && vid.view_count > 0 && (
                                    <span className="text-[12px] font-medium text-orange-500/80 mt-1">조회수 {formatViewCount(vid.view_count)}회</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-3">
                      <PenTool size={40} className="text-slate-200" />
                       <p className="text-sm font-black text-slate-500">지도 위에 영역을 그려보세요</p>
                       <p className="text-xs text-slate-400 leading-relaxed">자유롭게 영역을 드래그하면 영역 내 맛집을 필터링해 드립니다.</p>
                    </div>
                  )}
                </div>
              )}

              {/* 2-2. ????μ ???釉 而⑦痢?*/}
              {activeTab === 'favorites' && (
                <div className="flex flex-col h-full">
                  {!user ? (
                    <div className="flex flex-col items-center justify-center h-full px-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center shadow-lg mb-5">
                        <User size={30} className="text-white" />
                      </div>
                      <p className="text-[16px] font-extrabold text-slate-800 tracking-tight">로그인이 필요해요</p>
                      <p className="text-[13px] text-slate-400 mt-2 mb-7 text-center leading-relaxed">로그인하시면 맛집 저장, 일정 관리 등 모든 기능을 사용하실 수 있습니다.</p>
                      {/* ?� 濡洹�??踰�� */}
                      <div className="w-full flex flex-col gap-2.5">
                        {/* Google */}
                        <button onClick={() => handleDirectLogin('google')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span className="flex-1 text-center">Google 계정으로 로그인</span>
                        </button>
                        {/* Kakao */}
                        <button onClick={() => handleDirectLogin('kakao')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#3C1E1E">
                            <path d="M12 3c-5.523 0-10 3.582-10 8c0 2.915 1.91 5.467 4.79 6.853l-1.2 4.41c-.11.41.36.75.72.51l5.22-3.48c.15.01.31.02.47.02 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
                          </svg>
                          <span className="flex-1 text-center">Kakao 계정으로 로그인</span>
                        </button>
                        {/* Naver */}
                        <button onClick={() => handleDirectLogin('naver')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm">
                          <span className="w-5 h-5 shrink-0 bg-[#03C75A] rounded flex items-center justify-center text-white font-black text-[13px] leading-none">N</span>
                          <span className="flex-1 text-center">Naver 계정으로 로그인</span>
                        </button>
                      </div>
                    </div>
                  ) : (() => {
                    const favRestaurants = restaurants.filter(r => favorites.includes(r.id));
                    return (
                      <>
                        <div className="px-5 pt-5 pb-3 shrink-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[15px] font-black text-slate-800">저장한 맛집</h3>
                            <span className="text-[11px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{favRestaurants.length}개</span>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto portal-sidebar-scrollbar px-3 pb-4 space-y-2" style={{ scrollbarWidth: 'none' }}>
                          {favRestaurants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-center px-4 gap-3">
                              <Star size={32} className="text-slate-200" />
                              <p className="text-sm font-bold text-slate-400">아직 저장한 맛집이 없습니다.</p>
                              <p className="text-xs text-slate-300">맛집 카드의 별을 눌러 저장해 보세요.</p>
                            </div>
                          ) : (
                            favRestaurants.map((r) => {
                              const vid = getBestVideo(r.videos, activeVideoType);
                              const isSelected = selectedRestaurant?.id === r.id;
                              return (
                                <div
                                  key={r.id}
                                  onClick={() => { handleSelectRestaurant(r); map?.panTo(new kakao.maps.LatLng(r.lat, r.lng)); }}
                                  className={`group p-3 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                                    isSelected ? 'bg-orange-50/40 border-orange-500/30' : 'bg-slate-50/50 hover:bg-slate-100/50 border-slate-100 hover:border-slate-200'
                                  }`}
                                >
                                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-slate-200 relative">
                                    {vid?.thumbnail ? <img src={vid.thumbnail} className="w-full h-full object-cover" alt={r.name} onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=fed7aa&color=ea580c&size=56`; }} /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Utensils size={18} /></div>}
                                  </div>
                                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h5 className="font-extrabold text-[14px] text-slate-800 truncate group-hover:text-orange-600 transition-colors">{r.name}</h5>
                                    <span className="text-xs text-slate-400 truncate mt-0.5">{getFormattedCategory(r.category)}</span>
                                    {vid?.view_count !== undefined && vid.view_count > 0 && (
                                      <span className="text-[12px] font-medium text-orange-500/80 mt-1">조회수 {formatViewCount(vid.view_count)}회</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={e => { e.stopPropagation(); setFavorites(prev => prev.filter(id => id !== r.id)); }}
                                    className="shrink-0 self-center p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                  >
                                    <Star size={14} className="text-orange-500 fill-orange-500" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 2-3. 諛?ㅽ� ?쇳 ???釉 而⑦痢?*/}
              {activeTab === 'shopping' && (
                <div className="flex flex-col h-full overflow-y-auto portal-sidebar-scrollbar" style={{ scrollbarWidth: 'none' }}>
                  {/* ?ㅻ */}
                  <div className="px-5 pt-5 pb-4 shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ShoppingBag size={16} className="text-orange-500" />
                      <h3 className="text-[15px] font-black text-slate-800">밀키트 쇼핑</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">그 유튜버가 극찬했던 시그니처 메뉴를 집에서 밀키트로 최저가에 만나보세요.</p>
                  </div>
                  {/* 諛곕 */}
                  <div className="mx-4 mb-4 shrink-0">
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 text-white">
                      <p className="text-[11px] font-medium opacity-80 mb-0.5">지금 가장 핫한</p>
                      <p className="text-[14px] font-black leading-snug">인기 유튜버 추천 밀키트<br/>최대 40% 단독 할인 중</p>
                      <button className="mt-3 bg-white/20 hover:bg-white/30 transition-colors text-[11px] font-black px-3 py-1.5 rounded-lg">
                        쇼핑 바로가기
                      </button>
                    </div>
                  </div>
                  {/* 移댄怨�由� 移?*/}
                  <div className="px-4 mb-3 shrink-0">
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {['전체', '한식', '일식', '중식', '양식', '분식'].map(cat => (
                        <button
                          key={cat}
                          className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-orange-100 hover:text-orange-600 transition-colors"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* ?� 紐⑸� */}
                  <div className="flex-1 px-4 pb-4 space-y-3">
                    {[
                      { name: '부대찌개 밀키트 2인분', desc: '유튜버 강추 / 별점 4.9', price: '18,900원', badge: 'BEST' },
                      { name: '간장게장 세트', desc: '유튜버 쯔양 추천 / 별점 4.8', price: '34,000원', badge: 'NEW' },
                      { name: '곱창전골 밀키트', desc: '유튜버 입짧은햇님 추천 / 별점 4.7', price: '22,500원', badge: null },
                      { name: '떡볶이 시그니처', desc: '유튜버 떡볶퀸 추천 / 별점 4.6', price: '9,900원', badge: '할인' },
                    ].map((item) => (
                      <div key={item.name} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50/30 transition-all cursor-pointer">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center shrink-0 relative">
                          <ShoppingBag size={20} className="text-orange-400" />
                          {item.badge && (
                            <span className="absolute -top-1 -right-1 text-[9px] font-black bg-red-500 text-white px-1 py-0.5 rounded-md leading-none">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-black text-slate-800 truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                          <p className="text-[12px] font-black text-orange-600 mt-1">{item.price}</p>
                        </div>
                        <ChevronRight size={14} className="text-slate-300 shrink-0" />
                      </div>
                    ))}
                    <p className="text-center text-[11px] text-slate-300 font-bold pt-2">더 많은 밀키트가 준비 중입니다.</p>
                  </div>
                </div>
              )}

              {/* 2-4. 留��?�댁� ???釉 而⑦痢?*/}
              {activeTab === 'mypage' && (
                <div className="flex flex-col h-full overflow-y-auto portal-sidebar-scrollbar" style={{ scrollbarWidth: 'none' }}>
                  {!user ? (
                    <div className="flex flex-col items-center justify-center h-full px-6 gap-0">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center shadow-lg mb-5">
                        <User size={30} className="text-white" />
                      </div>
                      <p className="text-[16px] font-extrabold text-slate-800 tracking-tight">로그인이 필요해요</p>
                      <p className="text-[13px] text-slate-400 mt-2 mb-7 text-center leading-relaxed">로그인하시면 맛집 저장, 일정 관리 등 모든 기능을 사용하실 수 있습니다.</p>
                      <div className="w-full flex flex-col gap-2.5">
                        <button onClick={() => handleDirectLogin('google')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span className="flex-1 text-center">Google 계정으로 로그인</span>
                        </button>
                        <button onClick={() => handleDirectLogin('kakao')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#3C1E1E">
                            <path d="M12 3c-5.523 0-10 3.582-10 8c0 2.915 1.91 5.467 4.79 6.853l-1.2 4.41c-.11.41.36.75.72.51l5.22-3.48c.15.01.31.02.47.02 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
                          </svg>
                          <span className="flex-1 text-center">Kakao 계정으로 로그인</span>
                        </button>
                        <button onClick={() => handleDirectLogin('naver')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm">
                          <span className="w-5 h-5 shrink-0 bg-[#03C75A] rounded flex items-center justify-center text-white font-black text-[13px] leading-none">N</span>
                          <span className="flex-1 text-center">Naver 계정으로 로그인</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 濡洹�???� */
                    <div className="flex flex-col">
                      {/* ?濡???ㅻ */}
                      <div className="px-5 pt-6 pb-4 bg-gradient-to-b from-orange-50/60 to-transparent">
                        <div className="flex items-center gap-3 mb-4">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-orange-200" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=fed7aa&color=ea580c&size=56`; }} />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white font-black text-lg">
                              {user.name[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-800 truncate">{user.name}</p>
                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                            <span className="inline-block mt-1 text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                              {user.provider === 'kakao' ? '카카오' : user.provider === 'google' ? '구글' : '네이버'} 로그인
                            </span>
                          </div>
                        </div>
                        {/* ???듦� */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                            <p className="text-lg font-black text-orange-500">{favorites.length}</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">저장한 맛집</p>
                          </div>
                          <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                            <p className="text-lg font-black text-orange-500">0</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">내 여행 일정</p>
                          </div>
                        </div>
                      </div>
                      {/* 硫�� */}
                      <div className="px-5 py-3 space-y-1">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">활동</p>
                        <button onClick={() => setActiveTab('favorites')} className="flex items-center justify-between w-full py-2.5 text-sm text-slate-700 hover:text-orange-600 transition-colors">
                          <div className="flex items-center gap-2.5"><Star size={15} className="text-slate-400" /><span className="font-bold">저장한 맛집</span></div>
                          <div className="flex items-center gap-1"><span className="text-xs text-orange-500 font-bold">{favorites.length}</span><CornerUpRight size={12} className="text-slate-300" /></div>
                        </button>
                        <button onClick={() => setActiveTab('planning')} className="flex items-center justify-between w-full py-2.5 text-sm text-slate-700 hover:text-orange-600 transition-colors">
                          <div className="flex items-center gap-2.5"><CalendarRange size={15} className="text-slate-400" /><span className="font-bold">내 여행 일정</span></div>
                          <CornerUpRight size={12} className="text-slate-300" />
                        </button>
                        <button onClick={() => setIsSubmissionOpen(true)} className="flex items-center justify-between w-full py-2.5 text-sm text-slate-700 hover:text-orange-600 transition-colors">
                          <div className="flex items-center gap-2.5"><MapPinPlus size={15} className="text-slate-400" /><span className="font-bold">맛집 제보하기</span></div>
                          <CornerUpRight size={12} className="text-slate-300" />
                        </button>
                      </div>
                      <div className="px-5 py-3 space-y-1 border-t border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">서비스</p>
                        {[
                          { label: '이용약관', href: '/legal/terms' },
                          { label: '개인정보처리방침', href: '/legal/privacy' },
                        ].map(item => (
                          <a key={item.label} href={item.href} className="flex items-center justify-between py-2.5 text-xs text-slate-500 hover:text-slate-800 transition-colors">
                            <span>{item.label}</span><CornerUpRight size={12} className="text-slate-300" />
                          </a>
                        ))}
                      </div>
                      <div className="px-5 pb-6 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => { setUser(null); localStorage.removeItem('modoo-matjip-user'); }}
                          className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                          로그아웃
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2-5. 쇼츠� ???釉 而⑦痢?*/}
              {activeTab === 'planning' && (
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-transparent">
                  {!user ? (
                    <div className="flex flex-col items-center justify-center h-full px-6 gap-0">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center shadow-lg mb-5">
                        <CalendarRange size={28} className="text-white" />
                      </div>
                      <p className="text-[16px] font-extrabold text-slate-800 tracking-tight">로그인이 필요해요</p>
                      <p className="text-[13px] text-slate-400 mt-2 mb-7 text-center leading-relaxed">로그인하시면 맛집 저장, 일정 관리 등 모든 기능을 사용하실 수 있습니다.</p>
                      <div className="w-full flex flex-col gap-2.5">
                        <button onClick={() => handleDirectLogin('google')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span className="flex-1 text-center">Google 계정으로 로그인</span>
                        </button>
                        <button onClick={() => handleDirectLogin('kakao')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#3C1E1E">
                            <path d="M12 3c-5.523 0-10 3.582-10 8c0 2.915 1.91 5.467 4.79 6.853l-1.2 4.41c-.11.41.36.75.72.51l5.22-3.48c.15.01.31.02.47.02 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
                          </svg>
                          <span className="flex-1 text-center">Kakao 계정으로 로그인</span>
                        </button>
                        <button onClick={() => handleDirectLogin('naver')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm">
                          <span className="w-5 h-5 shrink-0 bg-[#03C75A] rounded flex items-center justify-center text-white font-black text-[13px] leading-none">N</span>
                          <span className="flex-1 text-center">Naver 계정으로 로그인</span>
                        </button>
                      </div>
                    </div>
                  ) : !activePlanningItinerary ? (
                    <div className="p-5 flex-1 overflow-y-auto portal-sidebar-scrollbar" style={{ scrollbarWidth: 'none' }}>
                      <ItineraryTabView
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
                        onSelectTab={setActiveTab}
                      />
                    </div>
                  ) : (
                    // ?곗�?ы�?�??2李??釉 ?ъ�?諛 ?댁 ?몃�?몄쇰�?쇼츠� ?몄�湲곕? ?�留?
                    windowWidth >= 768 && (
                      <FloatingItineraryPanel
                        itinerary={activePlanningItinerary}
                        activeDay={planningActiveDay}
                        onActiveDayChange={setPlanningActiveDay}
                        windowWidth={windowWidth}
                        sidebarWidth={sidebarWidth}
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
                            alert('理� ??媛??댁???μ瑜?쇼츠�??異�???二쇱�??');
                            return;
                          }
                          saveLocalItinerary(activePlanningItinerary);
                          window.dispatchEvent(new Event('itinerariesUpdated'));
                          setActiveItinerary(activePlanningItinerary);
                          setActiveItineraryDay(1);
                          setIsPlanningMode(false);
                          setActivePlanningItinerary(null);
                          alert('쇼츠�???깃났?�쇰�???λ?��?��!');
                        }}
                        onClose={() => {
                          if (confirm('?몄� 以�� 쇼츠�??痍⑥?怨� 醫猷?�寃���?源? ??λ吏 ?�? 蹂寃쎌�??? ??�?⑸??')) {
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
                            if (!activePlanningItinerary) return null;
                            const dayData = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay);
                            const dayItems = dayData?.items || [];
                            if (selectedPlanningItemId) {
                              return dayItems.find((it: any) => it.id === selectedPlanningItemId) || dayItems[0];
                            }
                            return dayItems[0];
                          })();

                          if (!currentPlanningItem) return [];

                          return nearRouteRestaurants.map(restaurant => {
                            const distance = currentPlanningItem 
                              ? getDistance(currentPlanningItem.lat, currentPlanningItem.lng, restaurant.lat, restaurant.lng) 
                              : 0;
                            return {
                              restaurant,
                              distance,
                              type: 'near' as const
                            };
                          });
                        })()}
                        onAddRecommendedRestaurant={(res) => {
                          insertRestaurantToPlanningRoute(res);
                          alert(`${res.name} 留吏??理� 寃쎈� 以媛??寃쎌�吏濡?異�??��?��`);
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
                           alert(`${res.name} 맛집이 경로에 추가되었습니다.`);
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
                           alert(`${place.place_name} 장소를 일정 코스에 추가했습니다.`);
                        }}
                        favorites={favorites}
                        restaurants={restaurants}
                        onUpdateItinerary={(updated) => setActivePlanningItinerary(updated)}
                        onResetCustomWaypoints={() => {
                          setCustomWaypoints({});
                           alert('경로 탐색 실패로 인해 직선 경로로 복구되었습니다.');
                        }}
                        isInline={true}
                        isSearchingMode={isPlanningSearchActive}
                        onSearchingModeChange={setIsPlanningSearchActive}
                      />
                    )
                  )}
                </div>
              )}
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ?�� ?�� ?蹂� 移대 (?곗�?ы flex flow / 紐⑤�??bottom overlay) */}
      <RestaurantInfoCard 
        restaurant={isAreaDrawingMode ? null : selectedRestaurant} 
        onClose={() => handleSelectRestaurant(null)} 
        isSidebarCollapsed={isSidebarCollapsed || hideDefaultSidebar}
        windowWidth={windowWidth}
        sidebarWidth={sidebarWidth}
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

      {/* ?湲�/쇼츠�湲?????w-0 flex ?��?? 留�?留??⑤ ?곗륫 寃쎄�???�� 遺李?*/}
      <div className="hidden md:block relative w-0 shrink-0 z-50">
        <button
          onClick={() => {
            if (selectedRestaurant) {
              handleSelectRestaurant(null);
            } else {
              setIsSidebarCollapsed(!isSidebarCollapsed);
            }
          }}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[18px] h-16 bg-white rounded-r-2xl flex items-center justify-center shadow-[4px_0_12px_rgba(0,0,0,0.12)] border-y border-r border-slate-200/80 cursor-pointer hover:bg-orange-50 hover:border-orange-300/40 transition-all duration-200 group"
        >
          {isSidebarCollapsed && !selectedRestaurant
            ? <ChevronRight size={13} strokeWidth={3} className="text-[#ff6b00] group-hover:scale-110 transition-transform" />
            : <ChevronLeft size={13} strokeWidth={3} className="text-[#ff6b00] group-hover:scale-110 transition-transform" />
          }
        </button>
      </div>

      {/* ========================================================
          3. ?곗륫 硫�� ??(?�⑤�?+ 硫�� 肄�痢??��)
          ======================================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* ========================================================
            硫�� 肄�痢??��??(吏???� ??� ?�� ??蹂�??酉?
            ======================================================== */}
        <div className="flex-1 relative overflow-hidden bg-slate-50">
          



      {/* ?ㅼ� 吏???�留??�� (?留 ?�� 寃⑸━ ?��) */}
      <div 
        ref={mapContainerRef}
        onMouseDown={handleContainerMouseDown}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={handleContainerMouseUp}
        onTouchStart={handleContainerTouchStart}
        onTouchMove={handleContainerTouchMove}
        onTouchEnd={handleContainerMouseUp}
        className={`absolute inset-0 w-full h-full transition-colors duration-700 ${mapTheme}`}
      >

        <Map
          key="place-map-v2"
          center={mapCenter}
          level={zoomLevel}
          style={{ width: '100%', height: '100%' }}
          onCreate={setMap}
          draggable={!isAreaDrawingMode}
          disableDoubleClickZoom={isAreaDrawingMode}
          onClick={() => {
            if (!isAreaDrawingMode) {
              setSelectedRestaurant(null);
              setSelectedCluster(null);
            }
          }}
          isPanto={true}
          onDragEnd={handleMapDragEnd}
          onZoomChanged={handleMapZoomChanged}
        >

        {/* 4李?湲고: ?�� ?洹몃�??ㅼ媛?沅ㅼ�(Polyline) ?�留?*/}
        {isAreaDrawingMode && drawingPoints.length > 1 && (
          <Polyline
            path={drawingPoints}
            strokeWeight={4}
            strokeColor="#FF6F00"
            strokeOpacity={0.85}
            strokeStyle="solid"
          />
        )}

        {/* 4李?湲고: ?� ?ㅻ ?④낵 ?��?????媛 ?쇰諛깆� ?ロ ?� 硫??�留?*/}
        {isAreaDrawingMode && drawingPoints.length > 2 && isSnapActive && (
          <Polygon
            path={[...drawingPoints, drawingPoints[0]]}
            strokeWeight={0}
            fillColor="#FF6F00"
            fillOpacity={0.25}
          />
        )}




        {/* 3李?湲고: ?ㅼ媛?쇼츠� ?濡??寃쎈� 踰�� ?ㅺ�??Polygon) ?�留?*/}
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

        {/* 3李?湲고: OSRM ?ㅼ� ?濡留?寃쎈� 諛??�洹?議곗�???�留?*/}
        {isPlanningMode && activePlanningItinerary && (() => {
          const dayItems = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay)?.items || [];
          if (dayItems.length < 2) return null;

          // OSRM 寃쎈� ?멸렇癒쇳�?ㅼ� 議댁�?硫� ?ㅼ� ?濡留�쇰�??�留?
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
                      {/* OSRM ?멸렇癒쇳� 寃쎈�??*/}
                      <Polyline
                        path={seg.coordinates}
                        strokeWeight={5}
                        strokeColor="#ef4444"
                        strokeOpacity={0.85}
                        strokeStyle="solid"
                      />

                      {/* ?�洹명 Snap-to-Road 寃쎈� 議곗�??*/}
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
                        title={`${seg.ptB.name} 媛??寃쎈� 議곗�??(?�洹명???�??怨⑤ぉ湲몃� 寃쎈� ?�)`}
                      />
                    </div>
                  );
                })}
              </>
            );
          }

          // OSRM??濡�?湲� ?��???�� ?� ?⑥ 吏�� ?대갚
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

        {/* 3李?湲고: ?ㅼ媛?쇼츠� ?濡??쇼츠감蹂??ㅽ ?� 留而� */}
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

        {/* ?��?� 쇼츠�??寃쎈�??Polyline) 諛?쇼츠감蹂??� 留而� */}
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

                {/* 留吏 ?/留而� ?대�?ㅽ곕�??�� */}
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
            clickable={!isAreaDrawingMode}
            yAnchor={1} // ???瑗щ━媛 留而� ?移???ㅻ�濡?(?�� ?��)
            zIndex={mapHoveredRestaurantId === restaurant.id ? 100 : (selectedRestaurant?.id === restaurant.id ? 50 : (effectiveHoveredId === restaurant.id ? 30 : 10))}
          >
            <div 
              onClick={() => {
                if (isAreaDrawingMode) return;
                handleSelectRestaurant(restaurant);
                map?.panTo(new kakao.maps.LatLng(restaurant.lat, restaurant.lng));
              }} 
              onMouseEnter={() => {
                if (isAreaDrawingMode) return;
                setMapHoveredRestaurantId(restaurant.id);
              }}
              onMouseLeave={() => {
                if (isAreaDrawingMode) return;
                setMapHoveredRestaurantId(null);
              }}
              draggable={isPlanningMode && !isAreaDrawingMode}
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

              {/* 留而� 吏� ?몃�(Hover) ???��???��?� 珥�由щ????명��?��??留�??移대 */}
              {mapHoveredRestaurantId === restaurant.id && (() => {
                const bestVid = getBestVideo(restaurant.videos);
                return (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 w-[280px] rounded-3xl bg-zinc-900/95 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col select-none z-[120] text-left overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                  >
                    {/* ?????κ렐 洹몃�?곗�???�由?*/}
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

                    {/* ?�� ?��???�� 瑗щ━ */}
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
                            e.stopPropagation(); // 移대 ?대� ?� 李⑤�
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
                              議고??{formatViewCount(bestVid.view_count)}??
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md shrink-0">
                            議고??0??
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
        {/* ???移 留而� */}
        {userLocation && (
          <CustomOverlayMap
            position={userLocation}
            zIndex={99}
            xAnchor={0.5}
            yAnchor={0.5}
          >
            <div className="relative flex items-center justify-center w-8 h-8 animate-none">
              {/* 諛⑺� 鍮?(?移⑤�?諛⑺� 媛��媛 議댁�?????�留? */}
              {userHeading !== null && (
                <div 
                  className="absolute pointer-events-none transition-transform duration-150 ease-out z-0"
                  style={{ 
                    transform: `rotate(${userHeading}deg)`, 
                    transformOrigin: 'center center',
                    width: '80px',
                    height: '80px',
                    top: '-24px',
                    left: '-24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="dir-beam" x1="0.5" y1="1" x2="0.5" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* 遺梨瑗� ?� ?�쇨�?諛⑺� 媛?대 */}
                    <path d="M 40 40 L 25 14 A 30 30 0 0 1 55 14 Z" fill="url(#dir-beam)" />
                    {/* 吏� 諛⑺� ?쇨� ?��??*/}
                    <path d="M 40 22 L 36 27 H 44 Z" fill="#2563eb" opacity="0.9" />
                  </svg>
                </div>
              )}
              <div className="locate-pulse-ring z-10" />
              <div className="locate-dot z-20" />
            </div>
          </CustomOverlayMap>
        )}
        </MarkerClusterer>
        </Map>
      </div>

      {/* ?곗륫 ?�� ?由щ�� ?≪ 踰�� (FAB) 洹몃９ (?? ?몄� ?몃� ?�� 援ъ“) */}
      <div className={`absolute right-4 z-20 flex flex-col items-end gap-2.5 transition-all duration-300 ${!selectedRestaurant ? 'bottom-[140px]' : 'bottom-10'}`}>
        
        {/* 留吏 ?蹂� */}
        <div className="flex items-center gap-2 group">
            <span className="text-[12px] font-semibold text-white bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-white/5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">맛집 제보</span>
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

        {/* 쇼츠� 留�ㅺ�?*/}
        <div className="flex items-center gap-2 group">
            <span className="text-[12px] font-semibold text-white bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-white/5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">일정 만들기</span>
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

        {/* ?ㅻ 萸癒뱀� (?�� 戮湲�) */}
        <div className="flex items-center gap-2 group">
            <span className="text-[12px] font-semibold text-white bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-white/5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">오늘 뭐 먹지?</span>
          <button
            onClick={pickRandomRestaurant}
            className="p-3 bg-zinc-900 text-orange-500 hover:text-orange-400 rounded-full border border-white/10 hover:border-orange-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
          title="오늘 뭐 먹지?"
          >
            <Dices size={18} />
          </button>
        </div>

        {/* ???移 */}
        <div className="flex items-center gap-2 group">
            <span className="text-[12px] font-semibold text-white bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-white/5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">내 위치</span>
          <button
            onClick={moveToCurrentLocation}
            className={`p-3 rounded-full border hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer ${
              shouldPanToUser
                ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                : "bg-zinc-900 text-orange-500 hover:text-orange-400 border-white/10 hover:border-orange-500/30"
            }`}
          title="내 위치로 이동"
          >
            <Locate size={18} className={isLocating ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ?�� 洹몃━湲?而⑦몃�?諛곕 */}
      <AnimatePresence>
        {(isAreaDrawingMode || (filterPolygon && filterPolygon.length >= 3)) && (
          <motion.div
            initial={{ y: -56, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -56, opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="absolute top-4 left-0 right-0 mx-auto w-fit z-50"
          >
            {isAreaDrawingMode ? (
              /* ?? 洹몃━湲?以? ?� 洹몃�?곗�???�由?+ ??移대 ?? */
              <div className="relative p-[2px] rounded-2xl overflow-hidden">
                {/* ?�?� 肄� 洹몃�?곗�???�由?*/}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: 'conic-gradient(from 0deg, #ef4444, #f97316, #fbbf24, #f97316, #ef4444)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                />
                {/* 移대 蹂몄껜 */}
                <div className="relative z-10 flex items-center gap-3 px-4 py-2.5 bg-white rounded-[14px]">
                  {/* 源鍮�?대 REC ?�� */}
                  <motion.div
                    className="w-2 h-2 rounded-full bg-red-500 shrink-0"
                    animate={{ opacity: [1, 0.2, 1], scale: [1, 0.7, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-extrabold text-slate-800 tracking-tight">그리기 모드</span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {drawingPoints.length > 0 ? (
                        <span>
            좌표 <span className="text-orange-500 font-bold">{drawingPoints.length}</span>개 수집됨
                          {isSnapActive && <span className="text-orange-500 font-bold ml-1 animate-pulse"> 쨌 ?ㅻ!</span>}
                        </span>
                      ) : (
            '마우스나 손가락으로 지도 위에 영역을 그려보세요'
                      )}
                    </span>
                  </div>
                  <button
                    onClick={clearAreaFilter}
                    className="ml-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 text-[11px] font-semibold transition-colors active:scale-95 cursor-pointer shrink-0"
                  >
            취소
                  </button>
                </div>
              </div>
            ) : (
              /* ?? ?�� 寃곌낵: 洹몃�?곗�??諛곌꼍 移대 ?? */
              <motion.div
                className="relative flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)' }}
                animate={{
                  boxShadow: [
                    '0 4px 20px rgba(239,68,68,0.30)',
                    '0 6px 28px rgba(249,115,22,0.50)',
                    '0 4px 20px rgba(239,68,68,0.30)',
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* 諛곌꼍 愿� */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18)_0%,transparent_60%)] pointer-events-none" />

                {/* 媛� 諭�? */}
                <div className="relative flex items-baseline gap-0.5 shrink-0">
                  <span className="text-[22px] font-black text-white leading-none tracking-tight">{filteredRestaurants.length}</span>
                  <span className="text-[11px] font-semibold text-white/80 mb-0.5">개</span>
                </div>

                {/* 援щ�??*/}
                <div className="w-px h-7 bg-white/25 shrink-0" />

                {/* ?쇰꺼 */}
                <div className="flex flex-col leading-tight">
                  <span className="text-[12px] font-extrabold text-white tracking-tight">맛집 발견</span>
                  <span className="text-[10px] text-white/70 font-medium">영역 필터 적용 중</span>
                </div>

                {/* ?댁� 踰�� */}
                <button
                  onClick={clearAreaFilter}
                  className="relative ml-1 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold transition-colors active:scale-95 cursor-pointer shrink-0 border border-white/20"
                >
                  <X size={10} className="stroke-[2.5]" /> 해제
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ???щ�?대 ??(?대�?ㅽ� ?대┃ ???곗�?ы/紐⑤�??怨듯� ?濡???�) */}
      <AnimatePresence>
        {!isAreaDrawingMode && !selectedRestaurant && selectedCluster && selectedCluster.length > 0 && (
          <motion.div 
            initial={{ y: 150, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 150, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-8 md:translate-x-0 w-full max-w-sm z-30 px-4 flex flex-col items-center select-none"
          >
            <div className="w-full bg-[#18181b]/80 backdrop-blur-xl border border-white/10 rounded-[28px] p-4 shadow-[0_24px_50px_rgba(0,0,0,0.5)]">
              {/* ?ㅻ */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[12px] font-black text-white/90 tracking-tight flex items-center gap-1.5">
              선택한 지역의 맛집 핫플 <span className="text-brand-orange-light">{selectedCluster.length}곳</span>
                </span>
                <button 
                  onClick={() => setSelectedCluster(null)}
                  className="p-1 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 transition-colors cursor-pointer"
            title="닫기"
                >
                  <X size={12} className="stroke-[2.5]" />
                </button>
              </div>

              {/* Swiper 媛濡??щ�?대 */}
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



      {/* 紐⑤�????而⑦痢??ㅻ�?�� 諛�??�� (planning留??ㅻ�?�� ?ъ�) */}
      <OverlayContainer activeTab={activeTab} onClose={() => setActiveTab('home')}>
        {activeTab === 'planning' && (
          <ItineraryTabView
            onOpenItineraryPlanner={(itinerary) => {
              if (itinerary) {
                setEditingItinerary(itinerary);
                setActivePlanningItinerary(itinerary);
                setPlanningActiveDay(1);
                setIsPlanningMode(true);
                setActiveTab('home');
              } else {
                setNewItineraryTitle('');
                setNewItineraryStartDate('');
                setNewItineraryEndDate('');
                setShowInitPlanningModal(true);
              }
            }}
            onSelectTab={setActiveTab}
          />
        )}
      </OverlayContainer>

      {/* 吏????쇼츠� 而⑦몃�??濡??諛?*/}
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
                title="일정 진행 종료"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 紐⑤�???�� ?대�寃��???ㅻ�????� */}
      {!isAreaDrawingMode && !filterPolygon && (
        <BottomTabBar activeTab={activeTab} onChangeTab={setActiveTab} />
      )}


      {/* ?留???ロ ?蹂�?湲� 諛�??�� */}
      <RestaurantSubmissionBottomSheet 
        isOpen={isSubmissionOpen} 
        onClose={() => {
          setIsSubmissionOpen(false);
          setSubmissionTarget(null);
        }} 
        initialRestaurant={submissionTarget}
      />

      {/* SNS 濡洹�???��� 紐⑤� */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(mockUser) => {
          setUser(mockUser);
          localStorage.setItem('modoo-matjip-user', JSON.stringify(mockUser));
        }}
      />

      {/* 誘몄 쇼츠� 怨�?湲� 諛�??�� */}
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

      {/* 3李?湲고: 吏???濡?�� ?濡???⑤ */}
      <AnimatePresence>
        {isPlanningMode && activePlanningItinerary && windowWidth < 768 && (
          <FloatingItineraryPanel
            itinerary={activePlanningItinerary}
            activeDay={planningActiveDay}
            onActiveDayChange={setPlanningActiveDay}
            windowWidth={windowWidth}
            sidebarWidth={sidebarWidth}
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
      alert('최소 2개 이상의 장소를 일정에 추가해 주세요.');
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
    if (confirm('진행 중인 일정을 취소하고 종료하시겠습니까? 저장되지 않은 변경사항은 삭제됩니다.')) {
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
      alert(`${res.name} 맛집을 최적 경로 중간에 경유지로 추가했습니다.`);
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
      alert(`${res.name} 맛집이 경로에 추가되었습니다.`);
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
      alert(`${place.place_name} 장소를 일정 코스에 추가했습니다.`);
            }}
            favorites={favorites}
            restaurants={restaurants}
            onUpdateItinerary={(updated) => setActivePlanningItinerary(updated)}
            onResetCustomWaypoints={() => {
              setCustomWaypoints({});
      alert('경로 탐색 실패로 인해 직선 경로로 복구되었습니다.');
            }}
          />
        )}
      </AnimatePresence>

      {/* 3李?湲고: ?�� 硫紐� 諛??媛 ?몄� ?釉 紐⑤� */}
      <CustomModal isOpen={showMemoModal} onClose={() => setShowMemoModal(false)}>
        <div className="p-5 text-white bg-zinc-950 border border-white/10 rounded-3xl flex flex-col gap-4">
          <div className="pb-3 border-b border-white/5 flex justify-between items-center">
            <div>
            <h4 className="text-sm font-bold text-zinc-200">시간/메모 추가 및 변경</h4>
              {editingItemForMemo && (
                <p className="text-[10px] text-orange-400 font-semibold mt-0.5">{editingItemForMemo.name}</p>
              )}
            </div>
            <button onClick={() => setShowMemoModal(false)} className="text-zinc-500 hover:text-zinc-300">닫기</button>
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
            <label className="text-[10px] text-zinc-500 font-bold uppercase">일정 메모</label>
            <textarea
            placeholder="예: 도보 이동 5분..."
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

      {/* ?�洹 쇼츠� ?�� ?蹂� ?ㅼ� 紐⑤� (罹由�??湲곌� 諛??紐� ?ㅼ�) */}
      <CustomModal 
        isOpen={showInitPlanningModal} 
        onClose={() => setShowInitPlanningModal(false)}
          title="여행 일정 생성"
          subtitle="일정에 따른 맛집 정보를 안내해 드립니다."
      >
        <div className="flex flex-col gap-4 w-full text-white">
          {/* 쇼츠� ?紐� 紐移� ?�� */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">여행 제목 (일정 명칭)</label>
            <input
              type="text"
            placeholder="예: 부산 2박 3일 미식여행"
              value={newItineraryTitle}
              onChange={e => setNewItineraryTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
            />
          </div>

          {/* ?щ�� ?�몄� ?�� 而댄��?�� (???⑥ ?щ�?대 ?� 諛??由щ�� 罹≪ ?④낵) */}
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

          {/* 異�? ?���???蹂� ?�� ?몄 */}
          <div className="space-y-3 pt-1">
            {/* 1. ?�??*/}
            <div className="space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">누구와 가시나요?</span>
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

            {/* 2. ?留 */}
            <div className="space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">여행 테마/스타일</span>
              <div className="flex gap-1.5 flex-wrap">
                {['맛집 탐방', '여유로운 힐링', '명소 관광'].map(item => (
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

            {/* 3. ?대� ?�� */}
            <div className="space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">이동 수단</span>
              <div className="flex gap-1.5 flex-wrap">
                {['자차/렌터카', '대중교통/도보', '혼합(자차+도보)'].map(item => (
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

          {/* ?�� 理醫 ?깅� ?⑥� */}
          <button
            onClick={handleStartNewPlanning}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-[0.98] text-[11px] font-black text-white shadow-lg shadow-red-500/20 transition-all flex items-center justify-center cursor-pointer border border-white/10"
          >
            일정 생성
          </button>
        </div>
      </CustomModal>

      {/* ?��釉?鍮�???�?댁� 紐⑤� */}
      <AnimatePresence>
        {playingYoutubeId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10"
            >
              {/* Close Button */}
              <button
                onClick={() => setPlayingYoutubeId(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center transition-colors cursor-pointer z-50"
              >
                <X size={20} />
              </button>
              
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${playingYoutubeId}?autoplay=1&rel=0`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </div>
      </div>
    </div>
  );
}


