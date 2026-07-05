// affiliate_* 테이블 RLS 비활성화 — 서버(cron/admin 라우트)의 insert/update 허용.
// 기존 disable_rls.mjs와 동일한 프로젝트 컨벤션(콘텐츠 테이블은 RLS off).
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

try {
  for (const t of ['affiliate_videos', 'affiliate_products', 'affiliate_events']) {
    await sql.unsafe(`ALTER TABLE ${t} DISABLE ROW LEVEL SECURITY`);
    console.log(`RLS off: ${t}`);
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
