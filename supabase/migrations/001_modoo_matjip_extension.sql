-- ============================================================
-- Migration: 001_modoo_matjip_extension
-- 모두의맛집 (Place 확장) - 사용자 제보, AI 심사, 제휴 마케팅
-- ============================================================
-- 사전 요구사항:
--   - Place의 기존 테이블이 이미 존재해야 함:
--     restaurants, channels, series, videos, restaurant_videos,
--     curation_sources, restaurant_curations
--   - 본 마이그레이션은 위 테이블에 영향 없이 신규 테이블만 추가.
-- ============================================================

BEGIN;

-- pgvector 확장 (중복 식당 판정용 임베딩 저장)
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- 1. Supabase Auth 확장 프로필
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname         TEXT,
  avatar_url       TEXT,
  toss_user_key    TEXT,
  submission_score INT DEFAULT 0,  -- 제보 신뢰도 (자동승인 임계치 조정용)
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ------------------------------------------------------------
-- 2. 사용자 제보 원본
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_submissions (
  id                      BIGSERIAL PRIMARY KEY,
  user_id                 UUID REFERENCES users(id),
  raw_name                TEXT NOT NULL,
  raw_address             TEXT,
  source_url              TEXT NOT NULL,
  source_type             TEXT CHECK (source_type IN ('youtube','press','social','other')),
  user_comment            TEXT,
  status                  TEXT DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','held','rejected')),
  resolved_restaurant_id  BIGINT REFERENCES restaurants(id),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON user_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_user
  ON user_submissions (user_id, created_at DESC);

CREATE TRIGGER trg_submissions_updated
  BEFORE UPDATE ON user_submissions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ------------------------------------------------------------
-- 3. AI/인간 심사 로그
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submission_reviews (
  id                BIGSERIAL PRIMARY KEY,
  submission_id     BIGINT REFERENCES user_submissions(id) ON DELETE CASCADE,
  reviewer_type     TEXT NOT NULL CHECK (reviewer_type IN ('ai','human')),
  reviewer_id       TEXT,
  decision          TEXT NOT NULL CHECK (decision IN ('approve','hold','reject')),
  confidence        NUMERIC(3,2),
  reasons           JSONB DEFAULT '[]'::jsonb,
  raw_response      JSONB,
  dedupe_target_id  BIGINT REFERENCES restaurants(id),
  notes_to_user     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_submission
  ON submission_reviews (submission_id, created_at DESC);

-- ------------------------------------------------------------
-- 4. 식당 임베딩 (중복 판정용)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurant_embeddings (
  restaurant_id   BIGINT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  embedding       vector(768) NOT NULL,
  source_text     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- HNSW 인덱스. 대용량 적재 시 인덱스를 먼저 DROP 후 적재, 다시 생성하는 패턴 권장.
CREATE INDEX IF NOT EXISTS idx_restaurant_embeddings_hnsw
  ON restaurant_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------------
-- 5. 쿠팡파트너스 상품 캐시
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_products (
  id            BIGSERIAL PRIMARY KEY,
  vendor        TEXT NOT NULL DEFAULT 'coupang',
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  price         INT,
  image_url     TEXT,
  deeplink_url  TEXT NOT NULL,
  keywords      TEXT[],
  category      TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  fetched_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (vendor, external_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_keywords
  ON affiliate_products USING gin (keywords);
CREATE INDEX IF NOT EXISTS idx_affiliate_category
  ON affiliate_products (category, fetched_at DESC);

-- ------------------------------------------------------------
-- 6. 제휴 이벤트 (클릭/뷰/전환)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_events (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID REFERENCES users(id),
  restaurant_id  BIGINT REFERENCES restaurants(id),
  product_id     BIGINT REFERENCES affiliate_products(id),
  event_type     TEXT NOT NULL CHECK (event_type IN ('view','click','conversion')),
  session_id     TEXT,
  metadata       JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_events_lookup
  ON affiliate_events (restaurant_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_events_user
  ON affiliate_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ------------------------------------------------------------
-- 7. 즐겨찾기
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id  BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON user_favorites (user_id, created_at DESC);

-- ============================================================
-- RLS 정책
-- ============================================================

-- restaurants: 승인된 식당만 공개 조회
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurants_public_read ON restaurants;
CREATE POLICY restaurants_public_read ON restaurants
  FOR SELECT
  USING (is_published = true);

-- (선택) 운영자만 insert/update. Service role 키는 RLS 우회하므로 워커는 영향 없음.
DROP POLICY IF EXISTS restaurants_admin_write ON restaurants;
CREATE POLICY restaurants_admin_write ON restaurants
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- user_submissions: 본인만 조회/수정
ALTER TABLE user_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS submissions_owner_rw ON user_submissions;
CREATE POLICY submissions_owner_rw ON user_submissions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_favorites: 본인만
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_owner_rw ON user_favorites;
CREATE POLICY favorites_owner_rw ON user_favorites
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- submission_reviews: 일반 사용자는 읽기 불가 (관리/워커만)
ALTER TABLE submission_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_service_only ON submission_reviews;
CREATE POLICY reviews_service_only ON submission_reviews
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- affiliate_events: 본인 이벤트만 조회 가능. 쓰기는 누구나(익명 사용자 클릭도 로깅 필요)
ALTER TABLE affiliate_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_self_read ON affiliate_events;
CREATE POLICY events_self_read ON affiliate_events
  FOR SELECT
  USING (
    auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role'
  );

DROP POLICY IF EXISTS events_open_insert ON affiliate_events;
CREATE POLICY events_open_insert ON affiliate_events
  FOR INSERT
  WITH CHECK (true);

-- users: 본인만 조회/수정
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_rw ON users;
CREATE POLICY users_self_rw ON users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMIT;

-- ============================================================
-- 검증 쿼리 (마이그레이션 후 수동 실행)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'users','user_submissions','submission_reviews',
--     'restaurant_embeddings','affiliate_products','affiliate_events','user_favorites'
--   );
-- → 7개 행이 반환되어야 정상
