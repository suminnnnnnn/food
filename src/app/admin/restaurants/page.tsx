'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '../../../components/admin/AdminShell';

type Restaurant = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  road_address: string | null;
  phone: string | null;
  parking: string | null;
  packaging: string | null;
  reservation: string | null;
  business_hours: string | null;
  menu_info: string | null;
  lat: number | null;
  lng: number | null;
  is_published: boolean | null;
  video_count: number;
};

const EDIT_FIELDS: { key: keyof Restaurant; label: string }[] = [
  { key: 'name', label: '상호명' },
  { key: 'category', label: '카테고리' },
  { key: 'address', label: '지번주소' },
  { key: 'road_address', label: '도로명주소' },
  { key: 'phone', label: '전화' },
  { key: 'parking', label: '주차' },
  { key: 'packaging', label: '포장' },
  { key: 'reservation', label: '예약' },
  { key: 'business_hours', label: '영업시간' },
  { key: 'menu_info', label: '메뉴/가격' },
];

export default function AdminRestaurantsPage() {
  const { adminFetch } = useAdmin();
  const [q, setQ] = useState('');
  const [published, setPublished] = useState<'all' | 'true' | 'false'>('all');
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Restaurant>>({});

  const load = useCallback(() => {
    setLoading(true);
    setMsg(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (published !== 'all') params.set('published', published);
    adminFetch(`/api/admin/restaurants?${params.toString()}`)
      .then(async (r) => {
        if (r.status === 401) throw new Error('ADMIN_SECRET이 올바르지 않습니다 (좌측 하단에 입력)');
        if (!r.ok) throw new Error(`오류 ${r.status}`);
        return r.json();
      })
      .then((j) => setRows(j.data || []))
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, [q, published, adminFetch]);

  useEffect(() => { load(); }, [published]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (id: string, body: any) => {
    const r = await adminFetch(`/api/admin/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setMsg(`실패: ${j.error || r.status}`); return false; }
    return true;
  };
  const togglePublish = async (row: Restaurant) => {
    if (await patch(row.id, { is_published: !row.is_published })) load();
  };
  const startEdit = (row: Restaurant) => {
    setEditId(row.id);
    const d: Partial<Restaurant> = {};
    EDIT_FIELDS.forEach((f) => { (d as any)[f.key] = (row as any)[f.key] ?? ''; });
    setDraft(d);
  };
  const saveEdit = async (id: string) => {
    if (await patch(id, draft)) { setEditId(null); setMsg('저장됨'); load(); }
  };
  const remove = async (row: Restaurant) => {
    if (!confirm(`"${row.name}" 맛집을 삭제할까요? 연결된 영상 매핑도 함께 삭제됩니다.`)) return;
    const r = await adminFetch(`/api/admin/restaurants/${row.id}`, { method: 'DELETE' });
    if (!r.ok) { setMsg(`삭제 실패: ${r.status}`); return; }
    load();
  };

  return (
    <div className="px-5 py-8 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-black tracking-tight">맛집 관리</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">검색·발행 토글·상세 편집·삭제</p>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="상호명·카테고리·주소 검색"
          className="flex-1 min-w-[180px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange-400"
        />
        <button onClick={load} className="px-4 py-2 rounded-lg text-[13px] font-bold bg-slate-800 text-white">검색</button>
      </div>
      <div className="flex gap-2 mb-4">
        {(['all', 'true', 'false'] as const).map((p) => (
          <button key={p} onClick={() => setPublished(p)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-bold ${published === p ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {p === 'all' ? '전체' : p === 'true' ? '발행됨' : '미발행'}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 rounded-full text-[12px] font-semibold bg-white border border-slate-200 text-slate-500">새로고침</button>
      </div>

      {msg && <div className="mb-4 text-[13px] px-3 py-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">{msg}</div>}
      {loading && <p className="text-[13px] text-slate-400 py-8 text-center">불러오는 중…</p>}
      {!loading && rows.length === 0 && <p className="text-[13px] text-slate-400 py-12 text-center">항목이 없습니다</p>}

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.id} className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[14px]">{row.name}</span>
                  {row.category && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{row.category}</span>}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {row.is_published ? '발행됨' : '미발행'}
                  </span>
                  <span className="text-[10px] text-slate-400">🎬 {row.video_count}</span>
                </div>
                {row.address && <p className="text-[12px] text-slate-500 mt-0.5">{row.address}</p>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => togglePublish(row)} className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold ${row.is_published ? 'bg-slate-200 text-slate-700' : 'bg-green-600 text-white'}`}>
                  {row.is_published ? '숨김' : '발행'}
                </button>
                <button onClick={() => (editId === row.id ? setEditId(null) : startEdit(row))} className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-slate-100 text-slate-700">
                  {editId === row.id ? '닫기' : '편집'}
                </button>
                <button onClick={() => remove(row)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-red-600 bg-red-50">삭제</button>
              </div>
            </div>

            {editId === row.id && (
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-2">
                {EDIT_FIELDS.map((f) => (
                  <label key={f.key} className="text-[11px] text-slate-500">
                    {f.label}
                    <input
                      value={(draft[f.key] as string) ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      className="mt-0.5 w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-800 focus:outline-none focus:border-orange-400"
                    />
                  </label>
                ))}
                <div className="md:col-span-2 flex justify-end gap-2 mt-1">
                  <button onClick={() => setEditId(null)} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-slate-200 text-slate-500">취소</button>
                  <button onClick={() => saveEdit(row.id)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-orange-500">저장</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
