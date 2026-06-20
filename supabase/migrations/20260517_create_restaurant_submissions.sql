-- 제보 대기열 테이블 생성
CREATE TABLE restaurant_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kakao_place_id TEXT NOT NULL,       -- 카카오 고유 ID
    restaurant_name TEXT NOT NULL,      -- 식당 이름 (카카오 기준)
    address TEXT NOT NULL,              -- 지번/도로명 주소
    lat DOUBLE PRECISION NOT NULL,      -- 위도
    lng DOUBLE PRECISION NOT NULL,      -- 경도
    youtube_url TEXT NOT NULL,          -- 제출된 유튜브 링크
    status TEXT NOT NULL DEFAULT 'pending', -- 상태 (pending, approved, rejected)
    ai_review_result JSONB,             -- AI 심사 결과 및 사유 (JSON)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS(Row Level Security) 설정
ALTER TABLE restaurant_submissions ENABLE ROW LEVEL SECURITY;

-- 누구나 제보(Insert) 가능, 조회(Select)는 관리자 또는 본인만 (임시로 전체 허용)
CREATE POLICY "Anyone can insert submissions" ON restaurant_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read submissions" ON restaurant_submissions FOR SELECT USING (true);
