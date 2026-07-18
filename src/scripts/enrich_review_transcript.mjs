// 자막(무료 자동자막) → 서술형 리뷰 보강. enrich_video_ai.mjs(멀티모달)가 채운 ai_insights에
// review(3~4문장)·pick별 comment를 "추가"하고, 비어 있던 tips/signature/mood_tags를 채운다.
// 화면 가격 등 멀티모달 결과는 절대 덮어쓰지 않음. ai_insights가 없던 식당은 자막만으로 생성(가격 없음).
// 사용법: node src/scripts/enrich_review_transcript.mjs           (review 없는 것만)
//        FORCE=1 node ...                                         (review 재생성)
//        ENRICH_LIMIT=3 node ...  ONLY="막동이회관" node ...  REGION=광주 node ...
import postgres from 'postgres';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { pathToFileURL } from 'url';
const pexec = promisify(execFile);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const ROOT = 'C:/modoo-matjip/food-feat-rebranding-modoo-matjip';
const YTDLP = `${ROOT}/data_pipeline/.venv/Scripts/yt-dlp.exe`;
const env = fs.readFileSync(`${ROOT}/.env.local`, 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const KEY = process.env.GEMINI_API_KEY;
const FORCE = process.env.FORCE === '1';
const LIMIT = process.env.ENRICH_LIMIT ? parseInt(process.env.ENRICH_LIMIT, 10) : null;
const ONLY = process.env.ONLY || null;
const REGION = process.env.REGION || null;
const DELAY_MS = process.env.DELAY_MS ? parseInt(process.env.DELAY_MS, 10) : 2500; // 요청 간 간격(스로틀 회피)

const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();

const PROMPT = (name, address, transcript) => `너는 대한민국 맛집 가이드 에디터다. 아래는 유튜버가 "${name}"(${address})을(를) 방문한 영상의 음성 자막 전문이다.
이 자막에서 해당 식당에 대한 유튜버의 '실제 발언'만 근거로 상세페이지용 리뷰를 구조화하라.

[엄격 규칙]
- 자막에 없는 내용은 절대 지어내지 마라. 근거 없으면 null 또는 [].
- 자막이 여러 식당을 다루면 오직 "${name}"에 해당하는 발언만 사용하라.
- "${name}" 방문/리뷰가 자막에 사실상 없으면 matches=false, 나머지는 비워라.
- 존댓말, 과장·홍보 문구 금지, 유튜버가 실제로 표현한 뉘앙스를 살릴 것.

[출력 JSON만]
{
 "matches": true/false,
 "confidence": 0.0~1.0,
 "one_liner": "유튜버 어조를 살린 한줄평(25자 내외) 또는 null",
 "review": "맛·식감·특징·추천 이유를 담은 3~4문장 서술형 리뷰(존댓말) 또는 null",
 "picks": [{"name":"메뉴명","comment":"이 메뉴 한줄평(한 문장, 30자 내외, 유튜버 표현 살려서)"}],   // 유튜버가 실제로 먹고 평한 메뉴만. 메뉴판에만 있고 안 먹은 건 제외.
 "signature": "이 집이 유명하거나 특별한 이유 한 줄 또는 null",
 "tips": ["방문·주문·조합 등 실용 꿀팁(자막 근거)"],
 "mood_tags": ["혼밥/노포/가성비/데이트/해장/술안주 등 근거 있는 상황·분위기 태그 3~5개"]
}
[자막]
${transcript.slice(0, 8000)}`;

class ThrottleError extends Error {}

// 자막은 yt-dlp가 직접 파일로 받게 한다(브라우저 유사 헤더). 429는 ThrottleError로 올려 루프에서 처리.
async function getTranscript(videoId) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sub-'));
  try {
    await pexec(YTDLP, [
      '--skip-download', '--no-warnings', '--no-playlist',
      '--write-subs', '--write-auto-subs', '--sub-langs', 'ko',
      '--sub-format', 'json3', '--sleep-requests', '1',
      '--extractor-retries', '3', '-o', path.join(dir, videoId),
      `https://www.youtube.com/watch?v=${videoId}`,
    ], { maxBuffer: 1024 * 1024 * 64 });
    const f = fs.readdirSync(dir).find(n => n.endsWith('.json3'));
    if (!f) return ''; // 자막 자체가 없음
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return (j.events || []).flatMap(e => (e.segs || []).map(s => s.utf8 || '')).join('').replace(/\s+/g, ' ').trim();
  } catch (e) {
    const msg = String(e.stderr || e.message || e);
    if (/429|Too Many|rate limit/i.test(msg)) throw new ThrottleError('429');
    throw e;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

async function structure(name, address, transcript) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(name, address, transcript) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(d).slice(0, 200));
  return JSON.parse(d.candidates[0].content.parts.map(p => p.text).join(''));
}

// 기존 ai_insights(멀티모달) 위에 자막 결과를 "추가 병합". 가격/기존 picks는 보존.
function merge(existing, t) {
  const base = existing || {};
  const out = { ...base };
  out.review = t.review || base.review || null;
  out.signature = base.signature || t.signature || null;
  out.tips = (base.tips && base.tips.length) ? base.tips : (Array.isArray(t.tips) ? t.tips : []);
  out.mood_tags = (base.mood_tags && base.mood_tags.length) ? base.mood_tags : (Array.isArray(t.mood_tags) ? t.mood_tags : []);

  const tPicks = Array.isArray(t.picks) ? t.picks : [];
  if (base.picks && base.picks.length) {
    // 기존 pick(가격 보유)에 자막 코멘트 주입 — 단, 유튜버가 실제 먹은(ate) 메뉴에만.
    out.picks = base.picks.map(p => {
      if (!p.ate) return p; // 메뉴판에만 있고 안 먹은 건 코멘트 금지(환각 방지)
      const hit = tPicks.find(tp => norm(tp.name) === norm(p.name) || norm(tp.name).includes(norm(p.name)) || norm(p.name).includes(norm(tp.name)));
      return hit && hit.comment ? { ...p, comment: hit.comment } : p;
    });
  } else if (tPicks.length) {
    // 멀티모달 pick이 없던 식당: 자막 pick으로 생성(먹은 것 기준, 가격 없음)
    out.picks = tPicks.map(tp => ({ name: tp.name, comment: tp.comment || null, ate: true, price: null, price_source: 'none' }));
  }
  return out;
}

async function run() {
  await sql`ALTER TABLE restaurant_videos ADD COLUMN IF NOT EXISTS ai_insights jsonb`;
  let rows = await sql`
    SELECT DISTINCT ON (r.id) r.id AS rid, r.name, r.address, v.id AS vid, v.youtube_video_id AS yt, rv.ai_insights, rv.quote
    FROM restaurants r
    JOIN restaurant_videos rv ON rv.restaurant_id = r.id
    JOIN videos v ON v.id = rv.video_id
    WHERE v.youtube_video_id IS NOT NULL
      ${REGION ? sql`AND r.address LIKE ${'%' + REGION + '%'}` : sql``}
    ORDER BY r.id, v.view_count DESC NULLS LAST`;
  if (ONLY) rows = rows.filter(r => r.name === ONLY);
  if (!FORCE) rows = rows.filter(r => !(r.ai_insights && r.ai_insights.review));
  if (LIMIT) rows = rows.slice(0, LIMIT);
  console.log(`대상 ${rows.length}곳 (FORCE=${FORCE}${REGION ? `, REGION=${REGION}` : ''})`);

  const COOLDOWN_MS = process.env.COOLDOWN_MS ? parseInt(process.env.COOLDOWN_MS, 10) : 180000; // 429 시 대기
  const MAX_COOLDOWNS = 8; // 총 스로틀 대기 상한(초과 시 남은 항목 포기)
  let ok = 0, skip = 0, fail = 0, done = 0, cooldowns = 0;
  for (const r of rows) { // 직렬 처리로 YouTube 자막 스로틀(429) 회피
    let tr;
    // 자막 획득: 429면 길게 쉬고 같은 항목 재시도
    while (true) {
      try { tr = await getTranscript(r.yt); break; }
      catch (e) {
        if (e instanceof ThrottleError && cooldowns < MAX_COOLDOWNS) {
          cooldowns++;
          console.log(`  ⏸ 429 스로틀 — ${COOLDOWN_MS / 1000}s 대기 후 재시도 (${cooldowns}/${MAX_COOLDOWNS}) @ ${r.name}`);
          await sleep(COOLDOWN_MS); continue;
        }
        tr = null; // 스로틀 상한 초과 또는 기타 오류
        if (e instanceof ThrottleError) { fail++; console.log(`✗ ${r.name}: 스로틀 상한 초과`); }
        else { fail++; console.log(`✗ ${r.name}: ${String(e.message || e).slice(0, 100)}`); }
        break;
      }
    }
    if (tr === null) { if (++done < rows.length) await sleep(DELAY_MS); continue; }
    try {
      if (!tr || tr.length < 200) { skip++; console.log(`- ${r.name}: 자막 없음/짧음`); }
      else {
        const t = await structure(r.name, r.address, tr);
        if (t.matches === false || (typeof t.confidence === 'number' && t.confidence < 0.5) || !t.review) {
          skip++; console.log(`- ${r.name}: 매칭낮음/리뷰없음(conf ${t.confidence ?? '?'})`);
        } else {
          const merged = merge(r.ai_insights, t);
          const newQuote = (!r.quote || r.quote.trim() === '') && t.one_liner ? String(t.one_liner).slice(0, 300) : null;
          await sql`
            UPDATE restaurant_videos
            SET ai_insights = ${sql.json(merged)}
                ${newQuote ? sql`, quote = ${newQuote}` : sql``}
            WHERE restaurant_id = ${r.rid} AND video_id = ${r.vid}`;
          ok++;
          const pc = (merged.picks || []).filter(p => p.comment).length;
          console.log(`✓ ${r.name} → review ${merged.review ? '✓' : '✗'} · 메뉴코멘트 ${pc} · tips ${(merged.tips || []).length}`);
        }
      }
    } catch (e) {
      fail++; console.log(`✗ ${r.name}: ${String(e.message || e).slice(0, 120)}`);
    }
    if (++done < rows.length) await sleep(DELAY_MS);
  }
  console.log(`\n완료: 보강 ${ok} · 스킵 ${skip} · 실패 ${fail}`);
  await sql.end();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) run();
