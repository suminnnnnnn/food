import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../lib/admin-auth';

// "손봐야 할 것" 데이터 품질 카운트
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
      mkPending, prodNoPrice, prodNoCoupang,
      restUnpublished, restNoCoords,
      subPending, subHeld, shorts,
    ] = await Promise.all([
      count('affiliate_videos', (q) => q.eq('status', 'pending')),
      count('affiliate_products', (q) => q.is('price', null)),
      count('affiliate_products', (q) => q.is('coupang_url', null)),
      count('restaurants', (q) => q.eq('is_published', false)),
      count('restaurants', (q) => q.or('lat.is.null,lat.eq.0')),
      count('user_submissions', (q) => q.eq('status', 'pending')),
      count('user_submissions', (q) => q.eq('status', 'held')),
      count('videos', (q) => q.eq('is_short', true)),
    ]);

    return NextResponse.json({
      flags: [
        { key: 'mkPending', label: '밀키트 검수 대기', value: mkPending, href: '/admin/mealkits', warn: mkPending > 0 },
        { key: 'subPending', label: '제보 검수 대기', value: subPending, href: '/admin/submissions', warn: subPending > 0 },
        { key: 'subHeld', label: '제보 보류', value: subHeld, href: '/admin/submissions', warn: subHeld > 0 },
        { key: 'prodNoPrice', label: '가격 없는 제휴상품', value: prodNoPrice, href: '/admin/mealkits', warn: prodNoPrice > 0 },
        { key: 'prodNoCoupang', label: '쿠팡링크 없는 상품', value: prodNoCoupang, href: '/admin/mealkits', warn: prodNoCoupang > 0 },
        { key: 'restUnpublished', label: '미발행 맛집', value: restUnpublished, href: '/admin/restaurants', warn: false },
        { key: 'restNoCoords', label: '좌표 없는 맛집', value: restNoCoords, href: '/admin/restaurants', warn: restNoCoords > 0 },
        { key: 'shorts', label: '쇼츠 영상', value: shorts, href: '/admin/videos', warn: false },
      ],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
