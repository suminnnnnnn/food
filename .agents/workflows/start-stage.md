# /start-stage — 개발 단계 시작

특정 개발 단계를 시작할 때 사용한다.
사용법: `/start-stage [단계번호]`

## 단계 정의

### 1단계: 프로젝트 세팅
목표: Next.js 초기화 + 카카오맵 연동 + 기본 마커 렌더링
```
작업:
1. Next.js 15 프로젝트 생성 (App Router, TypeScript)
2. Tailwind CSS v4 설치
3. react-kakao-maps-sdk 설치 및 카카오맵 렌더링
4. src/types/index.ts 데이터 구조 생성
5. Supabase 클라이언트 설정

검증:
- 카카오맵이 서울 중심으로 렌더링되는가
- /api/restaurants 엔드포인트가 응답하는가
```

### 2단계: bounds 쿼리 + 클러스터링
목표: 지도 이동 시 해당 영역 데이터만 쿼리
```
작업:
1. useMapBounds 훅 구현 (bounds 감지)
2. getRestaurantsByBounds Supabase 쿼리 함수
3. 줌 레벨별 분기 로직 (1~10: 클러스터, 11~13: 상위 50개, 14+: 전체)
4. ClusterMarker 컴포넌트

검증:
- 지도 드래그 후 새 bounds로 재쿼리 (중복 요청 없음)
- 줌 10 이하: CustomOverlayMap 미렌더링
- 줌 14 이상: 개별 마커 렌더링
```

### 3단계: 필터 시스템
목표: 큐레이션 소스별 마커 분기
```
작업:
1. useFilter 훅 (필터 상태 관리)
2. FilterBar 컴포넌트 (pill 형태 복수 선택)
3. 마커 분기 로직 (기본/유튜브/미슐랭/블루리본)
4. 필터 미적용 식당 opacity 0.3 처리

검증:
- 초기 상태: 전체 식당 일반 핀 마커
- 유튜브 ON: 유튜버 원형 마커 + 나머지 opacity 0.3
- 필터 해제: 즉시 기본 상태 복귀
```

### 4단계: 상세 카드
목표: 마커 클릭 시 식당 정보 카드 표시
```
작업:
1. DetailCard 컴포넌트 (하단 슬라이드업)
2. 유튜브 썸네일 + 재생 버튼
3. 복수 영상 가로 스크롤
4. 미슐랭/블루리본 배지

검증:
- 슬라이드업 200ms 이내
- 유튜브 클릭 → 새 탭 열기
- 복수 영상 가로 스크롤 동작
- 닫기 → 선택 해제
```

### 5단계: 트렌딩 티커
목표: 실데이터 기반 트렌딩 티커
```
작업:
1. /api/trending Route Handler (revalidate 3600)
2. 최근 7일 view_count 상위 5개 Supabase 쿼리
3. TrendingTicker 컴포넌트 (Framer Motion 슬라이드)

검증:
- 하드코딩 문자열 없음
- Cache-Control max-age=3600
- 3~5초 간격 자동 슬라이드
```

### 6단계: 벡터 검색
목표: 자연어 기반 맛집 검색
```
작업:
1. /api/search Route Handler
2. Gemini 임베딩 API 쿼리 생성
3. pgvector 유사도 검색 함수
4. SearchBar 컴포넌트
5. 검색 결과 지도 마커 + 사이드 리스트

검증:
- "조용한 일식집" → 일식 카테고리 상위 노출
- 결과 마커 + 리스트 동기화
- 초기화 → 기본 지도 상태 복귀
```
