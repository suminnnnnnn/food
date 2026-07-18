// 영상 멀티모달 분석(Gemini 2.5 Flash) — 유튜버가 영상에서 먹고 추천한 메뉴/가격/꿀팁/명대사/시그니처/장면 추출.
// restaurant_videos.ai_insights(jsonb)에 저장 + quote 갱신. 대표 영상(최다 조회수) 1개 분석.
// 사용법: node src/scripts/enrich_video_ai.mjs            (ai_insights 없는 것만)
//        FORCE=1 node ...                                 (전체 재추출)
//        ENRICH_LIMIT=1 node ...                          (개수 제한/테스트)
//        ONLY="부뚜막짜글이 본점" node ...                 (특정 식당만)
import postgres from 'postgres';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { normalizeBusinessHours } from '../lib/hours.mjs';

const env = fs.readFileSync('C:/modoo-matjip/food-feat-rebranding-modoo-matjip/.env.local', 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const KEY = process.env.GEMINI_API_KEY;
const FORCE = process.env.FORCE === '1';
const LIMIT = process.env.ENRICH_LIMIT ? parseInt(process.env.ENRICH_LIMIT, 10) : null;
const ONLY = process.env.ONLY || null;
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
 "picks": [{"name":"메뉴명","price":"15,000원 또는 null","price_source":"onscreen|spoken|none","price_evidence":"가격 근거(화면 원문 예: 메뉴판 '육전 20,000' / 발화 예: '2만원이래요') 또는 null","price_ts":"가격이 보인/언급된 시점 mm:ss 또는 null","ate":true/false,"comment":"실제 먹은 메뉴면 유튜버 한줄평(30자 내외), 안 먹었으면 null"}],
 "signature": "이 집이 유명/특별한 이유 한 줄 또는 null",
 "tips": ["주문·이용 꿀팁(구체적으로)"],
 "mood_tags": ["혼밥/노포/가성비/데이트/가족외식 등 근거 있는 것만"],
 "hours": "영상에 나온 영업시간(예: 매일 11:00~21:00, 월 휴무) 또는 null",
 "best_food_scenes": [{"ts":"mm:ss","desc":"음식이 가장 먹음직스럽게 나온 순간 한 줄"}]
}
best_food_scenes는 음식이 크고 선명하게 나온 대표 순간 2~4개만. 얼굴·간판·이동 장면 제외.`;

async function analyze(name, ytId) {
  const body = {
    // 비용절감 D설정: 저해상도(LOW) + 저fps(0.2, 5초당 1프레임) — 토큰 84%↓, 화면 가격 추출 유지
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
    SELECT DISTINCT ON (r.id) r.id AS rid, r.name, v.id AS vid, v.youtube_video_id AS yt, rv.ai_insights, r.business_hours AS bhours
    FROM restaurants r
    JOIN restaurant_videos rv ON rv.restaurant_id = r.id
    JOIN videos v ON v.id = rv.video_id
    WHERE v.youtube_video_id IS NOT NULL
    ORDER BY r.id, v.view_count DESC NULLS LAST`;
  if (ONLY) rows = rows.filter(r => r.name === ONLY);
  if (!FORCE) rows = rows.filter(r => !r.ai_insights);
  if (LIMIT) rows = rows.slice(0, LIMIT);
  console.log(`대상 ${rows.length}곳 (FORCE=${FORCE})`);

  const CONF_MIN = process.env.CONF_MIN ? parseFloat(process.env.CONF_MIN) : 0.5; // 이하면 보류(오매칭 방어)
  let ok = 0, fail = 0, held = 0, spent = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (r) => {
      try {
        const { obj, cost } = await analyze(r.name, r.yt);
        spent += cost;

        // 게이트: 다른 식당이거나 신뢰도 낮으면 저장 보류(Kakao 오매칭·환각 방어)
        const conf = typeof obj.match_confidence === 'number' ? obj.match_confidence : null;
        if (obj.matches_restaurant === false || (conf !== null && conf < CONF_MIN)) {
          held++; console.log(`⏸ ${r.name}: 보류(matches=${obj.matches_restaurant}, conf=${conf})`); return;
        }

        // 후처리 검증: 근거 없는 가격 제거 + 안 먹은 메뉴 코멘트 제거
        const picks = (Array.isArray(obj.picks) ? obj.picks : []).filter(p => p && p.name).map(p => ({
          name: String(p.name).slice(0, 60),
          price: p.price_source === 'none' ? null : (p.price || null),   // 근거 없으면 가격 버림
          price_source: p.price_source || 'none',
          price_evidence: p.price_source === 'none' ? null : (p.price_evidence || null),
          price_ts: p.price_ts || null,
          ate: p.ate === true,
          comment: p.ate === true && p.comment ? String(p.comment).slice(0, 120) : null,  // 먹은 것만 코멘트
        }));
        const scenes = (Array.isArray(obj.best_food_scenes) ? obj.best_food_scenes : [])
          .filter(s => s && s.ts).slice(0, 4).map(s => ({ ts: String(s.ts), desc: s.desc ? String(s.desc).slice(0, 60) : '' }));

        const insights = {
          picks,
          review: obj.review && obj.review !== '정보 없음' ? String(obj.review).slice(0, 600) : null,
          tips: Array.isArray(obj.tips) ? obj.tips : [],
          signature: obj.signature || null,
          mood_tags: Array.isArray(obj.mood_tags) ? obj.mood_tags : [],
          best_food_scenes: scenes,
          match_confidence: conf,
        };
        const quote = obj.one_liner && obj.one_liner !== '정보 없음' ? String(obj.one_liner).slice(0, 300) : null;
        await sql`
          UPDATE restaurant_videos
          SET ai_insights = ${sql.json(insights)}
              ${quote ? sql`, quote = ${quote}` : sql``}
          WHERE restaurant_id = ${r.rid} AND video_id = ${r.vid}`;

        // 영상에 영업시간이 나왔고 기존 값이 비었으면 정규화해 채움(출처: video)
        let hoursMsg = '';
        if (obj.hours && obj.hours !== '정보 없음' && (!r.bhours || r.bhours === '정보 없음')) {
          const norm = normalizeBusinessHours(obj.hours);
          if (norm && norm !== '정보 없음') {
            await sql`UPDATE restaurants SET business_hours = ${norm}, business_hours_source = 'video' WHERE id = ${r.rid}`;
            hoursMsg = ' · ⏰영업시간';
          }
        }
        ok++;
        const pc = insights.picks.filter(p => p.comment).length;
        console.log(`✓ ${r.name} → picks ${insights.picks.length}(코멘트${pc}) · review ${insights.review ? '✓' : '✗'} · 장면 ${insights.best_food_scenes.length}${hoursMsg} · ₩${Math.round(cost * 1400)}`);
      } catch (e) {
        fail++;
        console.log(`✗ ${r.name}: ${String(e.message || e).slice(0, 140)}`);
      }
    }));
  }
  console.log(`\n완료: 성공 ${ok}, 보류 ${held}, 실패 ${fail} · 총비용 $${spent.toFixed(2)} ≈ ₩${Math.round(spent * 1400).toLocaleString()}`);
  await sql.end();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) run();
