// 지역 파라미터화 시드 (전국 확장용). seed_gwangju를 regionConfig + 채널게이트로 일반화.
// YouTube(조회수순)→채널게이트(맛집채널/코너만)→Gemini 식당추출→Kakao 매칭→지역·음식점 필터→DB(발행).
// 실행: node --env-file=.env.local src/scripts/seed_region.mjs gwangju   (REGION_KEY 인자 또는 env)
import { createClient } from '@supabase/supabase-js';
import { getRegion } from '../lib/regionConfig.mjs';
import { classifyChannel } from '../lib/channelPolicy.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const KAKAO_API_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
const YT = process.env.YOUTUBE_API_KEY;
if (!SUPABASE_URL || !GEMINI_API_KEY || !KAKAO_API_KEY || !YT) { console.error('환경변수 누락'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const cfg = getRegion(process.argv[2] || process.env.REGION_KEY || 'gwangju');
const TARGET = Number(process.env.SEED_TARGET) || cfg.target;
const VIEW_FLOOR = Number(process.env.SEED_VIEW_FLOOR) || cfg.viewFloor;
const PER_QUERY = 50, PAGES = Number(process.env.SEED_PAGES) || 1, CONCURRENCY = 6;
const LISTICLE = /(TOP\s*\d|베스트|순위|모음|몰아보기|\d+\s*곳|\d+\s*대\s|총정리|추천\s*\d|끝판왕|리스트)/i;
const isFoodPlace = (category) => (category || '').trim().startsWith('음식점');

const isoToSec = (iso) => { const m = (iso || 'PT0S').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0; };

const _chCache = new Map();
async function getChannelInfo(channelId) {
  if (!channelId) return { profile_image_url: null, subscriber_count: null };
  if (_chCache.has(channelId)) return _chCache.get(channelId);
  let info = { profile_image_url: null, subscriber_count: null };
  try {
    const data = await (await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${YT}&id=${channelId}&part=snippet,statistics`)).json();
    const it = data.items?.[0];
    if (it) { const th = it.snippet?.thumbnails; info.profile_image_url = th?.high?.url || th?.medium?.url || th?.default?.url || null; info.subscriber_count = it.statistics?.hiddenSubscriberCount ? null : (parseInt(it.statistics?.subscriberCount) || null); }
  } catch { /* noop */ }
  _chCache.set(channelId, info); return info;
}

async function searchVideos(query) {
  const raw = []; let pageToken = '';
  for (let p = 0; p < PAGES; p++) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YT}&q=${encodeURIComponent(query)}&part=snippet&type=video&order=viewCount&regionCode=KR&relevanceLanguage=ko&maxResults=${PER_QUERY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const data = await (await fetch(url)).json();
    if (!data.items) { if (data.error) console.log(`  ⚠️ ${query}: ${data.error.message}`); break; }
    data.items.filter(it => it.id?.videoId && !LISTICLE.test(it.snippet.title)).forEach(it => raw.push({
      videoId: it.id.videoId, title: it.snippet.title, description: it.snippet.description || '',
      publishedAt: it.snippet.publishedAt, thumbnail: it.snippet.thumbnails?.high?.url, channelId: it.snippet.channelId, channelTitle: it.snippet.channelTitle,
    }));
    pageToken = data.nextPageToken; if (!pageToken) break;
  }
  return raw;
}

async function filterPlayable(videos) {
  const out = [];
  for (let i = 0; i < videos.length; i += 50) {
    const batch = videos.slice(i, i + 50);
    try {
      const det = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${YT}&id=${batch.map(v => v.videoId).join(',')}&part=status,contentDetails,statistics`)).json();
      const ok = new Set(), views = {};
      (det.items || []).forEach(it => { if (it.status?.embeddable === true && isoToSec(it.contentDetails?.duration) > 60) ok.add(it.id); views[it.id] = parseInt(it.statistics?.viewCount) || null; });
      out.push(...batch.filter(v => ok.has(v.videoId)).map(v => ({ ...v, viewCount: views[v.videoId] ?? null })));
    } catch { out.push(...batch); }
  }
  return out;
}

async function extractRestaurant(title, description) {
  const prompt = `유튜브 맛집 리뷰 영상 제목/설명에서 리뷰된 "식당 상호명", "한줄평", 카카오맵 검색어(지역+상호), 방문정보를 추출.
대상은 실제 방문해 먹고 마시는 음식점·카페뿐이다.
다음이면 restaurantName을 null: 여러곳 나열/레시피/잡담/광고, 그리고 먹는 가게가 아닌 곳(반찬가게·식품 제조/판매·정육/수산 소매·미용실·숙박·병원·기업 등).
JSON만: {"restaurantName":"상호명 또는 null","searchQuery":"카카오맵 검색어","quote":"한줄평","extracted_menu":"대표메뉴 또는 정보 없음","parking_info":"주차 또는 정보 없음","reservation_info":"예약 또는 정보 없음","packaging_info":"포장 또는 정보 없음","business_hours_info":"영업시간 또는 정보 없음"}
[제목]: ${title}
[설명]: ${(description || '').substring(0, 1200)}`;
  try {
    const data = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
    })).json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  } catch { return null; }
}

async function kakaoLocation(query) {
  if (!query) return null;
  try {
    const data = await (await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}`, 'Origin': 'http://localhost:3000', 'KA': 'sdk/1.0 os/javascript origin/http%3A%2F%2Flocalhost%3A3000' },
    })).json();
    const p = data.documents?.[0];
    return p ? { kakao_place_id: p.id, name: p.place_name, category: p.category_name, address: p.road_address_name || p.address_name, road_address: p.road_address_name || null, phone: p.phone || '', lat: parseFloat(p.y), lng: parseFloat(p.x) } : null;
  } catch { return null; }
}

async function runPool(items, worker, concurrency, shouldStop) {
  let i = 0;
  const next = async () => { while (i < items.length && !shouldStop()) { await worker(items[i++]); } };
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  const { data: exRest } = await supabase.from('restaurants').select('kakao_place_id');
  const { data: exVid } = await supabase.from('videos').select('youtube_video_id');
  const seen = new Set((exRest || []).map(r => r.kakao_place_id));
  const existingVideos = new Set((exVid || []).map(v => v.youtube_video_id));
  let restaurants = seen.size;
  console.log(`\n🍽️ ${cfg.label} 시드 (현재 ${restaurants} → 목표 ${TARGET}, 조회수 하한 ${VIEW_FLOOR.toLocaleString()}, 쿼리 ${cfg.searchQueries.length})\n`);

  // 1. 발견 + 채널게이트(맛집채널/코너만; block 채널은 후보에서 제외)
  const videoMap = new Map(); let blocked = 0;
  for (const q of cfg.searchQueries) {
    for (const v of await searchVideos(q)) {
      if (videoMap.has(v.videoId) || existingVideos.has(v.videoId)) continue;
      const cls = classifyChannel({ channelName: v.channelTitle, title: v.title });
      if (cls.verdict === 'block') { blocked++; continue; }
      videoMap.set(v.videoId, v);
    }
    process.stdout.write(`\r  🔎 발견 ${videoMap.size} (채널제외 ${blocked})`);
  }
  const playable = await filterPlayable([...videoMap.values()]);
  const videos = playable.filter(v => (v.viewCount || 0) >= VIEW_FLOOR).sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  console.log(`\n\n재생가능 ${playable.length} → 조회수 ${VIEW_FLOOR.toLocaleString()}+ ${videos.length}개, 조회수순 처리 시작...\n`);

  // 2. 처리
  let processed = 0, skippedRegion = 0, skippedCategory = 0;
  await runPool(videos, async (v) => {
    processed++;
    const ex = await extractRestaurant(v.title, v.description);
    if (!ex || !ex.restaurantName || ex.restaurantName === 'null') return;
    let loc = await kakaoLocation(ex.searchQuery); if (!loc) loc = await kakaoLocation(ex.restaurantName);
    if (!loc) return;
    if (!isInRegionAddr(loc.address)) { skippedRegion++; return; }
    if (!isFoodPlace(loc.category)) { skippedCategory++; return; }
    let isNew = false;
    if (!seen.has(loc.kakao_place_id)) { seen.add(loc.kakao_place_id); isNew = true; restaurants++; }
    const chInfo = await getChannelInfo(v.channelId);
    const { data: ch } = await supabase.from('channels').upsert({ youtube_channel_id: v.channelId, name: v.channelTitle, ...(chInfo.profile_image_url ? { profile_image_url: chInfo.profile_image_url } : {}), ...(chInfo.subscriber_count != null ? { subscriber_count: chInfo.subscriber_count } : {}) }, { onConflict: 'youtube_channel_id' }).select('id').single();
    const { data: vid } = await supabase.from('videos').upsert({ channel_id: ch?.id, youtube_video_id: v.videoId, title: v.title, thumbnail_url: v.thumbnail, published_at: v.publishedAt, view_count: v.viewCount ?? null }, { onConflict: 'youtube_video_id' }).select('id').single();
    const { data: rest } = await supabase.from('restaurants').upsert({
      kakao_place_id: loc.kakao_place_id, name: loc.name, category: loc.category, address: loc.address, road_address: loc.road_address,
      phone: loc.phone || null, lat: loc.lat, lng: loc.lng, is_published: true,
      parking: ex.parking_info || '정보 없음', packaging: ex.packaging_info || '정보 없음', reservation: ex.reservation_info || '정보 없음',
      business_hours: ex.business_hours_info || '정보 없음', menu_info: ex.extracted_menu || '정보 없음',
    }, { onConflict: 'kakao_place_id' }).select('id').single();
    if (rest?.id && vid?.id) await supabase.from('restaurant_videos').upsert({ restaurant_id: rest.id, video_id: vid.id, quote: ex.quote || '' }, { onConflict: 'restaurant_id,video_id' });
    if (isNew) console.log(`  ✅ ${restaurants}. ${loc.name} [${v.channelTitle}]`);
  }, CONCURRENCY, () => restaurants >= TARGET);

  console.log(`\n=== 완료(${cfg.label}): 총 ${restaurants} · 영상처리 ${processed} · 지역외 ${skippedRegion} · 비음식점 ${skippedCategory} · 채널제외 ${blocked} ===`);
  process.exit(0);
}

import { isInRegion } from '../lib/regionConfig.mjs';
const isInRegionAddr = (addr) => isInRegion(addr, cfg);
main();
