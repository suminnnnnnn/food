'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Edit3, Compass, MapPin, ChevronLeft, ChevronRight, Cloud, Plus, X } from 'lucide-react';
import { getLocalItineraries, deleteLocalItinerary, getItinerariesFromServer, deleteItineraryFromServer } from '@/lib/supabase/itineraries';
import { Itinerary } from '@/types';

interface ItineraryTabViewProps {
  onOpenItineraryPlanner: (itinerary?: any) => void;
  onCreateItinerary?: (itinerary: any) => void;
  onSelectTab: (tab: any) => void;
  user?: any;
  onSelectedDateChange?: (itinerary: any | null, day: number) => void;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const WEEKDAYS_SHORT = ['일','월','화','수','목','금','토'];

// 한국 공휴일(대체공휴일 포함, 2026~2027) — 캘린더 표시용
const HOLIDAYS = new Set<string>([
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01','2026-03-02',
  '2026-05-05','2026-05-24','2026-05-25','2026-06-06','2026-08-15','2026-08-17',
  '2026-09-24','2026-09-25','2026-09-26','2026-10-03','2026-10-05','2026-10-09','2026-12-25',
  '2027-01-01','2027-02-06','2027-02-07','2027-02-08','2027-02-09','2027-03-01',
  '2027-05-05','2027-05-13','2027-06-06','2027-08-15','2027-09-14','2027-09-15','2027-09-16',
  '2027-10-03','2027-10-09','2027-12-25',
]);

// ── 날씨 아이콘 — 갤럭시(One UI) 캘린더풍 채움형 플랫 아이콘 ──────────
// 라인이 아닌 단색 실루엣 + 절제된 팔레트(골드 해 · 쿨그레이 구름 · 블루 강수)
const WI_SUN = '#FFB300';
const WI_CLOUD = '#9AA7B6';
const WI_CLOUD_DARK = '#7A8797';
const WI_RAIN = '#4F9BF5';
const WI_SNOW = '#8FC3FF';
const WI_BOLT = '#FFC531';
// One UI 톤의 부드러운 구름 실루엣 (viewBox 24)
const WI_CLOUD_PATH = 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z';

function SunGlyph({ cx = 12, cy = 12, r = 4.6 }: { cx?: number; cy?: number; r?: number }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g>
      <g stroke={WI_SUN} strokeWidth={2} strokeLinecap="round">
        {rays.map(d => {
          const rad = (d * Math.PI) / 180;
          return (
            <line key={d}
              x1={cx + (r + 1.9) * Math.cos(rad)} y1={cy + (r + 1.9) * Math.sin(rad)}
              x2={cx + (r + 3.6) * Math.cos(rad)} y2={cy + (r + 3.6) * Math.sin(rad)} />
          );
        })}
      </g>
      <circle cx={cx} cy={cy} r={r} fill={WI_SUN} />
    </g>
  );
}

function WeatherIcon({ code, size = 12 }: { code: number; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const };
  const cloudUp = 'translate(2.2,-1.8) scale(0.82)';

  // 맑음
  if (code === 0)
    return <svg {...p}><SunGlyph /></svg>;
  // 구름 조금 (해 + 구름)
  if (code >= 1 && code <= 3)
    return (
      <svg {...p}>
        <SunGlyph cx={8} cy={7.5} r={3.3} />
        <path d={WI_CLOUD_PATH} transform="translate(3.6,3.2) scale(0.7)" fill={WI_CLOUD} />
      </svg>
    );
  // 안개
  if (code === 45 || code === 48)
    return (
      <svg {...p}>
        <path d={WI_CLOUD_PATH} transform="translate(2.2,-2.4) scale(0.82)" fill={WI_CLOUD} />
        <g stroke={WI_CLOUD_DARK} strokeWidth={2} strokeLinecap="round" opacity={0.75}>
          <line x1="5" y1="18.5" x2="19" y2="18.5" />
          <line x1="7" y1="22" x2="17" y2="22" />
        </g>
      </svg>
    );
  // 눈
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return (
      <svg {...p}>
        <path d={WI_CLOUD_PATH} transform={cloudUp} fill={WI_CLOUD} />
        <g fill={WI_SNOW}>
          <circle cx="8" cy="19" r="1.5" />
          <circle cx="12" cy="21.5" r="1.5" />
          <circle cx="16" cy="19" r="1.5" />
        </g>
      </svg>
    );
  // 뇌우
  if (code >= 95)
    return (
      <svg {...p}>
        <path d={WI_CLOUD_PATH} transform={cloudUp} fill={WI_CLOUD_DARK} />
        <polygon points="13,15 9.3,20.2 11.7,20.2 10.6,24 15.2,18 12.6,18 13.9,15" fill={WI_BOLT} />
      </svg>
    );
  // 비
  if (code >= 51)
    return (
      <svg {...p}>
        <path d={WI_CLOUD_PATH} transform={cloudUp} fill={WI_CLOUD} />
        <g stroke={WI_RAIN} strokeWidth={2} strokeLinecap="round">
          <line x1="8" y1="18.2" x2="7" y2="22" />
          <line x1="12" y1="18.2" x2="11" y2="22" />
          <line x1="16" y1="18.2" x2="15" y2="22" />
        </g>
      </svg>
    );
  // 흐림
  return <svg {...p}><path d={WI_CLOUD_PATH} transform="translate(2.2,-1) scale(0.82)" fill={WI_CLOUD} /></svg>;
}

// 날씨 설명 텍스트
function wmoToLabel(code: number): string {
  if (code === 0) return '맑음';
  if (code >= 1 && code <= 3) return '구름 조금';
  if (code === 45 || code === 48) return '안개';
  if (code >= 51 && code <= 67) return '비';
  if (code >= 71 && code <= 77) return '눈';
  if (code >= 80 && code <= 82) return '소나기';
  if (code >= 85 && code <= 86) return '눈소나기';
  if (code >= 95) return '뇌우';
  return '흐림';
}

// 이벤트 바 색상 팔레트
const BAR_COLORS = ['#ef4444','#f97316','#3b82f6','#8b5cf6','#10b981','#ec4899'];

export default function ItineraryTabView({ onOpenItineraryPlanner, onCreateItinerary, onSelectTab, user, onSelectedDateChange }: ItineraryTabViewProps) {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  type WeatherDay = { code: number; tempMin: number; tempMax: number };
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherDay>>({});

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>(toYMD(today));

  // ── 일정 생성: 별도 폼 없이 캘린더가 곧 범위 선택기 ────────────
  // 제목·색상은 묻지 않고 자동 배정한다(생성 후 타임라인 헤더에서 제목 수정).
  const [rangeMode, setRangeMode] = useState(false);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  // 인라인 삭제 확인 대상
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── 날씨 API ────────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    let lat = 37.5665, lon = 126.9780;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
      );
      lat = pos.coords.latitude; lon = pos.coords.longitude;
    } catch {}
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia/Seoul&forecast_days=16`
      );
      const data = await res.json();
      if (data?.daily) {
        const map: Record<string, WeatherDay> = {};
        (data.daily.time as string[]).forEach((d: string, i: number) => {
          map[d] = {
            code: data.daily.weathercode[i],
            tempMin: Math.round(data.daily.temperature_2m_min[i]),
            tempMax: Math.round(data.daily.temperature_2m_max[i]),
          };
        });
        setWeatherMap(map);
      }
    } catch (e) { console.warn('Weather fetch failed', e); }
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  // ── 일정 로드 ────────────────────────────────────────────────
  const loadItineraries = useCallback(async () => {
    try {
      const local = getLocalItineraries();
      if (user?.id) {
        const server = await getItinerariesFromServer(user.id);
        const byId = new Map<string, Itinerary>();
        [...local, ...server].forEach((it) => byId.set(it.id, it)); // 서버가 뒤 → 우선 반영
        setItineraries(Array.from(byId.values()).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
      } else {
        setItineraries(local);
      }
    } catch (e) { console.error('Failed to load itineraries', e); setItineraries(getLocalItineraries()); }
  }, [user]);
  useEffect(() => {
    loadItineraries();
    window.addEventListener('itinerariesUpdated', loadItineraries);
    return () => window.removeEventListener('itinerariesUpdated', loadItineraries);
  }, [loadItineraries]);

  // 인라인 삭제 확정
  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteLocalItinerary(id);
    if (user?.id) deleteItineraryFromServer(id).catch(() => {});
    window.dispatchEvent(new Event('itinerariesUpdated'));
    setConfirmDeleteId(null);
  };

  // ── 새 일정 생성 (캘린더에서 기간만 선택) ──────────────────────
  const startRangeMode = () => {
    setFormStart('');
    setFormEnd('');
    setConfirmDeleteId(null);
    setRangeMode(true);
  };
  const cancelRangeMode = () => { setRangeMode(false); setFormStart(''); setFormEnd(''); };

  const validRange = !!formStart && !!formEnd && formEnd >= formStart;
  const tripDays = validRange
    ? Math.round((parseDate(formEnd).getTime() - parseDate(formStart).getTime()) / 86400000) + 1
    : 0;

  const submitCreate = () => {
    if (!validRange) return;
    // 기존 일정이 안 쓰는 색을 자동 배정 (다 쓰고 있으면 팔레트 순서대로 순환)
    const used = new Set(itineraries.map(it => it.color).filter(Boolean));
    const color = BAR_COLORS.find(c => !used.has(c)) ?? BAR_COLORS[itineraries.length % BAR_COLORS.length];
    const newItinerary = {
      id: `itinerary-${Date.now()}`,
      title: `${tripDays > 1 ? `${tripDays - 1}박 ${tripDays}일` : '당일'} 맛집 여행`,
      start_date: formStart,
      end_date: formEnd,
      color,
      days: Array.from({ length: tripDays }, (_, i) => ({ day: i + 1, items: [] })),
      created_at: new Date().toISOString(),
    };
    onCreateItinerary?.(newItinerary); // 저장 + 타임라인 편집 패널 즉시 진입
    setRangeMode(false);
    setFormStart(''); setFormEnd('');
  };

  // 범위 선택 중 ESC로 취소
  useEffect(() => {
    if (!rangeMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelRangeMode(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rangeMode]);

  // ── 캘린더 그리드 계산 ────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  const todayYMD = toYMD(today);

  // 주(row) 단위로 분리
  const weeks = useMemo(() => {
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) rows.push(calendarDays.slice(i, i+7));
    return rows;
  }, [calendarDays]);

  // 이벤트 바: 사용자가 고른 색 우선, 색 없는 기존 일정은 팔레트 순환으로 폴백
  const itineraryColors = useMemo(() => {
    const map: Record<string, string> = {};
    itineraries.forEach((it, i) => { map[it.id] = it.color || BAR_COLORS[i % BAR_COLORS.length]; });
    return map;
  }, [itineraries]);

  // 특정 날짜에 걸치는 일정 목록
  const itinerariesOnDate = useCallback((ymd: string) =>
    itineraries.filter(it => it.start_date && it.end_date && it.start_date <= ymd && it.end_date >= ymd),
  [itineraries]);

  // 선택 날짜 정보
  const selectedDateObj = useMemo(() => parseDate(selectedDate), [selectedDate]);
  const selectedDateLabel = useMemo(() => {
    const d = selectedDateObj;
    const weekday = ['일','월','화','수','목','금','토'][d.getDay()];
    return { day: d.getDate(), weekday, month: d.getMonth()+1 };
  }, [selectedDateObj]);
  const selectedWeather = weatherMap[selectedDate];
  const selectedItineraries = useMemo(() => itinerariesOnDate(selectedDate), [selectedDate, itinerariesOnDate]);

  // 오늘이 속한 달로 복귀 + 오늘 선택
  const goToday = () => {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayYMD);
  };

  // ── 캘린더 렌더 ──────────────────────────────────────────────
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

    return (
      <div className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] overflow-hidden mb-0">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[19px] font-black tracking-tight bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg,#ef4444,#f97316)' }}>
              {month + 1}월
            </span>
            <span className="text-[12px] font-bold text-slate-400">{year}</span>
          </div>
          <div className="flex items-center gap-1">
            {!isCurrentMonth && (
              <button onClick={goToday}
                className="mr-1 px-2.5 h-7 flex items-center rounded-full text-[11px] font-black text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer">
                오늘
              </button>
            )}
            <button onClick={() => setCurrentMonth(new Date(year, month-1, 1))} aria-label="이전 달"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
              <ChevronLeft size={17}/>
            </button>
            <button onClick={() => setCurrentMonth(new Date(year, month+1, 1))} aria-label="다음 달"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
              <ChevronRight size={17}/>
            </button>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 bg-slate-50/60 border-y border-slate-100">
          {WEEKDAYS_SHORT.map((w, i) => (
            <div key={w} className={`text-center text-[10px] font-black py-2 tracking-wide
              ${i===0?'text-red-400':i===6?'text-sky-400':'text-slate-400'}`}>
              {w}
            </div>
          ))}
        </div>

        {/* 주(row) 단위 렌더링 */}
        {weeks.map((week, wi) => (
          <div key={wi} className="relative grid grid-cols-7" style={{ minHeight: 56 }}>
            {/* 날짜 셀 */}
            {week.map((date, di) => {
              if (!date) return <div key={`e-${di}`} className="border-b border-slate-100 border-r last:border-r-0" />;
              const ymd = toYMD(date);
              const isToday = ymd === todayYMD;
              const dow = date.getDay();
              const isHoliday = HOLIDAYS.has(ymd);
              const weather = weatherMap[ymd];
              const eventsHere = itinerariesOnDate(ymd);

              // 범위 선택 모드에서는 선택 표시가 기간(start~end)을 따른다
              const rStatus = rangeMode ? rangeDayStatus(ymd) : 'normal';
              const isEdge = rStatus === 'start' || rStatus === 'end';
              const isSelected = rangeMode ? isEdge : ymd === selectedDate;

              return (
                <div
                  key={ymd}
                  onClick={() => {
                    if (rangeMode) { selectRangeDay(ymd); return; }
                    setSelectedDate(ymd);
                    if (onSelectedDateChange) {
                      const it = itinerariesOnDate(ymd)[0] || null;
                      const day = (it && it.start_date) ? Math.max(1, Math.round((parseDate(ymd).getTime() - parseDate(it.start_date).getTime()) / 86400000) + 1) : 1;
                      onSelectedDateChange(it, day);
                    }
                  }}
                  className={`relative flex flex-col border-b border-r last:border-r-0 border-slate-100 cursor-pointer transition-colors
                    ${rStatus === 'in-range' ? 'bg-orange-50' : isSelected ? 'bg-orange-50/70' : isToday ? 'bg-amber-50/40' : 'hover:bg-slate-50'}`}
                  style={{ minHeight: 58 }}
                >
                  {/* 날짜 + 날씨 아이콘 */}
                  <div className="flex items-center justify-between px-1.5 pt-1.5 gap-0.5">
                    {/* 날짜 숫자 */}
                    <div className={`w-[22px] h-[22px] flex items-center justify-center rounded-full text-[11px] font-black transition-all shrink-0
                      ${isSelected
                        ? 'text-white shadow-sm'
                        : rStatus === 'in-range'
                          ? 'text-orange-600'
                          : isToday
                            ? 'text-orange-600'
                            : (dow===0 || isHoliday) ? 'text-red-500' : dow===6 ? 'text-sky-500' : 'text-slate-700'
                      }`}
                      style={isSelected ? { background:'linear-gradient(135deg,#ef4444,#f97316)', boxShadow:'0 2px 8px rgba(249,115,22,0.4)' }
                        : isToday ? { boxShadow:'inset 0 0 0 1.5px #fdba74' } : undefined}
                    >
                      {date.getDate()}
                    </div>
                    {/* 날씨 아이콘 (예보 있을 때만) */}
                    {weather && (
                      <div className="shrink-0 opacity-90">
                        <WeatherIcon code={weather.code} size={11}/>
                      </div>
                    )}
                  </div>

                  {/* 이벤트 바 (셀 하단) - 최대 3개 + 초과 카운트 */}
                  <div className="absolute bottom-1 left-0 right-0 flex flex-col gap-[2px] px-0.5">
                    {eventsHere.slice(0, 3).map((it) => {
                      const isStart = toYMD(date) === it.start_date;
                      const isEnd = toYMD(date) === it.end_date;
                      return (
                        <div key={it.id}
                          className="h-[4px]"
                          style={{
                            background: itineraryColors[it.id],
                            borderRadius: isStart && isEnd ? 9999
                              : isStart ? '9999px 0 0 9999px'
                              : isEnd ? '0 9999px 9999px 0'
                              : 0,
                            marginLeft: isStart ? 2 : 0,
                            marginRight: isEnd ? 2 : 0,
                          }}
                        />
                      );
                    })}
                    {eventsHere.length > 3 && (
                      <span className="text-[7px] font-black text-slate-400 leading-none pl-0.5">+{eventsHere.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ── 선택 날짜 상세 패널 ──────────────────────────────────────
  const renderDetailPanel = () => (
    <div className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] overflow-hidden">
      {/* 날짜 + 날씨 헤더 */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-slate-100">
        <div className="flex items-baseline gap-2">
          <span className="text-[30px] font-black text-slate-800 leading-none tracking-tight">{selectedDateLabel.day}</span>
          <div className="flex flex-col leading-none gap-0.5">
            <span className="text-[13px] font-black text-slate-600">{selectedDateLabel.weekday}요일</span>
            <span className="text-[10px] font-bold text-slate-400">{selectedDateLabel.month}월</span>
          </div>
        </div>
        {selectedWeather ? (
          <div className="flex items-center gap-2 pl-3 pr-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
            <WeatherIcon code={selectedWeather.code} size={20}/>
            <div className="flex flex-col leading-none gap-0.5">
              <span className="text-[11px] font-black text-slate-600">{wmoToLabel(selectedWeather.code)}</span>
              <span className="text-[10px] font-bold">
                <span className="text-orange-500">{selectedWeather.tempMax}°</span>
                <span className="text-slate-300 mx-0.5">/</span>
                <span className="text-sky-500">{selectedWeather.tempMin}°</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
            <Cloud size={14}/>
            <span className="text-[11px] font-semibold">예보 없음</span>
          </div>
        )}
      </div>

      {/* 일정 리스트 */}
      <div className="px-4 py-2">
        {selectedItineraries.length === 0 ? (
          <div className="py-5 text-center">
            <p className="text-[12px] text-slate-400 font-medium">이 날짜에 일정이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-0">
            {selectedItineraries.map((it, idx) => {
              const totalPlaces = it.days.reduce((acc, d) => acc + d.items.length, 0);
              const color = itineraryColors[it.id];
              return (
                <motion.div
                  key={it.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => onOpenItineraryPlanner(it)}
                  className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer group"
                >
                  {/* 타임라인 컬러 바 */}
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <div className="w-0.5 h-full min-h-[36px] rounded-full" style={{ background: color }}/>
                  </div>

                  {/* 일정 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-slate-800 group-hover:text-orange-600 transition-colors truncate">
                      {it.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {it.start_date} ~ {it.end_date}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded">
                        <Compass size={8}/> {it.days.length}일
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-600 font-bold bg-sky-50 px-1.5 py-0.5 rounded">
                        <MapPin size={8}/> {totalPlaces}곳
                      </span>
                    </div>
                  </div>

                  {/* 액션 버튼 — 삭제는 인라인 확인 */}
                  {confirmDeleteId === it.id ? (
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={e => confirmDelete(it.id, e)}
                        className="px-2 h-7 flex items-center rounded-lg text-[10px] font-black text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer">
                        삭제
                      </button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="px-2 h-7 flex items-center rounded-lg text-[10px] font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); onOpenItineraryPlanner(it); }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                        <Edit3 size={11}/>
                      </button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(it.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // 여행 기간 범위 캘린더 — 날짜 상태/선택
  const rangeDayStatus = (ymd: string): 'start' | 'end' | 'in-range' | 'normal' => {
    if (!formStart) return 'normal';
    if (ymd === formStart) return 'start';
    if (ymd === formEnd) return 'end';
    if (formEnd && ymd > formStart && ymd < formEnd) return 'in-range';
    return 'normal';
  };
  const selectRangeDay = (ymd: string) => {
    if (!formStart || (formStart && formEnd)) { setFormStart(ymd); setFormEnd(''); }
    else if (ymd < formStart) { setFormEnd(formStart); setFormStart(ymd); }
    else setFormEnd(ymd);
  };

  // ── 범위 선택 확인 바 — 캘린더 아래에서 슬라이드업 ─────────────
  const renderRangeBar = () => (
    <motion.div
      key="range-bar"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-3 px-4 h-14 rounded-2xl bg-white border border-orange-200 shadow-[0_8px_28px_-10px_rgba(249,115,22,0.45)]"
    >
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-none">
        {validRange ? (
          <>
            <span className="text-[13px] font-black text-slate-800 tracking-tight">
              {tripDays > 1 ? `${tripDays - 1}박 ${tripDays}일` : '당일 여행'}
            </span>
            <span className="text-[11px] font-bold text-slate-400 truncate">{formStart} → {formEnd}</span>
          </>
        ) : (
          <span className="text-[12.5px] font-bold text-slate-500">
            {formStart ? '종료일을 선택하세요' : '캘린더에서 시작일을 선택하세요'}
          </span>
        )}
      </div>

      <AnimatePresence>
        {validRange && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={submitCreate}
            className="shrink-0 px-4 h-9 rounded-xl text-[13px] font-black text-white transition-transform hover:scale-[1.03] active:scale-95 cursor-pointer"
            style={{ background: 'linear-gradient(135deg,#ef4444,#f97316)', boxShadow: '0 6px 18px -4px rgba(249,115,22,0.5)' }}
          >
            만들기
          </motion.button>
        )}
      </AnimatePresence>

      <button onClick={cancelRangeMode} aria-label="취소"
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
        <X size={16}/>
      </button>
    </motion.div>
  );

  return (
    <div className="flex flex-col gap-2 pb-6 text-slate-700">
      {renderCalendar()}

      <AnimatePresence mode="wait">
        {rangeMode ? renderRangeBar() : (
          <motion.div
            key="browse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-2"
          >
            {renderDetailPanel()}

            {/* 새 일정 추가 CTA (사이드바 인라인) */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={startRangeMode}
              className="mt-1 flex items-center justify-center gap-2 w-full h-12 rounded-2xl text-[14px] font-black text-white cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                boxShadow: '0 8px 24px -6px rgba(249,115,22,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              <Plus size={18} strokeWidth={3}/>
              <span className="tracking-tight">새 일정 추가</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
