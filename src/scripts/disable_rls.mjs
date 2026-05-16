import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL 환경 변수 오류");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function disableRls() {
  console.log("🔓 프론트엔드 조회를 위해 RLS 비활성화 중...");

  try {
    await sql`ALTER TABLE channels DISABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE series DISABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE videos DISABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE restaurants DISABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE restaurant_videos DISABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE restaurant_curations DISABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE curation_sources DISABLE ROW LEVEL SECURITY`;

    console.log("✅ 모든 테이블의 RLS가 비활성화되었습니다. (Anon 접속 가능)");
  } catch (error) {
    console.error("에러 발생:", error);
  } finally {
    await sql.end();
  }
}

disableRls();
