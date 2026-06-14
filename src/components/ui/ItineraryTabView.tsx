'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, PlusCircle, Trash2, Edit3, Compass, MapPin } from 'lucide-react';
import { getLocalItineraries, deleteLocalItinerary } from '@/lib/supabase/itineraries';
import { Itinerary } from '@/types';

interface ItineraryTabViewProps {
  onOpenItineraryPlanner: (itinerary?: any) => void;
  onSelectTab: (tab: any) => void;
}

export default function ItineraryTabView({ onOpenItineraryPlanner, onSelectTab }: ItineraryTabViewProps) {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);

  const loadItineraries = () => {
    try {
      setItineraries(getLocalItineraries());
    } catch (e) {
      console.error('Failed to load itineraries', e);
    }
  };

  useEffect(() => {
    loadItineraries();
    // 일정이 갱신되는 다른 액션이 있을 시 동기화
    window.addEventListener('itinerariesUpdated', loadItineraries);
    return () => {
      window.removeEventListener('itinerariesUpdated', loadItineraries);
    };
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 일정을 삭제하시겠습니까?')) {
      const updated = deleteLocalItinerary(id);
      setItineraries(updated);
      window.dispatchEvent(new Event('itinerariesUpdated'));
    }
  };

  const handleActivate = (itinerary: Itinerary) => {
    window.dispatchEvent(new CustomEvent('activateItinerary', { detail: itinerary }));
    // 부모 컴포넌트에서 홈(지도) 탭으로 이동시킬 수 있도록 처리
    onSelectTab('home');
  };

  return (
    <div className="space-y-6 pb-8 text-white">
      {/* 상단 액션 및 소개 헤더 */}
      <div className="flex justify-between items-center bg-zinc-900/35 border border-zinc-800/40 rounded-2xl p-4">
        <div className="space-y-0.5">
          <h4 className="text-xs font-semibold text-zinc-400">간편한 경로 설계</h4>
          <p className="text-[11px] text-zinc-500 leading-relaxed">지도 위에 직접 미식 루트를 그리고 나만의 맛집 탐방 코스를 계획하세요.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onOpenItineraryPlanner()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-[#ff6b00] text-xs font-black text-white shadow-lg shadow-red-600/10 active:scale-[0.98] transition-transform cursor-pointer shrink-0"
        >
          <PlusCircle size={14} />
          일정 추가
        </motion.button>
      </div>

      {/* 일정 목록 영역 */}
      <div className="space-y-3">
        {itineraries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-3xl py-16 px-6 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center justify-center text-zinc-500 mb-4 shadow-inner">
              <Calendar size={22} />
            </div>
            <h5 className="text-sm font-bold text-zinc-300">계획된 일정이 없습니다</h5>
            <p className="text-[11px] text-zinc-500 mt-1.5 max-w-[200px] leading-relaxed">
              새로운 맛집 탐방 일정을 만들고 지도에 동선을 띄워 보세요!
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {itineraries.map((itinerary, index) => {
              const totalPlaces = itinerary.days.reduce((acc, d) => acc + d.items.length, 0);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={itinerary.id}
                  onClick={() => handleActivate(itinerary)}
                  className="group relative bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-900 rounded-3xl p-5 shadow-md cursor-pointer transition-all duration-300 overflow-hidden"
                >
                  {/* 카드 내부 데코용 그라데이션 라인 */}
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-[#ff6b00] opacity-80 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <h5 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-[#ff6b00] transition-colors">
                        {itinerary.title}
                      </h5>
                      <p className="text-[10.5px] text-zinc-500 font-medium">
                        {itinerary.start_date} ~ {itinerary.end_date}
                      </p>
                      
                      <div className="flex items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-400 font-extrabold bg-orange-500/10 border border-orange-500/10 px-1.5 py-0.5 rounded-md">
                          <Compass size={10} />
                          {itinerary.days.length}일 코스
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-400 font-extrabold bg-sky-500/10 border border-sky-500/10 px-1.5 py-0.5 rounded-md">
                          <MapPin size={10} />
                          장소 {totalPlaces}곳
                        </span>
                      </div>
                      
                      {/* 태그 표시 */}
                      {(itinerary.companion || itinerary.theme) && (
                        <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                          {itinerary.companion && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                              {itinerary.companion}
                            </span>
                          )}
                          {itinerary.theme && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/10">
                              {itinerary.theme}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenItineraryPlanner(itinerary);
                        }}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700/50 transition-colors cursor-pointer"
                        title="수정"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(itinerary.id, e)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
