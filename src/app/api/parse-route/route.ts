import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ success: false, error: 'URL이 누락되었습니다.' }, { status: 400 });
    }

    // 카카오맵 단축 URL 패턴 검증
    if (!url.includes('kko.to') && !url.includes('kakao.com')) {
      return NextResponse.json({ success: false, error: '유효한 카카오맵 링크가 아닙니다.' }, { status: 400 });
    }

    // 1. 단축 URL 리다이렉트 추적
    // fetch는 기본적으로 redirect: 'follow'가 디폴트이므로 최종 목적지 응답을 획득함
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3'
      }
    });

    const resolvedUrl = response.url;
    
    // 2. 최종 URL 파싱
    // 카카오맵 URL의 다양한 형태 분석:
    // PC버전 예: https://map.kakao.com/?sName=출발&sX=127.0&sY=37.0&eName=도착&eX=127.1&eY=37.1
    // 모바일버전 예: https://m.map.kakao.com/actions/routeView?sx=127.0&sy=37.0&ex=127.1&ey=37.1&sName=출발&eName=도착
    // 혹은 경로 공유 시: https://map.kakao.com/link/to/도착,37.394,127.110/from/출발,37.497,127.027
    const urlObj = new URL(resolvedUrl);
    
    let sName = '';
    let sX = 0;
    let sY = 0;
    let eName = '';
    let eX = 0;
    let eY = 0;
    let transportType = 'transit'; // 기본값 대중교통

    // URL 파라미터에서 추출 시도
    sName = urlObj.searchParams.get('sName') || urlObj.searchParams.get('spName') || '';
    eName = urlObj.searchParams.get('eName') || urlObj.searchParams.get('epName') || '';

    // 좌표 추출
    const sxParam = urlObj.searchParams.get('sX') || urlObj.searchParams.get('sx');
    const syParam = urlObj.searchParams.get('sY') || urlObj.searchParams.get('sy');
    const exParam = urlObj.searchParams.get('eX') || urlObj.searchParams.get('ex');
    const eyParam = urlObj.searchParams.get('eY') || urlObj.searchParams.get('ey');

    if (sxParam) sX = parseFloat(sxParam);
    if (syParam) sY = parseFloat(syParam);
    if (exParam) eX = parseFloat(exParam);
    if (eyParam) eY = parseFloat(eyParam);

    // 경로 링크(/link/to/.../from/...) 형태 파싱
    if (urlObj.pathname.includes('/link/to/')) {
      const parts = urlObj.pathname.split('/');
      // /link/to/도착지,위도,경도/from/출발지,위도,경도 형태
      const toIndex = parts.indexOf('to');
      const fromIndex = parts.indexOf('from');

      if (toIndex !== -1 && toIndex + 1 < parts.length) {
        const toInfo = decodeURIComponent(parts[toIndex + 1]).split(',');
        eName = toInfo[0] || '';
        eY = parseFloat(toInfo[1]) || 0;
        eX = parseFloat(toInfo[2]) || 0;
      }
      if (fromIndex !== -1 && fromIndex + 1 < parts.length) {
        const fromInfo = decodeURIComponent(parts[fromIndex + 1]).split(',');
        sName = fromInfo[0] || '';
        sY = parseFloat(fromInfo[1]) || 0;
        sX = parseFloat(fromInfo[2]) || 0;
      }
    }

    // 3. 소요 시간(duration) 파싱 시도 (HTML 파싱)
    let duration: number | null = null;
    const htmlText = await response.text();

    // HTML 내부에서 시간 텍스트 정규식 검색
    // 카카오맵 모바일에서는 보통 소요시간이 <strong class="time">35분</strong> 또는 <span class="time_spend">35분</span> 등으로 표현될 수 있음.
    // 또한 스크립트 변수 안에 "duration": 2100 (초 단위) 처럼 들어있을 수 있음.
    // 간단한 정규식 매칭을 시도
    const timeMatch = htmlText.match(/class=["'](?:time|time_spend|txt_time)["'][^>]*>(\d+)(?:시간\s*(\d+)?)?분/);
    if (timeMatch) {
      if (timeMatch[2]) {
        duration = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      } else {
        duration = parseInt(timeMatch[1]);
      }
    } else {
      // "duration":2100 또는 "time":35 등의 JSON 패턴 매칭 시도
      const jsonDurationMatch = htmlText.match(/"duration"\s*:\s*(\d+)/);
      if (jsonDurationMatch) {
        // 초 단위를 분 단위로 변환
        duration = Math.ceil(parseInt(jsonDurationMatch[1]) / 60);
      }
    }

    // 교통수단 타입 유추
    if (urlObj.searchParams.get('target') === 'car' || resolvedUrl.includes('target=car')) {
      transportType = 'car';
    } else if (urlObj.searchParams.get('target') === 'walk' || resolvedUrl.includes('target=walk')) {
      transportType = 'walk';
    }

    return NextResponse.json({
      success: true,
      data: {
        origin: { name: sName, x: sX, y: sY },
        destination: { name: eName, x: eX, y: eY },
        duration: duration || null,
        transportType,
        originalUrl: url,
        resolvedUrl
      }
    });

  } catch (error: any) {
    console.error('카카오맵 경로 파싱 에러:', error);
    return NextResponse.json({ success: false, error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
