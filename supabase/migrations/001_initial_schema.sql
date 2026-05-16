-- =================================================================================
-- Place 프로젝트 통합 DB 스키마 (Supabase / PostgreSQL)
-- =================================================================================

-- 1. Base Restaurants Table (식당 기본 데이터: 카카오맵 등 공공데이터 시드)
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_place_id TEXT UNIQUE NOT NULL, -- 외부 API 중복 방지용 고유키
  name TEXT NOT NULL,
  category TEXT,
  address TEXT,
  road_address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================================
-- 2. YouTube Domain (채널 - 시리즈 - 비디오 계층 구조)
-- =================================================================================

-- 유튜브 채널
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_channel_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, -- 예: '스튜디오 수제'
  profile_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 유튜브 시리즈 (코너)
CREATE TABLE IF NOT EXISTS series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 예: '또간집', '먹을텐데'
  host_name TEXT,     -- 예: '풍자', '성시경'
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 개별 유튜브 영상
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  series_id UUID REFERENCES series(id) ON DELETE SET NULL, -- 시리즈가 없는 경우 NULL
  youtube_video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  is_short BOOLEAN DEFAULT FALSE, -- 쇼츠 여부
  view_count BIGINT DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 식당과 영상의 다대다(N:M) 매핑 및 한줄평
CREATE TABLE IF NOT EXISTS restaurant_videos (
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  mention_time INT, -- 영상 내 등장 시간(초) -> 추후 딥링크용
  quote TEXT,       -- 유튜버의 핵심 한줄평 (UI 노출용)
  PRIMARY KEY (restaurant_id, video_id)
);

-- =================================================================================
-- 3. Curation & Tagging Domain (미쉐린, 흑백요리사 등 유연한 동적 태그)
-- =================================================================================

-- 권위 있는 출처 (미디어, 어워즈 등)
CREATE TABLE IF NOT EXISTS curation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 예: 'michelin', 'netflix_chef', 'blueribbon'
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 식당별 큐레이션 매핑 (JSONB 메타데이터 활용)
CREATE TABLE IF NOT EXISTS restaurant_curations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  source_id UUID REFERENCES curation_sources(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb, -- 유연한 확장 (예: {"chef_name": "최현석", "team": "백수저"})
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================================
-- 4. Initial Seed Data (큐레이션 출처 기본값 적재)
-- =================================================================================
INSERT INTO curation_sources (code, name) VALUES 
('michelin', '미쉐린 가이드 서울'),
('netflix_chef', '흑백요리사: 요리 계급 전쟁'),
('blueribbon', '블루리본 서베이')
ON CONFLICT (code) DO NOTHING;
