// 영상 멀티모달 분석(Gemini 2.5 Flash) — 유튜버가 영상에서 먹고 추천한 메뉴/가격/꿀팁/명대사/시그니처/장면 추출.
// restaurant_videos.ai_insights(jsonb)에 저장 + quote 갱신. 대표 영상(최다 조회수) 1개 분석.
// 사용법: node src/scripts/enrich_video_ai.mjs            (ai_insights 없는 것만)
//        FORCE=1 node ...                                 (전체 재추출)
//        ENRICH_LIMIT=1 node ...                          (개수 제한/테스트)
//        ONLY="부뚜막짜글이 본점" node ...                 (특정 식당만)
import postgres from 'postgres';
import fs from 'fs';
import { pathToFileURL } from 'url';

const env = fs.readFileSync('C:/modoo-matjip/food-feat-rebranding-modoo-matjip/.env.local', 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const KEY = process.env.GEMINI_API_KEY;
const FORCE = process.env.FORCE === '1';
const LIMIT = process.env.ENRICH_LIMIT ? parseInt(process.env.ENRICH_LIMIT, 10) : null;
const ONLY = process.env.ONLY || null;
const CONCURRENCY = 3;

const PROMPT = (name) => `다음은 "${name}" 식당을 소개한 유튜브 영상이다. 영상의 화면·화면자막·음성을 모두 분석해 아래 JSON으로만 응답하라.
규칙: 영상에 실제로 나온 것만. 없으면 null 또는 []. 추측·창작 금지. 가격은 화면/음성에 실제로 나온 것만.
{
 "matches_restaurant": true/false,
 "match_confidence": 0.0~1.0,
 "picks": [{"name":"메뉴명","price":"가격 또는 null","ate": true/false,"price_source":"onscreen|spoken|none"}],
 "quote": "유튜버가 이 집에 대해 한 인상적인 실제 한마디 또는 null",
 "tips": ["주문·이용 꿀팁(구체적으로)"],
 "signature": "이 집이 유명/특별한 이유 한 줄 또는 null",
 "mood_tags": ["혼밥/노포/가성비/데이트/가족외식 등 근거 있는 것만"],
 "best_food_scenes": [{"ts":"mm:ss","desc":"음식이 가장 먹음직하게 나온 장면"}]
}`;

async function analyze(name, ytId) {
  const body = {
    contents: [{ parts: [
      { fileData: { fileUri: `https://www.youtube.com/watch?v=${ytId}` } },
      { text: PROMPT(name) },
    ] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(d).slice(0, 300));
  const txt = d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  const obj = JSON.parse(txt);
  const u = d.usageMetadata || {};
  const cost = (u.promptTokenCount || 0) / 1e6 * 0.30 + (u.candidatesTokenCount || 0) / 1e6 * 2.50;
  return { obj, cost };
}

async function run() {
  await sql`ALTER TABLE restaurant_videos ADD COLUMN IF NOT EXISTS ai_insights jsonb`;
  // 식당별 대표 영상(최다 조회수) 1개
  let rows = await sql`
    SELECT DISTINCT ON (r.id) r.id AS rid, r.name, v.id AS vid, v.youtube_video_id AS yt, rv.ai_insights
    FROM restaurants r
    JOIN restaurant_videos rv ON rv.restaurant_id = r.id
    JOIN videos v ON v.id = rv.video_id
    WHERE v.youtube_video_id IS NOT NULL
    ORDER BY r.id, v.view_count DESC NULLS LAST`;
  if (ONLY) rows = rows.filter(r => r.name === ONLY);
  if (!FORCE) rows = rows.filter(r => !r.ai_insights);
  if (LIMIT) rows = rows.slice(0, LIMIT);
  console.log(`대상 ${rows.length}곳 (FORCE=${FORCE})`);

  let ok = 0, fail = 0, spent = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (r) => {
      try {
        const { obj, cost } = await analyze(r.name, r.yt);
        spent += cost;
        const insights = {
          picks: Array.isArray(obj.picks) ? obj.picks : [],
          tips: Array.isArray(obj.tips) ? obj.tips : [],
          signature: obj.signature || null,
          mood_tags: Array.isArray(obj.mood_tags) ? obj.mood_tags : [],
          best_food_scenes: Array.isArray(obj.best_food_scenes) ? obj.best_food_scenes : [],
          match_confidence: typeof obj.match_confidence === 'number' ? obj.match_confidence : null,
        };
        const quote = obj.quote && obj.quote !== '정보 없음' ? String(obj.quote).slice(0, 300) : null;
        await sql`
          UPDATE restaurant_videos
          SET ai_insights = ${sql.json(insights)}
              ${quote ? sql`, quote = ${quote}` : sql``}
          WHERE restaurant_id = ${r.rid} AND video_id = ${r.vid}`;
        ok++;
        console.log(`✓ ${r.name} → picks ${insights.picks.length} · tips ${insights.tips.length} · ₩${Math.round(cost * 1400)}`);
      } catch (e) {
        fail++;
        console.log(`✗ ${r.name}: ${String(e.message || e).slice(0, 140)}`);
      }
    }));
  }
  console.log(`\n완료: 성공 ${ok}, 실패 ${fail} · 총비용 $${spent.toFixed(2)} ≈ ₩${Math.round(spent * 1400).toLocaleString()}`);
  await sql.end();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) run();
