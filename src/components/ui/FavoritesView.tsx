'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MapPin, Trash2, ChevronRight, Award, Utensils } from 'lucide-react';
import { getRestaurantsByIds } from '@/lib/supabase/restaurants';
import { Restaurant } from '@/types';

interface FavoritesViewProps {
  onSelectRestaurant: (lat: number, lng: number, id: string) => void;
  onNavigateDetail: (id: string) => void;
}

export default function FavoritesView({ onSelectRestaurant, onNavigateDetail }: FavoritesViewProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // 로컬스토리지에서 즐겨찾기 ID 목록 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('favorite_restaurants');
        if (saved) {
          const ids = JSON.parse(saved);
          setFavoriteIds(ids);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to load favorite IDs from localStorage', e);
        setLoading(false);
      }
    }
  }, []);

  // ID 목록이 변경될 때마다 Supabase에서 상세 데이터 로드
  useEffect(() => {
    async function loadFavorites() {
      if (favoriteIds.length === 0) {
        setRestaurants([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getRestaurantsByIds(favoriteIds);
        setRestaurants(data);
      } catch (err) {
        console.error('Failed to fetch favorite restaurants', err);
      } finally {
        setLoading(false);
      }
    }
    loadFavorites();
  }, [favoriteIds]);

  // 즐겨찾기 제거 핸들러
  const handleRemoveFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 차단
    
    const nextIds = favoriteIds.filter(favId => favId !== id);
    setFavoriteIds(nextIds);
    try {
      localStorage.setItem('favorite_restaurants', JSON.stringify(nextIds));
      // 전역 이벤트를 디스패치하여 지도의 다른 컴포넌트들도 즐겨찾기 동기화할 수 있게 함
      window.dispatchEvent(new Event('favoritesUpdated'));
    } catch (err) {
      console.error('Failed to update favorites in localStorage', err);
    }
  };

  const getCurationStyle = (source: string) => {
    switch (source) {
      case 'michelin':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'blueribbon':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'ddoganjib':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      default:
        return 'bg-zinc-800 border-zinc-700 text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="w-full bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 animate-pulse flex justify-between items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-zinc-800 rounded w-1/3" />
              <div className="h-3 bg-zinc-800 rounded w-2/3" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-zinc-800" />
          </div>
        ))}
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Star className="w-12 h-12 text-zinc-600 mb-4 stroke-1 animate-pulse" />
        <p className="text-zinc-400 font-medium">저장된 맛집이 없습니다.</p>
        <p className="text-zinc-600 text-xs mt-1">마음에 드는 맛집을 발견하면 저장해 보세요!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 pb-8">
      <div className="flex justify-between items-center text-xs text-zinc-500 px-1">
        <span>총 {restaurants.length}개의 맛집</span>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {restaurants.map((restaurant, idx) => (
            <motion.div
              key={restaurant.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
              onClick={() => onNavigateDetail(restaurant.id)}
              className="group relative bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-900/90 hover:border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer shadow-md transition-all duration-300"
            >
              {/* 왼쪽 맛집 메타 데이터 */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white tracking-tight group-hover:text-brand-orange-light transition-colors truncate">
                    {restaurant.name}
                  </h3>
                  <span className="text-[10px] bg-zinc-800/80 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                    {restaurant.category || '음식점'}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <MapPin size={12} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{restaurant.address}</span>
                </div>

                {/* 큐레이션 배지 및 미쉐린/블루리본 뱃지 */}
                {restaurant.content_tags && restaurant.content_tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                    {restaurant.content_tags.slice(0, 3).map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className={`text-[9px] px-2 py-0.5 rounded border font-semibold flex items-center gap-0.5 ${getCurationStyle(
                          tag.source
                        )}`}
                      >
                        <Award size={10} className="shrink-0" />
                        {tag.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 오른쪽 제어/액션 영역 */}
              <div className="flex items-center gap-1 shrink-0">
                {/* 지도 이동 핀 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRestaurant(restaurant.lat, restaurant.lng, restaurant.id);
                  }}
                  className="p-2.5 rounded-xl bg-zinc-800/55 hover:bg-[#ff6b00]/10 border border-zinc-800/80 hover:border-[#ff6b00]/30 text-zinc-400 hover:text-[#ff6b00] transition-all flex items-center justify-center shadow-sm"
                  title="지도에서 바로보기"
                >
                  <MapPin size={15} />
                </button>

                {/* 즐겨찾기 해제(삭제) */}
                <button
                  onClick={(e) => handleRemoveFavorite(e, restaurant.id)}
                  className="p-2.5 rounded-xl bg-zinc-800/55 hover:bg-red-500/10 border border-zinc-800/80 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition-all flex items-center justify-center shadow-sm"
                  title="저장 취소"
                >
                  <Trash2 size={15} />
                </button>

                {/* 상세보기 화살표 */}
                <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors ml-1" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
