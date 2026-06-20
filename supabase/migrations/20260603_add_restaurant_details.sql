-- ============================================================
-- Migration: 20260603_add_restaurant_details
-- restaurants 테이블에 상세 편의 정보 및 메뉴/가격 정보 컬럼 추가
-- ============================================================

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS parking TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS packaging TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS reservation TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS business_hours TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS menu_info TEXT;

-- RLS 완화 정책 적용 (익명 쓰기 허용 정책 추가하여 적재 스크립트 및 API가 anon 권한에서 정상 작동하도록 보장)
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurants_open_policy ON restaurants;
CREATE POLICY restaurants_open_policy ON restaurants
  FOR ALL
  USING (true)
  WITH CHECK (true);
