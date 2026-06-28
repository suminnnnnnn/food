import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const cachePath = path.join(process.cwd(), 'src/lib/trending_cache.json');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get('region') || '마포구';
    const weather = searchParams.get('weather') || 'sunny';
    
    // 한국 시간대 계산 (KST)
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (3600000 * 9));
    const dateStr = kst.toISOString().split('T')[0];
    const hour = kst.getHours();

    // 시간대 판별 (morning / lunch / dinner)
    let timeOfDay = searchParams.get('timeOfDay') || '';
    if (!timeOfDay) {
      if (hour >= 5 && hour < 11) {
        timeOfDay = 'morning';
      } else if (hour >= 11 && hour < 17) {
        timeOfDay = 'lunch';
      } else {
        timeOfDay = 'dinner';
      }
    }

    const cacheKey = `${dateStr}_${region}_${timeOfDay}_${weather}`;
    console.log(`[Curation API] Request - region: ${region}, time: ${timeOfDay}, weather: ${weather}. CacheKey: ${cacheKey}`);

    // 1. 로컬 캐시 조회
    let cacheData: Record<string, any> = {};
    try {
      const fileData = await fs.readFile(cachePath, 'utf8');
      cacheData = JSON.parse(fileData);
    } catch (readErr) {
      console.log(`[Curation API] Cache file not found or empty, starting fresh.`);
    }

    if (cacheData[cacheKey]) {
      console.log(`[Curation API] Cache HIT for key: ${cacheKey}`);
      return NextResponse.json(cacheData[cacheKey]);
    }

    console.log(`[Curation API] Cache MISS for key: ${cacheKey}. Triggering Gemini AI...`);

    // 2. Gemini 2.5 Flash를 활용한 지역/시간대별 실시간 감성 맛집 랭킹 큐레이션 생성
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not defined' }, { status: 500 });
    }

    const prompt = `
당신은 마케팅 및 푸드 트렌드 전문가입니다.
현재 날짜(${dateStr}), 지역(${region}), 시간대(${timeOfDay}), 기상조건(${weather})을 기반으로, 맛에 극도로 진심인 2030 푸디들을 사로잡을 수 있는 세련되고 유치하지 않은 **오늘의 실시간 인기 미식 랭킹 TOP 3**를 선정해 주세요.
지역 내 맛집 데이터가 부족하더라도 해당 지역(예: ${region}이라면 실제 ${region}의 세부 동네명과 매치되는 트렌드)을 연상시키는 매력적인 타이틀과 추천 키워드를 작성해야 합니다.

[시간대 및 기상 조건별 카피라이팅 팁]
- 'morning': 가벼운 브런치, 해장하기 좋은 국밥, 아침 모닝 에스프레소
- 'lunch': 직장인 점식 백반, 가볍고 빠른 덮밥/국수, 커피/디저트
- 'dinner': 퇴근 후 소주 한 잔(삼겹살/곱창), 야장/테라스 야외맥주, 분위기 좋은 이자카야/데이트
- 'rainy': 전골, 파전, 칼국수, 막걸리 감성
- 'hot': 냉면, 메밀소바, 시원한 빙수, 생맥주
- 'cold': 샤브샤브, 전골, 뚝배기 국밥, 구이

[응답 규칙]
1. 반드시 아래 JSON 형식으로만 응답해야 하며, 마크다운 백틱(\`\`\`json ... \`\`\`)을 포함해서 출력하세요.
2. 키워드(value)는 실제 지도의 맛집 데이터와 매칭 및 검색 연동에 사용되는 핵심 검색어(예: '야장', '삼겹살', '칼국수', '냉면', '맥주', '노포', '루프탑', '카페', '국밥', '전골', '구이' 등)여야 합니다.
3. 변동률(change)은 "▲ 158%", "▲ 94%" 같은 형식으로 작성하세요.

JSON 포맷:
\`\`\`json
{
  "vibeKeywords": [
    { "rank": 1, "name": "타이틀 (예: 바람 솔솔 망원동 야장/테라스)", "change": "▲ 142%", "value": "야장" },
    { "rank": 2, "name": "타이틀 (예: 퇴근 후 삼겹살에 소주 한 잔)", "change": "▲ 95%", "value": "삼겹살" },
    { "rank": 3, "name": "타이틀 (예: 뷰맛집 경의선숲길 루프탑)", "change": "▲ 68%", "value": "루프탑" }
  ],
  "weatherKeywords": [
    { "rank": 1, "name": "날씨 맞춤 타이틀", "change": "▲ 158%", "value": "키워드" },
    { "rank": 2, "name": "날씨 맞춤 타이틀", "change": "▲ 110%", "value": "키워드" },
    { "rank": 3, "name": "날씨 맞춤 타이틀", "change": "▲ 85%", "value": "키워드" }
  ]
}
\`\`\`
`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // JSON 응답 추출
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
    const curationResult = JSON.parse(jsonStr.trim());

    // 3. 로컬 캐시 쓰기
    cacheData[cacheKey] = curationResult;
    try {
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
      console.log(`[Curation API] Cache updated successfully for key: ${cacheKey}`);
    } catch (writeErr) {
      console.warn(`[Curation API] Failed to write cache file:`, writeErr);
    }

    return NextResponse.json(curationResult);
  } catch (err: any) {
    console.error(`[Curation API] Error generating curation:`, err);
    return NextResponse.json({ error: err.message || 'Internal Curation Error' }, { status: 500 });
  }
}
