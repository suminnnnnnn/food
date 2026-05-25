const apiKey = process.env.YOUTUBE_API_KEY;
console.log('Using YouTube API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'None');

const videoIds = [
  'R9K-bE34V-4', // 홍석천 이원일 유즈라멘
  'F3lP_P6L8t8', // 최자로드8 호수집
  '7X5XG31l7Y8', // 성시경 먹을텐데 호수집
  'kYJqD96Y9Qc', // 홍석천 이원일 유즈라멘 2
  'F3q2FqT9n0w', // 떡볶퀸 충정로 철길떡볶이
  'wX-y0M-Y8_M', // 맛있는녀석들 닭갈비
  'k5jG24x091c'  // 백종원 들기름 두부구이
];

async function testYouTube() {
  for (const videoId of videoIds) {
    console.log(`\n=========================================`);
    console.log(`Testing Video ID: ${videoId}`);
    
    // oEmbed Test
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedRes = await fetch(oembedUrl);
      console.log(`oEmbed Status: ${oembedRes.status}`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        console.log(`oEmbed Title: "${data.title}" by ${data.author_name}`);
      } else {
        console.log(`oEmbed Failed`);
      }
    } catch (e) {
      console.log('oEmbed Error:', e.message);
    }

    // YouTube API Test
    if (apiKey) {
      try {
        const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}&key=${apiKey}`);
        console.log(`API Status: ${ytRes.status}`);
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          if (ytData.items && ytData.items.length > 0) {
            const item = ytData.items[0];
            const snippet = item.snippet;
            console.log(`API Title: "${snippet.title}"`);
            console.log(`API Channel: "${snippet.channelTitle}" (${snippet.channelId})`);
            console.log(`API Thumbnail: ${snippet.thumbnails?.default?.url}`);
            
            // Channel Info Test
            const chId = snippet.channelId;
            const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${chId}&key=${apiKey}`);
            if (chRes.ok) {
              const chData = await chRes.json();
              if (chData.items && chData.items.length > 0) {
                console.log(`API Channel Profile: ${chData.items[0].snippet.thumbnails?.default?.url}`);
              }
            }
          } else {
            console.log(`API Result: No items found (Invalid/Deleted Video ID)`);
          }
        } else {
          console.log(`API Failed:`, await ytRes.text());
        }
      } catch (e) {
        console.log('API Error:', e.message);
      }
    }
  }
}

testYouTube();
