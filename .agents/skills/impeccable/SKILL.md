---
name: impeccable
description: Place 디자인 시스템 가이드. 컴포넌트 생성, 디자인 개선, UI 폴리싱 작업 시 사용. "디자인해줘", "UI 만들어줘", "스타일 개선해줘" 요청에 자동 활성화.
---

# Impeccable — Place 디자인 스킬

## 핵심 원칙
지도가 주인공이므로 UI는 최소화한다. 마커와 카드가 앱의 시각적 개성을 표현한다.

## 디자인 방향 결정 프로세스

### Step 1. 브랜드 보이스 확인
Place: 신선한(Fresh) · 큐레이팅된(Curated) · 생동감 있는(Alive)

### Step 2. 컴포넌트 컨텍스트 파악
- 지도 위 오버레이: 최소화, 반투명, backdrop-blur
- 카드/패널: 흰 배경, 오렌지 포인트, 부드러운 그림자
- 마커: 유튜버 프로필 원형, 명확한 경계, HOT 뱃지

### Step 3. 구현
아래 레퍼런스를 참고하여 구현한다.

## 컴포넌트별 가이드

### YoutuberMarker
```tsx
// 유튜버 프로필 원형 마커
<button className="relative group transition-transform hover:scale-110 hover:z-50">
  <div className="w-12 h-12 rounded-full border-2 border-white shadow-xl overflow-hidden">
    <img src={profile_image} className="w-full h-full object-cover" />
  </div>
  {is_trending && (
    <div className="absolute -top-1 -right-1 bg-[oklch(0.60_0.20_25)] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-white">
      HOT
    </div>
  )}
</button>
```

### DetailCard
```tsx
// 하단 슬라이드업 카드
// animate-in slide-in-from-bottom duration-200
// 배경: oklch(0.99 0.005 40)
// 섀도: shadow-2xl
// 라운드: rounded-2xl
```

### FilterBar
```tsx
// pill 형태 필터 버튼
// 비활성: border border-[oklch(0.90_0.010_40)] bg-white
// 활성: bg-[oklch(0.65_0.18_40)] text-white
// gap-2, overflow-x-auto, 스크롤 가능
```

### TrendingTicker
```tsx
// 상단 고정 반투명 pill
// bg-white/80 backdrop-blur-md
// border border-[oklch(0.85_0.10_40)]
// rounded-full
```

## 금지 패턴 (절대 사용 금지)
- border-left/right > 1px (사이드 스트라이프)
- background-clip: text + gradient (그라디언트 텍스트)
- bounce/elastic easing
- 카드 안에 카드
- 순수 #000 / #fff
- Inter, Roboto, Arial, DM Sans, Space Grotesk 폰트
