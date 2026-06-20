import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const KAKAO_API_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY; // .env.local에 추가된 유튜브 키

if (!SUPABASE_URL || !GEMINI_API_KEY || !YOUTUBE_API_KEY) {
  console.error("환경 변수가 누락되었습니다. node --env-file=.env.local src/scripts/ai_crawler.mjs 로 실행하세요.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * 🏆 한국 맛집소개 유튜브 Top 50 채널 리스트 (샘플 7개 선적재, 50개까지 확장 가능)
 */
const TOP_FOOD_CHANNELS = [
  { name: "쯔양 tzuyang", channelId: "UCfpaSruWW3S4dibonKXENjA" },
  { name: "성시경 SUNG SI KYUNG", channelId: "UCl23-Cci_SMqyGXE1T_LYUg", seriesName: "먹을텐데" },
  { name: "재밌는 거 올라온다 (또간집)", channelId: "UC4ZA57iJrf73bJlApKFeLRw", seriesName: "또간집" },
  { name: "백종원 PAIK JONG WON", channelId: "UCyn-K7rZLXjGl7VXGweIlcA" },
  { name: "빅페이스 BIGFACE", channelId: "UCObJpvG3_f0P3EuLJCjzT5g" },
  { name: "김사원세끼", channelId: "UC-x55HF1-IilhxZOzwJm7JA" },
  { name: "마리아주", channelId: "UCKeVYAQKdY_YLSjxUrCuXcA" }
];

/**
 * [YouTube Data API] 채널의 최신 영상 메타데이터 수집 (업로드 재생목록 활용)
 */
async function fetchLatestVideos(channelId, maxResults = 10) {
  // PlaylistItems 404 에러 방지를 위해 Search API 사용 (비용: 100)
  const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=${maxResults}&type=video`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (!data.items) {
    console.log("   ❌ 유튜브 API 에러 또는 영상 없음:", data);
    return [];
  }

  const rawVideos = data.items.map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description, // 더보기란 텍스트
    publishedAt: item.snippet.publishedAt,
    thumbnail: item.snippet.thumbnails?.high?.url
  }));

  if (rawVideos.length === 0) return [];

  // 🛡️ [외부 재생 제한 검증] videos.list API를 호출하여 status.embeddable === true 인 영상만 필터링
  const videoIds = rawVideos.map(v => v.videoId).join(',');
  const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoIds}&part=status`;

  try {
    const detailRes = await fetch(videoDetailsUrl);
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      if (detailData.items) {
        // embeddable이 true인 비디오 ID들만 Set으로 정리
        const embeddableIds = new Set(
          detailData.items
            .filter(item => item.status?.embeddable === true)
            .map(item => item.id)
        );

        const filteredVideos = rawVideos.filter(v => embeddableIds.has(v.videoId));
        const skippedCount = rawVideos.length - filteredVideos.length;
        if (skippedCount > 0) {
          console.log(`   ⚠️ 외부 임베드가 비활성화된 비디오 ${skippedCount}개가 발견되어 수집 대상에서 선제 제외되었습니다.`);
        }
        return filteredVideos;
      }
    }
  } catch (error) {
    console.warn("   ⚠️ 유튜브 동영상 상태정보(embeddable) 상세조회 중 오류 발생. 필터링 없이 진행합니다.", error);
  }

  return rawVideos;
}

/**
 * [AI Agent] 영상 제목과 더보기란(또는 자막)을 기반으로 식당 정보 추출
 */
async function extractRestaurantInfoWithAI(videoTitle, videoDescription) {
  const prompt = `
    다음은 유튜브 맛집 리뷰 영상의 제목과 설명(더보기란) 텍스트입니다. 
    여기서 리뷰하고 있는 "식당 상호명"과 유저들을 사로잡을 만한 "한줄평(시그니처 메뉴 등)"을 추출하세요.
    또한 카카오맵 API 검색을 위해 지역명과 상호명이 결합된 "검색어(searchQuery)"를 만들어주세요 (예: '명동 명동교자 본점').
    추가로 영상에 안내된 5가지 방문 꿀팁(대표 메뉴 및 가격, 주차 정보, 예약 정보, 포장 정보, 영업시간)이 있다면 추출하고, 없으면 "정보 없음"으로 기록하세요.

    결과는 반드시 아래 JSON 형식으로만 반환하세요. 없으면 null로 반환.
    { 
      "restaurantName": "상호명", 
      "searchQuery": "카카오맵 최적화 검색어", 
      "quote": "한줄평 요약",
      "extracted_menu": "추출 대표 메뉴 정보 또는 '정보 없음'",
      "parking_info": "추출 주차 정보 또는 '정보 없음'",
      "reservation_info": "추출 예약 정보 또는 '정보 없음'",
      "packaging_info": "추출 포장 정보 또는 '정보 없음'",
      "business_hours_info": "추출 영업시간 정보 또는 '정보 없음'"
    }
    [영상 제목]: ${videoTitle}
    [영상 설명]: ${videoDescription}
  `;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  const data = await response.json();
  try {
    const jsonStr = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

/**
 * [Kakao Local API] 카카오맵 장소 검색
 */
async function getKakaoLocation(query) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { 
      'Authorization': `KakaoAK ${KAKAO_API_KEY}`,
      'Origin': 'http://localhost:3000',
      'KA': 'sdk/1.0 os/javascript origin/http%3A%2F%2Flocalhost%3A3000'
    }
  });
  
  const data = await response.json();
  if (data.documents && data.documents.length > 0) {
    const place = data.documents[0];
    return {
      kakao_place_id: place.id,
      name: place.place_name,
      category: place.category_name,
      address: place.road_address_name || place.address_name,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x)
    };
  }
  return null;
}

/**
 * 🚀 Top 50 유튜브 순회 메인 파이프라인
 */
async function runTop50Pipeline() {
  console.log("\\n🚀 [AI Data Crawler] 채널 릴레이 대량 수집 시작...\\n");

  for (const channel of TOP_FOOD_CHANNELS) {
    console.log(`====================================================`);
    console.log(`📺 채널 분석 중: [${channel.name}]`);
    
    // 1. YouTube 영상 수집 (채널당 최대 10개로 확장)
    const videos = await fetchLatestVideos(channel.channelId, 10);
    if (videos.length === 0) {
      console.log(`   ⚠️ 가져올 영상이 없습니다.`);
      continue;
    }

    for (const video of videos) {
      console.log(`\\n   🎬 수집된 영상: "${video.title}" (https://youtube.com/watch?v=${video.videoId})`);

      // 2. AI 분석
      console.log("   🧠 Gemini AI 분석 중...");
      const extracted = await extractRestaurantInfoWithAI(video.title, video.description);
      
      if (!extracted || !extracted.restaurantName) {
        console.log("   ⏭️ 식당 정보를 추출하지 못해 패스합니다.");
        continue;
      }
      console.log(`   ✅ AI 추출 결과 -> 식당명: [${extracted.restaurantName}], 검색어: [${extracted.searchQuery}]`);

      // 3. 카카오맵 매핑
      console.log(`   🗺️ 카카오맵 좌표 검색 중...`);
      let location = await getKakaoLocation(extracted.searchQuery);
      if (!location) location = await getKakaoLocation(extracted.restaurantName); // 원본 상호명으로 재시도
      
      if (!location) {
        console.log("   ❌ 카카오맵에서 식당을 찾을 수 없어 DB 적재를 건너뜁니다.");
        continue;
      }

      // 4. DB 적재 (채널 -> 시리즈 -> 비디오 -> 식당 -> 매핑)
      console.log("   🗄️ Supabase DB 적재 중...");
      
      // 채널 Upsert
      const { data: channelData } = await supabase
        .from('channels')
        .upsert({ youtube_channel_id: channel.channelId, name: channel.name }, { onConflict: 'youtube_channel_id' })
        .select().single();

      // 시리즈 Upsert (선택)
      let seriesId = null;
      if (channel.seriesName && channelData) {
        const { data: seriesData } = await supabase
          .from('series')
          .select('id')
          .eq('channel_id', channelData.id)
          .eq('name', channel.seriesName)
          .single();
        
        if (seriesData) {
          seriesId = seriesData.id;
        } else {
          const { data: newSeries } = await supabase
            .from('series')
            .insert({ channel_id: channelData.id, name: channel.seriesName })
            .select().single();
          if (newSeries) seriesId = newSeries.id;
        }
      }

      // 비디오 Upsert
      const { data: videoData } = await supabase
        .from('videos')
        .upsert({
          channel_id: channelData.id,
          series_id: seriesId,
          youtube_video_id: video.videoId,
          title: video.title,
          thumbnail_url: video.thumbnail,
          published_at: video.publishedAt
        }, { onConflict: 'youtube_video_id' })
        .select().single();

      // 식당 Upsert
      const { data: restData } = await supabase
        .from('restaurants')
        .upsert({
          kakao_place_id: location.kakao_place_id,
          name: location.name,
          category: location.category,
          address: location.address,
          road_address: location.road_address || null,
          lat: location.lat,
          lng: location.lng,
          parking: extracted.parking_info || '정보 없음',
          packaging: extracted.packaging_info || '정보 없음',
          reservation: extracted.reservation_info || '정보 없음',
          business_hours: extracted.business_hours_info || '정보 없음',
          menu_info: extracted.extracted_menu || '정보 없음'
        }, { onConflict: 'kakao_place_id' })
        .select().single();

      // 식당-비디오 매핑 (N:M)
      if (restData && videoData) {
        const { error: mappingError } = await supabase
          .from('restaurant_videos')
          .upsert({
            restaurant_id: restData.id,
            video_id: videoData.id,
            quote: extracted.quote || ''
          });
          
        if (!mappingError) {
          console.log(`   🎉 적재 성공! [${channel.name}] -> [${restData.name}]`);
        } else {
          console.log(`   ⚠️ 매핑 적재 실패: ${mappingError.message}`);
        }
      }
      
      // API Rate Limit 방지를 위한 1초 대기
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log("\\n✅ 모든 채널 순회 완료!");
}

runTop50Pipeline();
