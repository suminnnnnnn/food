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
    // 카드 클릭 시 다이렉트로 편집 플래너 진입
    onOpenItineraryPlanner(itinerary);
  };

  return (
    <div className="space-y-5 pb-8 text-slate-700">
      {/* 상단 액션 및 소개 헤더 */}
      <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="space-y-0.5">
          <h4 className="text-sm font-black text-slate-700">간편한 경로 설계</h4>
          <p className="text-[13px] text-slate-500 leading-relaxed">지도 위에 직접 미식 루트를 그리고 나만의 맛집 코스를 계획하세요.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onOpenItineraryPlanner()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-red-500 to-[#ff6f00] text-sm font-black text-white shadow-md shadow-orange-500/10 active:scale-[0.98] transition-transform cursor-pointer shrink-0"
        >
          <PlusCircle size={13} />
          일정 추가
        </motion.button>
      </div>

      {/* 일정 목록 영역 */}
      <div className="space-y-3">
        {itineraries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-3xl py-12 px-6 text-center bg-slate-50/50"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
              <Calendar size={18} />
            </div>
            <h5 className="text-sm font-black text-slate-700">계획된 일정이 없습니다</h5>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px] leading-relaxed">
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
                  className="group relative bg-slate-50/55 hover:bg-slate-100/70 border border-slate-200/60 rounded-2xl p-4 shadow-sm cursor-pointer transition-all duration-300 overflow-hidden"
                >
                  {/* 카드 내부 데코용 그라데이션 라인 */}
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-[#ff6b00] opacity-80 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <h5 className="text-[14px] font-black text-slate-800 tracking-tight truncate group-hover:text-orange-600 transition-colors">
                        {itinerary.title}
                      </h5>
                      <p className="text-xs text-slate-400 font-bold">
                        {itinerary.start_date} ~ {itinerary.end_date}
                      </p>
                      
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="inline-flex items-center gap-0.5 text-[11.5px] text-orange-600 font-extrabold bg-orange-50 border border-orange-100/55 px-1.5 py-0.5 rounded">
                          <Compass size={9} />
                          {itinerary.days.length}일 코스
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[11.5px] text-sky-600 font-extrabold bg-sky-50 border border-sky-100/55 px-1.5 py-0.5 rounded">
                          <MapPin size={9} />
                          장소 {totalPlaces}곳
                        </span>
                      </div>
                      
                      {/* 태그 표시 */}
                      {(itinerary.companion || itinerary.theme) && (
                        <div className="flex items-center gap-1 pt-1 flex-wrap">
                          {itinerary.companion && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200/55">
                              {itinerary.companion}
                            </span>
                          )}
                          {itinerary.theme && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100/55">
                              {itinerary.theme}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-1 shrink-0 relative z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenItineraryPlanner(itinerary);
                        }}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                        title="수정"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(itinerary.id, e)}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-500 border border-red-100 text-red-500 hover:text-white transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 size={11} />
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
