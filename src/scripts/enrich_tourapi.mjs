// 관광공사 TourAPI(라이선스 공공데이터)로 영업시간·주차·포장·예약·대표메뉴 보강.
// searchKeyword2(이름 매칭) → detailIntro2(contentTypeId=39) → opentimefood 등. 출처 'tour'.
// 실행: node --env-file=.env.local src/scripts/enrich_tourapi.mjs [REGION=광주]
import { createClient } from '@supabase/supabase-js';
import { normalizeBusinessHours } from '../lib/hours.mjs';

const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const RAW = process.env.TOUR_API_KEY || '';
const KEY = RAW.includes('%') ? decodeURIComponent(RAW) : RAW;
const REGION = process.env.REGION || '광주';
if (!KEY) { console.error('TOUR_API_KEY 없음'); process.exit(1); }

const BASE = 'https://apis.data.go.kr/B551011/KorService2';
const norm = (s) => (s || '').replace(/\s/g, '').replace(/(본점|직영점|점)$/, '').toLowerCase();
const clean = (v) => { const s = (v || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').trim(); return s && s !== '없음' ? s : ''; };

async function tourGet(path, params) {
  const u = new URL(`${BASE}/${path}`);
  u.searchParams.set('serviceKey', KEY);
  u.searchParams.set('MobileOS', 'ETC'); u.searchParams.set('MobileApp', 'ModooMatjip'); u.searchParams.set('_type', 'json');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  let items = d?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

async function findContentId(name) {
  const items = await tourGet('searchKeyword2', { keyword: name, contentTypeId: '39', numOfRows: '10', pageNo: '1', arrange: 'A' });
  const n = norm(name);
  // 광주 주소 + 이름 유사 매칭
  const hit = items.find(it => (it.addr1 || '').includes(REGION) && (norm(it.title) === n || norm(it.title).includes(n) || n.includes(norm(it.title))));
  return hit?.contentid || null;
}

async function getIntro(cid) {
  const items = await tourGet('detailIntro2', { contentId: cid, contentTypeId: '39' });
  const it = items[0]; if (!it) return null;
  return {
    hours: clean(it.opentimefood), rest: clean(it.restdatefood),
    parking: clean(it.parkingfood), packaging: clean(it.packing), reservation: clean(it.reservationfood),
    menu: [clean(it.firstmenu), clean(it.treatmenu)].filter(Boolean).join(', '),
  };
}

async function main() {
  const { data: rests } = await supabase.from('restaurants').select('id, name, business_hours, parking, packaging, reservation, menu_info')
    .eq('is_published', true).ilike('address', `%${REGION}%`);
  console.log(`\n🏛️ 관광공사 보강 대상 ${rests.length}곳 (${REGION})\n`);
  const empty = (v) => !v || v === '정보 없음';
  let matched = 0, filled = 0;
  for (const r of rests) {
    try {
      const cid = await findContentId(r.name);
      if (!cid) continue;
      matched++;
      const intro = await getIntro(cid);
      if (!intro) continue;
      const upd = {};
      if (intro.hours && empty(r.business_hours)) {
        const combined = intro.rest ? `${intro.hours} 휴무: ${intro.rest}` : intro.hours;
        const nh = normalizeBusinessHours(combined);
        if (nh && nh !== '정보 없음') { upd.business_hours = nh; upd.business_hours_source = 'tour'; }
      }
      if (intro.parking && empty(r.parking)) upd.parking = intro.parking;
      if (intro.packaging && empty(r.packaging)) upd.packaging = intro.packaging;
      if (intro.reservation && empty(r.reservation)) upd.reservation = intro.reservation;
      if (intro.menu && empty(r.menu_info)) upd.menu_info = intro.menu;
      if (Object.keys(upd).length) {
        await supabase.from('restaurants').update(upd).eq('id', r.id); filled++;
        console.log(`  ✅ ${r.name} → ${Object.keys(upd).join(', ')}`);
      }
    } catch (e) { console.log(`  ✗ ${r.name}: ${String(e.message).slice(0, 50)}`); }
  }
  console.log(`\n=== 완료: 관광공사 매칭 ${matched}/${rests.length} · 필드보강 ${filled} ===`);
  process.exit(0);
}
main();
