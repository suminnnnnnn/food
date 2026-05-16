---
name: harness-validator
description: 구현된 기능이 하네스 검증 기준을 통과하는지 브라우저로 확인한다. "검증해줘", "하네스 확인", "테스트해줘" 요청 시 활성화.
---

# Harness Validator — 자동 검증 스킬

## 실행 방법
브라우저 에이전트를 사용하여 아래 검증 항목을 순서대로 확인한다.
각 항목의 결과를 PASS / FAIL로 기록하고 요약 리포트를 생성한다.

## H-1: 지도 렌더링 검증
```
1. localhost:3000 접속
2. 네트워크 탭 열기
3. 페이지 로드 후 /api/restaurants 요청 확인 → PASS/FAIL
4. 지도 드래그 → 새 요청 발생 확인, 중복 없음 → PASS/FAIL
5. 줌 아웃 (레벨 10 이하) → DOM에서 custom-overlay 엘리먼트 없음 → PASS/FAIL
6. 줌 인 (레벨 14 이상) → 마커 엘리먼트 렌더링 → PASS/FAIL
```

## H-2: 필터 시스템 검증
```
1. 초기 상태 스크린샷 → 일반 핀 마커만 표시 → PASS/FAIL
2. 유튜브 필터 클릭 → 원형 마커로 전환 확인 → PASS/FAIL
3. 비선택 마커 opacity CSS 확인 (0.3 이하) → PASS/FAIL
4. 필터 해제 → 기본 상태 복귀, 깜빡임 없음 → PASS/FAIL
```

## H-3: 상세 카드 검증
```
1. 마커 클릭 → 카드 등장 시간 측정 (200ms 이내) → PASS/FAIL
2. 유튜브 썸네일 클릭 → 새 탭 열림 → PASS/FAIL
3. 복수 영상 식당 → 가로 스크롤 존재 → PASS/FAIL
4. X 버튼 클릭 → 카드 사라짐, 마커 원복 → PASS/FAIL
```

## H-4: 트렌딩 티커 검증
```
1. /api/trending 직접 호출 → 응답에 5개 항목 → PASS/FAIL
2. 응답 헤더 Cache-Control: max-age=3600 → PASS/FAIL
3. 티커 슬라이드 타이밍 측정 (3~5초) → PASS/FAIL
```

## H-5: 벡터 검색 검증
```
1. 검색창에 "조용한 일식집" 입력
2. 결과 상위 3개 카테고리 확인 (일식 포함) → PASS/FAIL
3. 지도 마커와 리스트 개수 일치 → PASS/FAIL
4. 검색 초기화 버튼 → 기본 지도 복귀 → PASS/FAIL
```

## H-6: 디자인 품질 검증
```
1. 소스코드에서 border-left 검색 (> 1px) → 없음 → PASS/FAIL
2. background-clip: text 검색 → 없음 → PASS/FAIL
3. 폰트 패밀리 확인 (Pretendard만 사용) → PASS/FAIL
4. #000000 / #ffffff 하드코딩 검색 → 없음 → PASS/FAIL
```

## 리포트 형식
```
=== Place 하네스 검증 리포트 ===
H-1 지도 렌더링: [PASS/FAIL] (N/4)
H-2 필터 시스템: [PASS/FAIL] (N/4)
H-3 상세 카드:   [PASS/FAIL] (N/4)
H-4 트렌딩 티커: [PASS/FAIL] (N/3)
H-5 벡터 검색:   [PASS/FAIL] (N/4)
H-6 디자인 품질: [PASS/FAIL] (N/4)

실패 항목:
- [항목명]: [실패 이유 및 수정 방향]
```
