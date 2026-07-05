DROP TABLE IF EXISTS affiliate_products CASCADE;
DROP TABLE IF EXISTS affiliate_videos CASCADE;

CREATE TABLE affiliate_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  channel_title TEXT,
  view_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES affiliate_videos(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  brand TEXT,
  search_url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 추가 (빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_affiliate_products_video_id ON affiliate_products(video_id);
