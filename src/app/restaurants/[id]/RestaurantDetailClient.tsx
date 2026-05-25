'use client';

import { Restaurant, Video, AffiliateProduct } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Utensils, ArrowLeft, Navigation, Share2, Flame, Play, ShoppingBag, ExternalLink, Home, X, Volume2, Sparkles, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { MichelinIcon, BlueRibbonIcon } from '@/components/icons/CustomIcons';
import { openExternal } from '@/lib/external-link';
import { supabase } from '@/lib/supabase/client';
import { AffiliateDisclosure } from '@/components/AffiliateDisclosure';
import Link from 'next/link';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

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

// 유튜브 ID 추출 정규식 헬퍼 함수 (DB 내 전체 URL 보관 등 다양한 불규칙 입력 데이터 완벽 정제)
const getYouTubeId = (urlOrId: string): string => {
  if (!urlOrId) return '';
  if (urlOrId.length === 11 && !urlOrId.includes('/') && !urlOrId.includes('?')) {
    return urlOrId;
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = urlOrId.match(regExp);
  return (match && match[2].length === 11) ? match[2] : urlOrId;
};

interface RestaurantDetailClientProps {
  restaurant: Restaurant;
}

export default function RestaurantDetailClient({ restaurant }: RestaurantDetailClientProps) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const activeVideo = restaurant.videos?.[activeVideoIndex];

  // 유튜브 ID 정제 및 썸네일 Fallback (불완전 데이터 방어 및 로드 무결성 확보)
  const cleanYoutubeId = activeVideo ? getYouTubeId(activeVideo.youtube_id) : '';
  const thumbnailFallback = activeVideo?.thumbnail || (cleanYoutubeId ? `https://img.youtube.com/vi/${cleanYoutubeId}/0.jpg` : '');

  // 미디어 컨트롤 및 Pip 스티키 연동 상태
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isStickyVideo, setIsStickyVideo] = useState(false);
  const [isPipClosed, setIsPipClosed] = useState(false);
  const mainVideoRef = useRef<HTMLDivElement>(null);

  // Instant Taste 제휴 쇼핑 상품 상태
  const [affiliateProduct, setAffiliateProduct] = useState<AffiliateProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  // 유튜브 플레이어 API 상태 및 예외 제어 관리
  const [embedError, setEmbedError] = useState(false);
  const playerInstanceRef = useRef<any>(null);

  useEffect(() => {
    setActiveVideoIndex(0);
    setIsPlayingVideo(false);
    setIsStickyVideo(false);
    setIsPipClosed(false);
    setEmbedError(false);
    loadAffiliateProduct(restaurant);
  }, [restaurant.id]);

  // 유튜브 Iframe Player API 동적 로딩 및 재생 수명주기 제어
  useEffect(() => {
    if (!isPlayingVideo || !cleanYoutubeId) return;

    let destroyed = false;
    setEmbedError(false);
    let mountTimer: NodeJS.Timeout | null = null;

    loadYouTubeIframeAPI().then(() => {
      if (destroyed) return;

      // 기존 플레이어 세션이 있다면 파괴하여 메모리 누수 원천 제거
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {
          console.error('Error destroying previous YouTube Player:', e);
        }
        playerInstanceRef.current = null;
      }

      const containerId = `yt-player-${cleanYoutubeId}`;

      // 가상 DOM 렌더링과 Iframe API 인스턴스화 타이밍 동기화를 위한 보정식 도입
      mountTimer = setTimeout(() => {
        if (destroyed) return;
        const container = document.getElementById(containerId);
        if (!container) {
          console.warn(`Target YouTube player container [${containerId}] not found in DOM yet.`);
          return;
        }

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
                console.warn(`YouTube Player error [Code: ${errCode}] detected for: ${cleanYoutubeId}`);
                // 에러 101, 150(임베드 차단), 100(삭제/비공개), 2(잘못된 ID), 5(HTML5) 검출 시 폴백 카드 노출
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
      }, 50); // 50ms 미세 지연 보정으로 마운트 타이밍 보장
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

  // IntersectionObserver를 통한 정밀한 메인 비디오 영역 스크롤 탈출 감지 (비디오 재생 중에만 스마트 작동)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // 비디오가 재생 중이지 않은 경우 관찰을 아예 개시하지 않음으로써 PIP 전환 오동작 원천 방지
    if (!isPlayingVideo) {
      setIsStickyVideo(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 레이아웃 계산 초기 상태(너비가 0인 시점)의 무의미한 교차 리포팅은 방어 무시
        if (entry.boundingClientRect && entry.boundingClientRect.width === 0) return;
        
        // 윈도우 스크롤이 맨 위에 가깝다면 절대 스티키로 판단하지 않음 (초기 레이아웃 요동 오감지 차단)
        if (typeof window !== 'undefined' && window.scrollY < 100) {
          setIsStickyVideo(false);
          return;
        }

        // 메인 플레이어가 화면 뷰포트에서 완전히 이탈했는지를 감지 (교차 영역 1% 미만일 때)
        setIsStickyVideo(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.05, // 5% 미만으로 보일 때 이탈로 신속 감지
      }
    );

    if (mainVideoRef.current) {
      observer.observe(mainVideoRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [restaurant.id, isPlayingVideo]);

  // 스크롤이 다시 맨 위로 복귀하여 메인 비디오가 화면에 모습을 드러내면, 닫혔던 Pip 상태를 자동으로 잠금 해제하여 순환 동선을 보존
  useEffect(() => {
    if (!isStickyVideo) {
      setIsPipClosed(false);
    }
  }, [isStickyVideo]);

  // 식당 카테고리별 정합 밀키트 (Mock)
  const getMockProduct = (res: Restaurant): AffiliateProduct => {
    const cat = res.category || '';
    const name = res.name || '';

    if (cat.includes('삼겹살') || cat.includes('고기') || name.includes('갈비') || name.includes('고기')) {
      return {
        id: 'mock-1',
        title: `[로켓프레시] 초신선 프리미엄 벌집 삼겹살 & 파절이 밀키트 (2인분)`,
        price: 15900,
        image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80',
        deeplink_url: 'https://www.coupang.com',
        category: '육류'
      };
    }
    if (cat.includes('곱창') || cat.includes('전골') || cat.includes('찌개') || cat.includes('탕')) {
      return {
        id: 'mock-2',
        title: `[로켓프레시] 칼칼하고 고소한 소곱창 전골 명가 밀키트 (2~3인분)`,
        price: 19800,
        image_url: 'https://images.unsplash.com/photo-1547928500-3001aa3092a0?w=500&q=80',
        category: '국물/요리',
        deeplink_url: 'https://www.coupang.com'
      };
    }
    if (cat.includes('일식') || cat.includes('라멘') || cat.includes('면') || name.includes('우동') || name.includes('소바')) {
      return {
        id: 'mock-3',
        title: `[로켓프레시] 하카타 정통 수제 챠슈 돈코츠라멘 2인 패키지`,
        price: 12500,
        image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
        category: '면류',
        deeplink_url: 'https://www.coupang.com'
      };
    }
    if (cat.includes('파스타') || cat.includes('양식') || cat.includes('이탈리안') || cat.includes('피자')) {
      return {
        id: 'mock-4',
        title: `[로켓프레시] 쉬림프 매콤 갈릭 로제 파스타 세트 (2인분)`,
        price: 11900,
        image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80',
        category: '양식',
        deeplink_url: 'https://www.coupang.com'
      };
    }
    return {
      id: 'mock-default',
      title: `[로켓프레시] ${res.name} 시그니처 감성의 프리미엄 간편 밀키트`,
      price: 14900,
      image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80',
      category: '간편조리',
      deeplink_url: 'https://www.coupang.com'
    };
  };

  const loadAffiliateProduct = async (res: Restaurant) => {
    setLoadingProduct(true);
    try {
      const { data } = await supabase
        .from('affiliate_products')
        .select('*')
        .limit(5);

      if (data && data.length > 0) {
        const matched = data.find(p => 
          p.keywords?.some((k: string) => res.category?.includes(k) || res.name?.includes(k)) ||
          p.title.includes(res.category || '')
        );
        if (matched) {
          setAffiliateProduct(matched as AffiliateProduct);
          return;
        }
        setAffiliateProduct(data[0] as AffiliateProduct);
      } else {
        setAffiliateProduct(getMockProduct(res));
      }
    } catch (err) {
      console.error("Affiliate product load fallback:", err);
      setAffiliateProduct(getMockProduct(res));
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleProductClick = async (product: AffiliateProduct) => {
    try {
      const parsedProductId = typeof product.id === 'number' ? product.id : null;
      await supabase.from('affiliate_events').insert({
        restaurant_id: restaurant.id,
        product_id: parsedProductId,
        event_type: 'click',
        session_id: `session-isr-${Date.now()}`,
        metadata: {
          source: 'isr_detail_bridge',
          product_title: product.title,
          is_mock: typeof product.id === 'string'
        }
      });
    } catch (e) {
      console.error("Failed to log event:", e);
    }

    openExternal(product.deeplink_url, { reason: 'affiliate_shop' });
  };

  const getTagStyle = (source: string) => {
    switch (source) {
      case 'michelin': return { bg: 'bg-red-700/20 border border-red-500/30', text: 'text-red-300', icon: MichelinIcon };
      case 'blueribbon': return { bg: 'bg-blue-600/20 border border-blue-500/30', text: 'text-blue-300', icon: BlueRibbonIcon };
      case 'ddoganjib': return { bg: 'bg-orange-500/20 border border-orange-500/30', text: 'text-brand-orange-light', icon: Flame };
      case 'netflix_chef': return { bg: 'bg-gray-800 border border-white/10', text: 'text-white/90', icon: Utensils };
      default: return { bg: 'bg-white/5 border border-white/5', text: 'text-white/80', icon: null };
    }
  };

  const staticMapUrl = `https://dapi.kakao.com/v2/maps/staticmap?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY || '96324fa9ee898b3f2c5e53cc0bcf8d74'}&cx=${restaurant.lng}&cy=${restaurant.lat}&level=4&mx=${restaurant.lng}&my=${restaurant.lat}&w=600&h=300&m=pin`;

  const isPipActive = isPlayingVideo && isStickyVideo && !isPipClosed;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-8 select-none">
      
      {/* 1. 글로벌 헤더 바 */}
      <header className="flex justify-between items-center border-b border-white/5 pb-5 shrink-0">
        <Link 
          href="/"
          className="flex items-center gap-2 group text-white/70 hover:text-white transition-colors"
        >
          <div className="p-2.5 bg-white/5 group-hover:bg-gradient-to-tr group-hover:from-brand-orange group-hover:to-brand-orange-light group-hover:scale-105 rounded-2xl border border-white/5 transition-all">
            <Home size={18} />
          </div>
          <span className="font-extrabold text-sm tracking-tight hidden sm:inline">모두의 맛집</span>
        </Link>
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-brand-orange to-brand-orange-light px-3.5 py-1.5 rounded-full text-xs font-black shadow-lg shadow-brand-orange/15 border border-brand-orange-light/20">
          🔥 CREATOR PICK
        </div>
      </header>

      {/* 2. 버티컬 단일 몰입형 미식 스토리텔링 컨프 */}
      
      {/* 1단계: 최상단 비디오 플레이어 영역 또는 미식 명가 큐레이션 인트로 비주얼 (예외 방어 설계 완료) */}
      {activeVideo ? (
        <>
          <div ref={mainVideoRef} className="relative w-full aspect-video rounded-[28px] bg-black/60 shadow-2xl z-20">
            
            {/* 영화관 풍의 시네마틱 맥동 후광 아우라 */}
            <motion.div 
              animate={{
                scale: [1, 1.03, 1],
                opacity: [0.25, 0.4, 0.25]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-brand-orange/20 blur-3xl rounded-full -z-10"
            />

            {/* 재생 끊김 방지를 위한 무중단 컨테이너 연동 (모바일 크기 정밀 보정) */}
            <div className={
              isPipActive
                ? "fixed bottom-6 right-6 w-[170px] sm:w-[280px] aspect-video z-50 rounded-2xl shadow-[0_12px_45px_rgba(255,94,0,0.4)] border-2 border-brand-orange bg-black overflow-hidden transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)"
                : "absolute inset-0 w-full h-full rounded-[28px] border border-white/10 bg-black overflow-hidden transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)"
            }>
              {isPlayingVideo ? (
                <div className="relative w-full h-full group">
                  {/* YouTube Iframe Player가 인스턴스화될 마운트 타겟 */}
                  <div id={`yt-player-${cleanYoutubeId}`} className="w-full h-full border-0" />

                  {/* 외부 재생 임베드 차단 감지 시 세련된 다크 안내 카드 노출 */}
                  {embedError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141416]/95 backdrop-blur-md p-6 text-center z-30 space-y-4">
                      <div className="absolute inset-0 bg-brand-orange/5 blur-xl rounded-full" />
                      <div className="w-11 h-11 rounded-full bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange-light relative z-10 animate-pulse">
                        <Flame size={18} className="fill-current" />
                      </div>
                      <div className="space-y-1.5 relative z-10 max-w-sm px-2">
                        <h4 className="text-white text-[13px] font-black tracking-tight">유튜브 외부 재생이 제한된 동영상입니다</h4>
                        <p className="text-white/40 text-[10px] font-semibold leading-relaxed">
                          해당 유튜버의 정책 및 저작권 설정으로 외부 플레이어의 스트리밍이 차단되었습니다. 오리지널 창작자를 존중하기 위해 유튜브 앱 또는 웹으로 즉시 이동하여 감상해 보세요!
                        </p>
                      </div>
                      <button
                        onClick={() => openExternal(`https://www.youtube.com/watch?v=${cleanYoutubeId}`, { reason: 'embed_fallback_jump' })}
                        className="relative z-10 px-4.5 py-2.5 bg-gradient-to-r from-brand-orange to-brand-orange-light hover:brightness-110 text-white text-[11px] font-black rounded-xl shadow-lg transition-all duration-300 flex items-center gap-1.5 cursor-pointer border border-brand-orange-light/15"
                      >
                        유튜브에서 바로 감상하기
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  )}
                  
                  {/* Pip 미니 플레이어 전용 간이 오버레이 및 터치 최적화 닫기 버튼 */}
                  {isPipActive && (
                    <div className="absolute inset-x-0 top-0 p-2 bg-gradient-to-b from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between z-10 pointer-events-auto">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-white/90 truncate max-w-[110px] sm:max-w-[180px]">
                        {activeVideo.youtuber.name} 추천 영상
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPipClosed(true);
                        }}
                        className="p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-all border border-white/15 shadow-md cursor-pointer"
                        title="미니 플레이어 닫기"
                      >
                        <X size={10} className="stroke-[2.5]" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative w-full h-full">
                  {/* 시네마틱 썸네일 블러 이미지 */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl scale-110"
                    style={{ backgroundImage: `url(${thumbnailFallback})` }}
                  />
                  <img 
                    src={thumbnailFallback} 
                    alt={activeVideo.title}
                    className="w-full h-full object-cover relative z-10 brightness-[0.85]" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getFallbackThumbnail(restaurant.category || '');
                    }}
                  />
                  
                  {/* 썸네일 내 숏츠 마크 */}
                  {activeVideo.is_short && (
                    <div className="absolute top-5 left-5 bg-gradient-to-r from-brand-orange to-brand-orange-light text-white text-[10px] font-black px-2.5 py-1 rounded-xl tracking-wider flex items-center gap-1 border border-brand-orange-light/20 shadow-lg z-20">
                      <Play size={8} fill="currentColor" /> SHORTS
                    </div>
                  )}

                  {/* 유튜브 오리지널 앱 딥링크 숏컷 칩 */}
                  <button
                    onClick={() => openExternal(`https://www.youtube.com/watch?v=${cleanYoutubeId}`, { reason: 'original_youtube_jump' })}
                    className="absolute top-5 right-5 z-20 px-3.5 py-1.5 bg-black/60 hover:bg-brand-orange hover:text-white backdrop-blur-md text-white text-[10px] font-black rounded-full border border-white/10 shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    title="유튜브 앱에서 감상"
                  >
                    <span>유튜브 앱으로 열기</span>
                    <ExternalLink size={10} />
                  </button>

                  {/* 중앙 재생(Play) 버튼 및 후광 마이크로 모션 */}
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <motion.button
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsPlayingVideo(true)}
                      className="relative w-16 h-16 rounded-full bg-brand-orange flex items-center justify-center text-white shadow-[0_8px_30px_rgba(255,94,0,0.5)] cursor-pointer border border-brand-orange-light/25 group overflow-hidden"
                    >
                      <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-1000" />
                      <Play size={22} className="ml-1 fill-current" />
                    </motion.button>
                  </div>

                  {/* 하단 조회수 정보 오버레이 */}
                  {activeVideo.view_count && (
                    <div className="absolute bottom-5 left-5 z-20 bg-black/55 backdrop-blur-md border border-white/10 text-white/90 text-[11px] font-black px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                      <Flame size={12} className="text-brand-orange fill-current" />
                      조회수 {activeVideo.view_count.toLocaleString()}뷰 돌파
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pip가 작동 중일 때 메인 자리 레이아웃 붕괴 및 시각적 구멍을 막는 전용 플레이스홀더 */}
            {isPipActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-[28px] border border-white/5 text-center p-6 space-y-3">
                <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-brand-orange-light/75">
                  <Volume2 size={18} className="animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-white text-xs font-extrabold tracking-tight">화면 구석에서 영상이 재생 중입니다</p>
                  <p className="text-white/35 text-[10px] font-semibold leading-normal">스크롤을 맨 위로 복귀하면 메인 화면으로 돌아옵니다.</p>
                </div>
              </div>
            )}
          </div>

          {/* 브라우저 자동 재생 음소거 안내 가이드 팁 (초프리미엄 UX 가이드) */}
          {isPlayingVideo && !isPipActive && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-brand-orange-light/80 bg-brand-orange/5 border border-brand-orange/10 py-2.5 px-4 rounded-xl"
            >
              <Volume2 size={12} className="animate-pulse text-brand-orange-light shrink-0" />
              <span className="leading-relaxed text-center sm:text-left">브라우저 자동 재생 정책에 따라 음소거로 재생이 시작됩니다. 영상 내의 볼륨 아이콘을 클릭하여 소리를 켜주세요.</span>
            </motion.div>
          )}
        </>
      ) : (
        /* 비디오가 제공되지 않는 미쉐린/블루리본 등 정통 명가용 프리미엄 스토리텔링 인트로 비주얼 (레이아웃 붕괴 완벽 원천 차단) */
        <div className="relative w-full aspect-[21/9] rounded-[28px] bg-gradient-to-br from-brand-charcoal to-[#1e1e21] border border-white/10 p-8 flex flex-col justify-center items-center text-center overflow-hidden shadow-2xl">
          <motion.div 
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.15, 0.3, 0.15]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 bg-gradient-to-tr from-brand-orange/20 to-transparent blur-3xl rounded-full"
          />
          <div className="relative z-10 space-y-4 flex flex-col items-center">
            <div className="w-12 h-12 bg-brand-orange/10 border border-brand-orange/35 text-brand-orange-light rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <Sparkles size={20} className="fill-current" />
            </div>
            <div className="space-y-1">
              <h3 className="text-white text-base font-black tracking-tight">공식 미식 가이드 인증 매장</h3>
              <p className="text-white/40 text-[11px] font-bold max-w-md leading-relaxed">
                해당 식당은 크리에이터 영상 외에도 미쉐린 가이드 및 블루리본 등의 검증 기관으로부터 최상의 맛을 공식 공인받은 미식 성지입니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2단계: 프리미엄 식당 기본 프로필 */}
      <div className="bg-white/5 border border-white/10 rounded-[28px] p-6 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/15 rounded-full filter blur-3xl -z-10" />
        
        {/* 미식 가이드 인증 엠블럼 뱃지 노출 */}
        {restaurant.content_tags && restaurant.content_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {restaurant.content_tags.map((tag, idx) => {
              const style = getTagStyle(tag.source);
              const TagIcon = style.icon;
              return (
                <Link 
                  key={idx} 
                  href={`/?search=%23${encodeURIComponent(tag.label)}`}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold ${style.bg} ${style.text} shadow-sm hover:scale-105 hover:brightness-110 active:scale-95 transition-all cursor-pointer`}
                >
                  {TagIcon && <TagIcon size={10} />}
                  #{tag.label}
                </Link>
              );
            })}
          </div>
        )}

        <h1 className="text-3xl font-black tracking-tight text-white mb-4">
          {restaurant.name}
        </h1>
        
        <div className="flex flex-col gap-3 text-[13px] text-white/70">
          <div className="flex items-center">
            <div className="p-2 bg-white/5 border border-white/5 rounded-xl mr-3 text-brand-orange-light">
              <Utensils size={14} />
            </div>
            <span className="font-semibold text-white/90">{restaurant.category}</span>
          </div>
          <div className="flex items-center">
            <div className="p-2 bg-white/5 border border-white/5 rounded-xl mr-3 text-brand-orange-light">
              <MapPin size={14} />
            </div>
            <span className="font-semibold text-white/90">{restaurant.address}</span>
          </div>
        </div>
      </div>

      {/* 3단계: 크리에이터 검증 라운지 */}
      {restaurant.videos && restaurant.videos.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-[28px] p-6 backdrop-blur-md">
          <div className="flex items-center gap-1.5 mb-5">
            <Flame size={18} className="text-brand-orange fill-current" />
            <span className="text-[15px] font-black tracking-tight text-white">이 맛집을 인증한 크리에이터들</span>
          </div>
          
          {/* 크리에이터 목록 가로 캐러셀 */}
          <div className="flex gap-5 overflow-x-auto hide-scrollbar pb-3">
            {restaurant.videos.map((vid, idx) => {
              const isActive = activeVideoIndex === idx;
              return (
                <div 
                  key={vid.id} 
                  onClick={() => {
                    setActiveVideoIndex(idx);
                    setIsPlayingVideo(true); // 아바타 터치 시 해당 크리에이터 영상으로 원활히 복원 및 재생 스위칭
                    setEmbedError(false); // 동영상 바뀔 때 에러 상태 리셋
                  }}
                  className="flex flex-col items-center gap-2.5 cursor-pointer shrink-0 group select-none"
                >
                  <div className={`p-[3px] rounded-full bg-gradient-to-tr ${isActive ? 'from-brand-orange-light to-brand-orange scale-105' : 'from-white/10 to-white/20 hover:from-white/30 hover:to-white/40'} transition-all duration-300 transform group-hover:scale-105`}>
                    <div className="p-0.5 bg-brand-charcoal rounded-full">
                      <img 
                        src={vid.youtuber.profile_image} 
                        className="w-14 h-14 rounded-full object-cover border border-white/5 shadow-inner" 
                        alt={vid.youtuber.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(vid.youtuber.name)}&background=random&color=fff&size=128`;
                        }}
                      />
                    </div>
                  </div>
                  <span className={`text-xs max-w-[76px] truncate text-center ${isActive ? 'font-black text-brand-orange-light' : 'font-bold text-white/40 group-hover:text-white/70'}`}>
                    {vid.youtuber.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* AI 큐레이션 키워드 태그 */}
          {activeVideo?.keywords && activeVideo.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-5 border-t border-white/5 mt-4">
              {activeVideo.keywords.map((kw, idx) => (
                <Link
                  key={`${activeVideo.id}-${kw}-${idx}`}
                  href={`/?search=%23${encodeURIComponent(kw)}`}
                  className="px-3.5 py-1.5 bg-[#252528] hover:bg-[#2d2d31] hover:text-white border border-brand-orange/15 text-brand-orange-light text-xs font-bold rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  #{kw}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4단계: Instant Taste 밀키트 쇼핑 배너 */}
      {affiliateProduct && (
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-orange/15 to-brand-orange-light/5 border border-brand-orange/20 p-5 shadow-2xl backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/10 rounded-full filter blur-2xl -z-10" />

          <div className="flex items-center gap-1.5 mb-4 shrink-0">
            <ShoppingBag size={16} className="text-brand-orange-light animate-pulse" />
            <span className="text-[11px] font-black text-brand-orange-light uppercase tracking-wider">Instant Taste 쇼핑</span>
          </div>

          <div className="flex gap-4 items-center">
            <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-lg">
              <img 
                src={affiliateProduct.image_url} 
                alt="Meal Kit" 
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-108" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80';
                }}
              />
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between h-24 py-1">
              <h4 className="text-[13px] font-bold text-white leading-snug tracking-tight text-ellipsis overflow-hidden">
                {affiliateProduct.title}
              </h4>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-brand-orange-light tracking-tight">
                  {affiliateProduct.price.toLocaleString()}원
                </span>
                <span className="text-xs text-white/35 line-through">
                  {Math.floor(affiliateProduct.price * 1.2 / 100) * 100}원
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-white/60 mt-4 leading-relaxed tracking-tight">
            크리에이터의 미식을 그대로 소환! 웨이팅 없는 초고속 로켓 배송으로 <span className="text-brand-orange-light font-extrabold">내일 집 앞</span>에서 밀키트를 만끽해 보세요. 🚀
          </p>

          <button 
            onClick={() => handleProductClick(affiliateProduct)}
            className="w-full mt-4 py-3.5 bg-gradient-to-r from-brand-orange to-brand-orange-light hover:brightness-110 text-white font-extrabold rounded-2xl text-xs tracking-tight transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-orange/15 border border-brand-orange-light/10"
          >
            대기 없이 바로 맛보기
            <ExternalLink size={12} />
          </button>
        </div>
      )}

      {/* 5단계: 미식 지도 및 길찾기 퀵 액션 */}
      <div className="bg-white/5 border border-white/10 rounded-[28px] p-6 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-1.5 mb-2">
          <CheckCircle2 size={15} className="text-brand-orange-light" />
          <h3 className="font-extrabold text-white text-[14px] tracking-tight">미식 내비게이션</h3>
        </div>
        
        {/* 정적 카카오 지도 이미지 */}
        <div 
          onClick={() => openExternal(`https://map.kakao.com/link/map/${restaurant.id}`, { reason: 'kakao_map' })}
          className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden border border-white/5 shadow-inner cursor-pointer group"
        >
          <img 
            src={staticMapUrl} 
            alt="Static Map Location" 
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500 brightness-90" 
          />
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center group-hover:bg-black/35 transition-all">
            <div className="px-3.5 py-2 bg-brand-charcoal/85 border border-white/10 backdrop-blur-md text-[11px] font-black rounded-xl flex items-center gap-1.5 text-white">
              <MapPin size={11} className="text-brand-orange-light" /> 큰 지도로 위치 열기
            </div>
          </div>
        </div>

        {/* 하단 퀵 링크 바 */}
        <div className="flex gap-3 pt-2">
          <button 
            onClick={() => openExternal(`https://map.kakao.com/link/to/${restaurant.id}`, { reason: 'kakao_navi' })}
            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Navigation size={14} />
            길찾기
          </button>
          <button 
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: restaurant.name,
                  text: `'${restaurant.name}' 정보와 영상을 즉시 확인하세요!`,
                  url: window.location.href,
                }).catch(console.error);
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('맛집 전파 링크가 클립보드에 복사되었습니다.');
              }
            }}
            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Share2 size={14} />
            공유하기
          </button>
        </div>
      </div>

      {/* 제휴사 공개 고지 배너 */}
      <AffiliateDisclosure />

    </div>
  );
}
