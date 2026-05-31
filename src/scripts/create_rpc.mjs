import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL 환경 변수 오류");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function createRpc() {
  console.log("🚀 [Phase 2] Supabase RPC 통계 함수 생성 시작...");

  try {
    await sql`
      CREATE OR REPLACE FUNCTION get_restaurant_clusters(p_depth INTEGER, p_parent1 TEXT DEFAULT NULL, p_parent2 TEXT DEFAULT NULL)
      RETURNS TABLE(region_name VARCHAR, count BIGINT, center_lat FLOAT, center_lng FLOAT) 
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF p_depth = 1 THEN
          RETURN QUERY 
          SELECT region_1depth::VARCHAR as region_name, count(*)::BIGINT as count, avg(lat)::FLOAT as center_lat, avg(lng)::FLOAT as center_lng 
          FROM restaurants 
          WHERE region_1depth IS NOT NULL
          GROUP BY region_1depth;
        ELSIF p_depth = 2 THEN
          RETURN QUERY 
          SELECT 
            (CASE 
              WHEN region_1depth = '서울특별시' THEN '서울 '
              WHEN region_1depth = '부산광역시' THEN '부산 '
              WHEN region_1depth = '대구광역시' THEN '대구 '
              WHEN region_1depth = '인천광역시' THEN '인천 '
              WHEN region_1depth = '광주광역시' THEN '광주 '
              WHEN region_1depth = '대전광역시' THEN '대전 '
              WHEN region_1depth = '울산광역시' THEN '울산 '
              WHEN region_1depth = '세종특별자치시' THEN '세종 '
              WHEN region_1depth = '경기도' THEN '경기 '
              WHEN region_1depth = '강원도' THEN '강원 '
              WHEN region_1depth = '충청북도' THEN '충북 '
              WHEN region_1depth = '충청남도' THEN '충남 '
              WHEN region_1depth = '전라북도' THEN '전북 '
              WHEN region_1depth = '전라남도' THEN '전남 '
              WHEN region_1depth = '경상북도' THEN '경북 '
              WHEN region_1depth = '경상남도' THEN '경남 '
              WHEN region_1depth = '제주특별자치도' THEN '제주 '
              ELSE ''
            END || region_2depth)::VARCHAR as region_name, 
            count(*)::BIGINT as count, 
            avg(lat)::FLOAT as center_lat, 
            avg(lng)::FLOAT as center_lng 
          FROM restaurants 
          WHERE region_2depth IS NOT NULL AND (p_parent1 IS NULL OR region_1depth = p_parent1)
          GROUP BY region_1depth, region_2depth;
        ELSE
          RETURN QUERY 
          SELECT region_3depth::VARCHAR as region_name, count(*)::BIGINT as count, avg(lat)::FLOAT as center_lat, avg(lng)::FLOAT as center_lng 
          FROM restaurants 
          WHERE region_3depth IS NOT NULL AND (p_parent1 IS NULL OR region_1depth = p_parent1) AND (p_parent2 IS NULL OR region_2depth = p_parent2)
          GROUP BY region_3depth;
        END IF;
      END;
      $$;
    `;
    console.log("✅ get_restaurant_clusters RPC 함수 생성 완료!");
  } catch (error) {
    console.error("❌ RPC 생성 중 에러 발생:", error);
  } finally {
    await sql.end();
  }
}

createRpc();
