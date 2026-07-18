// restaurants — AI 영상분석 자유생성 태그 저장 (additive, idempotent).
// ai_tags: [{ tag, evidence, confidence }]  (정규화 전 원태그. 정규화는 추후 단계에서 별도 반영)
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
try {
  await sql.unsafe(`
    ALTER TABLE restaurants
      ADD COLUMN IF NOT EXISTS ai_tags jsonb;
  `);
  console.log('OK — restaurants.ai_tags 추가');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
