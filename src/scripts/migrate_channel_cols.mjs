// affiliate_videos — 크리에이터 권위 표시용 채널 컬럼 (additive, idempotent)
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
try {
  await sql.unsafe(`
    ALTER TABLE affiliate_videos
      ADD COLUMN IF NOT EXISTS channel_id        text,
      ADD COLUMN IF NOT EXISTS subscriber_count  int,
      ADD COLUMN IF NOT EXISTS channel_thumbnail text;
  `);
  console.log('OK — channel_id / subscriber_count / channel_thumbnail 추가');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
