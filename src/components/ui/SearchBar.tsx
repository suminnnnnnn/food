'use client';

import { Search, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export default function SearchBar({ value, onChange, className }: SearchBarProps) {
  return (
    <div className={className || "absolute top-[88px] left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-2xl"}>
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        className="relative flex items-center w-full"
      >
        {/* 장식용 아이콘 */}
        <div className="absolute left-4 text-brand-orange-light z-10 pointer-events-none">
          <Sparkles size={16} className="animate-pulse" />
        </div>
        
        {/* 검색 입력창 */}
        <input 
          type="text" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="식당명, #데이트코스, #주차가능, #라멘 등을 검색해보세요..." 
          className="w-full bg-brand-charcoal/80 dark:bg-brand-charcoal/85 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-white/20 focus:border-brand-orange-light/50 rounded-full py-3.5 pl-11 pr-22 text-sm font-semibold text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 transition-all duration-300"
        />

        {/* 액션 컨트롤 영역 (지우기 및 검색 버튼) */}
        <div className="absolute right-2.5 flex items-center gap-1.5 z-10">
          <AnimatePresence>
            {value && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => onChange('')}
                className="p-1.5 hover:bg-white/10 active:bg-white/20 text-white/50 hover:text-white rounded-full transition-all cursor-pointer"
                title="검색어 지우기"
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>

          <div 
            onClick={() => {}}
            className="p-2 bg-brand-orange text-white rounded-full shadow-md cursor-pointer hover:bg-brand-orange-light hover:scale-105 active:scale-95 transition-all flex items-center justify-center border border-brand-orange-light/20"
          >
            <Search size={14} strokeWidth={2.5} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

