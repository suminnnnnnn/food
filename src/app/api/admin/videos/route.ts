import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../lib/admin-auth';

// 영상 목록 — 제목 검색(q) + 채널명 조인
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = (req.nextUrl.searchParams.get('q') || '').trim();
  const q = raw.replace(/[%,()]/g, ' ').trim();
  try {
    let query = adminSupabase
      .from('videos')
      .select('id, youtube_video_id, title, thumbnail_url, is_short, view_count, published_at, channel_id, channels(name, youtube_channel_id)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (q) query = query.ilike('title', `%${q}%`);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
