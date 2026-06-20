'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { name: string; email: string; provider: 'kakao' | 'google' | 'naver'; avatarUrl?: string }) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [loadingProvider, setLoadingProvider] = useState<'kakao' | 'google' | 'naver' | null>(null);

  const handleSocialLogin = (provider: 'kakao' | 'google' | 'naver') => {
    setLoadingProvider(provider);
    
    // 부드러운 로딩 효과 후 가상 로그인 처리 (1.2초)
    setTimeout(() => {
      let mockUser = {
        name: '',
        email: '',
        provider,
        avatarUrl: ''
      };

      if (provider === 'kakao') {
        mockUser = {
          name: '맛잘알 카카오',
          email: 'kakao_user@kakao.com',
          provider,
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
        };
      } else if (provider === 'google') {
        mockUser = {
          name: '구글 마스터 맛집러',
          email: 'google_user@gmail.com',
          provider,
          avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150'
        };
      } else if (provider === 'naver') {
        mockUser = {
          name: '네이버 미식전문가',
          email: 'naver_user@naver.com',
          provider,
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
        };
      }

      setLoadingProvider(null);
      onLoginSuccess(mockUser);
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* 어두운 아크릴 배경 레이어 */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* 프리미엄 글래스모피즘 모달 본체 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-[390px] rounded-3xl bg-zinc-900/90 border border-white/10 p-6.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col items-center text-center overflow-hidden"
          >
            {/* 상단 장식 그라데이션 라인 */}
            <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-yellow-400 via-emerald-400 to-blue-500" />

            {/* 닫기 버튼 */}
            <button 
              onClick={onClose}
              className="absolute top-4.5 right-4.5 text-zinc-400 hover:text-zinc-100 p-1.5 rounded-full hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 타이틀 및 브랜딩 */}
            <div className="mt-4 mb-8">
              <h2 className="text-[20px] font-black text-white tracking-tight flex items-center justify-center gap-1.5">
                모두의 맛집 <span className="text-orange-500">시작하기</span>
              </h2>
              <p className="text-[12.5px] text-zinc-400 mt-2 font-medium tracking-tight">
                로그인하고 더 많은 숨은 맛집을 발견해보세요.
              </p>
            </div>

            {/* SNS 로그인 버튼 리스트 */}
            <div className="w-full flex flex-col gap-3.5 mb-2">
              {/* 카카오 로그인 */}
              <button
                disabled={loadingProvider !== null}
                onClick={() => handleSocialLogin('kakao')}
                className="w-full h-12 rounded-2xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#191919] font-bold text-[14.5px] flex items-center justify-center gap-2.5 transition-all shadow-[0_4px_12px_rgba(254,229,0,0.15)] active:scale-[0.98]"
              >
                {loadingProvider === 'kakao' ? (
                  <div className="w-5 h-5 border-2 border-[#191919] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 3c-5.523 0-10 3.582-10 8c0 2.915 1.91 5.467 4.79 6.853l-1.2 4.41c-.11.41.36.75.72.51l5.22-3.48c.15.01.31.02.47.02 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
                    </svg>
                    <span>카카오로 계속하기</span>
                  </>
                )}
              </button>

              {/* 네이버 로그인 */}
              <button
                disabled={loadingProvider !== null}
                onClick={() => handleSocialLogin('naver')}
                className="w-full h-12 rounded-2xl bg-[#03C75A] hover:bg-[#03C75A]/90 text-white font-bold text-[14.5px] flex items-center justify-center gap-2.5 transition-all shadow-[0_4px_12px_rgba(3,199,90,0.15)] active:scale-[0.98]"
              >
                {loadingProvider === 'naver' ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="font-black text-[18px]">N</span>
                    <span>네이버로 계속하기</span>
                  </>
                )}
              </button>

              {/* 구글 로그인 */}
              <button
                disabled={loadingProvider !== null}
                onClick={() => handleSocialLogin('google')}
                className="w-full h-12 rounded-2xl bg-white hover:bg-zinc-50 text-zinc-900 font-bold text-[14.5px] flex items-center justify-center gap-2.5 transition-all shadow-[0_4px_12px_rgba(255,255,255,0.1)] border border-zinc-200 active:scale-[0.98]"
              >
                {loadingProvider === 'google' ? (
                  <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Google로 계속하기</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
