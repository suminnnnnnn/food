'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
}

export default function InfoSuggestModal({ isOpen, onClose, restaurantId, restaurantName }: Props) {
  const [hours, setHours] = useState('');
  const [menu, setMenu] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => { setHours(''); setMenu(''); setPhone(''); setNote(''); setDone(false); setErr(null); };
  const close = () => { onClose(); setTimeout(reset, 300); };

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/restaurants/${restaurantId}/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_hours: hours, menu_info: menu, phone, note }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || '전송 실패');
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const field = (label: string, val: string, set: (v: string) => void, ph: string, multiline = false) => (
    <label className="block">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      {multiline ? (
        <textarea value={val} onChange={(e) => set(e.target.value)} placeholder={ph} rows={2}
          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 resize-none" />
      ) : (
        <input value={val} onChange={(e) => set(e.target.value)} placeholder={ph}
          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400" />
      )}
    </label>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className="relative w-full sm:max-w-[420px] bg-white border border-slate-200 sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-[15px] font-black text-slate-900">정보 정정·신고</h3>
              <button onClick={close} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-800"><X size={15} /></button>
            </div>

            {done ? (
              <div className="px-5 pb-8 pt-2 flex flex-col items-center text-center gap-2">
                <CheckCircle2 size={40} className="text-emerald-500" />
                <p className="text-[14px] font-bold text-slate-800">제안 감사합니다!</p>
                <p className="text-[12px] text-slate-500">검토 후 반영하겠습니다.</p>
                <button onClick={close} className="mt-3 px-6 py-2.5 rounded-2xl text-white font-bold text-[13px]" style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}>확인</button>
              </div>
            ) : (
              <div className="px-5 pb-6 space-y-3">
                <p className="text-[11.5px] text-slate-400 leading-relaxed">{restaurantName}의 정보가 틀렸거나 폐업·이전했다면 알려주세요. 아는 항목만 입력하시면 됩니다.</p>
                {field('영업시간', hours, setHours, '예: 매일 11:00-21:00, 화요일 휴무')}
                {field('대표 메뉴·가격', menu, setMenu, '예: 마늘갈비 17,000원', true)}
                {field('전화번호', phone, setPhone, '예: 062-000-0000')}
                {field('기타 메모', note, setNote, '폐업/이전 등', true)}
                {err && <p className="text-[12px] text-red-500">{err}</p>}
                <button onClick={submit} disabled={busy}
                  className="w-full py-3 rounded-2xl text-white font-bold text-[14px] disabled:opacity-60 active:scale-[0.98] transition-transform"
                  style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}>
                  {busy ? '전송 중…' : '보내기'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
