// 맛집 콘텐츠 전체 초기화 (오픈 전 클린 리셋). 스키마·curation_sources·밀키트 제휴 테이블은 보존.
// 실행: node src/scripts/wipe_restaurants.mjs   (⚠️ 반드시 backup_restaurants.mjs 먼저)
import postgres from 'postgres';
import fs from 'fs';
const env = fs.readFileSync('C:/modoo-matjip/food-feat-rebranding-modoo-matjip/.env.local', 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });

// 종속 순서대로 개별 실행 (없는 테이블은 무시)
const steps = [
  ['user_submissions FK 해제', `UPDATE user_submissions SET resolved_restaurant_id = NULL`],
  ['restaurant_videos', `DELETE FROM restaurant_videos`],
  ['restaurant_curations', `DELETE FROM restaurant_curations`],
  ['restaurant_embeddings', `DELETE FROM restaurant_embeddings`],
  ['user_favorites', `DELETE FROM user_favorites`],
  ['group_map_votes', `DELETE FROM group_map_votes`],
  ['group_map_items', `DELETE FROM group_map_items`],
  ['videos', `DELETE FROM videos`],
  ['series', `DELETE FROM series`],
  ['channels', `DELETE FROM channels`],
  ['restaurants', `DELETE FROM restaurants`],
];

for (const [label, stmt] of steps) {
  try {
    const res = await sql.unsafe(stmt);
    console.log(`OK  ${label} — ${res.count ?? 0}건`);
  } catch (e) {
    console.log(`SKIP ${label} — ${e.message}`);
  }
}

// 잔여 개수 확인
for (const t of ['restaurants', 'videos', 'channels', 'restaurant_videos']) {
  try {
    const [{ count }] = await sql.unsafe(`SELECT count(*)::int AS count FROM ${t}`);
    console.log(`남은 ${t}: ${count}`);
  } catch {}
}

await sql.end();
process.exit(0);
