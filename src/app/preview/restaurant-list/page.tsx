'use client';

import { Star, Eye, Play, TrendingUp, ChevronRight } from 'lucide-react';

const MOCK = [
  {
    id: 1, name: '한남식당', category: '한식', views: 56000,
    thumbnail: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=600',
    creator: '맛있겠다', creatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40',
    videoCount: 3, isFav: false, desc: '30년 전통 서울식 한식 정식',
  },
  {
    id: 2, name: '광주공원진미국밥', category: '한식', views: 323800,
    thumbnail: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600',
    creator: '이쯔미', creatorAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=40',
    videoCount: 7, isFav: true, desc: '광주 대표 국밥, 새벽부터 긴 줄',
  },
  {
    id: 3, name: '우촌', category: '한식', views: 323800,
    thumbnail: 'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600',
    creator: '한입만', creatorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40',
    videoCount: 2, isFav: false, desc: '한우 직화구이 전문, 숙성 30일',
  },
  {
    id: 4, name: '유부자', category: '일식', views: 53000,
    thumbnail: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600',
    creator: '먹방왕', creatorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40',
    videoCount: 1, isFav: false, desc: '수제 유부초밥 전문점',
  },
];

const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  한식: { bg: 'bg-orange-100', text: 'text-orange-700' },
  일식: { bg: 'bg-blue-100', text: 'text-blue-700' },
  중식: { bg: 'bg-red-100', text: 'text-red-700' },
  양식: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

function fmt(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/* ─────────────────────────────────────────────
   안 1. 유튜브 풀카드형 (네이버지도 계승)
───────────────────────────────────────────── */
function Variant1() {
  return (
    <div className="space-y-4">
      {MOCK.map((r) => {
        const cat = CATEGORY_COLOR[r.category] ?? { bg: 'bg-slate-100', text: 'text-slate-600' };
        return (
          <div key={r.id} className="group rounded-2xl bg-white border border-slate-100 overflow-hidden hover:shadow-md hover:border-orange-200 transition-all cursor-pointer">
            {/* 풀너비 16:9 썸네일 */}
            <div className="relative w-full aspect-video overflow-hidden bg-slate-200">
              <img src={r.thumbnail} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" alt={r.name} />
              {/* 상단 배지 레이어 */}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
                {/* 유튜버 채널 */}
                <div className="flex items-center gap-1.5 bg-black/55 backdrop-blur-sm rounded-full px-2 py-1">
                  <img src={r.creatorAvatar} className="w-4 h-4 rounded-full object-cover" alt={r.creator} />
                  <span className="text-[10px] font-semibold text-white">{r.creator}</span>
                </div>
                {/* 영상 수 */}
                <div className="flex items-center gap-1 bg-black/55 backdrop-blur-sm rounded-full px-2 py-1">
                  <Play size={9} className="text-white fill-white" />
                  <span className="text-[10px] font-semibold text-white">영상 {r.videoCount}개</span>
                </div>
              </div>
              {/* 좌하단 조회수 */}
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-black/55 backdrop-blur-sm rounded-full px-2 py-1">
                <Eye size={9} className="text-orange-300" />
                <span className="text-[10px] font-bold text-orange-300">{fmt(r.views)}회</span>
              </div>
              {/* 즐겨찾기 */}
              <button className="absolute bottom-2.5 right-2.5 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <Star size={11} className={r.isFav ? 'text-orange-400 fill-orange-400' : 'text-white/80'} />
              </button>
            </div>
            {/* 텍스트 */}
            <div className="px-3.5 py-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-slate-800 truncate group-hover:text-orange-600 transition-colors">{r.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{r.desc}</p>
              </div>
              <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.bg} ${cat.text}`}>{r.category}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   안 2. 그라데이션 오버레이형 (매거진 감성)
───────────────────────────────────────────── */
function Variant2() {
  return (
    <div className="space-y-3">
      {MOCK.map((r) => {
        const cat = CATEGORY_COLOR[r.category] ?? { bg: 'bg-slate-100', text: 'text-slate-600' };
        return (
          <div key={r.id} className="group relative w-full aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-shadow">
            {/* 배경 이미지 */}
            <img src={r.thumbnail} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" alt={r.name} />
            {/* 그라데이션 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            {/* 상단: 카테고리 + 즐겨찾기 */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${cat.bg} ${cat.text}`}>{r.category}</span>
              <button className="w-7 h-7 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Star size={12} className={r.isFav ? 'text-orange-400 fill-orange-400' : 'text-white'} />
              </button>
            </div>
            {/* 하단: 텍스트 정보 */}
            <div className="absolute bottom-0 inset-x-0 px-4 pb-4">
              {/* 유튜버 */}
              <div className="flex items-center gap-1.5 mb-2">
                <img src={r.creatorAvatar} className="w-5 h-5 rounded-full object-cover ring-1 ring-white/40" alt={r.creator} />
                <span className="text-[10px] font-semibold text-white/80">{r.creator}</span>
                <span className="text-white/40 text-[10px]">·</span>
                <Play size={9} className="text-white/60 fill-white/60" />
                <span className="text-[10px] text-white/60">영상 {r.videoCount}개</span>
              </div>
              <p className="text-[16px] font-black text-white leading-tight">{r.name}</p>
              <p className="text-[11px] text-white/70 mt-0.5 truncate">{r.desc}</p>
              <div className="flex items-center gap-1 mt-2">
                <Eye size={10} className="text-orange-300" />
                <span className="text-[11px] font-bold text-orange-300">{fmt(r.views)}회</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   안 3. 쇼츠/릴스 세로 카드형 (2열 그리드)
───────────────────────────────────────────── */
function Variant3() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {MOCK.map((r) => {
        const cat = CATEGORY_COLOR[r.category] ?? { bg: 'bg-slate-100', text: 'text-slate-600' };
        return (
          <div key={r.id} className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-shadow" style={{ aspectRatio: '3/4' }}>
            {/* 배경 이미지 */}
            <img src={r.thumbnail} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" alt={r.name} />
            {/* 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
            {/* 상단 */}
            <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm ${cat.bg} ${cat.text}`}>{r.category}</span>
              <button>
                <Star size={11} className={r.isFav ? 'text-orange-400 fill-orange-400' : 'text-white/80'} />
              </button>
            </div>
            {/* 유튜버 아바타 (중앙) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Play size={18} className="text-white fill-white ml-0.5" />
              </div>
            </div>
            {/* 하단 텍스트 */}
            <div className="absolute bottom-0 inset-x-0 px-2.5 pb-3">
              <div className="flex items-center gap-1 mb-1.5">
                <img src={r.creatorAvatar} className="w-4 h-4 rounded-full object-cover ring-1 ring-white/40" alt={r.creator} />
                <span className="text-[9px] text-white/70 truncate">{r.creator}</span>
              </div>
              <p className="text-[13px] font-black text-white leading-tight line-clamp-2">{r.name}</p>
              <div className="flex items-center gap-0.5 mt-1.5">
                <Eye size={9} className="text-orange-300" />
                <span className="text-[10px] font-bold text-orange-300">{fmt(r.views)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   페이지
───────────────────────────────────────────── */
export default function RestaurantListPreviewPage() {
  const variants = [
    {
      id: '1',
      label: '안 1. 유튜브 풀카드형',
      sub: '네이버지도 계승 · 16:9 썸네일',
      tag: null,
      component: <Variant1 />,
    },
    {
      id: '2',
      label: '안 2. 그라데이션 오버레이',
      sub: '매거진 · 이미지 위 텍스트',
      tag: '★ 고급스러운 느낌',
      component: <Variant2 />,
    },
    {
      id: '3',
      label: '안 3. 쇼츠/릴스형',
      sub: '2열 세로 카드 · Z세대 피드',
      tag: null,
      component: <Variant3 />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-5">
      <div className="mb-5">
        <h1 className="text-xl font-black text-slate-800">맛집 리스트 디자인 시안</h1>
        <p className="text-xs text-slate-400 mt-0.5">마음에 드는 시안을 선택해주세요 · 사이드바 폭(280px) 기준</p>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {variants.map((v) => (
          <div
            key={v.id}
            className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-shrink-0"
            style={{ width: 288 }}
          >
            {/* 헤더 */}
            <div className={`px-4 pt-4 pb-3 border-b border-slate-100 ${v.tag ? 'bg-gradient-to-r from-red-50 to-orange-50' : ''}`}>
              <div className="flex items-center justify-between">
                <p className={`text-[13px] font-extrabold ${v.tag ? 'text-orange-600' : 'text-slate-700'}`}>{v.label}</p>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{v.sub}</p>
              {v.tag && <span className="inline-block mt-1 text-[10px] font-bold text-orange-500">{v.tag}</span>}
            </div>
            {/* 리스트 헤더 */}
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-[13px] font-extrabold text-slate-800">우리 동네 맛집</span>
              <TrendingUp size={13} className="text-slate-300" />
            </div>
            {/* 컨텐츠 */}
            <div className="px-3 pb-4">
              {v.component}
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-slate-400 mt-4">
        <a href="/" className="underline hover:text-slate-600">← 메인으로 돌아가기</a>
      </p>
    </div>
  );
}
