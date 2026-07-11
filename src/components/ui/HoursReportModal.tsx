'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle2 } from 'lucide-react';

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
  return (kst.getDay() + 6) % 7; // getDay: 0=일 → 월=0 체계로
};

export default function HoursReportModal({ isOpen, onClose, restaurantId, restaurantName, onSubmitted }: Props) {
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [openTime, setOpenTime] = useState('11:00');
  const [closeTime, setCloseTime] = useState('21:00');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOpenDays(new Set([0, 1, 2, 3, 4, 5, 6]));
      setOpenTime('11:00');
      setCloseTime('21:00');
      setDone(false);
      setErr(null);
    }
  }, [isOpen]);

  const toggleDay = (i: number) => {
    setOpenDays(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const buildHours = (): string => {
    if (openDays.size === 7) return `매일 ${openTime}~${closeTime}`;
    return DAYS.map((d, i) => (openDays.has(i) ? `${d} ${openTime}~${closeTime}` : `${d} 휴무`)).join('\n');
  };

  const ti = todayIdx();
  const preview = openDays.has(ti) ? `${openTime}~${closeTime}` : '휴무';

  const submit = async () => {
    if (openDays.size === 0) { setErr('영업하는 요일을 최소 1개 선택해 주세요'); return; }
    if (openTime >= closeTime) { setErr('종료 시간이 시작 시간보다 늦어야 해요'); return; }
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className="relative w-full sm:max-w-[420px] bg-white border border-slate-200 sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-[15px] font-black text-slate-900 flex items-center gap-1.5"><Clock size={16} className="text-orange-500" /> 영업시간 제보</h3>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-800"><X size={15} /></button>
            </div>

            {done ? (
              <div className="px-5 pb-8 pt-2 flex flex-col items-center text-center gap-2">
                <CheckCircle2 size={40} className="text-emerald-500" />
                <p className="text-[14px] font-bold text-slate-800">제보 감사합니다!</p>
                <p className="text-[12px] text-slate-500">‘이용자 제보’로 바로 반영됐어요.</p>
                <button onClick={onClose} className="mt-3 px-6 py-2.5 rounded-2xl text-white font-bold text-[13px]" style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}>확인</button>
              </div>
            ) : (
              <div className="px-5 pb-6 space-y-4">
                <p className="text-[11.5px] text-slate-400 leading-relaxed">{restaurantName}의 영업 요일과 시간을 골라주세요. <b className="text-slate-500">‘이용자 제보’</b>로 표시되며 누구나 정정할 수 있어요.</p>

                {/* 영업 요일 */}
                <div>
                  <p className="text-[11px] font-black text-slate-500 mb-2">영업 요일 <span className="text-slate-400 font-bold">(눌러서 휴무 지정)</span></p>
                  <div className="flex gap-1.5">
                    {DAYS.map((d, i) => {
                      const on = openDays.has(i);
                      return (
                        <button key={d} onClick={() => toggleDay(i)}
                          className={`flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all ${
                            on ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-300 line-through'
                          }`}
                          style={on ? { background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' } : undefined}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 영업 시간 */}
                <div>
                  <p className="text-[11px] font-black text-slate-500 mb-2">영업 시간</p>
                  <div className="flex items-center gap-2">
                    <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[15px] font-bold text-slate-800 text-center focus:outline-none focus:border-orange-400" />
                    <span className="text-slate-400 font-black">~</span>
                    <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[15px] font-bold text-slate-800 text-center focus:outline-none focus:border-orange-400" />
                  </div>
                </div>

                {/* 미리보기 */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <span className="text-[11px] font-black text-orange-600">오늘 ({DAYS[ti]})</span>
                  <span className="text-[13px] font-bold text-slate-800">{preview}</span>
                </div>

                {err && <p className="text-[12px] text-red-500">{err}</p>}
                <button onClick={submit} disabled={busy}
                  className="w-full py-3.5 rounded-2xl text-white font-black text-[14px] disabled:opacity-60 active:scale-[0.98] transition-transform"
                  style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}>
                  {busy ? '전송 중…' : '제보하기'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
