'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '../../../components/admin/AdminShell';

type Product = {
  id: string;
  product_name: string;
  brand: string | null;
  subtitle: string | null;
  search_url: string;
  platform: string | null;
  mention_time: string | null;
  confidence: number | null;
  evidence: string | null;
};
type Video = {
  id: string;
  youtube_video_id: string;
  title: string;
  channel_title: string | null;
  thumbnail_url: string | null;
  view_count: number | null;
  category: string | null;
  status: string;
  created_at: string;
  products: Product[];
};

const STATUSES = ['pending', 'approved', 'rejected'] as const;
const CATEGORIES = ['고기·구이', '국물·탕', '면·파스타', '분식', '해산물', '캠핑용', '홈파티', '야식', '다이어트'];

export default function AdminMealkitsPage() {
  const { adminFetch } = useAdmin();
  const [tab, setTab] = useState<(typeof STATUSES)[number]>('pending');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setMsg(null);
    adminFetch(`/api/admin/mealkits?status=${tab}`)
      .then(async (r) => {
        if (r.status === 401) throw new Error('ADMIN_SECRET이 올바르지 않습니다 (좌측 하단에 입력)');
        if (!r.ok) throw new Error(`오류 ${r.status}`);
        return r.json();
      })
      .then((j) => setVideos(j.data || []))
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, [tab, adminFetch]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, body: any) => {
    const r = await adminFetch(`/api/admin/mealkits/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!r.ok) { setMsg(`실패: ${r.status}`); return; }
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('삭제하면 다음 수집 때 다시 딸려올 수 있습니다. 다시 안 보려면 "반려"를 쓰세요. 그래도 삭제할까요?')) return;
    const r = await adminFetch(`/api/admin/mealkits/${id}`, { method: 'DELETE' });
    if (!r.ok) { setMsg(`삭제 실패: ${r.status}`); return; }
    load();
  };

  const runCollection = async () => {
    setRunning(true);
    setMsg('수집 실행 중… (YouTube + Gemini, 최대 1분)');
    try {
      const r = await fetch('/api/cron/mealkits');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `오류 ${r.status}`);
      const s = j.summary;
      setMsg(`수집 완료 — 발견 ${s.discovered} / 후보 ${s.candidates} / 신규 ${s.inserted}개 영상 · 상품 ${s.products}개${s.errors?.length ? ` · 오류 ${s.errors.length}` : ''}`);
      if (tab === 'pending') load();
    } catch (e: any) {
      setMsg(`수집 실패: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="px-5 py-8 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl font-black tracking-tight">밀키트 검수</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">수집된 영상을 검수해 쇼핑탭에 노출합니다</p>
        </div>
        <button
          onClick={runCollection}
          disabled={running}
          className="px-4 py-2 rounded-full text-[13px] font-bold text-white disabled:opacity-60"
          style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00,#FF9E40)' }}
        >
          {running ? '수집 중…' : '지금 수집 실행'}
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold ${tab === s ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            {s === 'pending' ? '검수 대기' : s === 'approved' ? '승인됨' : '반려됨'}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 rounded-full text-[13px] font-semibold bg-white border border-slate-200 text-slate-500">새로고침</button>
      </div>

      {msg && <div className="mb-4 text-[13px] px-3 py-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">{msg}</div>}
      {loading && <p className="text-[13px] text-slate-400 py-8 text-center">불러오는 중…</p>}
      {!loading && videos.length === 0 && <p className="text-[13px] text-slate-400 py-12 text-center">항목이 없습니다</p>}

      {/* 목록 */}
      <div className="flex flex-col gap-4">
        {videos.map((v) => (
          <div key={v.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex gap-4 p-4">
              <a href={`https://youtu.be/${v.youtube_video_id}`} target="_blank" rel="noreferrer" className="shrink-0">
                <img
                  src={v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_video_id}/mqdefault.jpg`}
                  alt=""
                  className="w-40 aspect-video object-cover rounded-lg bg-slate-100"
                />
              </a>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[14px] leading-snug line-clamp-2">{v.title}</p>
                <p className="text-[12px] text-slate-500 mt-1">
                  {v.channel_title} · 조회 {(v.view_count || 0).toLocaleString()} ·{' '}
                  <select
                    value={v.category || '간편식'}
                    onChange={(e) => patch(v.id, { category: e.target.value })}
                    className="border border-slate-200 rounded px-1 py-0.5 text-[12px]"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </p>

                {/* 추출 상품 */}
                <div className="mt-2 flex flex-col gap-1.5">
                  {v.products.length === 0 && <p className="text-[12px] text-slate-400">추출된 상품 없음</p>}
                  {v.products.map((p) => (
                    <div key={p.id} className="text-[12px] bg-slate-50 rounded-lg px-2.5 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.brand && <span className="font-bold text-orange-600">{p.brand}</span>}
                        <span className="font-semibold">{p.product_name}</span>
                        {typeof p.confidence === 'number' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.confidence >= 0.7 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {(p.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        {p.mention_time && <span className="text-[10px] text-slate-400">⏱ {p.mention_time}</span>}
                        <a href={p.search_url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-500 ml-auto">쿠팡검색 ↗</a>
                      </div>
                      {p.evidence && <p className="text-[11px] text-slate-500 mt-1 italic">“{p.evidence}”</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 액션 */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <span className="text-[11px] font-bold text-slate-400 mr-auto">{v.status}</span>
              {v.status !== 'approved' && (
                <button onClick={() => patch(v.id, { status: 'approved' })} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-green-600">승인</button>
              )}
              {v.status !== 'rejected' && (
                <button onClick={() => patch(v.id, { status: 'rejected' })} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-slate-700 bg-slate-200">반려</button>
              )}
              <button onClick={() => remove(v.id)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-red-600 bg-red-50">삭제</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
