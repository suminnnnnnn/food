# 디자인 원칙 (Place Design Context)

## 브랜드 아이덴티티
- 브랜드 보이스: 신선한(Fresh) · 큐레이팅된(Curated) · 생동감 있는(Alive)
- 테마: 라이트 모드 우선 (밝은 환경에서 지도 탐색)
- 핵심 원칙: 지도가 캔버스, 마커가 아이덴티티, 카드는 스냅샷, 필터는 즐거움

## 타이포그래피
- 기본 폰트: Pretendard Variable (한국어 최적화)
- 금지 폰트: Inter, Roboto, Arial, DM Sans, Space Grotesk, Fraunces, Lora, Outfit

## 컬러 시스템 (OKLCH)
```css
--color-brand:        oklch(0.65 0.18 40);   /* 오렌지 포인트 */
--color-brand-light:  oklch(0.85 0.10 40);
--color-brand-dark:   oklch(0.50 0.18 40);
--color-surface:      oklch(0.99 0.005 40);  /* 배경 */
--color-surface-2:    oklch(0.96 0.008 40);  /* 카드 배경 */
--color-border:       oklch(0.90 0.010 40);
--color-text:         oklch(0.20 0.010 40);
--color-text-sub:     oklch(0.50 0.010 40);
--color-trending:     oklch(0.60 0.20 25);   /* HOT 뱃지 */
--color-michelin:     oklch(0.55 0.15 250);
--color-blueribbon:   oklch(0.50 0.18 270);
```

## 스페이싱 (4pt 스케일)
```css
--space-1: 4px;  --space-2: 8px;   --space-3: 12px;
--space-4: 16px; --space-6: 24px;  --space-8: 32px;
--space-12: 48px; --space-16: 64px;
```

## 모션
- 기본 easing: cubic-bezier(0.25, 1, 0.5, 1) (ease-out-quart)
- 카드 슬라이드업: 200ms
- 금지: bounce/elastic easing, width/height/padding 직접 애니메이션

## 절대 금지 패턴
- border-left/right > 1px 사이드 스트라이프 장식
- background-clip: text + gradient (그라디언트 텍스트)
- 순수 #000 / #fff (항상 틴트)
- 퍼플/시안 글로우 다크모드 조합
- 카드 안에 카드 중첩
- 모든 요소에 동일한 padding 적용
- glassmorphism 남용
