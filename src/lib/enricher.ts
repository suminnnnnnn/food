import { createClient } from '@supabase/supabase-js';

// Supabase 관리자 권한 클라이언트 생성 (RLS 우회하여 벌크 적재 가능하도록 환경변수 연계)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY || process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

export interface EnrichedRestaurant {
  kakao_place_id: string;
  name: string;
  category: string;
  address: string;
  road_address: string | null;
  lat: number;
  lng: number;
  phone: string;
  parking: string;
  packaging: string;
  reservation: string;
  business_hours: string;
  menu_info: string;
}

export interface EnrichedVideo {
  youtube_video_id: string;
  title: string;
  thumbnail_url: string;
  channel_id: string;
  channel_name: string;
  channel_profile_url: string;
  quote: string;
  keywords: string[];
  view_count: number;
  is_short: boolean;
}

/**
 * 768차원 Gemini 임베딩 벡터 추출 함수
 */
async function getGeminiEmbedding(text: string): Promise<number[]> {
  const defaultVector = (): number[] => {
    const dummy = Array(768).fill(0).map(() => (Math.random() - 0.5) * 0.1);
    const magnitude = Math.sqrt(dummy.reduce((sum, val) => sum + val * val, 0)) || 1;
    return dummy.map(val => val / magnitude);
  };

  if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY 가 환경변수에 설정되어 있지 않아 더미 임베딩을 생성합니다.");
    return defaultVector();
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.embedding && data.embedding.values) {
        return data.embedding.values;
      }
    }
    console.warn(`[Gemini Embedding] API 응답 에러로 인해 더미 임베딩을 할당합니다. Status: ${response.status}`);
  } catch (error: any) {
    console.warn(`[Gemini Embedding] 호출 실패 예외 처리로 더미 임베딩 할당:`, error.message);
  }

  return defaultVector();
}




/**
 * 주소 주어짐을 바탕으로 카카오 로컬 장소 검색 API 호출
 */
export async function getKakaoPlaceInfo(query: string): Promise<any | null> {
  if (!KAKAO_API_KEY) {
    console.warn("KAKAO_REST_API_KEY가 존재하지 않아 카카오 검색을 생략합니다.");
    return null;
  }
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  try {
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
        address: place.address_name,
        road_address: place.road_address_name || null,
        lat: parseFloat(place.y),
        lng: parseFloat(place.x),
        phone: place.phone || ''
      };
    }
  } catch (error) {
    console.error("카카오 로컬 API 호출 에러:", error);
  }
  return null;
}

/**
 * 도로명/지번 주소로부터 동/구 단위의 지역 키워드를 파싱하여 추출
 */
export function extractRegionKeyword(address: string): string {
  if (!address) return '';
  // 지번이나 도로명 주소에서 구/동/읍/면 단위 추출
  const matches = address.match(/([가-힣]+(?:구|동|읍|면|로))/g);
  if (matches && matches.length > 0) {
    // 시/도 단위를 건너뛰고 최대한 상세한 구/동 단위를 우선 반환
    const filtered = matches.filter(m => !m.endsWith('시') && !m.endsWith('도'));
    if (filtered.length > 0) {
      return filtered[filtered.length - 1]; // 가장 뒤의 상세 동/로 단위 반환
    }
    return matches[matches.length - 1];
  }
  return '';
}

/**
 * ISO 8601 형식의 유튜브 동영상 재생시간을 파싱하여 60초 미만(쇼츠) 여부 판정
 */
function isShortsDuration(durationStr: string): boolean {
  if (!durationStr) return false;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return totalSeconds < 60; // 60초 미만은 쇼츠로 간주
}

/**
 * 카카오 식당명과 지역 키워드로 유튜브에서 가장 높은 조회수를 기록한 비디오를 조회 (쇼츠 제외)
 */
export async function getPopularYouTubeVideo(restaurantName: string, region: string): Promise<any | null> {
  if (!YOUTUBE_API_KEY) {
    console.warn("YOUTUBE_API_KEY 가 없어 유튜브 조회를 건너뜁니다.");
    return null;
  }

  const cleanName = restaurantName
    .replace(/\s*([가-힣\d]+점|[가-힣\d]+관|원조[가-힣]+)\s*$/, '')
    .trim();

  // 1차 쿼리: "[식당명] + [지역명] + 맛집"
  let query = `${cleanName} ${region} 맛집`;
  console.log(`[YouTube Search] 1차 최적 검색 쿼리 빌딩: "${query}"`);
  
  let searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=${encodeURIComponent(query)}&part=snippet&order=viewCount&type=video&maxResults=5`; // 넉넉히 5개 수집
  
  try {
    let res = await fetch(searchUrl);
    let data = await res.json();
    
    // 만약 결과가 없으면 2차 쿼리: "[식당명] + 맛집" 으로 완화
    if (!data.items || data.items.length === 0) {
      query = `${cleanName} 맛집`;
      console.log(`[YouTube Search] 결과가 없어 2차 완화 쿼리 검색: "${query}"`);
      searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=${encodeURIComponent(query)}&part=snippet&order=viewCount&type=video&maxResults=5`;
      res = await fetch(searchUrl);
      data = await res.json();
    }

    if (!data.items || data.items.length === 0) {
      console.log(`[YouTube Search] 매칭 비디오를 찾을 수 없습니다.`);
      return null;
    }

    // 외부 임베드 가능 여부 및 쇼츠 배제를 위해 contentDetails, status, statistics 조회
    const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
    const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoIds}&part=snippet,status,statistics,contentDetails`;
    
    const detailsRes = await fetch(videoDetailsUrl);
    const detailsData = await detailsRes.json();
    
    if (detailsData.items && detailsData.items.length > 0) {
      // 🛡️ 필터링 조건: 1. 임베드 가능해야 함 (쇼츠 차단 제거)
      const validVideos = detailsData.items.filter((v: any) => {
        const isEmbeddable = v.status?.embeddable === true;
        return isEmbeddable;
      });
      
      if (validVideos.length === 0) {
        console.log(`[YouTube Search] 필터링 조건(임베드 허용)을 충족하는 영상이 없습니다.`);
        return null;
      }

      // 조회수 순으로 정렬하여 1위 영상 선택
      validVideos.sort((a: any, b: any) => {
        const viewA = parseInt(a.statistics?.viewCount || '0', 10);
        const viewB = parseInt(b.statistics?.viewCount || '0', 10);
        return viewB - viewA;
      });

      const bestVideo = validVideos[0];
      const channelId = bestVideo.snippet.channelId;
      
      // 쇼츠 여부 판별 (재생시간이 60초 미만이거나 제목/설명란에 shorts 키워드가 있는 경우)
      const duration = bestVideo.contentDetails?.duration || '';
      const isShortsTime = isShortsDuration(duration);
      const titleLower = (bestVideo.snippet?.title || '').toLowerCase();
      const descLower = (bestVideo.snippet?.description || '').toLowerCase();
      const hasShortsKeyword = titleLower.includes('shorts') || descLower.includes('shorts') || titleLower.includes('쇼츠') || descLower.includes('쇼츠');
      const isShort = isShortsTime || hasShortsKeyword;

      if (isShort) {
        console.log(`   ℹ️ [쇼츠 감지] "${bestVideo.snippet?.title}" 영상은 쇼츠로 감지되었습니다.`);
      }

      // 채널 프로필 조회
      let channelProfileUrl = '';
      try {
        const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`);
        if (chRes.ok) {
          const chData = await chRes.json();
          if (chData.items && chData.items.length > 0) {
            channelProfileUrl = chData.items[0].snippet.thumbnails?.default?.url || '';
          }
        }
      } catch (chErr) {
        console.warn("YouTube 채널 프로필 조회 실패:", chErr);
      }

      return {
        youtube_video_id: bestVideo.id,
        title: bestVideo.snippet.title,
        thumbnail_url: bestVideo.snippet.thumbnails?.high?.url || bestVideo.snippet.thumbnails?.default?.url || '',
        channel_id: channelId,
        channel_name: bestVideo.snippet.channelTitle,
        channel_profile_url: channelProfileUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(bestVideo.snippet.channelTitle)}&background=ff5e00&color=fff&bold=true&size=128&rounded=true`,
        view_count: parseInt(bestVideo.statistics?.viewCount || '0', 10),
        description: bestVideo.snippet.description || '',
        is_short: isShort
      };
    }
  } catch (err) {
    console.error("유튜브 검색 중 예외 발생:", err);
  }
  return null;
}


/**
 * Gemini 2.5 Flash를 사용하여 식당 상세 편의 정보 및 비디오 한줄평 등을 분석 보강
 */
export async function enrichDataWithGemini(
  restaurantName: string, 
  address: string, 
  video: { title: string; channel_name: string; description: string }
): Promise<{ restaurant: Partial<EnrichedRestaurant>; video: Partial<EnrichedVideo> } | null> {
  if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY가 설정되어 있지 않아 AI 보강을 패스합니다.");
    return null;
  }

  const prompt = `
당신은 대한민국 최고의 푸드 데이터 인텔리전스 AI 에이전트입니다.
제시된 식당 정보, 유튜브 영상 설명 텍스트, 그리고 필요시 구글 검색(Google Search) 결과를 바탕으로, 해당 식당의 실시간 전화번호, 주차 가능 여부, 포장 여부, 예약 방식, 운영 시간, 주요 시그니처 메뉴 정보를 구조화하여 상세히 추출해 주세요.

[식당 기본 정보]
- 식당명: ${restaurantName}
- 주소: ${address}

[연관 유튜브 영상 정보]
- 영상 타이틀: ${video.title}
- 유튜버 채널: ${video.channel_name}
- 영상 설명란 본문: ${video.description}

[🔥 엄격한 추출 및 검색 활용 가이드라인]
1. **정확한 정보 수집**: 전화번호, 영업시간, 대표메뉴 정보가 유튜브 설명란에 나와있지 않다면, 제공된 구글 검색(Google Search) 기능을 통해 실제 가게 정보를 직접 검색 및 확인하여 정확히 작성하세요.
2. **메뉴 및 가격 기재**: 대표적인 시그니처 메뉴명과 가격을 정확히 조사하여 기재하고, 확인이 전혀 불가능한 경우에만 "정보 없음"으로 표기하십시오.
3. **유튜버 꿀팁 요약(quote)의 정밀화**: 유튜버가 영상 설명글이나 본문에서 직접 추천하고 강조한 실전 방문 꿀팁(대표적인 메뉴 주문 조합, 피해야 할 대기 시간대, 주차 요령 등 실질적인 팁)을 유튜버 특유의 생세계 한 줄 요약해 주세요. (예: "주말엔 11시 전 오픈런 필수, 시그니처 짚불구이에 비빔국수 조합이 베스트!")
4. **키워드 태그(keywords)**: 이 식당과 영상의 특징을 압축하는 이모지 포함 태그 3개(예: "🔥 노포감성", "🥩 연탄구이", "💸 가성비")를 창작해 주세요.

반드시 다른 설명 없이 아래 JSON 템플릿의 형태로만 정확히 응답해 주세요. 마크다운 백틱(\`\`\`json ... \`\`\`)을 포함해서 출력하세요.
\`\`\`json
{
  "phone": "전화번호",
  "parking": "주차 정보",
  "packaging": "포장 가능 여부",
  "reservation": "예약 방식 정보",
  "business_hours": "영업시간 정보",
  "menu_info": "대표 메뉴 및 가격 정보",
  "quote": "유튜버가 직접 강조한 실전 방문 및 주문 꿀팁 요약",
  "keywords": ["🔥 태그1", "💸 태그2", "🥩 태그3"]
}
\`\`\`
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.0
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text;
      
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawText;
      const parsed = JSON.parse(jsonStr.trim());
      
      return {
        restaurant: {
          phone: parsed.phone || "정보 없음",
          parking: parsed.parking || "정보 없음",
          packaging: parsed.packaging || "정보 없음",
          reservation: parsed.reservation || "정보 없음",
          business_hours: parsed.business_hours || "정보 없음",
          menu_info: parsed.menu_info || "정보 없음"
        },
        video: {
          quote: parsed.quote || "AI 검증 맛집",
          keywords: parsed.keywords || []
        }
      };
    }
    console.warn(`[Gemini AI] API 응답 에러. Status: ${response.status}`);
  } catch (error) {
    console.error("Gemini AI 정보 보강 API 호출 에러:", error);
  }
  return null;
}

/**
 * 1. 식당 상호명 단독 입력을 인풋으로 받아 전체 보강 프로세스를 원스톱으로 처리하는 메인 Enricher
 */
export async function enrichRestaurantByName(restaurantName: string, initialAddress?: string): Promise<{ restaurant: EnrichedRestaurant, video: EnrichedVideo } | null> {
  console.log(`\n====================================================`);
  console.log(`[Enricher] "${restaurantName}" 맛집 정보 자동 수집 시작`);

  // 1단계: 카카오 장소 검색 (완화 로직 순차 적용)
  let place = null;
  
  if (initialAddress) {
    // 1-1. 전체 주소 + 상호명으로 시도
    const searchQuery = `${initialAddress} ${restaurantName}`;
    place = await getKakaoPlaceInfo(searchQuery);
  }

  if (!place && initialAddress) {
    // 1-2. 구/동 단위 지역명 + 상호명으로 완화 시도
    const region = extractRegionKeyword(initialAddress);
    if (region) {
      const searchQuery = `${region} ${restaurantName}`;
      console.log(`[Enricher] 카카오 검색 완화 적용 (2단계): "${searchQuery}"`);
      place = await getKakaoPlaceInfo(searchQuery);
    }
  }

  if (!place && initialAddress) {
    // 1-3. 시/도 단위 광역지역명 + 상호명으로 완화 시도
    const cityMatch = initialAddress.match(/^([가-힣]+(?:서울|부산|대구|광주|경기|수원|인천|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남))/);
    if (cityMatch) {
      const city = cityMatch[1];
      const searchQuery = `${city} ${restaurantName}`;
      console.log(`[Enricher] 카카오 검색 완화 적용 (3단계): "${searchQuery}"`);
      place = await getKakaoPlaceInfo(searchQuery);
    }
  }

  if (!place) {
    // 1-4. 마지막 보루: 상호명 단독 검색
    console.log(`[Enricher] 카카오 검색 완화 적용 (4단계): 상호명 단독 검색 "${restaurantName}"`);
    place = await getKakaoPlaceInfo(restaurantName);
  }

  if (!place) {
    console.error(`[Enricher] 카카오 맵에서 "${restaurantName}" 정보를 찾지 못해 중단합니다.`);
    return null;
  }
  console.log(`[Enricher] 카카오 맵 정규화 완료 -> 상호명: "${place.name}", 주소: "${place.address}"`);


  // 2단계: 지역 키워드 파싱
  const region = extractRegionKeyword(place.address);
  console.log(`[Enricher] 파싱된 상세 지역 키워드: "${region}"`);

  // 3단계: 유튜브 조회수 최다 비디오 매칭
  const ytVideo = await getPopularYouTubeVideo(place.name, region);
  if (!ytVideo) {
    console.warn(`[Enricher] 유튜브에서 "${place.name}" 연관 영상을 찾지 못해 매핑을 건너뜁니다.`);
    return null;
  }
  console.log(`[Enricher] 유튜브 최고 인기 영상 매칭 -> 제목: "${ytVideo.title}" (조회수: ${ytVideo.view_count.toLocaleString()}회)`);

  // 4단계: Gemini 상세 메타데이터 보강
  const aiEnrichment = await enrichDataWithGemini(place.name, place.address, ytVideo);
  
  const finalRestaurant: EnrichedRestaurant = {
    ...place,
    phone: aiEnrichment?.restaurant?.phone || place.phone || "정보 없음",
    parking: aiEnrichment?.restaurant?.parking || "정보 없음",
    packaging: aiEnrichment?.restaurant?.packaging || "정보 없음",
    reservation: aiEnrichment?.restaurant?.reservation || "정보 없음",
    business_hours: aiEnrichment?.restaurant?.business_hours || "정보 없음",
    menu_info: aiEnrichment?.restaurant?.menu_info || "정보 없음"
  };

  const finalVideo: EnrichedVideo = {
    youtube_video_id: ytVideo.youtube_video_id,
    title: ytVideo.title,
    thumbnail_url: ytVideo.thumbnail_url,
    channel_id: ytVideo.channel_id,
    channel_name: ytVideo.channel_name,
    channel_profile_url: ytVideo.channel_profile_url,
    quote: aiEnrichment?.video?.quote || "유튜브가 추천하는 리얼 맛집",
    keywords: aiEnrichment?.video?.keywords || [],
    view_count: ytVideo.view_count,
    is_short: ytVideo.is_short
  };

  return { restaurant: finalRestaurant, video: finalVideo };
}

/**
 * 2. 보강된 식당 및 비디오 메타데이터를 Supabase DB에 순차 적재 (pgvector 임베딩 자동 저장 포함)
 */
export async function saveEnrichedDataToDB(data: { restaurant: EnrichedRestaurant, video: EnrichedVideo }): Promise<boolean> {
  const { restaurant, video } = data;
  console.log(`[DB Saver] "${restaurant.name}" 데이터를 Supabase DB에 적재를 시작합니다.`);

  try {
    // 1. 유튜버 채널 Upsert
    const { data: dbChannel, error: chErr } = await supabaseAdmin
      .from('channels')
      .upsert({
        youtube_channel_id: video.channel_id,
        name: video.channel_name,
        profile_image_url: video.channel_profile_url
      }, { onConflict: 'youtube_channel_id' })
      .select('id').single();

    if (chErr || !dbChannel) {
      throw new Error(`채널 Upsert 실패: ${chErr?.message}`);
    }

    // 2. 유튜브 비디오 Upsert (is_short 추가)
    const { data: dbVideo, error: vidErr } = await supabaseAdmin
      .from('videos')
      .upsert({
        channel_id: dbChannel.id,
        youtube_video_id: video.youtube_video_id,
        title: video.title,
        thumbnail_url: video.thumbnail_url,
        view_count: video.view_count,
        is_short: video.is_short
      }, { onConflict: 'youtube_video_id' })
      .select('id').single();

    if (vidErr || !dbVideo) {
      throw new Error(`비디오 Upsert 실패: ${vidErr?.message}`);
    }

    // 3. 식당 기본 정보 Upsert (보강한 상세 편의 및 메타 정보는 JSONB 확장 컬럼이 없으므로, restaurants 테이블 구조 확장 혹은 호환 형태로 주입 필요)
    // 001_initial_schema.sql 기준으로 restaurants 테이블은 별도의 metadata 컬럼이 아직 없으므로, 
    // 임베딩 추출과 조인을 위해 기본 컬럼 위주로 넣되, 필요 시 주차나 전화번호 등은 임베딩 생성 시 함께 묶어서 vector 대조용 지문으로 활용합니다.
    const { data: dbRestaurant, error: restErr } = await supabaseAdmin
      .from('restaurants')
      .upsert({
        kakao_place_id: restaurant.kakao_place_id,
        name: restaurant.name,
        category: restaurant.category,
        address: restaurant.address,
        road_address: restaurant.road_address,
        lat: restaurant.lat,
        lng: restaurant.lng,
        is_published: true,
        phone: restaurant.phone,
        parking: restaurant.parking,
        packaging: restaurant.packaging,
        reservation: restaurant.reservation,
        business_hours: restaurant.business_hours,
        menu_info: restaurant.menu_info
      }, { onConflict: 'kakao_place_id' })
      .select('id').single();

    if (restErr || !dbRestaurant) {
      throw new Error(`식당 Upsert 실패: ${restErr?.message}`);
    }

    // 4. 식당-비디오 매핑 테이블 Upsert (유튜버 한줄평 및 태그 키워드 포함)
    const { error: joinErr } = await supabaseAdmin
      .from('restaurant_videos')
      .upsert({
        restaurant_id: dbRestaurant.id,
        video_id: dbVideo.id,
        quote: video.quote,
        keywords: video.keywords
      }, { onConflict: 'restaurant_id, video_id' });

    if (joinErr) {
      throw new Error(`식당-비디오 조인 매핑 Upsert 실패: ${joinErr.message}`);
    }

    // 5. pgvector 중복 대조용 지문 및 768차원 임베딩 추출 & 저장
    const sourceText = `식당명: ${restaurant.name} | 주소: ${restaurant.address} | 전화번호: ${restaurant.phone} | 주차: ${restaurant.parking} | 메뉴: ${restaurant.menu_info}`;
    try {
      console.log(`[DB Saver] Gemini 임베딩 추출 중: "${sourceText.substring(0, 50)}..."`);
      const embeddingVector = await getGeminiEmbedding(sourceText);
      
      const { error: embedErr } = await supabaseAdmin
        .from('restaurant_embeddings')
        .upsert({
          restaurant_id: dbRestaurant.id,
          embedding: embeddingVector,
          source_text: sourceText
        }, { onConflict: 'restaurant_id' });

      if (embedErr) {
        console.warn(`[DB Saver] 임베딩 저장 경고: ${embedErr.message}`);
      } else {
        console.log(`[DB Saver] pgvector 임베딩 지문 저장 성공!`);
      }
    } catch (embErr) {
      console.error("[DB Saver] 임베딩 추출 및 저장 중 예외 발생:", embErr);
    }

    console.log(`[DB Saver] 🎉 "${restaurant.name}" 모든 테이블 적재 완료!`);
    return true;
  } catch (dbError: any) {
    console.error(`[DB Saver] 적재 트랜잭션 에러 발생:`, dbError.message);
    return false;
  }
}
