import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../lib/admin-auth';

// head:true count 쿼리 — 데이터 전송 없이 개수만
async function count(table: string, filter?: (q: any) => any): Promise<number> {
  let q: any = adminSupabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count || 0;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const [
      mkPending, mkApproved, mkRejected, products,
      restaurants, published, videos, channels,
      subPending, subHeld,
    ] = await Promise.all([
      count('affiliate_videos', (q) => q.eq('status', 'pending')),
      count('affiliate_videos', (q) => q.eq('status', 'approved')),
      count('affiliate_videos', (q) => q.eq('status', 'rejected')),
      count('affiliate_products'),
      count('restaurants'),
      count('restaurants', (q) => q.eq('is_published', true)),
      count('videos'),
      count('channels'),
      count('user_submissions', (q) => q.eq('status', 'pending')),
      count('user_submissions', (q) => q.eq('status', 'held')),
    ]);

    return NextResponse.json({
      mealkits: { pending: mkPending, approved: mkApproved, rejected: mkRejected, products },
      content: { restaurants, published, videos, channels },
      submissions: { pending: subPending, held: subHeld },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
