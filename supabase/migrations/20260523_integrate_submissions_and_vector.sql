-- =================================================================================
-- user_submissions 및 pgvector 통합 스키마 마이그레이션
-- =================================================================================

-- 1. user_submissions 테이블에 누락된 카카오맵 고유정보 및 AI 검수 필드 확장
ALTER TABLE user_submissions ADD COLUMN IF NOT EXISTS kakao_place_id TEXT;
ALTER TABLE user_submissions ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE user_submissions ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE user_submissions ADD COLUMN IF NOT EXISTS ai_review_result JSONB;

-- 2. pgvector 코사인 유사도 기반 매칭용 match_restaurants RPC 함수 정의
CREATE OR REPLACE FUNCTION match_restaurants (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  address text,
  road_address text,
  lat double precision,
  lng double precision,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.category,
    r.address,
    r.road_address,
    r.lat,
    r.lng,
    (1 - (re.embedding <=> query_embedding))::float AS similarity
  FROM restaurants r
  JOIN restaurant_embeddings re ON r.id = re.restaurant_id
  WHERE (1 - (re.embedding <=> query_embedding)) > match_threshold
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. user_submissions 테이블 RLS 제어권 해제 및 프리미엄 오픈 PWA용 전방위 삽입 정책 적용
ALTER TABLE user_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert submissions" ON user_submissions;
CREATE POLICY "Anyone can insert submissions" ON user_submissions 
  FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read submissions" ON user_submissions;
CREATE POLICY "Anyone can read submissions" ON user_submissions 
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Anyone can update submissions" ON user_submissions;
CREATE POLICY "Anyone can update submissions" ON user_submissions 
  FOR UPDATE 
  USING (true);
