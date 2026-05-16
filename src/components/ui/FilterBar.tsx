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
  { id: 'youtube', label: '유튜브 핫플', icon: Play, activeClass: 'bg-red-50 border-red-500 text-red-600 shadow-sm' },
  { id: 'netflix_chef', label: '흑백요리사', icon: ChefHat, activeClass: 'bg-gray-100 border-gray-900 text-gray-900 shadow-sm' },
  { id: 'michelin', label: '미쉐린', icon: MichelinIcon, activeClass: 'bg-red-50 border-red-700 text-red-700 shadow-sm' },
  { id: 'blueribbon', label: '블루리본', icon: BlueRibbonIcon, activeClass: 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm' },
];

interface FilterBarProps {
  activeSources: Set<ContentSource | string>;
  onToggle: (source: ContentSource | string) => void;
}

export default function FilterBar({ activeSources, onToggle }: FilterBarProps) {
  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-2xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex gap-2.5 p-1.5 bg-white/70 backdrop-blur-xl border border-white/40 shadow-md rounded-full w-max mx-auto"
      >
        {filters.map((filter) => {
          const isActive = activeSources.has(filter.id);
          const Icon = filter.icon;
          
          return (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={filter.id}
              onClick={() => onToggle(filter.id)}
              className={`relative px-4 py-2.5 rounded-full flex items-center gap-1.5 font-bold text-[13px] tracking-tight transition-all duration-300 border border-transparent ${
                isActive ? filter.activeClass : 'bg-white/60 text-gray-500 hover:bg-white/90'
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              {filter.label}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
