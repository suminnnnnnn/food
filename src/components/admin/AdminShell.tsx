'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ── 관리자 공용 컨텍스트 (시크릿 + 인증 fetch) ──────────────────────
type AdminCtx = {
  secret: string;
  setSecret: (s: string) => void;
  adminFetch: (input: string, init?: RequestInit) => Promise<Response>;
};
const Ctx = createContext<AdminCtx | null>(null);

export const useAdmin = (): AdminCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdmin은 <AdminShell> 안에서만 사용할 수 있습니다');
  return c;
};

const NAV = [
  { href: '/admin', label: '대시보드', icon: '📊' },
  { href: '/admin/mealkits', label: '밀키트 검수', icon: '🍱' },
  { href: '/admin/submissions', label: '제보 검수', icon: '📝' },
  { href: '/admin/restaurants', label: '맛집 관리', icon: '📍' },
  { href: '/admin/videos', label: '영상·채널', icon: '🎬' },
  { href: '/admin/ops', label: '운영 도구', icon: '🛠️' },
  { href: '/admin/affiliate', label: '제휴 통계', icon: '💰' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [secret, setSecretState] = useState('');

  useEffect(() => {
    setSecretState(localStorage.getItem('admin_secret') || '');
  }, []);

  const setSecret = useCallback((s: string) => {
    setSecretState(s);
    localStorage.setItem('admin_secret', s);
  }, []);

  const adminFetch = useCallback((input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const s = typeof window !== 'undefined' ? localStorage.getItem('admin_secret') || '' : '';
    if (s) headers.set('x-admin-secret', s);
    return fetch(input, { ...init, headers });
  }, []);

  return (
    <Ctx.Provider value={{ secret, setSecret, adminFetch }}>
      <div className="min-h-screen bg-slate-50 text-slate-800 md:flex">
        {/* 사이드바 (모바일: 상단 가로 내비) */}
        <aside className="md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-slate-200 bg-white flex md:flex-col">
          <div className="p-4 md:p-5 shrink-0">
            <Link href="/admin" className="font-black tracking-tight text-[15px]">
              모두의맛집 <span style={{ color: '#FF6F00' }}>admin</span>
            </Link>
          </div>

          <nav className="flex md:flex-col gap-1 px-2 md:px-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {NAV.map((n) => {
              const active = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-colors ${
                    active ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span aria-hidden>{n.icon}</span>
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* 시크릿 입력 (데스크톱 사이드바 하단) */}
          <div className="mt-auto p-3 md:p-4 hidden md:block">
            <label className="text-[11px] font-bold text-slate-400">ADMIN_SECRET</label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="미설정 시 비워두기"
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-orange-400"
            />
          </div>
        </aside>

        {/* 본문 */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </Ctx.Provider>
  );
}
