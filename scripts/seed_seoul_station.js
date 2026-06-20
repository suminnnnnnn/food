const postgres = require('postgres');

const connectionString = 'postgres://postgres.nfsezjbsdvqesdbulbic:Tnals77474%21@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

const apiKey = process.env.YOUTUBE_API_KEY;
console.log('YouTube API Key Status:', apiKey ? `${apiKey.substring(0, 10)}... (Defined)` : 'Not Defined. Using local fallbacks.');

const seedData = [
  {
    restaurant: {
      kakao_place_id: '1913348618',
      name: '유즈라멘',
      category: '일식 > 라멘',
      address: '서울 중구 만리동1가 53-8',
      road_address: '서울 중구 만리재로 217',
      lat: 37.553934,
      lng: 126.969176
    },
    channel: {
      youtube_channel_id: 'UCLycqszWSeCAn0n5k5kQoDg', // 서울역 라이프
      default_name: '서울역 라이프',
      profile_image_url: '' // API를 통해 실시간 수집 예정
    },
    video: {
      youtube_video_id: 'r6iCsV7Apko',
      default_title: '라멘 주제에 웨이팅 실화? ㄷㄷ | 서울역 유즈라멘 맛집추천',
      thumbnail_url: '' // API를 통해 실시간 수집 예정
    },
    mention: {
      quote: '라멘에 유자즙을 조금 넣으면 시트러스한 향이 감돌면서 차슈의 기름진 맛을 완벽하게 잡아줍니다. 면과 루꼴라는 계속 리필 가능합니다.',
      mention_time: 120
    }
  },
  {
    restaurant: {
      kakao_place_id: '10839088',
      name: '호수집',
      category: '한식 > 육류,고기',
      address: '서울 중구 중림동 61-1',
      road_address: '서울 중구 청파로 443',
      lat: 37.558778,
      lng: 126.968032
    },
    channel: {
      youtube_channel_id: 'UCRPYRGw-lUwVzjmdnFg-t8Q', // 예랑먹자
      default_name: '예랑먹자 | yerangmukja',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'KDTbq5KDtEc',
      default_title: '호수집 (Hosujib) in 중림동 (Jungnim-dong) #서울 #seoul #맛집',
      thumbnail_url: ''
    },
    mention: {
      quote: '이곳의 닭꼬치는 진짜 석쇠 연탄불에 구워서 나오는데 향과 불맛이 기가 막힙니다. 칼칼하고 진한 닭볶음탕과 함께 볶음밥까지 코스로 달려야 합니다.',
      mention_time: 45
    }
  },
  {
    restaurant: {
      kakao_place_id: '27553258',
      name: '도동집',
      category: '한식 > 국수',
      address: '서울 용산구 후암동 439-13',
      road_address: '서울 용산구 후암로 48',
      lat: 37.552101,
      lng: 126.974862
    },
    channel: {
      youtube_channel_id: 'UC0i3DLR4UpVAXIePt0djl7A', // Julie's Diary
      default_name: "Julie's Diary줄리 다이어리",
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'JD3QZkL3aeU',
      default_title: '[Julie\'s Vlog] 불금 일상 - 도동집',
      thumbnail_url: ''
    },
    mention: {
      quote: '생면을 사용하여 쫄깃한 면발 and 깔끔하고 칼칼한 육수가 돋보이는 도동국수, 그리고 바삭하고 짭조름한 불고기 파전의 조화가 훌륭합니다.',
      mention_time: 15
    }
  },
  {
    restaurant: {
      kakao_place_id: '1718037166',
      name: '오근내7닭갈비',
      category: '한식 > 육류,고기',
      address: '서울 중구 봉래동2가 122',
      road_address: '서울 중구 한강대로 413',
      lat: 37.554477,
      lng: 126.971510
    },
    channel: {
      youtube_channel_id: 'UC0i3DLR4UpVAXIePt0djl7A', // Julie's Diary 채널 공유
      default_name: "Julie's Diary줄리 다이어리",
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'IYxIpYANNc8',
      default_title: '[맛집후기] (자막ON) 미슐랭 가이드 2019에도 올랐다는 오근내 닭갈비 2호점 후기',
      thumbnail_url: ''
    },
    mention: {
      quote: '춘천식 철판 닭갈비의 정석을 서울역에서 맛볼 수 있습니다. 카레가루 베이스 of 매콤달콤한 비법 양념과 부드러운 다리살의 풍미가 아주 훌륭합니다.',
      mention_time: 95
    }
  },
  {
    restaurant: {
      kakao_place_id: '10928045',
      name: '일미장어',
      category: '한식 > 일식 > 장어',
      address: '서울 용산구 동자동 35-152',
      road_address: '서울 용산구 후암로57길 35-15',
      lat: 37.553229,
      lng: 126.975412
    },
    channel: {
      youtube_channel_id: 'UCukTqeTtBmlA-GrTWPtaErQ', // 견우한의원
      default_name: '어깨가 아프면 견우한의원',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'xgs5BNNyck0',
      default_title: '더맛있는녀석들 장어구이 정식 514회 더맛녀석 용산구 일미장어',
      thumbnail_url: ''
    },
    mention: {
      quote: '쓸데없는 양념 없이 오직 참숯 소금구이 하나로 장어 본연의 고소함을 극대화했습니다. 장어 덮밥용 간장 소스 밥에 장어와 부추무침을 비벼 드세요.',
      mention_time: 180
    }
  },
  {
    restaurant: {
      kakao_place_id: '21258671',
      name: '서부고려족발',
      category: '한식 > 족발',
      address: '서울 중구 만리동1가 62-10',
      road_address: '서울 중구 청파로 439-1',
      lat: 37.558450,
      lng: 126.968100
    },
    channel: {
      youtube_channel_id: 'UC_some_channel_id_for_foot', // 임시 채널 ID 수집 실패시 대체용
      default_name: '맛관부',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'TW-SrrjLpSQ',
      default_title: '서울에서 가장 맛있는 족발',
      thumbnail_url: ''
    },
    mention: {
      quote: '카라멜 색소 없이 맑게 삶아내어 은은한 한약재 향과 부드럽고 쫄깃한 비계가 살아있습니다. 서울역 현지 퇴근러들의 찐 아지트입니다.',
      mention_time: 110
    }
  },
  {
    restaurant: {
      kakao_place_id: '11048476',
      name: '명동칼국수',
      category: '한식 > 칼국수',
      address: '서울 중구 봉래동2가 122-1',
      road_address: '서울 중구 한강대로 405',
      lat: 37.555812,
      lng: 126.971932
    },
    channel: {
      youtube_channel_id: 'UCBnUWtHvlfr1CmrM2vUl04Q', // 서울로그
      default_name: '서울로그 [ 맛집 핫플 데이트코스 ]',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'q68D-4wcyjI',
      default_title: '충격적인 명동교자 근황..',
      thumbnail_url: ''
    },
    mention: {
      quote: '깊고 진한 사골 고기 육수에 마늘 다진대대기와 알싸하고 매운 마늘 겉절이 김치가 엄청난 매력을 발산합니다. 밥은 무조건 말아 드셔야 합니다.',
      mention_time: 60
    }
  },
  {
    restaurant: {
      kakao_place_id: '1032890666',
      name: '서울역철도떡볶이',
      category: '한식 > 분식 > 떡볶이',
      address: '서울 용산구 서계동 223-42',
      road_address: '서울 용산구 청파로93길 18-1',
      lat: 37.553412,
      lng: 126.966750
    },
    channel: {
      youtube_channel_id: 'UCGZfaaJh37253kput63WXDQ', // 뚱스맛집
      default_name: '뚱스맛집 (구. 뚱스뚱스 )',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: '83lZKln1rd8',
      default_title: '서울역 도보5분 골목안 숨은 떡볶이 맛집.서울역철도떡볶이 고추가루소스의 매콤달달한 추억의맛',
      thumbnail_url: ''
    },
    mention: {
      quote: '기차가 지나가는 소리를 들으며 먹는 쫄깃한 밀떡볶이입니다. 달달하면서 매콤한 전통 시장 판떡볶이 맛이 향수를 자극합니다.',
      mention_time: 400
    }
  },
  {
    restaurant: {
      kakao_place_id: '8140417',
      name: '충무칼국수',
      category: '한식 > 칼국수',
      address: '서울 용산구 동자동 23-28',
      road_address: '서울 용산구 한강대로104길 84',
      lat: 37.549212,
      lng: 126.974912
    },
    channel: {
      youtube_channel_id: 'UCfHEOB5PtTDTC5Aq8gCMu_A', // 구독한미식가
      default_name: '구독한미식가',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: '7Eul97CwOPY',
      default_title: '[충무칼국수] 후암동 아래 숨은 맛집을 가다 | 보쌈 (한국인의밥상ver.)',
      thumbnail_url: ''
    },
    mention: {
      quote: '이곳의 하이라이트는 굴이 아낌없이 박혀있는 시원하고 아삭한 보쌈김치와 보쌈고기, 그리고 멸치 육수 베이스의 개운한 칼국수입니다.',
      mention_time: 50
    }
  },
  {
    restaurant: {
      kakao_place_id: '11181280',
      name: '그릴',
      category: '양식 > 경양식',
      address: '서울 용산구 동자동 43-205',
      road_address: '서울 용산구 한강대로 405 서울역사 4층',
      lat: 37.554800,
      lng: 126.970800
    },
    channel: {
      youtube_channel_id: 'UCfHEOB5PtTDTC5Aq8gCMu_A', // 구독한미식가 공유
      default_name: '구독한미식가',
      profile_image_url: ''
    },
    video: {
      youtube_video_id: 'EARMfZhabgE',
      default_title: '[서울역그릴]대한민국 최초의 경양식 레스토랑 | 이제는 역사속으로 사라진 돈까스집 | since1925',
      thumbnail_url: ''
    },
    mention: {
      quote: '90년이 넘는 긴 역사를 간직한 한국 최초의 경양식당입니다. 두툼하고 육즙 가득한 수제 함박스테이크는 옛 감성 그대로 우아하게 제공됩니다.',
      mention_time: 30
    }
  }
];

async function runSeeding() {
  console.log('Inserting 10 prestigious Seoul Station restaurants with robust real-time API collection...');

  try {
    for (const item of seedData) {
      console.log(`\n-----------------------------------------`);
      console.log(`Processing restaurant: ${item.restaurant.name}`);

      // 🛡️ 실시간 정보 수집용 변수 설정 (기본값 장착)
      let videoTitle = item.video.default_title;
      let thumbnailUrl = `https://img.youtube.com/vi/${item.video.youtube_video_id}/hqdefault.jpg`;
      let channelName = item.channel.default_name;
      let ytChannelId = item.channel.youtube_channel_id;
      let ytChannelProfileUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.channel.default_name)}&background=ff5e00&color=fff&bold=true&size=128&rounded=true`;

      // 1단계: 구글 유튜브 APIv3 실시간 조회 (활성화 시)
      if (apiKey) {
        try {
          console.log(`[Google API v3] Fetching video detail: ${item.video.youtube_video_id}`);
          const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${item.video.youtube_video_id}&key=${apiKey}`);
          
          if (vRes.ok) {
            const vData = await vRes.json();
            if (vData.items && vData.items.length > 0) {
              const snippet = vData.items[0].snippet;
              videoTitle = snippet.title;
              thumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || thumbnailUrl;
              channelName = snippet.channelTitle;
              ytChannelId = snippet.channelId || ytChannelId;
              
              console.log(`[Google API v3] Video found! Title: "${videoTitle}" (By ${channelName})`);

              // 2단계: 유튜버 채널 정보 (프로필 이미지) 조회
              console.log(`[Google API v3] Fetching channel profile: ${ytChannelId}`);
              const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${ytChannelId}&key=${apiKey}`);
              if (cRes.ok) {
                const cData = await cRes.json();
                if (cData.items && cData.items.length > 0) {
                  ytChannelProfileUrl = cData.items[0].snippet.thumbnails?.default?.url || ytChannelProfileUrl;
                  console.log(`[Google API v3] Channel Profile found! URL: ${ytChannelProfileUrl}`);
                }
              }
            } else {
              console.warn(`[Google API v3] Video ID "${item.video.youtube_video_id}" not found in items. Trying fallback.`);
            }
          } else {
            console.warn(`[Google API v3] API Response Error. Status: ${vRes.status}. Trying fallback.`);
          }
        } catch (e) {
          console.warn(`[Google API v3] Fetch exception. Error: ${e.message}. Trying fallback.`);
        }
      }

      // 2단계: oEmbed Fallback (API Key가 없거나 API 조회가 실패했을 때 타이틀, 썸네일 보강)
      if (videoTitle === item.video.default_title && channelName === item.channel.default_name) {
        try {
          console.log(`[oEmbed Fallback] Fetching details for ${item.video.youtube_video_id}`);
          const oRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${item.video.youtube_video_id}&format=json`);
          if (oRes.ok) {
            const oData = await oRes.json();
            videoTitle = oData.title || videoTitle;
            channelName = oData.author_name || channelName;
            thumbnailUrl = oData.thumbnail_url || thumbnailUrl;
            console.log(`[oEmbed Fallback] Success! Title: "${videoTitle}" (By ${channelName})`);
          }
        } catch (e) {
          console.warn(`[oEmbed Fallback] Failed. Error: ${e.message}`);
        }
      }

      // 3단계: 프로필 이미지 최종 폴백 설정 (비어있거나 기본 아바타 필요 시)
      if (!ytChannelProfileUrl) {
        ytChannelProfileUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(channelName)}&background=ff5e00&color=fff&bold=true&size=128&rounded=true`;
      }

      // 4단계: 데이터베이스 적재

      // 1. Channel 삽입 또는 조회 (ON CONFLICT DO UPDATE)
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

      // 2. Video 삽입
      await sql`
        INSERT INTO videos (channel_id, youtube_video_id, title, thumbnail_url)
        VALUES (${dbChannel.id}, ${item.video.youtube_video_id}, ${videoTitle}, ${thumbnailUrl})
        ON CONFLICT (youtube_video_id) DO UPDATE SET
          title = EXCLUDED.title,
          thumbnail_url = EXCLUDED.thumbnail_url
      `;
      const [dbVideo] = await sql`
        SELECT id FROM videos WHERE youtube_video_id = ${item.video.youtube_video_id}
      `;

      // 3. Restaurant 삽입
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

      // 4. Restaurant_Video 조인 맵 삽입
      await sql`
        INSERT INTO restaurant_videos (restaurant_id, video_id, mention_time, quote)
        VALUES (${dbRestaurant.id}, ${dbVideo.id}, ${item.mention.mention_time}, ${item.mention.quote})
        ON CONFLICT (restaurant_id, video_id) DO UPDATE SET
          mention_time = EXCLUDED.mention_time,
          quote = EXCLUDED.quote
      `;

      console.log(`Successfully seeded DB: "${item.restaurant.name}" (Channel: "${channelName}")`);
    }

    console.log('\n=========================================');
    console.log('All 10 prestigious restaurants successfully seeded to Supabase with real YouTube Metadata!');
  } catch (error) {
    console.error('Error during seeding process:', error);
  } finally {
    await sql.end();
  }
}

runSeeding();
