'use client';

import { ContentSource } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, X, SlidersHorizontal, ChefHat, Play } from 'lucide-react';
import { useState } from 'react';
import { MichelinIcon, BlueRibbonIcon } from '@/components/icons/CustomIcons';

interface FilterOption {
  id: ContentSource | string;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}

const filters: FilterOption[] = [
  { id: 'youtube', label: '유튜브 핫플', icon: Play, activeClass: 'bg-red-500/20 border-red-500/40 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.2)]' },
  { id: 'netflix_chef', label: '흑백요리사', icon: ChefHat, activeClass: 'bg-gray-700/30 border-white/20 text-white shadow-[0_0_12px_rgba(255,255,255,0.15)]' },
  { id: 'michelin', label: '미쉐린', icon: MichelinIcon, activeClass: 'bg-red-600/20 border-red-600/40 text-red-300 shadow-[0_0_12px_rgba(220,38,38,0.2)]' },
  { id: 'blueribbon', label: '블루리본', icon: BlueRibbonIcon, activeClass: 'bg-blue-600/20 border-blue-600/40 text-blue-300 shadow-[0_0_12px_rgba(37,99,235,0.2)]' },
];

interface OmniSearchConsoleProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  activeSources: Set<ContentSource | string>;
  onToggleSource: (source: ContentSource | string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function OmniSearchConsole({
  searchQuery,
  onSearchChange,
  activeSources,
  onToggleSource,
  className,
  style
}: OmniSearchConsoleProps) {
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // 현재 필터가 하나라도 활성화되어 있는지 여부
  const hasActiveFilters = activeSources.size > 0;

  return (
    <div 
      className={className || "absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-2xl flex flex-col gap-2.5"}
      style={style}
    >
      {/* 메인 검색 및 다이얼 컨트롤 바 */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative flex items-center w-full"
      >
        {/* 좌측 장식용 맥동 스파클 아이콘 */}
        <div className="absolute left-4.5 text-brand-orange-light z-10 pointer-events-none">
          <Sparkles size={15} className="animate-pulse" />
        </div>
        
        {/* 통합 검색 입력 인풋 */}
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="식당명, #노포, #감성, #라멘 등을 검색해보세요..." 
          className="w-full bg-[#0c0c0e]/80 dark:bg-[#0c0c0e]/85 backdrop-blur-2xl border border-white/8 shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:border-white/15 focus:border-brand-orange-light/50 rounded-full py-4 pl-11.5 pr-26 text-[13.5px] font-bold text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 transition-all duration-300"
        />

        {/* 액션 컨트롤러 그룹 (입력 초기화, 필터 토글, 검색 돋보기) */}
        <div className="absolute right-3 flex items-center gap-1.5 z-10">
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => onSearchChange('')}
                className="p-1.5 hover:bg-white/10 active:bg-white/15 text-white/40 hover:text-white rounded-full transition-all cursor-pointer"
                title="검색어 지우기"
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* 지능형 미식 소스 필터 다이얼 버튼 (필터 켜지면 글로잉 주황색 원형 뱃지 활성화) */}
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className={`relative p-2.5 rounded-full transition-all duration-300 cursor-pointer flex items-center justify-center border ${
              isFilterExpanded 
                ? 'bg-brand-orange text-white border-brand-orange shadow-[0_0_15px_rgba(255,0,68,0.4)]'
                : hasActiveFilters
                  ? 'bg-brand-orange/15 text-brand-orange-light border-brand-orange/30 shadow-[0_0_12px_rgba(255,94,0,0.25)]'
                  : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/10'
            }`}
            title="미식 소스 필터"
          >
            <SlidersHorizontal size={14} strokeWidth={2.5} />
            {/* 필터 활성화 도트 LED 표시 */}
            {hasActiveFilters && !isFilterExpanded && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-orange-light border border-white animate-bounce" />
            )}
          </button>

          {/* 인풋 검색 트리거 영역 */}
          <div 
            className="p-2.5 bg-brand-orange text-white rounded-full shadow-md cursor-pointer hover:bg-brand-orange-light hover:scale-105 active:scale-95 transition-all flex items-center justify-center border border-brand-orange-light/15"
          >
            <Search size={14} strokeWidth={3} />
          </div>
        </div>
      </motion.div>

      {/* 부드럽게 펼쳐지는 마이크로 필터 캡슐 바 (Filter Capsule Dock) */}
      <AnimatePresence>
        {isFilterExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -10 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }}
            className="overflow-hidden w-full flex justify-center z-10"
          >
            <div className="flex gap-2 p-1.5 bg-[#0c0c0e]/75 dark:bg-[#0c0c0e]/80 backdrop-blur-2xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] rounded-full w-max max-w-full overflow-x-auto hide-scrollbar">
              {filters.map((filter) => {
                const isActive = activeSources.has(filter.id);
                const Icon = filter.icon;
                
                return (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    key={filter.id}
                    onClick={() => onToggleSource(filter.id)}
                    className={`relative px-4 py-2 rounded-full flex items-center gap-1.5 font-black text-[11px] tracking-tight transition-all duration-300 border cursor-pointer select-none whitespace-nowrap ${
                      isActive 
                        ? filter.activeClass 
                        : 'bg-white/4 border-transparent text-white/50 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <Icon size={12} strokeWidth={isActive ? 2.8 : 2} />
                    <span>{filter.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
