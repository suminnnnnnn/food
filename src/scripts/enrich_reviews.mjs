// 통합 리뷰 엔리처 (generateDetail의 3단계). enrich_video_ai + enrich_retry_held를 대체.
// 식당별로: 채널정책 필터 → 후보영상 랭킹 → 멀티모달 게이트(매칭·리뷰성·dine_in·쇼츠제외) →
//          통과 영상을 ai_insights로 저장하고 restaurants.representative_video_id 지정.
// 통과 영상이 없으면 held(리뷰 없음). 실행: node src/scripts/enrich_reviews.mjs [REGION=광주] [FORCE=1] [MAX_TRY=4]
import postgres from 'postgres';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { normalizeBusinessHours } from '../lib/hours.mjs';
import { classifyChannel } from '../lib/channelPolicy.mjs';

const ROOT = 'C:/modoo-matjip/food-feat-rebranding-modoo-matjip';
const env = fs.readFileSync(`${ROOT}/.env.local`, 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const KEY = process.env.GEMINI_API_KEY;
const REGION = process.env.REGION || '광주';
const FORCE = process.env.FORCE === '1';
const ONLY = process.env.ONLY || null;
const CONF_MIN = process.env.CONF_MIN ? parseFloat(process.env.CONF_MIN) : 0.5;
const TASTE_MIN = process.env.TASTE_MIN ? parseFloat(process.env.TASTE_MIN) : 0.4;
const MAX_TRY = process.env.MAX_TRY ? parseInt(process.env.MAX_TRY, 10) : 4;
const CONCURRENCY = 3;

const PROMPT = (name) => `다음은 "${name}" 식당을 소개한 유튜브 영상이다. 화면·화면자막·음성을 모두 분석해 아래 JSON으로만 응답하라.
[엄격 규칙] 영상에 실제로 나온 것만. 없으면 null/[]. 추측·창작 금지. "${name}"이 아닌 다른 식당이면 matches_restaurant=false.
가격/영업시간은 화면·음성에 실제로 나온 것만(근거 evidence 없으면 넣지 마라).
{
 "matches_restaurant": true/false,
 "match_confidence": 0.0~1.0,
 "content_type": "review|vlog|mukbang|comedy|promo|news 중 하나",
 "visit_type": "dine_in|delivery|home|unknown 중 하나(매장에 직접 방문해 먹으면 dine_in)",
 "tasting_review_score": 0.0~1.0,
 "one_liner": "유튜버 어조 한줄평(25자 내외) 또는 null",
 "review": "맛·식감·특징·추천이유 3~4문장 서술형(존댓말) 또는 null",
 "picks": [{"name":"메뉴명","price":"15,000원 또는 null","price_source":"onscreen|spoken|none","price_evidence":"근거 또는 null","price_ts":"mm:ss 또는 null","ate":true/false,"comment":"먹은 메뉴면 정제된 한 문장(존댓말 35자 이내, 발화 그대로 옮기지 말 것), 안 먹었으면 null"}],
 "signature": "유명/특별한 이유 한 줄 또는 null",
 "tips": ["주문·이용 꿀팁"],
 "mood_tags": ["근거 있는 분위기/상황 3~5개"],
 "hours": "영업시간 또는 null",
 "best_food_scenes": [{"ts":"mm:ss","desc":"음식이 먹음직스럽게 나온 순간 한 줄"}]
}
best_food_scenes는 대표 순간 2~4개. 얼굴·간판·이동 제외.`;

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
  const u = d.usageMetadata || {};
  const cost = (u.promptTokenCount || 0) / 1e6 * 0.30 + (u.candidatesTokenCount || 0) / 1e6 * 2.50;
  return { obj: JSON.parse(d.candidates[0].content.parts.map(p => p.text).join('')), cost };
}

// 콘텐츠 게이트: 매칭·신뢰도·(코미디/홍보/뉴스 제외)·(배달/집밥 제외)·평가존재
// mukbang·대식가도 tasting_review_score가 충분하면 허용(먹을텐데 등 오탐 방지).
function passesContentGate(obj) {
  const conf = typeof obj.match_confidence === 'number' ? obj.match_confidence : null;
  if (obj.matches_restaurant === false) return { ok: false, why: 'not-match' };
  if (conf !== null && conf < CONF_MIN) return { ok: false, why: `conf<${CONF_MIN}` };
  if (['comedy', 'promo', 'news'].includes(obj.content_type)) return { ok: false, why: `type:${obj.content_type}` };
  if (['delivery', 'home'].includes(obj.visit_type)) return { ok: false, why: `visit:${obj.visit_type}` };
  if ((obj.tasting_review_score ?? 1) < TASTE_MIN) return { ok: false, why: `taste<${TASTE_MIN}` };
  const ateAny = (obj.picks || []).some(p => p.ate === true);
  if (!obj.review && !ateAny) return { ok: false, why: 'no-tasting' };
  return { ok: true, conf };
}

function buildInsights(obj, conf) {
  const picks = (Array.isArray(obj.picks) ? obj.picks : []).filter(p => p && p.name).map(p => ({
    name: String(p.name).slice(0, 60),
    price: p.price_source === 'none' ? null : (p.price || null),
    price_source: p.price_source || 'none',
    price_evidence: p.price_source === 'none' ? null : (p.price_evidence || null),
    price_ts: p.price_ts || null,
    ate: p.ate === true,
    comment: p.ate === true && p.comment ? String(p.comment).slice(0, 80) : null,
  }));
  const scenes = (Array.isArray(obj.best_food_scenes) ? obj.best_food_scenes : [])
    .filter(s => s && s.ts).slice(0, 4).map(s => ({ ts: String(s.ts), desc: s.desc ? String(s.desc).slice(0, 60) : '' }));
  return {
    picks, review: obj.review && obj.review !== '정보 없음' ? String(obj.review).slice(0, 600) : null,
    tips: Array.isArray(obj.tips) ? obj.tips : [], signature: obj.signature || null,
    mood_tags: Array.isArray(obj.mood_tags) ? obj.mood_tags : [], best_food_scenes: scenes,
    match_confidence: conf, content_type: obj.content_type || null, tasting_review_score: obj.tasting_review_score ?? null,
  };
}

async function run() {
  await sql`ALTER TABLE restaurant_videos ADD COLUMN IF NOT EXISTS ai_insights jsonb`;
  await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS representative_video_id uuid`;

  // 식당별 전체 영상 + 채널명
  const rows = await sql`
    SELECT r.id AS rid, r.name, r.address, r.business_hours AS bhours,
           v.id AS vid, v.youtube_video_id AS yt, v.title, v.is_short, v.view_count AS vc, c.name AS channel,
           EXISTS(SELECT 1 FROM restaurants r2 WHERE r2.id=r.id AND r2.representative_video_id IS NOT NULL) AS done
    FROM restaurants r
    JOIN restaurant_videos rv ON rv.restaurant_id = r.id
    JOIN videos v ON v.id = rv.video_id
    LEFT JOIN channels c ON c.id = v.channel_id
    WHERE v.youtube_video_id IS NOT NULL AND r.address LIKE ${'%' + REGION + '%'}
    ORDER BY r.id, v.view_count DESC NULLS LAST`;

  const byRest = new Map();
  for (const r of rows) {
    if (!byRest.has(r.rid)) byRest.set(r.rid, { rid: r.rid, name: r.name, bhours: r.bhours, done: r.done, vids: [] });
    // 채널 정책: block은 후보에서 제외, allow/gray는 유지(gray는 멀티모달 게이트가 최종 판정)
    const cls = classifyChannel({ channelName: r.channel, title: r.title, isShort: r.is_short });
    if (cls.verdict === 'block') continue;
    byRest.get(r.rid).vids.push({ vid: r.vid, yt: r.yt, verdict: cls.verdict, vc: r.vc || 0, title: r.title });
  }
  let rests = [...byRest.values()];
  if (ONLY) rests = rests.filter(r => r.name === ONLY);
  if (!FORCE) rests = rests.filter(r => !r.done);
  console.log(`대상 ${rests.length}곳 (REGION=${REGION}, FORCE=${FORCE})\n`);

  let ok = 0, held = 0, fail = 0, spent = 0;
  for (let i = 0; i < rests.length; i += CONCURRENCY) {
    await Promise.all(rests.slice(i, i + CONCURRENCY).map(async (r) => {
      // 후보 랭킹: allow 우선, 그다음 조회수. 최대 MAX_TRY개 시도.
      const cands = r.vids.sort((a, b) => (b.verdict === 'allow' ? 1 : 0) - (a.verdict === 'allow' ? 1 : 0) || b.vc - a.vc).slice(0, MAX_TRY);
      if (cands.length === 0) { held++; console.log(`⏸ ${r.name}: 허용 채널 영상 없음(전부 block)`); return; }
      let saved = false, tried = 0, lastWhy = '';
      for (const t of cands) {
        tried++;
        let obj, cost;
        try { ({ obj, cost } = await analyze(r.name, t.yt)); spent += cost; }
        catch (e) { lastWhy = String(e.message).slice(0, 50); continue; }
        const gate = passesContentGate(obj);
        if (!gate.ok) { lastWhy = gate.why; continue; }
        const insights = buildInsights(obj, gate.conf);
        const quote = obj.one_liner && obj.one_liner !== '정보 없음' ? String(obj.one_liner).slice(0, 300) : null;
        await sql`UPDATE restaurant_videos SET ai_insights = ${sql.json(insights)} ${quote ? sql`, quote = ${quote}` : sql``} WHERE restaurant_id = ${r.rid} AND video_id = ${t.vid}`;
        await sql`UPDATE restaurants SET representative_video_id = ${t.vid} WHERE id = ${r.rid}`;
        if (obj.hours && obj.hours !== '정보 없음' && (!r.bhours || r.bhours === '정보 없음')) {
          const norm = normalizeBusinessHours(obj.hours);
          if (norm && norm !== '정보 없음') await sql`UPDATE restaurants SET business_hours = ${norm}, business_hours_source = 'video' WHERE id = ${r.rid}`;
        }
        const pc = insights.picks.filter(p => p.comment).length;
        console.log(`✓ ${r.name} → ${tried}번째(${t.verdict}) · review ${insights.review ? '✓' : '✗'} · pick ${insights.picks.length}(코멘트${pc}) · 장면 ${insights.best_food_scenes.length}`);
        ok++; saved = true; break;
      }
      if (!saved) { held++; console.log(`⏸ ${r.name}: ${tried}개 시도 모두 실패(${lastWhy})`); }
    }));
  }
  console.log(`\n완료: 성공 ${ok}, 보류 ${held}, 오류 ${fail} · 총비용 $${spent.toFixed(2)} ≈ ₩${Math.round(spent * 1400).toLocaleString()}`);
  await sql.end();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) run();
