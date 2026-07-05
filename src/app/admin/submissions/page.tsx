'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '../../../components/admin/AdminShell';

type AiResult = {
  is_valid?: boolean;
  confidence_score?: number;
  youtuber_name?: string;
  reason?: string;
  keywords?: string[];
  resolve_type?: string;
  matched_restaurant_id?: string | null;
} | null;

type Submission = {
  id: number;
  raw_name: string;
  raw_address: string | null;
  source_url: string;
  source_type: string | null;
  user_comment: string | null;
  status: string;
  resolved_restaurant_id: string | null;
  ai_review_result: AiResult;
  created_at: string;
  resolved_restaurant: { id: string; name: string; is_published: boolean } | null;
};

const STATUSES = ['pending', 'held', 'rejected', 'approved'] as const;
const STATUS_LABEL: Record<string, string> = { pending: '검수 대기', held: '보류', rejected: '반려됨', approved: '승인됨' };

function ytThumb(url: string): string | null {
  const m = url?.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

export default function AdminSubmissionsPage() {
  const { adminFetch } = useAdmin();
  const [tab, setTab] = useState<(typeof STATUSES)[number]>('pending');
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<number, string | null>>({});

  const load = useCallback(() => {
    setLoading(true);
    setMsg(null);
    adminFetch(`/api/admin/submissions?status=${tab}`)
      .then(async (r) => {
        if (r.status === 401) throw new Error('ADMIN_SECRET이 올바르지 않습니다 (좌측 하단에 입력)');
        if (!r.ok) throw new Error(`오류 ${r.status}`);
        return r.json();
      })
      .then((j) => setRows(j.data || []))
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, [tab, adminFetch]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: number, status: string, label: string) => {
    setBusy((b) => ({ ...b, [id]: label }));
    try {
      const r = await adminFetch(`/api/admin/submissions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `오류 ${r.status}`); }
      load();
    } catch (e: any) { setMsg(`실패: ${e.message}`); }
    finally { setBusy((b) => ({ ...b, [id]: null })); }
  };

  const remove = async (id: number) => {
    if (!confirm('이 제보를 삭제할까요? (연결된 식당은 삭제되지 않습니다)')) return;
    setBusy((b) => ({ ...b, [id]: '삭제' }));
    try {
      const r = await adminFetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`오류 ${r.status}`);
      load();
    } catch (e: any) { setMsg(`삭제 실패: ${e.message}`); }
    finally { setBusy((b) => ({ ...b, [id]: null })); }
  };

  // AI 심사(force=false) 또는 관리자 강제 승인(force=true) — 둘 다 /api/review가 식당 생성·영상연계까지 수행
  const review = async (id: number, force: boolean) => {
    setBusy((b) => ({ ...b, [id]: force ? '강제 승인 중…' : 'AI 심사 중…' }));
    setMsg(force ? '강제 승인 처리 중… (식당 생성·영상 연계, 최대 20초)' : 'AI 심사 중… (YouTube+Gemini, 최대 20초)');
    try {
      const r = await adminFetch('/api/review', { method: 'POST', body: JSON.stringify({ submission_id: id, force }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `오류 ${r.status}`);
      const rr = j.aiResult || {};
      setMsg(`처리 완료 — 상태: ${STATUS_LABEL[j.status] || j.status}${typeof rr.confidence_score === 'number' ? ` · 신뢰도 ${rr.confidence_score}` : ''}${j.resolved_restaurant_id ? ' · 식당 등록됨' : ''}`);
      load();
    } catch (e: any) { setMsg(`심사 실패: ${e.message}`); }
    finally { setBusy((b) => ({ ...b, [id]: null })); }
  };

  return (
    <div className="px-5 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black tracking-tight">제보 검수</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">사용자 맛집 제보를 심사해 지도에 등록합니다. 승인(등록)은 AI 심사 또는 강제 승인으로 식당이 생성됩니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold ${tab === s ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 rounded-full text-[13px] font-semibold bg-white border border-slate-200 text-slate-500">새로고침</button>
      </div>

      {msg && <div className="mb-4 text-[13px] px-3 py-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">{msg}</div>}
      {loading && <p className="text-[13px] text-slate-400 py-8 text-center">불러오는 중…</p>}
      {!loading && rows.length === 0 && <p className="text-[13px] text-slate-400 py-12 text-center">항목이 없습니다</p>}

      <div className="flex flex-col gap-4">
        {rows.map((s) => {
          const thumb = ytThumb(s.source_url);
          const ai = s.ai_review_result || {};
          const isBusy = !!busy[s.id];
          return (
            <div key={s.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex gap-4 p-4">
                {thumb ? (
                  <a href={s.source_url} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={thumb} alt="" className="w-40 aspect-video object-cover rounded-lg bg-slate-100" />
                  </a>
                ) : (
                  <div className="w-40 aspect-video rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-[11px] text-slate-400">미리보기 없음</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {s.source_type && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{s.source_type}</span>}
                    <p className="font-bold text-[14px] leading-snug">{s.raw_name}</p>
                  </div>
                  {s.raw_address && <p className="text-[12px] text-slate-500 mt-0.5">{s.raw_address}</p>}
                  {s.user_comment && <p className="text-[12px] text-slate-600 mt-1">💬 {s.user_comment}</p>}

                  {/* AI 심사 결과 */}
                  {ai && (ai.confidence_score != null || ai.reason) && (
                    <div className="mt-2 text-[12px] bg-slate-50 rounded-lg px-2.5 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {typeof ai.confidence_score === 'number' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ai.confidence_score >= 70 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            신뢰도 {ai.confidence_score}
                          </span>
                        )}
                        {ai.resolve_type && <span className="text-[10px] text-slate-400">{ai.resolve_type === 'existing_video_mapping' ? '기존 식당 매핑' : '신규 식당'}</span>}
                        {ai.youtuber_name && <span className="text-[10px] text-slate-400">· {ai.youtuber_name}</span>}
                      </div>
                      {ai.reason && <p className="text-[11px] text-slate-500 mt-1">{ai.reason}</p>}
                      {Array.isArray(ai.keywords) && ai.keywords.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {ai.keywords.map((k, i) => <span key={i} className="text-[10px] text-orange-600">{k}</span>)}
                        </div>
                      )}
                    </div>
                  )}

                  {s.resolved_restaurant && (
                    <p className="text-[11px] mt-1.5">
                      → 연결된 식당: <span className="font-semibold">{s.resolved_restaurant.name}</span>
                      <span className={`ml-1 ${s.resolved_restaurant.is_published ? 'text-green-600' : 'text-slate-400'}`}>
                        {s.resolved_restaurant.is_published ? '발행됨' : '미발행'}
                      </span>
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(s.created_at).toLocaleString('ko-KR')}</p>
                </div>
              </div>

              {/* 액션 */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 mr-auto">{busy[s.id] || s.status}</span>
                <button disabled={isBusy} onClick={() => review(s.id, false)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-blue-600 disabled:opacity-50">AI 심사</button>
                <button disabled={isBusy} onClick={() => review(s.id, true)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-green-600 disabled:opacity-50">강제 승인</button>
                {s.status !== 'held' && <button disabled={isBusy} onClick={() => setStatus(s.id, 'held', '보류')} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-slate-700 bg-amber-100 disabled:opacity-50">보류</button>}
                {s.status !== 'rejected' && <button disabled={isBusy} onClick={() => setStatus(s.id, 'rejected', '반려')} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-slate-700 bg-slate-200 disabled:opacity-50">반려</button>}
                {s.status !== 'pending' && <button disabled={isBusy} onClick={() => setStatus(s.id, 'pending', '대기복원')} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-slate-500 bg-white border border-slate-200 disabled:opacity-50">대기복원</button>}
                <button disabled={isBusy} onClick={() => remove(s.id)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-red-600 bg-red-50 disabled:opacity-50">삭제</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
