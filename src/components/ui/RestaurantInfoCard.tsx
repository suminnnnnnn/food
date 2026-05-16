import { Restaurant } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Utensils, ExternalLink, X, Play, MessageCircleHeart, Flame, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { MichelinIcon, BlueRibbonIcon } from '@/components/icons/CustomIcons';

interface RestaurantInfoCardProps {
  restaurant: Restaurant | null;
  onClose: () => void;
}

export default function RestaurantInfoCard({ restaurant, onClose }: RestaurantInfoCardProps) {
  // 썸네일 대신 실제 유튜브 영상 뷰어를 띄울지 여부
  const [isPlaying, setIsPlaying] = useState(false);

  // 식당이 바뀌면 재생 상태 초기화
  useEffect(() => {
    setIsPlaying(false);
  }, [restaurant?.id]);

  // 태그에 따라 아이콘과 색상을 매핑하는 헬퍼 함수
  const getTagStyle = (source: string) => {
    switch (source) {
      case 'michelin': return { bg: 'bg-red-700', text: 'text-white', icon: MichelinIcon };
      case 'blueribbon': return { bg: 'bg-blue-600', text: 'text-white', icon: BlueRibbonIcon };
      case 'ddoganjib': return { bg: 'bg-orange-500', text: 'text-white', icon: Flame };
      case 'netflix_chef': return { bg: 'bg-gray-900', text: 'text-white', icon: Utensils };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', icon: null };
    }
  };

  const Content = () => {
    if (!restaurant) return null;
    return (
    <>
      {/* 모바일 전용 드래그 핸들 */}
      <div className="w-full flex justify-center pt-3 pb-1 md:hidden shrink-0">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
      </div>

      {/* 데스크탑 뒤로가기 / 모바일 닫기 버튼 */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 md:right-auto md:left-4 p-2 bg-black/20 hover:bg-black/40 md:bg-white/80 md:hover:bg-white backdrop-blur-md rounded-full text-white md:text-gray-900 shadow-sm md:shadow-md transition-all z-40 group"
      >
        <X size={20} className="md:hidden" />
        <ArrowLeft size={20} className="hidden md:block group-hover:-translate-x-0.5 transition-transform" />
      </button>

      <div className="overflow-y-auto hide-scrollbar pb-8 flex-1">
        {/* 비디오/쇼츠 뷰어 영역 */}
        {restaurant.videos && restaurant.videos.length > 0 && (
          <div className="relative w-full bg-black shrink-0">
            {/* 블러 배경 (시네마틱 효과 - 재생 중이 아닐 때만 노출) */}
            {!isPlaying && (
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110"
                style={{ backgroundImage: `url(${restaurant.videos[0].thumbnail})` }}
              ></div>
            )}

            <div 
              className={`relative w-full flex justify-center items-center ${
                restaurant.videos[0].is_short ? 'h-[55vh] md:h-[65vh]' : 'aspect-video'
              }`}
            >
              {!isPlaying ? (
                <>
                  <img 
                    src={restaurant.videos[0].thumbnail} 
                    alt="Video Thumbnail" 
                    className={`w-full h-full object-cover ${restaurant.videos[0].is_short ? 'max-w-[320px] rounded-lg shadow-2xl' : ''}`}
                  />
                  
                  {/* 재생 버튼 오버레이 */}
                  <div 
                    onClick={() => setIsPlaying(true)}
                    className="absolute inset-0 bg-black/20 flex items-center justify-center group cursor-pointer transition-colors hover:bg-black/40"
                  >
                    <div className="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center text-white backdrop-blur-md shadow-2xl transform transition-transform group-hover:scale-110">
                      <Play size={28} className="ml-1" fill="currentColor" />
                    </div>
                  </div>

                  {/* 쇼츠 배지 */}
                  {restaurant.videos[0].is_short && (
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 border border-white/20">
                      <Play size={12} fill="currentColor" /> SHORTS
                    </div>
                  )}
                </>
              ) : (
                <iframe
                  src={`https://www.youtube.com/embed/${restaurant.videos[0].youtube_id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className={`w-full h-full ${restaurant.videos[0].is_short ? 'max-w-[320px] rounded-lg' : ''}`}
                ></iframe>
              )}
            </div>
          </div>
        )}

        <div className="p-6 md:p-8">
          {/* 큐레이션 배지 (미쉐린, 또간집 등) */}
          {restaurant.content_tags && restaurant.content_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {restaurant.content_tags.map((tag, idx) => {
                const style = getTagStyle(tag.source);
                const TagIcon = style.icon;
                return (
                  <span key={idx} className={`flex items-center gap-1 px-2.5 py-1 ${style.bg} ${style.text} text-[11px] font-bold rounded-md shadow-sm tracking-wide`}>
                    {TagIcon && <TagIcon size={12} />}
                    #{tag.label}
                  </span>
                );
              })}
            </div>
          )}

          {/* 식당 타이틀 & 카테고리 */}
          <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-1.5 tracking-tight leading-tight">
            {restaurant.name}
          </h3>
          <div className="flex items-center text-sm text-gray-500 font-medium mb-6">
            <Utensils size={14} className="mr-1.5" />
            {restaurant.category}
          </div>

          {/* 유튜브 한줄평 코멘트 박스 */}
          {restaurant.videos && restaurant.videos.length > 0 && (
            <div className="mb-8 bg-red-50/70 rounded-2xl p-4 md:p-5 border border-red-100 flex gap-3 items-start shadow-sm relative overflow-hidden">
              <div className="absolute -right-2 -top-2 opacity-5 text-red-500">
                <MessageCircleHeart size={80} />
              </div>
              <img 
                src={restaurant.videos[0].youtuber.profile_image} 
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-white shadow-md z-10" 
                alt="profile"
              />
              <div className="z-10">
                <span className="text-xs md:text-sm font-bold text-red-600 mb-1 block">
                  {restaurant.videos[0].youtuber.name}의 한줄평
                </span>
                <p className="text-[15px] md:text-base text-gray-900 leading-snug font-semibold">
                  {restaurant.videos[0].is_short 
                    ? `"1분만에 입 터지는 마법. 폼 미쳤다 ㄷㄷ"` 
                    : `"여기 만두는 진짜 미쳤습니다. 무조건 오픈런 하세요!"`}
                </p>
              </div>
            </div>
          )}

          {/* 주소 정보 */}
          <div className="flex items-start text-[15px] text-gray-700 mb-8 font-medium bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-100">
            <MapPin size={18} className="mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
            <span className="leading-snug">{restaurant.address}</span>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <a 
              href={`https://map.kakao.com/link/map/${restaurant.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 px-4 rounded-xl text-[15px] font-bold hover:bg-gray-800 transition-all hover:shadow-lg active:scale-[0.98]"
            >
              카카오맵 상세보기
              <ExternalLink size={16} />
            </a>
            <a 
              href={`https://map.kakao.com/link/to/${restaurant.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center bg-white text-gray-900 border-2 border-gray-200 py-3.5 px-4 rounded-xl text-[15px] font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
            >
              길찾기
            </a>
          </div>
        </div>
      </div>
    </>
    );
  };

  return (
    <AnimatePresence>
      {restaurant && (
        <>
          {/* 뒷배경 어둡게 처리 (Dimmer) - 모바일 전용 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="md:hidden absolute inset-0 bg-black/40 z-20"
          />

          {/* 데스크탑 클릭 영역 핸들러 (Dimmer 대신 투명 오버레이) */}
          <div onClick={onClose} className="hidden md:block absolute inset-0 z-20" />

          {/* 모바일 바텀 시트 (Bottom Sheet) */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="md:hidden absolute bottom-0 left-1/2 -translate-x-1/2 z-30 w-full max-w-md bg-white rounded-t-[32px] shadow-[0_-10px_50px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[85vh]"
          >
            <Content />
          </motion.div>

          {/* 데스크탑 좌측 패널 (Left Detail Sidebar) - 리스트 사이드바와 동일한 규격 */}
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="hidden md:flex absolute top-6 left-6 bottom-6 w-[380px] z-30 flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] border border-white/60 dark:border-slate-700/50 overflow-hidden"
          >
            <Content />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
