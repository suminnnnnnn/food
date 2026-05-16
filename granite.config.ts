import { defineConfig } from "@apps-in-toss/web-framework/config";

/**
 * 모두의맛집 - 앱인토스 WebView 미니앱 설정
 *
 * 기존 "Place" → "모두의맛집"으로 리브랜딩.
 * appName: 콘솔에서 suminoff를 폐기하고 modoo-matjip을 신규 신청.
 * 신규 신청 승인까지 영업일 1~2일 소요.
 *
 * 검수 통과 핵심:
 *  - 비게임 미니앱이므로 TDS 컴포넌트 도입 필수 (이 파일과 별개)
 *  - 로고는 600x600 각진 정사각형
 *  - 외부 결제 페이지 리다이렉트 금지, window.open 금지
 */
export default defineConfig({
  // 앱인토스 콘솔에 등록된 영문 식별자.
  // [변경] "suminoff" 폐기 → "modoo-matjip" 신규 신청 후 사용
  // 신청 승인 전까지는 "suminoff" 그대로 둔 채 displayName만 바꿔 임시 테스트 가능.
  appName: "modoo-matjip",

  brand: {
    // 사용자에게 노출되는 한글 앱 이름. 토스 앱 내비게이션 바/푸시/브릿지에 사용.
    // [변경] "Place" → "모두의맛집"
    displayName: "모두의맛집",

    // 미니앱 대표 컬러. 6자리 HEX. TDS 컴포넌트와 내비게이션 액센트에 적용.
    // [변경] "#000000" → 음식/맛집에 어울리는 따뜻한 오렌지 톤
    // [가정: 브랜드 가이드 확정 시 교체]
    primaryColor: "#FF6B35",

    // 앱인토스 콘솔에 업로드한 로고 이미지 URL (600x600px 각진 정사각형).
    // [TODO: 실제 모두의맛집 로고 600x600 PNG를 콘솔에 업로드한 후 그 URL로 교체]
    // [변경] 토스 기본 로고 → 자체 로고
    icon: "https://static.toss.im/appsintoss/modoo-matjip/modoo-matjip-logo.png",
  },

  web: {
    port: 3000,
    commands: {
      dev: "npm run dev",
      build: "npm run build",
    },
  },

  // WebView 동작 제어. 지도 핀치줌은 페이지별로 viewport meta로 제어.
  webViewProps: {
    // 전역 핀치줌은 비활성. 지도 페이지에서만 페이지 단위로 viewport meta override.
    // @ts-ignore: AIT SDK doesn't have allowsPinchZoom in its types yet
    allowsPinchZoom: false,

    // 유튜브 영상을 전체화면이 아닌 카드 내부에서 인라인 재생.
    allowsInlineMediaPlayback: true,

    // 자동재생 차단 (배터리/데이터 + iOS 정책).
    mediaPlaybackRequiresUserAction: true,
  },

  // [변경] 빈 배열 → geolocation 추가 (현 위치 기반 탐색 기능에 필수)
  // @ts-ignore: AIT SDK permissions type mismatch
  permissions: ["geolocation"],

  outdir: "out",
});
