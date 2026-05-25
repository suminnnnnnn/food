'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, ChevronRight, Sparkles } from 'lucide-react';
import { FOOD_CATEGORIES, FoodCategory } from '@/lib/constants/foodCategories';

interface BalanceGameModalProps {
  onClose: () => void;
  onWinner: (category: string) => void;
}

export default function BalanceGameModal({ onClose, onWinner }: BalanceGameModalProps) {
  const [step, setStep] = useState<'setup' | 'playing' | 'result'>('setup');
  const [totalRounds, setTotalRounds] = useState<number>(16);
  const [candidates, setCandidates] = useState<FoodCategory[]>([]);
  const [nextRoundCandidates, setNextRoundCandidates] = useState<FoodCategory[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [winner, setWinner] = useState<FoodCategory | null>(null);
  const [currentRoundName, setCurrentRoundName] = useState<string>('');

  useEffect(() => {
    if (step === 'playing') {
      const remainingCount = candidates.length;
      if (remainingCount === 2) {
        setCurrentRoundName('결승전');
      } else {
        setCurrentRoundName(`${remainingCount}강전 (${Math.floor(currentIndex / 2) + 1}/${Math.floor(remainingCount / 2)})`);
      }
    }
  }, [step, candidates.length, currentIndex]);

  const startGame = (rounds: number) => {
    setTotalRounds(rounds);
    // 셔플 후 라운드 수 만큼 선택
    const shuffled = [...FOOD_CATEGORIES].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, rounds);
    setCandidates(selected);
    setNextRoundCandidates([]);
    setCurrentIndex(0);
    setStep('playing');
  };

  const handleSelect = (selectedWinner: FoodCategory) => {
    const updatedNextRound = [...nextRoundCandidates, selectedWinner];
    
    if (currentIndex + 2 >= candidates.length) {
      // 해당 라운드 종료
      if (updatedNextRound.length === 1) {
        // 최종 우승
        setWinner(updatedNextRound[0]);
        setStep('result');
      } else {
        // 다음 라운드 진행
        setCandidates(updatedNextRound);
        setNextRoundCandidates([]);
        setCurrentIndex(0);
      }
    } else {
      // 현재 라운드 다음 매치
      setNextRoundCandidates(updatedNextRound);
      setCurrentIndex(currentIndex + 2);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <AnimatePresence mode="wait">
        {step === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[#1c1c1e] w-full max-w-md rounded-[32px] shadow-[0_20px_50px_rgba(251,146,60,0.15)] overflow-hidden border border-white/10 p-8 text-center"
          >
            <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <div className="w-16 h-16 bg-brand-orange/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-orange/20">
              <Trophy className="text-brand-orange w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">미식 밸런스 게임</h2>
            <p className="text-white/60 text-sm mb-8 leading-relaxed">오늘 뭐 먹을지 결정 장애가 왔나요?<br />이상형 월드컵으로 완벽한 메뉴를 골라드릴게요!</p>
            <div className="flex flex-col gap-3">
              {[16, 8, 4].map((rounds) => (
                <button
                  key={rounds}
                  onClick={() => startGame(rounds)}
                  className="w-full py-4 rounded-2xl bg-white/5 hover:bg-brand-orange/10 border border-white/10 hover:border-brand-orange/30 text-white font-bold transition-all flex items-center justify-between px-6 group"
                >
                  <span>{rounds}강으로 시작하기</span>
                  <ChevronRight size={18} className="text-white/30 group-hover:text-brand-orange group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'playing' && candidates.length >= 2 && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl"
          >
            <div className="text-center mb-6">
              <span className="px-4 py-1.5 rounded-full bg-brand-orange/10 text-brand-orange text-xs font-black tracking-widest border border-brand-orange/20">
                {currentRoundName}
              </span>
              <h3 className="text-xl font-bold text-white/40 mt-3">오늘 점심 최고의 선택은?</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[candidates[currentIndex], candidates[currentIndex + 1]].map((item, idx) => (
                item && (
                  <motion.button
                    key={item.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(item)}
                    className="relative aspect-[4/3] md:aspect-square bg-gradient-to-b from-white/5 to-white/[0.02] hover:from-brand-orange/10 hover:to-brand-orange/[0.02] border border-white/10 hover:border-brand-orange/40 rounded-[32px] p-8 flex flex-col items-center justify-center gap-6 group overflow-hidden shadow-2xl transition-all animate-none"
                  >
                    <div className="absolute inset-0 bg-brand-orange/5 opacity-0 group-hover:opacity-100 transition-opacity blur-2xl" />
                    <span className="text-7xl md:text-8xl filter drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                      {item.emoji}
                    </span>
                    <span className="text-2xl md:text-3xl font-black text-white group-hover:text-brand-orange transition-colors">
                      {item.name}
                    </span>
                    <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                      {item.keywords.map((kw) => (
                        <span key={kw} className="text-xs bg-white/5 text-white/40 px-3 py-1 rounded-full group-hover:bg-brand-orange/5 group-hover:text-brand-orange/60 transition-colors">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </motion.button>
                )
              ))}
            </div>
          </motion.div>
        )}

        {step === 'result' && winner && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[#1c1c1e] w-full max-w-md rounded-[32px] shadow-[0_20px_50px_rgba(251,146,60,0.2)] overflow-hidden border border-brand-orange/30 p-8 text-center relative animate-none"
          >
            <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
              <X size={24} />
            </button>

            <div className="w-20 h-20 bg-brand-orange/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-orange/30 relative">
              <Sparkles className="text-brand-orange w-10 h-10 animate-pulse" />
              <div className="absolute inset-0 bg-brand-orange/10 blur-xl rounded-full animate-ping" />
            </div>

            <span className="text-xs font-black tracking-widest text-brand-orange uppercase bg-brand-orange/10 px-4 py-1.5 rounded-full border border-brand-orange/20">
              최종 우승 메뉴 탄생!
            </span>

            <div className="my-8">
              <span className="text-8xl block mb-4 filter drop-shadow-xl animate-bounce">
                {winner.emoji}
              </span>
              <h2 className="text-4xl font-black text-white tracking-tight">
                {winner.name}
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => onWinner(winner.name)}
                className="w-full py-4 rounded-2xl bg-brand-orange text-white font-black hover:bg-brand-orange/90 shadow-lg shadow-brand-orange/30 transition-all flex items-center justify-center gap-2 group"
              >
                <span>이 메뉴로 주변 맛집 찾기</span>
                <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => setStep('setup')}
                className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold transition-all border border-white/5"
              >
                다시 하기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}