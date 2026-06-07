'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Sparkles, Navigation, RotateCcw } from 'lucide-react';
import { Restaurant } from '@/types';

interface RandomDrawModalProps {
  onClose: () => void;
  restaurants: Restaurant[];
  onSelect: (restaurant: Restaurant) => void;
}

export default function RandomDrawModal({ onClose, restaurants, onSelect }: RandomDrawModalProps) {
  const [isDrawing, setIsDrawing] = useState(true);
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const [tempName, setTempName] = useState<string>('어디로 갈까요?');

  const handleDraw = () => {
    if (restaurants.length === 0) {
      setIsDrawing(false);
      setTempName('주변에 식당이 없습니다.');
      return;
    }

    setIsDrawing(true);
    setWinner(null);

    // 슬롯머신 셔플 감속 효과 시뮬레이션
    let count = 0;
    const totalTicks = 25; // 셔플이 일어날 총 횟수
    let speed = 50; // 초기 셔플 속도 (ms)

    const shuffle = () => {
      count++;
      const randIdx = Math.floor(Math.random() * restaurants.length);
      setTempName(restaurants[randIdx].name);

      if (count < totalTicks) {
        // 뒤로 갈수록 셔플 속도를 늦춰 긴장감 유발
        if (count > totalTicks * 0.8) {
          speed += 80;
        } else if (count > totalTicks * 0.5) {
          speed += 30;
        }
        setTimeout(shuffle, speed);
      } else {
        // 최종 당첨자 결정
        const finalWinner = restaurants[Math.floor(Math.random() * restaurants.length)];
        setWinner(finalWinner);
        setIsDrawing(false);
      }
    };

    setTimeout(shuffle, speed);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-[#1c1c1e] w-full max-w-sm rounded-[32px] shadow-[0_20px_50px_rgba(251,146,60,0.15)] overflow-hidden border border-white/10"
      >
        <div className="relative p-8 text-center">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>

          <h2 className="text-2xl font-black text-white mt-4 mb-1">내 근처 랜덤 뽑기</h2>
          <p className="text-white/40 text-xs mb-8">
            현재 지도에 보이는 {restaurants.length}개의 식당 중 오늘 최고의 맛집을 골라드릴게요!
          </p>

          {/* 룰렛 화면 */}
          <div className="relative h-44 flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-[24px] overflow-hidden mb-8 shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/5 to-transparent blur-xl pointer-events-none" />
            
            <AnimatePresence mode="wait">
              {isDrawing ? (
                <motion.div
                  key="drawing"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.08 }}
                  className="flex flex-col items-center gap-3 px-4"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-brand-orange animate-spin" />
                  <span className="text-xl font-black text-brand-orange truncate max-w-[240px]">
                    {tempName}
                  </span>
                </motion.div>
              ) : (
                winner && (
                  <motion.div
                    key="winner"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center px-4"
                  >
                    <div className="w-10 h-10 bg-brand-orange/10 rounded-full flex items-center justify-center mb-3 border border-brand-orange/20 animate-bounce">
                      <Sparkles size={20} className="text-brand-orange" />
                    </div>
                    <span className="text-sm font-bold text-white/50 mb-1">오늘의 메뉴 결정!</span>
                    <span className="text-2xl font-black text-white truncate max-w-[280px]">
                      {winner.name}
                    </span>
                    <span className="text-xs text-brand-orange font-medium mt-1 bg-brand-orange/5 px-2.5 py-0.5 rounded-full border border-brand-orange/10">
                      {winner.category?.split('>').pop()?.trim() || '맛집'}
                    </span>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>

          {/* 하단 액션 버튼 */}
          {!isDrawing && winner && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => onSelect(winner)}
                className="w-full py-4 rounded-2xl bg-brand-orange text-white font-black hover:bg-brand-orange/90 shadow-lg shadow-brand-orange/20 transition-all flex items-center justify-center gap-2"
              >
                <Navigation size={18} />
                <span>선택한 식당 정보 보기</span>
              </button>
              <button
                onClick={handleDraw}
                className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold transition-all border border-white/5 flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>다시 돌리기</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}