const postgres = require('postgres');
const fs = require('fs');

const sqlString = fs.readFileSync('supabase/migrations/001_initial_schema.sql', 'utf8');
const dbUrl = 'postgresql://postgres.nfsezjbsdvqesdbulbic:Tnals77474%21@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const sql = postgres(dbUrl, { ssl: 'require' });

async function main() {
  try {
    console.log("🔥 기존 테이블 초기화 중 (DROP CASCADE)...");
    await sql.unsafe('DROP TABLE IF EXISTS restaurant_curations, curation_sources, restaurant_videos, videos, series, channels, restaurants CASCADE;');
    
    console.log("🏗️ 001_initial_schema.sql 스키마 적용 중...");
    await sql.unsafe(sqlString);
    
    console.log("✅ 스키마 초기화 및 재설정 완벽 성공!");
  } catch (e) {
    console.error("❌ 오류 발생:", e);
  } finally {
    await sql.end();
  }
}
main();
