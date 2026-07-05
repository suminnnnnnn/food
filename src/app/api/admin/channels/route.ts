import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../lib/admin-auth';

// 채널 목록 — 이름 검색(q)
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = (req.nextUrl.searchParams.get('q') || '').trim();
  const q = raw.replace(/[%,()]/g, ' ').trim();
  try {
    let query = adminSupabase
      .from('channels')
      .select('id, youtube_channel_id, name, profile_image_url, subscriber_count')
      .order('subscriber_count', { ascending: false, nullsFirst: false })
      .limit(50);
    if (q) query = query.ilike('name', `%${q}%`);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
