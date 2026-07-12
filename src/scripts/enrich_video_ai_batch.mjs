// 영상 멀티모달 분석 — Batch API(비실시간, 50% 할인) 버전.
// 비동기: submit(작업 제출) → poll(상태 확인·결과 저장). 대량 시딩(1만곳)용.
// 사용법:
//   ENRICH_LIMIT=2 FORCE=1 node src/scripts/enrich_video_ai_batch.mjs submit   → 배치 제출, 작업명 저장
//   node src/scripts/enrich_video_ai_batch.mjs poll                            → 저장된 작업명으로 상태확인/결과저장
//   node src/scripts/enrich_video_ai_batch.mjs poll <batchName>                → 특정 작업명으로
import postgres from 'postgres';
import fs from 'fs';
import { normalizeBusinessHours } from '../lib/hours.mjs';

const ROOT = 'C:/modoo-matjip/food-feat-rebranding-modoo-matjip';
const env = fs.readFileSync(`${ROOT}/.env.local`, 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const JOB_FILE = `${ROOT}/.batch_job.txt`;
const MODE = process.argv[2];
const FORCE = process.env.FORCE === '1';
const LIMIT = process.env.ENRICH_LIMIT ? parseInt(process.env.ENRICH_LIMIT, 10) : null;

const PROMPT = (name) => `다음은 "${name}" 식당을 소개한 유튜브 영상이다. 영상의 화면·화면자막·음성을 모두 분석해 아래 JSON으로만 응답하라.
규칙: 영상에 실제로 나온 것만. 없으면 null 또는 []. 추측·창작 금지.
가격은 화면/음성에 실제로 나온 것만. "15.0"처럼 천원 단위면 "15,000원"으로 변환.
{
 "matches_restaurant": true/false,
 "match_confidence": 0.0~1.0,
 "picks": [{"name":"메뉴명","price":"15,000원 형식 또는 null","ate": true/false,"price_source":"onscreen|spoken|none"}],
 "quote": "유튜버가 이 집에 대해 한 인상적인 실제 한마디 또는 null",
 "tips": ["주문·이용 꿀팁(구체적으로)"],
 "signature": "이 집이 유명/특별한 이유 한 줄 또는 null",
 "mood_tags": ["혼밥/노포/가성비/데이트/가족외식 등 근거 있는 것만"],
 "hours": "영상에 나온 영업시간(예: 매일 11:00~21:00, 월 휴무) 또는 null"
}`;

async function fetchRows() {
  let rows = await sql`
    SELECT DISTINCT ON (r.id) r.id AS rid, r.name, v.id AS vid, v.youtube_video_id AS yt, rv.ai_insights, r.business_hours AS bhours
    FROM restaurants r
    JOIN restaurant_videos rv ON rv.restaurant_id = r.id
    JOIN videos v ON v.id = rv.video_id
    WHERE v.youtube_video_id IS NOT NULL
    ORDER BY r.id, v.view_count DESC NULLS LAST`;
  if (!FORCE) rows = rows.filter(r => !r.ai_insights);
  if (LIMIT) rows = rows.slice(0, LIMIT);
  return rows;
}

async function submit() {
  const rows = await fetchRows();
  console.log(`제출 대상 ${rows.length}곳`);
  if (!rows.length) { await sql.end(); return; }
  const requests = rows.map((r) => ({
    request: {
      contents: [{ parts: [
        { fileData: { fileUri: `https://www.youtube.com/watch?v=${r.yt}` }, videoMetadata: { fps: 0.2 } },
        { text: PROMPT(r.name) },
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2, mediaResolution: 'MEDIA_RESOLUTION_LOW' },
    },
    metadata: { key: `${r.rid}::${r.vid}::${r.bhours && r.bhours !== '정보 없음' ? 'has' : 'empty'}` },
  }));
  const body = { batch: { display_name: `video-ai-${rows.length}`, input_config: { requests: { requests } } } };
  const res = await fetch(`${BASE}/models/${MODEL}:batchGenerateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body),
  });
  const d = await res.json();
  if (!res.ok) { console.log('❌ 제출 실패:', JSON.stringify(d, null, 2).slice(0, 1200)); await sql.end(); return; }
  const name = d.name;
  fs.writeFileSync(JOB_FILE, name || '', 'utf8');
  console.log('✅ 제출됨. 작업명:', name);
  console.log('   상태:', d.metadata?.state || d.state || '(제출 직후)');
  console.log('   → 잠시 후 `node src/scripts/enrich_video_ai_batch.mjs poll` 로 결과 확인');
  await sql.end();
}

async function storeOne(key, obj) {
  const [rid, vid, hflag] = key.split('::');
  const insights = {
    picks: Array.isArray(obj.picks) ? obj.picks : [],
    tips: Array.isArray(obj.tips) ? obj.tips : [],
    signature: obj.signature || null,
    mood_tags: Array.isArray(obj.mood_tags) ? obj.mood_tags : [],
    match_confidence: typeof obj.match_confidence === 'number' ? obj.match_confidence : null,
  };
  const quote = obj.quote && obj.quote !== '정보 없음' ? String(obj.quote).slice(0, 300) : null;
  await sql`UPDATE restaurant_videos SET ai_insights = ${sql.json(insights)} ${quote ? sql`, quote = ${quote}` : sql``} WHERE restaurant_id = ${rid} AND video_id = ${vid}`;
  if (obj.hours && obj.hours !== '정보 없음' && hflag === 'empty') {
    const norm = normalizeBusinessHours(obj.hours);
    if (norm && norm !== '정보 없음') await sql`UPDATE restaurants SET business_hours = ${norm}, business_hours_source = 'video' WHERE id = ${rid}`;
  }
  return insights;
}

async function poll() {
  const name = process.argv[3] || (fs.existsSync(JOB_FILE) ? fs.readFileSync(JOB_FILE, 'utf8').trim() : '');
  if (!name) { console.log('작업명 없음. submit 먼저.'); await sql.end(); return; }
  const res = await fetch(`${BASE}/${name}`, { headers: { 'x-goog-api-key': KEY } });
  const d = await res.json();
  if (!res.ok) { console.log('❌ 폴링 실패:', JSON.stringify(d).slice(0, 600)); await sql.end(); return; }
  const state = d.metadata?.state || d.state || '';
  console.log('상태:', state);
  const succeeded = /SUCCEEDED/.test(state) || d.done === true || !!d.response;
  if (!succeeded) {
    console.log('아직 처리 중. 잠시 후 다시 poll 하세요. (Batch는 최대 24h)');
    await sql.end(); return;
  }
  // 결과 위치: inline(inlinedResponses) 또는 파일
  const inlined = d.response?.inlinedResponses?.inlinedResponses || d.response?.inlinedResponses || d.inlinedResponses;
  if (!inlined) {
    console.log('결과 형태 확인 필요 — 원본 일부:\n', JSON.stringify(d, null, 2).slice(0, 1500));
    await sql.end(); return;
  }
  let ok = 0, fail = 0;
  for (const item of inlined) {
    const key = item.metadata?.key;
    const txt = item.response?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    if (!key || !txt) { fail++; continue; }
    try { const ins = await storeOne(key, JSON.parse(txt)); ok++; console.log(`✓ ${key.split('::')[0].slice(0,8)} picks ${ins.picks.length} tips ${ins.tips.length}`); }
    catch (e) { fail++; console.log(`✗ ${key}: ${String(e.message).slice(0,80)}`); }
  }
  console.log(`\n완료: 저장 ${ok}, 실패 ${fail}`);
  await sql.end();
}

if (MODE === 'submit') await submit();
else if (MODE === 'poll') await poll();
else { console.log('사용법: submit | poll [batchName]'); await sql.end(); }
