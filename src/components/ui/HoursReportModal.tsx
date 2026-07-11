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

export default function HoursReportModal({ isOpen, onClose, restaurantId, restaurantName, initialHours, onSubmitted }: Props) {
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHours(initialHours && initialHours !== '정보 없음' ? initialHours : '');
      setDone(false);
      setErr(null);
    }
  }, [isOpen, initialHours]);

  const submit = async () => {
    const v = hours.trim();
    if (!v) { setErr('영업시간을 입력해 주세요'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/restaurants/${restaurantId}/hours`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_hours: v }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || '전송 실패');
      onSubmitted(v);
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
              <div className="px-5 pb-6 space-y-3">
                <p className="text-[11.5px] text-slate-400 leading-relaxed">{restaurantName}의 영업시간을 알려주세요. 입력한 정보는 <b className="text-slate-500">‘이용자 제보’</b>로 표시되며, 틀리면 누구나 정정할 수 있어요.</p>
                <textarea value={hours} onChange={(e) => setHours(e.target.value)} rows={3} maxLength={300} autoFocus
                  placeholder="예: 매일 11:00 - 21:00 (라스트오더 20:30), 화요일 휴무"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 resize-none" />
                {err && <p className="text-[12px] text-red-500">{err}</p>}
                <button onClick={submit} disabled={busy}
                  className="w-full py-3 rounded-2xl text-white font-bold text-[14px] disabled:opacity-60 active:scale-[0.98] transition-transform"
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
