'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  initialHours?: string;
  onSubmitted: (hours: string) => void; // 즉시 화면 반영용
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일']; // index 0=월 … 6=일

// 오늘 요일 index (월=0 … 일=6, KST)
const todayIdx = () => {
  const now = new Date();
  const kst = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 3600000 * 9);
  return (kst.getDay() + 6) % 7;
};

const EMBER = 'linear-gradient(100deg,#FF3B30,#FF6F00)';
// 12시간 표기 (오전/오후) — 미리보기·요약용
const to12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  const ap = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${String(m).padStart(2, '0')}`;
};

// 시간 입력 필드 (모듈 레벨 — 리렌더 시 remount로 포커스 튀는 것 방지)
const TimeField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <label className="flex-1 block">
    <span className="text-[10px] font-bold text-slate-400 block mb-1 pl-0.5">{label}</span>
    <input type="time" value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[16px] font-black text-slate-800 tracking-tight text-center tabular-nums focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
  </label>
);

export default function HoursReportModal({ isOpen, onClose, restaurantId, restaurantName, onSubmitted }: Props) {
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [sharedStart, setSharedStart] = useState('11:00');
  const [sharedEnd, setSharedEnd] = useState('21:00');
  const [perDay, setPerDay] = useState(false);
  const [times, setTimes] = useState<{ start: string; end: string }[]>(
    Array.from({ length: 7 }, () => ({ start: '11:00', end: '21:00' }))
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOpenDays(new Set([0, 1, 2, 3, 4, 5, 6]));
      setSharedStart('11:00'); setSharedEnd('21:00');
      setPerDay(false);
      setTimes(Array.from({ length: 7 }, () => ({ start: '11:00', end: '21:00' })));
      setDone(false); setErr(null);
    }
  }, [isOpen]);

  const toggleDay = (i: number) => {
    setOpenDays(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };
  const setDayTime = (i: number, key: 'start' | 'end', v: string) => {
    setTimes(prev => prev.map((t, idx) => (idx === i ? { ...t, [key]: v } : t)));
  };
  const enablePerDay = () => {
    setTimes(Array.from({ length: 7 }, () => ({ start: sharedStart, end: sharedEnd })));
    setPerDay(true);
  };

  const getStart = (i: number) => (perDay ? times[i].start : sharedStart);
  const getEnd = (i: number) => (perDay ? times[i].end : sharedEnd);

  const buildHours = (): string => {
    const openIdx = [...openDays].sort((a, b) => a - b);
    const uniform = openDays.size === 7 && openIdx.every(i => getStart(i) === getStart(openIdx[0]) && getEnd(i) === getEnd(openIdx[0]));
    if (uniform) return `매일 ${getStart(0)}~${getEnd(0)}`;
    return DAYS.map((d, i) => (openDays.has(i) ? `${d} ${getStart(i)}~${getEnd(i)}` : `${d} 휴무`)).join('\n');
  };

  const validate = (): string | null => {
    if (openDays.size === 0) return '영업하는 요일을 최소 1개 선택해 주세요';
    for (const i of openDays) {
      if (getStart(i) >= getEnd(i)) return `${DAYS[i]}요일의 닫는 시간이 여는 시간보다 늦어야 해요`;
    }
    return null;
  };

  const ti = todayIdx();
  const todayOpen = openDays.has(ti);

  const submit = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    const hours = buildHours();
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/restaurants/${restaurantId}/hours`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_hours: hours }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || '전송 실패');
      onSubmitted(hours);
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: 48 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 48 }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
            className="relative w-full sm:max-w-[420px] bg-white sm:rounded-[28px] rounded-t-[28px] overflow-hidden shadow-[0_-8px_40px_rgba(0,0,0,0.18)] sm:shadow-[0_24px_60px_rgba(0,0,0,0.28)] max-h-[90vh] flex flex-col">
            {/* 모바일 그랩 핸들 */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0"><span className="w-9 h-1.5 rounded-full bg-slate-200" /></div>

            {/* 헤더 */}
            <div className="px-5 pt-3 sm:pt-5 pb-4 shrink-0 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[17px] font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Clock size={17} className="text-orange-500" />
                  영업시간 알려주기
                </h3>
                <p className="text-[11.5px] text-slate-400 font-medium mt-1 truncate">{restaurantName} · 문 여는 요일과 시간을 골라주세요</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"><X size={16} /></button>
            </div>

            {done ? (
              <div className="px-6 pb-9 pt-3 flex flex-col items-center text-center gap-2.5">
                <div className="w-16 h-16 rounded-full grid place-items-center mb-1" style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,.18), transparent)' }}>
                  <CheckCircle2 size={44} className="text-emerald-500" />
                </div>
                <p className="text-[16px] font-black text-slate-900">고마워요! 반영됐어요</p>
                <p className="text-[12.5px] text-slate-500 leading-relaxed">알려주신 영업시간이 <b className="text-slate-700">‘이용자 제보’</b>로<br />바로 표시됩니다.</p>
                <button onClick={onClose} className="mt-4 w-full max-w-[220px] py-3 rounded-2xl text-white font-black text-[14px] active:scale-[0.97] transition-transform" style={{ background: EMBER }}>확인</button>
              </div>
            ) : (
              <div className="px-5 pb-5 space-y-5 overflow-y-auto">
                {/* 문 여는 요일 */}
                <section>
                  <div className="flex items-baseline justify-between mb-2.5">
                    <h4 className="text-[12px] font-black text-slate-700">문 여는 요일</h4>
                    <span className="text-[10.5px] font-bold text-slate-400">회색 = 휴무</span>
                  </div>
                  <div className="flex gap-1.5">
                    {DAYS.map((d, i) => {
                      const on = openDays.has(i);
                      return (
                        <button key={d} onClick={() => toggleDay(i)} aria-pressed={on}
                          className={`flex-1 h-11 rounded-xl text-[14px] font-black transition-all active:scale-95 border ${on ? 'bg-orange-50 border-orange-400 text-orange-600' : 'bg-slate-50 border-slate-200 text-slate-300 line-through'}`}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 영업 시간 */}
                <section>
                  <div className="flex items-baseline justify-between mb-2.5">
                    <h4 className="text-[12px] font-black text-slate-700">영업 시간</h4>
                    {!perDay ? (
                      <button onClick={enablePerDay} className="inline-flex items-center gap-0.5 text-[11px] font-black text-orange-500 hover:text-orange-600">요일마다 달라요<ChevronRight size={13} /></button>
                    ) : (
                      <button onClick={() => setPerDay(false)} className="inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-400 hover:text-slate-600"><ChevronLeft size={13} />모두 같은 시간</button>
                    )}
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {!perDay ? (
                      <motion.div key="shared" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                        className="rounded-2xl bg-slate-50/70 border border-slate-100 p-3">
                        <div className="flex items-end gap-2">
                          <TimeField label="여는 시간" value={sharedStart} onChange={setSharedStart} />
                          <span className="text-slate-300 font-black text-[15px] pb-2.5">~</span>
                          <TimeField label="닫는 시간" value={sharedEnd} onChange={setSharedEnd} />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="perday" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                        className="rounded-2xl bg-slate-50/70 border border-slate-100 p-2.5 space-y-1.5">
                        {DAYS.map((d, i) => {
                          const on = openDays.has(i);
                          return (
                            <div key={d} className="flex items-center gap-2">
                              <button onClick={() => toggleDay(i)} aria-pressed={on}
                                className={`w-10 h-10 rounded-xl text-[14px] font-black shrink-0 transition-all active:scale-95 border ${on ? 'bg-orange-50 border-orange-400 text-orange-600' : 'bg-slate-50 border-slate-200 text-slate-300 line-through'}`}>{d}</button>
                              {on ? (
                                <div className="flex items-center gap-1.5 flex-1">
                                  <input type="time" value={times[i].start} onChange={e => setDayTime(i, 'start', e.target.value)}
                                    className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-2 py-2 text-[14px] font-bold text-slate-800 text-center tabular-nums focus:outline-none focus:border-orange-400" />
                                  <span className="text-slate-300 font-black shrink-0">~</span>
                                  <input type="time" value={times[i].end} onChange={e => setDayTime(i, 'end', e.target.value)}
                                    className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-2 py-2 text-[14px] font-bold text-slate-800 text-center tabular-nums focus:outline-none focus:border-orange-400" />
                                </div>
                              ) : (
                                <div className="flex-1 text-[13px] font-bold text-slate-300 pl-1">휴무</div>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* 오늘 미리보기 */}
                <div className="rounded-2xl px-4 py-3 flex items-center gap-3 border bg-slate-50 border-slate-100">
                  <span className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 text-[13px] font-black border ${todayOpen ? 'bg-orange-50 border-orange-400 text-orange-600' : 'bg-white border-slate-200 text-slate-400'}`}>{DAYS[ti]}</span>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-black text-slate-400">오늘 미리보기</p>
                    <p className="text-[15px] font-black text-slate-800 tracking-tight">
                      {todayOpen ? `${to12(getStart(ti))} – ${to12(getEnd(ti))}` : '휴무'}
                    </p>
                  </div>
                </div>

                {err && <p className="text-[12px] font-bold text-red-500 -mt-1">{err}</p>}

                <button onClick={submit} disabled={busy}
                  className="w-full py-3.5 rounded-2xl text-white font-black text-[14.5px] disabled:opacity-60 active:scale-[0.98] transition-transform shadow-[0_6px_18px_rgba(255,59,48,0.28)]"
                  style={{ background: EMBER }}>
                  {busy ? '전송 중…' : '이 시간으로 제보하기'}
                </button>
                <p className="text-center text-[10.5px] text-slate-400 font-medium -mt-2">‘이용자 제보’로 표시되며, 틀리면 누구나 정정할 수 있어요.</p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
