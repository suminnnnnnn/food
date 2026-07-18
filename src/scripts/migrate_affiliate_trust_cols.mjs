// affiliate_products — 밀키트 신뢰도 스코어링 컬럼 추가 (additive, idempotent)
// 실행: node src/scripts/migrate_affiliate_trust_cols.mjs
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
try {
  await sql.unsafe(`
    ALTER TABLE affiliate_products
      ADD COLUMN IF NOT EXISTS trust_score int,
      ADD COLUMN IF NOT EXISTS maker_type  text,
      ADD COLUMN IF NOT EXISTS maker_name  text;
  `);
  console.log('OK — trust_score / maker_type / maker_name 추가');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
