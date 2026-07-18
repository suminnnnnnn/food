// 착한가격업소(행정안전부 공공데이터) 보강 — 공식 메뉴+가격 + '착한가격업소' 인증 배지(curation).
// 영업시간은 이 데이터엔 없음. 저장·서비스 제공 합법(출처: 행정안전부).
// 실행: node --env-file=.env.local src/scripts/enrich_from_chakhan.mjs
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const KEY = process.env.TOUR_API_KEY;
if (!KEY) { console.error('TOUR_API_KEY 없음'); process.exit(1); }

const DATASET = 'uddi:6c32457a-bd61-4721-8dfd-c7b18991bf3e'; // 2025-06-30 최신
const norm = (s) => (s || '').replace(/\s/g, '').replace(/(본점|직영점|점)$/, '').toLowerCase();
const digits = (s) => (s || '').replace(/\D/g, '');

async function fetchAll() {
  const all = []; let page = 1;
  while (true) {
    const u = `https://api.odcloud.kr/api/3045247/v1/${DATASET}?page=${page}&perPage=1000&serviceKey=${KEY}&returnType=JSON`;
    const d = await (await fetch(u)).json();
    const rows = d.data || [];
    all.push(...rows);
    if (rows.length < 1000 || all.length >= (d.totalCount || 0)) break;
    page++;
  }
  return all;
}
function buildMenu(row) {
  const parts = [];
  for (let i = 1; i <= 4; i++) { const m = row[`메뉴${i}`], p = row[`가격${i}`]; if (m) parts.push(p ? `${m} ${Number(p).toLocaleString()}원` : m); }
  return parts.join(', ');
}

async function main() {
  const all = await fetchAll();
  const gwangju = all.filter(r => (r.시도 || '').includes('광주'));
  console.log(`\n🏷️ 착한가격업소 전국 ${all.length} · 광주 ${gwangju.length}`);
  const byName = new Map();
  gwangju.forEach(r => { const k = norm(r.업소명); if (!byName.has(k)) byName.set(k, r); });

  // 착한가격업소 curation source 등록(배지용)
  const { data: src } = await supabase.from('curation_sources').upsert({ code: 'chakhan_price', name: '착한가격업소' }, { onConflict: 'code' }).select('id').single();

  const { data: rests } = await supabase.from('restaurants').select('id, name, phone, menu_info');
  let matched = 0, menuFilled = 0, badged = 0;
  for (const r of rests) {
    const c = byName.get(norm(r.name));
    if (!c) continue;
    // 전화가 양쪽에 있으면 일치 확인(오매칭 방지); 없으면 상호+광주 매칭 허용
    if (r.phone && c.연락처 && digits(r.phone).slice(-8) !== digits(c.연락처).slice(-8)) continue;
    matched++;
    const menu = buildMenu(c);
    if (menu && (!r.menu_info || r.menu_info === '정보 없음')) { await supabase.from('restaurants').update({ menu_info: menu }).eq('id', r.id); menuFilled++; }
    if (src?.id) {
      const { data: ex } = await supabase.from('restaurant_curations').select('id').eq('restaurant_id', r.id).eq('source_id', src.id).limit(1);
      if (!ex || !ex.length) { await supabase.from('restaurant_curations').insert({ restaurant_id: r.id, source_id: src.id, metadata: { menu } }); badged++; }
    }
    console.log(`  ✅ ${r.name}${menu ? ' · ' + menu.slice(0, 40) : ''}`);
  }
  console.log(`\n=== 완료: 매칭 ${matched} · 메뉴채움 ${menuFilled} · 착한가격 배지 ${badged} ===`);
  process.exit(0);
}
main();
