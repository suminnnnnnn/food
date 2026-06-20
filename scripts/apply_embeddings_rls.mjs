import postgres from 'postgres';

const rawUrl = process.env.DATABASE_URL || 'postgresql://postgres.nfsezjbsdvqesdbulbic:Tnals77474!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const dbUrl = rawUrl.replace('postgresql+asyncpg://', 'postgresql://');

const sql = postgres(dbUrl, {
  ssl: 'require'
});

async function main() {
  console.log("restaurant_embeddings 테이블 RLS 완화 정책 적용 중...");
  
  const sqlContent = `
    -- 1. restaurant_embeddings RLS 활성화 보장
    ALTER TABLE restaurant_embeddings ENABLE ROW LEVEL SECURITY;

    -- 2. 기존 정책 삭제
    DROP POLICY IF EXISTS embeddings_open_policy ON restaurant_embeddings;

    -- 3. 익명(anon) 및 모든 역할에 대해 SELECT, INSERT, UPDATE, DELETE 전체 권한 부여
    CREATE POLICY embeddings_open_policy ON restaurant_embeddings
      FOR ALL
      USING (true)
      WITH CHECK (true);
      
    -- 4. channels 및 videos RLS도 확인하여 적재 실패 예방
    ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS channels_open_policy ON channels;
    CREATE POLICY channels_open_policy ON channels FOR ALL USING (true) WITH CHECK (true);

    ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS videos_open_policy ON videos;
    CREATE POLICY videos_open_policy ON videos FOR ALL USING (true) WITH CHECK (true);

    ALTER TABLE restaurant_videos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS restaurant_videos_open_policy ON restaurant_videos;
    CREATE POLICY restaurant_videos_open_policy ON restaurant_videos FOR ALL USING (true) WITH CHECK (true);
  `;

  try {
    await sql.unsafe(sqlContent);
    console.log("🎉 모든 RLS 완화 정책이 데이터베이스에 완벽히 적용되었습니다.");
  } catch (error) {
    console.error("SQL 실행 중 에러 발생:", error);
  } finally {
    await sql.end();
  }
}

main();
