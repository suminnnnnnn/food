-- 쇼핑탭 제휴 클릭 로그 (uuid 모델 기준).
-- 레거시 affiliate_events(bigint FK, 드롭된 구 affiliate_products 참조)와 별개의 깨끗한 테이블.
-- 순수 로그 목적이라 FK 없음(상품/영상 삭제 시에도 이력 보존).
CREATE TABLE IF NOT EXISTS mealkit_click_events (
  id          bigserial PRIMARY KEY,
  product_id  uuid,
  video_id    uuid,
  event_type  text NOT NULL DEFAULT 'click',
  platform    text,
  reason      text,
  url         text,
  referrer    text,
  session_id  text,
  user_agent  text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mce_created ON mealkit_click_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mce_product ON mealkit_click_events (product_id);
