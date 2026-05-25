'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Trophy, X, Utensils } from 'lucide-react';
import RandomDrawModal from '../game/RandomDrawModal';
import BalanceGameModal from '../game/BalanceGameModal';
import { Restaurant } from '@/types';

interface GameFABProps {
  restaurantsInView: Restaurant[];
  onWinnerSelected: (categoryName: string) => void;
  onRandomDrawSelected: (restaurant: Restaurant) => void;
}

export default function GameFAB({ restaurantsInView, onWinnerSelected, onRandomDrawSelected }: GameFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'random' | 'balance' | null>(null);

  const handleClose = () => {
    setIsOpen(false);
    setActiveModal(null);
  };

  return (
    <>
      <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              className="flex flex-col gap-2"
            >
              <button
                onClick={() => { setActiveModal('balance'); setIsOpen(false); }}
                className="flex items-center gap-3 bg-[#0c0c0e]/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-lg border border-white/10 hover:bg-white/10 transition-colors"
              >
                <Trophy size={20} className="text-brand-orange" />
                <span className="font-bold text-sm">미식 밸런스 게임</span>
              </button>
              <button
                onClick={() => { setActiveModal('random'); setIsOpen(false); }}
                className="flex items-center gap-3 bg-[#0c0c0e]/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-lg border border-white/10 hover:bg-white/10 transition-colors"
              >
                <Dices size={20} className="text-brand-orange" />
                <span className="font-bold text-sm">내 근처 랜덤 뽑기</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,94,0,0.5)] transition-all duration-300 ${
            isOpen ? 'bg-white text-brand-orange rotate-45' : 'bg-gradient-to-tr from-brand-orange to-brand-orange-light text-white hover:scale-105'
          }`}
        >
          {isOpen ? <X size={24} /> : <Utensils size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {activeModal === 'random' && (
          <RandomDrawModal 
            onClose={handleClose} 
            restaurants={restaurantsInView}
            onSelect={onRandomDrawSelected}
          />
        )}
        {activeModal === 'balance' && (
          <BalanceGameModal 
            onClose={handleClose}
            onWinner={onWinnerSelected}
          />
        )}
      </AnimatePresence>
    </>
  );
}