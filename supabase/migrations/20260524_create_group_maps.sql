-- =================================================================================
-- 공유형 지도 (Group Maps) 테이블 생성 및 RLS 정책
-- =================================================================================

-- 1. 공유 지도 정보
CREATE TABLE IF NOT EXISTS group_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  creator_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 공유 지도 내 식당 후보 리스트
CREATE TABLE IF NOT EXISTS group_map_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_map_id UUID REFERENCES group_maps(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_map_id, restaurant_id) -- 한 지도 내 중복 추가 방지
);

-- 3. 후보 식당 투표 내역
CREATE TABLE IF NOT EXISTS group_map_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES group_map_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, user_id) -- 1인 1투표 제한 (다중 식당 투표는 허용)
);

-- =================================================================================
-- RLS (Row Level Security) 설정
-- =================================================================================

-- group_maps: 누구나 읽기 가능, 생성은 누구나 가능(앱 내 로직에서 로그인 요구), 수정/삭제는 생성자만
ALTER TABLE group_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read group maps" ON group_maps FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create group maps" ON group_maps FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update group maps" ON group_maps FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete group maps" ON group_maps FOR DELETE USING (auth.uid() = creator_id);

-- group_map_items: 누구나 읽기 가능, 추가는 인증 유저만
ALTER TABLE group_map_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read group map items" ON group_map_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert group map items" ON group_map_items FOR INSERT WITH CHECK (auth.uid() = added_by);
CREATE POLICY "Added by user can delete group map items" ON group_map_items FOR DELETE USING (auth.uid() = added_by);

-- group_map_votes: 누구나 읽기 가능, 투표/취소는 인증 유저만 (자신의 투표만)
ALTER TABLE group_map_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read group map votes" ON group_map_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote" ON group_map_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their vote" ON group_map_votes FOR DELETE USING (auth.uid() = user_id);
