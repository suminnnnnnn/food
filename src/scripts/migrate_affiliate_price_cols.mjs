// affiliate_products — 쇼핑몰별 URL + 가격 기준시각 컬럼 추가 (additive, idempotent)
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
try {
  await sql.unsafe(`
    ALTER TABLE affiliate_products
      ADD COLUMN IF NOT EXISTS coupang_url      text,
      ADD COLUMN IF NOT EXISTS naver_url        text,
      ADD COLUMN IF NOT EXISTS price_checked_at timestamptz;
  `);
  console.log('OK — coupang_url / naver_url / price_checked_at 추가');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
