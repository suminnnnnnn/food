'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '../../components/admin/AdminShell';

type Stats = {
  mealkits: { pending: number; approved: number; rejected: number; products: number };
  content: { restaurants: number; published: number; videos: number; channels: number };
  submissions: { pending: number; held: number };
};

function Card({
  href, label, value, sub, accent,
}: { href?: string; label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  const body = (
    <div
      className={`rounded-2xl border p-4 h-full transition-colors ${
        accent ? 'border-orange-200 bg-orange-50 hover:bg-orange-100' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <p className="text-[12px] font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-[26px] font-black tabular-nums ${accent ? 'text-orange-600' : 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function AdminHome() {
  const { adminFetch } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    adminFetch('/api/admin/stats')
      .then(async (r) => {
        if (r.status === 401) throw new Error('ADMIN_SECRET이 올바르지 않습니다 (좌측 하단에 입력)');
        if (!r.ok) throw new Error(`오류 ${r.status}`);
        return r.json();
      })
      .then(setStats)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [adminFetch]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-5 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black tracking-tight">대시보드</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">프로젝트 운영 현황 한눈에 보기</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 rounded-full text-[13px] font-semibold bg-white border border-slate-200 text-slate-500">
          새로고침
        </button>
      </div>

      {err && <div className="mb-4 text-[13px] px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-100">{err}</div>}
      {loading && !stats && <p className="text-[13px] text-slate-400 py-12 text-center">불러오는 중…</p>}

      {stats && (
        <div className="flex flex-col gap-6">
          {/* 처리 대기 (액션 필요) */}
          <section>
            <h2 className="text-[12px] font-bold text-slate-400 mb-2">처리 대기</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card href="/admin/mealkits" label="밀키트 검수 대기" value={stats.mealkits.pending} accent={stats.mealkits.pending > 0} sub="쇼핑탭 노출 전" />
              <Card href="/admin/submissions" label="맛집 제보 대기" value={stats.submissions.pending} accent={stats.submissions.pending > 0} />
              <Card href="/admin/submissions" label="보류(held)" value={stats.submissions.held} sub="사람 확인 필요" />
              <Card href="/admin/mealkits" label="반려됨(밀키트)" value={stats.mealkits.rejected} />
            </div>
          </section>

          {/* 콘텐츠 현황 */}
          <section>
            <h2 className="text-[12px] font-bold text-slate-400 mb-2">콘텐츠</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card href="/admin/restaurants" label="맛집" value={stats.content.restaurants} sub={`발행 ${stats.content.published}`} />
              <Card href="/admin/videos" label="영상" value={stats.content.videos} />
              <Card href="/admin/videos" label="채널" value={stats.content.channels} />
              <Card href="/admin/mealkits" label="밀키트 승인·상품" value={`${stats.mealkits.approved} · ${stats.mealkits.products}`} sub="승인영상 · 상품수" />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
