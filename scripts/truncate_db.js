const postgres = require('postgres');

// Next.js 환경변수 포맷에서 사용할 수 있는 형태로 변환
const connectionString = 'postgres://postgres.nfsezjbsdvqesdbulbic:Tnals77474%21@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const sql = postgres(connectionString);

async function truncateDB() {
  console.log('Connecting to database directly to bypass RLS and clear all data...');
  try {
    // CASCADE를 사용하여 외래키가 걸린 모든 자식/부모 데이터 연쇄 삭제
    await sql`
      TRUNCATE TABLE 
        restaurant_videos, 
        restaurant_submissions, 
        restaurants, 
        videos, 
        channels 
      CASCADE;
    `;
    console.log('Database successfully truncated! All data has been wiped.');
  } catch (err) {
    console.error('Failed to truncate tables:', err);
  } finally {
    await sql.end();
  }
}

truncateDB();
