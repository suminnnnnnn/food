// 한국관광공사 TourAPI(공공데이터) 기반 영업시간 등 보강 — 저장·서비스 제공 합법(출처: 한국관광공사).
// 좌표기반 매칭(locationBasedList2) → detailIntro2로 영업시간·휴무·메뉴·주차·예약·포장.
// 영업시간은 TourAPI로만 채우고, 매칭 안 되면 '정보 없음'으로(기존 그라운딩 잔여분 제거 = 법적 정리).
// 실행: node --env-file=.env.local src/scripts/enrich_from_tourapi.mjs   (ENRICH_LIMIT=5 테스트)
import { createClient } from '@supabase/supabase-js';
import { normalizeBusinessHours } from '../lib/hours.mjs';
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const KEY = process.env.TOUR_API_KEY;
if (!KEY) { console.error('TOUR_API_KEY 없음'); process.exit(1); }

const BASE = 'https://apis.data.go.kr/B551011/KorService2';
const COMMON = `serviceKey=${KEY}&MobileOS=ETC&MobileApp=modoo&_type=json`;
const LIMIT = Number(process.env.ENRICH_LIMIT) || 0;
const CONCURRENCY = 3;
const RADIUS = 1500;
const dist = (la1, lo1, la2, lo2) => { const R = 6371000, toR = x => x * Math.PI / 180; const dla = toR(la2 - la1), dlo = toR(lo2 - lo1); const a = Math.sin(dla / 2) ** 2 + Math.cos(toR(la1)) * Math.cos(toR(la2)) * Math.sin(dlo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };

const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => (s || '').replace(/\s/g, '').replace(/(본점|직영점|점)$/,'').toLowerCase();
const empty = (v) => !v || v === '정보 없음';

async function locList(lat, lng) {
  try {
    const d = await (await fetch(`${BASE}/locationBasedList2?${COMMON}&contentTypeId=39&mapX=${lng}&mapY=${lat}&radius=${RADIUS}&arrange=E&numOfRows=30&pageNo=1`)).json();
    const it = d?.response?.body?.items?.item;
    return Array.isArray(it) ? it : (it && typeof it === 'object' ? [it] : []);
  } catch { return []; }
}
async function searchKw(name) {
  try {
    const d = await (await fetch(`${BASE}/searchKeyword2?${COMMON}&contentTypeId=39&keyword=${encodeURIComponent(name)}&numOfRows=20&pageNo=1`)).json();
    const it = d?.response?.body?.items?.item;
    return Array.isArray(it) ? it : (it && typeof it === 'object' ? [it] : []);
  } catch { return []; }
}
async function intro(contentId) {
  try {
    const d = await (await fetch(`${BASE}/detailIntro2?${COMMON}&contentId=${contentId}&contentTypeId=39`)).json();
    const it = d?.response?.body?.items?.item;
    return Array.isArray(it) ? it[0] : it;
  } catch { return null; }
}
function match(name, items) {
  const n = norm(name);
  return items.find(it => norm(it.title) === n) || items.find(it => { const t = norm(it.title); return t && (t.includes(n) || n.includes(t)); }) || null;
}

async function runPool(items, worker, concurrency) {
  let i = 0, done = 0;
  const next = async () => { while (i < items.length) { await worker(items[i++]); done++; if (done % 15 === 0) console.log(`  …${done}/${items.length}`); } };
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  let q = supabase.from('restaurants').select('id, name, lat, lng, menu_info, parking, reservation, packaging').order('created_at', { ascending: true });
  if (LIMIT) q = q.limit(LIMIT);
  const { data: rests } = await q;
  console.log(`\n🏛️ TourAPI 영업시간 보강 — 식당 ${rests.length}개 (동시 ${CONCURRENCY}, 반경 ${RADIUS}m)\n`);

  let matched = 0, hours = 0;
  await runPool(rests, async (r) => {
    if (!r.lat || !r.lng) { await supabase.from('restaurants').update({ business_hours: '정보 없음' }).eq('id', r.id); return; }
    let m = match(r.name, await locList(r.lat, r.lng));
    if (!m) { // 키워드 검색 폴백 (좌표 근처 2km 내)
      const near = (await searchKw(r.name)).filter(x => x.mapx && x.mapy && dist(r.lat, r.lng, +x.mapy, +x.mapx) < 2000);
      m = match(r.name, near) || near[0] || null;
    }
    const upd = { business_hours: '정보 없음', business_hours_source: null }; // 기본: TourAPI 미매칭 시 그라운딩 잔여분 제거
    if (m) {
      const iv = await intro(m.contentid);
      const oh = strip(iv?.opentimefood), rd = strip(iv?.restdatefood);
      if (oh) {
        // 이용자 제보 포맷과 동일하게 정규화 (매일 HH:MM~HH:MM / 요일별)
        const combined = rd ? `${oh} (휴무: ${rd})` : oh;
        upd.business_hours = normalizeBusinessHours(combined);
        upd.business_hours_source = 'tour'; hours++;
      }
      const fill = (col, val) => { const v = strip(val); if (v && empty(r[col])) upd[col] = v; };
      fill('parking', iv?.parkingfood); fill('reservation', iv?.reservationfood); fill('packaging', iv?.packing);
      if (empty(r.menu_info)) { const menu = strip(iv?.treatmenu || iv?.firstmenu); if (menu) upd.menu_info = menu; }
      matched++;
      console.log(`  ✅ ${r.name} ↔ ${m.title}${oh ? ` · ${strip(oh).slice(0, 30)}` : ' (영업시간 없음)'}`);
    }
    await supabase.from('restaurants').update(upd).eq('id', r.id);
  }, CONCURRENCY);

  console.log(`\n=== 완료: TourAPI 매칭 ${matched}/${rests.length} · 영업시간 채움 ${hours} ===`);
  process.exit(0);
}
main();
