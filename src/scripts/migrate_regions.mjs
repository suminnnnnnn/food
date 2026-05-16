import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL 환경 변수 오류");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function migrate() {
  console.log("🚀 [Phase 1] 데이터베이스 마이그레이션 시작...");

  try {
    // 1. 컬럼 추가
    console.log("📦 1. 행정구역 컬럼 추가 중...");
    await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS region_1depth VARCHAR(100);`;
    await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS region_2depth VARCHAR(100);`;
    await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS region_3depth VARCHAR(100);`;

    // 2. 인덱스 생성
    console.log("⚡ 2. 복합 인덱스 생성 중...");
    await sql`CREATE INDEX IF NOT EXISTS idx_restaurants_regions ON restaurants (region_1depth, region_2depth, region_3depth);`;

    // 3. 기존 데이터 파싱 및 업데이트
    console.log("🔄 3. 네이버 리버스 지오코딩 API를 활용한 위경도 기반 행정동 업데이트 중...");
    const restaurants = await sql`SELECT id, lat, lng, address FROM restaurants`;
    console.log(`Found ${restaurants.length} restaurants.`);
    
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
      throw new Error("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET가 설정되지 않았습니다.");
    }

    let updateCount = 0;
    for (const r of restaurants) {
      if (!r.lat || !r.lng) continue;
      
      try {
        const response = await fetch(`https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${r.lng},${r.lat}&output=json&orders=legalcode,admcode`, {
          headers: { 
            "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID,
            "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET
          }
        });
        const data = await response.json();
        if (data.status && data.status.code !== 0) {
          console.log("API Error:", data.status);
          continue;
        }
        
        if (data.results && data.results.length > 0) {
          const region = data.results[0].region;
          
          const region_1depth = region.area1.name;
          const region_2depth = region.area2.name;
          const region_3depth = region.area3.name;

          await sql`
            UPDATE restaurants 
            SET region_1depth = ${region_1depth}, 
                region_2depth = ${region_2depth}, 
                region_3depth = ${region_3depth}
            WHERE id = ${r.id}
          `;
          updateCount++;
          await new Promise(res => setTimeout(res, 50));
        }
      } catch (err) {
        console.error(`ID ${r.id} 업데이트 실패:`, err.message);
      }
    }

    console.log(`✅ 마이그레이션 완료! 총 ${updateCount}개의 식당 데이터 업데이트 성공.`);
    
  } catch (error) {
    console.error("❌ 마이그레이션 중 에러 발생:", error);
  } finally {
    await sql.end();
  }
}

migrate();
