'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Award, Flame, Star, ClipboardList, PlusCircle, CheckCircle, Clock, XCircle, ChevronRight, Calendar, Dices, Trash2 } from 'lucide-react';

interface MyPageViewProps {
  onOpenSubmission: () => void;
  onOpenItineraryPlanner: (itinerary?: any) => void;
  user: { name: string; email: string; provider: 'kakao' | 'google' | 'naver'; avatarUrl?: string } | null;
  onLogout: () => void;
  onTriggerLogin: () => void;
}

interface SubmittedRestaurant {
  id: string;
  name: string;
  address: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

import { getLocalItineraries, deleteLocalItinerary } from '@/lib/supabase/itineraries';
import { Itinerary } from '@/types';

export default function MyPageView({ onOpenSubmission, onOpenItineraryPlanner, user, onLogout, onTriggerLogin }: MyPageViewProps) {
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [submissions, setSubmissions] = useState<SubmittedRestaurant[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  
  // 로컬 정보 동기화
  const loadLocalData = () => {
    try {
      // 즐겨찾기 개수
      const savedFavorites = localStorage.getItem('favorite_restaurants');
      if (savedFavorites) {
        setFavoriteCount(JSON.parse(savedFavorites).length);
      } else {
        setFavoriteCount(0);
      }

      // 제보 내역
      const savedSubmissions = localStorage.getItem('user_submissions_history');
      if (savedSubmissions) {
        setSubmissions(JSON.parse(savedSubmissions));
      } else {
        const demoSubmissions: SubmittedRestaurant[] = [
          {
            id: 'demo-1',
            name: '몽탄',
            address: '서울 용산구 백범로99길 50',
            date: '2026-05-23',
            status: 'approved'
          }
        ];
        localStorage.setItem('user_submissions_history', JSON.stringify(demoSubmissions));
        setSubmissions(demoSubmissions);
      }

      // 내 미식 일정 로드
      setItineraries(getLocalItineraries());
    } catch (e) {
      console.error('Failed to load mypage data', e);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      loadLocalData();

      // 즐겨찾기 및 일정 업데이트 이벤트 리스너 추가
      window.addEventListener('favoritesUpdated', loadLocalData);
      window.addEventListener('refresh-restaurants', loadLocalData);
      window.addEventListener('itinerariesUpdated', loadLocalData);

      return () => {
        window.removeEventListener('favoritesUpdated', loadLocalData);
        window.removeEventListener('refresh-restaurants', loadLocalData);
        window.removeEventListener('itinerariesUpdated', loadLocalData);
      };
    }
  }, []);

  const handleDeleteItinerary = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 일정을 삭제하시겠습니까?')) {
      const updated = deleteLocalItinerary(id);
      setItineraries(updated);
      window.dispatchEvent(new Event('itinerariesUpdated'));
    }
  };

  // 미식가 등급 칭호 산출
  const getGourmetTier = (contributionCount: number) => {
    if (contributionCount >= 10) return { title: '전설의 미식 신선', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30' };
    if (contributionCount >= 5) return { title: '일류 미식가', color: 'text-rose-400', bg: 'bg-rose-400/10 border-rose-400/30' };
    if (contributionCount >= 2) return { title: '동네 맛집 탐험가', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
    return { title: '새내기 미식 가이드', color: 'text-zinc-400', bg: 'bg-zinc-800 border-zinc-700' };
  };

  const contributionScore = favoriteCount + submissions.length * 2;
  const tier = getGourmetTier(contributionScore);

  const getStatusBadge = (status: SubmittedRestaurant['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <CheckCircle size={10} />
            합격
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
            <XCircle size={10} />
            탈락
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
            <Clock size={10} />
            심사중
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. 미식가 프로필 요약 카드 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 shadow-xl flex flex-col gap-4"
      >
        {user ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {user.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  alt={user.name} 
                  className="w-14 h-14 rounded-2xl object-cover shadow-lg border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-red-500/20 shrink-0">
                  <User size={28} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  {user.provider} MEMBER
                </p>
                <h3 className="text-base font-black text-white tracking-tight mt-0.5 truncate">
                  {user.name}
                </h3>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border ${tier.bg} ${tier.color}`}>
                  <Award size={10} />
                  {tier.title}
                </span>
              </div>
            </div>
            
            <button 
              onClick={onLogout}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 font-bold hover:text-red-400 hover:border-red-500/30 transition-colors shrink-0"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/60 border border-white/5 flex items-center justify-center text-zinc-400 mb-3 shadow-inner">
              <User size={22} />
            </div>
            <h4 className="text-sm font-bold text-zinc-200">맛집 탐방을 시작해 보세요</h4>
            <p className="text-[11.5px] text-zinc-500 mt-1 max-w-[240px] leading-relaxed">
              SNS 계정으로 3초 만에 로그인하고 나만의 인생 맛집을 제보해 보세요!
            </p>
            <button 
              onClick={onTriggerLogin}
              className="mt-4 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold text-xs shadow-md shadow-red-500/10 active:scale-[0.98] transition-transform"
            >
              3초 만에 시작하기
            </button>
          </div>
        )}

        {/* 미식 경험치 */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/40">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Flame size={12} className="text-brand-orange animate-pulse" />
              미식 경험치
            </span>
            <span className="font-bold text-white">{contributionScore} XP</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((contributionScore / 20) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-red-600 to-orange-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-zinc-600 font-medium">
            <span>LV.1</span>
            <span>다음 칭호까지 {Math.max(2 - contributionScore, 0)} XP 남음</span>
            <span>LV.2</span>
          </div>
        </div>

        {/* 미니 그리드 스탯 */}
        <div className="grid grid-cols-2 gap-3.5 mt-1">
          <div className="bg-zinc-950/45 border border-zinc-800/40 rounded-2xl p-3 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 font-semibold block">즐겨찾는 맛집</span>
              <span className="text-lg font-black text-white mt-0.5 block">{favoriteCount}곳</span>
            </div>
            <Star size={20} className="text-brand-orange/70 shrink-0" />
          </div>

          <div className="bg-zinc-950/45 border border-zinc-800/40 rounded-2xl p-3 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 font-semibold block">제보한 맛집</span>
              <span className="text-lg font-black text-white mt-0.5 block">{submissions.length}곳</span>
            </div>
            <ClipboardList size={20} className="text-sky-400/70 shrink-0" />
          </div>
        </div>
      </motion.div>

      {/* 2. 활동 바로가기 3분할 카드 메뉴 */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* 버튼 1: 맛집 제보하기 */}
        <motion.button
          whileHover={{ scale: 1.03, translateY: -2, boxShadow: '0 8px 24px rgba(239,68,68,0.15)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onOpenSubmission}
          className="flex flex-col items-center justify-center p-3 bg-gradient-to-b from-[#1c1c1f] to-[#121214] border border-white/5 hover:border-red-500/35 rounded-2xl text-center group cursor-pointer transition-all duration-300"
        >
          <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <PlusCircle size={16} className="text-red-500" />
          </div>
          <span className="text-[10px] font-black text-white/90 leading-none">맛집 제보</span>
          <span className="text-[8px] text-zinc-500 font-semibold mt-1 block">인생 핫플 추천</span>
        </motion.button>

        {/* 버튼 2: 일정 만들기 */}
        <motion.button
          whileHover={{ scale: 1.03, translateY: -2, boxShadow: '0 8px 24px rgba(251,146,60,0.15)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onOpenItineraryPlanner()}
          className="flex flex-col items-center justify-center p-3 bg-gradient-to-b from-[#1c1c1f] to-[#121214] border border-white/5 hover:border-orange-500/35 rounded-2xl text-center group cursor-pointer transition-all duration-300"
        >
          <div className="w-9 h-9 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Calendar size={16} className="text-orange-500" />
          </div>
          <span className="text-[10px] font-black text-white/90 leading-none">일정 만들기</span>
          <span className="text-[8px] text-zinc-500 font-semibold mt-1 block">여행 코스 계획</span>
        </motion.button>

        {/* 버튼 3: 오늘 뭐 먹지? (룰렛) */}
        <motion.button
          whileHover={{ scale: 1.03, translateY: -2, boxShadow: '0 8px 24px rgba(168,85,247,0.15)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => alert('결정장애 해결! 룰렛 돌리기 기능이 준비 중입니다.')}
          className="flex flex-col items-center justify-center p-3 bg-gradient-to-b from-[#1c1c1f] to-[#121214] border border-white/5 hover:border-purple-500/35 rounded-2xl text-center group cursor-pointer transition-all duration-300"
        >
          <div className="w-9 h-9 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Dices size={16} className="text-purple-500" />
          </div>
          <span className="text-[10px] font-black text-white/90 leading-none">오늘 뭐 먹지?</span>
          <span className="text-[8px] text-zinc-500 font-semibold mt-1 block">메뉴 추천 룰렛</span>
        </motion.button>
      </div>

      {/* 2.5 나의 여행 일정 대시보드 */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-zinc-300 px-1 flex items-center gap-1.5">
          <Calendar size={16} className="text-orange-400" />
          나의 여행 일정
        </h4>

        {itineraries.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-2xl py-10 text-center text-zinc-500 text-xs">
            아직 계획된 일정이 없습니다. 일정 만들기를 시작해 보세요!
          </div>
        ) : (
          <div className="space-y-2.5">
            {itineraries.map((itinerary) => (
              <div
                key={itinerary.id}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('activateItinerary', { detail: itinerary }));
                  // 클릭 후 홈 탭(지도 뷰)으로 이동할 수 있도록 안내 노티
                  alert(`'${itinerary.title}' 코스가 지도에 활성화되었습니다. 지도 화면에서 확인해 보세요!`);
                }}
                className="bg-zinc-900/25 hover:bg-zinc-900/40 border border-zinc-900/90 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm cursor-pointer transition-all group"
              >
                <div className="min-w-0 flex-1">
                  <h5 className="text-sm font-bold text-white truncate group-hover:text-orange-400 transition-colors">{itinerary.title}</h5>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-orange-400 font-black">
                      총 {itinerary.days.length}일 코스
                    </span>
                    <span className="text-[10px] text-zinc-500 font-semibold">
                      • 총 {itinerary.days.reduce((acc, d) => acc + d.items.length, 0)}개 장소
                    </span>
                  </div>
                  {(itinerary.companion || itinerary.theme) && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {itinerary.companion && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {itinerary.companion}
                        </span>
                      )}
                      {itinerary.theme && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/10">
                          {itinerary.theme}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenItineraryPlanner(itinerary);
                    }}
                    className="text-[10px] text-zinc-400 hover:text-white font-medium bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={(e) => handleDeleteItinerary(itinerary.id, e)}
                    className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. 내 제보 맛집 현황 (심사대시보드) */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-zinc-300 px-1 flex items-center gap-1.5">
          <ClipboardList size={16} className="text-sky-400" />
          제보 맛집 심사 현황
        </h4>

        {submissions.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-2xl py-12 text-center text-zinc-500 text-xs">
            제보된 맛집 내역이 존재하지 않습니다.
          </div>
        ) : (
          <div className="space-y-2.5">
            {submissions.map((sub, sIdx) => (
              <div
                key={sub.id}
                className="bg-zinc-900/25 border border-zinc-900/90 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-bold text-white truncate">{sub.name}</h5>
                    {getStatusBadge(sub.status)}
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-1">{sub.address}</p>
                  <p className="text-[10px] text-zinc-600 font-medium mt-1">제보일: {sub.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

