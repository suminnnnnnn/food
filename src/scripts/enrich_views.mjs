// 영상 조회수(view_count) 백필 — videos.list statistics (검색 쿼터 아님, 저렴). 리뷰 크리에이터 링 조회수 배지용.
// 실행: node --env-file=.env.local src/scripts/enrich_views.mjs
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const YT = process.env.YOUTUBE_API_KEY;

async function main() {
  const { data: vids } = await supabase.from('videos').select('id, youtube_video_id, view_count');
  const need = (vids || []).filter(v => v.youtube_video_id && (!v.view_count || v.view_count === 0));
  console.log(`👁 조회수 백필 — 대상 ${need.length}/${(vids || []).length}`);
  let filled = 0;
  for (let i = 0; i < need.length; i += 50) {
    const batch = need.slice(i, i + 50);
    try {
      const data = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${YT}&id=${batch.map(v => v.youtube_video_id).join(',')}&part=statistics`)).json();
      if (data.error) { console.log('  ⚠️ videos.list:', data.error.message); break; }
      const map = {};
      (data.items || []).forEach(it => { map[it.id] = parseInt(it.statistics?.viewCount) || null; });
      for (const v of batch) {
        const vc = map[v.youtube_video_id];
        if (vc != null) { await supabase.from('videos').update({ view_count: vc }).eq('id', v.id); filled++; }
      }
    } catch (e) { console.log('  ⚠️', e.message); }
  }
  console.log(`✅ 조회수 ${filled}개 채움`);
  process.exit(0);
}
main();
