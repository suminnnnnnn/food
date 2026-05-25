'use client';

import { ContentSource } from '@/types';
import { motion } from 'framer-motion';
import { ChefHat, Play } from 'lucide-react';
import { MichelinIcon, BlueRibbonIcon } from '@/components/icons/CustomIcons';

interface FilterOption {
  id: ContentSource | string;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}

const filters: FilterOption[] = [
  { id: 'youtube', label: '유튜브 핫플', icon: Play, activeClass: 'bg-red-50 border-red-500 text-red-600 dark:bg-red-950/50 dark:border-red-500/50 dark:text-red-400 shadow-[0_2px_12px_rgba(239,68,68,0.15)]' },
  { id: 'netflix_chef', label: '흑백요리사', icon: ChefHat, activeClass: 'bg-gray-100 border-gray-900 text-gray-900 dark:bg-brand-gray/80 dark:border-white/20 dark:text-white shadow-[0_2px_12px_rgba(255,255,255,0.15)]' },
  { id: 'michelin', label: '미쉐린', icon: MichelinIcon, activeClass: 'bg-red-50 border-red-700 text-red-700 dark:bg-red-950/50 dark:border-red-700/50 dark:text-red-400 shadow-[0_2px_12px_rgba(220,38,38,0.15)]' },
  { id: 'blueribbon', label: '블루리본', icon: BlueRibbonIcon, activeClass: 'bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-950/50 dark:border-blue-600/50 dark:text-blue-400 shadow-[0_2px_12px_rgba(37,99,235,0.15)]' },
];

interface FilterBarProps {
  activeSources: Set<ContentSource | string>;
  onToggle: (source: ContentSource | string) => void;
  className?: string;
}

export default function FilterBar({ activeSources, onToggle, className }: FilterBarProps) {
  return (
    <div className={className || "absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-2xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"}>
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex gap-2.5 p-1.5 bg-brand-charcoal/70 dark:bg-brand-charcoal/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-full w-max mx-auto"
      >
        {filters.map((filter) => {
          const isActive = activeSources.has(filter.id);
          const Icon = filter.icon;
          
          return (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={filter.id}
              onClick={() => onToggle(filter.id)}
              className={`relative px-4 py-2.5 rounded-full flex items-center gap-1.5 font-bold text-[13px] tracking-tight transition-all duration-300 border border-transparent cursor-pointer ${
                isActive ? filter.activeClass : 'bg-white/5 dark:bg-white/5 text-white/50 dark:text-white/60 hover:bg-white/10 dark:hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
              <span className={isActive ? 'font-bold' : 'font-semibold text-white/60'}>
                {filter.label}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
