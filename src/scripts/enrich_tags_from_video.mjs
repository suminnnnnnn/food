// AI 자유생성 태그 (①단계) — Gemini 2.5 Flash 멀티모달이 유튜브 영상을 직접 분석해 태그 생성.
// 사전 없이 자율 생성하되 프롬프트 규칙으로 품질 확보. 정규화(②)는 추후 별도 단계.
// 저장: restaurants.ai_tags = [{tag, evidence, confidence}]  (원태그)
// 실행(샘플): ENRICH_LIMIT=5 node --env-file=.env.local src/scripts/enrich_tags_from_video.mjs
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const GEMINI = process.env.GEMINI_API_KEY;
if (!GEMINI) { console.error('환경변수 누락(GEMINI)'); process.exit(1); }

const LIMIT = Number(process.env.ENRICH_LIMIT) || 0;
const CONCURRENCY = Number(process.env.ENRICH_CONCURRENCY) || 2;
const MODEL = 'gemini-2.5-flash';

function buildPrompt(name, category) {
  return `너는 맛집 큐레이터다. 아래 유튜브 영상은 "${name}"${category ? `(${category})` : ''} 식당을 소개한 리뷰다.
이 영상(화면·음성·자막)을 직접 보고, 이 식당을 검색·발견하는 데 도움되는 태그를 **자유롭게** 생성하라.

[사고 절차]
1. 영상이 강조한 핵심(맛·분위기·방문상황·매장특징)을 먼저 정리한다.
2. 그중 "${category || '같은 종류'} 평범한 식당과 구별되는 이 집만의 특징"을 태그로 도출한다.

[규칙]
- 짧은 한국어 명사구(2~8자), 이용자가 실제로 검색할 법한 말.
- 3~6개. 확실한 것만. 애매하면 넣지 마라(정밀도 우선).
- 태그는 '이 집만의 특징·분위기·방문상황'을 담는다.
- 음식/메뉴 이름 태그는 **영상이 가장 강조한 시그니처 딱 1개만** 허용한다(예: 아귀간탕). 그 외 메뉴·음식종류(국밥·촌닭·해장국·대창구이 등)는 금지 — 메뉴는 별도로 다룬다.
- 금지: 편의정보(주차·예약·포장), 공인 큐레이션(미쉐린·블루리본·또간집), **인물·채널·프로그램명(성시경·백종원·허영만·먹을텐데·쯔양 등)**, 무의미어(맛집·존맛·JMT·강추·인정), 과장어(장군급·역대급·미친).
- 각 태그에 evidence(영상에서 확인한 구체 근거)와 confidence(0~1)를 붙여라.
- 영상에서 근거를 못 찾으면 그 태그를 만들지 마라. 추측·창작 금지.

아래 JSON으로만 응답:
{"tags":[{"tag":"웨이팅맛집","evidence":"오픈 전부터 대기줄이 늘어선 화면","confidence":0.9}]}`;
}

async function analyze(name, category, ytId) {
  const url = `https://www.youtube.com/watch?v=${ytId}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ fileData: { fileUri: url } }, { text: buildPrompt(name, category) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    });
    const data = await res.json();
    if (data.error) return { error: data.error.message };
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) return { error: 'no_text' };
    const parsed = JSON.parse(txt);
    return { tags: Array.isArray(parsed.tags) ? parsed.tags : [] };
  } catch (e) { return { error: e.message }; }
}

async function runPool(items, worker, c) {
  let i = 0;
  const next = async () => { while (i < items.length) { await worker(items[i++]); } };
  await Promise.all(Array.from({ length: c }, next));
}

async function main() {
  const { data: rests } = await supabase.from('restaurants').select('id, name, category');
  const restIds = (rests || []).map(r => r.id);

  // 식당 → 대표영상(조회수 최다) 매핑
  const { data: rv } = await supabase.from('restaurant_videos').select('restaurant_id, video_id').in('restaurant_id', restIds);
  const vidIds = [...new Set((rv || []).map(x => x.video_id))];
  const { data: vids } = await supabase.from('videos').select('id, youtube_video_id, view_count').in('id', vidIds);
  const vidById = new Map((vids || []).map(v => [v.id, v]));
  const restToBest = new Map();
  (rv || []).forEach(x => {
    const v = vidById.get(x.video_id); if (!v?.youtube_video_id) return;
    const cur = restToBest.get(x.restaurant_id);
    if (!cur || (v.view_count || 0) > (cur.view_count || 0)) restToBest.set(x.restaurant_id, v);
  });

  // 대표영상 조회수 내림차순으로 정렬(샘플이 유명 맛집이 되도록)
  let targets = (rests || []).filter(r => restToBest.has(r.id))
    .map(r => ({ ...r, best: restToBest.get(r.id) }))
    .sort((a, b) => (b.best.view_count || 0) - (a.best.view_count || 0));
  if (LIMIT) targets = targets.slice(0, LIMIT);

  console.log(`\n🏷️  AI 자유태그 생성 — 대상 ${targets.length}개 식당 (모델 ${MODEL}, 동시 ${CONCURRENCY})\n`);
  let ok = 0, fail = 0;
  await runPool(targets, async (r) => {
    const out = await analyze(r.name, r.category, r.best.youtube_video_id);
    if (out.error) {
      fail++;
      console.log(`❌ ${r.name} — ${out.error}`);
      return;
    }
    const tags = (out.tags || []).filter(t => t && t.tag);
    await supabase.from('restaurants').update({ ai_tags: tags }).eq('id', r.id);
    ok++;
    const view = r.best.view_count ? `${Math.floor(r.best.view_count / 10000)}만` : '-';
    console.log(`✅ ${r.name} [${r.category || ''}] (조회수 ${view})`);
    tags.forEach(t => console.log(`     · ${t.tag}  (${(t.confidence ?? 0)}) — ${t.evidence || ''}`));
  }, CONCURRENCY);

  console.log(`\n=== 완료: 성공 ${ok} / 실패 ${fail} ===`);
  process.exit(0);
}
main();
