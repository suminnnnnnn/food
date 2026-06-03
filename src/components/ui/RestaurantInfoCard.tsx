import { Restaurant } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Utensils, ArrowLeft, Navigation, Play, Flame, Sparkles, X, ChevronRight, Eye, CreditCard, Layers, Share2, Copy, Star, Plus } from 'lucide-react';
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

// 맛집 고유의 AI 기반 실감형 대표 메뉴 및 가격, 타임라인 생성 헬퍼
const getGourmetMenuAndCuration = (restaurantName: string, category: string, activeVideo: any, allVideos: any[] = []) => {
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const cat = category || '';

  const getMenuForVideo = (vid: any) => {
    const videoSeed = getHash(restaurantName + (vid?.youtube_id || ''));
    const youtuberName = vid?.youtuber?.name || '미식가';
    
    if (cat.includes('삼겹살') || cat.includes('고기') || cat.includes('갈비') || cat.includes('육류')) {
      const menuOpts = [
        { name: '숙성 뼈탄삼겹살 (180g)', price: 19000, description: '장인의 손길로 숙성한 쫀득한 육즙' },
        { name: '짚불 우대갈비 (280g)', price: 32000, description: '짚불 향을 입힌 부드러운 소갈비' },
        { name: '매콤 항정살 (150g)', price: 21000, description: '쫄깃한 식감에 특제 비법 양념을 가미한 특수부위' },
        { name: '벌집 껍데기 (150g)', price: 11000, description: '바삭하게 구워 콩가루에 찍어 먹는 쫀득 고소 벌집껍데기' },
        { name: '한우 차돌박이 (150g)', price: 28000, description: '야들야들하고 고소한 풍미가 진동하는 최고급 한우 차돌' },
        { name: '꽃게 된장찌개', price: 8000, description: '신선한 꽃게와 전통 시골된장을 풀어 끓여낸 찌개' }
      ];
      const startIdx = videoSeed % (menuOpts.length - 2);
      return menuOpts.slice(startIdx, startIdx + 3).map(menu => ({
        ...menu,
        description: `[${youtuberName} 추천] ${menu.description}`
      }));
    } else if (cat.includes('곱창') || cat.includes('전골') || cat.includes('찌개') || cat.includes('탕') || cat.includes('국물')) {
      const menuOpts = [
        { name: '소곱창 전골 (중)', price: 38000, description: '화끈하고 녹진한 특제 비법 육수의 전골' },
        { name: '한우 소곱창구이 (200g)', price: 26000, description: '속이 꽉 찬 곱과 고소한 맛의 한우 곱창' },
        { name: '특상 대창구이 (200g)', price: 25000, description: '입안 가득 퍼지는 고소한 풍미와 부드러운 대창' },
        { name: '특 대창떡볶이', price: 18000, description: '대창의 고소함과 떡볶이의 매콤함이 어우러진 시그니처 퓨전 메뉴' },
        { name: '곱창 라면', price: 6000, description: '곱창 육수를 섞어 끓여 낸 얼큰하고 녹진한 라면' },
        { name: '눈꽃치즈 곱창볶음밥', price: 5000, description: '톡톡 튀는 날치알과 아낌없이 뿌린 모짜렐라 치즈' }
      ];
      const startIdx = videoSeed % (menuOpts.length - 2);
      return menuOpts.slice(startIdx, startIdx + 3).map(menu => ({
        ...menu,
        description: `[${youtuberName} 추천] ${menu.description}`
      }));
    } else if (cat.includes('일식') || cat.includes('라멘') || cat.includes('면') || cat.includes('스시') || cat.includes('초밥')) {
      const menuOpts = [
        { name: '특상 카이센동', price: 29000, description: '수산시장에서 엄선 공수한 최고 등급 모듬 사시미 덮밥' },
        { name: '돈코츠 쇼유라멘', price: 11000, description: '24시간 끓인 진하고 묵직한 돈골 베이스의 정통 라멘' },
        { name: '매운 츠케멘', price: 12000, description: '쫄깃한 극태면을 진한 어패류 스프에 찍어먹는 별미' },
        { name: '지라시 스시', price: 18000, description: '알록달록 흩뿌려진 각종 사시미와 밥의 고소함' },
        { name: '수제 안심 카츠 (4pc)', price: 9500, description: '촉촉한 핑크빛 육즙을 머금은 부드러운 안심 카츠' },
        { name: '토쿠조 오마카세 초밥 (12pc)', price: 35000, description: '그날 가장 좋은 생선만을 엄선해 쥐어주는 프리미엄 초밥' }
      ];
      const startIdx = videoSeed % (menuOpts.length - 2);
      return menuOpts.slice(startIdx, startIdx + 3).map(menu => ({
        ...menu,
        description: `[${youtuberName} 추천] ${menu.description}`
      }));
    } else if (cat.includes('파스타') || cat.includes('양식') || cat.includes('이탈리안') || cat.includes('피자') || cat.includes('브런치')) {
      const menuOpts = [
        { name: '트러플 크림 뇨끼', price: 21000, description: '고소한 트러플 페이스트와 감자로 빚은 이탈리아식 수제 수제 뇨끼' },
        { name: '쉬림프 바질 파스타', price: 18000, description: '생바질을 듬뿍 갈아 넣은 특제 페스토 소스 파스타' },
        { name: '라자냐 볼로네제', price: 22000, description: '시간 들여 끓여낸 미트소스와 치즈를 겹겹이 쌓아 올린 정통 오븐 오븐 파스타' },
        { name: '콰트로 포르마지 피자', price: 21000, description: '네 가지 프리미엄 고급 치즈가 들어가 꿀에 찍어먹는 피자' },
        { name: '클래식 시저 샐러드', price: 13000, description: '로메인에 크루통과 특제 시저 드레싱을 얹은 싱그러운 샐러드' },
        { name: '참나무 화덕 마르게리타 피자', price: 19500, description: '화덕에서 갓 구워낸 쫄깃쫄깃하고 신선한 마르게리타' }
      ];
      const startIdx = videoSeed % (menuOpts.length - 2);
      return menuOpts.slice(startIdx, startIdx + 3).map(menu => ({
        ...menu,
        description: `[${youtuberName} 추천] ${menu.description}`
      }));
    } else if (cat.includes('카페') || cat.includes('디저트') || cat.includes('빵') || cat.includes('베이커리')) {
      const menuOpts = [
        { name: '시그니처 아인슈페너', price: 6500, description: '부드러운 솔티크림을 올려 에스프레소의 깊은 맛과 조화' },
        { name: '벨기에 수플레 팬케이크', price: 14000, description: '오븐에서 즉석으로 구워낸 부드러운 정통 수플레' },
        { name: '수제 말차 스콘', price: 4800, description: '유기농 말차 가루로 구워 팥 앙금과 버터를 더한 스콘' },
        { name: '딸기 생크림 가득 케이크', price: 8500, description: '생딸기가 빼곡하게 박힌 동물성 100% 생크림 케이크' },
        { name: '수제 밀크티', price: 6500, description: '최고급 찻잎을 우유에 하루 동안 냉침하여 진하고 향긋한 티' },
        { name: '콜드브루 디카페인', price: 6000, description: '저온 추출하여 깔끔한 풍미' }
      ];
      const startIdx = videoSeed % (menuOpts.length - 2);
      return menuOpts.slice(startIdx, startIdx + 3).map(menu => ({
        ...menu,
        description: `[${youtuberName} 추천] ${menu.description}`
      }));
    } else {
      const menuOpts = [
        { name: '전통 비법 칼국수', price: 11000, description: '매일 아침 밀어낸 쫄깃한 면발과 담백한 고기 육수의 칼국수' },
        { name: '평양식 수제 만두 (6pc)', price: 12000, description: '얇은 만두피 안에 만두 소의 꽉 찬 육즙이 넘치는 평양식 수제만두' },
        { name: '해물 파전', price: 18000, description: '오징어, 조개, 쪽파를 듬뿍 올려 바삭바삭하게 지져낸 해물파전' },
        { name: '매콤 낙지볶음', price: 25000, description: '오동통한 낙지와 불향 나는 특제 소스의 매운맛 볶음' },
        { name: '한우 소고기 수육 (소)', price: 30000, description: '입에서 사르르 녹는 한우 아롱사태와 차돌양지 수육' },
        { name: '매콤 비빔국수', price: 10000, description: '아삭한 오이 고명과 새콤달콤한 비법 소스' }
      ];
      const startIdx = videoSeed % (menuOpts.length - 2);
      return menuOpts.slice(startIdx, startIdx + 3).map(menu => ({
        ...menu,
        description: `[${youtuberName} 추천] ${menu.description}`
      }));
    }
  };

  const allMergedMenuList: { name: string; price: number; description: string }[] = [];
  const menuNamesSet = new Set<string>();

  const targetVideos = allVideos && allVideos.length > 0 ? allVideos : (activeVideo ? [activeVideo] : []);
  targetVideos.forEach((vid) => {
    const menus = getMenuForVideo(vid);
    menus.forEach((m) => {
      if (!menuNamesSet.has(m.name)) {
        menuNamesSet.add(m.name);
        allMergedMenuList.push(m);
      }
    });
  });

  const creatorName = activeVideo?.youtuber?.name || '크리에이터';
  const quoteSeed = getHash(restaurantName + (activeVideo?.youtube_id || ''));
  
  const commentTemplates = [
    `"${activeVideo?.quote || '이곳은 정말 인생 맛집입니다. 육즙과 양념의 조화가 환상적이네요!'}"`,
    `"${activeVideo?.quote || '한 입 먹자마자 재방문을 결심한 곳입니다. 이 식감은 여기서만 느낄 수 있어요.'}"`,
    `"${activeVideo?.quote || '비법 소스가 면발과 고기에 착 감겨서 마지막까지 젓가락을 놓을 수 없었습니다.'}"`,
    `"${activeVideo?.quote || '정성이 가득 깃든 육수의 깊은 감칠맛이 추억을 소환하는 압권의 한 그릇입니다.'}"`
  ];
  const pickComment = commentTemplates[quoteSeed % commentTemplates.length];
  const pickTitle = `${creatorName} Pick`;

  const timecodes = [
    { time: "01:15", label: "경이로운 첫 입 비주얼 & 리얼 감탄" },
    { time: "03:30", label: "이 맛집만의 비법 조리/육수의 진수" },
    { time: "05:42", label: "유튜버 강력 추천 소스 꿀조합" },
    { time: "07:15", label: "총평 및 재방문 욕구 리액션" }
  ];

  return {
    menuList: allMergedMenuList.slice(0, 8),
    pickTitle,
    pickComment,
    timecodes
  };
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
  onInsertToPlanningRoute
}: RestaurantInfoCardProps) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const activeVideo = restaurant?.videos?.[activeVideoIndex];

  // 액션 버튼 개별 호버 상태
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const [isPinHovered, setIsPinHovered] = useState(false);
  const [isShareHovered, setIsShareHovered] = useState(false);

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
    setIsPinHovered(false);
    setIsShareHovered(false);
  }, [restaurant?.id]);

  // 유튜브 Iframe Player API 동적 로딩 및 재생 제어
  useEffect(() => {
    if (!isPlayingVideo || !cleanYoutubeId) return;

    let destroyed = false;
    setEmbedError(false);
    let mountTimer: NodeJS.Timeout | null = null;

    loadYouTubeIframeAPI().then(() => {
      if (destroyed) return;

      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {
          console.error('Error destroying previous YouTube Player:', e);
        }
        playerInstanceRef.current = null;
      }

      const containerId = `yt-player-${cleanYoutubeId}`;

      mountTimer = setTimeout(() => {
        if (destroyed) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
          const newPlayer = new window.YT.Player(containerId, {
            videoId: cleanYoutubeId,
            playerVars: {
              autoplay: 1,
              mute: 1,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              controls: 1,
            },
            events: {
              onReady: (event: any) => {
                if (destroyed) return;
                try {
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
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {
          console.error('Error destroying player on cleanup:', e);
        }
        playerInstanceRef.current = null;
      }
    };
  }, [isPlayingVideo, cleanYoutubeId]);

  // AI 큐레이션 데이터 연동
  const gourmetData = getGourmetMenuAndCuration(
    restaurant?.name || '',
    restaurant?.category || '',
    activeVideo,
    restaurant?.videos || []
  );

  const getTagStyle = (source: string) => {
    switch (source) {
      case 'michelin': return { bg: 'bg-red-500/10 border border-red-500/25', text: 'text-red-400', icon: MichelinIcon };
      case 'blueribbon': return { bg: 'bg-blue-500/10 border border-blue-500/25', text: 'text-blue-400', icon: BlueRibbonIcon };
      case 'ddoganjib': return { bg: 'bg-orange-500/10 border border-orange-500/25', text: 'text-brand-orange', icon: Flame };
      default: return { bg: 'bg-white/5 border border-white/5', text: 'text-white/60', icon: null };
    }
  };

  const Content = () => {
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
                      <div className="absolute top-4 left-4 bg-gradient-to-r from-red-600 to-brand-orange text-white text-[9px] font-black px-2 py-0.5 rounded-lg tracking-wider z-20 shadow-md">
                        SHORTS
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative w-full h-full">
                    <div id={`yt-player-${cleanYoutubeId}`} className="w-full h-full border-0" />

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
            <div className="relative w-full aspect-[21/9] bg-gradient-to-br from-brand-charcoal to-[#1e1e21] border-b border-white/10 p-6 flex flex-col justify-center items-center text-center overflow-hidden shrink-0">
              <div className="relative z-10 space-y-2 flex flex-col items-center">
                <div className="w-9 h-9 bg-brand-orange/10 border border-brand-orange/30 text-brand-orange rounded-full flex items-center justify-center shadow-md animate-pulse">
                  <Sparkles size={14} className="fill-current" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-white text-xs font-black tracking-tight">공식 미식 가이드 인증 지점</h3>
                  <p className="text-white/40 text-[9px] font-bold max-w-[280px]">
                    검증된 국내외 대표 미식 평가단이 보증한 핫플입니다.
                  </p>
                </div>
              </div>
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
                  
                  {/* 2. 길찾기 (핀 모양 아이콘) */}
                  <button
                    onClick={() => {
                      openExternal(`https://map.kakao.com/link/map/${restaurant.id}`, { reason: 'kakao_map_direct' });
                    }}
                    onMouseEnter={() => setIsPinHovered(true)}
                    onMouseLeave={() => setIsPinHovered(false)}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300 cursor-pointer group shadow-sm ${
                      isPinHovered
                        ? 'bg-white/[0.04] border border-red-500/35 text-red-500 shadow-[0_2px_10px_rgba(255,75,0,0.25)]'
                        : 'bg-zinc-900/80 hover:bg-zinc-800/80 text-zinc-400 hover:text-white border border-white/5'
                    }`}
                    title="길찾기 이동"
                  >
                    <Navigation 
                      size={14} 
                      stroke={isPinHovered ? 'url(#red-orange-grad)' : 'currentColor'}
                      fill={isPinHovered ? 'url(#red-orange-grad)' : 'none'}
                      strokeWidth={isPinHovered ? 2.5 : 2}
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
              <div className="flex items-center text-xs font-bold text-zinc-400 pt-0.5">
                <svg className="w-3.5 h-3.5 mr-1.5 shrink-0" viewBox="0 0 24 24" fill="url(#red-orange-grad)">
                  <path d="M7 2C4.8 2 3 3.8 3 6c0 1.8 1.2 3.3 2.8 3.8l.7 10.7c.1.8.8 1.5 1.5 1.5s1.4-.7 1.5-1.5l.7-10.7C11.8 9.3 13 7.8 13 6c0-2.2-1.8-4-4-4H7z" />
                  <rect x="15" y="2" width="2.2" height="20" rx="1.1" />
                  <rect x="18.8" y="2" width="2.2" height="20" rx="1.1" />
                </svg>
                <span>
                  {restaurant.category}
                </span>
              </div>

              {/* 주소 정보 영역 (텍스트와 복사 아이콘으로만 구성, 카테고리 하단 배치) */}
              <div className="flex items-center text-xs font-bold text-zinc-400 pt-1">
                <MapPin size={13} stroke="url(#red-orange-grad)" className="mr-1.5 shrink-0" />
                <span>{restaurant.address}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(restaurant.address);
                    alert('주소가 클립보드에 복사되었습니다!');
                  }}
                  className="ml-1.5 p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer flex items-center"
                  title="주소 복사"
                >
                  <Copy size={12} />
                </button>
              </div>
              
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
            {restaurant.videos && restaurant.videos.length > 0 && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4.5 space-y-1 shadow-md relative overflow-hidden">
                <div className="flex gap-4.5 overflow-x-auto hide-scrollbar pb-1 z-10 relative">
                  {restaurant.videos.map((vid, idx) => {
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
                        {/* 프로필 서클: 빨간색과 주황색의 그라데이션 브랜드 아이덴티티 색상 적용 */}
                        <div className={`p-[2px] rounded-full ${isActive ? 'bg-gradient-to-tr from-red-600 to-brand-orange scale-105 shadow-[0_0_12px_rgba(255,75,0,0.45)]' : 'bg-white/10 hover:bg-white/30'} transition-all duration-300 transform group-hover:scale-105`}>
                          <div className="p-0.5 bg-brand-charcoal rounded-full">
                            <img 
                              src={vid.youtuber.profile_image} 
                              className="w-10 h-10 rounded-full object-cover border border-white/5 shadow-inner" 
                              alt={vid.youtuber.name}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(vid.youtuber.name)}&background=random&color=fff&size=128`;
                              }}
                            />
                          </div>
                        </div>
                        <span className={`text-[10px] max-w-[64px] truncate text-center ${isActive ? 'font-black text-brand-orange' : 'font-bold text-white/40 group-hover:text-white/70'}`}>
                          {vid.youtuber.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 중단: 크리에이터 미식 솔직 노트 */}
            {restaurant.videos && restaurant.videos.length > 0 && (
              <div className="bg-[#1b1b1e] border border-white/5 rounded-2xl p-4.5 space-y-3.5 shadow-sm relative overflow-hidden">
                <div className="flex gap-2.5 items-start">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <Flame size={12} stroke="url(#red-orange-grad)" fill="url(#red-orange-grad)" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black block">
                      <span className="bg-gradient-to-r from-red-500 to-brand-orange bg-clip-text text-transparent">
                        {gourmetData.pickTitle}
                      </span>
                    </span>
                    <p className="text-xs font-extrabold leading-snug text-white/90">
                      {gourmetData.pickComment}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 대표 메뉴 및 실물 가격표 */}
            <div className="bg-[#1b1b1e] border border-white/5 rounded-2xl p-4.5 space-y-3 shadow-md">
              <div className="flex items-center gap-1.5 mb-1 shrink-0">
                <CreditCard size={12} stroke="url(#red-orange-grad)" />
                <span className="text-[11px] font-black text-white/90 uppercase tracking-wider">대표 메뉴 및 실물 가격표</span>
              </div>
              <div className="space-y-2.5">
                {gourmetData.menuList.map((menu, index) => (
                  <div 
                    key={index}
                    className="flex flex-col gap-0.5 pb-2.5 border-b border-white/5 last:border-b-0 last:pb-0"
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-black text-white/95">{menu.name}</span>
                      <span className="text-xs font-extrabold tracking-tight">
                        <span className="bg-gradient-to-r from-red-500 to-brand-orange bg-clip-text text-transparent">
                          {menu.price.toLocaleString()}원
                        </span>
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-white/40 leading-tight">
                      {menu.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 기존 하단 주소 영역 제거됨 */}
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
              <Content />
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
        {restaurant && <Content />}
      </motion.div>
    </>
  );
}
