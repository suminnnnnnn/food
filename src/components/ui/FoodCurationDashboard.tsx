import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, CloudRain, Snowflake, Flame, TrendingUp, Sparkles, Coffee, Utensils, Play, Loader } from 'lucide-react';

interface FoodCurationDashboardProps {
  restaurants: any[];
  center: { lat: number; lng: number };
  currentRegion?: string;
  onSelectRestaurant: (restaurant: any) => void;
  selectedRestaurantId?: string;
  onSelectTrendingMenu: (menuKeyword: string) => void;
  onPlayVideo: (youtubeId: string) => void;
}

type TabState = 'viral' | 'vibe' | 'weather';
type WeatherState = 'sunny' | 'rainy' | 'hot' | 'cold';

export default function FoodCurationDashboard({
  restaurants,
  center,
  currentRegion = '마포구',
  onSelectRestaurant,
  onSelectTrendingMenu,
  onPlayVideo,
}: FoodCurationDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabState>('viral');
  const [weatherState, setWeatherState] = useState<WeatherState>('sunny');
  const [weatherInfo, setWeatherInfo] = useState<{ temp: number; code: number } | null>(null);
  
  // 백엔드 AI 큐레이션 데이터 저장용 상태
  const [curationData, setCurationData] = useState<{ vibeKeywords: any[]; weatherKeywords: any[] } | null>(null);
  const [isCurationLoading, setIsCurationLoading] = useState<boolean>(false);

  // 실시간 기상 관측망 (Open-Meteo API) 연동
  useEffect(() => {
    console.log("[Weather API] useEffect triggered. center coordinates:", center);
    if (!center || !center.lat || !center.lng) {
      console.log("[Weather API] Missing lat or lng in center. Skipping fetch.");
      return;
    }

    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${center.lat}&longitude=${center.lng}&current_weather=true`;
        console.log("[Weather API] Fetching from url:", url);
        const res = await fetch(url);
        if (!res.ok) {
          console.log("[Weather API] Fetch response was not OK. Status:", res.status);
          return;
        }
        const data = await res.json();
        const info = data.current_weather;
        if (!info) {
          console.log("[Weather API] current_weather not present in data:", data);
          return;
        }

        if (!isMounted) return;

        const code = info.weathercode;
        const temp = info.temperature;
        console.log("[Weather API] Success. Weather code:", code, "Temperature:", temp);

        // WMO 기상 코드 및 기온 기반 WeatherState 매핑
        let state: WeatherState = 'sunny';
        if (temp <= 5) {
          state = 'cold'; // 한파 (추운 겨울)
        } else if (temp >= 30) {
          state = 'hot'; // 폭염 (더운 여름)
        } else if ([51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99].includes(code)) {
          state = 'rainy'; // 비/눈/소나기/뇌우
        } else {
          state = 'sunny'; // 맑음/구름
        }

        console.log("[Weather API] Mapping to state:", state);
        setWeatherState(state);
        setWeatherInfo({ temp, code });
      } catch (err) {
        console.warn("[Weather API] Failed to sync real-time weather:", err);
      }
    };

    // 디바운스를 적용해 지도 팬 이동 시 불필요한 API 중복 호출 차단
    const timer = setTimeout(fetchWeather, 600);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [center.lat, center.lng]);

  // 시간대 구하기
  const getTimeOfDay = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 11) return 'morning';
    if (hours >= 11 && hours < 17) return 'lunch';
    return 'dinner';
  };

  // 실시간 AI 큐레이션 API 연동 (지역 + 날씨 변경 시 트리거)
  useEffect(() => {
    let isMounted = true;
    const fetchCuration = async () => {
      setIsCurationLoading(true);
      try {
        const timeOfDay = getTimeOfDay();
        const url = `/api/curation/trending?region=${encodeURIComponent(currentRegion)}&weather=${weatherState}&timeOfDay=${timeOfDay}`;
        console.log(`[Curation API] Fetching curation from: ${url}`);
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        
        if (!isMounted) return;
        if (data.vibeKeywords && data.weatherKeywords) {
          console.log("[Curation API] Successfully loaded curation for", currentRegion);
          setCurationData(data);
        }
      } catch (err) {
        console.warn("[Curation API] Failed to fetch trending curation:", err);
      } finally {
        if (isMounted) setIsCurationLoading(false);
      }
    };

    fetchCuration();

    return () => {
      isMounted = false;
    };
  }, [currentRegion, weatherState]);

  // 1. 유튜브 바이럴 랭킹 동적 추출 알고리즘
  const getTrendingVideos = () => {
    const allVideos: Array<{ video: any; restaurant: any; score: number }> = [];

    if (restaurants && Array.isArray(restaurants)) {
      restaurants.forEach((r) => {
        if (r.videos && Array.isArray(r.videos)) {
          r.videos.forEach((v: any) => {
            if (!v.youtube_id) return;
            // 바이럴 속도 점수 연산 = 누적 조회수 * recency 가중치
            const pubYear = v.published_at ? new Date(v.published_at).getFullYear() : 2024;
            const recencyWeight = pubYear >= 2025 ? 1.5 : pubYear === 2024 ? 1.2 : 1.0;
            const score = (v.view_count || 0) * recencyWeight;
            allVideos.push({ video: v, restaurant: r, score });
          });
        }
      });
    }

    // 바이럴 지수 순 정렬
    allVideos.sort((a, b) => b.score - a.score);

    // 고유 비디오 ID 기준 중복 제거 및 TOP 3 필터링
    const uniqueVideos: typeof allVideos = [];
    const seenVideoIds = new Set<string>();
    for (const item of allVideos) {
      if (!seenVideoIds.has(item.video.youtube_id)) {
        seenVideoIds.add(item.video.youtube_id);
        uniqueVideos.push(item);
        if (uniqueVideos.length >= 3) break;
      }
    }

    // 예비용 폴백 데이터 (주변 비디오가 적은 경우 리스트 구성 보장)
    const fallbackList = [
      {
        video: { youtube_id: 'tNq1V2fT7wA', title: '성시경의 먹을텐데 마포구 진짜 노포 삼겹살', youtuber: { name: '성시경 SUNG SI KYUNG' }, view_count: 520000 },
        restaurant: { name: '성우실업 삼겹살', id: 'fallback-1' },
        score: 520000
      },
      {
        video: { youtube_id: '3iVre0n1k9k', title: '풍자가 보증하는 이대 신촌 또간집 투어', youtuber: { name: '또간집' }, view_count: 310000 },
        restaurant: { name: '진짜갈매기', id: 'fallback-2' },
        score: 310000
      },
      {
        video: { youtube_id: 'G29dk19ka0k', title: '백종원의 님아 그 시장을 가오 물냉면 편', youtuber: { name: '백종원 PAIK JONG WON' }, view_count: 240000 },
        restaurant: { name: '신촌고기수제면', id: 'fallback-3' },
        score: 240000
      }
    ];

    while (uniqueVideos.length < 3 && fallbackList.length > 0) {
      const fb = fallbackList.shift();
      if (fb && !uniqueVideos.some(uv => uv.video.youtube_id === fb.video.youtube_id)) {
        uniqueVideos.push(fb as any);
      }
    }

    return uniqueVideos.slice(0, 3);
  };

  // 2. 분위기/테마 폴백 데이터
  const fallbackVibeKeywords = [
    { rank: 1, name: '바람 솔솔 야외 야장/테라스', change: '▲ 142%', value: '야장' },
    { rank: 2, name: '아늑하고 정겨운 실내 노포', change: '▲ 98%', value: '노포' },
    { rank: 3, name: '전망 좋은 루프탑/뷰맛집', change: '▲ 68%', value: '루프탑' },
  ];

  // 3. 오늘 날씨 폴백 데이터
  const weatherKeywords = {
    sunny: {
      activeBtn: 'bg-amber-500 text-white shadow-[0_2px_8px_rgba(245,158,11,0.25)]',
      list: [
        { rank: 1, name: '탁 트인 야외 야장/테라스', change: '▲ 115%', value: '야장' },
        { rank: 2, name: '시원한 루프탑 수제맥주', change: '▲ 82%', value: '맥주' },
        { rank: 3, name: '한적한 정원 디저트 카페', change: '▲ 60%', value: '카페' },
      ]
    },
    rainy: {
      activeBtn: 'bg-slate-600 text-white shadow-[0_2px_8px_rgba(71,85,105,0.25)]',
      list: [
        { rank: 1, name: '뜨끈뜨끈 손칼국수/수제비', change: '▲ 195%', value: '칼국수' },
        { rank: 2, name: '지글지글 파전 & 막걸리', change: '▲ 138%', value: '파전' },
        { rank: 3, name: '보글보글 얼큰한 곱창전골', change: '▲ 92%', value: '전골' },
      ]
    },
    hot: {
      activeBtn: 'bg-red-500 text-white shadow-[0_2px_8px_rgba(239,68,68,0.25)]',
      list: [
        { rank: 1, name: '머리가 띵해지는 얼음 물냉면', change: '▲ 210%', value: '냉면' },
        { rank: 2, name: '얼음잔 생맥주 & 이자카야', change: '▲ 115%', value: '맥주' },
        { rank: 3, name: '시원한 우유 눈꽃 빙수', change: '▲ 84%', value: '빙수' },
      ]
    },
    cold: {
      activeBtn: 'bg-sky-500 text-white shadow-[0_2px_8px_rgba(14,165,233,0.25)]',
      list: [
        { rank: 1, name: '따뜻한 만두전골/샤브샤브', change: '▲ 148%', value: '전골' },
        { rank: 2, name: '얼큰하게 속 채우는 뚝배기 국밥', change: '▲ 105%', value: '국밥' },
        { rank: 3, name: '따끈따끈 오뎅탕 & 우동', change: '▲ 85%', value: '우동' },
      ]
    }
  };

  const getActiveKeywords = () => {
    if (activeTab === 'vibe') {
      return curationData?.vibeKeywords || fallbackVibeKeywords;
    }
    return curationData?.weatherKeywords || weatherKeywords[weatherState].list;
  };

  const currentTheme = weatherKeywords[weatherState];

  return (
    <div className="pt-2 pb-1">
      {/* 랭킹 메인 위젯 카드 */}
      <div className="mx-5 p-4 rounded-3xl border border-slate-100 bg-white/70 shadow-sm transition-all duration-300">
        
        {/* 1. 타이틀 & 미니 세그먼트 탭 바 */}
        <div className="flex flex-col gap-2.5 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase flex items-center gap-1.5 select-none">
              <TrendingUp size={13} className="text-red-500" />
              <span>{currentRegion} 인기 랭킹</span>
            </h3>

            {/* 실시간 날씨 연동 배지 / 로더 */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isCurationLoading && <Loader size={10} className="animate-spin text-orange-500" />}
              {weatherInfo && (
                <div className="text-[9px] font-black text-slate-500 flex items-center gap-1 bg-slate-50 border border-slate-100/60 px-2 py-0.5 rounded-lg select-none">
                  <span className="text-orange-600 font-bold">{weatherInfo.temp.toFixed(1)}°C</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-700">
                    {weatherState === 'sunny' && '맑음 ☀️'}
                    {weatherState === 'rainy' && '비/눈 ☔'}
                    {weatherState === 'hot' && '무더위 🔥'}
                    {weatherState === 'cold' && '한파 ❄️'}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* 가로 100%로 시원하게 배치되는 탭 바 */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl text-[10px] font-black select-none w-full">
            {([
              { id: 'viral', label: '바이럴 핫플', icon: Utensils },
              { id: 'vibe', label: '공간/테마', icon: Coffee },
              { id: 'weather', label: '오늘 날씨', icon: Sun },
            ] as { id: TabState; label: string; icon: any }[]).map((tab) => {
              const isActive = activeTab === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    isActive 
                      ? 'bg-white text-orange-600 shadow-sm font-black' 
                      : 'text-slate-500 hover:text-slate-800 bg-transparent'
                  }`}
                >
                  <TabIcon size={11} className={isActive ? 'text-orange-500' : 'text-slate-400'} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* 2. 오늘 날씨 선택 시에만 확장 노출되는 날씨 토글 단추 */}
          <AnimatePresence>
            {activeTab === 'weather' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between border-t border-slate-100 pt-3 select-none overflow-hidden"
              >
                <span className="text-[10px] font-black text-slate-400 flex items-center gap-1">
                  <Sparkles size={10} className="text-orange-400" />
                  현재 날씨를 골라보세요
                </span>
                
                <div className="flex gap-1 p-0.5 bg-slate-50 border border-slate-100 rounded-xl">
                  {(['sunny', 'rainy', 'hot', 'cold'] as WeatherState[]).map((state) => {
                    const isActive = weatherState === state;
                    const Icons = { sunny: Sun, rainy: CloudRain, hot: Flame, cold: Snowflake };
                    const Icon = Icons[state];
                    const titleMap = { sunny: '맑음', rainy: '비/눈', hot: '무더위', cold: '한파' };

                    return (
                      <button
                        key={state}
                        onClick={() => setWeatherState(state)}
                        title={titleMap[state]}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isActive ? currentTheme.activeBtn : 'text-slate-400 hover:text-slate-700 bg-transparent'
                        }`}
                      >
                        <Icon size={12} />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. 랭킹 리스트 출력 */}
        <div className="space-y-2">
          {activeTab === 'viral' ? (
            getTrendingVideos().map((item, index) => {
              const rank = index + 1;
              const title = item.video.title;
              const youtuber = item.video.youtuber?.name || '유튜버';
              const rName = item.restaurant?.name || '맛집';
              const viewK = item.video.view_count >= 10000 
                ? `${(item.video.view_count / 10000).toFixed(0)}만뷰` 
                : `${item.video.view_count || 0}뷰`;

              return (
                <div
                  key={item.video.youtube_id}
                  onClick={() => {
                    if (item.restaurant?.id && !item.restaurant.id.startsWith('fallback')) {
                      onSelectRestaurant(item.restaurant);
                    }
                    onPlayVideo(item.video.youtube_id);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-orange-50/50 border border-slate-100 hover:border-orange-200/40 cursor-pointer transition-all active:scale-[0.98] group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                      rank === 1 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {rank}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-700 group-hover:text-orange-600 transition-colors truncate">
                        [{youtuber}] {rName}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        {title}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                      <Flame size={8} className="animate-pulse" />
                      {viewK}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm">
                      <Play size={10} fill="currentColor" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            getActiveKeywords().map((kw) => (
              <div
                key={kw.rank}
                onClick={() => onSelectTrendingMenu(kw.value)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-orange-50/50 border border-slate-100 hover:border-orange-200/40 cursor-pointer transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                    kw.rank === 1 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {kw.rank}
                  </span>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-orange-600 transition-colors">
                    {kw.name}
                  </span>
                </div>
                <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">
                  {kw.change}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
