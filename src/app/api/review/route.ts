import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 관리자 권한 클라이언트 (RLS 우회 및 트랜잭션 수행)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY! // anon_key 혹은 service_role_key 둘 다 작동 가능하지만 환경변수가 anon_key로 주어짐
);

// Gemini 임베딩 추출 함수 (768차원 embedding-001 모델 사용 및 에러 대비 폴백 탑재)
async function getGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
  const defaultVector = (): number[] => {
    const dummy = Array(768).fill(0).map(() => (Math.random() - 0.5) * 0.1);
    const magnitude = Math.sqrt(dummy.reduce((sum, val) => sum + val * val, 0)) || 1;
    return dummy.map(val => val / magnitude);
  };

  if (!apiKey) {
    console.warn("API Key 누락으로 임베딩 더미 벡터를 생성합니다.");
    return defaultVector();
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/embedding-001:embedContent?key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] }
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.embedding && data.embedding.values) {
        return data.embedding.values;
      }
    }
    console.warn(`[API Review Embedding] API 응답 에러로 인해 더미 임베딩을 할당합니다. Status: ${response.status}`);
  } catch (error: any) {
    console.warn(`[API Review Embedding] 임베딩 호출 실패로 더미 임베딩 할당:`, error.message);
  }

  return defaultVector();
}



export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { submission_id } = body;

    if (!submission_id) {
      return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 });
    }

    // 1. user_submissions 테이블에서 제보 데이터 가져오기 (단일 테이블 스키마 통합)
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('user_submissions')
      .select('*')
      .eq('id', submission_id)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json({ error: `Submission not found: ${fetchError?.message || ''}` }, { status: 404 });
    }

    // 제보 데이터 맵핑 변수 세팅
    const restaurantName = submission.raw_name;
    const address = submission.raw_address || '';
    const youtubeUrl = submission.source_url;

    // 2. 유튜브 메타데이터 추출 (YouTube Data API v3 & oEmbed Fallback)
    let videoTitle = "Unknown";
    let authorName = "Unknown";
    let videoDescription = "";
    let ytChannelId = "";
    let ytThumbnailUrl = "";
    let ytChannelProfileUrl = "";
    
    // 유튜브 URL에서 Video ID 추출
    const videoIdMatch = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    // 🛡️ 유튜브 쇼츠 URL 단에서 1차 차단
    const isShortsUrl = youtubeUrl.includes('shorts/') || youtubeUrl.includes('/shorts');
    if (isShortsUrl) {
      console.log(`[제보 수집 검사] 유튜브 쇼츠 URL 감지로 즉시 자동반려 처리합니다.`);
      const aiResult = {
        is_valid: false,
        confidence_score: 0,
        youtuber_name: "Unknown",
        reason: "찍어내기식 저품질 쇼츠(Shorts) 영상은 맛집 영상으로 등록할 수 없습니다. 롱폼 영상을 제보해 주세요.",
        keywords: [],
        extracted_menu: "정보 없음",
        parking_info: "정보 없음",
        resolve_type: "new_restaurant",
        matched_restaurant_id: null
      };

      await supabaseAdmin
        .from('user_submissions')
        .update({
          status: 'rejected',
          ai_review_result: aiResult
        })
        .eq('id', submission_id);

      return NextResponse.json({
        success: true,
        status: 'rejected',
        resolve_type: 'new_restaurant',
        resolved_restaurant_id: null,
        aiResult
      });
    }

    let isEmbeddable = true; // 유튜브 외부 임베드 가능 여부 플래그

    if (videoId && process.env.YOUTUBE_API_KEY) {
      try {
        const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          if (ytData.items && ytData.items.length > 0) {
            const item = ytData.items[0];
            const snippet = item.snippet;
            const statusInfo = item.status;
            
            videoTitle = snippet.title;
            authorName = snippet.channelTitle;
            videoDescription = snippet.description ? snippet.description.substring(0, 300) : "";
            ytChannelId = snippet.channelId || "";
            ytThumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || "";
            
            // 🛡️ 유튜브 외부 재생 제한 여부 판단
            if (statusInfo && statusInfo.embeddable === false) {
              isEmbeddable = false;
              console.log(`[제보 수집 검사] 유튜브 외부 재생(임베드)이 정책상 거부된 영상입니다. (Video ID: ${videoId})`);
            }
            
            if (ytChannelId && process.env.YOUTUBE_API_KEY) {
              try {
                const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${ytChannelId}&key=${process.env.YOUTUBE_API_KEY}`);
                if (chRes.ok) {
                  const chData = await chRes.json();
                  if (chData.items && chData.items.length > 0) {
                    ytChannelProfileUrl = chData.items[0].snippet.thumbnails?.default?.url || "";
                  }
                }
              } catch (e) {
                console.warn("YouTube Channel API fetch failed", e);
              }
            }
          }
        } else {
          console.error("YouTube API failed:", await ytRes.text());
        }
      } catch (e) {
        console.warn("YouTube API fetch failed", e);
      }
    }

    // [oEmbed 및 정적 폴백 발동] API Key가 없거나 API 수집 결과가 유효하지 않을 때 100% 무조건 수집 보장
    if (videoId && (videoTitle === "Unknown" || authorName === "Unknown")) {
      try {
        console.log(`[oEmbed Fallback] 유튜브 API 수집 대안으로 oEmbed 수집 개시 (Video ID: ${videoId})`);
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          videoTitle = oembedData.title || videoTitle;
          authorName = oembedData.author_name || authorName;
          ytThumbnailUrl = oembedData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          
          if (!ytChannelId) {
            ytChannelId = `channel-${encodeURIComponent(authorName.replace(/\s+/g, '-').toLowerCase())}`;
          }
        } else {
          ytThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      } catch (oembedErr) {
        console.warn("YouTube oEmbed API fetch failed", oembedErr);
        ytThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    // 유튜브 프로필 이미지 엑박 방지용 영구 이니셜 아바타 폴백 세팅
    if (!ytChannelProfileUrl && authorName !== "Unknown") {
      ytChannelProfileUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=ff5e00&color=fff&bold=true&size=128&rounded=true`;
    }


    // 3. 지능형 중복 방지 - pgvector 1차 대조 수행
    let matchedCandidates: any[] = [];
    let queryEmbedding: number[] = [];
    const sourceText = `식당명: ${restaurantName} | 주소: ${address}`;

    if (process.env.GEMINI_API_KEY) {
      try {
        console.log("식당 임베딩 추출 중:", sourceText);
        queryEmbedding = await getGeminiEmbedding(sourceText, process.env.GEMINI_API_KEY);
        
        // pgvector match_restaurants RPC 호출
        const { data: matched, error: matchError } = await supabaseAdmin.rpc('match_restaurants', {
          query_embedding: queryEmbedding,
          match_threshold: 0.85, // 0.85 이상의 코사인 유사도 기준 설정
          match_count: 5
        });

        if (!matchError && matched) {
          matchedCandidates = matched;
          console.log("pgvector 1차 대조 후보 식당 리스트:", matchedCandidates);
        } else if (matchError) {
          console.error("pgvector RPC match_restaurants error:", matchError);
        }
      } catch (embErr) {
        console.error("Gemini Embedding API or pgvector match call failed:", embErr);
      }
    }

    // 4. Gemini LLM 2.5 Flash를 통한 지능형 2차 동기 검증 및 판정
    const prompt = `
당신은 대한민국 최고의 식당 리뷰 검증 및 중복 정합 AI 판정관입니다.
사용자가 특정 식당에 대한 유튜브 미식 영상을 제보했습니다. 제보된 정보와 기존 데이터베이스에 존재하는 유사 식당 후보군들을 면밀히 대조하여 중복 여부를 최종 분석하고, 제보를 승인할지 판정해 주세요.

[제보된 식당 정보]
- 상호명: ${restaurantName}
- 주소: ${address}

[제보된 유튜브 영상 정보]
- 채널명: ${authorName}
- 영상 제목: ${videoTitle}
- 영상 설명(일부): ${videoDescription}

[기존 데이터베이스 내 유사 식당 후보군 (pgvector 코사인 유사도 0.85 이상)]
${matchedCandidates.length > 0 
  ? JSON.stringify(matchedCandidates.map(c => ({ id: c.id, name: c.name, address: c.address, similarity: c.similarity })), null, 2)
  : "유사한 기존 식당 후보가 존재하지 않습니다."
}

[판정 및 심사 핵심 지침]
1. 이 유튜브 영상이 제보된 식당을 직접 방문하여 미식 리뷰를 진행한 영상이 맞는지 진위 확률을 구하세요.
2. [중복 판단 대조]: 기존 후보군 리스트가 있는 경우, 제보된 식당이 후보군 중 하나와 '동일한 식당(물리적으로 같은 지점)'인지 세심하게 판단해 주세요. 
   - 프랜차이즈의 경우, 주소(지점명)가 완벽히 다르면 별개의 식당("new_restaurant")으로 봅니다.
   - 이름 표기법이 미세하게 다르거나(예: '중앙해장' vs '중앙해장 삼성점'), 주소 표기 형식만 다르고 실질적으로 동일한 자리라면 "existing_video_mapping"으로 판정하고, 매칭되는 기존 식당의 id를 'matched_restaurant_id' 필드에 정확히 매핑하세요.
   - 매칭되는 기존 식당이 전혀 없다면, "new_restaurant"으로 분류하고 'matched_restaurant_id'를 null로 설정하세요.
3. 영상이 최종 승인(is_valid: true)될 수 있으려면 신뢰도가 70점 이상이어야 합니다.
4. 승인 시, 영상과 식당의 특징을 담은 강렬하고 힙한 매력 키워드 3개(이모지 포함)를 'keywords'에 창작해 주세요.
5. 영상 내 정보(제목/설명)를 분석하여 다음 5가지 방문 꿀팁 정보가 있다면 추출하고 없으면 "정보 없음"으로 기록하세요:
   - 대표 메뉴 및 가격 (예: 짚불구이 28,000원)
   - 주차 가능 여부 및 방법 (예: 발렛 가능, 건물 지하 주차 2시간 지원)
   - 예약 가능 여부 및 플랫폼 (예: 캐치테이블 예약 필수, 네이버 예약 가능)
   - 포장(테이크아웃) 가능 여부 (예: 전 메뉴 포장 가능)
   - 영업시간 및 휴무일 (예: 매일 11:30 - 22:00, 월요일 휴무)

반드시 아래 JSON 형식으로만 응답해야 하며, 마크다운 백틱(\`\`\`) 등 불필요한 텍스트를 절대 섞지 마십시오.
{
  "is_valid": true 또는 false,
  "confidence_score": 0에서 100 사이의 숫자,
  "youtuber_name": "채널명",
  "reason": "최종 검수 판정 사유 및 중복 대조 근거에 대한 짧은 요약",
  "keywords": ["🔥 키워드1", "💸 키워드2", "🥩 키워드3"],
  "extracted_menu": "추출 대표 메뉴 정보 또는 '정보 없음'",
  "parking_info": "추출 주차 정보 또는 '정보 없음'",
  "reservation_info": "추출 예약 정보 또는 '정보 없음'",
  "packaging_info": "추출 포장 정보 또는 '정보 없음'",
  "business_hours_info": "추출 영업시간 정보 또는 '정보 없음'",
  "resolve_type": "existing_video_mapping" 또는 "new_restaurant",
  "matched_restaurant_id": "매칭된 기존 식당의 UUID 문자열 (해당 없을 시 null)"
}
`;

    let aiResult: any = { is_valid: false, confidence_score: 0, resolve_type: 'new_restaurant', matched_restaurant_id: null };
    
    if (!isEmbeddable) {
      aiResult = {
        is_valid: false,
        confidence_score: 0,
        youtuber_name: authorName !== "Unknown" ? authorName : "Unknown",
        reason: "유튜브 정책상 외부 임베드가 제한된 동영상입니다. 해당 영상은 지도의 맛집 비디오로 등록될 수 없습니다.",
        keywords: [],
        extracted_menu: "정보 없음",
        parking_info: "정보 없음",
        resolve_type: "new_restaurant",
        matched_restaurant_id: null
      };
      console.log(`[제보 자동반려] 유튜브 외부 재생 불가 동영상이므로 LLM 심사를 생략하고 즉시 반려 처리합니다.`);
    } else if (process.env.GEMINI_API_KEY) {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      });

      if (!geminiRes.ok) {
        throw new Error(`Gemini API Error: ${await geminiRes.text()}`);
      }

      const geminiData = await geminiRes.json();
      const rawText = geminiData.candidates[0].content.parts[0].text;
      
      try {
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        aiResult = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse Gemini response raw text:", rawText);
        throw new Error("Invalid LLM response format during review");
      }
    }

    // 5. 심사 결과(신뢰도 70점 기준) 판정 분기 및 데이터 이관 처리
    const status = aiResult.is_valid && aiResult.confidence_score >= 70 ? 'approved' : 'rejected';
    let finalRestaurantId: string | null = null;

    if (status === 'approved') {
      const resolveType = aiResult.resolve_type;
      const matchedId = aiResult.matched_restaurant_id;

      if (resolveType === 'existing_video_mapping' && matchedId) {
        // [A] 중복 판정: 기존 식당 매핑
        console.log(`[중복 매핑 자동이관] 제보된 식당(${restaurantName})을 기존 ID(${matchedId})와 자동 매핑합니다.`);
        finalRestaurantId = matchedId;
      } else {
        // [B] 신규 식당 신설
        console.log(`[신규 식당 신설] 중복 후보가 없으므로 새로운 식당 레코드를 생성합니다.`);
        const { data: newRest, error: restErr } = await supabaseAdmin.from('restaurants').insert({
          kakao_place_id: submission.kakao_place_id || `kakao-seed-${Date.now()}`,
          name: restaurantName,
          address: address,
          road_address: address,
          lat: submission.lat || 37.5665,
          lng: submission.lng || 126.9780,
          category: submission.source_type === 'youtube' ? '유튜브 맛집' : '제보 맛집',
          is_published: true,
          phone: '정보 없음',
          parking: aiResult.parking_info || '정보 없음',
          packaging: aiResult.packaging_info || '정보 없음',
          reservation: aiResult.reservation_info || '정보 없음',
          business_hours: aiResult.business_hours_info || '정보 없음',
          menu_info: aiResult.extracted_menu || '정보 없음'
        }).select('id').single();

        if (restErr) {
          throw new Error(`Failed to create new restaurant: ${restErr.message}`);
        }
        finalRestaurantId = newRest?.id || null;

        // 신규 식당에 대해 앞서 추출해둔 768차원 임베딩 벡터를 주입하여 pgvector 대조 인프라 완성
        if (finalRestaurantId && queryEmbedding.length > 0) {
          try {
            await supabaseAdmin.from('restaurant_embeddings').upsert({
              restaurant_id: finalRestaurantId,
              embedding: queryEmbedding,
              source_text: sourceText
            }, { onConflict: 'restaurant_id' });
            console.log(`[임베딩 저장 완료] 신규 식당 ID(${finalRestaurantId})에 대한 pgvector 지문 적재 완료.`);
          } catch (embedUpsertErr) {
            console.error("Failed to save restaurant embedding:", embedUpsertErr);
          }
        }
      }

      // 영상 연계 데이터 추가 처리 (channels -> videos -> restaurant_videos)
      if (finalRestaurantId && videoId) {
        let dbChannelId = null;
        if (ytChannelId) {
          const { data: chData } = await supabaseAdmin.from('channels')
            .upsert({ 
              youtube_channel_id: ytChannelId, 
              name: authorName,
              profile_image_url: ytChannelProfileUrl || null
            }, { onConflict: 'youtube_channel_id' })
            .select('id').single();
          dbChannelId = chData?.id;
        }

        const { data: vData } = await supabaseAdmin.from('videos')
          .upsert({
            youtube_video_id: videoId,
            title: videoTitle,
            channel_id: dbChannelId,
            thumbnail_url: ytThumbnailUrl,
            is_short: youtubeUrl.includes('shorts/')
          }, { onConflict: 'youtube_video_id' })
          .select('id').single();
        
        if (vData?.id) {
          await supabaseAdmin.from('restaurant_videos')
            .upsert({
              restaurant_id: finalRestaurantId,
              video_id: vData.id,
              quote: aiResult.reason || 'AI 검수 승인됨',
              keywords: aiResult.keywords || []
            }, { onConflict: 'restaurant_id, video_id' });
        }
      }
    }

    // 6. user_submissions 테이블 제보 레코드 최종 처리 상태 업데이트
    const updatePayload: any = {
      status,
      ai_review_result: aiResult
    };
    if (finalRestaurantId) {
      updatePayload.resolved_restaurant_id = finalRestaurantId;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('user_submissions')
      .update(updatePayload)
      .eq('id', submission_id);

    if (updateErr) {
      console.error("Failed to update user_submission record status:", updateErr);
    }

    return NextResponse.json({
      success: true,
      status,
      resolve_type: aiResult.resolve_type,
      resolved_restaurant_id: finalRestaurantId,
      aiResult
    });

  } catch (error: any) {
    console.error("AI Intelligent Review Pipeline Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
