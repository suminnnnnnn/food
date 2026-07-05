import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../lib/admin-auth';

// 맛집 목록 — 검색(q) + 발행필터(published=all|true|false) + 연결영상 수
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = (req.nextUrl.searchParams.get('q') || '').trim();
  const q = raw.replace(/[%,()]/g, ' ').trim(); // .or() 필터 인젝션/파싱 안전
  const published = req.nextUrl.searchParams.get('published');
  try {
    let query = adminSupabase
      .from('restaurants')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (q) query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,address.ilike.%${q}%`);
    if (published === 'true') query = query.eq('is_published', true);
    if (published === 'false') query = query.eq('is_published', false);

    const { data, error } = await query;
    if (error) throw error;

    const ids = (data || []).map((r: any) => r.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: rv } = await adminSupabase.from('restaurant_videos').select('restaurant_id').in('restaurant_id', ids);
      (rv || []).forEach((x: any) => { counts[x.restaurant_id] = (counts[x.restaurant_id] || 0) + 1; });
    }
    return NextResponse.json({ data: (data || []).map((r: any) => ({ ...r, video_count: counts[r.id] || 0 })) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
