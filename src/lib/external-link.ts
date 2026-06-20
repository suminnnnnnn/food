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
}

/**
 * 외부 URL을 새 창으로 열기.
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

  // 일반 웹 브라우저 환경
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    // 팝업 차단 시 fallback
    window.location.href = url;
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
