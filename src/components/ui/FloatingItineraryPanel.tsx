'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DailyItinerary, ItineraryItem, Itinerary, Restaurant } from '@/types';
import { MapPin, Clock, Trash2, ChevronUp, ChevronDown, Check, X, Plus, Sparkles, Navigation, Edit3, ArrowLeft, Search, Car, Footprints, Utensils, GripVertical, Heart, Share2, Bus } from 'lucide-react';
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
  onRestaurantDrop?: (restaurant: Restaurant, targetDay?: number) => void;
  
  // 인라인 검색 대응 프롭
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: any[];
  isSearching: boolean;
  onSearchPlaces: () => void;
  onAddPlaceFromSearch: (place: any, targetDay?: number) => void;

  // 트리플 벤치마킹 추가 프롭
  favorites: string[];
  restaurants: Restaurant[];

  // 노션 및 실시간 공동 편집 추가 프롭
  onUpdateItinerary?: (updated: Itinerary) => void;
  onResetCustomWaypoints?: () => void;
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
  onAddPlaceFromSearch,
  favorites,
  restaurants,
  onUpdateItinerary,
  onResetCustomWaypoints
}: Props) {
  // 아코디언 상태 관리 (기본적으로 첫번째 Day는 펼쳐진 상태로 세팅)
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  // 검색 모드로 진입할 때의 대상 Day
  const [targetDayForSearch, setTargetDayForSearch] = useState<number>(1);
  const [isSearchingMode, setIsSearchingMode] = useState<boolean>(false);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  
  // 카카오맵 연동 상태 관리
  const [activePollingItem, setActivePollingItem] = useState<{ dayNum: number; itemId: string; popupWindow: Window | null } | null>(null);
  const [showManualInputId, setShowManualInputId] = useState<string | null>(null);
  const [manualDuration, setManualDuration] = useState<string>('');
  const [isParsingLink, setIsParsingLink] = useState<boolean>(false);

  // 카카오맵 팝업 길찾기 오픈
  const openKakaoMapRoute = (dayNum: number, prevItem: ItineraryItem, currentItem: ItineraryItem) => {
    if (typeof window === 'undefined') return;
    
    // 카카오맵 공식 공유 링크 스킴 (위도,경도 순서)
    // 모바일/PC 브라우저 접속 시 자동으로 최적화된 길찾기 결과 화면으로 리다이렉트됩니다.
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(currentItem.name)},${currentItem.lat},${currentItem.lng}/from/${encodeURIComponent(prevItem.name)},${prevItem.lat},${prevItem.lng}`;
    
    const popup = window.open(url, '_blank', 'width=450,height=700');
    setActivePollingItem({
      dayNum,
      itemId: currentItem.id,
      popupWindow: popup
    });
  };

  // 수동 정보 입력 적용
  const handleApplyManualRoute = (dayNum: number, itemId: string, durationMin: number, type?: 'walk' | 'transit' | 'car') => {
    if (!onUpdateItinerary) return;
    const updatedDays = itinerary.days.map(d => {
      if (d.day === dayNum) {
        return {
          ...d,
          items: d.items.map(item => {
            if (item.id === itemId) {
              return {
                ...item,
                transportType: type || item.transportType,
                customDuration: durationMin || undefined
              };
            }
            return item;
          })
        };
      }
      return d;
    });
    onUpdateItinerary({ ...itinerary, days: updatedDays });
    setShowManualInputId(null);
    setManualDuration('');
  };

  // 수동 링크 입력 파싱
  const parseAndApplyLinkDirectly = async (urlStr: string, dayNum: number, itemId: string) => {
    if (isParsingLink) return;
    setIsParsingLink(true);
    try {
      const res = await fetch('/api/parse-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlStr })
      });
      const json = await res.json();
      if (json.success && json.data) {
        const { duration, transportType } = json.data;
        if (onUpdateItinerary) {
          const updatedDays = itinerary.days.map(d => {
            if (d.day === dayNum) {
              return {
                ...d,
                items: d.items.map(item => {
                  if (item.id === itemId) {
                    return {
                      ...item,
                      transportType: transportType || item.transportType,
                      customDuration: duration || undefined
                    };
                  }
                  return item;
                })
              };
            }
            return d;
          });
          onUpdateItinerary({ ...itinerary, days: updatedDays });
        }
        alert('카카오맵 경로 정보가 반영되었습니다!');
      } else {
        alert(`파싱 실패: ${json.error || '유효하지 않은 링크이거나 정보를 찾을 수 없습니다.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setIsParsingLink(false);
    }
  };

  // 클립보드 폴링 및 팝업 자동 닫기 처리
  useEffect(() => {
    if (!activePollingItem) return;

    let timer: NodeJS.Timeout | null = null;
    let focusHandler: (() => void) | null = null;

    const parseAndApplyLink = async (urlStr: string) => {
      if (isParsingLink) return;
      setIsParsingLink(true);
      try {
        const res = await fetch('/api/parse-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlStr })
        });
        const json = await res.json();
        if (json.success && json.data) {
          const { duration, transportType } = json.data;
          
          if (onUpdateItinerary) {
            const updatedDays = itinerary.days.map(d => {
              if (d.day === activePollingItem.dayNum) {
                return {
                  ...d,
                  items: d.items.map(item => {
                    if (item.id === activePollingItem.itemId) {
                      return {
                        ...item,
                        transportType: transportType || item.transportType,
                        customDuration: duration || undefined
                      };
                    }
                    return item;
                  })
                };
              }
              return d;
            });
            onUpdateItinerary({ ...itinerary, days: updatedDays });
          }

          if (activePollingItem.popupWindow && !activePollingItem.popupWindow.closed) {
            activePollingItem.popupWindow.close();
          }
          setActivePollingItem(null);
          alert('카카오맵 실시간 길찾기 정보가 자동으로 반영되었습니다!');
        }
      } catch (err) {
        console.error('자동 폴링 파싱 오류:', err);
      } finally {
        setIsParsingLink(false);
      }
    };

    const checkClipboard = async () => {
      if (activePollingItem.popupWindow && activePollingItem.popupWindow.closed) {
        setActivePollingItem(null);
        return;
      }

      try {
        if (document.hasFocus()) {
          const text = await navigator.clipboard.readText();
          if (text && (text.includes('kko.to') || text.includes('kakao.com'))) {
            await parseAndApplyLink(text);
          }
        }
      } catch (e) {
        // 권한 에러 등 무시
      }
    };

    focusHandler = () => {
      checkClipboard();
    };
    window.addEventListener('focus', focusHandler);
    timer = setInterval(checkClipboard, 1000);

    return () => {
      if (timer) clearInterval(timer);
      if (focusHandler) window.removeEventListener('focus', focusHandler);
    };
  }, [activePollingItem, itinerary, onUpdateItinerary, isParsingLink]);

  // 트리플 벤치마킹 탐색 탭 상태
  const [exploreTab, setExploreTab] = useState<'recommend' | 'favorite' | 'search'>('search');

  // 실시간 공유 복사 토스트 피드백 상태
  const [showShareToast, setShowShareToast] = useState<boolean>(false);

  // Open-Meteo API 날씨 예보 상태
  const [weatherForecast, setWeatherForecast] = useState<Record<string, { icon: string; temp: string }>>({});

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

  const handleDropOnDay = (e: React.DragEvent, day: number) => {
    e.preventDefault();
    setDragOverDay(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;

      const data = JSON.parse(dataStr);
      if (!data) return;

      // 1. 활성 Day를 드롭 대상 Day로 갱신
      onActiveDayChange(day);

      // 2. 검색 아이템 vs 카카오 핀 드래그 분기 처리
      setTimeout(() => {
        if (data.is_search_result) {
          onAddPlaceFromSearch(data, day);
        } else if (data.name && onRestaurantDrop) {
          onRestaurantDrop(data, day);
        }
      }, 50);
    } catch (err) {
      console.error("Day drop failed", err);
    }
  };

  // 캘린더 날짜 획득 헬퍼
  const getDayDateString = (dayNum: number): string | null => {
    if (!itinerary.start_date) return null;
    try {
      const start = new Date(itinerary.start_date);
      start.setDate(start.getDate() + (dayNum - 1));
      const yyyy = start.getFullYear();
      const mm = String(start.getMonth() + 1).padStart(2, '0');
      const dd = String(start.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      return null;
    }
  };

  // 요일 및 날짜 상세 정보 문자열 반환 헬퍼
  const getDayDateFullString = (dayNum: number): string => {
    if (!itinerary.start_date) return '';
    try {
      const start = new Date(itinerary.start_date);
      start.setDate(start.getDate() + (dayNum - 1));
      const yyyy = start.getFullYear();
      const mm = String(start.getMonth() + 1).padStart(2, '0');
      const dd = String(start.getDate()).padStart(2, '0');
      const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = weekDays[start.getDay()];
      return ` (${yyyy}년 ${mm}월 ${dd}일 ${dayOfWeek}요일)`;
    } catch (e) {
      return '';
    }
  };

  // 제목 밑에 노출할 전체 여행 기간 포맷 (예: "2026.6.1(월) - 6.4(목)")
  const formatItineraryPeriod = (): string => {
    if (!itinerary.start_date) return '';
    try {
      const startDate = new Date(itinerary.start_date);
      const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
      
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      const startDay = startDate.getDate();
      const startDayOfWeek = weekDays[startDate.getDay()];
      
      let endDate = itinerary.end_date ? new Date(itinerary.end_date) : null;
      if (!endDate && itinerary.days && itinerary.days.length > 0) {
        endDate = new Date(itinerary.start_date);
        endDate.setDate(endDate.getDate() + itinerary.days.length - 1);
      }
      
      if (!endDate) {
        return `${startYear}.${startMonth}.${startDay}(${startDayOfWeek})`;
      }
      
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;
      const endDay = endDate.getDate();
      const endDayOfWeek = weekDays[endDate.getDay()];
      
      if (startYear === endYear) {
        return `${startYear}.${startMonth}.${startDay}(${startDayOfWeek}) - ${endMonth}.${endDay}(${endDayOfWeek})`;
      } else {
        return `${startYear}.${startMonth}.${startDay}(${startDayOfWeek}) - ${endYear}.${endMonth}.${endDay}(${endDayOfWeek})`;
      }
    } catch (e) {
      return '';
    }
  };

  // 일차별 날짜 포맷 (예: "6.2(화)")
  const formatDayDate = (dayNum: number): string => {
    if (!itinerary.start_date) return '';
    try {
      const start = new Date(itinerary.start_date);
      start.setDate(start.getDate() + (dayNum - 1));
      const mm = start.getMonth() + 1;
      const dd = start.getDate();
      const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = weekDays[start.getDay()];
      return `${mm}.${dd}(${dayOfWeek})`;
    } catch (e) {
      return '';
    }
  };

  // Open-Meteo API 날씨 조회
  useEffect(() => {
    if (!itinerary.start_date) return;

    let lat = 37.5665;
    let lng = 126.9780;
    
    // 일정의 첫 번째 장소 좌표 조회, 없으면 기본 서울 중심
    const firstItem = itinerary.days.flatMap(d => d.items || [])[0];
    if (firstItem) {
      lat = firstItem.lat;
      lng = firstItem.lng;
    }

    async function fetchWeather() {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia/Seoul`);
        const data = await res.json();
        if (data && data.daily) {
          const dates = data.daily.time as string[];
          const wCodes = data.daily.weathercode as number[];
          const maxTemps = data.daily.temperature_2m_max as number[];
          const minTemps = data.daily.temperature_2m_min as number[];
          
          const forecastMap: Record<string, { icon: string; temp: string }> = {};
          dates.forEach((dateStr, idx) => {
            const code = wCodes[idx];
            let icon = '☀️';
            if (code === 0) icon = '☀️';
            else if (code >= 1 && code <= 3) icon = '⛅';
            else if (code === 45 || code === 48) icon = '🌫️';
            else if (code >= 51 && code <= 65) icon = '🌧️';
            else if (code >= 71 && code <= 75) icon = '❄️';
            else if (code >= 80 && code <= 82) icon = '🌦️';
            else if (code >= 95) icon = '⚡';
            
            forecastMap[dateStr] = {
              icon,
              temp: `${Math.round(minTemps[idx])}°/${Math.round(maxTemps[idx])}°`
            };
          });
          setWeatherForecast(forecastMap);
        }
      } catch (e) {
        console.error("Weather forecast fetch failed", e);
      }
    }

    fetchWeather();
  }, [itinerary.start_date, itinerary.days]);

  // 공유 링크 복사 헬퍼
  const handleCopyShareLink = () => {
    if (typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?sharedItineraryId=${itinerary.id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      })
      .catch(err => {
        console.error("Link copy failed", err);
        alert("공유 링크 복사에 실패했습니다.");
      });
  };

  // 노션 카테고리 이모지 헬퍼
  const getCategoryEmoji = (cat: string): string => {
    switch (cat) {
      case '식당': return '🍔';
      case '카페': return '☕';
      case '숙소': return '🏨';
      case '관광지':
      case '명소': return '🎡';
      case '쇼핑': return '🛍️';
      case '교통': return '🚗';
      default: return '📌';
    }
  };

  // 노션 체크리스트 개별 토글
  const handleToggleChecklist = (dayNum: number, itemId: string, checklistIdx: number) => {
    if (!onUpdateItinerary) return;

    const updatedDays = itinerary.days.map(d => {
      if (d.day === dayNum) {
        return {
          ...d,
          items: d.items.map(item => {
            if (item.id === itemId && item.checklist) {
              const newCheck = [...item.checklist];
              newCheck[checklistIdx] = {
                ...newCheck[checklistIdx],
                done: !newCheck[checklistIdx].done
              };
              return { ...item, checklist: newCheck };
            }
            return item;
          })
        };
      }
      return d;
    });

    onUpdateItinerary({
      ...itinerary,
      days: updatedDays
    });
  };

  // 교통수단 선택 토글
  const handleUpdateTransportType = (dayNum: number, itemId: string, type: 'walk' | 'transit' | 'car') => {
    if (!onUpdateItinerary) return;

    const updatedDays = itinerary.days.map(d => {
      if (d.day === dayNum) {
        return {
          ...d,
          items: d.items.map(item => {
            if (item.id === itemId) {
              return { ...item, transportType: type };
            }
            return item;
          })
        };
      }
      return d;
    });

    onUpdateItinerary({
      ...itinerary,
      days: updatedDays
    });
  };

  // 예산 연산
  const getDayBudget = (dayItems: ItineraryItem[]): number => {
    return (dayItems || []).reduce((sum, item) => sum + (item.budget || 0), 0);
  };

  const totalBudget = itinerary.days.reduce((sum, d) => 
    sum + getDayBudget(d.items)
  , 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: -400, y: 0, width: 420 }}
      animate={{ opacity: 1, x: 0, y: 0, width: isSearchingMode ? 840 : 420 }}
      exit={{ opacity: 0, x: -400 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      onDragOver={(e) => e.preventDefault()}
      className="absolute left-6 top-6 bottom-6 bg-zinc-950/85 backdrop-blur-2xl border border-white/10 rounded-[28px] shadow-2xl z-40 p-5 flex flex-col min-h-0 text-white overflow-hidden"
    >
      {/* 공유 성공 미니 토스트 알림 */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-5 left-1/2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-black px-4 py-2.5 rounded-full shadow-lg z-[60] tracking-tight border border-white/10 whitespace-nowrap"
          >
            실시간 공유 링크가 클립보드에 복사되었습니다! 🔗
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 영역 */}
      <div className="flex items-center justify-between pb-3 shrink-0 border-b border-white/5">
        {isSearchingMode ? (
          <div className="flex-1 flex gap-6 items-center">
            {/* 좌측 타임라인 헤더 */}
            <div className="w-[380px] flex items-center justify-between shrink-0">
              <div className="flex flex-col min-w-0 gap-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-zinc-100 truncate max-w-[150px]">{itinerary.title}</h4>
                  <button
                    onClick={handleCopyShareLink}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black text-zinc-300 hover:text-white hover:bg-orange-500/10 hover:border-orange-500/20 transition-all cursor-pointer shrink-0"
                    title="공유 링크 만들기"
                  >
                    <Share2 size={10} className="text-orange-400" />
                    <span>공유 🔗</span>
                  </button>
                </div>
                {itinerary.start_date && (
                  <span className="text-[10.5px] font-medium text-zinc-400">
                    {formatItineraryPeriod()}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white transition-colors shrink-0"
                title="편집 종료"
              >
                <X size={14} />
              </button>
            </div>
            {/* 우측 장소 탐색 헤더 (탭 변경 및 검색 닫기) */}
            <div className="flex-1 flex items-center justify-between min-w-0">
              <div className="flex gap-2">
                {(['search', 'recommend', 'favorite'] as const).map((tab) => {
                  const tabLabel = tab === 'search' ? '검색' : tab === 'recommend' ? '추천 맛집' : '즐겨찾기';
                  const isActive = exploreTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setExploreTab(tab)}
                      className={`px-3 py-1 text-[12px] font-black rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow shadow-red-500/20'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/5'
                      }`}
                    >
                      {tabLabel}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setIsSearchingMode(false)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-[11px] font-bold text-zinc-400 hover:text-white transition-all cursor-pointer"
                title="검색 닫기"
              >
                <ArrowLeft size={10} />
                <span>검색 닫기</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-between">
            <div className="flex flex-col min-w-0 gap-0.5">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-zinc-100 truncate max-w-[170px]">{itinerary.title}</h4>
                <button
                  onClick={handleCopyShareLink}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black text-zinc-300 hover:text-white hover:bg-orange-500/10 hover:border-orange-500/20 transition-all cursor-pointer shrink-0"
                  title="공유 링크 만들기"
                >
                  <Share2 size={10} className="text-orange-400" />
                  <span>공유 🔗</span>
                </button>
              </div>
              {itinerary.start_date && (
                <span className="text-[10.5px] font-medium text-zinc-400">
                  {formatItineraryPeriod()}
                </span>
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
        )}
      </div>

      {/* 본문 피드 영역 (검색모드 시 듀얼 컬럼 배치) */}
      <div className="flex-1 flex gap-6 min-h-0 mt-4 overflow-hidden">
        {/* 좌측 또는 전체: 통합 아코디언 타임라인 뷰 영역 (모든 Day 노출) */}
        <div className="w-[380px] flex flex-col min-h-0 overflow-hidden shrink-0">
          <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 relative min-h-0 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {itinerary.days.map((dayData) => {
              const isExpanded = !!expandedDays[dayData.day];
              const dayItems = dayData.items || [];
              const isDragOverThis = dragOverDay === dayData.day;
              
              // 날씨 정보 바인딩
              const dayDateStr = getDayDateString(dayData.day);
              const weather = (dayDateStr ? weatherForecast[dayDateStr] : null) || { icon: '☀️', temp: '16°/24°' };

              return (
                <div 
                  key={`day-accordion-${dayData.day}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDay(dayData.day);
                  }}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={(e) => handleDropOnDay(e, dayData.day)}
                  className={`border-b border-white/[0.06] transition-all duration-200 rounded-2xl ${
                    isDragOverThis 
                      ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)] scale-[0.99] border-dashed border'
                      : ''
                  }`}
                >
                  {/* Day 아코디언 헤더 */}
                  <div
                    onClick={() => toggleDayAccordion(dayData.day)}
                    className="w-full px-3.5 py-3 flex items-center justify-between bg-transparent cursor-pointer hover:bg-zinc-900/30 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-[13px] tracking-wider flex items-baseline">
                        <span className="font-black text-zinc-150">Day{dayData.day}</span>
                        {itinerary.start_date && (
                          <span className="text-[11px] font-bold text-zinc-500 ml-1.5">
                            {formatDayDate(dayData.day)}
                          </span>
                        )}
                      </div>
                      {weather && (
                        <span className="text-[11px] font-black text-zinc-300 bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-white/[0.04] flex items-center gap-1" title="예보 정보">
                          <span>{weather.icon}</span>
                          <span className="text-[9.5px] font-bold">{weather.temp}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {dayItems.length > 0 && (
                        <GripVertical size={12} className="text-zinc-600" />
                      )}
                      <div className="text-zinc-500">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </div>

                  {/* Day 아코디언 바디 (타임라인) */}
                  {isExpanded && (
                    <div className="p-3 pl-8 space-y-3 relative">
                      {dayItems.length > 0 && (
                        <div className="absolute left-[19px] top-4 bottom-12 w-[2px] bg-gradient-to-b from-orange-500/30 via-orange-500/10 to-transparent" />
                      )}

                      {dayItems.length === 0 ? (
                        <div className="py-4 flex justify-center">
                          <button
                            onClick={() => {
                              setTargetDayForSearch(dayData.day);
                              if (!isSearchingMode) {
                                setIsSearchingMode(true);
                              }
                            }}
                            className="w-8 h-8 rounded-full border border-dashed border-white/15 hover:border-orange-500/40 bg-zinc-900/30 hover:bg-zinc-900/60 flex items-center justify-center transition-all active:scale-95 cursor-pointer group"
                          >
                            <Plus size={14} className="text-zinc-500 group-hover:text-orange-400 transition-colors" />
                          </button>
                        </div>
                      ) : (
                        dayItems.map((item, idx) => {
                          const isSelected = selectedItemId === item.id;
                          
                          // 이전 장소와의 거리 및 이동 시간 칩 연산
                           let connectorChip = null;
                           if (idx > 0) {
                             const prevItem = dayItems[idx - 1];
                             const distance = getDistance(prevItem.lat, prevItem.lng, item.lat, item.lng);
                             const transport = item.transportType || (itinerary.transport === '자차/렌터카' ? 'car' : 'walk');
                             
                             // 이동 수단별 평속 산출 (자차 40, 대중교통 15, 도보 4)
                             const speedKmh = transport === 'car' ? 40 : transport === 'transit' ? 15 : 4;
                             const displayMinutes = item.customDuration || Math.max(1, Math.round((distance / speedKmh) * 60));
                             
                             connectorChip = (
                               <div className="relative left-[-23px] py-2 flex flex-col gap-1.5 z-20 my-1 select-none" onClick={e => e.stopPropagation()}>
                                 {/* 수직 도트 보조선 */}
                                 <div className="w-[2px] h-10 border-l-2 border-dashed border-zinc-700/60 absolute left-[23px] top-[-12px] bottom-[-12px] z-[-1]" />
                                 
                                 <div className="flex items-center gap-2 ml-[12px] bg-zinc-900/95 backdrop-blur-md border border-white/[0.08] px-1.5 py-1.5 rounded-2xl shadow-lg flex-wrap max-w-[380px]">
                                   <div className="flex items-center bg-zinc-950/70 rounded-xl p-0.5 border border-white/5 gap-0.5">
                                     <button
                                       onClick={() => handleUpdateTransportType(dayData.day, item.id, 'walk')}
                                       className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                         transport === 'walk' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
                                       }`}
                                       title="도보"
                                     >
                                       <Footprints size={14} strokeWidth={2.2} />
                                     </button>
                                     <button
                                       onClick={() => handleUpdateTransportType(dayData.day, item.id, 'transit')}
                                       className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                         transport === 'transit' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/30' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
                                       }`}
                                       title="대중교통"
                                     >
                                       <Bus size={14} strokeWidth={2.2} />
                                     </button>
                                     <button
                                       onClick={() => handleUpdateTransportType(dayData.day, item.id, 'car')}
                                       className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                         transport === 'car' ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md shadow-red-500/30' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
                                       }`}
                                       title="자차"
                                     >
                                       <Car size={14} strokeWidth={2.2} />
                                     </button>
                                   </div>
                                   <span className="text-[11px] font-bold text-zinc-300 pr-2 flex items-center gap-1">
                                     <span className="font-extrabold">{distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}</span>
                                     <span className="text-zinc-500">•</span>
                                     <span>약 {displayMinutes}분</span>
                                     {item.customDuration && (
                                       <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/25 ml-1">실시간</span>
                                     )}
                                   </span>
                                   
                                   {/* 실시간 길찾기 & 직접 입력 컨트롤 */}
                                   <div className="flex items-center gap-1 ml-auto">
                                     <button
                                       onClick={() => openKakaoMapRoute(dayData.day, prevItem, item)}
                                       className={`px-2 py-1 text-[9px] font-black rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                         activePollingItem?.itemId === item.id
                                           ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
                                           : 'bg-zinc-800 border-white/5 text-zinc-300 hover:text-white hover:bg-orange-500/10 hover:border-orange-500/20'
                                       }`}
                                     >
                                       <Navigation size={9} className="text-orange-400" />
                                       <span>{activePollingItem?.itemId === item.id ? '링크 대기중..' : '실시간 🔗'}</span>
                                     </button>
                                     
                                     <button
                                       onClick={() => setShowManualInputId(showManualInputId === item.id ? null : item.id)}
                                       className="p-1 rounded bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                       title="소요시간 직접 입력"
                                     >
                                       <Edit3 size={10} />
                                     </button>
                                   </div>
                                 </div>

                                 {/* 수동 입력 폼 */}
                                 {showManualInputId === item.id && (
                                   <div className="ml-[12px] p-2 bg-zinc-900 border border-white/10 rounded-xl flex items-center gap-2 max-w-[360px] shadow-lg">
                                     <input
                                       type="number"
                                       placeholder="분 단위"
                                       value={manualDuration}
                                       onChange={e => setManualDuration(e.target.value)}
                                       className="w-16 px-2 py-1 text-[11px] bg-zinc-950 border border-white/10 rounded-lg text-white font-bold"
                                     />
                                     <button
                                       onClick={() => {
                                         const min = parseInt(manualDuration);
                                         if (!isNaN(min) && min > 0) {
                                           handleApplyManualRoute(dayData.day, item.id, min);
                                         }
                                       }}
                                       className="px-2.5 py-1 text-[9px] font-black rounded-lg bg-gradient-to-r from-red-600 to-orange-500 text-white cursor-pointer"
                                     >
                                       적용
                                     </button>
                                     <button
                                       onClick={() => {
                                         const link = prompt('카카오맵 공유 링크(kko.to 또는 map.kakao.com)를 입력해 주세요.');
                                         if (link) {
                                           parseAndApplyLinkDirectly(link, dayData.day, item.id);
                                         }
                                       }}
                                       className="px-2.5 py-1 text-[9px] font-black rounded-lg bg-zinc-800 border border-white/5 text-zinc-300 hover:text-white cursor-pointer"
                                     >
                                       링크 분석
                                     </button>
                                   </div>
                                 )}
                               </div>
                             );
                           }

                          // 2일차 이상의 첫 스팟일 때 전날 마지막 스팟 연계 정보 연산
                          let prevDayLinkChip = null;
                          if (idx === 0 && dayData.day >= 2) {
                            const prevDayData = itinerary.days.find(d => d.day === dayData.day - 1);
                            const prevDayItems = prevDayData?.items || [];
                            const lastSpotOfPrevDay = prevDayItems[prevDayItems.length - 1];
                            
                            if (lastSpotOfPrevDay) {
                              const distance = getDistance(lastSpotOfPrevDay.lat, lastSpotOfPrevDay.lng, item.lat, item.lng);
                              const transport = item.transportType || (itinerary.transport === '자차/렌터카' ? 'car' : 'walk');
                              const speedKmh = transport === 'car' ? 40 : transport === 'transit' ? 15 : 4;
                              const minutes = Math.max(1, Math.round((distance / speedKmh) * 60));
                              
                              prevDayLinkChip = (
                                <div className="relative left-[-23px] py-1.5 flex items-center gap-1.5 z-20 my-1.5 select-none" onClick={e => e.stopPropagation()}>
                                  {/* 이전 일차 연계 수직 보조선 */}
                                  <div className="w-[2px] h-8 border-l-2 border-dotted border-orange-500/30 absolute left-[23px] top-[-10px] bottom-[-10px] z-[-1]" />
                                  
                                  <div className="flex items-center gap-1.5 ml-[12px] bg-zinc-900/95 backdrop-blur-md border border-orange-500/20 p-1 rounded-full shadow-md">
                                    <span className="text-[9px] font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20 shrink-0">
                                      Day {dayData.day - 1} 연계 🔗
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-350 pr-2">
                                      {lastSpotOfPrevDay.name} 출발 • {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`} • 약 {minutes}분
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          }

                          return (
                            <div key={item.id} className="relative group/panel">
                              {prevDayLinkChip}
                              {connectorChip}

                              {/* 코스 노드 바디 (Notion 템플릿 스타일 확장) */}
                              <div
                                onClick={() => {
                                  onActiveDayChange(dayData.day);
                                  onSelectItem(item);
                                }}
                                className={`relative border rounded-2xl p-3 flex flex-col gap-1.5 cursor-pointer transition-all duration-200 ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-red-950/25 to-orange-950/25 border-orange-500/50 shadow-[0_0_16px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/20'
                                    : 'bg-zinc-900/70 border-white/10 hover:border-orange-500/25 hover:bg-zinc-900/90 shadow-md hover:shadow-lg'
                                }`}
                              >
                                {/* 좌측 넘버링 인디케이터 (카드 내부 배치로 교통수단 컨트롤과 겹침 원천 방지) */}
                                <div className="absolute left-[-24px] top-3 flex flex-col items-center z-10" onClick={e => e.stopPropagation()}>
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-[11px] font-black flex items-center justify-center text-white shadow-md shadow-red-500/20 ring-2 ring-zinc-950">
                                    {idx + 1}
                                  </div>
                                  {item.visit_time && (
                                    <span className="text-[9px] text-orange-400 font-black mt-1.5 bg-orange-500/10 px-1.5 py-0.5 rounded-md border border-orange-500/15">
                                      {item.visit_time}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h5 className="text-[13.5px] font-black text-zinc-100 truncate flex items-center gap-1.5 tracking-tight">
                                      <span>{item.name}</span>
                                    </h5>
                                    <span className="text-[10.5px] text-zinc-400 block truncate mt-0.5">{item.address}</span>
                                  </div>

                                  {/* 컨트롤 */}
                                  <div className="flex items-center gap-1.5 opacity-65 group-hover/panel:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => {
                                        onActiveDayChange(dayData.day);
                                        onMoveUp(idx);
                                      }}
                                      disabled={idx === 0}
                                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 cursor-pointer transition-colors"
                                      title="위로 이동"
                                    >
                                      <ChevronUp size={13} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        onActiveDayChange(dayData.day);
                                        onMoveDown(idx);
                                      }}
                                      disabled={idx === dayItems.length - 1}
                                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 cursor-pointer transition-colors"
                                      title="아래로 이동"
                                    >
                                      <ChevronDown size={13} />
                                    </button>
                                    <button
                                      onClick={() => onEditItemMemo(item)}
                                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer transition-colors"
                                      title="상세 속성 편집"
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        onActiveDayChange(dayData.day);
                                        onRemoveItem(item.id);
                                      }}
                                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 cursor-pointer transition-colors"
                                      title="장소 삭제"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>

                                {/* 노션 데이터 속성 (예약상태, 예산) */}
                                {(item.status || item.budget !== undefined) && (
                                  <div className="flex flex-wrap gap-1.5 items-center mt-1.5 select-none">
                                    {item.status && (
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                        item.status === 'confirmed'
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                      }`}>
                                        {item.status === 'confirmed' ? '예약 완료 ✅' : '예약 필요 ⏳'}
                                      </span>
                                    )}
                                    {item.budget !== undefined && (
                                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-850 border border-white/[0.04] text-zinc-400">
                                        💸 {item.budget.toLocaleString()}원
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* 노션 체크리스트/준비물 실시간 토글 */}
                                {item.checklist && item.checklist.length > 0 && (
                                  <div className="space-y-1 mt-1.5 border-t border-white/5 pt-1.5" onClick={e => e.stopPropagation()}>
                                    {item.checklist.map((check, cIdx) => (
                                      <label key={cIdx} className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-300 hover:text-zinc-200 select-none">
                                        <input
                                          type="checkbox"
                                          checked={check.done}
                                          onChange={() => handleToggleChecklist(dayData.day, item.id, cIdx)}
                                          className="w-3 h-3 rounded bg-zinc-800 border border-white/10 accent-orange-500 cursor-pointer"
                                        />
                                        <span className={check.done ? 'line-through text-zinc-550' : ''}>{check.text}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}


                                {item.memo && (
                                  <p className="text-[10px] text-zinc-350 bg-zinc-950/40 border border-white/5 px-2.5 py-1 rounded-lg truncate mt-1.5 select-none">
                                    💡 {item.memo}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* 각 Day별 장소 추가 버튼 — 장소가 있을 때만 표시 (빈 상태엔 위 + 버튼이 대체) */}
                      {dayItems.length > 0 && (
                      <div className="flex justify-center pt-2 pb-1">
                        <button
                          onClick={() => {
                            setTargetDayForSearch(dayData.day);
                            if (!isSearchingMode) {
                              setIsSearchingMode(true);
                            }
                          }}
                          className="w-7 h-7 rounded-full border border-dashed border-white/10 hover:border-orange-500/40 bg-zinc-900/20 hover:bg-zinc-900/50 flex items-center justify-center transition-all active:scale-95 cursor-pointer group"
                        >
                          <Plus size={12} className="text-zinc-500 group-hover:text-orange-400 transition-colors" />
                        </button>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 제어 하단 바 */}
          <div className="pt-3 border-t border-white/5 shrink-0 flex gap-2">
            {onResetCustomWaypoints && (
              <button
                onClick={onResetCustomWaypoints}
                className="px-3.5 py-3 rounded-xl text-xs font-black text-zinc-400 bg-zinc-900 hover:bg-zinc-800 hover:text-white active:scale-[0.98] transition-all border border-white/10 cursor-pointer"
                title="드래그 수정된 경로를 초기 실제 도로망으로 리셋"
              >
                동선 초기화 🔄
              </button>
            )}
            <button
              onClick={onSave}
              className="flex-1 py-3 rounded-xl text-xs font-black text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-[0.98] transition-all shadow-lg shadow-red-500/15 flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
            >
              <Check size={12} />
              <span>코스 설계 완료</span>
            </button>
          </div>
        </div>

        {isSearchingMode && (
          /* 우측: 트리플 벤치마킹 장소 탐색 및 추가 패널 */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {exploreTab === 'search' && (
              /* 1. 검색 탭 */
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex gap-1.5 shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
                    <input
                      type="text"
                      placeholder="관광지, 스팟, 맛집 검색..."
                      value={searchQuery}
                      onChange={e => onSearchQueryChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onSearchPlaces()}
                      className="w-full bg-zinc-900/80 border border-white/5 rounded-xl pl-8 pr-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                  <button
                    onClick={onSearchPlaces}
                    disabled={isSearching}
                    className="px-2.5 bg-zinc-900 border border-white/5 hover:border-orange-500/30 rounded-xl text-[10px] font-black text-white hover:text-orange-400 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    검색
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-1.5 min-h-0 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {isSearching ? (
                    <div className="py-8 text-center text-xs text-zinc-500">검색 중...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">검색 결과가 없습니다.</div>
                  ) : (
                    searchResults.map((place: any, idx: number) => (
                      <div
                        key={`search-res-${idx}`}
                        onClick={() => {
                          onActiveDayChange(targetDayForSearch);
                          setTimeout(() => {
                            onAddPlaceFromSearch(place, targetDayForSearch);
                          }, 50);
                        }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', JSON.stringify({
                            ...place,
                            is_search_result: true
                          }));
                        }}
                        className="bg-zinc-900/40 hover:bg-zinc-900/70 border border-white/5 hover:border-orange-500/20 rounded-xl p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-all active:scale-[0.98] select-none group"
                      >
                        <div className="min-w-0 flex-1">
                          <h6 className="text-[12px] font-black text-zinc-100 truncate group-hover:text-orange-400 transition-colors">{place.place_name}</h6>
                          <p className="text-[10px] text-zinc-400 truncate mt-1">
                            {place.road_address_name || place.address_name}
                          </p>
                          <span className="inline-block text-[11px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/10 px-2.5 py-0.5 rounded-full mt-1.5">
                            {place.category_name?.split(' > ').pop() || '관광지'}
                          </span>
                        </div>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Plus size={10} className="text-orange-400" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {exploreTab === 'recommend' && (
              /* 2. 추천 맛집 탭 */
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-1.5 px-1 shrink-0">
                  <span className="text-[12px] font-bold text-zinc-400 flex items-center gap-1">
                    <Sparkles size={12} className="text-orange-400" />
                    <span>주변 및 가는길 5km 추천 맛집</span>
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {recommendedRestaurants.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <span className="text-[11px] text-zinc-550">지도의 코스 스팟을 선택하면<br/>그 주변의 추천 맛집이 활성화됩니다 ✨</span>
                    </div>
                  ) : (
                    recommendedRestaurants.map(({ restaurant, distance, type }) => (
                      <div
                        key={restaurant.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', JSON.stringify(restaurant));
                        }}
                        onClick={() => {
                          onActiveDayChange(targetDayForSearch);
                          setTimeout(() => {
                            if (onRestaurantDrop) onRestaurantDrop(restaurant, targetDayForSearch);
                          }, 50);
                        }}
                        className="bg-zinc-900/40 hover:bg-zinc-900/60 border border-white/5 rounded-xl p-2.5 flex items-start justify-between gap-2 transition-all cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <h5 className="text-[12px] font-bold text-zinc-100 group-hover:text-orange-400 transition-colors truncate">{restaurant.name}</h5>
                          <p className="text-[10px] text-zinc-400 truncate mt-1">{restaurant.address}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                              type === 'near'
                                ? 'text-orange-400 bg-orange-500/10 border-orange-500/10'
                                : 'text-red-400 bg-red-500/10 border-red-500/10'
                            }`}>
                              {type === 'near' ? '5km 이내' : '가는길 추천'} ({formatDistance(distance)})
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onActiveDayChange(targetDayForSearch);
                            setTimeout(() => {
                              if (onRestaurantDrop) onRestaurantDrop(restaurant, targetDayForSearch);
                            }, 50);
                          }}
                          className="p-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors cursor-pointer shrink-0"
                          title="현재 일정에 추가"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {exploreTab === 'favorite' && (
              /* 3. 즐겨찾기 맛집 탭 */
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-1.5 px-1 shrink-0">
                  <span className="text-[12px] font-bold text-zinc-400 flex items-center gap-1">
                    <Heart size={12} className="text-orange-400 fill-orange-400/20" />
                    <span>내가 저장한 즐겨찾기 맛집</span>
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {favorites.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <span className="text-[11px] text-zinc-500 font-bold">즐겨찾기해 둔 맛집이 없습니다.<br/>맛집 카드에서 하트(즐겨찾기)를 눌러보세요 ❤️</span>
                    </div>
                  ) : (
                    favorites.map((favId) => {
                      const restaurant = restaurants.find(r => r.id === favId);
                      if (!restaurant) return null;
                      return (
                        <div
                          key={restaurant.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify(restaurant));
                          }}
                          onClick={() => {
                            onActiveDayChange(targetDayForSearch);
                            setTimeout(() => {
                              if (onRestaurantDrop) onRestaurantDrop(restaurant, targetDayForSearch);
                            }, 50);
                          }}
                          className="bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 hover:border-orange-500/30 rounded-xl p-3 flex items-start justify-between gap-3 transition-all cursor-pointer group"
                        >
                          <div className="min-w-0">
                            <h5 className="text-[12px] font-bold text-zinc-100 group-hover:text-orange-400 transition-colors truncate">{restaurant.name}</h5>
                            <p className="text-[10px] text-zinc-400 truncate mt-1">{restaurant.address}</p>
                            <span className="inline-block text-[11px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full mt-1.5">
                              {restaurant.category || '음식점'}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onActiveDayChange(targetDayForSearch);
                              setTimeout(() => {
                                if (onRestaurantDrop) onRestaurantDrop(restaurant, targetDayForSearch);
                              }, 50);
                            }}
                            className="p-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors cursor-pointer shrink-0"
                            title="현재 일정에 추가"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
