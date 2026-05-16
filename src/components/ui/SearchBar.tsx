'use client';

import { Search, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="absolute top-[88px] left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-2xl">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        className="relative flex items-center w-full"
      >
        <div className="absolute left-4 text-brand-600">
          <Sparkles size={18} />
        </div>
        <input 
          type="text" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="마늘 김치가 맛있는 국밥집 찾아줘..." 
          className="w-full bg-white/85 backdrop-blur-xl border border-white/50 shadow-md rounded-full py-3.5 pl-11 pr-12 text-sm font-semibold text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
        />
        <div className="absolute right-1.5 p-2 bg-gray-900 text-white rounded-full shadow-md cursor-pointer hover:bg-gray-800 transition-colors active:scale-95">
          <Search size={16} />
        </div>
      </motion.div>
    </div>
  );
}
