-- =================================================================================
-- 맛집 저장 폴더, 폴더 내 식당 매핑, 협업 멤버 테이블 생성 및 RLS 정책
-- =================================================================================

-- 1. 맛집 폴더 테이블
CREATE TABLE IF NOT EXISTS user_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '⭐',
  color TEXT DEFAULT '#ff6b00',
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_collaborative BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 협업 폴더 멤버 테이블 (공동 편집용)
CREATE TABLE IF NOT EXISTS folder_members (
  folder_id UUID REFERENCES user_folders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (folder_id, user_id)
);

-- 3. 폴더 내 저장된 맛집 상세 매핑 (방문 정보, 태그, 개별 메모 포함)
CREATE TABLE IF NOT EXISTS folder_restaurants (
  folder_id UUID REFERENCES user_folders(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- 추가한 사람 (협업 시 구분용)
  memo TEXT,
  visited BOOLEAN DEFAULT FALSE,
  visit_count INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}', -- 사용자가 설정한 커스텀 검색 태그
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (folder_id, restaurant_id)
);

-- =================================================================================
-- RLS (Row Level Security) 설정 및 정책 정의
-- =================================================================================

-- 1) user_folders RLS
ALTER TABLE user_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select folders they created or are members of"
  ON user_folders
  FOR SELECT
  USING (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM folder_members
      WHERE folder_members.folder_id = user_folders.id AND folder_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create folders"
  ON user_folders
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update folders"
  ON user_folders
  FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete folders"
  ON user_folders
  FOR DELETE
  USING (auth.uid() = creator_id);


-- 2) folder_members RLS
ALTER TABLE folder_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can select membership info"
  ON folder_members
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_folders
      WHERE user_folders.id = folder_id AND user_folders.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM folder_members m
      WHERE m.folder_id = folder_members.folder_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Folder creators can manage members"
  ON folder_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_folders
      WHERE user_folders.id = folder_id AND user_folders.creator_id = auth.uid()
    )
  );


-- 3) folder_restaurants RLS
ALTER TABLE folder_restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select items from folders they can access"
  ON folder_restaurants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_folders f
      WHERE f.id = folder_id AND (
        f.creator_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM folder_members m
          WHERE m.folder_id = f.id AND m.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Folder members and creators can insert items"
  ON folder_restaurants
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_folders f
      WHERE f.id = folder_id AND (
        f.creator_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM folder_members m
          WHERE m.folder_id = f.id AND m.user_id = auth.uid() AND m.role = 'editor'
        )
      )
    )
  );

CREATE POLICY "Folder members and creators can update items"
  ON folder_restaurants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_folders f
      WHERE f.id = folder_id AND (
        f.creator_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM folder_members m
          WHERE m.folder_id = f.id AND m.user_id = auth.uid() AND m.role = 'editor'
        )
      )
    )
  );

CREATE POLICY "Folder members and creators can delete items"
  ON folder_restaurants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_folders f
      WHERE f.id = folder_id AND (
        f.creator_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM folder_members m
          WHERE m.folder_id = f.id AND m.user_id = auth.uid() AND m.role = 'editor'
        )
      )
    )
  );
