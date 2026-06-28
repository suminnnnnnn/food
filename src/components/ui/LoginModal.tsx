'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { name: string; email: string; provider: 'kakao' | 'google' | 'naver'; avatarUrl?: string }) => void;
}

const PROVIDERS = [
  {
    id: 'kakao' as const,
    label: '카카오로 계속하기',
    color: '#FEE500',
    textColor: '#191919',
    borderColor: 'rgba(254,229,0,0.25)',
    logo: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#191919">
        <path d="M12 3c-5.523 0-10 3.582-10 8c0 2.915 1.91 5.467 4.79 6.853l-1.2 4.41c-.11.41.36.75.72.51l5.22-3.48c.15.01.31.02.47.02 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
      </svg>
    ),
    bg: 'bg-[#FEE500] hover:bg-[#FFE824]',
    shadow: 'shadow-[0_4px_16px_rgba(254,229,0,0.20)]',
    spinBorder: 'border-[#191919]',
    dark: false,
  },
  {
    id: 'naver' as const,
    label: '네이버로 계속하기',
    color: '#03C75A',
    textColor: '#ffffff',
    borderColor: 'rgba(3,199,90,0.25)',
    logo: (
      <span className="text-white font-black text-lg leading-none shrink-0" style={{ fontFamily: 'sans-serif' }}>N</span>
    ),
    bg: 'bg-[#03C75A] hover:bg-[#04D460]',
    shadow: 'shadow-[0_4px_16px_rgba(3,199,90,0.18)]',
    spinBorder: 'border-white',
    dark: false,
  },
  {
    id: 'google' as const,
    label: 'Google로 계속하기',
    color: '#ffffff',
    textColor: '#1f2937',
    borderColor: 'rgba(0,0,0,0.12)',
    logo: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg>
    ),
    bg: 'bg-white hover:bg-gray-50',
    shadow: 'shadow-[0_4px_16px_rgba(0,0,0,0.08)]',
    spinBorder: 'border-gray-800',
    dark: false,
  },
] as const;

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [loadingProvider, setLoadingProvider] = useState<'kakao' | 'google' | 'naver' | null>(null);

  const handleSocialLogin = (provider: 'kakao' | 'google' | 'naver') => {
    setLoadingProvider(provider);
    setTimeout(() => {
      const mockUsers = {
        kakao: { name: '맛잘알 카카오', email: 'kakao_user@kakao.com', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' },
        google: { name: '구글 마스터 맛집러', email: 'google_user@gmail.com', avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150' },
        naver: { name: '네이버 미식전문가', email: 'naver_user@naver.com', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
      };
      setLoadingProvider(null);
      onLoginSuccess({ ...mockUsers[provider], provider });
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
          {/* 배경 오버레이 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* 모달 본체 */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className="relative w-full sm:max-w-[400px] bg-white sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.18)]"
          >
            {/* 상단 브랜드 그라데이션 헤더 */}
            <div className="relative bg-gradient-to-br from-red-500 via-orange-500 to-amber-400 px-6 pt-8 pb-10 text-center overflow-hidden">
              {/* 배경 패턴 */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 left-8 w-20 h-20 bg-white rounded-full blur-2xl" />
                <div className="absolute bottom-0 right-4 w-28 h-28 bg-white rounded-full blur-3xl" />
              </div>

              {/* 닫기 버튼 */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X size={16} />
              </button>

              {/* 브랜드 아이콘 */}
              <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 mb-4">
                <MapPin size={26} className="text-white fill-white/30" />
              </div>

              <h2 className="text-xl font-extrabold text-white tracking-tight">
                모두의 맛집
              </h2>
              <p className="text-sm text-white/80 mt-1 font-medium">
                로그인하고 모든 기능을 이용하세요
              </p>
            </div>

            {/* 소셜 버튼 영역 */}
            <div className="px-6 pt-5 pb-6 bg-white flex flex-col gap-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  disabled={loadingProvider !== null}
                  onClick={() => handleSocialLogin(p.id)}
                  className={`w-full h-[52px] rounded-2xl ${p.bg} ${p.shadow} flex items-center justify-center gap-3 font-semibold text-[15px] transition-all active:scale-[0.98] disabled:opacity-60 border`}
                  style={{ color: p.textColor, borderColor: p.borderColor }}
                >
                  {loadingProvider === p.id ? (
                    <div className={`w-5 h-5 border-2 ${p.spinBorder} border-t-transparent rounded-full animate-spin`} />
                  ) : (
                    <>
                      {p.logo}
                      <span>{p.label}</span>
                    </>
                  )}
                </button>
              ))}

              <p className="text-center text-[11px] text-slate-400 mt-1 leading-relaxed">
                계속하면{' '}
                <span className="underline underline-offset-2 cursor-pointer hover:text-slate-600">이용약관</span>
                {' '}및{' '}
                <span className="underline underline-offset-2 cursor-pointer hover:text-slate-600">개인정보처리방침</span>
                에 동의하는 것으로 간주됩니다.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
