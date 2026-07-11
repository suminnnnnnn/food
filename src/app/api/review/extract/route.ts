import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { youtubeUrl, skipAi } = await req.json();

    if (!youtubeUrl) {
      return NextResponse.json({ error: 'Missing youtubeUrl' }, { status: 400 });
    }

    // 유튜브 URL에서 Video ID 추출
    const videoIdMatch = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      return NextResponse.json({ error: '올바르지 않은 유튜브 링크 포맷입니다.' }, { status: 400 });
    }

    let videoTitle = "Unknown";
    let authorName = "Unknown";
    let videoDescription = "";
    let ytThumbnailUrl = "";

    // 1. YouTube Data API v3로 수집 시도
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          if (ytData.items && ytData.items.length > 0) {
            const snippet = ytData.items[0].snippet;
            videoTitle = snippet.title || videoTitle;
            authorName = snippet.channelTitle || authorName;
            videoDescription = snippet.description ? snippet.description.substring(0, 1000) : "";
            ytThumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || "";
          }
        }
      } catch (e) {
        console.warn("[Extract Video API] YouTube Data API fetch failed, falling back to oEmbed", e);
      }
    }

    // 2. oEmbed Fallback (API Key가 없거나 실패한 경우)
    if (videoTitle === "Unknown" || authorName === "Unknown") {
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          videoTitle = oembedData.title || videoTitle;
          authorName = oembedData.author_name || authorName;
          ytThumbnailUrl = oembedData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        } else {
          ytThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      } catch (oembedErr) {
        console.warn("[Extract Video API] oEmbed fallback failed", oembedErr);
        ytThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    // 3. Gemini 2.5 Flash를 이용한 맛집 상호명 및 위치 자동 추출
    let extractedName = "";
    let extractedAddress = "";

    if (!skipAi && process.env.GEMINI_API_KEY) {
      const prompt = `당신은 유튜브 맛집 영상의 메타데이터와 Google 웹 검색을 결합해, 실제로 존재하는 식당의 '공식 상호명'과 '위치'를 알아내는 분석 AI입니다.

[유튜브 비디오 메타데이터]
- 채널명: ${authorName}
- 비디오 제목: ${videoTitle}
- 비디오 설명: ${videoDescription}

[매우 중요한 규칙]
1. 영상 제목은 홍보용 문구·비유일 수 있습니다. 제목의 표현을 그대로 상호명으로 쓰지 마세요.
   (예: "임짱의 짜글이가 심학산에서 태어났습니다" → 상호명이 "임짱의 짜글이"가 아님)
2. 상호명이 제목/설명에 명확히 없으면, 반드시 Google 검색을 사용해 채널명(셰프·유튜버 실명 포함)·핵심 메뉴·지역 단서를 조합해 실제 영업 중인 식당의 정식 상호명을 찾으세요.
   (예: "임성근 임짱 짜글이 심학산 식당" 같은 쿼리로 검색)
3. 한 건물에 여러 매장(층별 매장 등)이 있는 복합 매장이면, 건물/브랜드 통합명이 아니라 **이 영상이 주로 소개하는 핵심 메뉴에 해당하는 개별 매장의 상호명**을 반환하세요.
   (예: 영상 주제가 '짜글이'이고 건물에 짜글이집·갈비집·카페가 있으면 → 짜글이 매장의 상호명)
4. 카카오맵/네이버지도에 실제로 등록되어 있을 법한 정식 상호명을 반환하세요(지점/본점 표기 포함). 지역/주소가 파악되면 approximate_address에 담으세요.
5. 유튜버가 여러 식당을 언급하면, 방문하여 실제로 먹고 소개하는 **핵심 메인 식당 1곳**만 고르세요.
6. 검색으로도 확신이 안 서면 restaurant_name을 비워두세요. 추측으로 제목 문구를 넣지 마세요.

반드시 아래 JSON 형식으로만 응답하며, 마크다운 백틱(\`\`\`json ... \`\`\`)을 포함해서 출력하세요.
\`\`\`json
{
  "restaurant_name": "정식 상호명 (예: 부뚜막 짜글이)",
  "approximate_address": "구체적 행정구역 또는 도로명 주소 (예: 경기 파주시 돌곶이길 163)"
}
\`\`\`
`;

      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }], // 구글 검색 도구를 활용하여 비디오 제목에 기재된 상호명의 주소를 웹 검색으로 자동 매칭
            generationConfig: {
              temperature: 0.0
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates[0].content.parts[0].text;
          const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
          const jsonStr = jsonMatch ? jsonMatch[1] : rawText;
          const result = JSON.parse(jsonStr.trim());

          extractedName = result.restaurant_name || "";
          extractedAddress = result.approximate_address || "";
        }
      } catch (geminiErr) {
        console.error("[Extract Video API] Gemini AI Call failed:", geminiErr);
      }
    }

    return NextResponse.json({
      success: true,
      videoTitle,
      authorName,
      thumbnailUrl: ytThumbnailUrl,
      extracted: {
        name: extractedName,
        address: extractedAddress
      }
    });

  } catch (error: any) {
    console.error("[Extract Video API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
