# /design-review — 디자인 품질 검토

컴포넌트 구현 후 디자인 품질을 검토할 때 사용한다.
사용법: `/design-review [컴포넌트명 또는 전체]`

## 검토 순서

### 1. AI 슬롭 패턴 검사
다음 패턴이 있으면 즉시 수정한다:
- [ ] border-left/right > 1px 사이드 스트라이프
- [ ] background-clip: text + gradient 그라디언트 텍스트
- [ ] 금지 폰트 (Inter, Roboto, Arial, DM Sans, Space Grotesk, Fraunces)
- [ ] 순수 #000 / #fff (틴트 없음)
- [ ] 카드 안에 카드 중첩
- [ ] bounce/elastic easing
- [ ] 퍼플/시안 글로우 다크모드

### 2. Place 디자인 원칙 확인
- [ ] 지도가 캔버스: UI 요소가 지도를 가리지 않는가
- [ ] 마커가 아이덴티티: 유튜버 프로필 마커가 명확히 보이는가
- [ ] 카드는 스냅샷: 빠르게 훑고 결정 가능한가
- [ ] 필터는 즐거움: 필터 전환이 자연스러운가

### 3. 타이포그래피 확인
- [ ] Pretendard Variable 사용
- [ ] 타입 스케일 일관성 (xs/sm/base/lg/xl)
- [ ] 본문 최대 너비 65~75ch

### 4. 컬러 확인
- [ ] OKLCH 컬러 시스템 사용
- [ ] 오렌지 포인트 컬러 일관성
- [ ] 중립 색상에 오렌지 틴트 적용

### 5. 모션 확인
- [ ] ease-out-quart 사용
- [ ] transform/opacity만 애니메이션
- [ ] 카드 슬라이드업 200ms 이내
