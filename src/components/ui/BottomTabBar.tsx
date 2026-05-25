'use client';

import React from 'react';
import { Home, Bookmark, User, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

export type TabType = 'home' | 'near' | 'favorites' | 'mypage';

interface BottomTabBarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export default function BottomTabBar({ activeTab, onChangeTab }: BottomTabBarProps) {
  const tabs = [
    { id: 'home' as TabType, label: '홈', icon: Home },
    { id: 'near' as TabType, label: '주변 핫플', icon: MapPin },
    { id: 'favorites' as TabType, label: '즐겨찾기', icon: Bookmark },
    { id: 'mypage' as TabType, label: '더보기', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* 탭바 메인 바디 */}
      <div className="relative border-t border-zinc-800/40 bg-zinc-950/75 backdrop-blur-xl px-4 pt-2.5 pb-[env(safe-area-inset-bottom,16px)] shadow-[0_-12px_40px_rgba(0,0,0,0.5)] flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className="relative flex flex-col items-center justify-center py-1.5 px-3 min-w-[72px] focus:outline-none select-none"
            >
              {/* 활성 원형 주황 후광 */}
              {isActive && (
                <motion.div
                  layoutId="activeTabGlow"
                  className="absolute -top-1 w-12 h-1 bg-[#ff6b00] rounded-full shadow-[0_2px_12px_rgba(255,107,0,0.8)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              {/* 아이콘 영역 */}
              <motion.div
                animate={{ scale: isActive ? 1.12 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className={`relative z-10 transition-colors duration-300 ${
                  isActive
                    ? 'text-[#ff6b00] filter drop-shadow-[0_0_6px_rgba(255,107,0,0.5)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>

              {/* 레이블 텍스트 */}
              <span
                className={`text-[10px] mt-1 font-medium transition-colors duration-300 ${
                  isActive ? 'text-white' : 'text-zinc-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
