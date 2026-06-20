import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

function extractVideoId(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|v\/|watch\?v=|watch\?.+&v=))([^&?]{11})/);
  return match ? match[1] : null;
}

export async function POST(req: Request) {
  try {
    const { restaurantId, restaurantName, youtubeUrl } = await req.json();

    if (!restaurantId || !restaurantName || !youtubeUrl) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json({ error: '유효한 유튜브 링크가 아닙니다.' }, { status: 400 });
    }

    // 1. YouTube Data API로 영상 정보 조회
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );
    const ytData = await ytRes.json();

    if (!ytData.items || ytData.items.length === 0) {
      return NextResponse.json({ error: '영상을 찾을 수 없거나 비공개 영상입니다.' }, { status: 404 });
    }

    const videoItem = ytData.items[0];
    const snippet = videoItem.snippet;
    const title = snippet.title;
    const description = snippet.description;
    const channelId = snippet.channelId;
    const channelTitle = snippet.channelTitle;
    const publishedAt = snippet.publishedAt;
    const viewCount = videoItem.statistics?.viewCount || 0;
    
    // ISO 8601 duration 파싱 로직 간단 구현 (PT1M30S 등)
    const durationIso = videoItem.contentDetails?.duration || 'PT0S';
    let durationSeconds = 0;
    const durationMatch = durationIso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1] || '0');
      const minutes = parseInt(durationMatch[2] || '0');
      const seconds = parseInt(durationMatch[3] || '0');
      durationSeconds = hours * 3600 + minutes * 60 + seconds;
    }
    const isShort = durationSeconds <= 60; // 60초 이하면 쇼츠로 간주

    // 2. Gemini API로 식당 리뷰 영상인지 검수
    const prompt = `
너는 맛집 추천 서비스의 영상 검수 AI야.
사용자가 [${restaurantName}] 식당의 리뷰라고 유튜브 영상을 하나 제보했어.

영상 제목: ${title}
채널명: ${channelTitle}
설명(일부): ${description.substring(0, 300)}

이 영상이 [${restaurantName}] 식당과 관련된 먹방, 방문기, 리뷰, 소개 영상이 맞는지 판단해줘. 
완전히 다른 내용(예: 뮤직비디오, 게임, 전혀 다른 식당만 나오는 영상)이면 false를 반환해.
반드시 아래의 JSON 포맷으로만 응답해:
{
  "is_valid": true 혹은 false,
  "reason": "검수 사유 (짧게 1~2문장)"
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API Error:', errText);
      if (geminiRes.status === 429) {
        return NextResponse.json({ error: 'AI 검수 서버 API 크레딧(사용량)이 초과되었습니다. API 키의 결제 상태를 확인해주세요.' }, { status: 429 });
      }
      return NextResponse.json({ error: 'AI 검수 서버 오류가 발생했습니다.' }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    // 마크다운 코드 블록 제거 후 파싱
    const cleanedText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    let aiResult;
    try {
      aiResult = JSON.parse(cleanedText);
    } catch (e) {
      console.error('JSON Parse Error:', cleanedText);
      return NextResponse.json({ error: 'AI 응답 파싱 실패.' }, { status: 500 });
    }

    if (!aiResult.is_valid) {
      return NextResponse.json({ error: `[AI 검수 반려] ${aiResult.reason}` }, { status: 400 });
    }

    // 3. 채널 썸네일 조회 (선택적)
    let profileImageUrl = null;
    try {
      const isHandle = channelId.startsWith('@');
      const paramName = isHandle ? 'forHandle' : 'id';
      const channelRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&${paramName}=${encodeURIComponent(channelId)}&key=${YOUTUBE_API_KEY}`
      );
      const channelData = await channelRes.json();
      const snippets = channelData.items?.[0]?.snippet;
      profileImageUrl = snippets?.thumbnails?.high?.url || snippets?.thumbnails?.medium?.url || snippets?.thumbnails?.default?.url || null;
    } catch (e) {
      console.warn('채널 썸네일 조회 실패', e);
    }

    // 유튜브 프로필 이미지 엑박 방지용 영구 이니셜 아바타 폴백 세팅
    if (!profileImageUrl && channelTitle) {
      profileImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(channelTitle)}&background=ff5e00&color=fff&bold=true&size=128&rounded=true`;
    }

    // 4. DB 적재 로직
    // 4-1. Channels UPSERT
    const { data: chDataDb, error: channelErr } = await supabase
      .from('channels')
      .upsert({
        youtube_channel_id: channelId,
        name: channelTitle,
        profile_image_url: profileImageUrl
      }, { onConflict: 'youtube_channel_id' })
      .select('id')
      .single();

    if (channelErr) throw channelErr;
    const dbChannelId = chDataDb.id;

    // 4-2. Videos UPSERT
    let dbVideoId;
    const { data: existingVideo } = await supabase
      .from('videos')
      .select('id')
      .eq('youtube_video_id', videoId)
      .single();

    if (existingVideo) {
      dbVideoId = existingVideo.id;
    } else {
      const { data: newVideo, error: videoErr } = await supabase
        .from('videos')
        .insert({
          channel_id: dbChannelId,
          youtube_video_id: videoId,
          title: title,
          thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
          is_short: isShort,
          view_count: viewCount,
          published_at: publishedAt
        })
        .select('id')
        .single();

      if (videoErr) throw videoErr;
      dbVideoId = newVideo.id;
    }

    // 4-3. restaurant_videos 매핑 (Upsert)
    const { error: mappingErr } = await supabase
      .from('restaurant_videos')
      .upsert({
        restaurant_id: restaurantId,
        video_id: dbVideoId
      }, { onConflict: 'restaurant_id, video_id' });

    if (mappingErr) throw mappingErr;

    return NextResponse.json({ success: true, message: '영상이 성공적으로 등록되었습니다!' });
  } catch (error: any) {
    console.error('Video Submit Error:', error);
    return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
