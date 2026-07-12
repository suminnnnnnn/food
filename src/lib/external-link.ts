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

interface OpenOptions {
  /** 분석/로깅용 사유 식별자 (예: 'affiliate_click', 'creator_youtube') */
  reason?: string;
  /** 제휴 클릭 로깅용 (reason이 'affiliate_click…'일 때 /api/affiliate/events로 보고) */
  productId?: string;
  videoId?: string;
  platform?: string;
}

/**
 * 외부 URL을 새 창으로 열기.
 */
export async function openExternal(
  url: string,
  options: OpenOptions = {}
): Promise<void> {
  if (!url || typeof url !== 'string') return;

  // 제휴 클릭 로깅 — keepalive로 새 탭 전환 중에도 전송 보장
  if (options.reason && options.reason.startsWith('affiliate_click')) {
    try {
      fetch('/api/affiliate/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_type: 'click',
          reason: options.reason,
          url,
          product_id: options.productId ?? null,
          video_id: options.videoId ?? null,
          platform: options.platform ?? null,
        }),
      }).catch(() => { /* 로깅 실패 무시 */ });
    } catch (_) {
      // 무시
    }
  }

  // 일반 웹 브라우저 환경
  const isToss = typeof navigator !== 'undefined' && /Toss/i.test(navigator.userAgent);
  // ⚠️ window.open의 windowFeatures에 'noopener'를 넣으면 반환값이 항상 null이 되어
  //    "성공했는데도 폴백이 또 실행 → 탭 2개"가 열린다. 그래서 features 없이 열고 opener만 끊는다.
  const w = window.open(url, '_blank');
  if (w) {
    try { w.opener = null; } catch { /* noreferrer 대체: 접근 불가 시 무시 */ }
  } else if (isToss) {
    // Toss WebView 환경에서는 window.open이 허용되지 않으므로 현재 창에서 리다이렉트하여 앱이 가로채도록 처리합니다.
    window.location.href = url;
  } else {
    // 팝업이 실제로 차단된 경우에만(반환 null) 동적 anchor 클릭으로 재시도.
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
