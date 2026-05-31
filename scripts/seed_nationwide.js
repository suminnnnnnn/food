const postgres = require('postgres');

const connectionString = 'postgres://postgres.nfsezjbsdvqesdbulbic:Tnals77474%21@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

const extraSeedData = [
  {
    restaurant: {
      kakao_place_id: '12185792',
      name: '해성막창집 본점',
      category: '한식 > 곱창,막창',
      address: '부산 해운대구 우동 642-3',
      road_address: '부산 해운대구 중동1로19번길 29',
      lat: 35.161687,
      lng: 129.163351
    },
    channel: {
      youtube_channel_id: 'UC4ZA57iJrf73bJlApKFeLRw', // 또간집
      default_name: '재밌는 거 올라온다',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'busan_haesung_mc',
      default_title: '[또간집] 부산 해운대 해성막창 곱창전골 찐맛집 먹방',
      thumbnail_url: 'https://images.unsplash.com/photo-1547928500-3001aa3092a0?w=500&q=80'
    },
    mention: {
      quote: '부산 해운대에 오면 무조건 들러야 하는 막창과 대창의 성지입니다. 쫀득한 곱창 구이와 칼칼한 전골 국물의 조화가 소주를 부릅니다.',
      mention_time: 120
    }
  },
  {
    restaurant: {
      kakao_place_id: '10294857',
      name: '중앙떡볶이',
      category: '한식 > 분식 > 떡볶이',
      address: '대구 중구 동성로2가 70-1',
      road_address: '대구 중구 동성로2길 81',
      lat: 35.869871,
      lng: 128.596043
    },
    channel: {
      youtube_channel_id: 'UC4ZA57iJrf73bJlApKFeLRw',
      default_name: '재밌는 거 올라온다',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'daegu_jungang_tb',
      default_title: '[또간집] 대구 동성로 중앙떡볶이 납작만두 정식 리포트',
      thumbnail_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80'
    },
    mention: {
      quote: '대구 동성로의 상징이자 납작만두와 두툼한 쌀떡볶이의 콜라보레이션. 카레 향이 살짝 도는 진하고 꾸덕한 양념이 만두 피에 슥 배어듭니다.',
      mention_time: 300
    }
  },
  {
    restaurant: {
      kakao_place_id: '80928475',
      name: '영미오리탕',
      category: '한식 > 탕 > 오리',
      address: '광주 북구 유동 102-31',
      road_address: '광주 북구 경열로 126',
      lat: 35.161048,
      lng: 126.902341
    },
    channel: {
      youtube_channel_id: 'UC_tq3c2g7fXf8n8v0696969',
      default_name: '성시경의 먹을텐데',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'gwangju_youngmi_ot',
      default_title: '성시경의 먹을텐데 | 광주 영미오리탕 미식 탐방',
      thumbnail_url: 'https://images.unsplash.com/photo-1547928500-3001aa3092a0?w=500&q=80'
    },
    mention: {
      quote: '들깨가루를 엄청나게 갈아 넣어 거의 크림 수프처럼 녹진한 오리탕 국물이 일품입니다. 미나리를 샤브샤브처럼 계속 데쳐 초장에 찍어 드세요.',
      mention_time: 210
    }
  },
  {
    restaurant: {
      kakao_place_id: '78495029',
      name: '가보정',
      category: '한식 > 갈비',
      address: '경기 수원시 팔달구 인계동 958-1',
      road_address: '경기 수원시 팔달구 장다리로 282',
      lat: 37.269451,
      lng: 127.031587
    },
    channel: {
      youtube_channel_id: 'UC_tq3c2g7fXf8n8v0696969',
      default_name: '성시경의 먹을텐데',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'suwon_gabojung_gb',
      default_title: '성시경의 먹을텐데 | 수원 대표 갈비 명가 가보정 1관 정밀 리뷰',
      thumbnail_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80'
    },
    mention: {
      quote: '수원 왕갈비의 정점이자 상다리가 부러지도록 깔리는 한정식 급 반찬의 클래스. 미국산 한우 갈비 모두 고르게 숙성되어 마블링이 환상적입니다.',
      mention_time: 420
    }
  }
];

async function runSeeding() {
  console.log('Starting Seeding of Nationwide Restaurants (Busan, Daegu, Gwangju, Suwon)...');
  try {
    for (const item of extraSeedData) {
      const channelName = item.channel.default_name;
      const ytChannelId = item.channel.youtube_channel_id;
      const ytChannelProfileUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(channelName)}&background=ff5e00&color=fff&bold=true&size=128&rounded=true`;

      // 1. Channel
      await sql`
        INSERT INTO channels (youtube_channel_id, name, profile_image_url)
        VALUES (${ytChannelId}, ${channelName}, ${ytChannelProfileUrl})
        ON CONFLICT (youtube_channel_id) DO UPDATE SET
          name = EXCLUDED.name,
          profile_image_url = EXCLUDED.profile_image_url
      `;
      const [dbChannel] = await sql`
        SELECT id FROM channels WHERE youtube_channel_id = ${ytChannelId}
      `;

      // 2. Video
      await sql`
        INSERT INTO videos (channel_id, youtube_video_id, title, thumbnail_url)
        VALUES (${dbChannel.id}, ${item.video.youtube_video_id}, ${item.video.default_title}, ${item.video.thumbnail_url})
        ON CONFLICT (youtube_video_id) DO UPDATE SET
          title = EXCLUDED.title,
          thumbnail_url = EXCLUDED.thumbnail_url
      `;
      const [dbVideo] = await sql`
        SELECT id FROM videos WHERE youtube_video_id = ${item.video.youtube_video_id}
      `;

      // 3. Restaurant
      await sql`
        INSERT INTO restaurants (kakao_place_id, name, category, address, road_address, lat, lng, is_published)
        VALUES (${item.restaurant.kakao_place_id}, ${item.restaurant.name}, ${item.restaurant.category}, ${item.restaurant.address}, ${item.restaurant.road_address}, ${item.restaurant.lat}, ${item.restaurant.lng}, true)
        ON CONFLICT (kakao_place_id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          address = EXCLUDED.address,
          road_address = EXCLUDED.road_address,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng
      `;
      const [dbRestaurant] = await sql`
        SELECT id FROM restaurants WHERE kakao_place_id = ${item.restaurant.kakao_place_id}
      `;

      // 4. Join
      await sql`
        INSERT INTO restaurant_videos (restaurant_id, video_id, mention_time, quote)
        VALUES (${dbRestaurant.id}, ${dbVideo.id}, ${item.mention.mention_time}, ${item.mention.quote})
        ON CONFLICT (restaurant_id, video_id) DO UPDATE SET
          mention_time = EXCLUDED.mention_time,
          quote = EXCLUDED.quote
      `;

      console.log(`Successfully seeded Nationwide DB: "${item.restaurant.name}"`);
    }
    console.log('Nationwide restaurants seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await sql.end();
  }
}

runSeeding();
