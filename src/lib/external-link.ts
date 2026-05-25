/**
 * 외부 링크 어댑터
 *
 * AIT WebView에서는 window.open이 금지되어 있고, 브라우저 환경(SEO용 일반 웹)에서는
 * 정상 동작해야 하기 때문에 환경 분기 어댑터를 둡니다.
 *
 * 사용 위치:
 *  - 식당 상세 페이지의 쿠팡파트너스 상품 클릭
 *  - 외부 매체(미쉐린/블루리본 공식 페이지) 링크 클릭
 *  - 유튜브 채널 페이지 점프
 *
 * 사용법:
 *  import { openExternal } from '@/lib/external-link';
 *  await openExternal('https://example.com', { reason: 'affiliate_click' });
 */

// AIT 환경 감지: web-framework가 주입하는 전역 또는 user-agent로 판별
function isInAIT(): boolean {
  if (typeof window === 'undefined') return false;
  // AIT SDK가 런타임에 주입하는 전역 객체로 판별 (정확한 키는 SDK 버전에 따라 다름)
  // 우선 user-agent 기반 fallback도 함께 둠
  const ua = window.navigator.userAgent || '';
  return (
    /toss/i.test(ua) ||
    // @ts-expect-error: AIT SDK가 주입할 수 있는 전역
    typeof window.AppsInToss !== 'undefined'
  );
}

interface OpenOptions {
  /** 분석/로깅용 사유 식별자 (예: 'affiliate_click', 'creator_youtube') */
  reason?: string;
}

/**
 * 외부 URL을 환경에 맞는 방식으로 열기.
 * - AIT WebView: AIT 제공 브라우저 API (출시 시 정확한 함수명으로 교체 필요)
 * - 일반 웹: window.open(url, '_blank', 'noopener,noreferrer')
 *
 * [TODO] AIT SDK 정확한 함수명 확정 후 교체:
 *   - 가능성 1: import { openBrowser } from '@apps-in-toss/web-framework'
 *   - 가능성 2: AppsInToss.openExternalBrowser(url)
 *   현재는 안전한 fallback으로 location.href 사용.
 */
export async function openExternal(
  url: string,
  options: OpenOptions = {}
): Promise<void> {
  if (!url || typeof url !== 'string') return;

  // 분석 이벤트 (선택)
  if (options.reason) {
    try {
      // [선택] /api/affiliate/events 등으로 비동기 보고
      // fetch('/api/events/external-link', { method: 'POST', body: JSON.stringify({ url, reason: options.reason }) });
    } catch (_) {
      // 무시
    }
  }

  if (isInAIT()) {
    // AIT WebView 환경 (Toss 인앱 브라우저 호환을 위한 폴백)
    window.location.href = url;
  } else {
    // 일반 웹 브라우저 환경
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      // 팝업 차단 시 fallback
      window.location.href = url;
    }
  }
}

/**
 * 유튜브 영상을 등장 시점(t=)으로 점프해 여는 헬퍼.
 * 식당 상세 페이지의 영상 카드에서 사용.
 */
export function openYouTubeAt(videoId: string, appearanceSec?: number) {
  const base = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const url = appearanceSec ? `${base}&t=${Math.floor(appearanceSec)}` : base;
  return openExternal(url, { reason: 'youtube_jump' });
}
