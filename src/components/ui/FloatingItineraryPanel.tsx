'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DailyItinerary, ItineraryItem, Itinerary, Restaurant } from '@/types';
import { MapPin, Clock, Trash2, ChevronUp, ChevronDown, Check, X, Plus, Sparkles, Navigation, Edit3, ArrowLeft, Search, Car, Footprints } from 'lucide-react';
import { getDistance } from '@/lib/geoUtils';

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
  // 아코디언 상태 관리 (기본적으로 첫번째 Day는 펼쳐진 상태로 세팅)
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  // 검색 모드로 진입할 때의 대상 Day
  const [targetDayForSearch, setTargetDayForSearch] = useState<number>(1);
  const [isSearchingMode, setIsSearchingMode] = useState<boolean>(false);

  const formatDistance = (distKm: number): string => {
    const meters = distKm * 1000;
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${distKm.toFixed(1)}km`;
  };

  const toggleDayAccordion = (day: number) => {
    setExpandedDays(prev => ({
      ...prev,
      [day]: !prev[day]
    }));
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
              <span className="text-xs font-black">Day {targetDayForSearch} 검색 종료</span>
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

      {/* 본문 피드 영역 (검색모드 vs 아코디언 타임라인 뷰) */}
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
              />
            </div>
            <button
              onClick={onSearchPlaces}
              disabled={isSearching}
              className="px-3 bg-zinc-900 border border-white/5 hover:border-orange-500/30 rounded-xl text-xs font-black text-white hover:text-orange-400 disabled:opacity-50 transition-all cursor-pointer"
            >
              검색
            </button>
          </div>

          <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-1.5 scrollbar-thin min-h-0">
            {isSearching ? (
              <div className="py-8 text-center text-xs text-zinc-500">검색 중...</div>
            ) : searchResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">검색 결과가 없습니다.</div>
            ) : (
              searchResults.map((place: any, idx: number) => (
                <div
                  key={`search-res-${idx}`}
                  onClick={() => {
                    // 선택 시 저장 활성화 Day 갱신 후 장소 추가 처리
                    onActiveDayChange(targetDayForSearch);
                    setTimeout(() => {
                      onAddPlaceFromSearch(place);
                      setIsSearchingMode(false);
                    }, 50);
                  }}
                  className="bg-zinc-900/40 hover:bg-zinc-900/70 border border-white/5 hover:border-orange-500/20 rounded-xl p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-all"
                >
                  <div className="min-w-0">
                    <h6 className="text-[10px] font-black text-white truncate">{place.place_name}</h6>
                    <p className="text-[8px] text-zinc-500 truncate mt-0.5">
                      {place.road_address_name || place.address_name}
                    </p>
                    <span className="inline-block text-[7px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded-full mt-1">
                      {place.category_name.split(' > ').pop() || '관광지'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* 통합 아코디언 타임라인 뷰 영역 (모든 Day 노출) */
        <div className="flex-1 overflow-y-auto py-2 pr-1 space-y-3.5 scrollbar-thin relative min-h-0">
          {itinerary.days.map((dayData) => {
            const isExpanded = !!expandedDays[dayData.day];
            const dayItems = dayData.items || [];
            
            return (
              <div key={`day-accordion-${dayData.day}`} className="border border-white/5 rounded-2xl bg-zinc-900/10 overflow-hidden transition-all">
                {/* Day 아코디언 헤더 */}
                <div
                  onClick={() => toggleDayAccordion(dayData.day)}
                  className="w-full px-3.5 py-3 flex items-center justify-between bg-zinc-900/40 border-b border-white/5 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-zinc-100 tracking-wider">Day {dayData.day}</span>
                    <span className="text-[9px] font-bold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-white/5">
                      {dayItems.length}개 장소
                    </span>
                  </div>
                  <div className="text-zinc-500">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>

                {/* Day 아코디언 바디 (타임라인) */}
                {isExpanded && (
                  <div className="p-3 pl-8 space-y-3 relative">
                    {dayItems.length > 0 && (
                      <div className="absolute left-[19px] top-4 bottom-12 w-0.5 bg-zinc-800" />
                    )}

                    {dayItems.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[9px] text-zinc-500 leading-normal">
                          아직 등록된 일정이 없습니다.<br />아래 버튼을 눌러 스팟을 추가하세요.
                        </p>
                      </div>
                    ) : (
                      dayItems.map((item, idx) => {
                        const isSelected = selectedItemId === item.id;
                        
                        // 이전 장소와의 거리 및 이동 시간 칩 연산
                        let connectorChip = null;
                        if (idx > 0) {
                          const prevItem = dayItems[idx - 1];
                          const distance = getDistance(prevItem.lat, prevItem.lng, item.lat, item.lng);
                          const isCar = itinerary.transport === '자차/렌터카';
                          
                          // 자동차(40km/h), 도보(4km/h) 기준 속력 환산 시간 계산
                          const speedKmh = isCar ? 40 : 4;
                          const minutes = Math.max(1, Math.round((distance / speedKmh) * 60));
                          
                          connectorChip = (
                            <div className="relative left-[-19px] py-1 flex items-center gap-1.5 z-10 my-0.5 select-none" onClick={e => e.stopPropagation()}>
                              {/* 수직 도트 보조선 */}
                              <div className="w-[2px] h-4 border-l-2 border-dashed border-zinc-800 absolute left-[19px] top-[-6px] bottom-[-6px] z-[-1]" />
                              
                              <div className="flex items-center gap-1.5 ml-2.5 bg-zinc-950/90 border border-white/5 px-2 py-0.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.4)] text-[7.5px] font-black text-zinc-400">
                                {isCar ? <Car size={10} className="text-orange-400" /> : <Footprints size={10} className="text-orange-400" />}
                                <span>{isCar ? '차량' : '도보'} {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}</span>
                                <span className="text-zinc-500">•</span>
                                <span className="text-orange-400">약 {minutes}분</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={item.id} className="relative group/panel">
                            {connectorChip}

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
                              onClick={() => {
                                onActiveDayChange(dayData.day);
                                onSelectItem(item);
                              }}
                              className={`border rounded-xl p-2.5 flex flex-col gap-1.5 cursor-pointer transition-all ${
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
                                    onClick={() => {
                                      onActiveDayChange(dayData.day);
                                      onMoveUp(idx);
                                    }}
                                    disabled={idx === 0}
                                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30"
                                  >
                                    <ChevronUp size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      onActiveDayChange(dayData.day);
                                      onMoveDown(idx);
                                    }}
                                    disabled={idx === dayItems.length - 1}
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
                                    onClick={() => {
                                      onActiveDayChange(dayData.day);
                                      onRemoveItem(item.id);
                                    }}
                                    className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </div>

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
                      })
                    )}

                    {/* 각 Day별 독립형 장소 추가 카드 */}
                    <div className="relative group/panel pt-1">
                      <div className="absolute right-full mr-2.5 top-3 flex flex-col items-center">
                        <div className="w-5 h-5 rounded-full bg-zinc-900 border border-white/10 text-[9px] font-black flex items-center justify-center text-zinc-500">
                          +
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setTargetDayForSearch(dayData.day);
                          setIsSearchingMode(true);
                        }}
                        className="w-full border border-dashed border-white/10 hover:border-orange-500/30 rounded-xl p-2.5 bg-zinc-950/40 hover:bg-zinc-900/40 text-center flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer group"
                      >
                        <span className="text-[10px] font-black text-zinc-400 group-hover:text-orange-400 transition-colors">+ Day {dayData.day} 장소 추가</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
          <button
            onClick={onSave}
            className="flex-1 py-3 rounded-xl text-xs font-black text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-[0.98] transition-all shadow-lg shadow-red-500/15 flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
          >
            <Check size={12} />
            <span>코스 설계 완료</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}
