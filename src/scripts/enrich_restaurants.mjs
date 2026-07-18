// 기존 맛집 상세정보 보강 — YouTube 검색 불필요(쿼터 회피).
// ① 채널 프로필/구독자(channels.list) ② Kakao 전화번호 ③ Gemini+구글검색으로 메뉴·영업시간·예약·포장·주차·전화 보강.
// 실행: node --env-file=.env.local src/scripts/enrich_restaurants.mjs   (ENRICH_LIMIT=3 로 소규모 테스트, SKIP_CHANNELS=1 로 채널 스킵)
import { createClient } from '@supabase/supabase-js';
import { normalizeBusinessHours } from '../lib/hours.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const KAKAO = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
const YT = process.env.YOUTUBE_API_KEY;
if (!SUPABASE_URL || !GEMINI_API_KEY || !KAKAO) { console.error('환경변수 누락'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LIMIT = Number(process.env.ENRICH_LIMIT) || 0; // 0 = 전체
const CONCURRENCY = 4;
const empty = (v) => !v || v === '정보 없음';

// ── 채널 프로필/구독자 보강 ──────────────────────────────
async function enrichChannels() {
  const { data: chs } = await supabase.from('channels').select('id, youtube_channel_id, name');
  const list = (chs || []).filter(c => c.youtube_channel_id);
  console.log(`\n📺 채널 ${list.length}개 프로필 보강...`);
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    let map = {};
    try {
      const data = await (await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${YT}&id=${batch.map(c => c.youtube_channel_id).join(',')}&part=snippet,statistics`)).json();
      if (data.error) console.log(`  ⚠️ channels.list: ${data.error.message} (ui-avatars 폴백)`);
      (data.items || []).forEach(it => {
        const th = it.snippet?.thumbnails;
        map[it.id] = { profile: th?.medium?.url || th?.default?.url || null, subs: it.statistics?.hiddenSubscriberCount ? null : (parseInt(it.statistics?.subscriberCount) || null) };
      });
    } catch (e) { console.log('  ⚠️ channels err', e.message); }
    for (const c of batch) {
      const m = map[c.youtube_channel_id];
      const profile = m?.profile || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || '채널')}&background=ff5e00&color=fff&bold=true&size=128&rounded=true`;
      await supabase.from('channels').update({ profile_image_url: profile, subscriber_count: m?.subs ?? null }).eq('id', c.id);
    }
  }
  console.log('  ✅ 채널 보강 완료');
}

// ── Kakao 전화번호 ── (정식주소 "전남광주통합특별시…"는 매칭 실패 → "상호명 광주"로 검색)
async function kakaoPhone(name, placeId) {
  for (const query of [`${name} 광주`, name]) {
    try {
      const data = await (await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `KakaoAK ${KAKAO}`, 'Origin': 'http://localhost:3000', 'KA': 'sdk/1.0 os/javascript origin/http%3A%2F%2Flocalhost%3A3000' },
      })).json();
      const docs = data.documents || [];
      const doc = docs.find(d => d.id === placeId) || docs.find(d => (d.road_address_name || d.address_name || '').includes('광주'));
      if (doc?.phone) return doc.phone;
    } catch { /* 다음 쿼리 */ }
  }
  return null;
}

// ── Gemini + 구글검색 그라운딩 상세 ──────────────────────────────
async function searchDetails(name, address) {
  const prompt = `너는 한국 식당 정보 조사원이다. 구글 검색을 활용해 아래 식당의 실제 방문 정보를 확인하라.
식당: ${name}
주소: ${address || ''}
확실히 확인되는 정보만 채우고, 불확실하면 "정보 없음". 반드시 아래 JSON을 \`\`\`json 코드블록으로 출력:
\`\`\`json
{"menu":"대표메뉴 및 가격 또는 정보 없음","parking":"주차 가능여부/방법 또는 정보 없음","reservation":"예약 가능여부/플랫폼 또는 정보 없음","packaging":"포장 가능여부 또는 정보 없음","hours":"영업시간 및 휴무일 또는 정보 없음","phone":"전화번호 또는 정보 없음"}
\`\`\``;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ googleSearch: {} }], generationConfig: { temperature: 0.0 } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
    const m = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/```\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[1] || m[0]) : null;
  } catch { return null; }
}

async function runPool(items, worker, concurrency) {
  let i = 0, done = 0;
  const next = async () => { while (i < items.length) { const idx = i++; await worker(items[idx]); done++; if (done % 10 === 0) console.log(`  …${done}/${items.length}`); } };
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  if (!process.env.SKIP_CHANNELS) await enrichChannels();

  let q = supabase.from('restaurants').select('id, name, address, kakao_place_id, phone, menu_info, parking, reservation, packaging, business_hours').order('created_at', { ascending: true });
  if (LIMIT) q = q.limit(LIMIT);
  const { data: rests } = await q;
  console.log(`\n🍽️ 식당 ${rests.length}개 상세 보강 (동시 ${CONCURRENCY})...`);

  // ⚖️ 법적 리스크로 웹검색(구글 그라운딩) 기반 영업시간·시설 수집은 제거.
  // 영업시간/시설은 관광공사 TourAPI(라이선스) 또는 영상(자체분석)에서만. 전화는 Kakao 로컬 API(라이선스)만.
  let updated = 0;
  await runPool(rests, async (r) => {
    const phone = await kakaoPhone(r.name, r.kakao_place_id);
    if (phone && empty(r.phone)) { await supabase.from('restaurants').update({ phone }).eq('id', r.id); updated++; }
  }, CONCURRENCY);

  console.log(`\n=== 완료: ${updated}/${rests.length} 식당 필드 보강 ===`);
  process.exit(0);
}
main();
