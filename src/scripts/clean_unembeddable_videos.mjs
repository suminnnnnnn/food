import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.nfsezjbsdvqesdbulbic:Tnals77474!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

if (!DATABASE_URL) {
  console.error("DATABASE_URL 환경 변수가 필요합니다.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function clean() {
  console.log("🧹 외부 재생(임베드) 제한된 기존 유튜브 영상 데이터 정제 시작...");

  // 정제할 비디오 ID 목록 (쯔양: wX-y0l_oM6s, 정육왕: S08bC7b5-Gg)
  const unembeddableVideoIds = ['wX-y0l_oM6s', 'S08bC7b5-Gg'];

  try {
    for (const videoId of unembeddableVideoIds) {
      console.log(`\n🔍 대상 비디오 ID 검사 중: ${videoId}`);
      
      // 1. 해당 비디오가 데이터베이스에 존재하는지 확인
      const videoResult = await sql`
        SELECT id, title FROM videos WHERE youtube_video_id = ${videoId}
      `;

      if (videoResult.length === 0) {
        console.log(`   ⏭️ 비디오가 이미 데이터베이스에 존재하지 않습니다. 건너뜁니다.`);
        continue;
      }

      const dbVideoId = videoResult[0].id;
      const title = videoResult[0].title;
      console.log(`   📌 발견된 비디오: "${title}" (UUID: ${dbVideoId})`);

      // 2. restaurant_videos 매핑 데이터 제거 (N:M 관계)
      const mappingResult = await sql`
        DELETE FROM restaurant_videos 
        WHERE video_id = ${dbVideoId}
        RETURNING *
      `;
      console.log(`   ❌ 식당-비디오 매핑 관계 제거 완료 (${mappingResult.length}건)`);

      // 3. videos 테이블에서 비디오 제거
      const deleteVideoResult = await sql`
        DELETE FROM videos
        WHERE id = ${dbVideoId}
        RETURNING *
      `;
      console.log(`   ❌ 비디오 테이블에서 레코드 삭제 완료 ("${deleteVideoResult[0].title}")`);
    }

    console.log("\n✅ 데이터베이스 정제 프로세스가 완전히 끝났습니다!");
  } catch (error) {
    console.error("정제 과정에서 오류가 발생했습니다:", error);
  } finally {
    await sql.end();
  }
}

clean();
