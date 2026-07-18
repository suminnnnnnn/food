// 전화번호 백필 — Kakao 키워드검색(상호명 광주)으로 phone 채움. 무위험(공식 API).
// 실행: node --env-file=.env.local src/scripts/enrich_phone.mjs
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const KAKAO = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

async function kakaoPhone(name, placeId) {
  for (const q of [`${name} 광주`, name]) {
    try {
      const data = await (await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `KakaoAK ${KAKAO}`, 'Origin': 'http://localhost:3000', 'KA': 'sdk/1.0 os/javascript origin/http%3A%2F%2Flocalhost%3A3000' },
      })).json();
      const docs = data.documents || [];
      const doc = docs.find(d => d.id === placeId) || docs.find(d => (d.road_address_name || d.address_name || '').includes('광주'));
      if (doc?.phone) return doc.phone;
    } catch { /* next */ }
  }
  return null;
}
async function runPool(items, worker, c) {
  let i = 0, done = 0;
  const next = async () => { while (i < items.length) { await worker(items[i++]); done++; if (done % 20 === 0) console.log(`  …${done}/${items.length}`); } };
  await Promise.all(Array.from({ length: c }, next));
}
async function main() {
  const { data: rests } = await supabase.from('restaurants').select('id, name, kakao_place_id, phone');
  const need = (rests || []).filter(r => !r.phone || r.phone === '정보 없음');
  console.log(`📞 전화번호 백필 — 대상 ${need.length}/${rests.length}`);
  let filled = 0;
  await runPool(need, async (r) => {
    const p = await kakaoPhone(r.name, r.kakao_place_id);
    if (p) { await supabase.from('restaurants').update({ phone: p }).eq('id', r.id); filled++; }
  }, 5);
  console.log(`✅ 전화번호 ${filled}개 채움`);
  process.exit(0);
}
main();
