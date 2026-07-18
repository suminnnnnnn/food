// 영상 콘텐츠 기반 상세 보강 (무위험) — 구글검색 그라운딩 없이, 우리가 정당히 보유한 유튜브 영상의
// "전체 설명란"(videos.list, 검색스니펫과 달리 잘리지 않음)에서 크리에이터가 언급한 메뉴·한줄평·정보만 추출.
// 실행: node --env-file=.env.local src/scripts/enrich_from_video.mjs   (ENRICH_LIMIT=3 테스트)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const GEMINI = process.env.GEMINI_API_KEY;
const YT = process.env.YOUTUBE_API_KEY;
if (!GEMINI || !YT) { console.error('환경변수 누락(GEMINI/YOUTUBE)'); process.exit(1); }

const LIMIT = Number(process.env.ENRICH_LIMIT) || 0;
const CONCURRENCY = 4;
const empty = (v) => !v || v === '정보 없음';

// videos.list 로 전체 설명란 조회 (50개씩 배치)
async function fetchDescriptions(ytIds) {
  const map = new Map();
  for (let i = 0; i < ytIds.length; i += 50) {
    const batch = ytIds.slice(i, i + 50);
    try {
      const data = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${YT}&id=${batch.join(',')}&part=snippet`)).json();
      if (data.error) { console.log('  ⚠️ videos.list:', data.error.message); }
      (data.items || []).forEach(it => map.set(it.id, { title: it.snippet?.title || '', description: it.snippet?.description || '' }));
    } catch (e) { console.log('  ⚠️', e.message); }
  }
  return map;
}

async function extract(name, videoText) {
  const prompt = `다음은 "${name}" 식당을 소개한 유튜브 영상의 제목과 설명란(더보기) 원문이다.
크리에이터가 실제로 언급/작성한 정보만 추출하라. 추론·창작 금지 — 없으면 "정보 없음".

특히 menu는 "유튜버 Pick" 용도다: 영상에서 유튜버가 **직접 주문해서 먹은 메뉴**를 먹은 순서·비중대로 우선 추출하라.
- 형식: '메뉴명 가격'을 쉼표로 구분. 가격이 언급 안 됐으면 메뉴명만. (예: '육회비빔밥 12000원, 소머리국밥 10000원, 수육')
- 유튜버가 먹지 않았어도 영상이 강조한 대표/시그니처 메뉴가 있으면 뒤에 덧붙여도 된다.
- 아무 메뉴도 확인 불가면 "정보 없음".

[영상 텍스트]
${videoText.substring(0, 4500)}

아래 JSON으로만 응답:
{"menu":"유튜버가 주문해 먹은 메뉴 우선, '메뉴명 가격' 쉼표구분 또는 정보 없음","quote":"이 식당의 매력을 담은 생생한 한줄평","parking":"언급된 주차 또는 정보 없음","reservation":"언급된 예약 또는 정보 없음","packaging":"언급된 포장 또는 정보 없음","hours":"언급된 영업시간 또는 정보 없음","keywords":["🔥키워드","키워드2","키워드3"]}`;
  try {
    const data = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
    })).json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  } catch { return null; }
}

async function runPool(items, worker, concurrency) {
  let i = 0, done = 0;
  const next = async () => { while (i < items.length) { await worker(items[i++]); done++; if (done % 15 === 0) console.log(`  …${done}/${items.length}`); } };
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  let rq = supabase.from('restaurants').select('id, name, menu_info, parking, reservation, packaging, business_hours').order('created_at', { ascending: true });
  if (LIMIT) rq = rq.limit(LIMIT);
  const { data: rests } = await rq;
  const restIds = rests.map(r => r.id);

  // 식당 → 영상 매핑
  const { data: rv } = await supabase.from('restaurant_videos').select('restaurant_id, video_id').in('restaurant_id', restIds);
  const vidIds = [...new Set((rv || []).map(x => x.video_id))];
  const { data: vids } = await supabase.from('videos').select('id, youtube_video_id').in('id', vidIds);
  const vidById = new Map((vids || []).map(v => [v.id, v.youtube_video_id]));
  const restToYt = new Map();
  (rv || []).forEach(x => { const yt = vidById.get(x.video_id); if (yt) { if (!restToYt.has(x.restaurant_id)) restToYt.set(x.restaurant_id, []); restToYt.get(x.restaurant_id).push({ ytId: yt, videoRowId: x.video_id }); } });

  // 전체 설명란 조회
  const allYt = [...new Set([].concat(...[...restToYt.values()].map(a => a.map(x => x.ytId))))];
  console.log(`\n🎬 영상 ${allYt.length}개 전체 설명란 조회...`);
  const descMap = await fetchDescriptions(allYt);

  console.log(`🍽️ 식당 ${rests.length}개 영상기반 보강 (동시 ${CONCURRENCY})...\n`);
  let updated = 0, menuFilled = 0;
  await runPool(rests, async (r) => {
    const vids = restToYt.get(r.id) || [];
    if (!vids.length) return;
    const text = vids.map(v => { const d = descMap.get(v.ytId); return d ? `【${d.title}】\n${d.description}` : ''; }).filter(Boolean).join('\n\n---\n\n');
    if (!text.trim()) return;
    const ex = await extract(r.name, text);
    if (!ex) return;
    const upd = {};
    // 메뉴는 영상기반으로 우선(있으면 갱신)
    if (ex.menu && ex.menu !== '정보 없음') { upd.menu_info = ex.menu; menuFilled++; }
    // 나머지는 크리에이터가 명시한 경우에만 빈 필드 채움
    const fill = (col, val) => { if (val && val !== '정보 없음' && empty(r[col])) upd[col] = val; };
    fill('parking', ex.parking); fill('reservation', ex.reservation); fill('packaging', ex.packaging); fill('business_hours', ex.hours);
    if (Object.keys(upd).length) { await supabase.from('restaurants').update(upd).eq('id', r.id); updated++; }
    // 한줄평/키워드는 대표 영상 매핑에 반영
    if ((ex.quote && ex.quote !== '정보 없음') || (Array.isArray(ex.keywords) && ex.keywords.length)) {
      const primary = vids[0];
      const patch = {};
      if (ex.quote && ex.quote !== '정보 없음') patch.quote = ex.quote;
      if (Array.isArray(ex.keywords) && ex.keywords.length) patch.keywords = ex.keywords.slice(0, 3);
      if (Object.keys(patch).length) await supabase.from('restaurant_videos').update(patch).eq('restaurant_id', r.id).eq('video_id', primary.videoRowId);
    }
  }, CONCURRENCY);

  console.log(`\n=== 완료: ${updated}/${rests.length} 식당 보강 (메뉴 갱신 ${menuFilled}) ===`);
  process.exit(0);
}
main();
