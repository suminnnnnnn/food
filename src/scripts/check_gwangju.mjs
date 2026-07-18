// 광주 시드 QA — 타깃(전남광주통합특별시) 외 오매칭 식별. 결과를 scratchpad JSON으로 출력.
import postgres from 'postgres';
import fs from 'fs';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const [counts] = await sql`
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE address LIKE '%전남광주통합특별시%')::int AS gwangju_merged,
    count(*) FILTER (WHERE address LIKE '%광주광역시%')::int AS gwangju_old,
    count(*) FILTER (WHERE address LIKE '%경기%')::int AS gyeonggi,
    count(*) FILTER (WHERE menu_info = '정보 없음' OR menu_info IS NULL)::int AS no_menu
  FROM restaurants`;

const nontarget = await sql`
  SELECT id, name, address FROM restaurants
  WHERE address NOT LIKE '%전남광주통합특별시%' AND address NOT LIKE '%광주광역시%'`;

const out = 'C:/Users/c9611/AppData/Local/Temp/claude/C--modoo-matjip/538f0f78-c362-430f-894a-6885ab214e81/scratchpad/gwangju_qa.json';
fs.writeFileSync(out, JSON.stringify({ counts, nontarget }, null, 2), 'utf8');
console.log('total', counts.total, '| merged', counts.gwangju_merged, '| old', counts.gwangju_old, '| gyeonggi', counts.gyeonggi, '| no_menu', counts.no_menu, '| nontarget', nontarget.length);
await sql.end();
process.exit(0);
