import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { getRestaurantsByIds } from '@/lib/supabase/restaurants';

const DATABASE_URL = process.env.DATABASE_URL;

export async function POST(request: Request) {
  try {
    const { coordinates, radiusKm } = await request.json();
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json({ success: false, error: '유효한 경로 좌표 목록이 필요합니다.' }, { status: 400 });
    }

    const radiusMeters = (radiusKm || 0.5) * 1000;

    // 1. LineString 텍스트 포맷 빌드 (경도 위도 순서)
    const pointsStr = coordinates.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
    const lineStringText = `LINESTRING(${pointsStr})`;

    if (!DATABASE_URL) {
      return NextResponse.json({ success: false, error: 'DATABASE_URL 환경 변수가 누락되었습니다.' }, { status: 500 });
    }

    // 2. postgres 드라이버를 사용해 공간 쿼리 실행
    const sql = postgres(DATABASE_URL, { ssl: 'require' });
    
    let matchedIds: string[] = [];
    try {
      const rows = await sql`
        SELECT id 
        FROM restaurants
        WHERE ST_DWithin(
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
          ST_GeomFromText(${lineStringText}, 4326)::geography,
          ${radiusMeters}
        )
      `;
      matchedIds = rows.map((r: any) => r.id);
    } finally {
      await sql.end();
    }

    if (matchedIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 3. 획득한 ID들을 통해 온전한 비디오/큐레이션이 포함된 Restaurant 정보 조회
    const fullRestaurants = await getRestaurantsByIds(matchedIds);

    return NextResponse.json({
      success: true,
      data: fullRestaurants
    });

  } catch (error: any) {
    console.error('경로 근처 맛집 조회 API 에러:', error);
    return NextResponse.json({ success: false, error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
