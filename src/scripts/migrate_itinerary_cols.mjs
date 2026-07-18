// user_itineraries 테이블 생성/보강 (없어서 서버 저장이 안 됐음). additive·idempotent.
// 앱은 anon 키 + 앱레벨 user_id 필터로 접근하므로 RLS 비활성 + grant.
// 실행: node --env-file=.env.local src/scripts/migrate_itinerary_cols.mjs
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
try {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS user_itineraries (
      id         text PRIMARY KEY,
      user_id    text NOT NULL,
      title      text,
      start_date text,
      end_date   text,
      days       jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    ALTER TABLE user_itineraries ADD COLUMN IF NOT EXISTS start_date text;
    ALTER TABLE user_itineraries ADD COLUMN IF NOT EXISTS end_date   text;
    CREATE INDEX IF NOT EXISTS idx_user_itineraries_user ON user_itineraries(user_id);
    ALTER TABLE user_itineraries DISABLE ROW LEVEL SECURITY;
    GRANT ALL ON user_itineraries TO anon, authenticated, service_role;
  `);
  console.log('OK — user_itineraries 생성/보강 완료');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
