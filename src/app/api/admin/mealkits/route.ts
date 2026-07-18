import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../lib/admin-auth';

// 검수 대기(및 선택적으로 전체) 목록
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status') || 'pending';
  try {
    const query = adminSupabase
      .from('affiliate_videos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status !== 'all') query.eq('status', status);

    const { data: videos, error } = await query;
    if (error) throw error;
    if (!videos || videos.length === 0) return NextResponse.json({ data: [] });

    const ids = videos.map((v: any) => v.id);
    const { data: products } = await adminSupabase.from('affiliate_products').select('*').in('video_id', ids);

    const data = videos.map((v: any) => ({
      ...v,
      products: (products || []).filter((p: any) => p.video_id === v.id),
    }));
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
