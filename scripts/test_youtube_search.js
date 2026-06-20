const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) {
  console.error('YOUTUBE_API_KEY is not defined in environment variables.');
  process.exit(1);
}

const keywords = [
  '서울역 유즈라멘 홍석천 이원일',
  '중림동 호수집 성시경 먹을텐데',
  '후암동 도동집 이영자',
  '서울역 오근내닭갈비 맛있는녀석들',
  '용산 일미장어 조나단',
  '서울역 고려족발 김사원세끼',
  '서울역 명동교자 칼국수',
  '서울역철도떡볶이',
  '후암동 충무칼국수 보쌈',
  '서울역 그릴 경양식'
];

async function searchYouTube() {
  console.log('Searching YouTube videos for 10 restaurants...');
  
  for (const keyword of keywords) {
    console.log(`\n=========================================`);
    console.log(`Searching for: ${keyword}`);
    
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=1&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Search failed for "${keyword}". Status: ${res.status}`);
        const text = await res.text();
        console.error(text);
        continue;
      }
      
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        const videoId = item.id.videoId;
        const snippet = item.snippet;
        console.log(`Found Video ID: ${videoId}`);
        console.log(`Title: "${snippet.title}"`);
        console.log(`Channel: "${snippet.channelTitle}" (${snippet.channelId})`);
        console.log(`Thumbnail: ${snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url}`);
        
        // Channel Profile 수집
        const chId = snippet.channelId;
        const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${chId}&key=${apiKey}`);
        if (chRes.ok) {
          const chData = await chRes.json();
          if (chData.items && chData.items.length > 0) {
            console.log(`Channel Profile: ${chData.items[0].snippet.thumbnails?.default?.url}`);
          }
        }
      } else {
        console.log('No video found.');
      }
    } catch (e) {
      console.error(`Error during search for "${keyword}":`, e.message);
    }
  }
}

searchYouTube();
