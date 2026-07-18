// 채널 프로필/구독자수 보강 (channels.list). 무위험. 재수집 체인 마지막에 실행해 구독자수 보장.
// 실행: node --env-file=.env.local src/scripts/enrich_channels.mjs
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const YT = process.env.YOUTUBE_API_KEY;

async function main() {
  const { data: chs } = await supabase.from('channels').select('id, youtube_channel_id, name');
  const list = (chs || []).filter(c => c.youtube_channel_id);
  console.log(`📺 채널 ${list.length}개 프로필/구독자 보강...`);
  let filled = 0;
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    let map = {};
    try {
      const data = await (await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${YT}&id=${batch.map(c => c.youtube_channel_id).join(',')}&part=snippet,statistics`)).json();
      if (data.error) console.log('  ⚠️ channels.list:', data.error.message);
      (data.items || []).forEach(it => {
        const th = it.snippet?.thumbnails;
        map[it.id] = { profile: th?.medium?.url || th?.default?.url || null, subs: it.statistics?.hiddenSubscriberCount ? null : (parseInt(it.statistics?.subscriberCount) || null) };
      });
    } catch (e) { console.log('  ⚠️', e.message); }
    for (const c of batch) {
      const m = map[c.youtube_channel_id];
      const profile = m?.profile || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || '채널')}&background=ff5e00&color=fff&bold=true&size=128&rounded=true`;
      await supabase.from('channels').update({ profile_image_url: profile, subscriber_count: m?.subs ?? null }).eq('id', c.id);
      if (m?.subs != null) filled++;
    }
  }
  console.log(`✅ 채널 보강 완료 (구독자수 ${filled}/${list.length})`);
  process.exit(0);
}
main();
