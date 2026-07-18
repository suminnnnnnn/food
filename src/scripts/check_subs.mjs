import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const { data, error } = await s.from('restaurants')
  .select('id, restaurant_videos(videos(channel_id, channels(subscriber_count)))')
  .limit(6);
if (error) { console.log('ERR', error.message); }
else {
  data.forEach((r, i) => {
    const subs = (r.restaurant_videos || []).map(rv => rv.videos?.channels?.subscriber_count);
    console.log(`#${i} subs=${JSON.stringify(subs)}`);
  });
}
process.exit(0);
