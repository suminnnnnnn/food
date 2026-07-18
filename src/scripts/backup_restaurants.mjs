// 와이프 전 전체 백업. restaurants/videos/channels/restaurant_videos를 JSON 스냅샷으로 저장.
// 실행: node src/scripts/backup_restaurants.mjs   (경로: backups/restaurants-<stamp>.json)
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/modoo-matjip/food-feat-rebranding-modoo-matjip';
const env = fs.readFileSync(`${ROOT}/.env.local`, 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });

const stamp = (process.argv[2] || 'manual').replace(/[^0-9a-zA-Z_-]/g, '');
const dir = path.join(ROOT, 'backups');
fs.mkdirSync(dir, { recursive: true });

const dump = {};
for (const t of ['restaurants', 'videos', 'channels', 'restaurant_videos', 'series']) {
  try { dump[t] = await sql.unsafe(`SELECT * FROM ${t}`); console.log(`${t}: ${dump[t].length}건`); }
  catch (e) { dump[t] = []; console.log(`${t}: 스킵(${e.message.slice(0, 60)})`); }
}
const file = path.join(dir, `restaurants-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(dump, null, 2), 'utf8');
console.log(`\n백업 저장: ${file} (${(fs.statSync(file).size / 1024).toFixed(0)}KB)`);
await sql.end();
