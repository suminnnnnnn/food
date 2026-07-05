'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Play, Tag, Search, TrendingUp, Eye, ChevronLeft, ChevronDown, AlertCircle, Utensils, ArrowUpDown, PlayCircle } from 'lucide-react';
import AffiliateDisclosure from './AffiliateDisclosure';
import { openExternal } from '../../lib/external-link';

// 디자인 시스템 엠버 그라데이션 (레드 → 오렌지 → 앰버)
const EMBER = 'linear-gradient(100deg, #FF3B30 0%, #FF6F00 52%, #FF9E40 100%)';
// 시그니처 이징 — 전역 전환에 사용
const EASE = 'cubic-bezier(0.16,1,0.3,1)';

// 필터 pill 활성 스타일 (홈탭 벤치마크: 그라데이션 테두리 + 그라데이션 텍스트)
const PILL_ACTIVE: React.CSSProperties = {
  backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #FF3B30, #FF6F00)',
  backgroundOrigin: 'border-box',
  backgroundClip: 'padding-box, border-box',
  border: '1.5px solid transparent',
  color: '#FF3B30',
};
const PILL_ACTIVE_TEXT: React.CSSProperties = {
  backgroundImage: 'linear-gradient(135deg, #FF3B30, #FF6F00)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};
const DROP_ACTIVE: React.CSSProperties = {
  backgroundImage: 'linear-gradient(135deg, rgba(255,59,48,0.12), rgba(255,111,0,0.12))',
  color: '#FF3B30',
};

// 썸네일 로딩 실패 시 폴백 (브랜드 그라데이션 + 재생 아이콘, 네트워크 불필요)
const FALLBACK_THUMB =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23FF3B30'/%3E%3Cstop offset='1' stop-color='%23FF9E40'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='180' fill='url(%23g)'/%3E%3Cpolygon points='140,74 140,106 172,90' fill='rgba(255,255,255,0.92)'/%3E%3C/svg%3E";

// mm:ss (또는 h:mm:ss) → 초. ① 먹는 장면 점프용
function parseTimeToSec(t?: string | null): number | null {
  if (!t) return null;
  const parts = t.split(':').map((x) => parseInt(x, 10));
  if (parts.some((n) => isNaN(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}
// ④ 구독자수 → "10.6만" / "226"
function formatCount(n: number | null): string | null {
  if (!n) return null;
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만`;
  return n.toLocaleString('ko-KR');
}

interface AffiliateProduct {
  id: string;
  product_name: string;
  subtitle: string;
  brand: string;
  thumbnail_url: string | null;
  coupang_url: string | null;
  naver_url: string | null;
  price: string | null;
  price_date?: string | null;
  badge?: string;
  timestamp?: string;
  also_count?: number;
}

interface AffiliateVideo {
  id: string;
  youtube_video_id: string;
  title: string;
  description: string | null;
  channel_title: string;
  channel_thumbnail: string | null;
  subscriber_count: number | null;
  view_count: number;
  published_at: string | null;
  category: string;
  views: string;
  min_price: string | null;
  is_short?: boolean;
  products: AffiliateProduct[];
}

interface ShoppingTabViewProps {
  selectedVideoId?: string | null;
  onSelectVideo?: (id: string | null) => void;
}

export default function ShoppingTabView({ selectedVideoId, onSelectVideo }: ShoppingTabViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  const [videos, setVideos] = useState<AffiliateVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seekSec, setSeekSec] = useState<number | null>(null); // ① 먹는 장면 점프 위치(초)
  const [descExpanded, setDescExpanded] = useState(false); // 영상 설명 펼침
  const [isPlaying, setIsPlaying] = useState(false); // 파사드: 재생 시작 여부

  // 필터 (홈탭 벤치마크: 음식/정렬/영상종류)
  const [activeSort, setActiveSort] = useState<'latest' | 'views' | 'price'>('latest');
  const [activeVideoType, setActiveVideoType] = useState<'전체 리뷰' | '쇼츠 리뷰' | '롱폼 리뷰'>('전체 리뷰');
  const [activeDropdown, setActiveDropdown] = useState<'category' | 'sort' | 'videoType' | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<{ top: number; left: number } | null>(null);

  const loadMealkits = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/shopping/mealkits')
      .then(async (r) => {
        if (!r.ok) throw new Error(`서버 오류 (${r.status})`);
        return r.json();
      })
      .then((json) => setVideos(Array.isArray(json?.data) ? json.data : []))
      .catch((e) => setError(e?.message || '불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadMealkits(); }, [loadMealkits]);

  const currentVideoId = selectedVideoId !== undefined ? selectedVideoId : localSelectedId;
  const handleSelectVideo = (id: string | null) => {
    if (onSelectVideo) onSelectVideo(id);
    setLocalSelectedId(id);
  };

  const selectedVideo = useMemo(() => videos.find((v) => v.id === currentVideoId) || null, [videos, currentVideoId]);

  // 영상 전환 시 점프 위치·설명 펼침·재생 상태 초기화
  useEffect(() => { setSeekSec(null); setDescExpanded(false); setIsPlaying(false); }, [currentVideoId]);

  // 데스크톱: 3분할이 항상 채워지도록 첫 영상 자동 선택
  useEffect(() => {
    if (videos.length > 0 && currentVideoId == null && typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      handleSelectVideo(videos[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  // 필터 칩은 실제 데이터에서 파생 — 밀키트 전용(간편식/기타 제외)
  const categories = useMemo(() => {
    const seen: string[] = [];
    videos.forEach((v) => {
      if (v.category && v.category !== '간편식' && v.category !== '기타' && !seen.includes(v.category)) seen.push(v.category);
    });
    return ['전체', ...seen];
  }, [videos]);

  const parseWon = (s: string | null) => (s ? parseInt(s.replace(/[^0-9]/g, '')) || Infinity : Infinity);

  const filteredVideos = useMemo(() => {
    let result = videos;
    if (activeCategory !== '전체') result = result.filter((v) => v.category === activeCategory);
    if (activeVideoType === '쇼츠 리뷰') result = result.filter((v) => v.is_short);
    else if (activeVideoType === '롱폼 리뷰') result = result.filter((v) => !v.is_short);
    const q = searchQuery.trim();
    if (q) {
      result = result.filter(
        (v) =>
          v.title.includes(q) ||
          v.channel_title.includes(q) ||
          v.category.includes(q) ||
          v.products.some((p) => p.product_name.includes(q) || p.brand.includes(q) || p.subtitle.includes(q))
      );
    }
    // 정렬
    const sorted = [...result];
    if (activeSort === 'views') sorted.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    else if (activeSort === 'price') sorted.sort((a, b) => parseWon(a.min_price) - parseWon(b.min_price));
    else sorted.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
    return sorted;
  }, [videos, activeCategory, activeVideoType, activeSort, searchQuery]);

  const isFiltering = activeCategory !== '전체' || searchQuery.trim().length > 0 || activeVideoType !== '전체 리뷰';
  const resetFilters = () => { setActiveCategory('전체'); setSearchQuery(''); setActiveVideoType('전체 리뷰'); setActiveSort('latest'); };

  // 드롭다운 열기/닫기 (홈탭 벤치마크)
  const toggleDropdown = (e: React.MouseEvent, which: 'category' | 'sort' | 'videoType') => {
    if (activeDropdown === which) { setActiveDropdown(null); setDropdownAnchor(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropdownAnchor({ top: rect.bottom + 4, left: rect.left });
    setActiveDropdown(which);
  };
  const closeDropdown = () => { setActiveDropdown(null); setDropdownAnchor(null); };

  // ─── 좌측 목록 사이드바 ───────────────────────────────────────
  const renderList = () => (
    <div className="flex flex-col h-full">
      {/* 헤더: 브랜드 + 검색 + 필터 */}
      <div className="px-4 pt-4 pb-3 space-y-3 shrink-0 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-black tracking-[0.18em] uppercase"
            style={{ background: EMBER, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            V-Commerce
          </span>
          <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-tight mt-0.5">
            그 유튜버가 먹던 그 밀키트
          </h3>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="유튜버, 밀키트, 상품명 검색"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-[13px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/25 transition-all"
            style={{ transitionTimingFunction: EASE }}
          />
        </div>
        {/* 필터 3형제 (홈탭 벤치마크: 음식 / 정렬 / 영상종류) */}
        <div className="flex items-center gap-1.5 select-none">
          {/* 음식 */}
          <button
            onClick={(e) => toggleDropdown(e, 'category')}
            className={`flex-1 justify-center py-1.5 px-2 rounded-full text-[12px] font-bold flex items-center gap-1 transition-all cursor-pointer ${activeCategory !== '전체' ? 'shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            style={activeCategory !== '전체' ? PILL_ACTIVE : undefined}
          >
            <Utensils size={12} className="shrink-0" />
            <span className="truncate max-w-[60px]" style={activeCategory !== '전체' ? PILL_ACTIVE_TEXT : undefined}>{activeCategory === '전체' ? '음식' : activeCategory}</span>
            <ChevronDown size={12} className={`shrink-0 transition-transform ${activeDropdown === 'category' ? 'rotate-180' : ''}`} />
          </button>

          {/* 정렬 */}
          <button
            onClick={(e) => toggleDropdown(e, 'sort')}
            className={`flex-1 justify-center py-1.5 px-2 rounded-full text-[12px] font-bold flex items-center gap-1 transition-all cursor-pointer ${activeSort !== 'latest' ? 'shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            style={activeSort !== 'latest' ? PILL_ACTIVE : undefined}
          >
            <ArrowUpDown size={12} className="shrink-0" />
            <span className="truncate" style={activeSort !== 'latest' ? PILL_ACTIVE_TEXT : undefined}>{activeSort === 'latest' ? '정렬' : activeSort === 'views' ? '조회' : '최저가'}</span>
            <ChevronDown size={12} className={`shrink-0 transition-transform ${activeDropdown === 'sort' ? 'rotate-180' : ''}`} />
          </button>

          {/* 영상종류 */}
          <button
            onClick={(e) => toggleDropdown(e, 'videoType')}
            className={`flex-1 justify-center py-1.5 px-2 rounded-full text-[12px] font-bold flex items-center gap-1 transition-all cursor-pointer ${activeVideoType !== '전체 리뷰' ? 'shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            style={activeVideoType !== '전체 리뷰' ? PILL_ACTIVE : undefined}
          >
            <PlayCircle size={12} className="shrink-0" />
            <span className="truncate" style={activeVideoType !== '전체 리뷰' ? PILL_ACTIVE_TEXT : undefined}>{activeVideoType === '전체 리뷰' ? '영상' : activeVideoType === '쇼츠 리뷰' ? '쇼츠' : '롱폼'}</span>
            <ChevronDown size={12} className={`shrink-0 transition-transform ${activeDropdown === 'videoType' ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 드롭다운 포털 */}
        {activeDropdown && dropdownAnchor && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={closeDropdown} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{ position: 'fixed', top: dropdownAnchor.top, left: dropdownAnchor.left, zIndex: 9999 }}
              className="bg-white border border-slate-100 rounded-2xl shadow-xl p-2"
            >
              {activeDropdown === 'category' && (
                <div className="w-[240px] grid grid-cols-3 gap-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setActiveCategory(cat); closeDropdown(); }}
                      className={`py-1.5 px-1 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer ${cat === activeCategory ? 'font-black' : 'hover:bg-slate-50 text-slate-600'}`}
                      style={cat === activeCategory ? DROP_ACTIVE : undefined}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              {activeDropdown === 'sort' && (
                <div className="w-[130px] grid grid-cols-1 gap-1">
                  {[{ id: 'latest', label: '최신순' }, { id: 'views', label: '조회수순' }, { id: 'price', label: '최저가순' }].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setActiveSort(s.id as 'latest' | 'views' | 'price'); closeDropdown(); }}
                      className={`py-1.5 px-1 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer ${activeSort === s.id ? 'font-black' : 'hover:bg-slate-50 text-slate-600'}`}
                      style={activeSort === s.id ? DROP_ACTIVE : undefined}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {activeDropdown === 'videoType' && (
                <div className="w-[150px] grid grid-cols-1 gap-1">
                  {['전체 리뷰', '쇼츠 리뷰', '롱폼 리뷰'].map((t) => (
                    <button
                      key={t}
                      onClick={() => { setActiveVideoType(t as '전체 리뷰' | '쇼츠 리뷰' | '롱폼 리뷰'); closeDropdown(); }}
                      className={`py-1.5 px-1 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer ${activeVideoType === t ? 'font-black' : 'hover:bg-slate-50 text-slate-600'}`}
                      style={activeVideoType === t ? DROP_ACTIVE : undefined}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </>,
          document.body
        )}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3">
        {loading && (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-2.5 p-2">
                <div className="w-[120px] shrink-0 aspect-video rounded-lg bg-slate-100 animate-pulse" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                  <div className="h-2.5 w-2/3 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <AlertCircle size={26} className="mb-3 text-orange-400" />
            <p className="text-[13px] font-semibold text-slate-500">불러오지 못했어요</p>
            <button onClick={loadMealkits} className="mt-4 px-4 py-2 rounded-full text-[12px] font-bold text-white" style={{ background: EMBER }}>
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-3">
            {filteredVideos.map((video) => {
              const isSel = video.id === currentVideoId;
              const thumbSrc = `https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`;
              return (
                <div key={video.id} className="relative">
                  <button
                    onClick={() => handleSelectVideo(video.id)}
                    aria-pressed={isSel}
                    className={`w-full text-left rounded-2xl overflow-hidden border transition-all ${isSel ? 'border-orange-300 ring-1 ring-orange-200' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}
                    style={{ transitionTimingFunction: EASE }}
                  >
                  {/* 큰 16:9 썸네일 */}
                  <div className="relative w-full aspect-video bg-slate-100 overflow-hidden">
                    <img
                      src={thumbSrc}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (!img.dataset.fallback && img.naturalWidth <= 120) { img.dataset.fallback = '1'; img.src = FALLBACK_THUMB; }
                      }}
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallback) return;
                        img.dataset.fallback = '1'; img.src = FALLBACK_THUMB;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
                    <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Eye size={10} className="text-white/90" />
                      <span className="text-[10px] font-semibold text-white/95 tabular-nums">{video.views}</span>
                    </span>
                    <span className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShoppingCart size={10} className="text-white" />
                      <span className="text-[10px] font-bold text-white tabular-nums">{video.products.length}</span>
                    </span>
                  </div>
                  {/* 본문 */}
                  <div className={`p-2.5 ${isSel ? 'bg-orange-50/50' : 'bg-white'}`}>
                    <div className="flex items-center gap-1.5">
                      {video.channel_thumbnail
                        ? <img src={video.channel_thumbnail} className="w-4 h-4 rounded-full object-cover shrink-0" alt="" loading="lazy" />
                        : <Play size={8} className="text-orange-500 shrink-0" fill="currentColor" />}
                      <span className="text-[11px] font-bold text-orange-500 truncate">{video.channel_title}</span>
                      {formatCount(video.subscriber_count) && (
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">· {formatCount(video.subscriber_count)}</span>
                      )}
                    </div>
                    <h5 className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-2 mt-1">{video.title}</h5>
                    {video.min_price && (
                      <p className="text-[11.5px] font-black tabular-nums mt-1" style={{ color: '#FF6F00' }}>최저 {video.min_price}~</p>
                    )}
                  </div>
                  </button>
                </div>
              );
            })}

            {filteredVideos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Search size={26} className="mb-3 opacity-40" />
                <p className="text-[13px] font-semibold text-slate-500">
                  {isFiltering ? '검색 결과가 없어요' : '아직 등록된 밀키트가 없어요'}
                </p>
                {isFiltering && (
                  <button onClick={resetFilters} className="mt-4 px-4 py-2 rounded-full text-[12px] font-bold text-white" style={{ background: EMBER }}>
                    필터 초기화
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ─── 중앙 히어로 영상 ─────────────────────────────────────────
  const renderCenter = () => {
    if (!selectedVideo) {
      return (
        <div className="hidden md:flex flex-col items-center justify-center h-full text-slate-300 gap-3">
          <Play size={44} className="opacity-40" />
          <p className="text-[14px] font-semibold text-slate-400">왼쪽 목록에서 영상을 선택하세요</p>
        </div>
      );
    }
    return (
      <motion.div key={selectedVideo.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
        {/* 모바일 전용 뒤로가기 */}
        <button
          onClick={() => handleSelectVideo(null)}
          className="md:hidden sticky top-0 z-30 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center gap-1 text-[13px] font-bold text-slate-600"
        >
          <ChevronLeft size={17} /> 목록으로
        </button>

        {/* 컨텐츠 (영상이 과하게 커지지 않도록 폭 제한) */}
        <div className="w-full md:max-w-[620px] md:mx-auto md:px-5 md:pt-5">
          {/* 플레이어 (파사드: 재생 전엔 커스텀 썸네일 + 글래스 버튼, 클릭 시 iframe 로드) */}
          <div className="sticky top-[45px] md:static z-20 bg-black md:rounded-2xl overflow-hidden">
            <div className="relative w-full aspect-video">
              {isPlaying || seekSec != null ? (
                <iframe
                  key={seekSec ?? 'base'}
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtube_video_id}?autoplay=1&rel=0&playsinline=1&iv_load_policy=3${seekSec != null ? `&start=${seekSec}` : ''}`}
                  title={selectedVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  aria-label={`영상 재생: ${selectedVideo.title}`}
                  className="group absolute inset-0 w-full h-full focus:outline-none"
                >
                  <img
                    src={`https://i.ytimg.com/vi/${selectedVideo.youtube_video_id}/maxresdefault.jpg`}
                    alt=""
                    className="w-full h-full object-cover brightness-[0.7]"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = `https://i.ytimg.com/vi/${selectedVideo.youtube_video_id}/hqdefault.jpg`; }
                    }}
                  />

                  {/* 채널 — 상단 (홈탭 벤치마크) */}
                  <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
                    {selectedVideo.channel_thumbnail
                      ? <img src={selectedVideo.channel_thumbnail} className="w-7 h-7 rounded-full object-cover ring-2 ring-white/30 shrink-0" alt="" />
                      : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold text-white shrink-0">{selectedVideo.channel_title?.[0]}</div>}
                    <span className="text-[12px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{selectedVideo.channel_title}</span>
                  </div>

                  {/* 제목 + 조회수 + SHORTS 뱃지 — 하단 (홈탭 벤치마크) */}
                  <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-4">
                    <p className="text-[13px] font-bold text-white leading-snug line-clamp-2 mb-1.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{selectedVideo.title}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Eye size={11} className="text-orange-300 shrink-0" />
                        <span className="text-[11px] font-bold text-orange-300">{selectedVideo.views}회</span>
                      </div>
                      {selectedVideo.is_short && (
                        <div className="bg-black/35 backdrop-blur-md border border-white/10 text-white text-[10px] font-black px-1.5 py-[2px] rounded-md flex items-center gap-0.5 shadow-sm">
                          <Play size={8} fill="currentColor" /> SHORTS
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 재생버튼 — 홈탭 벤치마크 (홈탭 64px보다 작게 52px) */}
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="w-[52px] h-[52px] bg-black/60 group-hover:bg-black/75 rounded-full flex items-center justify-center shadow-2xl border border-white/20 transition-all duration-200 group-hover:scale-105 group-active:scale-95">
                      <Play size={20} className="ml-0.5 text-white fill-current" strokeWidth={0} />
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* 제목 */}
          <div className="px-4 md:px-0 pt-3.5">
            <h1 className="text-[16px] md:text-[18px] font-black text-slate-900 leading-snug">{selectedVideo.title}</h1>
          </div>

          {/* 채널 (설명글 위) */}
          <div className="px-4 md:px-0 mt-3 flex items-center gap-2.5">
            {selectedVideo.channel_thumbnail
              ? <img src={selectedVideo.channel_thumbnail} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
              : <div className="w-10 h-10 rounded-full bg-orange-50 grid place-items-center shrink-0"><Play size={15} className="text-orange-500" fill="currentColor" /></div>}
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-800 truncate">{selectedVideo.channel_title}</p>
              {formatCount(selectedVideo.subscriber_count) && (
                <p className="text-[11px] text-slate-400">구독자 {formatCount(selectedVideo.subscriber_count)}</p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-slate-400 shrink-0">
              <TrendingUp size={13} /> 조회 {selectedVideo.views}
            </div>
          </div>

          {/* 설명글 (채널 아래) */}
          {selectedVideo.description ? (
            <div className="px-4 md:px-0 mt-4 mb-6">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className={`text-[12.5px] text-slate-600 leading-relaxed whitespace-pre-wrap break-words ${descExpanded ? '' : 'line-clamp-3'}`}>
                  {selectedVideo.description}
                </p>
                {selectedVideo.description.length > 120 && (
                  <button
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-1.5 text-[12px] font-bold text-slate-500 hover:text-orange-600 transition-colors"
                  >
                    {descExpanded ? '접기' : '더보기'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6" />
          )}
        </div>
      </motion.div>
    );
  };

  // ─── 우측 "이 영상 속 상품" ───────────────────────────────────
  const renderProducts = () => {
    if (!selectedVideo) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-5 h-[3px] rounded-full shrink-0" style={{ background: EMBER }} />
          <Tag size={13} className="text-orange-500 shrink-0" />
          <span className="text-[13px] font-black text-slate-800">이 영상 속 상품</span>
          <span className="text-[11px] font-bold text-slate-400 tabular-nums">{selectedVideo.products.length}</span>
        </div>

        {/* 제휴 마케팅 안내문 — 상품 목록 바로 위 */}
        <AffiliateDisclosure />

        {selectedVideo.products.length === 0 ? (
          <p className="text-[12px] text-slate-400 py-6 text-center">이 영상에서 추출된 상품이 아직 없어요</p>
        ) : (
          <div className="flex flex-col gap-3 mt-3">
            {selectedVideo.products.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
              >
                <div className="flex">
                  <div className="w-1 shrink-0" style={{ background: EMBER }} />
                  <div className="flex-1 p-3.5 min-w-0">
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                    {/* 브랜드 + 뱃지 + ⑥ N개 영상 추천 */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      {product.brand && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">{product.brand}</span>
                      )}
                      {product.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ color: '#FF6F00', background: 'rgba(255,111,0,0.10)' }}>{product.badge}</span>
                      )}
                      {product.also_count && product.also_count > 1 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ color: '#FF3B30', background: 'rgba(255,59,48,0.10)' }}>🔥 {product.also_count}개 영상 추천</span>
                      )}
                    </div>

                    <p className="text-[13px] font-extrabold text-slate-800 leading-snug mb-1">{product.product_name}</p>

                    {product.subtitle && (
                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2.5">{product.subtitle}</p>
                    )}

                    {/* ① 먹는 장면 점프 */}
                    {parseTimeToSec(product.timestamp) !== null && (
                      <button
                        onClick={() => setSeekSec(parseTimeToSec(product.timestamp))}
                        className="inline-flex items-center gap-1.5 mb-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:scale-[0.98] transition-all"
                        style={{ color: '#FF6F00', background: 'rgba(255,111,0,0.08)', border: '1px solid rgba(255,111,0,0.18)', transitionTimingFunction: EASE }}
                      >
                        <Play size={10} fill="#FF6F00" /> {product.timestamp} 소개 영상 보기
                      </button>
                    )}

                    {/* 가격 + 기준일 */}
                    <div className="flex items-baseline gap-1.5">
                      {product.price ? (
                        <>
                          <span className="text-[18px] font-black tabular-nums" style={{ color: '#FF3B30' }}>{product.price}</span>
                          {product.price_date && <span className="text-[10px] text-slate-400 font-medium">{product.price_date} 기준</span>}
                        </>
                      ) : (
                        <span className="text-[12px] font-bold text-slate-400">가격 정보 준비 중</span>
                      )}
                    </div>
                      </div>

                      {/* 상품 사진 (우측 빈 공간) */}
                      {product.thumbnail_url && (
                        <img
                          src={product.thumbnail_url}
                          alt=""
                          loading="lazy"
                          className="w-[100px] h-[100px] shrink-0 object-cover rounded-xl border border-slate-100 bg-slate-50"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>

                    {/* 구매 — 쿠팡 파트너스(단일 제휴). 리테일러 비강조 중립 CTA */}
                    {product.coupang_url && (
                      <div className="mt-3">
                        <button
                          onClick={() => openExternal(product.coupang_url!, { reason: 'affiliate_click_coupang', productId: product.id, videoId: selectedVideo.id, platform: 'coupang' })}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all"
                          style={{ transitionTimingFunction: EASE }}
                        >
                          <ShoppingCart size={13} strokeWidth={2.4} />
                          구매하러 가기
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-row h-full w-full overflow-hidden bg-white">
      {/* 좌: 목록 사이드바 (모바일에선 영상 선택 시 숨김) */}
      <aside className={`${selectedVideo ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[380px] md:shrink-0 md:border-r border-slate-100 bg-white`}>
        {renderList()}
      </aside>

      {/* 중앙 + 우: 시청 영역 (모바일에선 영상 선택 시에만 표시) */}
      <div className={`${selectedVideo ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col md:flex-row overflow-y-auto md:overflow-hidden no-scrollbar`}>
        {/* 중앙 히어로 */}
        <main className="w-full md:flex-1 md:min-w-0 md:overflow-y-auto no-scrollbar bg-slate-50/40">
          {renderCenter()}
        </main>

        {/* 우: 상품 레일 */}
        {selectedVideo && (
          <aside className="w-full md:w-[380px] md:shrink-0 md:border-l border-slate-100 md:overflow-y-auto no-scrollbar px-4 md:px-5 py-4">
            {renderProducts()}
          </aside>
        )}
      </div>
    </div>
  );
}
