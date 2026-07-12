// 기존 TourAPI 영업시간(business_hours_source='tour')을 이용자 제보 포맷으로 일괄 정규화.
// 실행: node src/scripts/normalize_tour_hours.mjs   (DRY=1 이면 미리보기만)
import postgres from 'postgres';
import fs from 'fs';
import { normalizeBusinessHours } from '../lib/hours.mjs';

const env = fs.readFileSync('C:/modoo-matjip/food-feat-rebranding-modoo-matjip/.env.local', 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const DRY = process.env.DRY === '1';

const rows = await sql`SELECT id, name, business_hours FROM restaurants WHERE business_hours_source='tour' AND business_hours <> '정보 없음'`;
let changed = 0;
for (const r of rows) {
  const norm = normalizeBusinessHours(r.business_hours);
  if (norm === r.business_hours) continue;
  changed++;
  console.log(`\n[${r.name}]\n  이전: ${r.business_hours}\n  이후: ${norm.replace(/\n/g, ' | ')}`);
  if (!DRY) await sql`UPDATE restaurants SET business_hours = ${norm} WHERE id = ${r.id}`;
}
console.log(`\n${DRY ? '[DRY] ' : ''}변경 ${changed}/${rows.length}건`);
await sql.end();
