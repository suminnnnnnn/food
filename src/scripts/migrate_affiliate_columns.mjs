// Phase 0 — affiliate_videos / affiliate_products 부족 컬럼 추가 (additive, idempotent)
// 컴포넌트(ShoppingTabView) + 수집 파이프라인이 요구하는 필드.
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

try {
  await sql.unsafe(`
    ALTER TABLE affiliate_videos
      ADD COLUMN IF NOT EXISTS category  text,
      ADD COLUMN IF NOT EXISTS min_price int,
      ADD COLUMN IF NOT EXISTS status    text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected'));

    ALTER TABLE affiliate_products
      ADD COLUMN IF NOT EXISTS subtitle     text,
      ADD COLUMN IF NOT EXISTS price        int,
      ADD COLUMN IF NOT EXISTS badge        text,
      ADD COLUMN IF NOT EXISTS mention_time text,
      ADD COLUMN IF NOT EXISTS platform     text NOT NULL DEFAULT 'coupang',
      ADD COLUMN IF NOT EXISTS confidence   real,
      ADD COLUMN IF NOT EXISTS evidence     text;

    CREATE INDEX IF NOT EXISTS idx_affiliate_videos_status_pub
      ON affiliate_videos (status, published_at DESC);
  `);
  console.log('OK — 컬럼 추가 완료');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
