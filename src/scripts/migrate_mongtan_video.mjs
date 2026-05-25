import postgres from 'postgres';

const DATABASE_URL = 'postgresql://postgres.nfsezjbsdvqesdbulbic:Tnals77474!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const YOUTUBE_API_KEY = 'AIzaSyDzy3geWn5B0OWCU83B0fu0CmzWiLjLX_U';

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function run() {
  console.log("🍖 [몽탄 비디오 자동 마이그레이션] 유튜브에서 임베드 재생 가능한 몽탄 먹방 영상 검색 중...");
  
  // 1. 영국남자 S01Zt1UjJ5E 영상도 재생 불가로 확인되었으니 삭제
  console.log("🧹 기존 재생 제한 영국남자 영상 S01Zt1UjJ5E 삭제 처리...");
  const existingResult = await sql`SELECT id FROM videos WHERE youtube_video_id = 'S01Zt1UjJ5E'`;
  if (existingResult.length > 0) {
    const videoId = existingResult[0].id;
    await sql`DELETE FROM restaurant_videos WHERE video_id = ${videoId}`;
    await sql`DELETE FROM videos WHERE id = ${videoId}`;
    console.log("   ❌ S01Zt1UjJ5E 비디오 및 매핑 제거 완료");
  }

  // 2. 유튜브 "몽탄 우대갈비" 검색
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=${encodeURIComponent('몽탄 우대갈비')}&part=snippet&type=video&maxResults=10&order=relevance`;
  
  try {
    const res = await fetch(searchUrl);
    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      console.error("유튜브 검색 결과가 없습니다.");
      return;
    }

    const videoIds = data.items.map(item => item.id.videoId).join(',');
    console.log(`🔍 검색된 비디오 ID 후보군: ${videoIds}`);

    // 3. videos.list API를 통해 status.embeddable === true 인 영상 골라내기
    const detailUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoIds}&part=snippet,status`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();

    if (!detailData.items || detailData.items.length === 0) {
      console.error("비디오 상세정보를 조회할 수 없습니다.");
      return;
    }

    const embeddableVideos = detailData.items.filter(item => item.status?.embeddable === true);
    
    if (embeddableVideos.length === 0) {
      console.error("임베드 재생이 가능한 몽탄 영상이 후보군 중 한 개도 없습니다!");
      return;
    }

    // 첫 번째 임베드 가능 영상 선택
    const targetVideo = embeddableVideos[0];
    const targetVideoId = targetVideo.id;
    const title = targetVideo.snippet.title;
    const thumbnail = targetVideo.snippet.thumbnails?.high?.url || targetVideo.snippet.thumbnails?.default?.url || '';
    const channelId = targetVideo.snippet.channelId;
    const channelTitle = targetVideo.snippet.channelTitle;

    console.log(`\n🎉 임베드 가능 영상 매핑 선정!`);
    console.log(`   - 비디오 ID: ${targetVideoId}`);
    console.log(`   - 제목: ${title}`);
    console.log(`   - 채널: ${channelTitle}`);

    // 4. DB에 채널, 비디오, 몽탄 매핑 주입
    // 몽탄 맛집 ID: 6244b38d-aef6-41dc-afd6-1d61899c88de
    const mongtanRestaurantId = '6244b38d-aef6-41dc-afd6-1d61899c88de';

    // (A) 채널 생성/확인
    const channelUpsert = await sql`
      INSERT INTO channels (youtube_channel_id, name)
      VALUES (${channelId}, ${channelTitle})
      ON CONFLICT (youtube_channel_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const dbChannelId = channelUpsert[0].id;

    // (B) 비디오 생성/확인
    const videoUpsert = await sql`
      INSERT INTO videos (channel_id, youtube_video_id, title, thumbnail_url)
      VALUES (${dbChannelId}, ${targetVideoId}, ${title}, ${thumbnail})
      ON CONFLICT (youtube_video_id) DO UPDATE SET title = EXCLUDED.title
      RETURNING id
    `;
    const dbVideoId = videoUpsert[0].id;

    // (C) 식당-비디오 매핑
    await sql`
      INSERT INTO restaurant_videos (restaurant_id, video_id, quote)
      VALUES (${mongtanRestaurantId}, ${dbVideoId}, '짚불 향 가득 머금은 우대갈비가 환상적입니다.')
      ON CONFLICT (restaurant_id, video_id) DO UPDATE SET quote = EXCLUDED.quote
    `;

    console.log(`\n✅ 몽탄 맛집과 재생 가능 비디오 매핑 완료! (ID: ${targetVideoId})`);

  } catch (error) {
    console.error("마이그레이션 실행 중 오류 발생:", error);
  } finally {
    await sql.end();
  }
}

run();
