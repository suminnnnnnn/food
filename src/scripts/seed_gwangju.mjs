// 광주 오픈 콘텐츠 시드 — YouTube 검색 → Gemini 식당추출 → Kakao 매칭 → 광주 필터 → DB 적재(발행)
// 재실행 안전: 기존 영상/식당 스킵 + 카운터 사전주입으로 TARGET(총량)까지 부족분만 추가.
// 실행: node --env-file=.env.local src/scripts/seed_gwangju.mjs   (SEED_TARGET=... 오버라이드)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const KAKAO_API_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
const YT = process.env.YOUTUBE_API_KEY;
if (!SUPABASE_URL || !GEMINI_API_KEY || !KAKAO_API_KEY || !YT) { console.error('환경변수 누락'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TARGET = Number(process.env.SEED_TARGET) || 170;   // DB 총 식당 목표
const PER_QUERY = 50;
const PAGES = Number(process.env.SEED_PAGES) || 2;        // 쿼리당 페이지 수
const CONCURRENCY = 6;
const LISTICLE = /(TOP\s*\d|베스트|순위|모음|몰아보기|\d+\s*곳|\d+\s*대\s|총정리|추천\s*\d|끝판왕|리스트)/i;
// 타깃 지역만 (경기 광주 등 오매칭 원천 차단)
const isGwangju = (a) => !!a && (a.includes('전남광주통합특별시') || a.includes('광주광역시'));

const SEARCH_QUERIES = [
  '광주 맛집', '광주 먹방', '광주 노포', '광주 백반', '광주 국밥', '광주 혼밥', '광주 밥집', '광주 안주',
  '광주 동구 맛집', '광주 서구 맛집', '광주 남구 맛집', '광주 북구 맛집', '광주 광산구 맛집',
  '광주 상무지구 맛집', '광주 충장로 맛집', '광주 첨단 맛집', '광주 수완지구 맛집', '광주 양림동 맛집', '광주 봉선동 맛집', '광주 동명동 맛집', '광주 유동 맛집',
  '광주 삼겹살', '광주 고기집', '광주 오리탕', '광주 육전', '광주 상추튀김', '광주 냉면', '광주 국수', '광주 칼국수', '광주 백숙',
  '광주 회 맛집', '광주 초밥', '광주 짜장면', '광주 파스타', '광주 피자', '광주 브런치', '광주 빵집', '광주 카페', '광주 술집', '광주 포차',
  '성시경 먹을텐데 광주', '또간집 광주', '쯔양 광주', '백종원 광주', '김사원세끼 광주', '풍자 광주 맛집', '히밥 광주', '광주 맛집 브이로그',
  '광주 현지인 맛집', '광주 숨은 맛집', '광주 노포 백반', '광주 기사식당', '광주 아침식사',
];

const isoToSec = (iso) => { const m = (iso || 'PT0S').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0; };

// 채널 프로필 이미지 + 구독자수 조회 (채널별 1회 캐시)
const _channelInfoCache = new Map();
async function getChannelInfo(channelId) {
  if (!channelId) return { profile_image_url: null, subscriber_count: null };
  if (_channelInfoCache.has(channelId)) return _channelInfoCache.get(channelId);
  let info = { profile_image_url: null, subscriber_count: null };
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?key=${YT}&id=${channelId}&part=snippet,statistics`;
    const data = await (await fetch(url)).json();
    const it = data.items?.[0];
    if (it) {
      const th = it.snippet?.thumbnails;
      info.profile_image_url = th?.high?.url || th?.medium?.url || th?.default?.url || null;
      info.subscriber_count = it.statistics?.hiddenSubscriberCount ? null : (parseInt(it.statistics?.subscriberCount) || null);
    }
  } catch { /* 조회 실패 시 null 유지 */ }
  _channelInfoCache.set(channelId, info);
  return info;
}

async function searchVideos(query) {
  const raw = [];
  let pageToken = '';
  for (let p = 0; p < PAGES; p++) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YT}&q=${encodeURIComponent(query)}&part=snippet&type=video&order=relevance&regionCode=KR&relevanceLanguage=ko&maxResults=${PER_QUERY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const data = await (await fetch(url)).json();
    if (!data.items) { if (data.error) console.log(`  ⚠️ ${query}: ${data.error.message}`); break; }
    data.items.filter(it => it.id?.videoId && !LISTICLE.test(it.snippet.title)).forEach(it => raw.push({
      videoId: it.id.videoId, title: it.snippet.title, description: it.snippet.description || '',
      publishedAt: it.snippet.publishedAt, thumbnail: it.snippet.thumbnails?.high?.url, channelId: it.snippet.channelId, channelTitle: it.snippet.channelTitle,
    }));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return raw;
}

// 임베드 가능 + 60초 초과 필터 (videos.list, 50개씩 배치)
async function filterPlayable(videos) {
  const out = [];
  for (let i = 0; i < videos.length; i += 50) {
    const batch = videos.slice(i, i + 50);
    try {
      const det = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${YT}&id=${batch.map(v => v.videoId).join(',')}&part=status,contentDetails`)).json();
      const ok = new Set((det.items || []).filter(it => it.status?.embeddable === true && isoToSec(it.contentDetails?.duration) > 60).map(it => it.id));
      out.push(...batch.filter(v => ok.has(v.videoId)));
    } catch { out.push(...batch); }
  }
  return out;
}

async function extractRestaurant(title, description) {
  const prompt = `유튜브 맛집 리뷰 영상 제목/설명에서 리뷰된 "식당 상호명", "한줄평", 카카오맵 검색어(지역+상호), 방문정보를 추출.
실제 특정 식당 방문 리뷰가 아니면(여러곳 나열/레시피/잡담/광고) restaurantName을 null.
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
    return p ? { kakao_place_id: p.id, name: p.place_name, category: p.category_name, address: p.road_address_name || p.address_name, road_address: p.road_address_name || null, lat: parseFloat(p.y), lng: parseFloat(p.x) } : null;
  } catch { return null; }
}

async function runPool(items, worker, concurrency, shouldStop) {
  let i = 0;
  const next = async () => { while (i < items.length && !shouldStop()) { await worker(items[i++]); } };
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  // 기존 데이터 로드 (재실행 안전)
  const { data: exRest } = await supabase.from('restaurants').select('kakao_place_id');
  const { data: exVid } = await supabase.from('videos').select('youtube_video_id');
  const seen = new Set((exRest || []).map(r => r.kakao_place_id));
  const existingVideos = new Set((exVid || []).map(v => v.youtube_video_id));
  let restaurants = seen.size;
  console.log(`\n🍽️ 광주 시드 (현재 ${restaurants} → 목표 ${TARGET}, 쿼리 ${SEARCH_QUERIES.length}×${PAGES}p, 동시 ${CONCURRENCY})\n`);

  // 1. 발견
  const videoMap = new Map();
  for (const q of SEARCH_QUERIES) {
    if (restaurants >= TARGET) break;
    (await searchVideos(q)).forEach(v => { if (!videoMap.has(v.videoId) && !existingVideos.has(v.videoId)) videoMap.set(v.videoId, v); });
    process.stdout.write(`\r  🔎 발견 누적(신규) ${videoMap.size}`);
  }
  const videos = await filterPlayable([...videoMap.values()]);
  console.log(`\n\n신규 후보 영상 ${videos.length}개 처리 시작...\n`);

  // 2. 처리
  let processed = 0, skippedGwangju = 0;
  await runPool(videos, async (v) => {
    processed++;
    const ex = await extractRestaurant(v.title, v.description);
    if (!ex || !ex.restaurantName || ex.restaurantName === 'null') return;
    let loc = await kakaoLocation(ex.searchQuery);
    if (!loc) loc = await kakaoLocation(ex.restaurantName);
    if (!loc) return;
    if (!isGwangju(loc.address)) { skippedGwangju++; return; }
    let isNew = false;
    if (!seen.has(loc.kakao_place_id)) { seen.add(loc.kakao_place_id); isNew = true; restaurants++; }
    const chInfo = await getChannelInfo(v.channelId);
    const { data: ch } = await supabase.from('channels').upsert({
      youtube_channel_id: v.channelId,
      name: v.channelTitle,
      ...(chInfo.profile_image_url ? { profile_image_url: chInfo.profile_image_url } : {}),
      ...(chInfo.subscriber_count != null ? { subscriber_count: chInfo.subscriber_count } : {}),
    }, { onConflict: 'youtube_channel_id' }).select('id').single();
    const { data: vid } = await supabase.from('videos').upsert({ channel_id: ch?.id, youtube_video_id: v.videoId, title: v.title, thumbnail_url: v.thumbnail, published_at: v.publishedAt }, { onConflict: 'youtube_video_id' }).select('id').single();
    const { data: rest } = await supabase.from('restaurants').upsert({
      kakao_place_id: loc.kakao_place_id, name: loc.name, category: loc.category, address: loc.address, road_address: loc.road_address,
      lat: loc.lat, lng: loc.lng, is_published: true,
      parking: ex.parking_info || '정보 없음', packaging: ex.packaging_info || '정보 없음', reservation: ex.reservation_info || '정보 없음',
      business_hours: ex.business_hours_info || '정보 없음', menu_info: ex.extracted_menu || '정보 없음',
    }, { onConflict: 'kakao_place_id' }).select('id').single();
    if (rest?.id && vid?.id) await supabase.from('restaurant_videos').upsert({ restaurant_id: rest.id, video_id: vid.id, quote: ex.quote || '' }, { onConflict: 'restaurant_id,video_id' });
    if (isNew) console.log(`  ✅ ${restaurants}. ${loc.name} [${v.channelTitle}]`);
  }, CONCURRENCY, () => restaurants >= TARGET);

  console.log(`\n=== 완료: 총 식당 ${restaurants} (신규분 포함) · 영상처리 ${processed} · 광주외 스킵 ${skippedGwangju} ===`);
  process.exit(0);
}
main();
