'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';

interface CustomBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  noPadding?: boolean;
  noScroll?: boolean;
}

export default function CustomBottomSheet({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  noPadding,
  noScroll
}: CustomBottomSheetProps) {
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Esc 키 누를 때 닫기 및 스크롤 고정
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
        <>
          {/* 어두운 반투명 배경 레이어 (Dimmer) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 md:hidden"
          />

          {/* 바텀시트 메인 컨테이너 */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            drag="y"
            dragDirectionLock
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.8 }}
            onDragEnd={(event, info) => {
              // 아래로 120px 이상 드래그하거나 빠른 속도로 던지면 닫기
              if (info.offset.y > 120 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className="fixed bottom-0 left-0 right-0 max-h-[92vh] rounded-t-[32px] bg-brand-charcoal/95 border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl z-50 flex flex-col overflow-hidden md:hidden"
          >
            {/* 드래그 핸들러 및 헤더 영역 */}
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="w-full pt-4 pb-3 flex flex-col items-center cursor-grab active:cursor-grabbing shrink-0 select-none touch-none"
            >
              {/* 바 모양 드래그 핸들 */}
              <div className="w-12 h-1.5 bg-white/20 rounded-full mb-3" />
              
              {/* 타이틀 및 닫기 버튼 */}
              {(title || subtitle) && (
                <div className="w-full px-6 flex justify-between items-start">
                  <div>
                    {title && (
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        {title}
                      </h3>
                    )}
                    {subtitle && (
                      <p className="text-xs text-white/55 mt-1 tracking-tight">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* 본문 콘텐츠 (자체 스크롤 지원) */}
            <div className={`flex-1 ${noScroll ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'} ${noPadding ? 'p-0' : 'px-5 pb-8'} min-h-0`}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
