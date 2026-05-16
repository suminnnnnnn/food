# Place — 프로젝트 컨텍스트

## 프로젝트 개요
Place은 대한민국 전체 식당 데이터(16만 건)를 기반으로 한 맛집 탐색 지도 웹앱이다.
유튜브·미슐랭·블루리본 등 큐레이션 소스를 레이어 필터로 제공하는 것이 핵심 차별점이다.
전체 식당을 기본으로 표시하고, 큐레이션 소스는 필터로 하이라이트한다.

## 기술 스택
- 프레임워크: Next.js 15 (App Router, 풀스택)
- 스타일링: Tailwind CSS v4
- 지도: 카카오맵 SDK (react-kakao-maps-sdk)
- DB: Supabase (PostgreSQL + pgvector)
- 임베딩: Gemini 임베딩 768-dim
- 애니메이션: Framer Motion
- 아이콘: Lucide React
- 파이프라인: Python 스크립트 별도 운용 (수집/임베딩 배치, Next.js와 완전 분리)

## 아키텍처 원칙
- Next.js가 Supabase를 직접 쿼리 (FastAPI 없음)
- 모든 페이지는 Server Component 기본, 상호작용 부분만 "use client"
- Python 파이프라인은 독립 스크립트로만 존재

## 데이터 구조
```typescript
export type ContentSource = "youtube" | "michelin" | "blueribbon" | "default";

export interface Youtuber {
  id: string;
  name: string;
  profile_image: string;
  channel_url: string;
}

export interface Video {
  id: string;
  youtube_id: string;
  thumbnail: string;
  title: string;
  published_at: string;
  view_count: number;
  youtuber: Youtuber;
}

export interface ContentTag {
  source: ContentSource;
  label: string;
  year?: number;
}

export interface Restaurant {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  videos: Video[];
  primary_video?: Video;
  content_tags: ContentTag[];
  is_trending?: boolean;
}
```

## 파일 구조
```
src/
├── app/
│   ├── page.tsx
│   ├── api/
│   │   ├── restaurants/route.ts    # bounds 기반 쿼리
│   │   ├── trending/route.ts       # revalidate 3600
│   │   └── search/route.ts         # 벡터 검색
│   └── layout.tsx
├── components/
│   ├── map/
│   │   ├── MapContainer.tsx
│   │   ├── YoutuberMarker.tsx
│   │   ├── DefaultMarker.tsx
│   │   ├── MichelinMarker.tsx
│   │   └── ClusterMarker.tsx
│   └── ui/
│       ├── DetailCard.tsx
│       ├── FilterBar.tsx
│       ├── TrendingTicker.tsx
│       └── SearchBar.tsx
├── lib/supabase/
│   ├── client.ts
│   ├── restaurants.ts
│   └── search.ts
├── types/index.ts
└── hooks/
    ├── useMapBounds.ts
    ├── useRestaurants.ts
    └── useFilter.ts
```
