import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../lib/admin-auth';

// 제보 목록 (status별). resolved 식당명·발행상태 조인.
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status') || 'pending';
  try {
    let q = adminSupabase
      .from('user_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw error;

    // 연결된 식당 이름/발행상태 보강
    const restIds = [...new Set((data || []).map((s: any) => s.resolved_restaurant_id).filter(Boolean))];
    const restMap: Record<string, any> = {};
    if (restIds.length) {
      const { data: rests } = await adminSupabase
        .from('restaurants')
        .select('id,name,is_published')
        .in('id', restIds);
      (rests || []).forEach((r: any) => { restMap[r.id] = r; });
    }

    const enriched = (data || []).map((s: any) => ({
      ...s,
      resolved_restaurant: s.resolved_restaurant_id ? restMap[s.resolved_restaurant_id] || null : null,
    }));
    return NextResponse.json({ data: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
