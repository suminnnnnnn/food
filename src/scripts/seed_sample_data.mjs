import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL 환경 변수 오류");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function seed() {
  console.log("🌱 프론트엔드 연동 테스트용 시드 데이터 적재 중 (Postgres Client)...");

  try {
    // 1. 미쉐린 가이드, 블루리본 소스 확인 (이미 초기화되어 있음)
    const michelin = await sql`SELECT id FROM curation_sources WHERE code = 'michelin' LIMIT 1`;
    const blueribbon = await sql`SELECT id FROM curation_sources WHERE code = 'blueribbon' LIMIT 1`;

    const michelinId = michelin[0]?.id;
    const blueribbonId = blueribbon[0]?.id;

    if (!michelinId || !blueribbonId) {
       console.log("큐레이션 소스가 존재하지 않습니다. 초기 스키마를 확인하세요.");
    }

    // 2. 채널 및 시리즈
    const channel = await sql`
      INSERT INTO channels (youtube_channel_id, name, profile_image_url)
      VALUES ('UCc_HxsK-yN7XJ7nZgA7c5qA', '성시경 SUNG SI KYUNG', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop')
      ON CONFLICT (youtube_channel_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const channelId = channel[0].id;

    const series = await sql`
      INSERT INTO series (channel_id, name, host_name)
      VALUES (${channelId}, '먹을텐데', '성시경')
      RETURNING id
    `;
    const seriesId = series[0].id;

    // 3. 비디오
    const video = await sql`
      INSERT INTO videos (channel_id, series_id, youtube_video_id, title, thumbnail_url, view_count, is_short)
      VALUES (${channelId}, ${seriesId}, 'dQw4w9WgXcQ', '성시경의 먹을텐데 l 명동교자 본점', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=800&auto=format&fit=crop', 3500000, false)
      ON CONFLICT (youtube_video_id) DO UPDATE SET title = EXCLUDED.title
      RETURNING id
    `;
    const videoId = video[0].id;

    // 4. 식당 (명동교자 본점 - 서울)
    const rest = await sql`
      INSERT INTO restaurants (kakao_place_id, name, category, address, road_address, lat, lng)
      VALUES ('8118029', '명동교자 본점', '칼국수', '서울 중구 명동10길 29', '서울 중구 명동10길 29', 37.562547, 126.985651)
      ON CONFLICT (kakao_place_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const restId = rest[0].id;

    // 5. 식당-비디오 매핑
    await sql`
      INSERT INTO restaurant_videos (restaurant_id, video_id, quote)
      VALUES (${restId}, ${videoId}, '진짜 완벽한 고기육수와 마늘김치입니다.')
      ON CONFLICT (restaurant_id, video_id) DO UPDATE SET quote = EXCLUDED.quote
    `;

    // 6. 식당-큐레이션 매핑 (미쉐린 빕구르망, 블루리본)
    if (michelinId) {
      await sql`
        INSERT INTO restaurant_curations (restaurant_id, source_id, metadata)
        VALUES (${restId}, ${michelinId}, '{"label": "미쉐린 가이드 서울", "year": 2024}'::jsonb)
      `;
    }
    
    if (blueribbonId) {
      await sql`
        INSERT INTO restaurant_curations (restaurant_id, source_id, metadata)
        VALUES (${restId}, ${blueribbonId}, '{"label": "블루리본 서베이", "year": 2024}'::jsonb)
      `;
    }

    console.log("✅ 시드 데이터 적재 완료! (명동교자 본점)");
  } catch (error) {
    console.error("적재 중 에러 발생:", error);
  } finally {
    await sql.end();
  }
}

seed();
