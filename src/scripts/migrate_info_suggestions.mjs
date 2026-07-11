// 정보 수정 제안 테이블 + 제보 시 영업시간/메뉴 입력 컬럼 (additive)
// 실행: node --env-file=.env.local src/scripts/migrate_info_suggestions.mjs
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
try {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS restaurant_info_suggestions (
      id             bigserial PRIMARY KEY,
      restaurant_id  uuid REFERENCES restaurants(id) ON DELETE CASCADE,
      business_hours text,
      menu_info      text,
      phone          text,
      note           text,
      status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','rejected')),
      created_at     timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_info_sugg_status ON restaurant_info_suggestions (status, created_at DESC);

    ALTER TABLE user_submissions
      ADD COLUMN IF NOT EXISTS sub_business_hours text,
      ADD COLUMN IF NOT EXISTS sub_menu text;
  `);
  console.log('OK — restaurant_info_suggestions 테이블 + user_submissions.sub_business_hours/sub_menu 추가');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
