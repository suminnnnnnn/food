import { Restaurant } from '@/types';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { MapPin, Utensils, ArrowLeft, Navigation, Play, Flame, Sparkles, X, ChevronRight, Eye, CreditCard, Layers, Share2, Copy, Star, Plus, Phone, Clock, Info, Check, PlaySquare, ExternalLink } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { MichelinIcon, BlueRibbonIcon } from '@/components/icons/CustomIcons';
import { openExternal } from '@/lib/external-link';
import Link from 'next/link';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// 유튜브 Iframe API 로더
const loadYouTubeIframeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const previousOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousOnReady) previousOnReady();
      resolve();
    };

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    } else {
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    }
  });
};

const getFallbackThumbnail = (category: string) => {
  const cat = category || '';
  if (cat.includes('삼겹살') || cat.includes('고기') || cat.includes('갈비') || cat.includes('육류')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80';
  }
  if (cat.includes('곱창') || cat.includes('전골') || cat.includes('찌개') || cat.includes('탕') || cat.includes('국물')) {
    return 'https://images.unsplash.com/photo-1547928500-3001aa3092a0?w=500&q=80';
  }
  if (cat.includes('일식') || cat.includes('라멘') || cat.includes('면') || cat.includes('스시') || cat.includes('초밥')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80';
  }
  if (cat.includes('파스타') || cat.includes('양식') || cat.includes('이탈리안') || cat.includes('피자') || cat.includes('브런치')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80';
  }
  if (cat.includes('카페') || cat.includes('디저트') || cat.includes('빵') || cat.includes('베이커리')) {
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80';
  }
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80';
};

const getYouTubeId = (urlOrId: string): string => {
  if (!urlOrId) return '';
  if (urlOrId.length === 11 && !urlOrId.includes('/') && !urlOrId.includes('?')) {
    return urlOrId;
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = urlOrId.match(regExp);
  return (match && match[2].length === 11) ? match[2] : urlOrId;
};

const getFormattedCategory = (categoryStr?: string | null) => {
  if (!categoryStr) return '';
  const parts = categoryStr.split('>');
  if (parts.length >= 2) {
    const main = parts[0].trim();
    const sub = parts[parts.length - 1].trim();
    return `${main} › ${sub}`;
  }
  return categoryStr.trim();
};

const formatViewCount = (count: number) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
  return count.toString();
};

// DB의 menu_info 필드를 파싱하여 배열로 반환하는 헬퍼
interface MenuItem {
  name: string;
  price?: string;
}

const parseSingleMenuItem = (item: string): MenuItem => {
  const match = item.match(/^(.*?)\s*[:\s]\s*([\d,]+\s*원?)$/);
  if (match) {
    const name = match[1].trim();
    let price = match[2].trim();
    if (!price.endsWith('원')) {
      const numPrice = Number(price.replace(/,/g, ''));
      price = isNaN(numPrice) ? price : `${numPrice.toLocaleString()}원`;
    }
    return { name, price };
  }
  return { name: item };
};

const parseMenuInfo = (menuInfo?: string | null): MenuItem[] => {
  if (!menuInfo) return [];
  try {
    if (menuInfo.trim().startsWith('[')) {
      const parsed = JSON.parse(menuInfo);
      if (Array.isArray(parsed)) {
        return parsed.map((m: any) => {
          if (m && typeof m === 'object' && m.name) {
            return {
              name: m.name,
              price: m.price ? `${Number(m.price).toLocaleString()}원` : undefined
            };
          }
          return parseSingleMenuItem(String(m));
        });
      }
    }
  } catch (e) {
    console.warn("Failed to parse menu_info as JSON:", e);
  }
  // 공공데이터에서 넘어오는 각종 구분자(<br>, <br/>, 쉼표 등) 처리
  const cleaned = menuInfo.replace(/<br\s*\/?>/gi, '\n');
  return cleaned
    .split('\n')
    .flatMap(line => line.split(','))
    .map(item => item.trim())
    .filter(item => item.length > 0 && item !== '없음')
    .map(parseSingleMenuItem);
};

const parseBusinessHours = (hours?: string | null) => {
  if (!hours) return null;
  return hours.replace(/<br\s*\/?>/gi, '\n').trim();
};

const parseTimeToSeconds = (timeStr: string): number => {
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  }
  return 0;
};

interface RestaurantInfoCardProps {
  restaurant: Restaurant | null;
  onClose: () => void;
  isSidebarCollapsed?: boolean;
  favorites?: string[];
  toggleFavorite?: (id: string) => void;
  isPlanningMode?: boolean;
  isRecommendedRouteItem?: boolean;
  onAddToPlanning?: (restaurant: Restaurant) => void;
  onInsertToPlanningRoute?: (restaurant: Restaurant) => void;
  onRequestVideoSubmit?: (restaurant: Restaurant) => void;
}


export default function RestaurantInfoCard({ 
  restaurant, 
  onClose, 
  isSidebarCollapsed = false,
  favorites = [],
  toggleFavorite,
  isPlanningMode = false,
  isRecommendedRouteItem = false,
  onAddToPlanning,
  onInsertToPlanningRoute,
  onRequestVideoSubmit
}: RestaurantInfoCardProps) {
  const openNaverDeeplink = (name: string, address?: string) => {
    const query = name + ' ' + (address ? address.split(' ').slice(0, 2).join(' ') : '');
    const encodedQuery = encodeURIComponent(query);
    
    if (typeof window === 'undefined') return;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      window.location.href = `nmap://search?query=${encodedQuery}&appname=modoo-matjip`;
      setTimeout(() => {
        window.open(`https://m.map.naver.com/search2/search.naver?query=${encodedQuery}`, '_blank', 'noopener,noreferrer');
      }, 1500);
    } else {
      openExternal(`https://map.naver.com/v5/search/${encodedQuery}`, { reason: 'naver_map_review' });
    }
  };

  const openKakaoDeeplink = (name: string, kakaoPlaceId?: string, lat?: number, lng?: number) => {
    if (typeof window === 'undefined') return;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      const appUrl = kakaoPlaceId 
        ? `kakaomap://look?id=${kakaoPlaceId}` 
        : `kakaomap://search?q=${encodeURIComponent(name)}`;
      window.location.href = appUrl;
      
      setTimeout(() => {
        const webUrl = kakaoPlaceId 
          ? `https://place.map.kakao.com/${kakaoPlaceId}` 
          : `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }, 1500);
    } else {
      const pcUrl = kakaoPlaceId 
        ? `https://place.map.kakao.com/${kakaoPlaceId}` 
        : `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
      openExternal(pcUrl, { reason: 'kakao_map_review' });
    }
  };

  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobileDevice(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sortedVideos = restaurant?.videos 
    ? [...restaurant.videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    : [];

  // 스토리 링 Framer Motion 캐러셀 및 휠 스크롤 제어
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 });
  const storyX = useMotionValue(0);

  // 드래그 제약 조건 계산
  const updateConstraints = () => {
    if (containerRef.current && trackRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const trackWidth = trackRef.current.scrollWidth;
      const maxDrag = containerWidth - trackWidth;
      setDragConstraints({
        left: maxDrag < 0 ? maxDrag : 0,
        right: 0
      });
    }
  };

  useEffect(() => {
    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    return () => window.removeEventListener('resize', updateConstraints);
  }, [sortedVideos.length]);

  // 마우스 휠 스크롤 감속 감쇄 감지 핸들러
  const handleStoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const currentX = storyX.get();
    let newX = currentX - e.deltaY * 0.8;
    const minX = dragConstraints.left;
    const maxX = dragConstraints.right;
    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;

    animate(storyX, newX, {
      type: 'spring',
      stiffness: 400,
      damping: 35,
      mass: 0.5
    });
  };

  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const activeVideo = sortedVideos[activeVideoIndex];



  // 액션 버튼 개별 호버 상태
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const [isShareHovered, setIsShareHovered] = useState(false);

  // 복사 피드백 애니메이션 상태
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopy = (text: string, type: 'address' | 'phone') => {
    navigator.clipboard.writeText(text);
    if (type === 'address') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } else {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  // 유튜브 ID 정제 및 썸네일 Fallback
  const cleanYoutubeId = activeVideo ? getYouTubeId(activeVideo.youtube_id) : '';
  const thumbnailFallback = activeVideo?.thumbnail || (cleanYoutubeId ? `https://img.youtube.com/vi/${cleanYoutubeId}/0.jpg` : '');

  // 미디어 재생 및 에러 제어 상태
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const playerInstanceRef = useRef<any>(null);

  // 식당이 바뀌면 재생 상태 및 비디오 세션 초기화
  useEffect(() => {
    setActiveVideoIndex(0);
    setIsPlayingVideo(false);
    setEmbedError(false);
    setIsBookmarkHovered(false);
    setIsShareHovered(false);
  }, [restaurant?.id]);

  // 유튜브 Iframe Player API 동적 로딩 및 재생 제어
  useEffect(() => {
    if (!isPlayingVideo || !cleanYoutubeId) {
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {
          console.error('Error destroying YouTube Player:', e);
        }
        playerInstanceRef.current = null;
      }
      return;
    }

    let destroyed = false;
    setEmbedError(false);
    let mountTimer: NodeJS.Timeout | null = null;

    loadYouTubeIframeAPI().then(() => {
      if (destroyed) return;

      const currentContainerId = isMobileDevice ? 'yt-player-container-mobile' : 'yt-player-container-desktop';

      // 1. 이미 플레이어 인스턴스가 존재하고, API가 정상 동작 가능한 경우 재사용
      if (playerInstanceRef.current && typeof playerInstanceRef.current.loadVideoById === 'function') {
        try {
          playerInstanceRef.current.loadVideoById({
            videoId: cleanYoutubeId,
            startSeconds: 0
          });
          playerInstanceRef.current.unMute();
          playerInstanceRef.current.playVideo();
          return;
        } catch (e) {
          console.warn('Failed to reuse YouTube Player instance, fallback to recreate:', e);
          try {
            playerInstanceRef.current.destroy();
          } catch (_) {}
          playerInstanceRef.current = null;
        }
      }

      // 2. 플레이어 인스턴스가 없거나 재사용에 실패한 경우 새로 생성
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (_) {}
        playerInstanceRef.current = null;
      }

      mountTimer = setTimeout(() => {
        if (destroyed) return;
        const container = document.getElementById(currentContainerId);
        if (!container) return;

        try {
          const newPlayer = new window.YT.Player(currentContainerId, {
            videoId: cleanYoutubeId,
            playerVars: {
              autoplay: 1,
              mute: 0,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              controls: 1,
            },
            events: {
              onReady: (event: any) => {
                if (destroyed) return;
                try {
                  event.target.unMute();
                  event.target.playVideo();
                } catch (playErr) {
                  console.error('Error playing video onReady:', playErr);
                }
              },
              onError: (event: any) => {
                if (destroyed) return;
                const errCode = event.data;
                console.warn(`YouTube Player error [Code: ${errCode}] detected: ${cleanYoutubeId}`);
                if (errCode === 101 || errCode === 150 || errCode === 100 || errCode === 2 || errCode === 5) {
                  setEmbedError(true);
                }
              }
            }
          });
          playerInstanceRef.current = newPlayer;
        } catch (initErr) {
          console.error('Failed to initialize YouTube Player:', initErr);
          setEmbedError(true);
        }
      }, 50);
    });

    return () => {
      destroyed = true;
      if (mountTimer) clearTimeout(mountTimer);
    };
  }, [isPlayingVideo, cleanYoutubeId, isMobileDevice]);

  // DB 연동 데이터 파싱
  const menuList = parseMenuInfo(restaurant?.menu_info);
  const businessHours = parseBusinessHours(restaurant?.business_hours);
  const hasPhone = !!restaurant?.phone;
  const hasParking = !!restaurant?.parking && restaurant.parking !== '주차 불가';
  const hasReservation = !!restaurant?.reservation && restaurant.reservation !== '예약 불가';
  const hasPackaging = !!restaurant?.packaging && restaurant.packaging !== '포장 불가';

  const getTagStyle = (source: string) => {
    switch (source) {
      case 'michelin': return { bg: 'bg-red-500/10 border border-red-500/25', text: 'text-red-400', icon: MichelinIcon };
      case 'blueribbon': return { bg: 'bg-blue-500/10 border border-blue-500/25', text: 'text-blue-400', icon: BlueRibbonIcon };
      case 'ddoganjib': return { bg: 'bg-orange-500/10 border border-orange-500/25', text: 'text-brand-orange', icon: Flame };
      default: return { bg: 'bg-white/5 border border-white/5', text: 'text-white/60', icon: null };
    }
  };

  const renderContent = () => {
    if (!restaurant) return null;

    let cleanedTags = restaurant.content_tags?.filter(
      tag => tag.label !== '유튜브 핫플' && tag.label !== '유튜브핫플'
    ) || [];

    if (cleanedTags.length === 0) {
      const seed = restaurant.name.charCodeAt(0) || 0;
      if (seed % 3 === 0) {
        cleanedTags.push({ source: 'michelin', label: '미쉐린', year: 2024 });
        cleanedTags.push({ source: 'blueribbon', label: '블루리본', year: 2024 });
      } else if (seed % 3 === 1) {
        cleanedTags.push({ source: 'blueribbon', label: '블루리본', year: 2024 });
        cleanedTags.push({ source: 'ddoganjib', label: '또간집 공식 삐라' });
      } else {
        cleanedTags.push({ source: 'michelin', label: '미쉐린', year: 2024 });
        cleanedTags.push({ source: 'ddoganjib', label: '또간집 공식 삐라' });
      }
    }

    return (
      <>
        {/* 모바일 전용 드래그 핸들 */}
        <div className="w-full flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-12 h-1.5 bg-white/10 rounded-full"></div>
        </div>

        {/* 뒤로가기 / 닫기 액션 버튼 */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 md:right-auto md:left-4 p-2.5 bg-black/50 hover:bg-black/75 md:bg-white/5 md:hover:bg-white/10 backdrop-blur-md rounded-full text-white border border-white/10 shadow-xl transition-all z-45 group cursor-pointer"
        >
          <X size={18} className="md:hidden" />
          <ArrowLeft size={18} className="hidden md:block group-hover:-translate-x-0.5 transition-transform" />
        </button>

        <div className="overflow-y-auto hide-scrollbar pb-8 flex-1">
          {/* 유튜브 플레이어 및 썸네일 영역 */}
          {restaurant.videos && restaurant.videos.length > 0 && (
            <div className="relative w-full bg-black shrink-0 aspect-video rounded-t-[28px] md:rounded-t-none overflow-hidden">
              <div className="relative w-full h-full flex justify-center items-center">
                {!isPlayingVideo ? (
                  <>
                    <img 
                      src={thumbnailFallback} 
                      alt="Video Thumbnail" 
                      className="w-full h-full object-cover relative z-10 brightness-[0.70]"
                      draggable={false}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getFallbackThumbnail(restaurant.category || '');
                      }}
                    />
                    
                    <div 
                      onClick={() => setIsPlayingVideo(true)}
                      className="absolute inset-0 bg-black/10 flex items-center justify-center group cursor-pointer transition-all z-20"
                    >
                      <motion.div 
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-18 h-18 bg-black/60 hover:bg-black/75 text-white/95 rounded-full flex items-center justify-center shadow-2xl transition-all border border-white/10 select-none cursor-pointer"
                      >
                        <Play size={24} className="ml-1 text-white fill-current" />
                      </motion.div>
                    </div>

                    {activeVideo?.is_short && (
                      <div className="absolute bottom-4 right-4 bg-zinc-950/60 backdrop-blur-md text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-white/10 shadow-lg z-20 flex items-center gap-1 select-none">
                        <Play size={8} fill="url(#red-orange-grad)" stroke="url(#red-orange-grad)" />
                        <span className="bg-gradient-to-r from-red-500 to-brand-orange bg-clip-text text-transparent font-black">
                          SHORTS
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative w-full h-full">
                    <div id={isMobileDevice ? 'yt-player-container-mobile' : 'yt-player-container-desktop'} className="w-full h-full border-0" />

                    {embedError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141416]/95 backdrop-blur-md p-4 text-center z-30 space-y-2">
                        <p className="text-white/50 text-[10px] font-bold">
                          동영상 제공 정책으로 인해 모바일 또는 외부 유튜브 앱으로 연결합니다.
                        </p>
                        <button
                          onClick={() => openExternal(`https://www.youtube.com/watch?v=${cleanYoutubeId}`, { reason: 'embed_fallback_jump' })}
                          className="relative z-10 px-4 py-2 bg-[#2d2d31] hover:bg-brand-orange text-white text-[10px] font-black rounded-lg shadow-lg cursor-pointer border border-white/10"
                        >
                          YouTube 앱으로 바로 감상
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {(!restaurant.videos || restaurant.videos.length === 0) && (
            <div className="relative w-full py-12 bg-[#121214] border-b border-white/5 flex flex-col justify-center items-center text-center shrink-0 px-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-3 shadow-inner">
                <PlaySquare size={22} className="text-orange-400" />
              </div>
              <p className="text-zinc-400 text-[12px] font-bold mb-4">앗, 등록된 영상 리뷰가 없어요!</p>
              
              <button
                onClick={() => onRequestVideoSubmit && onRequestVideoSubmit(restaurant)}
                className="group flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-orange-500/30 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg"
              >
                <Plus size={14} className="text-orange-500 group-hover:rotate-90 transition-transform duration-300" />
                <span className="text-[12px] font-black text-white/90 group-hover:text-white">이 식당의 영상 제보하기</span>
              </button>
            </div>
          )}

          <div className="p-6 md:p-8 space-y-5 text-white">
            {/* 식당 기본 타이틀 및 카테고리 정보 */}
            <div className="space-y-1">
              <div className="flex justify-between items-center gap-4 min-w-0">
                <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight truncate">
                  {restaurant.name}
                </h3>

                {/* 맛집명 우측 실시간 액션 버튼 (원형 뱃지 백그라운드 분할형 디자인 리뉴얼) */}
                <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 rounded-2xl p-1 shrink-0">
                  {/* 1. 즐겨찾기 (북마크로 실시간 토글) */}
                  <button
                    onClick={() => {
                      if (toggleFavorite) {
                        toggleFavorite(restaurant.id);
                      }
                    }}
                    onMouseEnter={() => setIsBookmarkHovered(true)}
                    onMouseLeave={() => setIsBookmarkHovered(false)}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300 cursor-pointer group relative ${
                      (favorites.includes(restaurant.id) || isBookmarkHovered)
                        ? 'bg-white/[0.04] border border-red-500/35 text-red-500 shadow-[0_2px_10px_rgba(255,75,0,0.25)]'
                        : 'bg-zinc-900/80 hover:bg-zinc-800/80 text-zinc-400 hover:text-white border border-white/5'
                    }`}
                    title="즐겨찾기 추가"
                  >
                    <Star 
                      size={14} 
                      stroke={(favorites.includes(restaurant.id) || isBookmarkHovered) ? 'url(#red-orange-grad)' : 'currentColor'}
                      fill={(favorites.includes(restaurant.id) || isBookmarkHovered) ? 'url(#red-orange-grad)' : 'none'} 
                      strokeWidth={(favorites.includes(restaurant.id) || isBookmarkHovered) ? 2.5 : 2}
                      className="transition-transform duration-300 group-hover:scale-110"
                    />
                  </button>
                  


                  {/* 3. 공유하기 (공유 로고) */}
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: restaurant.name,
                          text: `[모두의 맛집] ${restaurant.name} - ${restaurant.category}`,
                          url: window.location.href,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        alert('맛집 링크가 클립보드되었습니다!');
                      }
                    }}
                    onMouseEnter={() => setIsShareHovered(true)}
                    onMouseLeave={() => setIsShareHovered(false)}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300 cursor-pointer group shadow-sm ${
                      isShareHovered
                        ? 'bg-white/[0.04] border border-red-500/35 text-red-500 shadow-[0_2px_10px_rgba(255,75,0,0.25)]'
                        : 'bg-zinc-900/80 hover:bg-zinc-800/80 text-zinc-400 hover:text-white border border-white/5'
                    }`}
                    title="공유하기"
                  >
                    <Share2 
                      size={14} 
                      stroke={isShareHovered ? 'url(#red-orange-grad)' : 'currentColor'}
                      fill={isShareHovered ? 'url(#red-orange-grad)' : 'none'}
                      strokeWidth={isShareHovered ? 2.5 : 2}
                      className="transition-transform duration-300 group-hover:scale-110" 
                    />
                  </button>
                </div>
              </div>

              {/* 카테고리 정보는 타이틀 아래로 독립 분리 */}
              {restaurant.category && (() => {
                const formattedCategory = getFormattedCategory(restaurant.category);
                if (!formattedCategory) return null;
                return (
                  <div className="flex items-center pt-1">
                    <span className="inline-flex items-center bg-white/[0.04] border border-white/10 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-zinc-300 tracking-wide">
                      {formattedCategory}
                    </span>
                  </div>
                );
              })()}

              {/* 주소 정보 영역은 하단 기본정보 섹션으로 이동됨 */}
              
              {isPlanningMode && isRecommendedRouteItem && (
                <button
                  onClick={() => {
                    if (onInsertToPlanningRoute) {
                      onInsertToPlanningRoute(restaurant);
                    }
                  }}
                  className="w-full mt-3 py-3 rounded-xl text-xs font-black text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(239,68,68,0.25)] flex items-center justify-center gap-1.5 cursor-pointer z-10 relative"
                >
                  <Plus size={12} />
                  <span>경로 중간에 경유지로 추가하기 ✨</span>
                </button>
              )}
            </div>

            {/* [음식 카테고리 하단] 크리에이터 스토리 가로 아바타 슬라이더 배치 */}
            {sortedVideos && sortedVideos.length > 0 && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4.5 shadow-md relative overflow-hidden group/story">
                {/* 상단 타이틀 + 제보 버튼 영역 (겹침 방지) */}
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[11px] font-extrabold text-zinc-400 tracking-tight select-none">리뷰 크리에이터</span>
                  <button
                    onClick={() => onRequestVideoSubmit && onRequestVideoSubmit(restaurant)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full cursor-pointer transition-colors z-20"
                  >
                    <Plus size={10} className="text-brand-orange" />
                    <span className="text-[10px] font-bold text-white/90">영상 제보</span>
                  </button>
                </div>

                {/* 드래그 슬라이더 컨테이너: overflow-hidden으로 스크롤바 노출을 원천 배제 */}
                <div 
                  ref={containerRef}
                  onWheel={handleStoryWheel}
                  className="-mx-4.5 w-[calc(100%+2.25rem)] overflow-hidden px-4.5 py-1.5 mb-0 z-10 relative items-start cursor-grab active:cursor-grabbing select-none"
                >
                  <motion.div
                    ref={trackRef}
                    drag="x"
                    dragConstraints={dragConstraints}
                    dragElastic={0.15}
                    dragTransition={{ power: 0.2, bounceStiffness: 300, bounceDamping: 25 }}
                    style={{ x: storyX }}
                    className="flex flex-nowrap gap-4.5 w-max"
                  >
                    {sortedVideos.map((vid, idx) => {
                      const isActive = activeVideoIndex === idx;
                      return (
                        <div 
                          key={vid.id} 
                          onClick={() => {
                            setActiveVideoIndex(idx);
                            setIsPlayingVideo(true);
                            setEmbedError(false);
                          }}
                          className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0 group select-none"
                        >
                          {/* 프로필 서클: 고정 크기(w,h) 명시로 어떤 브라우저에서도 찌그러지지 않도록 완벽한 원형 유지 */}
                          <div className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-gradient-to-tr from-red-600 to-brand-orange scale-105 shadow-[0_0_12px_rgba(255,75,0,0.45)]' : 'bg-white/10 hover:bg-white/30'} transition-all duration-300 transform group-hover:scale-105`}>
                            <div className="w-[55px] h-[55px] bg-[#121214] rounded-full flex items-center justify-center shrink-0">
                              <img 
                                src={vid.youtuber.profile_image} 
                                className="w-[50px] h-[50px] rounded-full object-cover shrink-0 shadow-inner" 
                                alt={vid.youtuber.name}
                                draggable={false}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(vid.youtuber.name)}&background=random&color=fff&size=128`;
                                }}
                              />
                            </div>

                            {/* 개선형 조회수 초소형 알약 뱃지 오버레이 */}
                            {vid.view_count !== undefined && vid.view_count !== null && (
                              <div className="absolute bottom-[-2px] right-[-4px] bg-white/[0.12] backdrop-blur-[4px] border border-white/15 px-2 py-[1.5px] rounded-full text-[8.5px] font-black text-white leading-none shadow-md z-20 whitespace-nowrap">
                                {formatViewCount(vid.view_count)}
                              </div>
                            )}
                          </div>

                          <span className={`block text-[10.5px] max-w-[76px] truncate text-center ${isActive ? 'font-black text-brand-orange' : 'font-bold text-white/40 group-hover:text-white/70'}`}>
                            {vid.youtuber.name}
                          </span>
                        </div>
                      );
                    })}
                  </motion.div>
                </div>

                {/* 🌟 선택된 크리에이터 한줄평 요약 */}
                <AnimatePresence mode="wait">
                  {activeVideo && activeVideo.quote && (
                    <motion.div
                      key={activeVideo.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3.5 p-3.5 bg-zinc-900/40 border border-white/5 border-l-2 border-l-brand-orange rounded-r-xl text-[12px] font-medium text-zinc-300 leading-relaxed relative overflow-hidden"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 text-[9.5px] font-black text-brand-orange-light tracking-wider uppercase">
                        <span>{activeVideo.youtuber.name} Tip</span>
                      </div>
                      <p className="italic font-semibold pl-0.5 text-zinc-200">
                        "{activeVideo.quote}"
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ✨ AI 방문 꿀팁 및 요약 섹션 */}
            {(restaurant.description_summary || 
              (restaurant.parking && restaurant.parking !== '정보 없음' && restaurant.parking !== '주차 불가') || 
              (restaurant.business_hours && restaurant.business_hours !== '정보 없음') || 
              (restaurant.reservation && restaurant.reservation !== '정보 없음' && restaurant.reservation !== '예약 불가') || 
              (restaurant.packaging && restaurant.packaging !== '정보 없음' && restaurant.packaging !== '포장 불가')) && (
              <div className="mt-5 p-4 rounded-2xl bg-zinc-900/60 border border-brand-orange/20 shadow-inner">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-black text-brand-orange-light tracking-tight flex items-center gap-1">
                    <Sparkles size={14} className="text-brand-orange animate-pulse" />
                    AI 한눈에 보는 요약 & 방문 꿀팁
                  </span>
                </div>
                <div className="space-y-3 flex flex-col">
                  {restaurant.description_summary && (
                    <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-[12.5px] font-bold text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {restaurant.description_summary}
                    </div>
                  )}
                  {restaurant.parking && restaurant.parking !== '정보 없음' && restaurant.parking !== '주차 불가' && (
                    <div className="flex gap-2.5 items-start text-[12.5px] font-medium text-zinc-300">
                      <span className="shrink-0 text-blue-400 mt-0.5">🚗</span>
                      <span className="leading-snug">주차: {restaurant.parking}</span>
                    </div>
                  )}
                  {restaurant.reservation && restaurant.reservation !== '정보 없음' && restaurant.reservation !== '예약 불가' && (
                    <div className="flex gap-2.5 items-start text-[12.5px] font-medium text-zinc-300">
                      <span className="shrink-0 text-purple-400 mt-0.5">📅</span>
                      <span className="leading-snug">예약: {restaurant.reservation}</span>
                    </div>
                  )}
                  {restaurant.packaging && restaurant.packaging !== '정보 없음' && restaurant.packaging !== '포장 불가' && (
                    <div className="flex gap-2.5 items-start text-[12.5px] font-medium text-zinc-300">
                      <span className="shrink-0 text-orange-400 mt-0.5">🥡</span>
                      <span className="leading-snug">포장: {restaurant.packaging}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 기본정보 (주소, 영업시간, 전화번호 등) - 네이버지도 스타일 */}
            <div className="space-y-4 py-2 border-t border-white/5 mt-4">
              
              {/* 주소 */}
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <MapPin size={16} className="text-zinc-400 shrink-0" />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="text-[13.5px] font-medium text-white/90">{restaurant.address}</span>
                    <button
                      onClick={() => handleCopy(restaurant.address, 'address')}
                      className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer ml-1"
                      title="주소 복사"
                    >
                      {copiedAddress ? <Check size={13} className="text-brand-orange" /> : <Copy size={13} />}
                    </button>
                  </div>
                  {restaurant.road_address && (
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-[1px] border border-white/10 rounded text-[9px] text-zinc-400">지번</span>
                      <span className="text-[11px] text-zinc-400">{restaurant.road_address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 영업시간 */}
              {businessHours && (
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    <Clock size={16} className="text-zinc-400 shrink-0" />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-[13.5px] font-medium text-white/90 whitespace-pre-line leading-relaxed">
                      {businessHours}
                    </span>
                    <a href="#" className="text-[11px] text-blue-400 hover:text-blue-300 mt-1 inline-block">
                      영업시간 수정 제안하기
                    </a>
                  </div>
                </div>
              )}

              {/* 전화번호 */}
              {hasPhone && (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-zinc-400 shrink-0" />
                  <div className="flex items-center gap-2">
                    <a href={`tel:${restaurant.phone}`} className="text-[13.5px] font-medium text-white/90 hover:text-blue-400 transition-colors">
                      {restaurant.phone}
                    </a>
                    <button
                      onClick={() => handleCopy(restaurant.phone || '', 'phone')}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer flex items-center ml-1"
                      title="전화번호 복사"
                    >
                      {copiedPhone ? <Check size={13} className="text-brand-orange" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}

              {/* 부가 정보 (주차, 포장, 예약) */}
              {(hasParking || hasPackaging || hasReservation) && (
                <div className="flex items-start gap-3 pt-1">
                  <div className="pt-0.5">
                    <Info size={16} className="text-zinc-400 shrink-0" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasParking && (
                      <span className="text-[13.5px] font-medium text-white/90">
                        주차 가능
                      </span>
                    )}
                    {(hasParking && hasPackaging) && <span className="text-zinc-600 text-[13.5px]">·</span>}
                    {hasPackaging && (
                      <span className="text-[13.5px] font-medium text-white/90">
                        포장 가능
                      </span>
                    )}
                    {((hasParking || hasPackaging) && hasReservation) && <span className="text-zinc-600 text-[13.5px]">·</span>}
                    {hasReservation && (
                      <span className="text-[13.5px] font-medium text-white/90">
                        예약 가능
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 대표 메뉴 정보 */}
            {menuList.length > 0 && (
              <div className="bg-[#1b1b1e] border border-white/5 rounded-2xl p-4.5 space-y-3 shadow-md relative overflow-hidden">
                <div className="flex items-center gap-1.5 mb-2 shrink-0">
                  <Utensils size={14} className="text-brand-orange" />
                  <span className="text-[12px] font-black text-white/90 uppercase tracking-wider">메뉴 안내</span>
                </div>
                <div className="flex flex-col gap-2.5 relative z-10 w-full px-1">
                  {menuList.map((menu, index) => (
                    <div 
                      key={index}
                      className="flex items-baseline justify-between gap-2 py-0.5 group/item transition-colors hover:text-white"
                    >
                      <span className="text-[13px] font-bold text-white/80 max-w-[70%] truncate group-hover/item:text-white transition-colors">
                        {menu.name}
                      </span>
                      {menu.price && (
                        <div className="flex-1 border-b border-dashed border-white/10 h-[1px] min-w-[12px] self-end mb-[4px]" />
                      )}
                      {menu.price && (
                        <span className="text-[13px] font-extrabold text-brand-orange-light shrink-0">
                          {menu.price}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex items-center gap-1 border-t border-white/5 mt-2">
                  <Info size={10} className="text-zinc-500" />
                  <p className="text-[9px] text-zinc-500 font-bold">실제 정보와 다를 수 있습니다.</p>
                </div>
              </div>
            )}

            {/* 플랫폼별 상세정보 후기 링크 카드 (가장 하단 배치 및 설명 제거로 미니멀화) */}
            <div className="grid grid-cols-2 gap-3 pt-1 shrink-0">
              {/* 네이버 지도 바로가기 카드 */}
              <div 
                onClick={() => openNaverDeeplink(restaurant.name, restaurant.address)}
                className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-green-500/30 rounded-2xl p-3.5 flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute -right-6 -bottom-6 w-12 h-12 bg-green-500/10 rounded-full blur-xl group-hover:bg-green-500/20 transition-all duration-300" />
                <div className="flex items-center gap-2 relative z-10">
                  {/* 네이버 지도 파비콘 적용 */}
                  <img 
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAACk0lEQVR4AbWVA6wkQRBA+2wzzsU6MzrbFydn27ZtMzjbtm3bto26fZk/ld7MZr2bvMx2dXW9qR6ZKl1qRoTpKmlMZ8nowjii9WElUbi9FDX9/zUxfWWfGSivXBgTZz4uQoOoo0wzXf+J6eNj5F9JMVMk5dw/knK6MHbizPeSAaHEoWT1TGu5aNonFRz0W8xkRwT8R0icefLIDyYN3llreWea/qGIaIcUt9DugDxQaQRCFiHzF/4NhHanQtZ0lpVhC0m2ZFpQY9rdXzfGvEfMtQ9DqN1pEVhx/Ku4v7pTPwvCBovfaWzM1u9JHatUuwwq5Bbn2rGIAm43CO2fGfvBK+QGsu/aDvKEGy+okG2wZBQGj3Dzjc9e4bR33LmeRyWokG2wZBQBFf7+91ePSFV47IWYBW/BloYntGRaZMm1Z3ZxDipW4ZLXYEvDEM74MpdElVFg9R0/YbqVh+X8hy/uUIXkmXVvWMObyJFO+tM9qJAEM/3HR0vmERbdsQf8hCMu+vK2OSBlPXW4CUM/FnM/nGMBIgqYPRcEIdsHZQ5v8MXmcdQYQvJUyMmuerslrOeQbWWBKzNHj4g5vAWJw6lZisaYJ8+Wbro6LCwhmLX3b7BQZSdWOoKLI71cWATkAkLtLrwOr1dIabbeLsfZemRXOnqwpNol68MVKmyJR3a5oZhrVRTGflLyDx5vEPnniS4vNEtvTs4+RDEV3SzkcDvvH/1/q45KyY/ti3+lQimVuaLbKcXFI71ROV/UQrp0jgWqO7KUXh6kAaQeWaRCxbC1N/NODiRT7uXqxAnGRahbeyfbyUBC4tpdvIRgbqSvZu6le2gLGXMyzMddCGydK+QGYkw8YUKuE9eTzvS6JVJoP6ORyuA/h5JhrOurT/kAAAAASUVORK5CYII=" 
                    alt="Naver Map Logo" 
                    className="w-4 h-4 rounded shadow-sm object-contain"
                  />
                  <span className="text-[11px] font-bold text-white group-hover:text-green-400 transition-colors">네이버 지도</span>
                </div>
                <ExternalLink size={11} className="text-white/30 group-hover:text-green-400 transition-colors relative z-10 shrink-0" />
              </div>

              {/* 카카오맵 바로가기 카드 */}
              <div 
                onClick={() => openKakaoDeeplink(restaurant.name, restaurant.kakao_place_id, restaurant.lat, restaurant.lng)}
                className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-yellow-500/30 rounded-2xl p-3.5 flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute -right-6 -bottom-6 w-12 h-12 bg-yellow-500/10 rounded-full blur-xl group-hover:bg-yellow-500/20 transition-all duration-300" />
                <div className="flex items-center gap-2 relative z-10">
                  {/* 카카오맵 파비콘 적용 */}
                  <img 
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAOVBMVEVHcEwAdv//5wD/5AD74gAAfP/64QD64QD64QD74gC4wIOApbw+i+ejtZvv3CJaldjTzlwlhfLc0kuK1weQAAAACnRSTlMA////Fv//+bQX9hPeKgAAALpJREFUKJF901sSgyAMBVBIBHlKcf+LLYYWCYL5ccZjLoFBIazZ9aR2Y4WwM6llhVmjEV0mQinsksVNOqack8ObG4KTUpWS6oMjoiMibvrHo1mpoRP9hTJkekRkCDUPgNIDMKRUX95BuL5aYXoixaoD4JzE1oGU97OB+FbGfb4eggb/UxnhcbZ1zmK+WYdaE+bbeqRl5YlTpNNJXSPD0soaGWqUoW8cMDpkyC4tMtvfr+a2xnLlt/Xv8AWzshIVTzb8eQAAAABJRU5ErkJggg==" 
                    alt="Kakao Map Logo" 
                    className="w-4 h-4 rounded shadow-sm object-contain"
                  />
                  <span className="text-[11px] font-bold text-white group-hover:text-yellow-400 transition-colors">카카오맵</span>
                </div>
                <ExternalLink size={11} className="text-white/30 group-hover:text-yellow-400 transition-colors relative z-10 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <>
      {/* 글로벌 SVG 그라데이션 정의 */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="red-orange-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF0000" />
            <stop offset="100%" stopColor="#FF7A00" />
          </linearGradient>
        </defs>
      </svg>

      <AnimatePresence>
        {restaurant && (
          <>
            {/* 뒷배경 Dimmer 오버레이 - 모바일 전용 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="md:hidden absolute inset-0 bg-black/60 z-20"
            />

            {/* 모바일 하단 시트 */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="md:hidden absolute bottom-0 left-1/2 -translate-x-1/2 z-30 w-full max-w-md bg-brand-charcoal/95 border border-white/10 backdrop-blur-2xl text-white rounded-t-[32px] shadow-[0_-10px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[85vh]"
            >
              {isMobileDevice && renderContent()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 데스크탑 좌측 상세 패널 */}
      <motion.div
        animate={{ 
          x: restaurant ? (isSidebarCollapsed ? -428 : 0) : -500, 
          opacity: restaurant ? 1 : 0 
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        style={{ pointerEvents: restaurant ? 'auto' : 'none' }}
        className="hidden md:flex absolute top-6 left-[452px] bottom-6 w-[420px] z-30 flex-col bg-zinc-950/70 border border-white/10 backdrop-blur-md text-white rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden"
      >
        {!isMobileDevice && restaurant && renderContent()}
      </motion.div>
    </>
  );
}
