// 기존 affiliate_videos에 채널 구독자수·프로필 보강 (YouTube API, 일회성)
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const YT = process.env.YOUTUBE_API_KEY;

async function ytJson(url) {
  const res = await fetch(url);
  return res.ok ? res.json() : { items: [] };
}

try {
  const vids = await sql`SELECT id, youtube_video_id FROM affiliate_videos`;
  if (vids.length === 0) { console.log('영상 없음'); process.exit(0); }

  // 1. videos.list → channelId
  const vidToCh = {};
  const ytIds = vids.map((v) => v.youtube_video_id);
  for (let i = 0; i < ytIds.length; i += 50) {
    const batch = ytIds.slice(i, i + 50);
    const data = await ytJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(',')}&key=${YT}`);
    (data.items || []).forEach((it) => { vidToCh[it.id] = it.snippet?.channelId; });
  }

  // 2. channels.list → subs, thumbnail
  const chIds = [...new Set(Object.values(vidToCh).filter(Boolean))];
  const chMap = {};
  for (let i = 0; i < chIds.length; i += 50) {
    const batch = chIds.slice(i, i + 50);
    const data = await ytJson(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${batch.join(',')}&key=${YT}`);
    (data.items || []).forEach((c) => {
      chMap[c.id] = {
        subs: c.statistics?.hiddenSubscriberCount ? null : parseInt(c.statistics?.subscriberCount) || null,
        thumb: c.snippet?.thumbnails?.default?.url || c.snippet?.thumbnails?.medium?.url || null,
      };
    });
  }

  // 3. update
  for (const v of vids) {
    const chId = vidToCh[v.youtube_video_id] || null;
    const info = chId ? chMap[chId] : null;
    await sql`UPDATE affiliate_videos SET
      channel_id = ${chId},
      subscriber_count = ${info?.subs ?? null},
      channel_thumbnail = ${info?.thumb ?? null}
      WHERE id = ${v.id}`;
    console.log(`  · ${v.youtube_video_id} → 구독 ${info?.subs ?? '-'}`);
  }
  console.log('완료');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
