import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { youtubeUrl } = await req.json();

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

    if (process.env.GEMINI_API_KEY) {
      const prompt = `
당신은 유튜브 리뷰 영상을 분석하여 소개된 맛집의 정확한 '상호명'과 '지점/지역(주소)'을 찾아내는 핫플 분석 AI입니다.
다음 유튜브 비디오 메타데이터를 확인하고, 영상에서 리뷰 중인 식당의 정보를 상세히 분석하여 상호명과 대략적인 지점/주소 정보를 추론해 주세요.

[유튜브 비디오 메타데이터]
- 채널명: ${authorName}
- 비디오 제목: ${videoTitle}
- 비디오 설명: ${videoDescription}

[추출 규칙]
1. 유튜버가 이 영상에서 방문하여 식사하고 소개하는 **가장 핵심이 되는 메인 식당 1곳**만 타겟팅하세요.
2. 비디오 제목이나 설명에 기재된 상호명을 식별하세요 (예: '을지로 원조녹두', '오근내 닭갈비').
3. 지점이나 주소(예: '을지로점', '용산구', '부산 서면')가 파악된다면 approximate_address에 포함하세요.
4. 설명란이나 제목에 식당 이름이 숨겨져 있을 수 있으니 철저하게 유추해 주십시오. (예: "여기는 연남동에 위치한 연남토마입니다" -> 상호명: 연남토마, 주소: 연남동)
5. 만약 정보가 극도로 부족하여 상호명을 도출할 수 없다면, restaurant_name을 비워두세요.

반드시 아래 JSON 형식으로만 응답해야 하며, 마크다운 백틱(\`\`\`json ... \`\`\`)을 포함해서 출력하세요.
\`\`\`json
{
  "restaurant_name": "식당 상호명 (예: 중앙해장)",
  "approximate_address": "식당이 있는 구체적 행정구역 또는 도로명 주소 (예: 서울 강남구 삼성동 또는 을지로입구역 부근)"
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
