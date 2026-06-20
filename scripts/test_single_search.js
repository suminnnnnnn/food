const apiKey = process.env.YOUTUBE_API_KEY;
async function searchSingle() {
  const keyword = '서울역 족발 맛집';
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=1&key=${apiKey}`;
  const res = await fetch(url);
  if (res.ok) {
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      console.log(`Video ID: ${item.id.videoId}`);
      console.log(`Title: ${item.snippet.title}`);
      console.log(`Channel: ${item.snippet.channelTitle}`);
    } else {
      console.log('No results found.');
    }
  } else {
    console.error('Search failed:', await res.text());
  }
}
searchSingle();
