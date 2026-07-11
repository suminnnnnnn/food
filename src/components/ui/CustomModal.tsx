'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  noPadding?: boolean;
  light?: boolean; // 라이트 테마(흰 배경) 모달 — 프로젝트 라이트 톤과 통일
}

export default function CustomModal({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  noPadding,
  light
}: CustomModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Esc 키 지원 및 body 스크롤 차단
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 어두운 글래스 오버레이 (Dimmer) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-[6px]"
          />

          {/* 센터 모달 컨테이너 */}
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`relative w-full max-w-lg rounded-[28px] overflow-hidden flex flex-col z-10 ${
              light
                ? 'bg-white border border-slate-200 shadow-[0_20px_60px_rgba(60,40,20,0.22)]'
                : 'bg-[#1c1c20]/95 backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.03)]'
            }`}
          >


            {/* 헤더 영역 */}
            <div className="p-6 pb-2.5 flex justify-between items-start">
              {(title || subtitle) && (
                <div className="flex-1 min-w-0 pr-4">
                  {title && (
                    <h3 className={`text-xl font-black tracking-tight leading-snug ${light ? 'text-slate-900' : 'text-white'}`}>
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className={`text-[11px] font-semibold mt-1 tracking-tight ${light ? 'text-slate-500' : 'text-zinc-400'}`}>
                      {subtitle}
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={onClose}
                className={`p-1.5 rounded-xl transition-all cursor-pointer flex-shrink-0 ${
                  light
                    ? 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800'
                    : 'bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* 본문 영역 */}
            <div 
              className={`flex-1 overflow-y-auto max-h-[70vh] min-h-[150px] ${noPadding ? 'p-0' : 'px-6 pb-6'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
