// 목업용: 잘 채워진 광주 식당 1건 + 크리에이터/영상/메뉴 덤프
import postgres from 'postgres';
import fs from 'fs';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

// 기능 최대 커버: 메뉴 여러개 + 영업시간 + 전화 + (주차/예약/포장 중 하나 이상) 있는 식당 우선
const [r] = await sql`
  SELECT r.*, (SELECT count(*) FROM restaurant_videos rv WHERE rv.restaurant_id = r.id) AS vcount
  FROM restaurants r
  WHERE r.menu_info LIKE '%,%'
    AND r.phone IS NOT NULL AND r.business_hours IS NOT NULL AND r.business_hours <> '정보 없음'
    AND (r.parking NOT IN ('정보 없음') OR r.reservation NOT IN ('정보 없음') OR r.packaging NOT IN ('정보 없음'))
  ORDER BY vcount DESC NULLS LAST
  LIMIT 1`;

const vids = await sql`
  SELECT rv.quote, rv.keywords, v.title, v.view_count, v.thumbnail_url, v.published_at,
         c.name AS channel_name, c.subscriber_count
  FROM restaurant_videos rv
  JOIN videos v ON v.id = rv.video_id
  LEFT JOIN channels c ON c.id = v.channel_id
  WHERE rv.restaurant_id = ${r.id}
  ORDER BY v.view_count DESC NULLS LAST`;

const out = 'C:/Users/c9611/AppData/Local/Temp/claude/C--modoo-matjip/538f0f78-c362-430f-894a-6885ab214e81/scratchpad/one.json';
fs.writeFileSync(out, JSON.stringify({ r, vids }, null, 2), 'utf8');
console.log('NAME', r.name, '| CAT', r.category, '| ADDR', r.address);
console.log('PHONE', r.phone, '| HOURS', r.business_hours);
console.log('PARK', r.parking, '| RESV', r.reservation, '| PACK', r.packaging);
console.log('MENU', (r.menu_info || '').slice(0, 200));
console.log('AI_TAGS', JSON.stringify(r.ai_tags));
console.log('VIDS', vids.length, vids.map(v => `${v.channel_name}(${v.view_count})`).join(', '));
console.log('QUOTE', vids[0]?.quote);
console.log('KW', JSON.stringify(vids[0]?.keywords));
await sql.end();
process.exit(0);
