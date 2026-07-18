'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DailyItinerary, ItineraryItem, Itinerary, Restaurant } from '@/types';
import { MapPin, Trash2, ChevronUp, ChevronDown, Check, X, Plus, Sparkles, Navigation, Edit3, ArrowLeft, Search, Utensils, GripVertical, Heart, Share2, MoreVertical, RotateCcw, Eye, LayoutGrid, List, ChevronRight, Footprints, Car, Bus } from 'lucide-react';
import { getDistance } from '@/lib/geoUtils';
import { openExternal } from '@/lib/external-link';

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
  onDelete?: () => void;
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
  onAddPlaceFromSearch: (place: any, targetDay?: number, insertIndex?: number) => void;

  favorites: string[];
  restaurants: Restaurant[];
  onUpdateItinerary?: (updated: Itinerary) => void;
  onResetCustomWaypoints?: () => void;
  windowWidth?: number;
  sidebarWidth?: number;
  isInline?: boolean;
  isSearchingMode?: boolean;
  onSearchingModeChange?: (val: boolean) => void;
  // 홈탭과 동일한 맛집 카드 렌더러 (등록 맛집 검색결과에 재사용)
  renderRestaurantCard?: (r: Restaurant, variant: 'feed' | 'list', opts: { onClick: () => void; onDragStart: (e: any) => void; hideDistance?: boolean; actionNode?: React.ReactNode; isItinerary?: boolean; cornerBadge?: React.ReactNode }) => any;
  planningInsertIndex?: { day: number; index: number } | null;
  onPlanningInsertIndexChange?: (info: { day: number; index: number } | null) => void;
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
  onDelete,
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
  onResetCustomWaypoints,
  windowWidth = 1200,
  sidebarWidth = 420,
  isInline = false,
  isSearchingMode: propSearchingMode,
  onSearchingModeChange,
  renderRestaurantCard,
  planningInsertIndex,
  onPlanningInsertIndexChange
}: Props) {
  // 아코디언 상태 관리 (기본적으로 첫번째 Day는 펼쳐진 상태로 세팅)
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  // 검색 모드로 진입할 때의 대상 Day
  const [targetDayForSearch, setTargetDayForSearch] = useState<number>(1);
  // 검색 결과 보기 방식 (홈탭과 동일: 피드/리스트). 스크롤 절약 위해 리스트 기본
  const [searchFeedLayout, setSearchFeedLayout] = useState<'insta' | 'list'>('list');
  // 코스 타임라인 보기 방식 (홈탭과 동일: 피드/리스트)
  const [timelineLayout, setTimelineLayout] = useState<'feed' | 'list'>('feed');
  
  const [internalSearchingMode, setInternalSearchingMode] = useState<boolean>(false);
  const isSearchingMode = propSearchingMode !== undefined ? propSearchingMode : internalSearchingMode;
  const setIsSearchingMode = onSearchingModeChange !== undefined ? onSearchingModeChange : setInternalSearchingMode;

  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  // 제목 인라인 편집 (생성 시엔 자동 제목이 붙고, 여기서 고쳐 쓴다)
  const [editingTitle, setEditingTitle] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>('');
  
  const isMobile = windowWidth < 768;

  // 길찾기 앱 선택 모달 대상 아이템 (홈탭 맛집 상세의 길찾기 UI와 동일 포맷)
  const [routeItem, setRouteItem] = useState<ItineraryItem | null>(null);
  // 편집/보기 모드 (편집=조작 컨트롤 노출, 보기=콘텐츠만)
  const [editMode, setEditMode] = useState<boolean>(true);
  // 시간 편집 — 칩 클릭 → 인라인 입력
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [timeDraft, setTimeDraft] = useState<string>('');
  const setItemTime = (dayNum: number, itemId: string, time: string) => {
    if (onUpdateItinerary) {
      onUpdateItinerary({ ...itinerary, days: itinerary.days.map(d => d.day === dayNum
        ? { ...d, items: d.items.map(it => it.id === itemId ? { ...it, visit_time: time || undefined } : it) }
        : d) });
    }
  };
  // 카드 hover 상태(제어버튼 노출) — 네임드 group-hover 미지원 환경 대비 JS로 처리
  const [hoverCardId, setHoverCardId] = useState<string | null>(null);
  // 시간 팝오버 바깥 클릭 시 닫기 (팝오버/칩 내부 클릭은 유지)
  useEffect(() => {
    if (!editingTimeId) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest && (t.closest('[data-time-pop]') || t.closest('[data-time-chip]'))) return;
      setEditingTimeId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [editingTimeId]);

  const renderInsertZone = (targetDay: number, insertIdx: number) => {
    return (
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onPlanningInsertIndexChange?.({ day: targetDay, index: insertIdx });
          setIsSearchingMode(true);
          // Set targetDayForSearch so the search knows which day we are inserting into
          setTargetDayForSearch(targetDay);
        }}
        className="group/insert relative h-3 my-[-1.5px] flex items-center justify-center cursor-pointer z-30 transition-all hover:h-6"
      >
        {/* Subtle line that lights up on hover */}
        <div className="absolute inset-x-3 h-[1px] border-t border-dashed border-transparent group-hover/insert:border-orange-400/50 transition-colors" />
        
        {/* Circle "+" button that scales up on hover */}
        <div className="absolute w-[18px] h-[18px] rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center opacity-0 scale-90 group-hover/insert:opacity-100 group-hover/insert:scale-100 transition-all hover:bg-orange-500 hover:border-orange-500 hover:text-white" style={{ color: 'var(--itn-accent)' }}>
          <Plus size={9} strokeWidth={3.5} />
        </div>
      </div>
    );
  };

  // 카드 하단 메모 (길찾기는 카드 사이 레그로 이동)
  const renderItemActionBar = (item: ItineraryItem) => {
    if (item.memo) {
      return (
        <div
          onClick={(e) => { e.stopPropagation(); if (editMode) onEditItemMemo(item); }}
          className="bg-amber-50/90 hover:bg-amber-100/90 border border-amber-200/60 rounded-xl px-3 py-1.5 mt-2 shadow-sm transition-all text-amber-900 text-xs font-semibold select-none leading-relaxed flex items-start gap-1.5"
          style={{ cursor: editMode ? 'pointer' : 'default' }}
        >
          <span className="shrink-0 text-amber-500 text-[13px]">💡</span>
          <div className="flex-1 whitespace-pre-wrap">{item.memo}</div>
        </div>
      );
    }
    if (editMode) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onEditItemMemo(item); }}
          className="mt-2 text-[11.5px] font-bold px-2 py-1 rounded-lg transition-colors hover:bg-black/5 cursor-pointer"
          style={{ color: 'var(--itn-text-muted)' }}
        >
          ＋ 메모
        </button>
      );
    }
    return null;
  };

  // 이동수단: 기본은 거리 자동 추정, 아이콘 탭으로 도보→대중교통→차량 순환(transportType 저장)
  const MODE_ORDER = ['walk', 'transit', 'car'] as const;
  const MODE_META: Record<string, { label: string; Icon: any }> = {
    walk: { label: '도보', Icon: Footprints },
    transit: { label: '대중교통', Icon: Bus },
    car: { label: '차량', Icon: Car },
  };
  // 장소 간 직선거리 + 이동수단(탭 순환) + 길찾기. prev=null이면 첫 장소(현위치 출발).
  const renderLeg = (prev: ItineraryItem | null, item: ItineraryItem, dayNum: number) => {
    let distLabel = '';
    let modeKey = 'walk';
    if (prev) {
      const km = getDistance(prev.lat, prev.lng, item.lat, item.lng);
      distLabel = km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
      modeKey = (item.transportType as string) || (km < 1 ? 'walk' : 'car'); // 저장된 오버라이드 우선, 없으면 거리 자동
    }
    const meta = MODE_META[modeKey] || MODE_META.walk;
    const ModeIcon = meta.Icon;
    const cycleMode = () => {
      if (!onUpdateItinerary) return;
      const next = MODE_ORDER[(MODE_ORDER.indexOf(modeKey as any) + 1) % MODE_ORDER.length];
      onUpdateItinerary({ ...itinerary, days: itinerary.days.map(d => d.day === dayNum
        ? { ...d, items: d.items.map(it => it.id === item.id ? { ...it, transportType: next } : it) }
        : d) });
    };
    return (
      <div className="relative grid items-center gap-1.5" style={{ gridTemplateColumns: '38px minmax(0,1fr)', minHeight: 30 }}>
        <div className="absolute w-[2px]" style={{ top: '-6px', bottom: '-6px', left: '19px', transform: 'translateX(-50%)', background: 'var(--itn-border)' }} />
        <div className="relative z-10 flex justify-center">
          {prev ? (
            <button onClick={(e) => { e.stopPropagation(); cycleMode(); }} className="w-[22px] h-[22px] rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer" style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', color: 'var(--itn-text-muted)' }} title="탭하여 이동수단 변경">
              <ModeIcon size={12} />
            </button>
          ) : (
            <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center" style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', color: 'var(--itn-text-muted)' }}>
              <Navigation size={11} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-bold truncate" style={{ color: 'var(--itn-text-sub)' }}>
            {prev
              ? <>{meta.label} · <span style={{ color: 'var(--itn-text-muted)' }}>{distLabel}</span></>
              : <span style={{ color: 'var(--itn-text-muted)' }}>현위치에서 출발</span>}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setRouteItem(item); }}
            className="shrink-0 flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg transition-colors hover:bg-black/5 cursor-pointer"
            style={{ color: 'var(--itn-accent)' }}
            title="길찾기"
          >
            <Navigation size={11} /> 길찾기
          </button>
        </div>
      </div>
    );
  };

  // 반응형 너비 계산
  const panelWidth = isMobile
    ? windowWidth - 32 // margins: left-4, right-4
    : isSearchingMode
    ? Math.min(windowWidth - 48, 840)
    : Math.min(windowWidth - 48, sidebarWidth);

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

      // 0. 기존 코스 아이템을 다른 Day로 이동 (드래그 앤 드롭)
      if (data.__moveItem && data.itemId && onUpdateItinerary) {
        const fromDay = data.fromDay;
        if (fromDay === day) return; // 같은 날이면 무시(같은 날 순서변경은 화살표로)
        const src = itinerary.days.find(d => d.day === fromDay);
        const moved = src?.items.find((it: any) => it.id === data.itemId);
        if (!moved) return;
        onUpdateItinerary({
          ...itinerary,
          days: itinerary.days.map(d => {
            if (d.day === fromDay) return { ...d, items: d.items.filter((it: any) => it.id !== data.itemId) };
            if (d.day === day) return { ...d, items: [...d.items, moved] };
            return d;
          }),
        });
        onActiveDayChange(day);
        return;
      }

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

  // 검색 결과 → 우리 서비스 등록 맛집 매칭 (kakao_place_id 우선, 없으면 이름+좌표 근접)
  const findRegistered = (place: any): Restaurant | null => {
    if (!restaurants || !restaurants.length) return null;
    if (place?.id) {
      const byId = restaurants.find(r => r.kakao_place_id && String(r.kakao_place_id) === String(place.id));
      if (byId) return byId;
    }
    const px = parseFloat(place?.x), py = parseFloat(place?.y);
    const norm = (s: string) => (s || '').replace(/\s/g, '');
    return restaurants.find(r => norm(r.name) === norm(place?.place_name) &&
      (isNaN(px) || isNaN(py) || (Math.abs(r.lat - py) < 0.003 && Math.abs(r.lng - px) < 0.003))) || null;
  };
  const fmtViews = (n?: number) => {
    if (!n) return '';
    if (n >= 10000) return `${Math.floor(n / 10000)}만`;
    return n.toLocaleString();
  };
  // 타임라인 코스 아이템 → 등록 맛집 매칭 (restaurant_id 우선, 없으면 이름+좌표)
  const findRegForItem = (item: any): Restaurant | null => {
    if (!restaurants || !restaurants.length) return null;
    if (item?.restaurant_id) {
      const byRid = restaurants.find(r => String(r.id) === String(item.restaurant_id));
      if (byRid) return byRid;
    }
    return findRegistered({ id: item?.kakao_place_id, place_name: item?.name, x: item?.lng, y: item?.lat });
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
  // 제목 인라인 편집 — 클릭하면 그 자리가 input이 된다
  const beginEditTitle = () => { setTitleDraft(itinerary.title); setEditingTitle(true); };
  const commitTitle = () => {
    const next = titleDraft.trim();
    if (next && next !== itinerary.title) onUpdateItinerary?.({ ...itinerary, title: next });
    setEditingTitle(false);
  };
  const renderTitle = (maxW: string) => (
    editingTitle ? (
      <input
        autoFocus
        value={titleDraft}
        onChange={e => setTitleDraft(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={e => {
          if (e.key === 'Enter') commitTitle();
          if (e.key === 'Escape') setEditingTitle(false);
        }}
        className={`${maxW} text-base font-bold bg-transparent border-b outline-none`}
        style={{ color: 'var(--itn-text)', borderColor: 'var(--itn-accent)' }}
      />
    ) : (
      <h4
        onClick={onUpdateItinerary ? beginEditTitle : undefined}
        title={onUpdateItinerary ? '클릭해서 이름 수정' : undefined}
        className={`text-base font-bold truncate ${maxW} ${onUpdateItinerary ? 'cursor-text hover:opacity-70 transition-opacity' : ''}`}
        style={{ color: 'var(--itn-text)' }}
      >
        {itinerary.title}
      </h4>
    )
  );

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
  // 예산 연산
  const getDayBudget = (dayItems: ItineraryItem[]): number => {
    return (dayItems || []).reduce((sum, item) => sum + (item.budget || 0), 0);
  };

  const totalBudget = itinerary.days.reduce((sum, d) => 
    sum + getDayBudget(d.items)
  , 0);

  return (
    <motion.div
      initial={isInline ? { opacity: 0 } : { opacity: 0, x: -400, y: 0, width: 420 }}
      animate={isInline ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, width: panelWidth }}
      exit={isInline ? { opacity: 0 } : { opacity: 0, x: -400 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => showMoreMenu && setShowMoreMenu(false)}
      className={isInline 
        ? "w-full h-full flex flex-col min-h-0 overflow-hidden bg-transparent p-5 border-0 rounded-none z-20"
        : `absolute itn-glass-panel rounded-3xl z-40 p-5 flex flex-col min-h-0 overflow-hidden ${
            isMobile ? 'left-4 right-4 top-4 bottom-24' : 'left-6 top-6 bottom-6'
          }`
      }
      style={isInline ? undefined : { 
        boxShadow: 'var(--itn-shadow-lg)',
        width: isMobile ? undefined : panelWidth
      }}
    >
      {/* 공유 성공 미니 토스트 알림 */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-5 left-1/2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[11px] font-bold px-4 py-2.5 rounded-full shadow-lg z-[60] tracking-tight whitespace-nowrap"
          >
            실시간 공유 링크가 클립보드에 복사되었습니다! 🔗
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 영역 */}
      <div className="flex items-center justify-between pb-3 shrink-0 border-b" style={{ borderColor: 'var(--itn-border)' }}>
        {isSearchingMode ? (
          <div className="flex-1 flex gap-6 items-center">
            {/* 좌측 타임라인 헤더 — 콘텐츠 타임라인 컬럼 폭과 일치시켜 정렬 */}
            <div className={`${isInline ? 'w-[340px]' : 'w-[380px]'} flex items-center justify-between shrink-0`}>
              <div className="flex flex-col min-w-0 gap-0.5">
                {renderTitle('max-w-[180px]')}
                {itinerary.start_date && (
                  <span className="text-xs font-medium" style={{ color: 'var(--itn-text-sub)' }}>
                    {formatItineraryPeriod()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleCopyShareLink}
                  className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                  style={{ color: 'var(--itn-text-muted)' }}
                  title="공유 링크 만들기"
                >
                  <Share2 size={16} />
                </button>
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }}
                    className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                    style={{ color: 'var(--itn-text-muted)' }}
                    title="더보기"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {showMoreMenu && (
                    <div className="absolute right-0 top-full mt-1 w-40 rounded-xl py-1 z-50" style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', boxShadow: 'var(--itn-shadow)' }} onClick={(e) => e.stopPropagation()}>
                      {onResetCustomWaypoints && (
                        <button
                          onClick={() => { onResetCustomWaypoints(); setShowMoreMenu(false); }}
                          className="w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 hover:bg-black/5 transition-colors cursor-pointer"
                          style={{ color: 'var(--itn-text-sub)' }}
                        >
                          <RotateCcw size={13} />
                          동선 초기화
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                  style={{ color: 'var(--itn-text-muted)' }}
                  title="편집 종료"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* 우측 장소 탐색 헤더 (탭 변경 및 검색 닫기) */}
            <div className="flex-1 flex items-center justify-between min-w-0">
              <div className="flex gap-1">
                {(['search', 'recommend', 'favorite'] as const).map((tab) => {
                  const tabLabel = tab === 'search' ? '검색' : tab === 'recommend' ? '추천 맛집' : '즐겨찾기';
                  const isActive = exploreTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setExploreTab(tab)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-sm'
                          : 'hover:bg-black/5'
                      }`}
                      style={!isActive ? { color: 'var(--itn-text-muted)' } : undefined}
                    >
                      {tabLabel}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setIsSearchingMode(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold hover:bg-black/5 transition-all cursor-pointer"
                style={{ color: 'var(--itn-text-muted)' }}
                title="검색 닫기"
              >
                <ArrowLeft size={11} />
                <span>닫기</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-between">
            <div className="flex flex-col min-w-0 gap-0.5">
              {renderTitle('max-w-[200px]')}
              {itinerary.start_date && (
                <span className="text-xs font-medium" style={{ color: 'var(--itn-text-sub)' }}>
                  {formatItineraryPeriod()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setEditMode(m => !m)}
                className="mr-0.5 px-2.5 h-8 flex items-center gap-1 rounded-lg text-[11px] font-black transition-colors cursor-pointer"
                style={editMode ? { color: '#fff', background: 'linear-gradient(135deg,#ef4444,#f97316)' } : { color: 'var(--itn-text-muted)', background: 'var(--itn-card-hover)' }}
                title={editMode ? '편집 중 — 클릭하면 보기' : '보기 — 클릭하면 편집'}
              >
                {editMode ? <><Edit3 size={12} /> 편집</> : <><Eye size={12} /> 보기</>}
              </button>
              <button
                onClick={handleCopyShareLink}
                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                style={{ color: 'var(--itn-text-muted)' }}
                title="공유 링크 만들기"
              >
                <Share2 size={16} />
              </button>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }}
                  className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                  style={{ color: 'var(--itn-text-muted)' }}
                  title="더보기"
                >
                  <MoreVertical size={16} />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-xl py-1 z-50" style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', boxShadow: 'var(--itn-shadow)' }} onClick={(e) => e.stopPropagation()}>
                    {onResetCustomWaypoints && (
                      <button
                        onClick={() => { onResetCustomWaypoints(); setShowMoreMenu(false); }}
                        className="w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 hover:bg-black/5 transition-colors cursor-pointer"
                        style={{ color: 'var(--itn-text-sub)' }}
                      >
                        <RotateCcw size={13} />
                        동선 초기화
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                style={{ color: 'var(--itn-text-muted)' }}
                title="편집 종료"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 본문 피드 영역 (검색모드 시 듀얼 컬럼 배치) */}
      <div className={`flex-1 flex min-h-0 mt-4 overflow-hidden ${isMobile ? 'flex-col gap-4' : 'gap-6'}`}>
        {/* 좌측 또는 전체: 통합 아코디언 타임라인 뷰 영역 (모든 Day 노출) */}
        <div className={`${isMobile ? 'w-full' : isInline ? (isSearchingMode ? 'w-[340px]' : 'w-full') : 'w-[380px]'} flex flex-col min-h-0 overflow-hidden shrink-0 ${isMobile && isSearchingMode ? 'hidden' : ''}`}>
          {itinerary.days.some(d => (d.items || []).length > 0) && (
            <div className="flex items-center justify-between px-2 pb-2 shrink-0">
              <span className="text-[11px] font-bold" style={{ color: 'var(--itn-text-muted)' }}>코스</span>
              <div className="flex items-center rounded-full p-0.5" style={{ background: 'var(--itn-card-hover)' }}>
                <button type="button" onClick={() => setTimelineLayout('feed')} title="피드 보기" className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer" style={timelineLayout === 'feed' ? { background: 'var(--itn-card)', color: 'var(--itn-accent)', boxShadow: 'var(--itn-shadow-sm)' } : { color: 'var(--itn-text-muted)' }}><LayoutGrid size={12} /></button>
                <button type="button" onClick={() => setTimelineLayout('list')} title="리스트 보기" className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer" style={timelineLayout === 'list' ? { background: 'var(--itn-card)', color: 'var(--itn-accent)', boxShadow: 'var(--itn-shadow-sm)' } : { color: 'var(--itn-text-muted)' }}><List size={12} /></button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto pl-2 pr-1 space-y-3 relative min-h-0 itn-scrollbar">
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
                  className={`transition-all duration-200 rounded-2xl ${
                    isDragOverThis 
                      ? 'bg-[var(--itn-accent-light)] scale-[0.99] border border-dashed'
                      : 'border-b'
                  }`}
                  style={{ borderColor: isDragOverThis ? 'var(--itn-accent)' : 'var(--itn-border-subtle)' }}
                >
                  {/* Day 아코디언 헤더 */}
                  <div
                    onClick={() => toggleDayAccordion(dayData.day)}
                    className="w-full px-3.5 py-3 flex items-center justify-between bg-transparent cursor-pointer hover:bg-black/[0.03] transition-colors select-none rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-sm tracking-wider flex items-baseline">
                        <span className="font-bold" style={{ color: 'var(--itn-text)' }}>Day{dayData.day}</span>
                        {itinerary.start_date && (
                          <span className="text-xs font-medium ml-1.5" style={{ color: 'var(--itn-text-sub)' }}>
                            {formatDayDate(dayData.day)}
                          </span>
                        )}
                      </div>
                      {weather && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ color: 'var(--itn-text-sub)', background: 'var(--itn-card)', border: '1px solid var(--itn-border)' }} title="예보 정보">
                          <span>{weather.icon}</span>
                          <span className="text-[11px] font-medium">{weather.temp}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {dayItems.length > 0 && (
                        <GripVertical size={12} style={{ color: 'var(--itn-text-muted)' }} />
                      )}
                      <div style={{ color: 'var(--itn-text-muted)' }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </div>

                  {/* Day 아코디언 바디 (타임라인) */}
                  {isExpanded && (
                    <div className="p-3 px-0.5 space-y-0 relative">

                      {dayItems.length === 0 ? (
                        <div className="py-4 flex justify-center">
                          <button
                            onClick={() => {
                              setTargetDayForSearch(dayData.day);
                              if (!isSearchingMode) {
                                setIsSearchingMode(true);
                              }
                            }}
                            className="w-8 h-8 rounded-full border border-dashed hover:border-[var(--itn-accent)]/40 flex items-center justify-center transition-all active:scale-95 cursor-pointer group"
                            style={{ borderColor: 'var(--itn-border)', background: 'var(--itn-card)' }}
                          >
                            <Plus size={14} className="group-hover:text-[var(--itn-accent)] transition-colors" style={{ color: 'var(--itn-text-muted)' }} />
                          </button>
                        </div>
                      ) : (
                        dayItems.map((item, idx) => {
                          const isSelected = selectedItemId === item.id;
                          const connectorKey = `${dayData.day}-${idx}`;
                          
                          const reg = renderRestaurantCard ? findRegForItem(item) : null;
                          const controlButtons = (
                            <>
                              <button onClick={() => { onActiveDayChange(dayData.day); onMoveUp(idx); }} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 disabled:opacity-30 cursor-pointer transition-colors" style={{ color: 'var(--itn-text-muted)' }} title="위로 이동"><ChevronUp size={13} /></button>
                              <button onClick={() => { onActiveDayChange(dayData.day); onMoveDown(idx); }} disabled={idx === dayItems.length - 1} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 disabled:opacity-30 cursor-pointer transition-colors" style={{ color: 'var(--itn-text-muted)' }} title="아래로 이동"><ChevronDown size={13} /></button>
                              <button onClick={() => onEditItemMemo(item)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 cursor-pointer transition-colors" style={{ color: 'var(--itn-text-muted)' }} title="상세 속성 편집"><Edit3 size={11} /></button>
                              <button onClick={() => { onActiveDayChange(dayData.day); onRemoveItem(item.id); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-400 cursor-pointer transition-colors" style={{ color: 'var(--itn-text-muted)' }} title="장소 삭제"><Trash2 size={11} /></button>
                            </>
                          );
                          const extrasNode = (
                            <>
                              {(item.status || item.budget !== undefined) && (
                                <div className="flex flex-wrap gap-1.5 items-center mt-1.5 select-none">
                                  {item.status && (
                                    <span className={`text-[14px] font-bold px-2 py-0.5 rounded-lg border ${item.status === 'confirmed' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>{item.status === 'confirmed' ? '예약 완료 ✅' : '예약 필요 ⏳'}</span>
                                  )}
                                  {item.budget !== undefined && (
                                    <span className="text-[14px] font-bold px-2 py-0.5 rounded-lg" style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', color: 'var(--itn-text-sub)' }}>💸 {item.budget.toLocaleString()}원</span>
                                  )}
                                </div>
                              )}
                              {item.checklist && item.checklist.length > 0 && (
                                <div className="space-y-1 mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--itn-border-subtle)' }} onClick={e => e.stopPropagation()}>
                                  {item.checklist.map((check, cIdx) => (
                                    <label key={cIdx} className="flex items-center gap-1.5 cursor-pointer text-[15px] select-none" style={{ color: 'var(--itn-text-sub)' }}>
                                      <input type="checkbox" checked={check.done} onChange={() => handleToggleChecklist(dayData.day, item.id, cIdx)} className="w-3.5 h-3.5 rounded accent-orange-500 cursor-pointer" />
                                      <span className={check.done ? 'line-through' : ''} style={check.done ? { color: 'var(--itn-text-muted)' } : undefined}>{check.text}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              {renderItemActionBar(item)}
                            </>
                          );

                          return (
                             <div key={item.id} className="relative group/panel flex flex-col gap-0.5" style={{ marginTop: idx > 0 ? '2px' : '0' }}>

                              {/* 이동 레그 — 첫 장소는 현위치 출발, 이후는 직전 장소 기준 + 이동수단 탭/길찾기 */}
                              {renderLeg(idx > 0 ? dayItems[idx - 1] : null, item, dayData.day)}

                              {/* 인라인 삽입 영역 (카드가 렌더링되기 바로 전 위치) — 편집 모드만 */}
                              {editMode && renderInsertZone(dayData.day, idx)}

                              {/* 좌측 시간 spine 마커 + 카드 컬럼 */}
                              <div className="relative grid gap-1.5" style={{ gridTemplateColumns: '38px minmax(0,1fr)' }}>
                                <div className="relative flex flex-col items-center pt-2.5 gap-1" style={{ zIndex: editingTimeId === item.id ? 60 : undefined }}>
                                  <div className="absolute w-[2px]" style={{ top: '-8px', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', background: 'var(--itn-border)' }} />
                                  <span className="relative z-10 w-[11px] h-[11px] rounded-full transition-all" style={isSelected
                                    ? { background: 'linear-gradient(135deg,#ef4444,#f97316)', boxShadow: '0 2px 7px -1px rgba(239,68,68,.5), 0 0 0 3px var(--itn-card)' }
                                    : { background: 'var(--itn-card)', boxShadow: 'inset 0 0 0 2px var(--itn-border)' }} />
                                  <button
                                    data-time-chip
                                    onClick={(e) => { e.stopPropagation(); setTimeDraft(item.visit_time || '12:30'); setEditingTimeId(editingTimeId === item.id ? null : item.id); }}
                                    className="relative z-10 text-[10px] font-bold leading-none cursor-pointer transition-opacity hover:opacity-60"
                                    style={{ color: editingTimeId === item.id ? 'var(--itn-accent)' : 'var(--itn-text-muted)', fontVariantNumeric: 'tabular-nums' }}
                                    title="클릭해서 시간 입력"
                                  >
                                    {item.visit_time || '00:00'}
                                  </button>
                                  {editingTimeId === item.id && (
                                    <div data-time-pop className="absolute top-0 left-full ml-2 z-[70] rounded-2xl p-2.5" style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', boxShadow: 'var(--itn-shadow-lg)' }}>
                                      <div className="text-[10px] font-black mb-1.5 px-0.5 whitespace-nowrap" style={{ color: 'var(--itn-text-muted)' }}>방문 시간</div>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="time"
                                          autoFocus
                                          value={timeDraft}
                                          onChange={(e) => setTimeDraft(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') { setItemTime(dayData.day, item.id, timeDraft); setEditingTimeId(null); } if (e.key === 'Escape') setEditingTimeId(null); }}
                                          className="text-[13px] font-bold rounded-lg px-2 py-1.5"
                                          style={{ background: 'var(--itn-card-hover)', color: 'var(--itn-text)', border: '1px solid var(--itn-border)', outline: 'none' }}
                                        />
                                        <button onClick={() => { setItemTime(dayData.day, item.id, timeDraft); setEditingTimeId(null); }} className="px-3 h-9 rounded-lg text-[11px] font-black text-white shrink-0" style={{ background: 'linear-gradient(135deg,#ef4444,#f97316)' }}>적용</button>
                                      </div>
                                      <button onClick={() => { setItemTime(dayData.day, item.id, ''); setEditingTimeId(null); }} className="mt-1.5 text-[10px] font-bold px-0.5 whitespace-nowrap" style={{ color: 'var(--itn-text-muted)' }}>시간 지우기</button>
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 relative" onMouseEnter={() => setHoverCardId(item.id)} onMouseLeave={() => setHoverCardId(null)}>
                              {/* 통합 컨트롤 — 편집 모드 + hover(카드 우상단 플로팅) */}
                              {editMode && hoverCardId === item.id && (
                                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 p-1 rounded-xl z-30" style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', boxShadow: 'var(--itn-shadow)' }} onClick={e => e.stopPropagation()}>
                                  {controlButtons}
                                </div>
                              )}

                              {reg && renderRestaurantCard ? (
                                <div className={`relative rounded-2xl w-full ${isSelected ? 'ring-2 ring-orange-400' : ''}`}>
                                  {renderRestaurantCard(reg, timelineLayout, {
                                    hideDistance: true,
                                    isItinerary: true,
                                    onClick: () => { onActiveDayChange(dayData.day); onSelectItem(item); },
                                    onDragStart: (e: any) => { e.dataTransfer.setData('text/plain', JSON.stringify({ __moveItem: true, itemId: item.id, fromDay: dayData.day })); },
                                  })}
                                </div>
                              ) : (
                              <div
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', JSON.stringify({ __moveItem: true, itemId: item.id, fromDay: dayData.day }));
                                }}
                                onClick={() => {
                                  onActiveDayChange(dayData.day);
                                  onSelectItem(item);
                                }}
                                className="relative rounded-2xl px-3 py-2.5 flex flex-col cursor-pointer transition-all duration-200"
                                style={{
                                  background: isSelected ? 'var(--itn-accent-light)' : 'var(--itn-card)',
                                  border: `1px solid ${isSelected ? 'var(--itn-accent)' : 'var(--itn-border)'}`,
                                  boxShadow: 'var(--itn-shadow-sm)',
                                }}
                              >
                                {/* 이름/주소 (시간은 좌측 spine 마커) */}
                                <div className="min-w-0 pr-8">
                                  <h5 className="text-[14px] font-bold truncate tracking-tight" style={{ color: 'var(--itn-text)' }}>{item.name}</h5>
                                  <span className="text-[11.5px] block truncate mt-0.5" style={{ color: 'var(--itn-text-sub)' }}>{item.address}</span>
                                </div>
                              </div>
                              )}

                              {/* 상태·체크리스트·메모·후보 — 카드 밖, 등록/커스텀 동일 */}
                              {extrasNode}
                                </div>
                              </div>

                              {/* 마지막 카드인 경우 하단에 삽입 영역 하나 더 렌더링 — 편집 모드만 */}
                              {editMode && idx === dayItems.length - 1 && renderInsertZone(dayData.day, dayItems.length)}
                            </div>
                          );
                        })
                      )}

                      {/* Day add spot button — 편집 모드만 */}
                      {editMode && dayItems.length > 0 && (
                      <div className="flex justify-center pt-3 pb-1">
                        <button
                          onClick={() => {
                            setTargetDayForSearch(dayData.day);
                            if (!isSearchingMode) {
                              setIsSearchingMode(true);
                            }
                          }}
                          className="w-7 h-7 rounded-full border border-dashed hover:border-[var(--itn-accent)]/40 flex items-center justify-center transition-all active:scale-95 cursor-pointer group"
                          style={{ borderColor: 'var(--itn-border)', background: 'var(--itn-card)' }}
                        >
                          <Plus size={12} className="group-hover:text-[var(--itn-accent)] transition-colors" style={{ color: 'var(--itn-text-muted)' }} />
                        </button>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 하단 바 제거 - 자동 저장 + 헤더 더보기 메뉴로 대체 */}
        </div>

        {isSearchingMode && (
          /* 우측: 트리플 벤치마킹 장소 탐색 및 추가 패널 */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {exploreTab === 'search' && (
              /* 1. 검색 탭 */
              <div className="flex-1 flex flex-col min-h-0">
                {planningInsertIndex && (
                  <div className="mb-2 px-3 py-1.5 rounded-lg flex items-center justify-between text-[11px] font-bold bg-orange-500/10 border border-orange-500/20 text-orange-600 animate-fadeIn shrink-0 select-none">
                    <span className="flex items-center gap-1">📍 Day {planningInsertIndex.day}의 {planningInsertIndex.index + 1}번째 순서에 삽입 대기 중</span>
                    <button 
                      onClick={() => onPlanningInsertIndexChange?.(null)}
                      className="text-[10px] text-slate-400 hover:text-orange-500 font-black cursor-pointer flex items-center justify-center p-0.5 rounded-full hover:bg-slate-100"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
                <div className="flex gap-1.5 shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--itn-text-muted)' }} />
                    <input
                      type="text"
                      placeholder="관광지, 스팟, 맛집 검색..."
                      value={searchQuery}
                      onChange={e => onSearchQueryChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onSearchPlaces()}
                      className="w-full rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none transition-colors"
                      style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', color: 'var(--itn-text)' }}
                    />
                  </div>
                  <button
                    onClick={onSearchPlaces}
                    disabled={isSearching}
                    className="px-3 rounded-xl text-xs font-bold disabled:opacity-50 transition-all cursor-pointer"
                    style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', color: 'var(--itn-text-sub)' }}
                  >
                    검색
                  </button>
                </div>

                {/* 결과 헤더: 개수 + 피드/리스트 토글 (홈탭과 동일 포맷) */}
                {searchResults.length > 0 && (
                  <div className="flex items-center justify-between mt-2.5 shrink-0">
                    <span className="text-[11px] font-bold" style={{ color: 'var(--itn-text-muted)' }}>{searchResults.length}개 결과</span>
                    <div className="flex items-center rounded-full p-0.5" style={{ background: 'var(--itn-card-hover)' }}>
                      <button type="button" onClick={() => setSearchFeedLayout('insta')} title="피드 보기" className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer" style={searchFeedLayout === 'insta' ? { background: 'var(--itn-card)', color: 'var(--itn-accent)', boxShadow: 'var(--itn-shadow-sm)' } : { color: 'var(--itn-text-muted)' }}><LayoutGrid size={12} /></button>
                      <button type="button" onClick={() => setSearchFeedLayout('list')} title="리스트 보기" className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer" style={searchFeedLayout === 'list' ? { background: 'var(--itn-card)', color: 'var(--itn-accent)', boxShadow: 'var(--itn-shadow-sm)' } : { color: 'var(--itn-text-muted)' }}><List size={12} /></button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto mt-2 pr-1 space-y-1.5 min-h-0 itn-scrollbar">
                  {isSearching ? (
                    <div className="py-8 text-center text-xs" style={{ color: 'var(--itn-text-muted)' }}>검색 중...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-8 text-center text-xs" style={{ color: 'var(--itn-text-muted)' }}>검색 결과가 없습니다.</div>
                  ) : (
                    searchResults.map((place: any, idx: number) => {
                      const reg = findRegistered(place);
                      const onAdd = () => { onActiveDayChange(targetDayForSearch); setTimeout(() => onAddPlaceFromSearch(place, targetDayForSearch, planningInsertIndex?.day === targetDayForSearch ? planningInsertIndex.index : undefined), 50); };
                      const onDrag = (e: any) => { e.dataTransfer.setData('text/plain', JSON.stringify({ ...place, is_search_result: true })); };
                      if (reg) {
                        // 우리 서비스 등록 맛집 — 리치 컴팩트 카드 (홈 리스트 모드 스타일)
                        const vids = reg.videos || [];
                        const head = reg.primary_video?.youtuber || vids[0]?.youtuber;
                        const thumb = reg.primary_video?.thumbnail || vids[0]?.thumbnail;
                        const views = reg.primary_video?.view_count || vids.reduce((m, v) => Math.max(m, v.view_count || 0), 0);
                        const creatorCount = new Set(vids.map(v => v.youtuber?.name).filter(Boolean)).size;
                        const cat = place.category_name?.split(' > ').pop() || reg.category?.split('>').pop()?.trim() || '맛집';
                        if (searchFeedLayout === 'insta') {
                          // 피드 모드 (홈 피드 카드 포맷) — 큰 썸네일 + 프로필/이름
                          return (
                            <div key={`search-res-${idx}`} onClick={onAdd} draggable onDragStart={onDrag}
                              className="itn-card rounded-xl p-1.5 cursor-pointer transition-all active:scale-[0.98] select-none group">
                              <div className="relative w-full aspect-video rounded-lg overflow-hidden" style={{ background: 'var(--itn-card-hover)' }}>
                                {thumb ? (
                                  <img src={thumb} className="w-full h-full object-cover" alt={reg.name} onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Utensils size={26} style={{ color: 'var(--itn-text-muted)' }} /></div>
                                )}
                                {views > 0 && (
                                  <span className="absolute bottom-1.5 right-1.5 bg-black/55 backdrop-blur-sm text-white text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1"><Eye size={10} />{fmtViews(views)}</span>
                                )}
                                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-bold flex items-center gap-1"><Plus size={12} /> 코스에 추가</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 px-0.5">
                                {head?.profile_image ? (
                                  <img src={head.profile_image} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: 'var(--itn-card-hover)', color: 'var(--itn-text-muted)' }}>{head?.name?.[0] || '?'}</span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <h6 className="text-[13.5px] font-bold truncate" style={{ color: 'var(--itn-text)' }}>{place.place_name}</h6>
                                  <div className="text-[11px] font-semibold truncate mt-0.5" style={{ color: 'var(--itn-text-sub)' }}>{head?.name || '리뷰'}{creatorCount > 1 ? ` 외 ${creatorCount - 1}` : ''} · {cat}</div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={`search-res-${idx}`} onClick={onAdd} draggable onDragStart={onDrag}
                            className="itn-card rounded-xl p-2 flex items-center gap-2.5 cursor-pointer transition-all active:scale-[0.98] select-none group">
                            <div className="w-[92px] h-[52px] rounded-lg overflow-hidden shrink-0 relative" style={{ background: 'var(--itn-card-hover)' }}>
                              {thumb ? (
                                <img src={thumb} className="w-full h-full object-cover" alt={reg.name} onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Utensils size={18} style={{ color: 'var(--itn-text-muted)' }} /></div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h6 className="text-[13px] font-bold truncate" style={{ color: 'var(--itn-text)' }}>{place.place_name}</h6>
                              <div className="flex items-center gap-1.5 mt-1 min-w-0">
                                {head?.profile_image && (
                                  <img src={head.profile_image} className="w-4 h-4 rounded-full object-cover shrink-0" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                )}
                                <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--itn-text-sub)' }}>{head?.name || '리뷰'}{creatorCount > 1 ? ` 외 ${creatorCount - 1}` : ''}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 text-[10.5px]" style={{ color: 'var(--itn-text-muted)' }}>
                                {views > 0 && (<span className="flex items-center gap-0.5" style={{ color: 'var(--itn-accent)' }}><Eye size={10} /><span className="tabular-nums font-bold">{fmtViews(views)}</span></span>)}
                                {views > 0 && <span>·</span>}
                                <span className="truncate">{cat}</span>
                              </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><Plus size={13} style={{ color: 'var(--itn-accent)' }} /></div>
                          </div>
                        );
                      }
                      return (
                        <div key={`search-res-${idx}`} onClick={onAdd} draggable onDragStart={onDrag}
                          className="itn-card rounded-xl p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-all active:scale-[0.98] select-none group">
                          <div className="min-w-0 flex-1">
                            <h6 className="text-xs font-bold truncate transition-colors" style={{ color: 'var(--itn-text)' }}>{place.place_name}</h6>
                            <p className="text-xs truncate mt-1" style={{ color: 'var(--itn-text-sub)' }}>{place.road_address_name || place.address_name}</p>
                            <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full mt-1.5" style={{ color: 'var(--itn-accent)', background: 'var(--itn-accent-light)' }}>{place.category_name?.split(' > ').pop() || '관광지'}</span>
                          </div>
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><Plus size={12} style={{ color: 'var(--itn-accent)' }} /></div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {exploreTab === 'recommend' && (
              /* 2. 추천 맛집 탭 */
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-1.5 px-1 shrink-0">
                  <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--itn-text-sub)' }}>
                    <Sparkles size={12} style={{ color: 'var(--itn-accent)' }} />
                    <span>주변 및 가는길 5km 추천 맛집</span>
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 itn-scrollbar">
                  {recommendedRestaurants.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <span className="text-xs" style={{ color: 'var(--itn-text-muted)' }}>지도의 코스 스팟을 선택하면<br/>그 주변의 추천 맛집이 활성화됩니다</span>
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
                        className="itn-card rounded-xl p-2.5 flex items-start justify-between gap-2 transition-all cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold truncate transition-colors" style={{ color: 'var(--itn-text)' }}>{restaurant.name}</h5>
                          <p className="text-xs truncate mt-1" style={{ color: 'var(--itn-text-sub)' }}>{restaurant.address}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{
                              color: type === 'near' ? 'var(--itn-accent)' : '#ef4444',
                              background: type === 'near' ? 'var(--itn-accent-light)' : 'rgb(254 226 226)',
                            }}>
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
                          className="p-1 rounded-lg cursor-pointer shrink-0 transition-colors"
                          style={{ background: 'var(--itn-accent-light)', color: 'var(--itn-accent)' }}
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
                  <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--itn-text-sub)' }}>
                    <Heart size={12} style={{ color: 'var(--itn-accent)' }} />
                    <span>내가 저장한 즐겨찾기 맛집</span>
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 itn-scrollbar">
                  {favorites.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <span className="text-xs font-bold" style={{ color: 'var(--itn-text-muted)' }}>즐겨찾기해 둔 맛집이 없습니다.<br/>맛집 카드에서 하트(즐겨찾기)를 눌러보세요 ❤️</span>
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
                          className="itn-card rounded-xl p-3 flex items-start justify-between gap-3 transition-all cursor-pointer group"
                        >
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold truncate transition-colors" style={{ color: 'var(--itn-text)' }}>{restaurant.name}</h5>
                            <p className="text-xs truncate mt-1" style={{ color: 'var(--itn-text-sub)' }}>{restaurant.address}</p>
                            <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full mt-1.5" style={{ color: 'var(--itn-accent)', background: 'var(--itn-accent-light)' }}>
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
                            className="p-1 rounded-lg cursor-pointer shrink-0 transition-colors"
                            style={{ background: 'var(--itn-accent-light)', color: 'var(--itn-accent)' }}
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

      {/* 하단 상시 액션바 — 저장 / 삭제 (타임라인 컬럼 폭으로 제한 → 검색 열어도 안 늘어남) */}
      <div className={`shrink-0 pt-3 mt-2 flex items-center gap-2.5 border-t ${isMobile ? '' : isInline ? (isSearchingMode ? 'w-[340px]' : '') : 'w-[420px]'}`} style={{ borderColor: 'var(--itn-border)' }}>
        <button
          onClick={onSave}
          className="flex-1 h-11 rounded-2xl flex items-center justify-center gap-1.5 text-[14px] font-black text-white transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)', boxShadow: '0 8px 20px -8px rgba(255,59,48,0.55)' }}
          title="일정 저장"
        >
          <Check size={17} strokeWidth={3} /> 저장
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex-1 h-11 rounded-2xl flex items-center justify-center gap-1.5 text-[14px] font-bold transition-all active:scale-95 cursor-pointer hover:bg-red-50"
            style={{ color: '#ef4444', background: 'var(--itn-card)', border: '1px solid var(--itn-border)' }}
            title="일정 삭제"
          >
            <Trash2 size={16} /> 삭제
          </button>
        )}
      </div>

      {/* 길찾기 앱 선택 모달 — 홈탭 맛집 상세와 동일 UI */}
      <AnimatePresence>
        {routeItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRouteItem(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-5 z-10"
              style={{ background: 'var(--itn-card)', border: '1px solid var(--itn-border)', color: 'var(--itn-text)' }}
            >
              <div className="space-y-1.5 text-center">
                <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Navigation size={18} />
                </div>
                <h3 className="text-base font-black tracking-tight">길찾기 앱 선택</h3>
                <p className="text-xs font-semibold" style={{ color: 'var(--itn-text-sub)' }}>출발지: 현재 위치 · 도착지: {routeItem.name}</p>
              </div>

              <div className="flex flex-col gap-2">
                {/* 네이버 지도 */}
                <button
                  onClick={() => {
                    openExternal(`https://map.naver.com/p/directions/-/${routeItem.lat},${routeItem.lng},${encodeURIComponent(routeItem.name)}/-/car`, { reason: 'naver_map_route' });
                    setRouteItem(null);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-[var(--itn-card-hover)] border border-[var(--itn-border)] hover:border-green-500/30 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <img src="/naver_map_logo.png?v=3" alt="Naver" className="w-5 h-5 rounded object-contain shrink-0" />
                    <span className="text-[13px] font-bold text-[var(--itn-text)] group-hover:opacity-80 transition-opacity">네이버 지도</span>
                  </div>
                  <ChevronRight size={14} className="text-[var(--itn-text-muted)] shrink-0" />
                </button>

                {/* 카카오맵 */}
                <button
                  onClick={() => {
                    openExternal(`https://map.kakao.com/link/to/${encodeURIComponent(routeItem.name)},${routeItem.lat},${routeItem.lng}`, { reason: 'kakao_navi' });
                    setRouteItem(null);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-[var(--itn-card-hover)] border border-[var(--itn-border)] hover:border-yellow-500/30 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAOVBMVEVHcEwAdv//5wD/5AD74gAAfP/64QD64QD64QD74gC4wIOApbw+i+ejtZvv3CJaldjTzlwlhfLc0kuK1weQAAAACnRSTlMA////Fv//+bQX9hPeKgAAALpJREFUKJF901sSgyAMBVBIBHlKcf+LLYYWCYL5ccZjLoFBIazZ9aR2Y4WwM6llhVmjEV0mQinsksVNOqack8ObG4KTUpWS6oMjoiMibvrHo1mpoRP9hTJkekRkCDUPgNIDMKRUX95BuL5aYXoixaoD4JzE1oGU97OB+FbGfb4eggb/UxnhcbZ1zmK+WYdaE+bbeqRl5YlTpNNJXSPD0soaGWqUoW8cMDpkyC4tMtvfr+a2xnLlt/Xv8AWzshIVTzb8eQAAAABJRU5ErkJggg==" alt="Kakao" className="w-5 h-5 rounded object-contain shrink-0" />
                    <span className="text-[13px] font-bold text-[var(--itn-text)] group-hover:opacity-80 transition-opacity">카카오맵</span>
                  </div>
                  <ChevronRight size={14} className="text-[var(--itn-text-muted)] shrink-0" />
                </button>

                {/* 티맵 */}
                <button
                  onClick={() => {
                    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobileUA) {
                      window.location.href = `tmap://route?rGoName=${encodeURIComponent(routeItem.name)}&rGoX=${routeItem.lng}&rGoY=${routeItem.lat}`;
                    } else {
                      alert('티맵 앱 길찾기는 모바일 기기에서만 지원합니다. PC에서는 네이버 또는 카카오 지도를 이용해주세요.');
                    }
                    setRouteItem(null);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-[var(--itn-card-hover)] border border-[var(--itn-border)] hover:border-blue-500/30 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <img src="/tmap_logo.png?v=3" alt="Tmap" className="w-5 h-5 rounded object-contain shrink-0" />
                    <span className="text-[13px] font-bold text-[var(--itn-text)] group-hover:opacity-80 transition-opacity">티맵 (TMAP)</span>
                  </div>
                  <ChevronRight size={14} className="text-[var(--itn-text-muted)] shrink-0" />
                </button>
              </div>

              <button
                onClick={() => setRouteItem(null)}
                className="w-full py-3 active:scale-[0.98] transition-all font-bold rounded-2xl text-[12px] cursor-pointer"
                style={{ background: 'var(--itn-card-hover)', color: 'var(--itn-text-sub)' }}
              >
                닫기
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
