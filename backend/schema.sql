-- =============================================================
-- path: backend/schema.sql
-- Harness Map — PostGIS 공간 데이터베이스 DDL + 시드 데이터
-- 실행: psql -d harness_map -f schema.sql
-- =============================================================

-- Step 1: PostGIS 확장 모듈
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: 맛집 테이블
CREATE TABLE IF NOT EXISTS restaurants (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    address       VARCHAR(500),
    category      VARCHAR(100),
    trend_tags    TEXT[],                          -- 제철/트렌드 다이얼 필터용
    location      GEOMETRY(Point, 4326) NOT NULL,  -- WGS84 좌표
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: GIST 인덱스 — ST_DWithin 반경 검색 최적화
CREATE INDEX IF NOT EXISTS idx_restaurants_location
    ON restaurants USING GIST (location);

-- Step 4: 비디오 메타데이터 테이블
CREATE TABLE IF NOT EXISTS videos (
    id              SERIAL PRIMARY KEY,
    restaurant_id   INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    youtuber_name   VARCHAR(255) NOT NULL,
    video_url       TEXT NOT NULL,
    thumbnail_url   TEXT,
    description     TEXT,
    view_count      INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_videos_restaurant_id
    ON videos (restaurant_id);

-- =============================================================
-- 시드 데이터 — 강남역 인근 맛집 5곳 + 공개 mp4 URL
-- =============================================================

INSERT INTO restaurants (name, address, category, trend_tags, location) VALUES
(
    '강남 제철방어 횟집',
    '서울 강남구 역삼동 123-4',
    '해산물',
    ARRAY['방어', '겨울', '제철'],
    ST_SetSRID(ST_MakePoint(127.0276, 37.4979), 4326)
),
(
    '신논현 마라탕',
    '서울 강남구 논현동 55-1',
    '중식',
    ARRAY['마라', '매운맛', '트렌드'],
    ST_SetSRID(ST_MakePoint(127.0240, 37.5045), 4326)
),
(
    '역삼동 흑돼지',
    '서울 강남구 역삼동 789-2',
    '육류',
    ARRAY['삼겹살', '회식'],
    ST_SetSRID(ST_MakePoint(127.0350, 37.4999), 4326)
),
(
    '강남 스시오마카세',
    '서울 강남구 역삼동 456-7',
    '일식',
    ARRAY['오마카세', '데이트', '트렌드'],
    ST_SetSRID(ST_MakePoint(127.0310, 37.5010), 4326)
),
(
    '논현 양꼬치',
    '서울 강남구 논현동 88-3',
    '중식',
    ARRAY['양꼬치', '야식', '매운맛'],
    ST_SetSRID(ST_MakePoint(127.0220, 37.5060), 4326)
);

INSERT INTO videos (restaurant_id, youtuber_name, video_url, thumbnail_url, description) VALUES
(1, '먹방요정',   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',    'https://picsum.photos/400/600?random=1', '강남역에서 만나는 역대급 겨울 대방어 해체쇼!'),
(2, '매운맛킬러', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',  'https://picsum.photos/400/600?random=2', '눈물 콧물 쏙 빼는 찐 마라탕 맛집'),
(3, '고기러버',   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',     'https://picsum.photos/400/600?random=3', '육즙 팡팡 터지는 역삼동 흑돼지구이'),
(4, '스시왕',     'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',   'https://picsum.photos/400/600?random=4', '가성비 최고 강남 스시 오마카세'),
(5, '야식탐험대', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',       'https://picsum.photos/400/600?random=5', '논현동 양꼬치 골목 최강자는 여기!');
