'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '../../../components/admin/AdminShell';

type Stats = {
  total: number;
  today: number;
  last7: number;
  last30: number;
  byPlatform: Record<string, number>;
  byDay: { date: string; count: number }[];
  topProducts: { id: string; count: number; name: string; brand: string }[];
};

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[12px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-[26px] font-black tabular-nums text-slate-800">{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminAffiliatePage() {
  const { adminFetch } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    adminFetch('/api/admin/affiliate-stats')
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

  const maxDay = stats ? Math.max(1, ...stats.byDay.map((d) => d.count)) : 1;

  return (
    <div className="px-5 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-black tracking-tight">제휴 전환 통계</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">쇼핑탭 제휴 링크 클릭 로그 (mealkit_click_events)</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 rounded-full text-[13px] font-semibold bg-white border border-slate-200 text-slate-500">새로고침</button>
      </div>

      <div className="mb-5 text-[12px] px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
        ℹ️ 현재는 <b>클릭</b>만 집계됩니다. 실제 <b>구매 전환</b>은 쿠팡파트너스 API(전환 postback) 연동 후 표시됩니다.
      </div>

      {err && <div className="mb-4 text-[13px] px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-100">{err}</div>}
      {loading && !stats && <p className="text-[13px] text-slate-400 py-12 text-center">불러오는 중…</p>}

      {stats && (
        <div className="flex flex-col gap-6">
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="전체 클릭" value={stats.total} />
            <Kpi label="오늘" value={stats.today} />
            <Kpi label="최근 7일" value={stats.last7} />
            <Kpi label="최근 30일" value={stats.last30} />
          </div>

          {/* 일별 추이 (최근 14일) */}
          <section>
            <h2 className="text-[12px] font-bold text-slate-400 mb-2">일별 클릭 (최근 14일)</h2>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              {stats.last30 === 0 ? (
                <p className="text-[13px] text-slate-400 py-6 text-center">아직 클릭 데이터가 없습니다</p>
              ) : (
                <div className="flex items-end gap-1.5 h-32">
                  {stats.byDay.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div className="w-full rounded-t bg-orange-400" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? 3 : 0 }} title={`${d.date}: ${d.count}`} />
                      <span className="text-[9px] text-slate-400 truncate w-full text-center">{d.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 플랫폼별 */}
            <section>
              <h2 className="text-[12px] font-bold text-slate-400 mb-2">플랫폼별 (최근 30일)</h2>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
                {Object.keys(stats.byPlatform).length === 0 && <p className="text-[13px] text-slate-400">데이터 없음</p>}
                {Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1]).map(([p, c]) => (
                  <div key={p} className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold text-slate-700">{p}</span>
                    <span className="tabular-nums text-slate-500">{c.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 인기 상품 */}
            <section>
              <h2 className="text-[12px] font-bold text-slate-400 mb-2">클릭 많은 상품 (최근 30일)</h2>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
                {stats.topProducts.length === 0 && <p className="text-[13px] text-slate-400">데이터 없음</p>}
                {stats.topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-[13px]">
                    <span className="text-[11px] font-bold text-slate-300 w-4">{i + 1}</span>
                    {p.brand && <span className="text-[11px] font-bold text-orange-600">{p.brand}</span>}
                    <span className="font-semibold text-slate-700 truncate flex-1">{p.name}</span>
                    <span className="tabular-nums text-slate-500 shrink-0">{p.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
