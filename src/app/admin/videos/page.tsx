'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '../../../components/admin/AdminShell';

type Channel = { name?: string; youtube_channel_id?: string } | { name?: string; youtube_channel_id?: string }[] | null;
type Video = {
  id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  is_short: boolean | null;
  view_count: number | null;
  channels: Channel;
};
type ChannelRow = {
  id: string;
  youtube_channel_id: string;
  name: string;
  profile_image_url: string | null;
  subscriber_count: number | null;
};

function chName(c: Channel): string {
  if (!c) return '';
  const o = Array.isArray(c) ? c[0] : c;
  return o?.name || '';
}

export default function AdminVideosPage() {
  const { adminFetch } = useAdmin();
  const [sub, setSub] = useState<'videos' | 'channels'>('videos');
  const [q, setQ] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});

  const load = useCallback(() => {
    setLoading(true);
    setMsg(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const url = sub === 'videos' ? `/api/admin/videos?${params}` : `/api/admin/channels?${params}`;
    adminFetch(url)
      .then(async (r) => {
        if (r.status === 401) throw new Error('ADMIN_SECRET이 올바르지 않습니다 (좌측 하단에 입력)');
        if (!r.ok) throw new Error(`오류 ${r.status}`);
        return r.json();
      })
      .then((j) => { sub === 'videos' ? setVideos(j.data || []) : setChannels(j.data || []); setDraft({}); })
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, [q, sub, adminFetch]);

  useEffect(() => { load(); }, [sub]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (kind: 'videos' | 'channels', id: string, body: any) => {
    const r = await adminFetch(`/api/admin/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setMsg(`실패: ${j.error || r.status}`); return false; }
    setMsg('저장됨');
    return true;
  };
  const remove = async (kind: 'videos' | 'channels', id: string, label: string, warn?: string) => {
    if (!confirm(`${label} 삭제할까요?${warn ? `\n${warn}` : ''}`)) return;
    const r = await adminFetch(`/api/admin/${kind}/${id}`, { method: 'DELETE' });
    if (!r.ok) { setMsg(`삭제 실패: ${r.status}`); return; }
    load();
  };

  return (
    <div className="px-5 py-8 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-black tracking-tight">영상·채널 관리</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">영상 제목·쇼츠 여부 편집, 채널 정보 편집, 삭제</p>
      </div>

      {/* 서브탭 */}
      <div className="flex gap-2 mb-3">
        {(['videos', 'channels'] as const).map((s) => (
          <button key={s} onClick={() => setSub(s)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold ${sub === s ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {s === 'videos' ? '영상' : '채널'}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder={sub === 'videos' ? '영상 제목 검색' : '채널명 검색'}
          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange-400"
        />
        <button onClick={load} className="px-4 py-2 rounded-lg text-[13px] font-bold bg-slate-800 text-white">검색</button>
      </div>

      {msg && <div className="mb-4 text-[13px] px-3 py-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">{msg}</div>}
      {loading && <p className="text-[13px] text-slate-400 py-8 text-center">불러오는 중…</p>}

      {/* 영상 */}
      {sub === 'videos' && !loading && (
        <div className="flex flex-col gap-3">
          {videos.length === 0 && <p className="text-[13px] text-slate-400 py-12 text-center">항목이 없습니다</p>}
          {videos.map((v) => (
            <div key={v.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex gap-3">
              <a href={`https://youtu.be/${v.youtube_video_id}`} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_video_id}/mqdefault.jpg`} alt="" className="w-32 aspect-video object-cover rounded-lg bg-slate-100" />
              </a>
              <div className="flex-1 min-w-0">
                <input
                  defaultValue={v.title}
                  onChange={(e) => setDraft((d) => ({ ...d, [v.id]: e.target.value }))}
                  className="w-full font-bold text-[13px] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-orange-400 focus:outline-none pb-0.5"
                />
                <p className="text-[11px] text-slate-500 mt-1">{chName(v.channels)} · 조회 {(v.view_count || 0).toLocaleString()}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <label className="text-[11px] text-slate-500 flex items-center gap-1">
                    <input type="checkbox" checked={!!v.is_short} onChange={(e) => patch('videos', v.id, { is_short: e.target.checked }).then((ok) => ok && load())} />
                    쇼츠
                  </label>
                  <button onClick={() => patch('videos', v.id, { title: draft[v.id] ?? v.title }).then((ok) => ok && load())} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-orange-500">제목 저장</button>
                  <button onClick={() => remove('videos', v.id, `영상 "${v.title}"을`)} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 ml-auto">삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 채널 */}
      {sub === 'channels' && !loading && (
        <div className="flex flex-col gap-3">
          {channels.length === 0 && <p className="text-[13px] text-slate-400 py-12 text-center">항목이 없습니다</p>}
          {channels.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex gap-3 items-center">
              <img src={c.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=ff5e00&color=fff&rounded=true`} alt="" className="w-11 h-11 rounded-full object-cover bg-slate-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <input
                  defaultValue={c.name}
                  onChange={(e) => setDraft((d) => ({ ...d, [`n_${c.id}`]: e.target.value }))}
                  className="w-full font-bold text-[13px] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-orange-400 focus:outline-none pb-0.5"
                />
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{c.youtube_channel_id}</p>
              </div>
              <label className="text-[11px] text-slate-500 shrink-0">
                구독자
                <input
                  type="number"
                  defaultValue={c.subscriber_count ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [`s_${c.id}`]: e.target.value === '' ? null : Number(e.target.value) }))}
                  className="ml-1 w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[12px] focus:outline-none focus:border-orange-400"
                />
              </label>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => patch('channels', c.id, {
                    name: draft[`n_${c.id}`] ?? c.name,
                    ...(( `s_${c.id}` in draft) ? { subscriber_count: draft[`s_${c.id}`] } : {}),
                  }).then((ok) => ok && load())}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-orange-500">저장</button>
                <button onClick={() => remove('channels', c.id, `채널 "${c.name}"을`, '⚠️ 이 채널의 영상도 함께 삭제됩니다')} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-600 bg-red-50">삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
