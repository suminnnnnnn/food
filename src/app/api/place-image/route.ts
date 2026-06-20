import { NextResponse } from 'next/server';

// 이미지 해상도 및 비율 필터링 함수
function isValidImage(widthStr: string | number, heightStr: string | number): boolean {
  const width = Number(widthStr);
  const height = Number(heightStr);
  
  if (!width || !height) return true; // 정보가 없으면 일단 통과
  if (width < 300 || height < 300) return false; // 저해상도 픽셀 거름
  
  const ratio = width / height;
  // 완벽한 1:1 비율(로고, 아이콘 의심) 거름
  if (ratio > 0.95 && ratio < 1.05) return false; 
  // 지나치게 가로로 길거나(배너) 세로로 긴 이미지 거름
  if (ratio < 0.6 || ratio > 1.8) return false;
  
  return true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, address = '', query } = body;

    if (!name && !query) {
      return NextResponse.json({ error: 'name or query is required' }, { status: 400 });
    }

    const naverClientId = process.env.NAVER_CLIENT_ID;
    const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
    const kakaoApiKey = process.env.KAKAO_REST_API_KEY || process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

    let queries: string[] = [];

    if (name) {
      const addressParts = address.split(' ');
      const dong = addressParts.find((part: string) => part.endsWith('동') || part.endsWith('읍') || part.endsWith('면'));
      const region = dong || addressParts.slice(0, 2).join(' ');

      // 검색어 고도화 (간판/외관 대신 실제 유저들이 블로그에 쓰는 키워드 조합)
      queries = [
        `${region} ${name} 맛집`,
        `${region} ${name} 식당`,
        `${name} 메뉴`,
        `${name}`
      ];
    } else if (query) {
      queries = [query];
    }

    // 1. 네이버 이미지 검색 API (우선)
    if (naverClientId && naverClientSecret) {
      for (const q of queries) {
        try {
          const res = await fetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(q)}&display=5&sort=sim`, {
            headers: {
              'X-Naver-Client-Id': naverClientId,
              'X-Naver-Client-Secret': naverClientSecret
            }
          });
          
          if (!res.ok) continue;

          const data = await res.json();
          if (data.items && data.items.length > 0) {
            // 필터링 거치기
            const validItem = data.items.find((item: any) => isValidImage(item.sizewidth, item.sizeheight));
            
            if (validItem) {
              return NextResponse.json({ 
                imageUrl: validItem.thumbnail || validItem.link,
                sourceQuery: q,
                source: 'naver'
              });
            }
          }
        } catch (err) {
          console.warn('Naver Image API Error:', err);
        }
      }
    }

    // 2. 카카오 이미지 검색 API (네이버 실패 시 Fallback)
    if (kakaoApiKey) {
      for (const q of queries) {
        try {
          const res = await fetch(`https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(q)}&size=5`, {
            headers: { 'Authorization': `KakaoAK ${kakaoApiKey}` }
          });
          
          if (!res.ok) continue;

          const data = await res.json();
          if (data.documents && data.documents.length > 0) {
            // 카카오 데이터 필터링
            const validDoc = data.documents.find((doc: any) => isValidImage(doc.width, doc.height));
            
            if (validDoc) {
              return NextResponse.json({ 
                imageUrl: validDoc.thumbnail_url || validDoc.image_url,
                sourceQuery: q,
                source: 'kakao'
              });
            }
          }
        } catch (err) {
          console.warn('Kakao Image API Error:', err);
        }
      }
    }

    // 모두 실패한 경우
    return NextResponse.json({ imageUrl: null });
  } catch (error) {
    console.error('Failed to fetch place image:', error);
    return NextResponse.json({ imageUrl: null });
  }
}
