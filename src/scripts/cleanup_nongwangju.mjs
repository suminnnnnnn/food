// 비광주(전남 타 시/군) 식당 정리 — 주소 구/군이 광주 5개 구가 아니면 삭제.
// "전남광주통합특별시"는 전남 전역 접두어라 구/군 토큰으로만 판별. (여수시·담양군 등 = 삭제)
// 실행: node --env-file=.env.local src/scripts/cleanup_nongwangju.mjs   (DRY=1 이면 미리보기만)
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const DRY = process.env.DRY === '1';
const GU = ['동구', '서구', '남구', '북구', '광산구'];

function gwangjuCity(addr) {
  if (!addr) return null;
  for (const p of ['광주광역시', '전남광주통합특별시']) {
    if (addr.includes(p)) {
      const tok = addr.split(p)[1].trim().split(/\s+/)[0];
      return GU.includes(tok) ? tok : null;
    }
  }
  return null;
}

const rests = await sql`SELECT id, name, address FROM restaurants`;
const bad = rests.filter(r => !gwangjuCity(r.address));
console.log(`총 ${rests.length} | 광주 ${rests.length - bad.length} | 비광주(삭제) ${bad.length}`);
bad.forEach(r => console.log(`  · ${r.name} — ${r.address}`));

if (!bad.length) { console.log('삭제 대상 없음'); await sql.end(); process.exit(0); }
if (DRY) { console.log('\n[DRY] 미리보기만. 실제 삭제하려면 DRY 없이 실행.'); await sql.end(); process.exit(0); }

const ids = bad.map(r => r.id);
const steps = [
  ['user_submissions FK 해제', sql`UPDATE user_submissions SET resolved_restaurant_id = NULL WHERE resolved_restaurant_id = ANY(${ids})`],
  ['restaurant_videos', sql`DELETE FROM restaurant_videos WHERE restaurant_id = ANY(${ids})`],
  ['restaurant_curations', sql`DELETE FROM restaurant_curations WHERE restaurant_id = ANY(${ids})`],
  ['restaurant_embeddings', sql`DELETE FROM restaurant_embeddings WHERE restaurant_id = ANY(${ids})`],
  ['user_favorites', sql`DELETE FROM user_favorites WHERE restaurant_id = ANY(${ids})`],
  ['group_map_votes', sql`DELETE FROM group_map_votes WHERE item_id IN (SELECT id FROM group_map_items WHERE restaurant_id = ANY(${ids}))`],
  ['group_map_items', sql`DELETE FROM group_map_items WHERE restaurant_id = ANY(${ids})`],
  ['restaurants', sql`DELETE FROM restaurants WHERE id = ANY(${ids})`],
  // 고아 정리: 아무 식당에도 안 붙은 영상 → 그 후 영상 없는 채널
  ['orphan videos', sql`DELETE FROM videos WHERE id NOT IN (SELECT DISTINCT video_id FROM restaurant_videos)`],
  ['orphan channels', sql`DELETE FROM channels WHERE id NOT IN (SELECT DISTINCT channel_id FROM videos WHERE channel_id IS NOT NULL)`],
];
for (const [label, q] of steps) {
  try { const res = await q; console.log(`OK  ${label} — ${res.count ?? 0}건`); }
  catch (e) { console.log(`SKIP ${label} — ${e.message}`); }
}

const [{ count }] = await sql`SELECT count(*)::int AS count FROM restaurants`;
console.log(`\n남은 식당: ${count}`);
await sql.end();
process.exit(0);
