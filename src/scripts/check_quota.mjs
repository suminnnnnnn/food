// YouTube 검색 쿼터 회복 여부 체크. OK면 exit 0 / 소진이면 exit 1.
const YT = process.env.YOUTUBE_API_KEY;
try {
  const d = await (await fetch(`https://www.googleapis.com/youtube/v3/search?key=${YT}&q=%EA%B4%91%EC%A3%BC%20%EB%A7%9B%EC%A7%91&part=snippet&type=video&maxResults=1`)).json();
  if (d.error) {
    const reason = d.error.errors?.[0]?.reason || d.error.status || '';
    if (/quota/i.test(d.error.message) || reason === 'quotaExceeded') { console.log('QUOTA_EXCEEDED'); process.exit(1); }
    console.log('ERR:', d.error.message); process.exit(2);
  }
  console.log('QUOTA_OK (검색 정상, items:', (d.items || []).length, ')'); process.exit(0);
} catch (e) { console.log('FETCH_ERR:', e.message); process.exit(3); }
