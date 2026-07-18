// user_itineraries.color 추가 — 일정 색상을 사용자가 지정. additive·idempotent.
// 실행: node --env-file=.env.local src/scripts/migrate_itinerary_color.mjs
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
try {
  await sql.unsafe(`
    ALTER TABLE user_itineraries ADD COLUMN IF NOT EXISTS color text;
  `);
  console.log('OK — user_itineraries.color 추가 완료');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
