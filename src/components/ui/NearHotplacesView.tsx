'use client';

import { motion } from 'framer-motion';
import { Flame, Star, Play, Sparkles, Utensils, MapPin, ChevronRight } from 'lucide-react';
import { Restaurant } from '@/types';

interface NearHotplacesViewProps {
  displayedRestaurants: Restaurant[];
  favorites: string[];
  toggleFavorite: (id: string) => void;
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onNavigateDetail: (id: string) => void;
  onOpenSubmission: () => void;
  onTagClick: (tag: string) => void;
}

const formatViewCount = (count: number) => {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace('.0', '')}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}천`;
  return count.toLocaleString();
};

export default function NearHotplacesView({
  displayedRestaurants,
  favorites,
  toggleFavorite,
  onSelectRestaurant,
  onNavigateDetail,
  onOpenSubmission,
  onTagClick,
}: NearHotplacesViewProps) {
  
  // 리스트 컨테이너 애니메이션 설정
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  // 아이템 개별 애니메이션 설정
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } },
  };


  return (
    <div className="flex flex-col h-full bg-[#121214] text-white">
      {/* 글로벌 SVG 그라데이션 정의 */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="red-orange-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF0000" />
            <stop offset="100%" stopColor="#FF7A00" />
          </linearGradient>
        </defs>
      </svg>
      {/* 상단 타이틀 영역 */}
      <div className="px-6 pt-5 pb-3 shrink-0 flex items-center justify-between border-b border-white/5 bg-gradient-to-b from-[#1c1c1f] to-[#121214]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-orange animate-ping" />
          <h3 className="text-[17px] font-black tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">내 주변 인기 핫플레이스</h3>
        </div>
        <span className="text-[11px] font-black bg-brand-orange/15 text-brand-orange-light border border-brand-orange-light/20 px-2.5 py-1 rounded-full shadow-[0_2px_10px_rgba(255,138,0,0.1)]">
          {displayedRestaurants.length}개 발견
        </span>
      </div>

      {/* 핫플레이스 카드 리스트 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 hide-scrollbar scroll-smooth" style={{ scrollbarWidth: 'none' }}>
        {displayedRestaurants.length === 0 ? (
          /* 주변 식당이 없을 때의 공란 프리미엄 가이드 */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16 px-6 text-center bg-[#1c1c1f]/50 border border-white/5 rounded-[24px] shadow-inner"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange/25 to-brand-orange-light/5 border border-brand-orange-light/20 flex items-center justify-center mb-4 shadow-[0_8px_30px_rgba(255,138,0,0.15)]">
              <Sparkles className="text-brand-orange-light fill-current" size={24} />
            </div>
            <h4 className="text-[15px] font-black text-white/90">현재 지역에 발견된 맛집이 없습니다.</h4>
            <p className="text-[12px] text-white/40 mt-1.5 max-w-[240px] leading-relaxed font-medium">지도를 조금 이동하거나, 내가 알고 있는 보석 같은 맛집을 직접 제보해 보세요!</p>
            <button
              onClick={onOpenSubmission}
              className="mt-5 px-5 py-2.5 bg-gradient-to-r from-brand-orange to-brand-orange-light text-white text-[12px] font-black rounded-xl shadow-md shadow-brand-orange/15 hover:brightness-110 active:scale-95 transition-all cursor-pointer border border-brand-orange-light/10"
            >
              나만의 맛집 제보하기 +
            </button>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3.5"
          >
            {displayedRestaurants.map((restaurant) => {
              const hasVideo = restaurant.primary_video || (restaurant.videos && restaurant.videos.length > 0);
              const video = restaurant.primary_video || restaurant.videos?.[0];
              const isFav = favorites.includes(restaurant.id);
              const isMichelin = restaurant.content_tags?.some(t => t.source === 'michelin');
              const isBlueRibbon = restaurant.content_tags?.some(t => t.source === 'blueribbon');

              return (
                <motion.div
                  key={restaurant.id}
                  variants={itemVariants}
                  onClick={() => onSelectRestaurant(restaurant)}
                  className="group relative bg-[#1c1c1f]/90 hover:bg-[#242428] rounded-[24px] p-3.5 cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_32px_rgba(255,110,0,0.12)] border border-white/5 hover:border-brand-orange/20 transition-all duration-300 flex gap-4 items-center overflow-hidden"
                >
                  {/* 카드 내부 오렌지 글로우 효과 */}
                  <div className="absolute -inset-px bg-gradient-to-br from-brand-orange/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[24px]" />

                  {/* 썸네일 영역 */}
                  <div className="relative w-[96px] h-[96px] shrink-0 rounded-2xl overflow-hidden bg-[#121214] border border-white/5 shadow-inner">
                    {video?.thumbnail ? (
                      <img
                        src={video.thumbnail}
                        alt={restaurant.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 bg-gradient-to-br from-white/[0.02] to-white/[0.06]">
                        <Utensils size={28} />
                      </div>
                    )}

                    {/* 비디오 재생 표시기 또는 뱃지 */}
                    {video?.is_short && (
                      <div className="absolute top-1.5 left-1.5 bg-black/35 backdrop-blur-md border border-white/10 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 tracking-tight shadow-sm">
                        <Play size={7} fill="currentColor" /> SHORTS
                      </div>
                    )}
                  </div>

                  {/* 식당 정보 정보 */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 h-[96px] relative z-10">
                    <div className="space-y-1">
                      {/* 타이틀 및 카테고리 */}
                      <div className="flex items-baseline gap-1.5">
                        <h4 className="font-black text-[15px] text-white tracking-tight truncate group-hover:text-brand-orange-light transition-colors">{restaurant.name}</h4>
                        <span className="text-[11px] font-bold text-white/30 shrink-0">| {restaurant.category}</span>
                      </div>

                      {/* 미식 콘텐츠 출처 표시 */}
                      {video?.youtuber ? (
                        <div className="flex items-center text-[11.5px] font-bold text-white/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />
                          <span className="truncate">{video.youtuber.name} 추천</span>
                        </div>
                      ) : isMichelin ? (
                        <div className="flex items-center text-[11.5px] font-bold text-brand-orange-light">
                          <Star size={11} className="mr-1 text-brand-orange fill-current shrink-0" />
                          <span>미쉐린 가이드 추천</span>
                        </div>
                      ) : isBlueRibbon ? (
                        <div className="flex items-center text-[11.5px] font-bold text-blue-400">
                          <span className="mr-1.5 text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/35 px-1 py-[0.5px] rounded font-black shrink-0">리본</span>
                          <span>블루리본 서베이 수록</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-[11.5px] font-bold text-white/30">
                          <MapPin size={10} className="mr-1" />
                          <span className="truncate">{restaurant.address.split(' ').slice(0, 2).join(' ')}</span>
                        </div>
                      )}
                    </div>

                    {/* 태그 목록 */}
                    <div className="flex gap-1.5 overflow-x-auto hide-scrollbar scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                      {restaurant.content_tags?.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTagClick(tag.label);
                          }}
                          className="whitespace-nowrap px-2 py-0.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[9.5px] font-black rounded-md border border-white/5 transition-all cursor-pointer"
                        >
                          #{tag.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 액션 버튼 영역 (우측 끝 정렬) */}
                  <div className="flex flex-col items-center justify-between h-[96px] shrink-0 pl-1 relative z-10">
                    {/* 찜하기(하트) 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(restaurant.id);
                      }}
                      className={`p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 shadow-sm border border-white/5 cursor-pointer ${
                        isFav 
                          ? 'bg-red-500/10 border-red-500/20 shadow-[0_2px_10px_rgba(255,75,0,0.25)]' 
                          : 'bg-white/[0.03] text-white/30 hover:text-red-500/60'
                      }`}
                    >
                      <Star 
                        size={15} 
                        stroke={isFav ? 'url(#red-orange-grad)' : 'currentColor'}
                        fill={isFav ? 'url(#red-orange-grad)' : 'none'} 
                        strokeWidth={isFav ? 2.5 : 2}
                        className={isFav ? 'drop-shadow-[0_0_4px_rgba(255,75,0,0.5)]' : ''} 
                      />
                    </button>

                    {/* 상세보기 화살표 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateDetail(restaurant.id);
                      }}
                      className="p-1.5 rounded-full bg-white/[0.03] hover:bg-white/10 border border-white/5 text-white/30 hover:text-white transition-all cursor-pointer"
                      title="상세 정보 보기"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
