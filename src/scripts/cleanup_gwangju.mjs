// 광주 오매칭(경기 광주 등 타깃 외) 정리 + 고아 영상 정리
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const COND = `address NOT LIKE '%전남광주통합특별시%' AND address NOT LIKE '%광주광역시%'`;

await sql.unsafe(`DELETE FROM restaurant_videos WHERE restaurant_id IN (SELECT id FROM restaurants WHERE ${COND})`);
try { await sql.unsafe(`DELETE FROM restaurant_embeddings WHERE restaurant_id IN (SELECT id FROM restaurants WHERE ${COND})`); } catch {}
const del = await sql.unsafe(`DELETE FROM restaurants WHERE ${COND}`);
console.log('삭제된 오매칭 식당:', del.count);
const orphan = await sql.unsafe(`DELETE FROM videos WHERE id NOT IN (SELECT video_id FROM restaurant_videos WHERE video_id IS NOT NULL)`);
console.log('고아 영상 삭제:', orphan.count);
const [c] = await sql.unsafe(`SELECT count(*)::int total FROM restaurants`);
console.log('남은 식당:', c.total);
await sql.end();
process.exit(0);
