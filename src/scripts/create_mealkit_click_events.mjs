// mealkit_click_events — 쇼핑탭 제휴 클릭 로그 (uuid 모델 기준, 레거시 affiliate_events와 무관)
// FK 없이 순수 로그 테이블(상품/영상 삭제돼도 이력 보존). 실행: node src/scripts/create_mealkit_click_events.mjs
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
try {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS mealkit_click_events (
      id          bigserial PRIMARY KEY,
      product_id  uuid,
      video_id    uuid,
      event_type  text NOT NULL DEFAULT 'click',
      platform    text,
      reason      text,
      url         text,
      referrer    text,
      session_id  text,
      user_agent  text,
      created_at  timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_mce_created ON mealkit_click_events (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mce_product ON mealkit_click_events (product_id);
  `);
  console.log('OK — mealkit_click_events 생성');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
