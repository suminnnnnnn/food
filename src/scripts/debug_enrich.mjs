// 보강 실패 진단 — 첫 3개 식당의 현재값 + kakaoPhone/searchDetails 원시결과를 scratchpad JSON으로.
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const KAKAO = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
const GEMINI = process.env.GEMINI_API_KEY;
import fs from 'fs';

async function kakaoPhone(name, address, placeId) {
  try {
    const data = await (await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(`${name} ${address || ''}`.trim())}`, { headers: { 'Authorization': `KakaoAK ${KAKAO}`, 'Origin': 'http://localhost:3000', 'KA': 'sdk/1.0 os/javascript origin/http%3A%2F%2Flocalhost%3A3000' } })).json();
    const doc = data.documents?.find(d => d.id === placeId) || data.documents?.[0];
    return { phone: doc?.phone || null, docs: data.documents?.length || 0 };
  } catch (e) { return { error: e.message }; }
}
async function searchDetails(name, address) {
  const prompt = `너는 한국 식당 정보 조사원이다. 구글 검색으로 "${name}"(${address}) 정보를 확인. 아래 JSON을 \`\`\`json 블록으로: {"menu":"..","parking":"..","reservation":"..","packaging":"..","hours":"..","phone":".."}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ googleSearch: {} }], generationConfig: { temperature: 0.0 } }) });
    const status = res.status;
    if (!res.ok) return { status, error: (await res.text()).slice(0, 300) };
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
    return { status, rawLen: raw.length, rawHead: raw.slice(0, 400) };
  } catch (e) { return { error: e.message }; }
}

const { data: rests } = await supabase.from('restaurants').select('id,name,address,kakao_place_id,phone,menu_info,parking,reservation,packaging,business_hours').order('created_at', { ascending: true }).limit(3);
const out = [];
for (const r of rests) {
  const [kp, sd] = await Promise.all([kakaoPhone(r.name, r.address, r.kakao_place_id), searchDetails(r.name, r.address)]);
  out.push({ current: r, kakaoPhone: kp, searchDetails: sd });
}
fs.writeFileSync('C:/Users/c9611/AppData/Local/Temp/claude/C--modoo-matjip/538f0f78-c362-430f-894a-6885ab214e81/scratchpad/debug_enrich.json', JSON.stringify(out, null, 2), 'utf8');
console.log('written');
process.exit(0);
