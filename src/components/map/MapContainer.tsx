'use client';

const INITIAL_CENTER = { lat: 37.5665, lng: 126.9780 };
const INITIAL_LEVEL = 5;

import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Map, CustomOverlayMap, MapMarker, MarkerClusterer, Polygon, Polyline, Circle, useKakaoLoader } from 'react-kakao-maps-sdk';

import { supabase } from '@/lib/supabase/client';
import { Restaurant, ItineraryItem, Itinerary, UserFolder, FolderRestaurantRelation } from '@/types';
import { getUserFolders, getAllUserFolderRelations, getOrCreateDefaultFolder, addRestaurantToFolder, removeRestaurantFromFolder } from '@/lib/supabase/folders';
import { MapBounds } from '@/hooks/useMapBounds';
import RestaurantInfoCard from '@/components/ui/RestaurantInfoCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Locate, Dices, Flame, Play, MapPin, Utensils, Heart, Star, Home, User, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, List, X, Calendar, Search, Plus, MapPinPlus, CalendarRange, Eye, Pentagon, PenTool, ShoppingBag, Bell, CornerUpRight, ArrowUpDown, PlayCircle } from 'lucide-react';
import { MichelinIcon } from '@/components/icons/CustomIcons';
import { Swiper, SwiperSlide } from 'swiper/react';
import NearHotplacesView from '@/components/ui/NearHotplacesView';
import SavedListView from '@/components/ui/SavedListView';
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
import RandomDrawModal from '@/components/game/RandomDrawModal';
import BalanceGameModal from '@/components/game/BalanceGameModal';

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
    {/* 중앙 원 */}
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    {/* 근거리 원 */}
    <path d="M9.5 14.5a3.5 3.5 0 0 1 0-5" />
    <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" />
    {/* 중거리 원 */}
    <path d="M7.2 16.8a7 7 0 0 1 0-9.6" />
    <path d="M16.8 7.2a7 7 0 0 1 0 9.6" />
    {/* 장거리 원 */}
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
    return `${main} > ${sub}`;
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
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1).replace('.0', '')}만`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace('.0', '')}천`;
  }
  return count.toLocaleString();
};

// 영상 업로드일 상대 표기 (카드 메타용 · 축약형)
const formatRelativeTime = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const diffDay = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDay < 1) return '오늘';
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}개월 전`;
  return `${Math.floor(diffDay / 365)}년 전`;
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

// 홈 테마 큐레이션 — 각 테마는 맛집을 판별하는 match 술어를 가진다 (기존 content_tags·구독자수·카테고리 재사용)
const CURATIONS: { key: string; label: string; emoji: string; grad: string; match: (r: Restaurant) => boolean }[] = [
  { key: 'hot',       label: '지금 핫한',     emoji: '🔥', grad: 'linear-gradient(150deg,#FF3B30,#B00020)', match: (r) => (getBestVideo(r.videos)?.view_count || 0) >= 500000 },
  { key: 'bigtuber',  label: '10만+ 유튜버',  emoji: '📺', grad: 'linear-gradient(150deg,#FF0000,#B00000)', match: (r) => !!r.videos?.some(v => (v.youtuber?.subscriber_count ?? 0) >= 100000) },
  { key: 'michelin',  label: '미쉐린·블루리본', emoji: '⭐', grad: 'linear-gradient(150deg,#E4002B,#7A0019)', match: (r) => !!r.content_tags?.some(t => t.source === 'michelin' || t.source === 'blueribbon') },
  { key: 'ddoganjib', label: '또간집·먹을텐데', emoji: '🔁', grad: 'linear-gradient(150deg,#FF9E40,#FF6F00)', match: (r) => !!r.content_tags?.some(t => t.source === 'ddoganjib' || t.source === 'meogeultende') },
  { key: 'night',     label: '심야 맛집',     emoji: '🌙', grad: 'linear-gradient(150deg,#4338CA,#6D28D9)', match: (r) => /술집|주점|포차|이자카야|펍|호프/.test(r.category || '') || /포차|야식|심야|24시/.test(r.name || '') },
];

// 맛집에 등장한 서로 다른 유튜버 목록 (중복 제거) — 다중 아바타 스택용
const getUniqueYoutubers = (r: Restaurant): { name: string; profile_image: string }[] => {
  const seen = new Set<string>();
  const out: { name: string; profile_image: string }[] = [];
  (r.videos || []).forEach((v) => {
    const y = v.youtuber;
    if (!y) return;
    const key = y.id || y.name;
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ name: y.name, profile_image: y.profile_image });
  });
  return out;
};

// 권위 뱃지 매핑 (미쉐린·블루리본·또간집 등) — content_tags.source 기준
const AUTH_BADGES: Record<string, { short: string; bg: string }> = {
  michelin:     { short: '미쉐린',    bg: '#E4002B' },
  blueribbon:   { short: '블루리본',  bg: '#1D4ED8' },
  ddoganjib:    { short: '또간집',    bg: '#FF6F00' },
  meogeultende: { short: '먹을텐데',  bg: '#7C3AED' },
  netflix_chef: { short: '흑백요리사', bg: '#E50914' },
  tv_broadcast: { short: 'TV출연',    bg: '#334155' },
};
const getAuthorityBadges = (r: Restaurant): { short: string; bg: string }[] => {
  const seen = new Set<string>();
  const out: { short: string; bg: string }[] = [];
  (r.content_tags || []).forEach((t) => {
    const b = AUTH_BADGES[t.source];
    if (!b || seen.has(t.source)) return;
    seen.add(t.source);
    out.push(b);
  });
  return out.slice(0, 2);
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
  const [dropdownAnchor, setDropdownAnchor] = useState<{ top: number; left?: number; right?: number } | null>(null);
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
  const [selectedShoppingVideoId, setSelectedShoppingVideoId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(INITIAL_CENTER);

  // Geolocation states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [shouldPanToUser, setShouldPanToUser] = useState<boolean>(false);

  // 지도 중심 변경 시 Geocoder로 현재 지역명 감지
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

  // 탭 전환 시 드롭다운 닫기 등 상태 처리
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [desktopView, setDesktopView] = useState<'list' | 'mypage'>('list');
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
  const [submissionTarget, setSubmissionTarget] = useState<{id: string, name: string} | null>(null);
  const [user, setUser] = useState<{ id?: string; name: string; email: string; provider: 'kakao' | 'google' | 'naver'; avatarUrl?: string } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [userFolders, setUserFolders] = useState<UserFolder[]>([]);
  const [folderRelations, setFolderRelations] = useState<FolderRestaurantRelation[]>([]);
  const [defaultFolderId, setDefaultFolderId] = useState<string>('');

  // 저장된 맛집 id 집합 (별 버튼 활성 여부 판단)
  const savedIds = useMemo(
    () => new Set(folderRelations.map(fr => fr.restaurant_id)),
    [folderRelations]
  );
  // 방문완료한 맛집 id 집합 (내 저장 지도 색 구분)
  const visitedIds = useMemo(
    () => new Set(folderRelations.filter(fr => fr.visited).map(fr => fr.restaurant_id)),
    [folderRelations]
  );
  // 내 저장 지도 모드 (저장 탭에서 지도에 저장 맛집만 표시)
  const [savedMapMode, setSavedMapMode] = useState(false);
  const [savedStatusFilter, setSavedStatusFilter] = useState<'all' | 'wish' | 'visited'>('all');

  // 폴더 및 매핑 관계 데이터 리로드 함수 (기본 저장 폴더 보장 포함)
  const fetchFoldersAndRelations = async () => {
    if (!user || !user.id) {
      setUserFolders([]);
      setFolderRelations([]);
      setDefaultFolderId('');
      return;
    }
    try {
      const defaultFolder = await getOrCreateDefaultFolder();
      setDefaultFolderId(defaultFolder.id);
      const foldersData = await getUserFolders();
      const relationsData = await getAllUserFolderRelations();
      setUserFolders(foldersData);
      setFolderRelations(relationsData);
    } catch (err: any) {
      console.error('Failed to fetch folders/relations:', err);
      // JWT cryptographic or other auth-related errors indicate an expired/invalid token in localStorage.
      // Sign out to clear the corrupted token, reset user state to prompt re-login.
      if (err?.message?.includes('JWT') || err?.message?.includes('cryptographic') || err?.message?.includes('Authentication')) {
        console.warn('Invalid JWT session detected. Resetting Supabase session...');
        try {
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.error('Failed to sign out from Supabase:', signOutErr);
        }
        setUser(null);
        localStorage.removeItem('modoo-matjip-user');
      }
    }
  };

  // 별(저장) 토글 — 어디서든 호출되는 공용 핸들러. 기본 저장 폴더에 추가/제거.
  const toggleSave = async (restaurantId: string) => {
    if (!user?.id) {
      setIsLoginModalOpen(true); // 로그아웃 시 로그인 유도
      return;
    }
    
    let folderId = defaultFolderId;
    if (!folderId) {
      try {
        const defaultFolder = await getOrCreateDefaultFolder();
        folderId = defaultFolder.id;
        setDefaultFolderId(folderId);
      } catch (err) {
        console.error('Failed to get/create default folder:', err);
        return;
      }
    }

    try {
      if (savedIds.has(restaurantId)) {
        await removeRestaurantFromFolder(folderId, restaurantId);
      } else {
        await addRestaurantToFolder(folderId, restaurantId, '', []);
      }
      await fetchFoldersAndRelations();
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  useEffect(() => {
    fetchFoldersAndRelations();
  }, [user]);

  const handleDirectLogin = async (provider: 'kakao' | 'google' | 'naver') => {
    const mockUsers = {
      kakao: { name: '맛집탐험가 카카오', email: 'kakao_user@kakao.com', provider: 'kakao' as const, avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' },
      google: { name: '구글 마스터 맛집', email: 'google_user@gmail.com', provider: 'google' as const, avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150' },
      naver: { name: '네이버 미식 전문가', email: 'naver_user@naver.com', provider: 'naver' as const, avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
    };
    const mockUser = mockUsers[provider];

    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      if (authData.user) {
        // 프로필 테이블 생성/갱신
        await supabase
          .from('users')
          .upsert({
            id: authData.user.id,
            nickname: mockUser.name,
            avatar_url: mockUser.avatarUrl
          });

        const loggedInUser = {
          ...mockUser,
          id: authData.user.id
        };
        setUser(loggedInUser);
        localStorage.setItem('modoo-matjip-user', JSON.stringify(loggedInUser));
      }
    } catch (err) {
      console.error('Direct login error, falling back to mock UUID:', err);
      const loggedInUser = {
        ...mockUser,
        id: '00000000-0000-0000-0000-000000000000'
      };
      setUser(loggedInUser);
      localStorage.setItem('modoo-matjip-user', JSON.stringify(loggedInUser));
    }
  };
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isSearchExpanded = isSearchFocused || globalSearchQuery.trim() !== '';
  const [isItineraryPlannerOpen, setIsItineraryPlannerOpen] = useState(false);
  const [editingItinerary, setEditingItinerary] = useState<any>(null);
  const [activeItinerary, setActiveItinerary] = useState<any>(null);
  const [activeItineraryDay, setActiveItineraryDay] = useState<number>(1);
  // 3단계: 일정 계획 관련 상태
  const [isPlanningMode, setIsPlanningMode] = useState<boolean>(false);
  const [activePlanningItinerary, setActivePlanningItinerary] = useState<any>(null);
  const [isPlanningSearchActive, setIsPlanningSearchActive] = useState<boolean>(false);
  const [planningActiveDay, setPlanningActiveDay] = useState<number>(1);
  const [editingItemForMemo, setEditingItemForMemo] = useState<any>(null); // 메모 편집 대상 아이템
  const [showMemoModal, setShowMemoModal] = useState<boolean>(false);
  const [inputVisitTime, setInputVisitTime] = useState<string>('');
  const [inputMemo, setInputMemo] = useState<string>('');
  // 3단계 확장: 일정 장소 검색 및 경로 1km 버퍼 관련 상태
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedPlanningItemId, setSelectedPlanningItemId] = useState<string | null>(null);
  const [recommendedRestaurantsForSelectedSpot, setRecommendedRestaurantsForSelectedSpot] = useState<{ restaurant: Restaurant; distance: number; type: 'near' | 'on_the_way' }[]>([]);
  // OSRM 경로 좌표 및 경유지 관련 상태 (각 세그먼트 좌표 배열 포함)
  const [planningRouteCoordinates, setPlanningRouteCoordinates] = useState<any[]>([]);
  const [customWaypoints, setCustomWaypoints] = useState<Record<string, { lat: number; lng: number }>>({});
  const [activeRouteCoordinates, setActiveRouteCoordinates] = useState<{ lat: number; lng: number }[][]>([]);
  const [nearRouteRestaurants, setNearRouteRestaurants] = useState<Restaurant[]>([]);

  // 새 일정 생성 모달 및 제목/날짜 관련 상태
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
  // 홈 테마 큐레이션 레일 (미쉐린·또간집·10만+ 유튜버·심야 등) 활성 테마
  const [activeCuration, setActiveCuration] = useState<string | null>(null);

  // 날씨 및 상황별 추천 테마 칩 상태
  type WeatherState = 'sunny' | 'rainy' | 'hot' | 'cold';
  const [weatherState, setWeatherState] = useState<WeatherState>('sunny');
  const [weatherInfo, setWeatherInfo] = useState<{ temp: number; code: number } | null>(null);
  const [curationData, setCurationData] = useState<{ vibeKeywords: any[]; weatherKeywords: any[] } | null>(null);
  const [isCurationLoading, setIsCurationLoading] = useState<boolean>(false);
  const [activeThemeChip, setActiveThemeChip] = useState<{ name: string; value: string } | null>(null);

  // 반응형 레이아웃 계산을 위한 윈도우 너비 상태
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

  // 실시간 날씨 데이터 동기화
  useEffect(() => {
    let isMounted = true;
    if (!mapCenter.lat || !mapCenter.lng) return;

    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${mapCenter.lat}&longitude=${mapCenter.lng}&current_weather=true`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted || !data.current_weather) return;

        const info = data.current_weather;
        const code = info.weathercode;
        const temp = info.temperature;

        let state: WeatherState = 'sunny';
        if (temp <= 5) {
          state = 'cold';
        } else if (temp >= 30) {
          state = 'hot';
        } else if ([51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99].includes(code)) {
          state = 'rainy';
        } else {
          state = 'sunny';
        }

        setWeatherState(state);
        setWeatherInfo({ temp, code });
      } catch (err) {
        console.warn("[Weather API] Failed to sync real-time weather:", err);
      }
    };

    const timer = setTimeout(fetchWeather, 600);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [mapCenter.lat, mapCenter.lng]);

  // 실시간 AI 큐레이션 API 연동 (지역 + 날씨 변경 시 트리거)
  const getTimeOfDay = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 11) return 'morning';
    if (hours >= 11 && hours < 17) return 'lunch';
    return 'dinner';
  };

  useEffect(() => {
    let isMounted = true;
    const fetchCuration = async () => {
      setIsCurationLoading(true);
      try {
        const timeOfDay = getTimeOfDay();
        const url = `/api/curation/trending?region=${encodeURIComponent(currentRegion)}&weather=${weatherState}&timeOfDay=${timeOfDay}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        
        if (!isMounted) return;
        if (data.vibeKeywords && data.weatherKeywords) {
          setCurationData(data);
        }
      } catch (err) {
        console.warn("[Curation API] Failed to sync AI curation:", err);
      } finally {
        if (isMounted) setIsCurationLoading(false);
      }
    };

    fetchCuration();
    return () => {
      isMounted = false;
    };
  }, [currentRegion, weatherState]);

  // 키워드 매칭 이모지 헬퍼 함수
  const getEmojiForKeyword = (val: string, type: 'vibe' | 'weather') => {
    const valClean = val.trim();
    if (valClean.includes('삼겹살') || valClean.includes('갈비') || valClean.includes('고기') || valClean.includes('육류')) return '🥩';
    if (valClean.includes('국물') || valClean.includes('전골') || valClean.includes('찌개') || valClean.includes('샤브')) return '🍲';
    if (valClean.includes('국밥') || valClean.includes('탕') || valClean.includes('설렁탕')) return '🍲';
    if (valClean.includes('냉면') || valClean.includes('소바') || valClean.includes('밀면')) return '🍜';
    if (valClean.includes('라면') || valClean.includes('우동') || valClean.includes('국수') || valClean.includes('칼국수')) return '🍜';
    if (valClean.includes('야장') || valClean.includes('테라스') || valClean.includes('루프탑') || valClean.includes('야외')) return '⛺';
    if (valClean.includes('카페') || valClean.includes('커피') || valClean.includes('디저트') || valClean.includes('베이커리')) return '☕';
    if (valClean.includes('맥주') || valClean.includes('호프') || valClean.includes('생맥주')) return '🍺';
    if (valClean.includes('소주') || valClean.includes('주점') || valClean.includes('이자카야') || valClean.includes('술집')) return '🍶';
    if (valClean.includes('회') || valClean.includes('초밥') || valClean.includes('수산') || valClean.includes('일식')) return '🍣';
    if (valClean.includes('데이트') || valClean.includes('분위기') || valClean.includes('파스타') || valClean.includes('와인') || valClean.includes('조명')) return '🍷';
    if (valClean.includes('매운') || valClean.includes('마라') || valClean.includes('낙지') || valClean.includes('🌶️')) return '🌶️';
    if (valClean.includes('해장') || valClean.includes('짬뽕') || valClean.includes('북어국')) return '🍲';
    
    if (type === 'weather') {
      if (weatherState === 'rainy') return '🌧️';
      if (weatherState === 'hot') return '🥵';
      if (weatherState === 'cold') return '🥶';
      return '☀️';
    }
    return '✨';
  };

  const subSidebarWidth = useMemo(() => {
    if (activeTab === 'planning' && activePlanningItinerary) {
      return isPlanningSearchActive ? 760 : 380;
    }
    // 쇼핑탭: 지도가 무의미하므로 화면 전체 폭으로 확장 (풀폭 매거진)
    if (activeTab === 'shopping') {
      return Math.max(760, windowWidth - 62);
    }
    return 380;
  }, [activeTab, activePlanningItinerary, isPlanningSearchActive, windowWidth]);

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

  // 탭 전환 시 드롭다운 필터 닫기, 영역 필터 초기화 처리 등
  useEffect(() => {
    // 탭 전환 시 드롭다운 필터 닫기
    setActiveDropdown(null);
    setDropdownAnchor(null);

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
      if (activeTab === 'mypage') setSelectedShoppingVideoId(null);
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
      if (activeTab !== 'shopping') {
        setSelectedShoppingVideoId(null);
      }
      if (isAreaDrawingMode || filterPolygon) {
        clearAreaFilter();
      }
    }
  }, [activeTab]);

  // 4단계: 지도 위 영역 그리기 관련 상태
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

  // 4단계 심화: 카카오 네이티브 API 직접 제어 Ref 및 폴리곤 레퍼런스
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const nativePolygonRef = useRef<kakao.maps.Polygon | null>(null);
  const nativeGlowPolygonRef = useRef<kakao.maps.Polygon | null>(null);
  const nativeMaskPolygonRef = useRef<kakao.maps.Polygon | null>(null);

  // 4단계: 그리기 완료 후 영역 Polygon 렌더링 (SDK 대신 네이티브 방식)
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
      
      // 0. 전체 지도 마스크용 외곽 Polygon 생성 (선택 영역 외부 어둡게)
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

      // 1. 외곽 글로우 효과 Polygon 생성 (경계선 강조용 반투명 글로우)
      const glowPolygon = new window.kakao.maps.Polygon({
        path: path,
        strokeWeight: 7.5,
        strokeColor: "#FF6F00",
        strokeOpacity: 0.28,
        strokeStyle: "solid",
        fillColor: "transparent",
        fillOpacity: 0,
      });

      // 2. 메인 실선-경계선 Polygon 생성
      const mainPolygon = new window.kakao.maps.Polygon({
        path: path,
        strokeWeight: 2.2,
        strokeColor: "#ff3b30",
        strokeOpacity: 0.95,
        strokeStyle: "solid",
        fillColor: "transparent",
        fillOpacity: 0,
      });

      // 기존 <Polyline> 대신 네이티브로 렌더링하여 z-order 문제 해결 (insertBefore Node 방식)
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
    // 마우스 좌클릭(button === 0)일 때만 그리기 시작
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

    // 첫 번째 점 감지
    const firstPoint = drawingPoints[0];
    const dist = getDistance(firstPoint.lat, firstPoint.lng, newPoint.lat, newPoint.lng);
    if (dist <= 0.035 && drawingPoints.length > 2) {
      setIsSnapActive(true);
      setDrawingPoints((prev) => [...prev.slice(0, -1), firstPoint]);
      return;
    }
    setIsSnapActive(false);

    // 최소 이동 거리 미만이면 중복 좌표 제거 (약 0.5m 이하 이동 시 무시)
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

    // 중복 좌표 제거 (연속으로 같은 좌표가 있을 경우 NaN 오류 방지)
    const cleanedPoints = finalPoints.filter((pt, idx) => {
      if (idx === 0) return true;
      const prev = finalPoints[idx - 1];
      return pt.lat !== prev.lat || pt.lng !== prev.lng;
    });

    // 마우스업 직후 지도 클릭 이벤트가 발생하므로 필터폴리곤 설정 후 draggable 복원을 위해 300ms 딜레이
    setTimeout(() => {
      setFilterPolygon(cleanedPoints);
      setIsAreaDrawingMode(false);
      setIsSnapActive(false);
      setIsSidebarCollapsed(false); // 그리기 완료 후 사이드바 열어서 near 탭 결과 표시
    }, 300);
  };

  // 터치 이벤트 그리기 핸들러
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

    // 최소 이동 거리 미만이면 스킵
    const lastPoint = drawingPoints[drawingPoints.length - 1];
    const moveDist = getDistance(lastPoint.lat, lastPoint.lng, newPoint.lat, newPoint.lng);
    if (moveDist < 0.00005) return;

    setDrawingPoints((prev) => [...prev, newPoint]);
  };



  // 달력 날짜 배열 생성 유틸
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

  // 일정 장소 선택 시 주변 1km 및 경유 경로 1km 버퍼 내 맛집 추천 로직
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

    // 이전 장소가 있으면 이전 장소 -> 선택 장소 구간 5km 버퍼 계산
    let wayPolygon: { lat: number; lng: number }[] | null = null;
    if (idx > 0) {
      const prevItem = items[idx - 1];
      wayPolygon = getRouteBufferPolygon(
        { lat: prevItem.lat, lng: prevItem.lng },
        { lat: item.lat, lng: item.lng }
      );
    }

    restaurants.forEach((restaurant) => {
      // 1. 선택 장소 기준 5km 이내 맛집 탐색
      const dist = getDistance(item.lat, item.lng, restaurant.lat, restaurant.lng);
      if (dist <= 5.0) {
        nearRecommendations.push({ restaurant, distance: dist, type: 'near' });
      } else if (wayPolygon && isPointInPolygon({ lat: restaurant.lat, lng: restaurant.lng }, wayPolygon)) {
        // 2. 경유 경로 5km 외부지만 버퍼 폴리곤 내 맛집
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
    alert('검색어를 입력해주세요.');
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
    alert('여행 제목을 입력해주세요.');
      return;
    }
    if (!newItineraryStartDate || !newItineraryEndDate) {
    alert('여행 날짜를 선택해주세요.');
      return;
    }
    const start = new Date(newItineraryStartDate);
    const end = new Date(newItineraryEndDate);
    if (end < start) {
    alert('종료 날짜가 시작 날짜보다 이전입니다.');
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

  // 활성 일정 변경 시 OSRM 경로 좌표 계산 및 세그먼트 업데이트
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

        // 1. 이틀 이상 일정이면 전날 마지막 장소 -> 오늘 첫 장소 경로 계산 (0번째 세그먼트 추가)
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

      // 2. 당일 장소 간 경로 세그먼트 계산
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

  // OSRM 경로 좌표(planningRouteCoordinates)가 변경될 때마다 경로 주변 맛집 추천 갱신
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
        // 이동 수단별 탐색 반경 설정 (도보 200m, 대중교통 500m, 자차 2km)
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

    // 잦은 API 호출 방지를 위한 디바운스 처리
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





  // 컴포넌트 마운트 시 저장된 사용자 세션 복구 및 Supabase 세션 동기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('modoo-matjip-user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          supabase.auth.getUser().then(({ data: { user: authUser } }) => {
            if (authUser) {
              setUser({ ...parsed, id: authUser.id });
            } else {
              // 세션 복구를 위해 익명 로그인 진행
              supabase.auth.signInAnonymously().then(({ data }) => {
                if (data?.user) {
                  const loggedIn = { ...parsed, id: data.user.id };
                  setUser(loggedIn);
                  localStorage.setItem('modoo-matjip-user', JSON.stringify(loggedIn));
                  // 프로필 싱크
                  supabase.from('users').upsert({
                    id: data.user.id,
                    nickname: parsed.name,
                    avatar_url: parsed.avatarUrl
                  });
                } else {
                  setUser(parsed);
                }
              });
            }
          });
        } catch (e) {
          console.error("Failed to parse user session", e);
        }
      }
    }
  }, []);

  // 외부에서 일정 활성화 이벤트 수신 시 해당 일정으로 이동 및 지도 이동
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleActivateItinerary = (e: Event) => {
      const customEvent = e as CustomEvent;
      const itinerary = customEvent.detail;
      if (itinerary) {
        setActiveItinerary(itinerary);
        setActiveItineraryDay(1);
        setActiveTab('home'); // 홈 탭으로 전환
        
        // 첫 번째 장소로 지도 이동 및 줌 레벨 설정
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

  // 활성 일정의 날짜가 변경될 때 해당 날의 첫 장소로 지도 이동
  useEffect(() => {
    if (activeItinerary) {
      const dayItems = activeItinerary.days.find((d: any) => d.day === activeItineraryDay)?.items || [];
      const firstItem = dayItems[0];
      if (firstItem && map) {
        map.panTo(new kakao.maps.LatLng(firstItem.lat, firstItem.lng));
      }
    }
  }, [activeItineraryDay, activeItinerary, map]);


  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  // 3단계: 경로 1km 버퍼 폴리곤 배열 계산
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

  // 3단계: 특정 맛집이 경로 버퍼 내에 있는지 여부 체크
  const isRestaurantInPlanningBuffer = (restaurant: Restaurant) => {
    if (activePlanningBufferPolygons.length === 0) return false;
    return activePlanningBufferPolygons.some(poly => 
      isPointInPolygon({ lat: restaurant.lat, lng: restaurant.lng }, poly)
    );
  };

  // 3단계: 맛집을 경로에 삽입 (최적 위치 자동 탐색)
  const insertRestaurantToPlanningRoute = (restaurant: Restaurant) => {
    if (!activePlanningItinerary) return;

    setActivePlanningItinerary((prev: any) => {
      const updatedDays = prev.days.map((d: any) => {
        if (d.day === planningActiveDay) {
          const items = d.items;
          let insertIdx = items.length;

          // 장소가 2개 이상이면 거리 증가 최소화 최적 삽입 위치 탐색
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
                insertIdx = i + 1; // A와 B 사이에 삽입
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

  // 일정 플래닝 모드 장소 추가 (검색 결과 및 맛집 DB 장소)
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



  // 가로 스크롤 드래그 핸들러 유틸
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

  // 외부/내부 호버 ID 중 활성화된 것 사용
  const effectiveHoveredId = externalHoveredRestaurantId || hoveredRestaurantId;

  // 외부 선택 레스토랑 변경 시 지도 이동 및 상태 업데이트
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

  // restaurants 데이터 갱신 시 선택된 맛집 정보도 함께 업데이트 (최신 데이터 반영)
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

  // 맛집 선택 시 내부/외부 상태 동시 업데이트 핸들러
  const handleSelectRestaurant = (r: Restaurant | null) => {
    setSelectedRestaurant(r);
    if (onExternalSelectedChange) {
      onExternalSelectedChange(r);
    }
  };


  useEffect(() => {
    if (map) {
      setTimeout(() => {
        map.relayout();
    }, 350); // 탭 전환 닫힘 애니메이션 대기 (transition 완료 후 실행)
    }
  }, [isSidebarCollapsed, selectedRestaurant, map, activeTab, isPlanningSearchActive]);

  // 지도 이벤트 리스너 등록 및 경계/범위 처리
  useEffect(() => {
    if (!map) return;
    const handleIdle = () => {
      // 1. 지도 이탈 방지 경계 처리 (Boundary Lock)
      const center = map.getCenter();
      let lat = center.getLat();
      let lng = center.getLng();
      let outOfBounds = false;

      // 지도 한반도 경계 처리 (제주도 이남 ~ 백두산 이북, 서해안 이서 ~ 동해안 이동)
      if (lat < 33.1) { lat = 33.1; outOfBounds = true; }
      else if (lat > 38.6) { lat = 38.6; outOfBounds = true; }
      if (lng < 124.6) { lng = 124.6; outOfBounds = true; }
      else if (lng > 131.9) { lng = 131.9; outOfBounds = true; }

      if (outOfBounds) {
        // 경계를 벗어났으면 가장 가까운 경계 (Edge)로 이동 처리
        map.panTo(new kakao.maps.LatLng(lat, lng));
        return; 
      }

      // 2. 현재 화면 경계 갱신 후 상위 컴포넌트에 전달
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      
      setZoomLevel(map.getLevel());
      setMapCenter({ lat, lng });
      
      // 뷰포트 외곽에 버퍼 존(Buffer Zone) 추가하여 사전 데이터 패칭 UX 개선 (Pre-fetching UX)
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

  // 나침반 방향(방위각 측정) 처리
  const handleOrientation = (e: DeviceOrientationEvent) => {
    let heading: number | null = null;
    
    // iOS Safari
    if ('webkitCompassHeading' in e) {
      heading = (e as any).webkitCompassHeading;
    } 
      // Android / Chrome 절대 방위각
    else if (e.absolute && e.alpha !== null) {
      heading = 360 - e.alpha;
    }
      // 기타 방향 이벤트
    else if (e.alpha !== null) {
      heading = 360 - e.alpha;
    }
    
    if (heading !== null) {
      setUserHeading(Math.round(heading));
    }
  };

  // 방향 이벤트 리스너 등록 및 권한 요청
  const startOrientationTracking = () => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      // iOS 13+ 권한 요청 필요
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
      // Android 및 기타 기기
      if ('ondeviceorientationabsolute' in window) {
        (window as any).addEventListener('deviceorientationabsolute', handleOrientation, true);
      } else {
        (window as any).addEventListener('deviceorientation', handleOrientation, true);
      }
    }
  };

  // 실시간 위치 추적 시작
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

        // GPS 방향 정보가 존재하고 이동 중인 경우 방위각 업데이트
        if (position.coords.heading !== null && !isNaN(position.coords.heading) && position.coords.speed && position.coords.speed > 0.5) {
          setUserHeading(position.coords.heading);
        }
      },
      (error) => {
      console.error('위치 정보 오류:', error);
      alert('위치 정보를 가져올 수 없습니다. 브라우저에서 위치 허용을 해주세요.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  // 컴포넌트 언마운트 시 위치 추적 및 방향 이벤트 구독 해제
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
    };
  }, []);

  // 실시간 위치 갱신될 때마다 지도 이동 처리
  useEffect(() => {
    if (shouldPanToUser && userLocation && map) {
      const locPosition = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
      map.panTo(locPosition);
    }
  }, [userLocation, shouldPanToUser, map]);

  // 내 위치로 이동 핸들러
  const moveToCurrentLocation = () => {
    if (!map) return;
    if (!navigator.geolocation) {
    alert('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
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

  // 랜덤 맛집 추천 (오늘 뭐 먹지?)
  const pickRandomRestaurant = () => {
    if (restaurants.length === 0 || !map) {
    alert('현재 표시된 맛집이 없습니다.');
      return;
    }
    const randomIdx = Math.floor(Math.random() * restaurants.length);
    const target = restaurants[randomIdx];
    
    // 랜덤 선택 후 지도 이동
    map.setLevel(3, { animate: true });
    setTimeout(() => {
      map.panTo(new kakao.maps.LatLng(target.lat, target.lng));
      setSelectedRestaurant(target);
    }, 400); // 애니메이션 완료 대기
  };

  // 맛집 핀 마커 Solid 물방울형 Teardrop 스타일 UI 렌더링
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

    // 폴더 마커 색상 및 이모지 조회
    const restaurantRelations = folderRelations.filter(r => r.restaurant_id === restaurant.id);
    let markerColor = '';
    let markerEmoji = '';
    let primaryFolder: UserFolder | undefined = undefined;

    if (restaurantRelations.length > 0) {
      const sortedRelations = [...restaurantRelations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const targetRelation = sortedRelations[0];
      primaryFolder = userFolders.find(f => f.id === targetRelation.folder_id);
      if (primaryFolder) {
        markerEmoji = primaryFolder.emoji || '';
        markerColor = primaryFolder.color || '';
      }
    }

    // 내 저장 지도 모드: 방문완료=에메랄드, 가고싶은곳=폴더색/브랜드색
    if (savedMapMode) {
      const isVisitedSaved = restaurantRelations.some(r => r.visited);
      markerColor = isVisitedSaved ? '#10b981' : (markerColor || '#f97316');
    }

    // 줌 레벨 높을 때 표시 (점형/간략 뷰 출력)
    if (zoomLevel >= 8 && !isHighlighted) {
      const dotSize = viewLevel === 3 ? 'w-3.5 h-3.5' : viewLevel === 2 ? 'w-2.5 h-2.5' : 'w-2 h-2';
      return (
        <div className="relative flex items-center justify-center w-5 h-5 select-none">
          {viewLevel === 3 && (
            <div className="absolute w-3.5 h-3.5 rounded-full bg-red-500/35 animate-ping pointer-events-none" />
          )}
          <div 
            className={`relative rounded-full border border-white/70 shadow-md ${dotSize}`} 
            style={{ 
              backgroundColor: markerColor || undefined,
              backgroundImage: markerColor ? 'none' : 'linear-gradient(135deg, #ef4444, #f97316)'
            }}
          />
        </div>
      );
    }

    // 정밀 Solid 물방울형 Teardrop 핀 렌더링
    const PIN_SIZE = isBufferPlanningRecommended ? 36 : (isHighlighted ? 34 : 28);

    const glowShadow = isBufferPlanningRecommended
      ? '0 0 24px 8px rgba(249,115,22,0.7)' // 경유 경로 강조 글로우
      : (isHighlighted
        ? (markerColor ? `0 0 18px 5px ${markerColor}99` : '0 0 18px 5px rgba(239,68,68,0.6)')
        : viewLevel === 3
          ? '0 3px 12px rgba(239,68,68,0.45)'
          : '0 3px 10px rgba(0,0,0,0.22)');

    const ringColor = isBufferPlanningRecommended
      ? 'rgba(251,146,60,1)' // 경유 경로 링 색상
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
        {/* 경로 추천 배지 */}
        {isBufferPlanningRecommended && (
          <div className="absolute z-30 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[7px] font-black tracking-tight px-1.5 py-[2px] rounded-full border border-white shadow-[0_0_12px_#f97316] whitespace-nowrap"
            style={{ top: -14, right: -(PIN_SIZE * 0.5) }}>
            경로추천
          </div>
        )}

        {/* 조회수 100만+ 배지 */}
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

        {/* 3단계: 경로 추천 맛집 핀 강조 애니메이션 */}
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

        {/* 100만 뷰 레벨 ping 애니메이션 */}
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
            className="absolute inset-0 flex items-center justify-center"
            style={{
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              boxShadow: `0 0 0 1.5px ${ringColor}, ${glowShadow}`,
              backgroundColor: markerColor || undefined,
              backgroundImage: markerColor ? 'none' : (isBufferPlanningRecommended ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'linear-gradient(135deg, #ef4444, #f97316)')
            }}
          >
            {/* 핀 내부 구멍 혹은 대표 이모지 */}
            <div 
              className="bg-white rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)] flex items-center justify-center" 
              style={{ 
                width: PIN_SIZE * (markerEmoji ? 0.65 : 0.35), 
                height: PIN_SIZE * (markerEmoji ? 0.65 : 0.35),
                transform: 'rotate(45deg)'
              }}
            >
              {markerEmoji ? (
                <span style={{ fontSize: PIN_SIZE * 0.38 }}>{markerEmoji}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* 4단계: 줌 레벨 1~4 구간 레스토랑 이름 표시 */}
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


  // 카테고리, 영상 타입, 태그, 검색어 필터링 (useMemo 적용)
  const filteredRestaurants = useMemo(() => {
    let result = restaurants.filter(r => {
      // 내 저장 지도 모드: 저장 맛집만 표시 (그 외 카테고리/검색 필터는 무시)
      if (savedMapMode) {
        if (typeof r.lat !== 'number' || typeof r.lng !== 'number' || isNaN(r.lat) || isNaN(r.lng)) return false;
        if (!savedIds.has(r.id)) return false;
        if (savedStatusFilter === 'wish' && visitedIds.has(r.id)) return false;
        if (savedStatusFilter === 'visited' && !visitedIds.has(r.id)) return false;
        return true;
      }

      // 0. 영역 그리기 필터 적용 중이면 폴리곤 내부 맛집만 표시
      if (filterPolygon && filterPolygon.length >= 3) {
        if (typeof r.lat !== 'number' || typeof r.lng !== 'number' || isNaN(r.lat) || isNaN(r.lng)) {
          return false;
        }
        if (!isPointInPolygon({ lat: r.lat, lng: r.lng }, filterPolygon)) {
          return false;
        }
      }

      // 0-1. 날씨 및 상황별 추천 테마 퀵 필터 적용
      if (activeThemeChip) {
        const query = activeThemeChip.value.toLowerCase().trim();
        const nameMatch = r.name.toLowerCase().includes(query);
        const categoryMatch = (r.category || '').toLowerCase().includes(query);
        const addressMatch = (r.address || '').toLowerCase().includes(query);
        
        const youtuberMatch = r.videos?.some(vid => 
          vid.youtuber?.name?.toLowerCase().includes(query)
        ) || false;
        
        const tags = getRestaurantAllTags(r);
        const tagMatch = tags.some(tag => tag.toLowerCase().includes(query));
        
        if (!nameMatch && !categoryMatch && !addressMatch && !youtuberMatch && !tagMatch) {
          return false;
        }
      }

      // 1. 음식 카테고리 필터
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
          // 쇼츠 리뷰 필터: 해당 맛집에 쇼츠 영상이 있어야 통과
          const hasShorts = r.videos.some(vid => vid.is_short === true);
          if (!hasShorts) return false;
        } else if (activeVideoType === '롱폼 리뷰') {
          // 롱폼 리뷰 필터: 해당 맛집에 롱폼 영상이 있어야 통과
          const hasLongForm = r.videos.some(vid => vid.is_short !== true);
          if (!hasLongForm) return false;
        }
      }

      // 3. 태그/해시태그 필터
      if (activeTag) {
        const tags = getRestaurantAllTags(r);
        if (!tags.includes(activeTag)) return false;
      }

      // 3-1. 홈 테마 큐레이션 필터 (지금 핫한 / 10만+ 유튜버 / 미쉐린 / 또간집 / 심야)
      if (activeCuration) {
        const cur = CURATIONS.find(c => c.key === activeCuration);
        if (cur && !cur.match(r)) return false;
      }

      // 4. 글로벌 검색어 필터
      if (globalSearchQuery.trim()) {
        const query = globalSearchQuery.toLowerCase().trim();
        const nameMatch = r.name.toLowerCase().includes(query);
        const categoryMatch = (r.category || '').toLowerCase().includes(query);
        const addressMatch = (r.address || '').toLowerCase().includes(query);
        
        // 유튜버 이름 검색 매칭
        const youtuberMatch = r.videos?.some(vid => 
          vid.youtuber?.name?.toLowerCase().includes(query)
        ) || false;
        
        // 식당 이름 및 카테고리 검색 매칭
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
  }, [restaurants, activeCategory, activeSort, activeVideoType, filterPolygon, activeTag, activeCuration, globalSearchQuery, savedMapMode, savedStatusFilter, savedIds, visitedIds, activeThemeChip]);

  // 홈 테마 큐레이션 레일 — 현재 지도 내 맛집으로 각 테마 개수 집계 (빈 컬렉션은 숨김)
  const curationRail = useMemo(() => {
    return CURATIONS
      .map(c => ({ ...c, count: restaurants.filter(c.match).length }))
      .filter(c => c.count >= 1)
      .sort((a, b) => b.count - a.count);
  }, [restaurants]);

  // 홈 히어로 스포트라이트: 현재 필터 결과 중 조회수 최고 맛집 ("지금 뜨는")
  const heroRestaurant = useMemo(() => {
    if (savedMapMode || filterPolygon) return null;   // 저장지도·영역필터 모드에선 히어로 생략
    if (filteredRestaurants.length < 3) return null;   // 카드가 몇 개 없으면 히어로 불필요
    return filteredRestaurants.reduce((best, cur) => {
      const bv = getBestVideo(best.videos, activeVideoType)?.view_count || 0;
      const cv = getBestVideo(cur.videos, activeVideoType)?.view_count || 0;
      return cv > bv ? cur : best;
    }, filteredRestaurants[0]);
  }, [filteredRestaurants, activeVideoType, savedMapMode, filterPolygon]);

  // "오늘 뭐 먹지?" 게임 모달 (랜덤 뽑기 / 밸런스 게임)
  const [activeGameModal, setActiveGameModal] = useState<'random' | 'balance' | null>(null);

  // P1: 첫 진입 1탭 온보딩 (blank-slate 해소 · localStorage로 1회만 노출)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try { return typeof window !== 'undefined' && !localStorage.getItem('mm_home_onboarded'); } catch { return false; }
  });
  const dismissOnboarding = (cat?: string) => {
    try { localStorage.setItem('mm_home_onboarded', '1'); } catch {}
    if (cat) { setActiveCategory(cat); setSelectedCluster(null); }
    setShowOnboarding(false);
  };

  // 공용 컴팩트 행 렌더 (홈·히어로·주변맛집) — 다중 유튜버·권위 뱃지·거리·영상수·방문상태
  const renderCompactRow = (r: Restaurant, hero = false) => {
    const vid = getBestVideo(r.videos, activeVideoType);
    const isFav = savedIds.has(r.id);
    const isSelected = selectedRestaurant?.id === r.id;
    const isVisited = visitedIds.has(r.id);
    const catLabel = getFormattedCategory(r.category).split(' > ').pop() ?? getFormattedCategory(r.category);
    const youtubers = getUniqueYoutubers(r);
    const badges = getAuthorityBadges(r);
    const distKm = userLocation && typeof r.lat === 'number' && typeof r.lng === 'number'
      ? getDistance(userLocation.lat, userLocation.lng, r.lat, r.lng) : null;
    const distLabel = distKm == null ? null : distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;

    // 급상승(소셜 증거): 최근(120일 내) + 조회수 속도 높음 (하루 5천뷰 이상). 히어로엔 이미 '지금 뜨는'이 있어 제외
    const pubMs = vid?.published_at ? new Date(vid.published_at).getTime() : 0;
    const daysSince = pubMs ? Math.max(1, (Date.now() - pubMs) / 86400000) : Infinity;
    const isTrending = !hero && daysSince <= 120 && vid != null && (vid.view_count || 0) / daysSince >= 5000;

    const metrics: any[] = [];
    if (distLabel) metrics.push(<span key="d" className="font-bold text-slate-600 flex items-center gap-0.5"><MapPin size={9} className="shrink-0" />{distLabel}</span>);
    if (vid && vid.view_count > 0) metrics.push(<span key="v" className="font-bold text-orange-500 flex items-center gap-0.5"><Eye size={9} />{formatViewCount(vid.view_count)}</span>);
    if (vid?.published_at) metrics.push(<span key="t" className="text-slate-400">{formatRelativeTime(vid.published_at)}</span>);
    if (r.videos && r.videos.length > 1) metrics.push(<span key="c" className="text-slate-400 flex items-center gap-0.5"><Play size={8} fill="currentColor" />{r.videos.length}</span>);
    const metricRow: any[] = [];
    metrics.forEach((m, i) => {
      if (i > 0) metricRow.push(<span key={`sep${i}`} className="text-slate-300">·</span>);
      metricRow.push(m);
    });

    return (
      <motion.div
        key={r.id}
        onClick={() => { handleSelectRestaurant(r); map?.panTo(new kakao.maps.LatLng(r.lat, r.lng)); }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        whileTap={{ scale: 0.98 }}
        className={`group grid grid-cols-[84px_1fr_auto] gap-2.5 items-center rounded-xl cursor-pointer border p-2 transition-all ${isVisited ? 'opacity-65' : ''} ${hero ? '' : 'bg-white'} ${isSelected ? 'border-orange-400 shadow-md' : hero ? 'border-orange-200 shadow-sm hover:shadow-md' : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'}`}
        style={hero ? { background: 'linear-gradient(100deg,#FFF4E9,#ffffff 62%)', transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' } : { transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
      >
        {/* 썸네일 */}
        <div className="relative w-[84px] h-[56px] rounded-lg overflow-hidden bg-slate-100 shrink-0">
          {vid?.thumbnail ? (
            <img src={vid.thumbnail} className="w-full h-full object-cover" alt={r.name} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center"><Utensils size={20} className="text-slate-500" /></div>
          )}
          {vid?.is_short && (
            <span className="absolute bottom-1 right-1 bg-black/55 backdrop-blur-sm text-white text-[7px] font-black px-1 py-0.5 rounded flex items-center gap-0.5"><Play size={5} fill="currentColor" /> S</span>
          )}
          {isVisited && (
            <span className="absolute top-1 left-1 bg-emerald-500 text-white text-[7px] font-black px-1 py-0.5 rounded-full">✓ 다녀옴</span>
          )}
        </div>

        {/* 본문 */}
        <div className="min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[12.5px] font-extrabold text-slate-800 leading-tight truncate">{r.name}</span>
            {hero && (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}><Flame size={8} fill="currentColor" /> 지금 뜨는</span>
            )}
            {isTrending && (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}><Flame size={8} fill="currentColor" /> 급상승</span>
            )}
            {badges.map((b) => (
              <span key={b.short} className="shrink-0 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: b.bg }}>{b.short}</span>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-0.5 min-w-0 text-[10.5px] text-slate-500">
            <span className="shrink-0">{catLabel}</span>
            {youtubers.length > 0 && (
              <>
                <span className="text-slate-300 shrink-0">·</span>
                <span className="flex -space-x-1.5 shrink-0">
                  {youtubers.slice(0, 3).map((y, i) => (
                    y.profile_image ? (
                      <img key={i} src={y.profile_image} className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-white" alt={y.name} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span key={i} className="w-3.5 h-3.5 rounded-full bg-slate-300 ring-1 ring-white flex items-center justify-center text-[6px] font-bold text-white">{y.name?.[0] ?? '?'}</span>
                    )
                  ))}
                </span>
                <span className="truncate">{youtubers[0].name}{youtubers.length > 1 ? ` 외 ${youtubers.length - 1}` : ''}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1 text-[9.5px] tabular-nums">
            {metricRow}
          </div>
        </div>

        {/* 저장 */}
        <button onClick={(e) => { e.stopPropagation(); toggleSave(r.id); }} className="self-start p-1 -m-1">
          <Star size={16} className={isFav ? 'text-orange-500 fill-orange-500' : 'text-slate-300'} />
        </button>
      </motion.div>
    );
  };

  // 내 저장 지도 모드: 진입 시 저장 핀들에 맞춰 지도 범위 자동 조정
  useEffect(() => {
    if (!savedMapMode || !map) return;
    const saved = restaurants.filter(r => savedIds.has(r.id) && typeof r.lat === 'number' && typeof r.lng === 'number');
    if (saved.length === 0) return;
    const bounds = new kakao.maps.LatLngBounds();
    saved.forEach(r => bounds.extend(new kakao.maps.LatLng(r.lat, r.lng)));
    map.setBounds(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedMapMode, map]);

  // 저장 탭을 벗어나면 지도 모드 해제
  useEffect(() => {
    if (activeTab !== 'favorites') setSavedMapMode(false);
  }, [activeTab]);

if (loading) return <div className="w-full h-screen bg-gray-50 flex items-center justify-center">Loading Maps...</div>;
  if (mapError) return <div className="w-full h-screen bg-gray-50 flex items-center justify-center text-red-500 font-bold">Failed to load Kakao Maps: {mapError.message}</div>;

  return (
    <div className="w-full h-screen flex relative overflow-hidden bg-gray-100 dark:bg-zinc-950 font-sans">
      {/* 전역 SVG 그라디언트 정의 */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="red-orange-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF0000" />
            <stop offset="100%" stopColor="#FF7A00" />
          </linearGradient>
        </defs>
      </svg>

      {/* ========================================================
          1. 컬럼 1단계 사이드바 (브랜드-아이콘 내비게이션) - md 이상 표시
          ======================================================== */}
      <div className="hidden md:flex flex-col w-[62px] h-full shrink-0 bg-gradient-to-b from-[#ff3b30] to-[#ff6f00] py-6 justify-between items-center relative z-30 shadow-[4px_0_24px_rgba(0,0,0,0.12)]">
        {/* 상단 로고 아이콘 영역 */}
        <div className="flex flex-col items-center gap-1">
          <div
            onClick={() => {
              setActiveTab('home');
              setSelectedRestaurant(null);
              setSelectedCluster(null);
              setSelectedShoppingVideoId(null);
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

        {/* 메인 탭 내비게이션 메뉴 버튼 목록 */}
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
            const favCount = menu.id === 'favorites' ? savedIds.size : 0;
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
                {/* 활성 탭 좌측 인디케이터 바 */}
                {isActive && (
                  <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-[3px] h-6 bg-white rounded-full z-10" />
                )}

                {/* 아이콘 + 즐겨찾기 뱃지 */}
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

                {/* 툴팁 마우스 오버 팝업 */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-zinc-900/95 text-white rounded-xl px-3 py-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl border border-white/10">
                  <div className="text-[13px] font-semibold">{menu.label}</div>
                  <div className="text-[12px] text-white/55 mt-0.5">{menu.desc}</div>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-900/95" />
                </div>
              </button>
            );
          })}
        </div>

        {/* 하단 영역 (맛집 제보 & 로그인/프로필) */}
        <div className="flex flex-col items-center gap-4">
          {/* 맛집 제보 버튼 + 툴팁 */}
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
                setSelectedShoppingVideoId(null);
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
          2. 컬럼 2단계 사이드바 (탭 메뉴 내비/목록 표시) - md 이상 표시
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
              
              {/* 2-1. 홈 탭 사이드바 패널 */}
              {activeTab === 'home' && (
                <div className="p-5 space-y-5 flex-1 flex flex-col">
                  {/* 검색창 */}
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



                  <div className="pt-3 border-t border-slate-100 flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-3.5 shrink-0 gap-2">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <h4 className="text-[14px] font-black text-slate-800 tracking-tight">
                          {currentRegion ? `${currentRegion} 맛집` : '우리 동네 맛집'}
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
                      <div className="flex items-center gap-1.5 z-30 select-none">
                        {/* 1. 음식 종류 — 드롭다운 오른쪽 방향 */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              if (activeDropdown === 'category') {
                                setActiveDropdown(null);
                                setDropdownAnchor(null);
                              } else {
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setDropdownAnchor({ top: rect.bottom + 4, left: rect.left });
                                setActiveDropdown('category');
                              }
                            }}
                            className={`py-1.5 px-2.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              activeCategory !== '전체'
                                ? 'shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                            style={activeCategory !== '전체' ? {
                              backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #ef4444, #f97316)',
                              backgroundOrigin: 'border-box',
                              backgroundClip: 'padding-box, border-box',
                              border: '1.5px solid transparent',
                              color: '#ef4444',
                            } : undefined}
                          >
                            <Utensils size={12} className="shrink-0" />
                            <span
                              className="truncate"
                              style={activeCategory !== '전체' ? {
                                backgroundImage: 'linear-gradient(135deg, #ef4444, #f97316)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                              } : undefined}
                            >{activeCategory === '전체' ? '음식' : activeCategory === '카페/디저트' ? '디저트' : activeCategory}</span>
                            <ChevronDown size={12} className={activeDropdown === 'category' ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} />
                          </button>
                          {activeDropdown === 'category' && dropdownAnchor && createPortal(
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.15, ease: 'easeOut' }}
                              style={{ position: 'fixed', top: dropdownAnchor.top, left: dropdownAnchor.left, zIndex: 9999 }}
                              className="w-[240px] bg-white border border-slate-100 rounded-2xl shadow-xl p-2 grid grid-cols-3 gap-1"
                            >
                              {['전체', '한식', '일식', '중식', '양식', '아시안', '분식', '디저트', '술집'].map((category) => (
                                <button
                                  key={category}
                                  onClick={() => {
                                    setActiveCategory(category === '디저트' ? '카페/디저트' : category);
                                    setSelectedCluster(null);
                                    setActiveDropdown(null);
                                    setDropdownAnchor(null);
                                  }}
                                  className={`py-1.5 px-1 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer ${
                                    (category === '디저트' ? '카페/디저트' : category) === activeCategory
                                      ? 'font-black'
                                      : 'hover:bg-slate-50 text-slate-600'
                                  }`}
                                  style={(category === '디저트' ? '카페/디저트' : category) === activeCategory ? {
                                    backgroundImage: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.12))',
                                    color: '#ef4444',
                                  } : undefined}
                                >
                                  {category}
                                </button>
                              ))}
                            </motion.div>,
                            document.body
                          )}
                        </div>

                        {/* 2. 정렬 방식 — 드롭다운 왼쪽 방향 */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              if (activeDropdown === 'sort') {
                                setActiveDropdown(null);
                                setDropdownAnchor(null);
                              } else {
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setDropdownAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setActiveDropdown('sort');
                              }
                            }}
                            className={`py-1.5 px-2.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              activeSort !== 'latest'
                                ? 'shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                            style={activeSort !== 'latest' ? {
                              backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #ef4444, #f97316)',
                              backgroundOrigin: 'border-box',
                              backgroundClip: 'padding-box, border-box',
                              border: '1.5px solid transparent',
                              color: '#ef4444',
                            } : undefined}
                          >
                            <ArrowUpDown size={12} className="shrink-0" />
                            <span
                              className="truncate"
                              style={activeSort !== 'latest' ? {
                                backgroundImage: 'linear-gradient(135deg, #ef4444, #f97316)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                              } : undefined}
                            >{activeSort === 'latest' ? '최신' : '조회'}</span>
                            <ChevronDown size={12} className={activeDropdown === 'sort' ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} />
                          </button>
                          {activeDropdown === 'sort' && dropdownAnchor && createPortal(
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.15, ease: 'easeOut' }}
                              style={{ position: 'fixed', top: dropdownAnchor.top, right: dropdownAnchor.right, zIndex: 9999 }}
                              className="w-[130px] bg-white border border-slate-100 rounded-2xl shadow-xl p-2 grid grid-cols-1 gap-1"
                            >
                              {[{ id: 'latest', label: '최신순' }, { id: 'views', label: '조회수순' }].map((sort) => (
                                <button
                                  key={sort.id}
                                  onClick={() => {
                                    setActiveSort(sort.id as any);
                                    setSelectedCluster(null);
                                    setActiveDropdown(null);
                                    setDropdownAnchor(null);
                                  }}
                                  className={`py-1.5 px-1 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer ${
                                    activeSort === sort.id ? 'font-black' : 'hover:bg-slate-50 text-slate-600'
                                  }`}
                                  style={activeSort === sort.id ? {
                                    backgroundImage: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.12))',
                                    color: '#ef4444',
                                  } : undefined}
                                >
                                  {sort.label}
                                </button>
                              ))}
                            </motion.div>,
                            document.body
                          )}
                        </div>

                        {/* 3. 영상 종류 — 드롭다운 왼쪽 방향 */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              if (activeDropdown === 'videoType') {
                                setActiveDropdown(null);
                                setDropdownAnchor(null);
                              } else {
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setDropdownAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setActiveDropdown('videoType');
                              }
                            }}
                            className={`py-1.5 px-2.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              activeVideoType !== '전체 리뷰'
                                ? 'shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                            style={activeVideoType !== '전체 리뷰' ? {
                              backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #ef4444, #f97316)',
                              backgroundOrigin: 'border-box',
                              backgroundClip: 'padding-box, border-box',
                              border: '1.5px solid transparent',
                              color: '#ef4444',
                            } : undefined}
                          >
                            <PlayCircle size={12} className="shrink-0" />
                            <span
                              className="truncate"
                              style={activeVideoType !== '전체 리뷰' ? {
                                backgroundImage: 'linear-gradient(135deg, #ef4444, #f97316)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                              } : undefined}
                            >{activeVideoType === '전체 리뷰' ? '영상' : activeVideoType === '쇼츠 리뷰' ? '쇼츠' : '롱폼'}</span>
                            <ChevronDown size={12} className={activeDropdown === 'videoType' ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} />
                          </button>
                          {activeDropdown === 'videoType' && dropdownAnchor && createPortal(
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.15, ease: 'easeOut' }}
                              style={{ position: 'fixed', top: dropdownAnchor.top, right: dropdownAnchor.right, zIndex: 9999 }}
                              className="w-[160px] bg-white border border-slate-100 rounded-2xl shadow-xl p-2 grid grid-cols-1 gap-1"
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
                                    setDropdownAnchor(null);
                                  }}
                                  className={`py-1.5 px-1 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer ${
                                    activeVideoType === type.id ? 'font-black' : 'hover:bg-slate-50 text-slate-600'
                                  }`}
                                  style={activeVideoType === type.id ? {
                                    backgroundImage: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.12))',
                                    color: '#ef4444',
                                  } : undefined}
                                >
                                  {type.label}
                                </button>
                              ))}
                            </motion.div>,
                            document.body
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 overflow-y-auto flex-1 pb-4 pr-3 portal-sidebar-scrollbar" style={{ scrollbarWidth: 'none' }}>
                      {/* P1: 첫 진입 1탭 온보딩 (개인화) */}
                      {!selectedCluster && showOnboarding && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[13px] font-black text-slate-800 tracking-tight">오늘 뭐가 당기세요? 👋</p>
                              <p className="text-[10.5px] text-slate-500 mt-0.5">고르면 딱 맞는 맛집만 보여드릴게요</p>
                            </div>
                            <button onClick={() => dismissOnboarding()} className="shrink-0 -mt-0.5 -mr-0.5 p-1 text-slate-400 hover:text-slate-600" aria-label="닫기"><X size={14} /></button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {[{ l: '한식', v: '한식' }, { l: '일식', v: '일식' }, { l: '중식', v: '중식' }, { l: '양식', v: '양식' }, { l: '카페·디저트', v: '카페/디저트' }, { l: '술집', v: '술집' }].map((o) => (
                              <button key={o.v} onClick={() => dismissOnboarding(o.v)} className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-full px-2.5 py-1 hover:border-orange-300 hover:text-orange-600 transition-colors active:scale-95">{o.l}</button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-2.5">
                            <button onClick={() => { dismissOnboarding(); moveToCurrentLocation(); }} className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-black text-white rounded-full py-1.5 active:scale-95 transition-transform" style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}>
                              <Locate size={12} /> 내 주변부터 볼래요
                            </button>
                            <button onClick={() => dismissOnboarding()} className="shrink-0 text-[11px] font-bold text-slate-400 hover:text-slate-600 px-2">전체 볼게요</button>
                          </div>
                        </motion.div>
                      )}

                      {/* 오늘 뭐 먹지? — 슬림 결정 바 (기존 게임 재사용) */}
                      {!selectedCluster && filteredRestaurants.length > 0 && (
                        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-white shadow-sm" style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00 60%,#FF9E40)' }}>
                          <span className="text-[12px] font-black flex-1 flex items-center gap-1.5"><Dices size={14} /> 오늘 뭐 먹지?</span>
                          <button onClick={() => setActiveGameModal('balance')} className="shrink-0 text-[10px] font-bold bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-full transition-colors">밸런스</button>
                          <button onClick={() => setActiveGameModal('random')} className="shrink-0 text-[11px] font-black bg-white text-[#E4002B] px-3 py-1 rounded-full active:scale-95 transition-transform">돌리기</button>
                        </div>
                      )}

                      {/* 테마 큐레이션 — 필터 칩 한 줄 (기존 activeCuration 재사용) */}
                      {!selectedCluster && curationRail.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5" style={{ scrollbarWidth: 'none' }}>
                          {curationRail.map((c) => {
                            const on = activeCuration === c.key;
                            return (
                              <button
                                key={c.key}
                                onClick={() => setActiveCuration(on ? null : c.key)}
                                className={`shrink-0 inline-flex items-center gap-1 rounded-full text-[11px] font-bold px-2.5 py-1.5 transition-all active:scale-95 ${on ? 'text-white border border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                                style={on ? { background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' } : undefined}
                              >
                                <span>{c.emoji}</span>
                                <span>{c.label}</span>
                                <span className={`text-[9.5px] font-bold tabular-nums ${on ? 'text-white/85' : 'text-slate-400'}`}>{c.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* 히어로 → 슬림 강조 행 (지금 뜨는) */}
                      {!selectedCluster && heroRestaurant && renderCompactRow(heroRestaurant, true)}

                      {/* 활성 테마 필터 표시 + 해제 */}
                      {!selectedCluster && activeCuration && (
                        <div className="flex items-center gap-1.5 px-0.5 text-[11px]">
                          <span className="font-bold text-slate-500">테마 필터 적용 중</span>
                          <button onClick={() => setActiveCuration(null)} className="ml-auto font-bold text-orange-500 hover:text-orange-600 flex items-center gap-0.5">전체 보기 <X size={11} /></button>
                        </div>
                      )}

                      {(selectedCluster || filteredRestaurants).filter(r => selectedCluster ? true : r.id !== heroRestaurant?.id).slice(0, 40).map((r) => renderCompactRow(r))}
                    </div>
                  </div>
                </div>
              )}

              {/* 2-near. 영역 그리기 탭 결과 패널 */}
              {activeTab === 'near' && (
                <div className="flex flex-col h-full">
                  {filterPolygon ? (
                    <>
                      {/* 헤더 */}
                      <div className="px-5 pt-5 pb-3 shrink-0">
                        <div className="flex items-center justify-between mb-2.5 shrink-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            <h3 className="text-[15px] font-black text-slate-800 truncate">
                              필터 영역 내 맛집
                              <span className="ml-1.5 text-[12px] font-semibold text-slate-400">{filteredRestaurants.length}곳</span>
                            </h3>
                          </div>
                          <button
                            onClick={() => {
                              setFilterPolygon(null);
                              setDrawingPoints([]);
                              setIsSnapActive(false);
                              startAreaDrawing();
                              setIsSidebarCollapsed(true);
                            }}
                            className="text-[11px] font-bold text-orange-500 hover:text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition-colors shrink-0 ml-2"
                          >
                            다시 그리기
                          </button>
                        </div>
                        {/* 필터 3형제 - 전체 너비 균등 배분 */}
                        <div className="flex gap-1.5 z-30 select-none">
                          {/* 1. 음식 종류 */}
                          <div className="relative flex-1">
                            <button
                              onClick={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')}
                              className={`w-full py-1.5 px-2 rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                                activeCategory !== '전체'
                                  ? 'shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                              style={activeCategory !== '전체' ? {
                                backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #ef4444, #f97316)',
                                backgroundOrigin: 'border-box',
                                backgroundClip: 'padding-box, border-box',
                                border: '1.5px solid transparent',
                                color: '#ef4444',
                              } : undefined}
                            >
                              <Utensils size={9} className="shrink-0" />
                              <span
                                className="truncate"
                                style={activeCategory !== '전체' ? {
                                  backgroundImage: 'linear-gradient(135deg, #ef4444, #f97316)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                } : undefined}
                              >{activeCategory === '전체' ? '음식' : activeCategory === '카페/디저트' ? '디저트' : activeCategory}</span>
                              <ChevronDown size={9} className={activeDropdown === 'category' ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} />
                            </button>
                            <AnimatePresence>
                              {activeDropdown === 'category' && (
                                <motion.div
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 6 }}
                                  className="absolute top-full left-0 mt-1 w-[240px] bg-white border border-slate-100 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-3 gap-1"
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
                                          ? 'font-black'
                                          : 'hover:bg-slate-50 text-slate-600'
                                      }`}
                                      style={(category === '디저트' ? '카페/디저트' : category) === activeCategory ? {
                                        backgroundImage: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.12))',
                                        color: '#ef4444',
                                      } : undefined}
                                    >
                                      {category}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* 2. 정렬 방식 */}
                          <div className="relative flex-1">
                            <button
                              onClick={() => setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')}
                              className={`w-full py-1.5 px-2 rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                                activeSort !== 'latest'
                                  ? 'shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                              style={activeSort !== 'latest' ? {
                                backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #ef4444, #f97316)',
                                backgroundOrigin: 'border-box',
                                backgroundClip: 'padding-box, border-box',
                                border: '1.5px solid transparent',
                                color: '#ef4444',
                              } : undefined}
                            >
                              <ArrowUpDown size={9} className="shrink-0" />
                              <span
                                className="truncate"
                                style={activeSort !== 'latest' ? {
                                  backgroundImage: 'linear-gradient(135deg, #ef4444, #f97316)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                } : undefined}
                              >{activeSort === 'latest' ? '최신' : '조회'}</span>
                              <ChevronDown size={9} className={activeDropdown === 'sort' ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} />
                            </button>
                            <AnimatePresence>
                              {activeDropdown === 'sort' && (
                                <motion.div
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 6 }}
                                  className="absolute top-full left-0 mt-1 w-[130px] bg-white border border-slate-100 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-1 gap-1"
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
                                          ? 'font-black'
                                          : 'hover:bg-slate-50 text-slate-600'
                                      }`}
                                      style={activeSort === sort.id ? {
                                        backgroundImage: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.12))',
                                        color: '#ef4444',
                                      } : undefined}
                                    >
                                      {sort.label}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* 3. 영상 종류 */}
                          <div className="relative flex-1">
                            <button
                              onClick={() => setActiveDropdown(activeDropdown === 'videoType' ? null : 'videoType')}
                              className={`w-full py-1.5 px-2 rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                                activeVideoType !== '전체 리뷰'
                                  ? 'shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                              style={activeVideoType !== '전체 리뷰' ? {
                                backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #ef4444, #f97316)',
                                backgroundOrigin: 'border-box',
                                backgroundClip: 'padding-box, border-box',
                                border: '1.5px solid transparent',
                                color: '#ef4444',
                              } : undefined}
                            >
                              <PlayCircle size={9} className="shrink-0" />
                              <span
                                className="truncate"
                                style={activeVideoType !== '전체 리뷰' ? {
                                  backgroundImage: 'linear-gradient(135deg, #ef4444, #f97316)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                } : undefined}
                              >{activeVideoType === '전체 리뷰' ? '영상' : activeVideoType === '쇼츠 리뷰' ? '쇼츠' : '롱폼'}</span>
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
                                          ? 'font-black'
                                          : 'hover:bg-slate-50 text-slate-600'
                                      }`}
                                      style={activeVideoType === type.id ? {
                                        backgroundImage: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.12))',
                                        color: '#ef4444',
                                      } : undefined}
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
                      {/* 목록 */}
                      <div className="flex-1 overflow-y-auto portal-sidebar-scrollbar px-3 pb-4 space-y-1.5" style={{ scrollbarWidth: 'none' }}>
                        {filteredRestaurants.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                            <Utensils size={32} className="text-slate-200 mb-3" />
                            <p className="text-sm font-bold text-slate-400">필터 영역 내 맛집이 없습니다.</p>
                            <p className="text-xs text-slate-300 mt-1">다른 영역을 그려보세요</p>
                          </div>
                        ) : (
                          filteredRestaurants.slice(0, 60).map((r) => renderCompactRow(r))
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

              {/* 2-2. 즐겨찾기 탭 사이드바 패널 */}
              {activeTab === 'favorites' && (
                <div className="flex flex-col h-full bg-white">
                  {!user ? (
                    <div className="flex flex-col items-center justify-center h-full px-6 bg-white">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center shadow-lg mb-5">
                        <User size={30} className="text-white" />
                      </div>
                      <p className="text-[16px] font-extrabold text-slate-800 tracking-tight">로그인이 필요해요</p>
                      <p className="text-[13px] text-slate-400 mt-2 mb-7 text-center leading-relaxed">로그인하시면 맛집 저장, 일정 관리 등 모든 기능을 사용하실 수 있습니다.</p>
                      {/* 로그인 버튼 목록 */}
                      <div className="w-full flex flex-col gap-2.5">
                        {/* Google */}
                        <button onClick={() => handleDirectLogin('google')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm cursor-pointer">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span className="flex-1 text-center">Google 계정으로 로그인</span>
                        </button>
                        {/* Kakao */}
                        <button onClick={() => handleDirectLogin('kakao')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm cursor-pointer">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#3C1E1E">
                            <path d="M12 3c-5.523 0-10 3.582-10 8c0 2.915 1.91 5.467 4.79 6.853l-1.2 4.41c-.11.41.36.75.72.51l5.22-3.48c.15.01.31.02.47.02 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
                          </svg>
                          <span className="flex-1 text-center">Kakao 계정으로 로그인</span>
                        </button>
                        {/* Naver */}
                        <button onClick={() => handleDirectLogin('naver')} className="w-full flex items-center gap-3 px-4 h-[50px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-[14px] font-semibold text-slate-700 shadow-sm cursor-pointer">
                          <span className="w-5 h-5 shrink-0 bg-[#03C75A] rounded flex items-center justify-center text-white font-black text-[13px] leading-none">N</span>
                          <span className="flex-1 text-center">Naver 계정으로 로그인</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SavedListView
                      defaultFolderId={defaultFolderId}
                      folderRelations={folderRelations}
                      onRefreshData={fetchFoldersAndRelations}
                      onSelectRestaurant={(lat, lng, id) => {
                        const target = restaurants.find(r => r.id === id);
                        if (target) {
                          handleSelectRestaurant(target);
                        }
                        map?.panTo(new kakao.maps.LatLng(lat, lng));
                      }}
                      activeVideoType={activeVideoType}
                      mapMode={savedMapMode}
                      onToggleMapMode={setSavedMapMode}
                      statusFilter={savedStatusFilter}
                      onStatusChange={setSavedStatusFilter}
                    />
                  )}
                </div>
              )}

              {/* 2-3. 쇼핑 탭 사이드바 패널 */}
              {activeTab === 'shopping' && (
                <div className="flex flex-col h-full overflow-hidden portal-sidebar-scrollbar" style={{ scrollbarWidth: 'none' }}>
                  <ShoppingTabView 
                    selectedVideoId={selectedShoppingVideoId} 
                    onSelectVideo={setSelectedShoppingVideoId} 
                  />
                </div>
              )}

              {/* 2-4. 마이페이지 탭 사이드바 패널 */}
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
                    /* 로그인된 상태 */
                    <div className="flex flex-col">
                      {/* 프로필 헤더 */}
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
                        {/* 통계 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                            <p className="text-lg font-black text-orange-500">{savedIds.size}</p>
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
                          <div className="flex items-center gap-1"><span className="text-xs text-orange-500 font-bold">{savedIds.size}</span><CornerUpRight size={12} className="text-slate-300" /></div>
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

              {/* 2-5. 일정 탭 사이드바 패널 */}
              {activeTab === 'planning' && (
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-transparent">
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
                        onCreateItinerary={(newItinerary) => {
                          setEditingItinerary(null);
                          setActivePlanningItinerary(newItinerary);
                          setPlanningActiveDay(1);
                          setIsPlanningMode(true);
                        }}
                        onSelectTab={setActiveTab}
                      />
                    </div>
                  ) : (
                    // 데스크탑 2단계 사이드바 패널 내부에 플로팅 일정 패널 렌더링
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
            alert('하루에 최소 한 곳 이상을 일정에 추가해주세요');
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
            if (confirm('현재까지 작성한 일정을 취소하시겠습니까? 저장되지 않은 내용은 사라집니다.')) {
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
                        favorites={Array.from(savedIds)}
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

      {/* 맛집 정보 카드 (flex flow 내 / 모바일 bottom overlay) */}
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
        favorites={Array.from(savedIds)}
        toggleFavorite={(id) => toggleSave(id)}
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

      {/* 사이드바 접기/펼치기 버튼 (w-0 flex 트릭으로 레이아웃 공간 차지 없이 토글) */}
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
          3. 지도 영역 (검색바 + 지도 맵 컨텐츠)
          ======================================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* ========================================================
            지도 맵 컨텐츠 (그리기 모드 등 상호작용 포함)
            ======================================================== */}
        <div className="flex-1 relative overflow-hidden bg-slate-50">
          {/* 지도 상단 날씨/테마 퀵 필터 칩 (네이버 지도 스타일) */}
          <div className="absolute top-4 left-4 right-16 z-20 flex items-center gap-2 overflow-x-auto no-scrollbar pointer-events-auto select-none py-1">
            {/* 날씨 요약 정보 미니 배지 */}
            {weatherInfo && (
              <div className="bg-slate-900/90 text-white border border-slate-800 backdrop-blur-sm text-[11px] font-black py-1.5 px-3 rounded-full flex items-center gap-1 shrink-0 shadow-md">
                <span>{weatherState === 'rainy' ? '🌧️' : weatherState === 'cold' ? '❄️' : weatherState === 'hot' ? '🔥' : '☀️'}</span>
                <span>{weatherInfo.temp}°C</span>
              </div>
            )}

            {/* 실시간 테마 필터 칩 목록 */}
            {(() => {
              const chips: { name: string; value: string; type: 'vibe' | 'weather' }[] = [];
              
              if (curationData) {
                curationData.vibeKeywords?.slice(0, 3).forEach((k: any) => {
                  chips.push({
                    name: `${getEmojiForKeyword(k.value, 'vibe')} ${k.name.split(' (')[0]}`,
                    value: k.value,
                    type: 'vibe'
                  });
                });
                curationData.weatherKeywords?.slice(0, 3).forEach((k: any) => {
                  chips.push({
                    name: `${getEmojiForKeyword(k.value, 'weather')} ${k.name}`,
                    value: k.value,
                    type: 'weather'
                  });
                });
              }

              const finalChips = chips.length > 0 ? chips : [
                { name: '🍲 뜨끈한 국물 요리', value: '국물', type: 'vibe' as const },
                { name: '🥩 맛있는 고기구이', value: '고기', type: 'vibe' as const },
                { name: '🍺 시원한 생맥주', value: '맥주', type: 'vibe' as const },
                { name: '☕ 디저트 & 카페', value: '카페', type: 'vibe' as const },
                { name: '🌶️ 화끈한 매운맛', value: '매운맛', type: 'vibe' as const },
                { name: '🍲 뜨끈한 국밥', value: '국밥', type: 'vibe' as const }
              ];

              return finalChips.map((chip, idx) => {
                const isActive = activeThemeChip?.value === chip.value;
                return (
                  <button
                    key={`${chip.value}-${idx}`}
                    onClick={() => {
                      if (isActive) {
                        setActiveThemeChip(null);
                      } else {
                        setActiveThemeChip({ name: chip.name, value: chip.value });
                      }
                    }}
                    className={`py-1.5 px-3.5 rounded-full text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 transition-all select-none shadow-md border ${
                      isActive
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white border-transparent scale-105'
                        : 'bg-white/95 text-slate-700 hover:text-slate-900 border-slate-200/80 hover:bg-slate-50 hover:scale-105 active:scale-95'
                    }`}
                  >
                    <span>{chip.name}</span>
                    {isActive && <X size={10} className="stroke-[3]" />}
                  </button>
                );
              });
            })()}
          </div>
          



      {/* 지도 컨테이너 (그리기 모드 이벤트 핸들러 연결) */}
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

        {/* 4단계: 그리기 중인 경로 좌표 폴리라인(Polyline) 표시 */}
        {isAreaDrawingMode && drawingPoints.length > 1 && (
          <Polyline
            path={drawingPoints}
            strokeWeight={4}
            strokeColor="#FF6F00"
            strokeOpacity={0.85}
            strokeStyle="solid"
          />
        )}

        {/* 4단계: 첫 점 스냅 시 자동 완성 영역 폴리곤 미리보기 표시 */}
        {isAreaDrawingMode && drawingPoints.length > 2 && isSnapActive && (
          <Polygon
            path={[...drawingPoints, drawingPoints[0]]}
            strokeWeight={0}
            fillColor="#FF6F00"
            fillOpacity={0.25}
          />
        )}




        {/* 3단계: 일정 계획 경로 버퍼 폴리곤(Polygon) 표시 */}
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

        {/* 3단계: OSRM 경로 좌표 기반 폴리라인 및 경유지 마커 표시 */}
        {isPlanningMode && activePlanningItinerary && (() => {
          const dayItems = activePlanningItinerary.days.find((d: any) => d.day === planningActiveDay)?.items || [];
          if (dayItems.length < 2) return null;

          // OSRM 경로 데이터가 있으면 실제 도로 경로로 렌더링
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
                      {/* OSRM 도로망 경로 폴리라인 */}
                      <Polyline
                        path={seg.coordinates}
                        strokeWeight={5}
                        strokeColor="#ef4444"
                        strokeOpacity={0.85}
                        strokeStyle="solid"
                      />

                      {/* 경유지 Snap-to-Road 경로 조정 마커 */}
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
                        title={`${seg.ptB.name} 가는 길 경유지 (드래그하여 경로 수정 가능)`}
                      />
                    </div>
                  );
                })}
              </>
            );
          }

          // OSRM을 사용 불가한 경우 직선 경로 폴리라인으로 대체
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

        {/* 3단계: 일정 계획 경로 오버레이 장소 번호 마커 */}
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

        {/* 활성 일정 경로(Polyline) 및 장소 번호 마커 표시 */}
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

                {/* 맛집 핀/마커 클러스터 영역 렌더링 */}
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
          yAnchor={1} // 핀 하단이 지도 좌표에 맞도록 (핀 끝 위치)
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

              {/* 마커 지도 호버(Hover) 시 팝업 미니카드 표시 */}
              {mapHoveredRestaurantId === restaurant.id && (() => {
                const bestVid = getBestVideo(restaurant.videos);
                const isFav = savedIds.has(restaurant.id);
                return (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectRestaurant(restaurant);
                    }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 w-[280px] select-none z-[120] text-left cursor-pointer transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                  >
                    {/* 카드 본체 (사이드바 카드와 동일하게 16:9 비율 및 스타일 적용) */}
                    <div 
                      className="relative w-full rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
                      style={{
                        aspectRatio: '16/9',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                      }}
                    >
                      {/* 배경 이미지 */}
                      {bestVid?.thumbnail ? (
                        <img
                          src={bestVid.thumbnail}
                          className="absolute inset-0 w-full h-full object-cover restaurant-card-img"
                          alt={restaurant.name}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                          <Utensils size={32} className="text-slate-500" />
                        </div>
                      )}

                      {/* Shorts badge - 우측하단 배치 */}
                      {bestVid?.is_short && (
                        <div className="absolute bottom-2.5 right-2.5 bg-black/35 backdrop-blur-md border border-white/10 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm z-10">
                          <Play size={6} fill="currentColor"/> SHORTS
                        </div>
                      )}

                      {/* 그라데이션 오버레이 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

                      {/* 상단 오버레이: 카테고리 뱃지 대신 유튜브 채널 정보 + 즐겨찾기 */}
                      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
                        {bestVid?.youtuber ? (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/15">
                            {bestVid.youtuber.profile_image ? (
                              <img
                                src={bestVid.youtuber.profile_image}
                                className="w-4.5 h-4.5 rounded-full object-cover ring-1 ring-white/40"
                                alt={bestVid.youtuber.name}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-4.5 h-4.5 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                {bestVid.youtuber.name?.[0]}
                              </div>
                            )}
                            <span className="text-[10px] font-semibold text-white/90 truncate max-w-[100px]">{bestVid.youtuber.name}</span>
                          </div>
                        ) : (
                          <div />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSave(restaurant.id);
                          }}
                          className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/15 hover:bg-black/60 transition-colors"
                        >
                          <Star size={12} className={isFav ? 'text-orange-400 fill-orange-400' : 'text-white/80'} />
                        </button>
                      </div>

                      {/* 하단 오버레이: 식당명 + 조회수 */}
                      <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3.5 z-10">
                        <p className="text-[15px] font-black text-white leading-tight truncate">{restaurant.name}</p>
                        {bestVid?.view_count !== undefined && bestVid.view_count > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Eye size={10} className="text-orange-300 shrink-0" />
                            <span className="text-[11px] font-bold text-orange-300">조회수 {formatViewCount(bestVid.view_count)}회</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 말꼬리 */}
                    <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-black rotate-45 z-[-1]" />
                  </div>
                );
              })()}
              
            </div>
          </CustomOverlayMap>
        ))}
        {/* 내 위치 마커 */}
        {userLocation && (
          <CustomOverlayMap
            position={userLocation}
            zIndex={99}
            xAnchor={0.5}
            yAnchor={0.5}
          >
            <div className="relative flex items-center justify-center w-8 h-8 animate-none">
              {/* 방향 빔 (디바이스 방향 정보가 있을 때 표시) */}
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
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#f97316" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* 부채꼴 방향 빔 SVG */}
                    <path d="M 40 40 L 25 14 A 30 30 0 0 1 55 14 Z" fill="url(#dir-beam)" />
                    {/* 위쪽 방향 삼각형 화살표 */}
                    <path d="M 40 22 L 36 27 H 44 Z" fill="#ef4444" opacity="0.9" />
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

      {/* 지도 우측 하단 플로팅 액션 버튼 (FAB) 묶음 (제보, 일정 만들기, 랜덤 추천) */}
      <div className={`absolute right-4 z-20 flex flex-col items-end gap-2.5 transition-all duration-300 ${!selectedRestaurant ? 'bottom-[140px]' : 'bottom-10'}`}>
        


        {/* 쇼츠� 留�ㅺ�?*/}


        {/* 내 위치 */}
        <div className="flex items-center gap-2 group">
          <span className="text-[12px] font-semibold text-white bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-white/5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">내 위치</span>
          <button
            onClick={moveToCurrentLocation}
            className="p-3 bg-white hover:bg-slate-50 rounded-full border border-slate-200/80 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
            title="내 위치로 이동"
          >
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="url(#locate-gradient) #ef4444" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className={isLocating ? "animate-spin" : ""}
            >
              <defs>
                <linearGradient id="locate-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" /> {/* 빨간색: red-500 */}
                  <stop offset="100%" stopColor="#f97316" /> {/* 주황색: orange-500 */}
                </linearGradient>
              </defs>
              <line x1="2" x2="5" y1="12" y2="12"/>
              <line x1="19" x2="22" y1="12" y2="12"/>
              <line x1="12" x2="12" y1="2" y2="5"/>
              <line x1="12" x2="12" y1="19" y2="22"/>
              <circle cx="12" cy="12" r="7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 영역 그리기 상태 알림 배너 */}
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
              /* 그리기 중: 애니메이션 경계선 + 상태 표시 */
              <div className="relative p-[2px] rounded-2xl overflow-hidden">
                {/* 회전 그라디언트 경계선 */}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: 'conic-gradient(from 0deg, #ef4444, #f97316, #fbbf24, #f97316, #ef4444)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                />
                {/* 내부 컨텐츠 */}
                <div className="relative z-10 flex items-center gap-3 px-4 py-2.5 bg-white rounded-[14px]">
                  {/* 깜빡이는 REC 점 */}
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
              /* 그리기 완료 결과: 영역 필터링 결과 표시 */
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
                {/* 글로우 오버레이 */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18)_0%,transparent_60%)] pointer-events-none" />

                {/* 맛집 개수 */}
                <div className="relative flex items-baseline gap-0.5 shrink-0">
                  <span className="text-[22px] font-black text-white leading-none tracking-tight">{filteredRestaurants.length}</span>
                  <span className="text-[11px] font-semibold text-white/80 mb-0.5">개</span>
                </div>

                {/* 구분선 */}
                <div className="w-px h-7 bg-white/25 shrink-0" />

                {/* 설명 */}
                <div className="flex flex-col leading-tight">
                  <span className="text-[12px] font-extrabold text-white tracking-tight">맛집 발견</span>
                  <span className="text-[10px] text-white/70 font-medium">영역 필터 적용 중</span>
                </div>

                {/* 해제 버튼 */}
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

      {/* 클러스터 팝업 (지도에서 클러스터 클릭 시 스와이퍼/목록으로 표시) */}
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
              {/* 헤더 */}
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

              {/* Swiper 가로 스크롤 카드 */}
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



      {/* 모바일 전용 탭 오버레이 컨테이너 (planning 탭은 오버레이 비사용) */}
      <OverlayContainer activeTab={activeTab} onClose={() => setActiveTab('home')}>
        {activeTab === 'shopping' && <ShoppingTabView selectedVideoId={selectedShoppingVideoId} onSelectVideo={setSelectedShoppingVideoId} />}
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
            onCreateItinerary={(newItinerary) => {
              setEditingItinerary(null);
              setActivePlanningItinerary(newItinerary);
              setPlanningActiveDay(1);
              setIsPlanningMode(true);
              setActiveTab('home');
            }}
            onSelectTab={setActiveTab}
          />
        )}
      </OverlayContainer>

      {/* 활성 일정 진행 중 하단 컨트롤 바 */}
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

      {/* 모바일 하단 탭바 렌더링 */}
      {!isAreaDrawingMode && !filterPolygon && (
        <BottomTabBar activeTab={activeTab} onChangeTab={setActiveTab} />
      )}


      {/* "오늘 뭐 먹지?" 게임 모달 (랜덤 뽑기 / 밸런스 게임) */}
      <AnimatePresence>
        {activeGameModal === 'random' && (
          <RandomDrawModal
            onClose={() => setActiveGameModal(null)}
            restaurants={filteredRestaurants}
            onSelect={(r) => { setActiveGameModal(null); handleSelectRestaurant(r); map?.panTo(new kakao.maps.LatLng(r.lat, r.lng)); }}
          />
        )}
        {activeGameModal === 'balance' && (
          <BalanceGameModal
            onClose={() => setActiveGameModal(null)}
            onWinner={() => {}}
          />
        )}
      </AnimatePresence>

      {/* 맛집 제보 바텀시트 */}
      <RestaurantSubmissionBottomSheet
        isOpen={isSubmissionOpen} 
        onClose={() => {
          setIsSubmissionOpen(false);
          setSubmissionTarget(null);
        }} 
        initialRestaurant={submissionTarget}
      />

      {/* SNS 로그인 모달 */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(mockUser) => {
          setUser(mockUser);
          localStorage.setItem('modoo-matjip-user', JSON.stringify(mockUser));
        }}
      />

      {/* 여행 일정 편집 바텀시트 */}
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

      {/* 3단계: 일정 계획 모바일 플로팅 패널 */}
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
            favorites={Array.from(savedIds)}
            restaurants={restaurants}
            onUpdateItinerary={(updated) => setActivePlanningItinerary(updated)}
            onResetCustomWaypoints={() => {
              setCustomWaypoints({});
      alert('경로 탐색 실패로 인해 직선 경로로 복구되었습니다.');
            }}
          />
        )}
      </AnimatePresence>

      {/* 3단계: 일정 아이템 시간/메모 입력 모달 */}
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

      {/* 새 일정 생성 설정 모달 (달력 날짜 선택 및 여행 옵션 설정) */}
      <CustomModal 
        isOpen={showInitPlanningModal} 
        onClose={() => setShowInitPlanningModal(false)}
          title="여행 일정 생성"
          subtitle="일정에 따른 맛집 정보를 안내해 드립니다."
      >
        <div className="flex flex-col gap-4 w-full text-white">
          {/* 일정 제목 입력 필드 */}
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

          {/* 달력 날짜 선택 UI (좌우 월 네비게이션 및 날짜 범위 선택) */}
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

          {/* 여행 스타일 선택 항목 */}
          <div className="space-y-3 pt-1">
            {/* 1. 동행자 */}
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

            {/* 2. 테마 */}
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

            {/* 3. 이동 수단 */}
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

          {/* 일정 생성 확인 버튼 */}
          <button
            onClick={handleStartNewPlanning}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-[0.98] text-[11px] font-black text-white shadow-lg shadow-red-500/20 transition-all flex items-center justify-center cursor-pointer border border-white/10"
          >
            일정 생성
          </button>
        </div>
      </CustomModal>

      {/* 유튜브 영상 전체화면 재생 모달 */}
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


