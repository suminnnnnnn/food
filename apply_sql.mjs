import postgres from 'postgres';
import fs from 'fs';

// postgresql+asyncpg 프로토콜을 Node.js용 postgres:// 규격으로 치환하여 연결성 보장
const rawUrl = process.env.DATABASE_URL || 'postgresql://postgres.nfsezjbsdvqesdbulbic:Tnals77474!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const dbUrl = rawUrl.replace('postgresql+asyncpg://', 'postgresql://');

const sql = postgres(dbUrl, {
  ssl: 'require'
});

async function main() {
  try {
    console.log("새 통합 마이그레이션 SQL 파일 로딩 중...");
    const sqlContent = fs.readFileSync('./supabase/migrations/20260524_create_group_maps.sql', 'utf8');

    console.log("데이터베이스 마이그레이션 적용 시작...");
    await sql.unsafe(sqlContent);
    console.log("마이그레이션 및 match_restaurants RPC 함수가 DB에 완벽히 적용되었습니다.");
  } catch (error) {
    console.error("SQL 실행 중 오류 발생:", error);
  } finally {
    await sql.end();
  }
}

main();
