'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { TabType } from './BottomTabBar';

interface OverlayContainerProps {
  activeTab: TabType;
  onClose: () => void;
  children: React.ReactNode;
}

export default function OverlayContainer({ activeTab, onClose, children }: OverlayContainerProps) {
  const titles: Record<TabType, string> = {
    shopping: '인기 맛집 밀키트 쇼핑',
    home: '지도로 찾기',
    near: '주변 맛집 목록',
    favorites: '내 저장소',
    mypage: '마이',
    planning: '나의 여행 일정',
  };

  const isVisible = activeTab !== 'home' && activeTab !== 'near';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden flex flex-col justify-end"
        >
          {/* 바텀시트 본체 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="w-full h-[85vh] bg-zinc-950/85 backdrop-blur-2xl border-t border-zinc-800/60 rounded-t-[28px] shadow-[0_-15px_40px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden pb-[calc(env(safe-area-inset-bottom,16px)+72px)]"
          >
            {/* 드래그 핸들 느낌의 데코레이션 */}
            <div className="w-full py-3 flex justify-center items-center cursor-pointer" onClick={onClose}>
              <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full" />
            </div>

            {/* 헤더 바 */}
            <div className="px-6 pb-4 border-b border-zinc-800/30 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#ff6b00] rounded-full inline-block animate-pulse" />
                {titles[activeTab]}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-zinc-800/40 border border-zinc-800/50 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 콘텐츠 영역 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
