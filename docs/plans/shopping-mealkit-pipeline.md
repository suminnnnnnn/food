# 쇼핑탭 — 밀키트 V-커머스 파이프라인 구현계획

> 매일 1회 유튜브 인기 밀키트 리뷰영상 수집 → 영상 속 밀키트를 쿠팡 파트너스/네이버로 연계.
> 작성: 2026-07-04. 전문가 리서치(제휴마케팅·YouTube 수집·상품추출·아키텍처) 종합.

---

## 0. 현재 실제 상태 (코드 검증 완료)

| 구분 | 상태 |
|------|------|
| `GET /api/shopping/mealkits` | ✅ 존재. `affiliate_videos` + `affiliate_products` 조인 반환 |
| Supabase 테이블 2종 | ✅ 전제됨(API가 참조). **실제 컬럼·데이터는 Phase 0에서 검증 필요** |
| ShoppingTabView | ⚠️ 아직 `mockVideos` 하드코딩. API 미연결 |
| 수집 파이프라인 / 크론 | ❌ 없음 |
| 쿠팡 파트너스 연동 / 키 | ❌ 없음 (`search_url`만 수기 생성) |
| 관리자 검수 UI | ❌ 없음 |
| 레퍼런스 패턴 | `api/videos/submit` (YT+Gemini+upsert), `scripts/ai_crawler.mjs` |

---

## 1. 전략 결정 — 리서치가 뒤집은 통념

계획을 좌우하는 비직관적 제약들:

1. **"영상에서 밀키트 추출"의 하드한 ML 문제는 대부분 우회 가능하다.**
   크리에이터가 **설명란에 직접 넣은 제휴링크·타임스탬프·제품명은 ~95% 정확**하다. 자막 STT + LLM 영상분석은 정확도 60~75%(자막 고유명사 오인식)로 오히려 열등. → **설명란 파싱 우선(description-first)**, 자막/STT는 Phase 2 보강.

2. **쿠팡 파트너스 API는 실적 게이트가 있다.**
   API 키 발급은 **누적 수수료 ~₩150,000 달성("최종승인") 후**에야 열림. 게다가 상품검색 API는 **시간당 10회** 제한 + **429 3회 누적 시 계정 영구 정지**. → **MVP는 쿠팡 API에 의존하지 않는다.** 초기엔 검색 딥링크 URL로 시작하고, 파트너스 가입/승인은 병렬로 진행. API 자동화는 Phase 3.

3. **`search.list`가 2026-06부터 하루 100콜로 하드캡됐다(별도 버킷).**
   → **채널 화이트리스트 + RSS 업로드 피드(쿼터 0)** 하이브리드로 발견하고, `videos.list`(1유닛/콜, 1만 풀)로만 통계 보강. search는 신규 채널 발굴에만 소량.

4. **완전 자동 발행은 금지.** 오매칭·환각 리스크. `수집 → 초안(pending) → 관리자 검수 → 발행(approved)` 게이트 필수. 고신뢰(설명란 직접링크) 건만 자동 통과 허용.

5. **법적으로는 "링크 전달"에 머문다.** 결제/주문에 개입하지 않으면 통신판매중개업 신고 불필요. 대신 공정위 표시의무 — **확정 표현("수수료를 지급받습니다")**, 첫 화면·링크 근처 노출.

---

## 2. 데이터 모델 (기존 snake_case 컨벤션 유지)

**Phase 0에서 실제 스키마 확인 후 부족 컬럼 ALTER.** 컴포넌트가 요구하나 현재 없을 가능성이 큰 컬럼:

```sql
-- affiliate_videos
ALTER TABLE affiliate_videos
  ADD COLUMN IF NOT EXISTS category   text,
  ADD COLUMN IF NOT EXISTS min_price  int,                       -- 상품 최저가 집계
  ADD COLUMN IF NOT EXISTS status     text DEFAULT 'pending'     -- 검수 게이트
      CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS collected_at timestamptz DEFAULT now();
-- (기존 전제 컬럼: id, youtube_video_id, title, thumbnail_url, channel_title, view_count, published_at)

-- affiliate_products
ALTER TABLE affiliate_products
  ADD COLUMN IF NOT EXISTS subtitle   text,
  ADD COLUMN IF NOT EXISTS price      int,
  ADD COLUMN IF NOT EXISTS badge      text,
  ADD COLUMN IF NOT EXISTS timestamp  text,                      -- "3:24"
  ADD COLUMN IF NOT EXISTS platform   text DEFAULT 'coupang',
  ADD COLUMN IF NOT EXISTS confidence real,                      -- 추출 신뢰도
  ADD COLUMN IF NOT EXISTS evidence   text;                      -- 환각 방지용 원문 근거
-- (기존 전제: id, video_id FK, product_name, brand, search_url, thumbnail_url)

-- 클릭/전환 로깅 (Phase 3)
CREATE TABLE IF NOT EXISTS affiliate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES affiliate_products(id),
  type text CHECK (type IN ('view','click','conversion')),
  created_at timestamptz DEFAULT now()
);
```

컴포넌트가 문자열을 기대하는 필드는 **API 응답 계층에서 포맷**: `view_count(int) → "124만"`, `min_price(int) → "24,000원"`.

---

## 3. 단계별 구현

### Phase 0 — 정지작업 (0.5~1일 + 병렬 승인대기)
- [ ] Supabase `affiliate_videos`/`affiliate_products` **실제 컬럼·데이터 확인**, 위 ALTER 적용.
- [ ] **쿠팡 파트너스 가입 신청** + **네이버 쇼핑 커넥트 신청**(사전심사 없음, 계정만). — 사람 작업, 지금 시작.
- [ ] 신뢰 밀키트/먹방 채널 **화이트리스트 30~50개** 큐레이션(테이블 또는 상수).
- [ ] `AffiliateDisclosure` 문구를 확정 표현으로 점검("받을 수 있음" 류 금지).

### Phase 1 — 수집 & 노출 MVP (핵심, 우선 출시)
**목표: 자동 수집된 밀키트 영상이 검수를 거쳐 쇼핑탭에 뜬다. 쿠팡 API 없이.**

1. **컴포넌트 연결** — `ShoppingTabView`의 `mockVideos` 제거, `GET /api/shopping/mealkits` fetch. 로딩/빈/에러 상태 추가. (이번에 리디자인한 UI 그대로 재사용.)
2. **읽기 API 보강** — `mealkits/route.ts`에 `status='approved'` 필터 + 위 포맷팅 추가(미검수 노출 차단).
3. **수집 잡** — `src/scripts/collect_mealkits.mjs` (기존 `ai_crawler.mjs`/`videos/submit` 패턴 이식):
   ```
   for ch in WHITELIST:                       # RSS, 쿼터 0
     ids |= parse_rss(feeds/videos.xml?channel_id=ch)
   ids |= search.list(q="밀키트 리뷰|먹방|추천", order=viewCount,
                      relevanceLanguage=ko, regionCode=KR, publishedAfter=now-7d)  # 소량
   for batch in chunk(ids,50):                # videos.list, 1유닛
     meta = videos.list(part=snippet,statistics,contentDetails)
     drop: shorts(<60s), 제목/설명에 밀키트 키워드 없음, view<5000
     score = view_count / hours_since_published            # velocity
   for video in top-N:
     products = gemini_extract(title+description)           # 아래 4장
     coupang_url = coupang_search_deeplink(product_name)    # 검색 URL(승인 전)
     upsert affiliate_videos(status='pending') + affiliate_products
   ```
4. **관리자 검수** — `src/app/admin/mealkits/page.tsx`(pending 목록, 승인/반려) + `api/admin/mealkits/[id]/route.ts`(PATCH status). `ADMIN_SECRET` 헤더/쿠키로 최소 보호(현재 auth 미들웨어 없음).
5. **스케줄** — 배포 형태에 따라(§6 결정 필요):
   - Vercel 배포 → `vercel.json` cron `{"path":"/api/cron/mealkits","schedule":"0 21 * * *"}` + `CRON_SECRET` 검증.
   - 그 외 → GitHub Actions `schedule` 또는 로컬 `node src/scripts/collect_mealkits.mjs` 수동.

### Phase 2 — 추출/매칭 고도화
- **설명란 제휴링크 파싱** — `link.coupang.com`/스마트스토어 URL 추출 → 리다이렉트 해제로 상품 ID 확보(~95% 정확, 매칭 스킵). `mm:ss 제품명` 타임스탬프 파싱.
- **자막/STT 폴백** — 설명란 부실 영상에 한해 STT(gpt-4o-transcribe, ~$0.09/15분) → Gemini 추출.
- **네이버 쇼핑 검색 API 매칭** — 이미 `NAVER_CLIENT_ID/SECRET` 보유, 쿼터 넉넉 → 1차 매칭(실제 상품명·가격·이미지). 쿠팡은 확정건만.
- **신뢰도 자동승인** — 설명란 직접링크 + confidence 임계 이상은 검수 건너뛰고 자동 발행 → 검수 부하↓.

### Phase 3 — 수익화 자동화 (쿠팡 승인 후)
- **쿠팡 파트너스 Open API** — `COUPANG_ACCESS_KEY/SECRET`, HMAC-SHA256 서명. 검색 URL → 실제 딥링크로 교체. 상품검색 API는 **시간당 10회 엄수(배치+캐싱)**.
- **네이버 쇼핑 커넥트** 딥링크.
- **클릭/전환 로깅**(`affiliate_events`) + 간단 대시보드.

---

## 4. Gemini 추출 프롬프트 설계 (환각 방지)

기존 `videos/submit`처럼 `gemini-2.5-flash` + `responseMimeType: application/json`. 환각 3중 방어:
- 스키마에 **`evidence`(원문 인용) 필수** — 근거 못 대면 항목 생성 불가.
- 프롬프트: "입력 텍스트(제목+설명)에 **명시된 상품만**. 추론·보완 금지."
- 항목별 `confidence` 자체평가 → 저신뢰는 검수 대기열.

출력 스키마: `[{product_name, brand, timestamp, confidence, evidence}]`.
> 추출 LLM은 기존 스택(Gemini)을 재사용(키·패턴 존재). Claude Haiku도 유사 성능·비용이나 신규 의존 추가는 불필요.

**비용 추정**: 영상당 입력 6~8K 토큰, Gemini Flash 기준 ≈ 영상당 $0.01~0.03. 하루 50개 → 월 $15~45. STF 폴백 포함 시 월 $30~90.

---

## 5. 컴플라이언스 체크리스트
- [ ] 공정위: 상품 카드/페이지 상단에 **확정 표현** 대가성 표시 고정 노출.
- [ ] 결제/주문 미개입(링크 전달만) → 통신판매중개업 신고 회피.
- [ ] YouTube: 공식 iframe 임베드만, 썸네일은 Data API 취득(≥120px), 자체 큐레이션 콘텐츠 병기(링크팜 회피).
- [ ] 통계(view_count 등) 저장 **최대 30일**, 이후 refresh/삭제 (YouTube ToS).
- [ ] 쿠팡: 자기구매·허위리뷰 금지(계정 정지 사유).

---

## 6. 결정 (2026-07-04 확정)
1. **배포 호스트 = Vercel** → `vercel.json` Cron 사용.
2. **쿠팡 파트너스 = 가입됨, 실적 미달** → API 불가. **검색 딥링크 URL로 MVP 시작**, HMAC API 자동화는 Phase 3(실적 ₩15만 달성 후).
3. 처리 규모 / 검수 정책 — 미정(기본: 반자동 검수, 하루 top-N).

---

## 7. 진행 로그
### 2026-07-04 — Phase 0 (부분 완료)
- ✅ 실제 스키마 검증(`scripts/check_affiliate_schema.mjs`). 3개 테이블 모두 **0 rows**.
  - `affiliate_videos`: id, youtube_video_id, title, **description(존재!)**, thumbnail_url, channel_title, view_count, published_at, created_at
  - `affiliate_products`: id, video_id, product_name, brand, search_url, thumbnail_url, created_at
- ✅ 부족 컬럼 추가(`scripts/migrate_affiliate_columns.mjs`, additive·idempotent):
  - videos += `category, min_price, status('pending'|'approved'|'rejected')` + status/published_at 인덱스
  - products += `subtitle, price, badge, mention_time, platform('coupang'), confidence, evidence`
- ✅ 공정위 문구 확정 표현으로 수정(양 `AffiliateDisclosure` 컴포넌트: "제공받을 수 있습니다" → "지급받습니다").
- ⚠️ **기술부채 발견**: `affiliate_events.product_id`가 **bigint**인데 `affiliate_products.id`는 **uuid** → FK 불일치. Phase 3 클릭 로깅 전 정리 필요.
- ⏳ 남은 Phase 0(사람 작업): 네이버 쇼핑 커넥트 가입, 신뢰 채널 화이트리스트 30~50개 큐레이션.

> 참고: 컴포넌트는 `product.timestamp`를 기대 → DB 컬럼은 `mention_time`. **읽기 API에서 `mention_time → timestamp` 별칭 매핑** 필요.

### 2026-07-04 — Phase 1 (엔드투엔드 완료·검증)
- ✅ 읽기 API `api/shopping/mealkits`: `status='approved'` 필터 + 포맷팅(`view_count→"124만"`, `min_price→원`, `mention_time→timestamp`), 가격 null 허용.
- ✅ `ShoppingTabView`: mock 제거 → 실 API fetch, 로딩(스켈레톤)/에러(재시도)/빈 상태, 가격 null 시 "최저가 확인" 표시.
- ✅ 수집 크론 `api/cron/mealkits`(GET): search.list(밀키트 3쿼리)→videos.list 보강→필터(쇼츠·조회수·밀키트키워드·채널캡·velocity)→Gemini 2.5 Flash 추출(근거 인용 강제)→쿠팡 검색 URL→pending upsert. 기수집 영상 skip. `CRON_SECRET` 옵션 인증, `maxDuration=60`.
- ✅ 검수: `api/admin/mealkits`(GET 목록) + `[id]`(PATCH status/category/min_price, DELETE) + `/admin/mealkits` 페이지(시크릿·상태탭·근거·신뢰도·승인/반려/삭제·"지금 수집 실행"). `ADMIN_SECRET` 옵션 인증.
- ✅ `vercel.json` 크론 등록(매일 21:00 UTC = 06:00 KST).
- ✅ **실행 검증**: 수집 1회 → 발견 13/후보 5/신규 5영상·상품 16개. 승인 → 쇼핑탭 노출 확인.
- 🔧 RLS: 신규 `affiliate_*` 테이블은 기본 RLS로 insert 거부됨 → `scripts/disable_rls_affiliate.mjs`로 비활성화(기존 콘텐츠 테이블 컨벤션과 동일).

### 2026-07-04 — Phase 1.5 (UX·가격·멀티몰 개선)
- ✅ **실제 가격 표기**: 네이버 쇼핑 검색 API(`NAVER_CLIENT_ID/SECRET` 재사용)로 최저가·상품링크·이미지 취득. 변동 대비 **"M/D 기준" 표기**로 정직하게 노출. 컬럼 추가: `coupang_url, naver_url, price_checked_at`. 영상 `min_price`는 상품 최저가로 집계.
- ✅ **멀티몰 선택**: 상품마다 쿠팡/네이버 **구매처 선택 버튼** 2개(컬러 도트). 기존 단일 "최저가 보기" CTA 제거 → 과장 표현 해소.
- ✅ **뱃지 리디자인**: 촌스러운 컬러 뱃지 제거, 브랜드는 은은한 슬레이트 칩으로.
- ✅ **안내문 이동**: 제휴 고지문을 "영상 속 상품" 헤더 바로 아래로.
- ✅ **밀키트 전용 필터**: 카테고리 taxonomy를 `고기·구이/국물·탕/면·파스타/분식/해산물/캠핑용/홈파티/야식/다이어트`로 교체(간편식 제외). Gemini 프롬프트·admin·필터 칩 반영. 기존 데이터는 `scripts/backfill_affiliate.mjs`로 재분류.
- ✅ **영상 리스트 레이아웃**: 2열 세로 크롭 → **단일 열 16:9 피드**(썸네일 잘림 해소).
- ⚠️ **데이터 품질 이슈**: 네이버 top-1 매칭이 어긋나는 케이스 존재(예: 우동 밀키트→83,000원 오매칭). 관리자 검수로 걸러야 하며 Phase 2(설명란 링크 파싱·정규화·신뢰도 임계)에서 정밀화.

### 2026-07-04 — Phase 1.7 (이커머스 UI 고도화 · 전문가 리서치 기반)
국내(쿠팡·네이버·오늘의집·29CM·컬리·무신사) + 해외(TikTok Shop·LTK·YouTube Shopping·오늘의집) UI 패턴을 조사 → "리뷰·평점·재고 없는 크리에이터 커머스"에 이식 가능한 모듈로 매핑. 착수 순서대로 구현:
- ✅ **① 먹는 장면 점프** (우리만의 차별화) — 상품 카드 "▶ 0:42 먹는 장면 보기" → iframe이 `start=SS&autoplay=1`로 그 순간 재생. `mention_time` 활용. 리뷰 대체 최강 사회적 증거.
- ✅ **③ 급상승 랭킹 레일** — 조회수/게시경과(velocity)로 정렬한 "이번 주 급상승" 가로 레일(순위 배지). 판매량 없이 조회수를 대체 지표로.
- ✅ **④ 크리에이터 권위 배지** — 채널 프로필 + 구독자수("구독 6.7만"). 스키마 `channel_id/subscriber_count/channel_thumbnail` 추가, cron `channels.list` 보강 + `backfill_channels.mjs`. 별점 대체 신뢰 앵커.
- ✅ **⑥ 상품중심 "N개 영상 추천"** — 정규화 상품명 교차집계(읽기 API `also_count`), 2개↑일 때만 배지 노출. 데이터 쌓이면 자동 발현(현재 대부분 1).
- 컨셉: 홈을 상품 그리드가 아닌 크리에이터/영상 피드로(오늘의집·29CM·LTK 원칙). 없는 데이터(재고·배송·평점)는 UI에서 배제가 신뢰에 유리.
- 남은 후보(P1~2): ⑤ 카테고리 셸프, ⑦ 찜=장바구니(기존 folder 재사용), ⑧ MD 기획전.

### ⚠️ 프로덕션 배포 전 필수
- Vercel 환경변수 **`CRON_SECRET`**, **`ADMIN_SECRET`** 설정(미설정 시 크론·관리자 라우트가 무인증 개방). Vercel Cron은 `CRON_SECRET`을 Bearer로 자동 전송.
- 보안 강화: `SUPABASE_SERVICE_ROLE_KEY`를 서버 라우트 전용으로 도입해 RLS 재활성화 검토(현재 anon+RLS off).
- `affiliate_products`에 `video_id` FK ON DELETE CASCADE 없으면 DELETE 시 수동 정리(현재 코드가 products 먼저 삭제로 대응).

---

## 부록 — 근거 (전문가 리서치)
- 쿠팡 파트너스 API 실적 게이트·10회/시간·HMAC: developers.coupangcorp.com, codedosa.com/12603
- 네이버 쇼핑 커넥트(2025-07): wplaybook.com/naver-shopping-connect-guide
- 공정위 추천·보증 심사지침: law.go.kr, easylaw.go.kr
- YouTube 쿼터(search.list 2026-06 변경): developers.google.com/youtube/v3/determine_quota_cost, developer-policies
- RSS 업로드 피드(쿼터 0): youtube.com/feeds/videos.xml?channel_id=UC...
- 추출 파이프라인·STT 비용: developers.google.com/youtube/v3/docs/captions/download, OpenAI transcribe pricing
