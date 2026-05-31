'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DailyItinerary, ItineraryItem, Itinerary, Restaurant } from '@/types';
import { MapPin, Clock, Trash2, ChevronUp, ChevronDown, Check, X, Plus, Sparkles, Navigation, Edit3, ArrowLeft, Search } from 'lucide-react';

interface Props {
  itinerary: Itinerary;
  activeDay: number;
  onActiveDayChange: (day: number) => void;
  onRemoveItem: (itemId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onEditItemMemo: (item: ItineraryItem) => void;
  onSave: () => void;
  onClose: () => void;
  selectedItemId: string | null;
  onSelectItem: (item: ItineraryItem) => void;
  recommendedRestaurants: { restaurant: Restaurant; distance: number; type: 'near' | 'on_the_way' }[];
  onAddRecommendedRestaurant: (restaurant: Restaurant) => void;
  onRestaurantDrop?: (restaurant: Restaurant) => void;
  
  // 인라인 검색 대응 프롭
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: any[];
  isSearching: boolean;
  onSearchPlaces: () => void;
  onAddPlaceFromSearch: (place: any) => void;
}

export default function FloatingItineraryPanel({
  itinerary,
  activeDay,
  onActiveDayChange,
  onRemoveItem,
  onMoveUp,
  onMoveDown,
  onEditItemMemo,
  onSave,
  onClose,
  selectedItemId,
  onSelectItem,
  recommendedRestaurants,
  onAddRecommendedRestaurant,
  onRestaurantDrop,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  isSearching,
  onSearchPlaces,
  onAddPlaceFromSearch
}: Props) {
  const [isSearchingMode, setIsSearchingMode] = useState<boolean>(false);
  const currentDayData = itinerary.days.find(d => d.day === activeDay);
  const items = currentDayData?.items || [];

  const formatDistance = (distKm: number): string => {
    const meters = distKm * 1000;
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${distKm.toFixed(1)}km`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, y: 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        try {
          const dataStr = e.dataTransfer.getData('text/plain');
          if (dataStr) {
            const data = JSON.parse(dataStr);
            if (data && data.name && onRestaurantDrop) {
              onRestaurantDrop(data);
            }
          }
        } catch (err) {
          console.error("Drop failed", err);
        }
      }}
      className="absolute right-4 top-20 bottom-24 w-80 bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl z-40 p-4 flex flex-col min-h-0 text-white"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-2 shrink-0 border-b border-white/5">
        <div>
          {isSearchingMode ? (
            <div className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white transition-colors" onClick={() => setIsSearchingMode(false)}>
              <ArrowLeft size={16} />
              <span className="text-xs font-black">검색 모드 종료</span>
            </div>
          ) : (
            <h4 className="text-sm font-black text-white truncate max-w-[180px]">{itinerary.title}</h4>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white transition-colors"
          title="편집 종료"
        >
          <X size={14} />
        </button>
      </div>

      {/* 가로 스크롤형 Day 탭 칩셋 바 (MyRealTrip/Triple 스타일) */}
      {!isSearchingMode && (
        <div className="flex gap-1.5 py-2 border-b border-white/5 shrink-0 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {itinerary.days.map((d) => {
            const isActive = d.day === activeDay;
            return (
              <button
                key={d.day}
                onClick={() => onActiveDayChange(d.day)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white border-transparent shadow'
                    : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Day {d.day}
              </button>
            );
          })}
        </div>
      )}

      {/* 본문 피드 영역 (검색모드 vs 타임라인 뷰) */}
      {isSearchingMode ? (
        /* 인라인 검색 뷰 영역 */
        <div className="flex-1 flex flex-col min-h-0 py-3">
          <div className="flex gap-1.5 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input
                type="text"
                placeholder="관광지, 스팟, 맛집 검색..."
                value={searchQuery}
                onChange={e => onSearchQueryChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSearchPlaces()}
                className="w-full bg-zinc-900/80 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-[11px] text-white focus:outline-none focus:border-orange-500/50"
                autoFocus
              />
            </div>
            <button
              onClick={onSearchPlaces}
              className="px-3.5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-[10px] font-black rounded-xl transition-colors cursor-pointer"
            >
              검색
            </button>
          </div>

          <div className="flex-1 overflow-y-auto mt-3 space-y-1.5 pr-1 scrollbar-thin min-h-0">
            {isSearching ? (
              <div className="py-12 flex justify-center">
                <svg className="animate-spin h-5 w-5 text-orange-500" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-12 text-center text-[10px] text-zinc-500">
                검색어를 입력하고 검색 버튼을 누르세요.
              </div>
            ) : (
              searchResults.map((place) => (
                <div
                  key={place.id}
                  onClick={() => {
                    onAddPlaceFromSearch(place);
                    setIsSearchingMode(false);
                  }}
                  className="bg-zinc-900/40 hover:bg-zinc-900/60 border border-white/5 rounded-xl p-2.5 flex items-start justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <h5 className="text-[11px] font-bold text-white truncate">{place.place_name}</h5>
                    <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                      {place.road_address_name || place.address_name}
                    </p>
                    <span className="inline-block text-[7px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded-full mt-1">
                      {place.category_name.split(' > ').pop() || '관광지'}
                    </span>
                  </div>
                  <div className="p-1 rounded bg-orange-500/10 text-orange-400 flex items-center justify-center">
                    <Plus size={12} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* 기존 타임라인 뷰 영역 */
        <div className="flex-1 overflow-y-auto py-3 pr-1 scrollbar-thin relative min-h-0">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <button
                onClick={() => setIsSearchingMode(true)}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-95 text-white transition-all flex items-center justify-center shadow-lg shadow-red-500/20 cursor-pointer mb-3"
              >
                <Plus size={28} />
              </button>
              <span className="text-[11px] font-bold text-zinc-300">맛집 또는 스팟 추가</span>
              <span className="text-[8.5px] text-zinc-500 mt-1">마커를 드래그 앤 드롭하거나<br />검색창을 열어 일정을 채워보세요.</span>
            </div>
          ) : (
            <div className="relative pl-7 space-y-3">
              {/* 수직선 */}
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-zinc-800" />
              
              {items.map((item, idx) => {
                const isSelected = selectedItemId === item.id;
                return (
                  <div key={item.id} className="relative group/panel">
                    {/* 좌측 넘버링 인디케이터 */}
                    <div className="absolute right-full mr-2.5 top-1.5 flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-red-600 to-orange-500 text-[9px] font-black flex items-center justify-center text-white shadow">
                        {idx + 1}
                      </div>
                      {item.visit_time && (
                        <span className="text-[8px] text-orange-400 font-black mt-1 bg-orange-500/10 px-0.5 rounded border border-orange-500/10">
                          {item.visit_time}
                        </span>
                      )}
                    </div>

                    {/* 코스 노드 바디 */}
                    <div
                      onClick={() => onSelectItem(item)}
                      className={`border rounded-xl p-3 flex flex-col gap-1.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-red-950/20 to-orange-950/20 border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.1)]'
                          : 'bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h5 className="text-[11px] font-black text-white truncate">{item.name}</h5>
                          <span className="text-[8px] text-zinc-500 block truncate">{item.category}</span>
                        </div>

                        {/* 컨트롤 */}
                        <div className="flex items-center gap-0.5 opacity-20 group-hover/panel:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => onMoveUp(idx)}
                            disabled={idx === 0}
                            className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={() => onMoveDown(idx)}
                            disabled={idx === items.length - 1}
                            className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30"
                          >
                            <ChevronDown size={12} />
                          </button>
                          <button
                            onClick={() => onEditItemMemo(item)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400"
                            title="메모/시간 편집"
                          >
                            <Edit3 size={10} />
                          </button>
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>

                      {/* 카카오 길찾기/내비 연동 단추 추가 */}
                      <div className="flex items-center gap-1.5 mt-0.5" onClick={e => e.stopPropagation()}>
                        <a
                          href={`https://map.kakao.com/link/to/${encodeURIComponent(item.name)},${item.lat},${item.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[8px] font-bold text-zinc-400 hover:text-orange-400 bg-white/[0.03] border border-white/5 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                        >
                          <Navigation size={8} />
                          <span>길안내 🚗</span>
                        </a>
                      </div>

                      {item.memo && (
                        <p className="text-[9px] text-zinc-400 bg-zinc-950/40 border border-white/5 px-2 py-1 rounded-lg truncate">
                          {item.memo}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* 마이리얼트립/트리플 스타일 인라인 "+ 장소 추가" 카드 */}
              <div className="relative group/panel pt-2">
                <div className="absolute right-full mr-2.5 top-3 flex flex-col items-center">
                  <div className="w-5 h-5 rounded-full bg-zinc-900 border border-white/10 text-[9px] font-black flex items-center justify-center text-zinc-500">
                    +
                  </div>
                </div>
                
                <button
                  onClick={() => setIsSearchingMode(true)}
                  className="w-full border border-dashed border-white/10 hover:border-orange-500/30 rounded-xl p-3.5 bg-zinc-950/40 hover:bg-zinc-900/40 text-center flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer group"
                >
                  <span className="text-[10px] font-black text-zinc-400 group-hover:text-orange-400 transition-colors">+ 장소 추가</span>
                  <span className="text-[8px] text-zinc-600 group-hover:text-zinc-500 transition-colors">클릭하여 검색하거나 지도에서 마커를 끌어다 놓으세요</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3차 보완: 스팟 근처/가는길 5km 추천 맛집 목록 영역 */}
      {!isSearchingMode && selectedItemId && (
        <div className="h-44 border-t border-white/5 pt-2 flex flex-col min-h-0 shrink-0">
          <div className="flex items-center justify-between pb-1 px-1">
            <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
              <Sparkles size={11} className="text-orange-400" />
              <span>주변 및 가는길 5km 추천 맛집</span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin min-h-0">
            {recommendedRestaurants.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-2">
                <span className="text-[9px] text-zinc-500">5km 내 추천 맛집이 없습니다.</span>
              </div>
            ) : (
              recommendedRestaurants.map(({ restaurant, distance, type }) => (
                <div
                  key={restaurant.id}
                  className="bg-zinc-900/40 hover:bg-zinc-900/60 border border-white/5 rounded-lg p-2.5 flex items-start justify-between gap-2 transition-all"
                >
                  <div className="min-w-0">
                    <h5 className="text-[10px] font-bold text-white truncate">{restaurant.name}</h5>
                    <p className="text-[8px] text-zinc-500 truncate mt-0.5">{restaurant.address}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border ${
                        type === 'near'
                          ? 'text-orange-400 bg-orange-500/10 border-orange-500/10'
                          : 'text-red-400 bg-red-500/10 border-red-500/10'
                      }`}>
                        {type === 'near' ? '5km 이내' : '가는길 추천'} ({formatDistance(distance)})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onAddRecommendedRestaurant(restaurant)}
                    className="p-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="경로 중간 최적 위치에 추가"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 제어 하단 바 */}
      {!isSearchingMode && (
        <div className="pt-2.5 border-t border-white/5 shrink-0 flex gap-2">
          {items.length > 0 && (
            <>
              <button
                onClick={() => setIsSearchingMode(true)}
                className="px-3 py-3 rounded-xl border border-white/15 bg-zinc-900 hover:bg-white/5 text-xs font-bold text-zinc-300 transition-colors flex items-center justify-center"
                title="장소 추가"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={onSave}
                className="flex-1 py-3 rounded-xl text-xs font-black text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-[0.98] transition-all shadow-lg shadow-red-500/15 flex items-center justify-center gap-1.5"
              >
                <Check size={12} />
                <span>코스 설계 완료</span>
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
