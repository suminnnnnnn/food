import postgres from 'postgres';
import fs from 'fs';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const rows = await sql`
  SELECT r.name, r.menu_info, r.parking, r.reservation, r.packaging, r.business_hours,
    (SELECT rv.quote FROM restaurant_videos rv WHERE rv.restaurant_id = r.id LIMIT 1) AS quote,
    (SELECT rv.keywords FROM restaurant_videos rv WHERE rv.restaurant_id = r.id LIMIT 1) AS keywords
  FROM restaurants r ORDER BY r.created_at ASC LIMIT 5`;
fs.writeFileSync('C:/Users/c9611/AppData/Local/Temp/claude/C--modoo-matjip/538f0f78-c362-430f-894a-6885ab214e81/scratchpad/sample.json', JSON.stringify(rows, null, 2), 'utf8');
console.log('written', rows.length);
await sql.end(); process.exit(0);
