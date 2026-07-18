// 보류(ai_insights 없는) 식당을 대상으로 대표영상 외 다른 영상들까지 시도해 매칭 복구.
// enrich_video_ai의 게이트가 "대표 1개"만 봐서 생긴 false negative(예: 영미오리탕) 회수.
// 실행: node src/scripts/enrich_retry_held.mjs        (MAX_TRY=4 로 시도 수 조정)
import postgres from 'postgres';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { normalizeBusinessHours } from '../lib/hours.mjs';

const ROOT = 'C:/modoo-matjip/food-feat-rebranding-modoo-matjip';
const env = fs.readFileSync(`${ROOT}/.env.local`, 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const KEY = process.env.GEMINI_API_KEY;
const CONF_MIN = process.env.CONF_MIN ? parseFloat(process.env.CONF_MIN) : 0.5;
const MAX_TRY = process.env.MAX_TRY ? parseInt(process.env.MAX_TRY, 10) : 4;
const CONCURRENCY = 3;

const PROMPT = (name) => `다음은 "${name}" 식당을 소개한 유튜브 영상이다. 영상의 화면·화면자막·음성을 모두 분석해 아래 JSON으로만 응답하라.
[엄격 규칙]
- 영상에 실제로 나온 것만. 없으면 null 또는 []. 추측·창작 절대 금지.
- 가격/영업시간은 화면 또는 음성에 실제로 나온 것만. 근거(evidence)를 만들 수 없으면 넣지 마라.
- "15.0"처럼 천원 단위로 적혀 있으면 "15,000원"으로 완전한 원화 표기로 변환.
- 이 영상이 "${name}"이 아닌 다른 식당을 다루면 matches_restaurant=false, 나머지는 비워라.
{
 "matches_restaurant": true/false,
 "match_confidence": 0.0~1.0,
 "one_liner": "유튜버 어조를 살린 한줄평(25자 내외) 또는 null",
 "review": "맛·식감·특징·추천 이유를 담은 3~4문장 서술형 리뷰(존댓말) 또는 null",
 "picks": [{"name":"메뉴명","price":"15,000원 또는 null","price_source":"onscreen|spoken|none","price_evidence":"가격 근거 또는 null","price_ts":"mm:ss 또는 null","ate":true/false,"comment":"실제 먹은 메뉴면 한줄평(30자), 안 먹었으면 null"}],
 "signature": "이 집이 유명/특별한 이유 한 줄 또는 null",
 "tips": ["주문·이용 꿀팁(구체적으로)"],
 "mood_tags": ["혼밥/노포/가성비/데이트/가족외식 등 근거 있는 것만"],
 "hours": "영상에 나온 영업시간 또는 null",
 "best_food_scenes": [{"ts":"mm:ss","desc":"음식이 가장 먹음직스럽게 나온 순간 한 줄"}]
}
best_food_scenes는 대표 순간 2~4개만. 얼굴·간판·이동 장면 제외.`;

async function analyze(name, ytId) {
  const body = {
    contents: [{ parts: [
      { fileData: { fileUri: `https://www.youtube.com/watch?v=${ytId}` }, videoMetadata: { fps: 0.2 } },
      { text: PROMPT(name) },
    ] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, mediaResolution: 'MEDIA_RESOLUTION_LOW' },
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(d).slice(0, 200));
  return JSON.parse(d.candidates[0].content.parts.map(p => p.text).join(''));
}

function buildInsights(obj, conf) {
  const picks = (Array.isArray(obj.picks) ? obj.picks : []).filter(p => p && p.name).map(p => ({
    name: String(p.name).slice(0, 60),
    price: p.price_source === 'none' ? null : (p.price || null),
    price_source: p.price_source || 'none',
    price_evidence: p.price_source === 'none' ? null : (p.price_evidence || null),
    price_ts: p.price_ts || null,
    ate: p.ate === true,
    comment: p.ate === true && p.comment ? String(p.comment).slice(0, 120) : null,
  }));
  const scenes = (Array.isArray(obj.best_food_scenes) ? obj.best_food_scenes : [])
    .filter(s => s && s.ts).slice(0, 4).map(s => ({ ts: String(s.ts), desc: s.desc ? String(s.desc).slice(0, 60) : '' }));
  return {
    picks,
    review: obj.review && obj.review !== '정보 없음' ? String(obj.review).slice(0, 600) : null,
    tips: Array.isArray(obj.tips) ? obj.tips : [],
    signature: obj.signature || null,
    mood_tags: Array.isArray(obj.mood_tags) ? obj.mood_tags : [],
    best_food_scenes: scenes,
    match_confidence: conf,
  };
}

async function run() {
  // 아직 어떤 영상도 enrich되지 않은 식당 + 그 식당의 모든 영상(조회수순)
  const rows = await sql`
    SELECT r.id AS rid, r.name, r.business_hours AS bhours, v.id AS vid, v.youtube_video_id AS yt
    FROM restaurants r
    JOIN restaurant_videos rv ON rv.restaurant_id = r.id
    JOIN videos v ON v.id = rv.video_id
    WHERE v.youtube_video_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM restaurant_videos x WHERE x.restaurant_id = r.id AND x.ai_insights IS NOT NULL)
    ORDER BY r.id, v.view_count DESC NULLS LAST`;
  const byRest = new Map();
  for (const r of rows) {
    if (!byRest.has(r.rid)) byRest.set(r.rid, { rid: r.rid, name: r.name, bhours: r.bhours, vids: [] });
    byRest.get(r.rid).vids.push({ vid: r.vid, yt: r.yt });
  }
  const rests = [...byRest.values()];
  console.log(`보류 식당 ${rests.length}곳 · 식당당 최대 ${MAX_TRY}개 영상 시도\n`);

  let ok = 0, held = 0, fail = 0;
  for (let i = 0; i < rests.length; i += CONCURRENCY) {
    await Promise.all(rests.slice(i, i + CONCURRENCY).map(async (r) => {
      let saved = false, tried = 0, lastConf = null;
      for (const t of r.vids.slice(0, MAX_TRY)) {
        tried++;
        let obj;
        try { obj = await analyze(r.name, t.yt); }
        catch (e) { console.log(`  · ${r.name} 영상${tried} 오류: ${String(e.message).slice(0, 60)}`); continue; }
        const conf = typeof obj.match_confidence === 'number' ? obj.match_confidence : null;
        lastConf = conf;
        if (obj.matches_restaurant === false || (conf !== null && conf < CONF_MIN)) continue;
        const insights = buildInsights(obj, conf);
        const quote = obj.one_liner && obj.one_liner !== '정보 없음' ? String(obj.one_liner).slice(0, 300) : null;
        await sql`UPDATE restaurant_videos SET ai_insights = ${sql.json(insights)} ${quote ? sql`, quote = ${quote}` : sql``} WHERE restaurant_id = ${r.rid} AND video_id = ${t.vid}`;
        if (obj.hours && obj.hours !== '정보 없음' && (!r.bhours || r.bhours === '정보 없음')) {
          const norm = normalizeBusinessHours(obj.hours);
          if (norm && norm !== '정보 없음') await sql`UPDATE restaurants SET business_hours = ${norm}, business_hours_source = 'video' WHERE id = ${r.rid}`;
        }
        console.log(`✓ ${r.name} → ${tried}번째 영상 매칭 (review ${insights.review ? '✓' : '✗'}, 장면 ${insights.best_food_scenes.length})`);
        ok++; saved = true; break;
      }
      if (!saved) { held++; console.log(`⏸ ${r.name}: ${tried}개 영상 모두 매칭실패(conf=${lastConf}) → 리뷰영상 없음`); }
    }));
  }
  console.log(`\n완료: 복구 ${ok}, 여전히 보류 ${held}, 오류 ${fail}`);
  await sql.end();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) run();
