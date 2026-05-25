'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Award, Flame, Bookmark, ClipboardList, PlusCircle, CheckCircle, Clock, XCircle, ChevronRight } from 'lucide-react';

interface MyPageViewProps {
  onOpenSubmission: () => void;
}

interface SubmittedRestaurant {
  id: string;
  name: string;
  address: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function MyPageView({ onOpenSubmission }: MyPageViewProps) {
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [submissions, setSubmissions] = useState<SubmittedRestaurant[]>([]);
  
  // 로컬 정보 동기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
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
            // 초기 데모 데이터셋 구성 (시각적 고급스러움을 위해 1개의 완료 이력을 제공하되 로컬스토리지 저장)
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
        } catch (e) {
          console.error('Failed to load mypage data', e);
        }
      };

      loadLocalData();

      // 즐겨찾기 업데이트 이벤트 리스너 추가
      window.addEventListener('favoritesUpdated', loadLocalData);
      window.addEventListener('refresh-restaurants', loadLocalData);

      return () => {
        window.removeEventListener('favoritesUpdated', loadLocalData);
        window.removeEventListener('refresh-restaurants', loadLocalData);
      };
    }
  }, []);

  // 미식가 등급 칭호 산출
  const getGourmetTier = (contributionCount: number) => {
    if (contributionCount >= 10) return { title: '전설의 미식 신선', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30' };
    if (contributionCount >= 5) return { title: '일류 미식가', color: 'text-rose-400', bg: 'bg-rose-400/10 border-rose-400/30' };
    if (contributionCount >= 2) return { title: '동네 맛집 탐험가', color: 'text-[#ff6b00]', bg: 'bg-[#ff6b00]/10 border-[#ff6b00]/30' };
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
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ff6b00] to-orange-400 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 shrink-0">
            <User size={28} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 font-medium">MODOO MATJIP MEMBER</p>
            <h3 className="text-lg font-bold text-white tracking-tight mt-0.5 flex items-center gap-1.5">
              미식 탐험가
              <span className="text-xs font-normal text-zinc-400">#기여</span>
            </h3>
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full mt-1.5 border ${tier.bg} ${tier.color}`}>
              <Award size={11} />
              {tier.title}
            </span>
          </div>
        </div>

        {/* 미식 파워 게이지 바 */}
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
              className="h-full bg-gradient-to-r from-[#ff6b00] to-orange-400 shadow-[0_0_8px_rgba(255,107,0,0.5)]"
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
            <Bookmark size={20} className="text-brand-orange/70 shrink-0" />
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

      {/* 2. 제보하기 브릿지 버튼 */}
      <motion.button
        whileHover={{ scale: 1.01, boxShadow: '0 0 20px rgba(255,107,0,0.15)' }}
        whileTap={{ scale: 0.99 }}
        onClick={onOpenSubmission}
        className="w-full py-4 px-5 bg-gradient-to-r from-[#ff6b00] to-orange-500 hover:from-[#ff7c1a] hover:to-orange-400 text-white font-bold rounded-2xl flex items-center justify-between shadow-lg shadow-orange-500/10 transition-all duration-300 group"
      >
        <div className="flex items-center gap-3">
          <PlusCircle size={22} className="group-hover:rotate-90 transition-transform duration-300" />
          <div className="text-left">
            <span className="text-sm block leading-none">나만의 맛집 제보하기</span>
            <span className="text-[10px] text-white/70 block mt-1 font-normal">유튜브 쇼츠나 가보고 싶은 핫플 제보하기</span>
          </div>
        </div>
        <ChevronRight size={18} className="text-white/80 group-hover:translate-x-1 transition-transform" />
      </motion.button>

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
