// 지역 오염 진단 — 식당 주소 vs 매핑 영상 제목 불일치 탐지.
// (1) 주소가 광주 아님(필터 구멍)  (2) 주소는 광주지만 영상 제목이 타 지역(동명 식당 오매칭)
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

// 광주광역시 5개 구 (이것만 진짜 광주). "전남광주통합특별시 OO시/군"은 전남 타지역.
const GU = ['동구', '서구', '남구', '북구', '광산구'];
function gwangjuCity(addr) {
  if (!addr) return null;
  if (addr.includes('광주광역시')) {
    const rest = addr.split('광주광역시')[1].trim().split(/\s+/)[0];
    return GU.includes(rest) ? rest : null;
  }
  if (addr.includes('전남광주통합특별시')) {
    const rest = addr.split('전남광주통합특별시')[1].trim().split(/\s+/)[0];
    return GU.includes(rest) ? rest : null; // 구가 아니면(여수시·담양군 등) 광주 아님
  }
  return null;
}

const rows = await sql`
  SELECT r.id, r.name, r.address, coalesce(string_agg(v.title, ' | '), '') AS titles
  FROM restaurants r
  LEFT JOIN restaurant_videos rv ON rv.restaurant_id = r.id
  LEFT JOIN videos v ON v.id = rv.video_id
  GROUP BY r.id, r.name, r.address
  ORDER BY r.address`;

const bad = [];
for (const r of rows) {
  if (!gwangjuCity(r.address)) bad.push(r);
}

console.log(`\n총 ${rows.length}개 | 광주(5개구) ${rows.length - bad.length} | 비광주 ${bad.length}`);
console.log(`\n[비광주 — 삭제 대상]`);
bad.forEach(r => {
  const region = (r.address || '').replace(/전남광주통합특별시\s*|광주광역시\s*/, '').split(/\s+/)[0];
  console.log(`  · ${r.name} [${region}] — ${r.address}\n      ▷ ${(r.titles || '').slice(0, 120)}`);
});

await sql.end();
process.exit(0);
