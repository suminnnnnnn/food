'use client';

/**
 * GlobalErrorHandler
 *
 * AIT WebView가 흰 화면이 되는 사고를 추적하는 최상단 에러 캐처입니다.
 * Place 프로토타입의 검증된 패턴을 계승하되, AIT WebView 환경에서
 * 더 강하게 동작하도록 확장합니다.
 *
 * - window.onerror: 동기 JS 에러
 * - unhandledrejection: Promise reject 미처리
 * - React Error Boundary: 렌더링 단계 에러 (children 트리)
 *
 * 에러는 다음으로 전송:
 *  1. Supabase 'error_logs' 테이블 insert (선택)
 *  2. Sentry 등 외부 모니터링 (선택, 환경변수로 토글)
 *  3. 콘솔 (개발 환경)
 *
 * 사용법: app/layout.tsx 최상단에서 children 전체를 감싸기.
 */

import React from 'react';

interface ErrorPayload {
  type: 'error' | 'unhandledrejection' | 'react';
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp: number;
}

async function reportError(payload: ErrorPayload) {
  // 1. 콘솔 (항상)
  console.error('[GlobalErrorHandler]', payload);

  // 2. 서버 보고 (실패해도 무시)
  try {
    await fetch('/api/internal/error-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (_) {
    // 무시
  }
}

interface State {
  hasError: boolean;
  errorMessage?: string;
}

export class GlobalErrorHandler extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError({
      type: 'react',
      message: error.message,
      stack: error.stack + '\n' + (info.componentStack ?? ''),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: Date.now(),
    });
  }

  componentDidMount() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  componentWillUnmount() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('error', this.onError);
    window.removeEventListener('unhandledrejection', this.onRejection);
  }

  private onError = (e: ErrorEvent) => {
    reportError({
      type: 'error',
      message: e.message,
      stack: e.error?.stack,
      url: e.filename,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    });
  };

  private onRejection = (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    reportError({
      type: 'unhandledrejection',
      message:
        typeof reason === 'string'
          ? reason
          : reason?.message ?? JSON.stringify(reason),
      stack: reason?.stack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    });
  };

  private reset = () => this.setState({ hasError: false, errorMessage: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <h1 className="text-lg font-semibold mb-2">잠시 문제가 생겼어요</h1>
          <p className="text-sm text-gray-500 mb-6">
            화면을 다시 불러올게요. 같은 문제가 반복되면 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={() => {
              this.reset();
              if (typeof window !== 'undefined') window.location.reload();
            }}
            className="px-4 py-2 bg-[#FF6B35] text-white rounded-md text-sm"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
