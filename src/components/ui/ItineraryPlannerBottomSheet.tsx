'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomModal from './CustomModal';
import { getRestaurantsInBounds } from '@/lib/supabase/restaurants';
import { Restaurant, Itinerary, DailyItinerary, ItineraryItem } from '@/types';
import { Search, MapPin, Plus, Trash2, ChevronUp, ChevronDown, Check, Sparkles, Calendar, Clock, Navigation, Users, Tag, AlertCircle, Edit3 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import Toast from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSave?: (itinerary: Itinerary) => void;
  editingItinerary?: Itinerary | null;
}

interface KakaoPlace {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_name: string;
  x: string; // lng
  y: string; // lat
  place_url: string;
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(distKm: number): string {
  const meters = distKm * 1000;
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${distKm.toFixed(1)}km`;
}

export default function ItineraryPlannerBottomSheet({ isOpen, onClose, user, onSave, editingItinerary }: Props) {
  const [step, setStep] = useState<1 | 2>(1); // 1: 기본 정보 설정, 2: 상세 코스 계획
  
  // 여행 메타데이터
  const [title, setTitle] = useState('');
  const [daysCount, setDaysCount] = useState(3);
  const [companion, setCompanion] = useState('연인과');
  const [theme, setTheme] = useState('여유롭게 힐링');
  const [activeDay, setActiveDay] = useState(1);
  const [daysData, setDaysData] = useState<DailyItinerary[]>([]);
  
  // 장소 검색 관련
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KakaoPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // 주변 맛집 추천 관련
  const [recommendedRestaurants, setRecommendedRestaurants] = useState<{ restaurant: Restaurant; distance: number }[]>([]);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
  const [selectedSpotForRecommendation, setSelectedSpotForRecommendation] = useState<ItineraryItem | null>(null);

  // 메모 및 시간 편집 팝업 모달 관련
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [editingItemForMemo, setEditingItemForMemo] = useState<ItineraryItem | null>(null);
  const [inputVisitTime, setInputVisitTime] = useState('');
  const [inputMemo, setInputMemo] = useState('');

  const { toastMessage, isVisible, showToast } = useToast();

  const companions = ['연인과', '친구와', '가족과', '혼자'];
  const themes = ['여유롭게 힐링', '바쁜 일정', '맛집 탐방', '쇼핑/문화', '액티비티'];

  useEffect(() => {
    if (editingItinerary) {
      setTitle(editingItinerary.title);
      setDaysCount(editingItinerary.days.length);
      setCompanion(editingItinerary.companion || '연인과');
      setTheme(editingItinerary.theme || '여유롭게 힐링');
      setDaysData(editingItinerary.days);
      setStep(2);
      setActiveDay(1);
    } else {
      setTitle('');
      setDaysCount(3);
      setCompanion('연인과');
      setTheme('여유롭게 힐링');
      setDaysData([{ day: 1, items: [] }]);
      setStep(1);
    }
  }, [editingItinerary, isOpen]);

  const handleSearchPlaces = () => {
    if (!searchQuery.trim() || !window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      showToast({ message: '검색어를 입력해 주세요.' });
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
        showToast({ message: '검색 결과가 없습니다.' });
      }
    });
  };

  const handleStartPlanning = () => {
    if (!title.trim()) {
      showToast({ message: '여행 제목을 입력해 주세요.' });
      return;
    }
    
    if (!editingItinerary) {
      const initialDays: DailyItinerary[] = Array.from({ length: daysCount }, (_, i) => ({
        day: i + 1,
        items: []
      }));
      setDaysData(initialDays);
    }
    setStep(2);
  };

  const handleAddPlaceToItinerary = (place: KakaoPlace) => {
    const newItem: ItineraryItem = {
      id: `kakao-${place.id}-${Date.now()}`,
      name: place.place_name,
      category: place.category_name.split(' > ').pop() || '관광지',
      address: place.address_name || place.road_address_name,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
      place_url: place.place_url,
      is_custom_spot: true
    };

    updateDaysDataWithNewItem(newItem);
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
    showToast({ message: `${place.place_name}이(가) 일정에 추가되었습니다.` });
    loadNearbyRecommendations(newItem);
  };

  const handleAddRestaurantToItinerary = (restaurant: Restaurant) => {
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

    updateDaysDataWithNewItem(newItem);
    showToast({ message: `${restaurant.name}이(가) 일정에 추가되었습니다.` });
  };

  const updateDaysDataWithNewItem = (item: ItineraryItem) => {
    setDaysData(prev => prev.map(d => {
      if (d.day === activeDay) {
        return {
          ...d,
          items: [...d.items, item]
        };
      }
      return d;
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setDaysData(prev => prev.map(d => {
      if (d.day === activeDay) {
        return {
          ...d,
          items: d.items.filter(item => item.id !== itemId)
        };
      }
      return d;
    }));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setDaysData(prev => prev.map(d => {
      if (d.day === activeDay) {
        const newItems = [...d.items];
        const temp = newItems[index];
        newItems[index] = newItems[index - 1];
        newItems[index - 1] = temp;
        return { ...d, items: newItems };
      }
      return d;
    }));
  };

  const handleMoveDown = (index: number) => {
    setDaysData(prev => prev.map(d => {
      if (d.day === activeDay) {
        if (index === d.items.length - 1) return d;
        const newItems = [...d.items];
        const temp = newItems[index];
        newItems[index] = newItems[index + 1];
        newItems[index + 1] = temp;
        return { ...d, items: newItems };
      }
      return d;
    }));
  };

  const loadNearbyRecommendations = async (spot: ItineraryItem) => {
    setSelectedSpotForRecommendation(spot);
    setIsRecommendationLoading(true);

    try {
      const swLat = spot.lat - 0.0135;
      const swLng = spot.lng - 0.017;
      const neLat = spot.lat + 0.0135;
      const neLng = spot.lng + 0.017;

      const data = await getRestaurantsInBounds(swLat, swLng, neLat, neLng, true);
      
      const mapped = data.map(res => {
        const dist = getDistance(spot.lat, spot.lng, res.lat, res.lng);
        return { restaurant: res, distance: dist };
      })
      .filter(item => item.distance <= 1.5)
      .sort((a, b) => a.distance - b.distance);

      setRecommendedRestaurants(mapped);
    } catch (e) {
      console.error(e);
      showToast({ message: '추천 맛집 로드 중 오류가 발생했습니다.' });
    } finally {
      setIsRecommendationLoading(false);
    }
  };

  // 시간 및 메모 팝업 창 활성화
  const handleOpenMemoModal = (item: ItineraryItem) => {
    setEditingItemForMemo(item);
    setInputVisitTime(item.visit_time || '');
    setInputMemo(item.memo || '');
    setShowMemoModal(true);
  };

  const handleSaveMemo = () => {
    if (!editingItemForMemo) return;
    
    setDaysData(prev => prev.map(d => {
      if (d.day === activeDay) {
        return {
          ...d,
          items: d.items.map(item => {
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
    }));

    setShowMemoModal(false);
    setEditingItemForMemo(null);
    showToast({ message: '장소 정보(시간/메모)가 업데이트되었습니다.' });
  };

  const handleSaveItinerary = () => {
    if (daysData.every(d => d.items.length === 0)) {
      showToast({ message: '최소 한 개 이상의 장소를 일정에 추가해 주세요.' });
      return;
    }

    const finalItinerary: Itinerary = {
      id: editingItinerary?.id || `itinerary-${Date.now()}`,
      title,
      companion,
      theme,
      days: daysData,
      created_at: editingItinerary?.created_at || new Date().toISOString()
    };

    if (onSave) {
      onSave(finalItinerary);
    }
    onClose();
  };

  return (
    <>
      <CustomModal isOpen={isOpen} onClose={onClose}>
        <div className="p-6 text-white bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden max-h-[85vh] flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent flex items-center gap-2">
                <Sparkles size={18} className="text-orange-500" />
                {editingItinerary ? '나의 미식 일정 편집' : '트리플 스타일 일정 플래너'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">시안 속 디테일(이동 거리, 상세 메모, 방문 예정 시간)을 탑재한 프리미엄 도구입니다.</p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-5">
            {step === 1 ? (
              /* 1단계: 일정 기본 정보 설정 */
              <div className="space-y-5 py-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Edit3 size={14} className="text-orange-500" />
                    여행지 및 제목
                  </label>
                  <input
                    type="text"
                    placeholder="예: 후쿠오카 여행"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-zinc-900/60 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} className="text-orange-500" />
                    여행 기간 (일수)
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map(num => (
                      <button
                        key={num}
                        onClick={() => setDaysCount(num)}
                        className={`py-3 rounded-xl text-xs font-black transition-all border ${
                          daysCount === num
                            ? 'bg-gradient-to-r from-red-600 to-orange-500 border-transparent text-white shadow-lg shadow-red-500/10 scale-105'
                            : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                        }`}
                      >
                        {num}일
                      </button>
                    ))}
                  </div>
                </div>

                {/* 동행자 설정 */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} className="text-orange-500" />
                    누구와 함께하나요?
                  </label>
                  <div className="flex gap-2.5 flex-wrap">
                    {companions.map(comp => (
                      <button
                        key={comp}
                        onClick={() => setCompanion(comp)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          companion === comp
                            ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-md'
                            : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                        }`}
                      >
                        {comp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 여행 테마 설정 */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag size={14} className="text-orange-500" />
                    여행 테마/스타일
                  </label>
                  <div className="flex gap-2.5 flex-wrap">
                    {themes.map(th => (
                      <button
                        key={th}
                        onClick={() => setTheme(th)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          theme === th
                            ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-md'
                            : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                        }`}
                      >
                        {th}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleStartPlanning}
                  className="w-full py-4 rounded-2xl text-[15px] font-bold text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-[0.98] transition-all shadow-xl shadow-red-500/10 flex items-center justify-center gap-2 mt-4"
                >
                  <Calendar size={16} />
                  <span>일정 세팅 완료 및 편집</span>
                </button>
              </div>
            ) : (
              /* 2단계: 코스 편집 (트리플 스타일 타임라인) */
              <div className="flex flex-col md:flex-row gap-6 h-[55vh]">
                {/* 왼쪽: 일정 목록 및 타임라인 */}
                <div className="flex-1 flex flex-col min-h-0 bg-zinc-900/20 border border-white/5 rounded-2xl p-4">
                  
                  {/* 상단 메타 요약 헤더 (트리플 디테일) */}
                  <div className="pb-3 border-b border-white/5 mb-3 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-black text-white">{title}</h4>
                      <button onClick={() => setStep(1)} className="text-[10px] text-zinc-400 font-bold bg-zinc-800 px-2 py-0.5 rounded-lg border border-white/5 hover:bg-zinc-700">
                        정보수정
                      </button>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-semibold mt-1">
                      {companion} • {theme} | 총 {daysCount}일 코스
                    </span>
                  </div>

                  {/* 일자 탭 바 */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-3">
                    {daysData.map(d => (
                      <button
                        key={d.day}
                        onClick={() => {
                          setActiveDay(d.day);
                          setSelectedSpotForRecommendation(null);
                          setRecommendedRestaurants([]);
                        }}
                        className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                          activeDay === d.day
                            ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md'
                            : 'bg-zinc-900/60 text-zinc-400 border border-white/5 hover:text-white'
                        }`}
                      >
                        Day {d.day}
                      </button>
                    ))}
                  </div>

                  {/* 트리플 스타일 수직 타임라인 목록 */}
                  <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin relative">
                    {daysData.find(d => d.day === activeDay)?.items.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/5 rounded-xl">
                        <MapPin size={24} className="text-zinc-600 mb-2" />
                        <span className="text-xs text-zinc-500 font-semibold">일차에 추가된 장소가 없습니다.</span>
                        <span className="text-[10px] text-zinc-600 mt-1">하단 장소 추가 및 추천 맛집을 더해보세요.</span>
                      </div>
                    ) : (
                      <div className="relative pl-10 space-y-4">
                        {/* 세로 타임라인 라인 */}
                        <div className="absolute left-[29px] top-4 bottom-4 w-0.5 bg-zinc-800" />
                        
                        {daysData.find(d => d.day === activeDay)?.items.map((item, idx, arr) => {
                          // 다음 노드와의 거리 계산
                          let distanceStr = '';
                          if (idx < arr.length - 1) {
                            const nextItem = arr[idx + 1];
                            const dist = getDistance(item.lat, item.lng, nextItem.lat, nextItem.lng);
                            distanceStr = formatDistance(dist);
                          }

                          return (
                            <div key={item.id} className="relative group">
                              
                              {/* 마커 번호 + 시간 정보 인디케이터 (좌측 배치) */}
                              <div className="absolute right-full mr-4 top-1 flex flex-col items-center z-10">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-orange-500 text-[10px] font-black flex items-center justify-center text-white shadow-md border border-white/20">
                                  {idx + 1}
                                </div>
                                {item.visit_time ? (
                                  <span className="text-[9px] text-orange-400 font-black mt-1.5 flex items-center gap-0.5 bg-orange-500/10 px-1 py-0.5 rounded border border-orange-500/15">
                                    {item.visit_time}
                                  </span>
                                ) : (
                                  <Clock size={10} className="text-zinc-600 mt-2" />
                                )}
                              </div>

                              {/* 장소 카드 */}
                              <div
                                onClick={() => {
                                  loadNearbyRecommendations(item);
                                  handleOpenMemoModal(item);
                                }}
                                className={`border rounded-2xl p-4 flex flex-col gap-2 cursor-pointer transition-all ${
                                  selectedSpotForRecommendation?.id === item.id
                                    ? 'bg-gradient-to-r from-red-950/20 to-orange-950/20 border-orange-500/40 shadow-inner'
                                    : 'bg-zinc-900/30 border-white/5 hover:border-white/10 hover:bg-zinc-900/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3 min-w-0">
                                  <div className="min-w-0">
                                    <h5 className="text-sm font-black text-white truncate">{item.name}</h5>
                                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                                      {item.category} • {item.address.split(' ').slice(0, 2).join(' ')}
                                    </p>
                                  </div>

                                  {/* 순서 및 삭제 제어 */}
                                  <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMoveUp(idx); }}
                                      disabled={idx === 0}
                                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30"
                                    >
                                      <ChevronUp size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMoveDown(idx); }}
                                      disabled={idx === arr.length - 1}
                                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30"
                                    >
                                      <ChevronDown size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                                      className="p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* 메모 노출 영역 (트리플 스타일) */}
                                {item.memo && (
                                  <div className="mt-1 bg-zinc-900/50 border border-white/5 px-3 py-2 rounded-xl text-[10px] text-zinc-400 font-semibold leading-relaxed">
                                    {item.memo}
                                  </div>
                                )}
                              </div>

                              {/* 장소와 장소 사이 실시간 이동 거리선 칩 */}
                              {distanceStr && (
                                <div className="h-6 flex items-center justify-start ml-2 my-1">
                                  <div className="flex items-center gap-1 text-[9px] font-black text-zinc-500 bg-zinc-950/70 border border-white/5 px-2.5 py-0.5 rounded-full z-10 shadow-sm">
                                    <Navigation size={8} className="text-orange-500" />
                                    {distanceStr}
                                  </div>
                                </div>
                              )}

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 하단 듀얼 제어부 */}
                  <div className="grid grid-cols-2 gap-2.5 mt-3 shrink-0">
                    <button
                      onClick={() => setShowSearchModal(true)}
                      className="py-3 rounded-xl border border-white/10 bg-zinc-900/40 hover:bg-orange-500/5 hover:border-orange-500/20 hover:text-orange-400 text-xs font-bold text-zinc-300 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} />
                      <span>장소 추가</span>
                    </button>
                    <button
                      onClick={() => {
                        const items = daysData.find(d => d.day === activeDay)?.items || [];
                        if (items.length === 0) {
                          showToast({ message: '시간과 메모를 추가할 장소가 없습니다.' });
                          return;
                        }
                        handleOpenMemoModal(items[0]);
                      }}
                      className="py-3 rounded-xl border border-white/10 bg-zinc-900/40 hover:bg-orange-500/5 hover:border-orange-500/20 hover:text-orange-400 text-xs font-bold text-zinc-300 transition-all flex items-center justify-center gap-2"
                    >
                      <Clock size={14} />
                      <span>시간/메모 추가</span>
                    </button>
                  </div>
                </div>

                {/* 오른쪽: 주변 맛집 추천 */}
                <div className="w-full md:w-80 flex flex-col min-h-0 bg-zinc-900/20 border border-white/5 rounded-2xl p-4">
                  <div className="pb-2.5 border-b border-white/5 mb-3">
                    <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-orange-400" />
                      주변 1.5km 검증 맛집
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {selectedSpotForRecommendation 
                        ? `[${selectedSpotForRecommendation.name}] 주변 추천 맛집`
                        : '일정 장소를 선택하면 근처 유튜브 맛집을 자동 추천합니다.'}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {isRecommendationLoading ? (
                      <div className="h-full flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 text-orange-500" viewBox="0 0 24 24">
                          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : recommendedRestaurants.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <Navigation size={18} className="text-zinc-700 mb-1" />
                        <span className="text-[10px] text-zinc-500">추천 맛집이 없습니다.</span>
                      </div>
                    ) : (
                      recommendedRestaurants.map(({ restaurant, distance }) => (
                        <div
                          key={restaurant.id}
                          className="bg-zinc-900/40 hover:bg-zinc-900/60 border border-white/5 rounded-xl p-3 flex items-start justify-between gap-2.5 transition-all"
                        >
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white truncate">{restaurant.name}</h5>
                            <p className="text-[9px] text-zinc-500 truncate mt-0.5">{restaurant.address}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-[8px] font-black text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full border border-orange-500/10">
                                {formatDistance(distance)} 근처
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleAddRestaurantToItinerary(restaurant)}
                            className="flex-shrink-0 p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 하단 제어바 (2단계만 활성화) */}
          {step === 2 && (
            <div className="pt-4 border-t border-white/5 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-3.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5"
              >
                이전 (기본설정)
              </button>
              <button
                onClick={handleSaveItinerary}
                className="flex-1 py-3.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-[0.98] transition-all shadow-lg shadow-red-500/15"
              >
                {editingItinerary ? '일정 수정 완료' : '미식 일정 저장하기'}
              </button>
            </div>
          )}
        </div>
      </CustomModal>

      {/* 장소 검색 서브 모달 */}
      <CustomModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)}>
        <div className="p-5 text-white bg-zinc-950 border border-white/10 rounded-3xl max-h-[70vh] flex flex-col">
          <div className="pb-3 border-b border-white/5 flex justify-between items-center">
            <h4 className="text-sm font-bold text-zinc-200">장소 검색</h4>
            <button onClick={() => setShowSearchModal(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
          </div>

          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="관광지, 스팟, 카페명을 입력해보세요..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchPlaces()}
                className="w-full bg-zinc-900/80 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <button
              onClick={handleSearchPlaces}
              className="px-4 py-2.5 bg-orange-500 text-xs font-bold rounded-xl hover:bg-orange-400 transition-colors"
            >
              검색
            </button>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1 scrollbar-thin">
            {isSearching ? (
              <div className="py-12 flex justify-center">
                <svg className="animate-spin h-5 w-5 text-orange-500" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500">
                검색어를 입력하고 검색 버튼을 누르세요.
              </div>
            ) : (
              searchResults.map(place => (
                <div
                  key={place.id}
                  onClick={() => handleAddPlaceToItinerary(place)}
                  className="bg-zinc-900/40 hover:bg-zinc-900/60 border border-white/5 rounded-xl p-3 flex items-start justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-white truncate">{place.place_name}</h5>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {place.road_address_name || place.address_name}
                    </p>
                    <span className="inline-block text-[8px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded-full mt-1.5">
                      {place.category_name.split(' > ').pop() || '관광지'}
                    </span>
                  </div>
                  <div className="p-1 rounded bg-orange-500/10 text-orange-400 flex items-center justify-center">
                    <Plus size={14} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CustomModal>

      {/* 시간 및 메모 입력 서브 모달 */}
      <CustomModal isOpen={showMemoModal} onClose={() => setShowMemoModal(false)}>
        <div className="p-5 text-white bg-zinc-950 border border-white/10 rounded-3xl flex flex-col gap-4">
          <div className="pb-3 border-b border-white/5 flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-zinc-200">시간/메모 추가 및 변경</h4>
              {editingItemForMemo && (
                <p className="text-[10px] text-orange-400 font-semibold mt-0.5">{editingItemForMemo.name}</p>
              )}
            </div>
            <button onClick={() => setShowMemoModal(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
          </div>

          {/* 대상 장소 선택 드롭다운 (만약 일차 내 장소들을 스위칭하고 싶을 때) */}
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase">대상 장소 선택</label>
            <select
              value={editingItemForMemo?.id || ''}
              onChange={(e) => {
                const selected = daysData.find(d => d.day === activeDay)?.items.find(item => item.id === e.target.value);
                if (selected) {
                  setEditingItemForMemo(selected);
                  setInputVisitTime(selected.visit_time || '');
                  setInputMemo(selected.memo || '');
                }
              }}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              {daysData.find(d => d.day === activeDay)?.items.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          {/* 방문 시간 입력 */}
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

          {/* 메모 입력 */}
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase">상세 팁/메모</label>
            <textarea
              placeholder="예: 전방 50m 소소버스투어 핑크색 깃발찾기"
              value={inputMemo}
              onChange={e => setInputMemo(e.target.value)}
              rows={3}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 resize-none"
            />
          </div>

          <button
            onClick={handleSaveMemo}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-xs font-bold text-white shadow-lg"
          >
            적용하기
          </button>
        </div>
      </CustomModal>

      <Toast message={toastMessage} isVisible={isVisible} />
    </>
  );
}
