// Phase 0 검증 — affiliate_videos / affiliate_products 실제 스키마·데이터 점검 (읽기 전용)
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const tables = ['affiliate_videos', 'affiliate_products', 'affiliate_events'];

try {
  for (const t of tables) {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${t}
      ORDER BY ordinal_position`;
    if (cols.length === 0) {
      console.log(`\n[${t}] — 테이블 없음`);
      continue;
    }
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM ${sql(t)}`;
    console.log(`\n[${t}] rows=${count}`);
    for (const c of cols) {
      console.log(`  - ${c.column_name} : ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}${c.column_default ? ' DEFAULT ' + c.column_default : ''}`);
    }
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
