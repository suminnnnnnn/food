import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../lib/admin-auth';

const DAY = 864e5;

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const now = Date.now();
    const since = new Date(now - 30 * DAY).toISOString();

    const { count: total } = await adminSupabase
      .from('mealkit_click_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'click');

    const { data: ev, error } = await adminSupabase
      .from('mealkit_click_events')
      .select('product_id, platform, created_at')
      .eq('event_type', 'click')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;

    const rows = ev || [];
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    let last7 = 0, today = 0;
    const byPlatform: Record<string, number> = {};
    const byDayMap: Record<string, number> = {};
    const byProduct: Record<string, number> = {};

    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      if (now - t <= 7 * DAY) last7++;
      if (t >= startOfToday.getTime()) today++;
      const p = r.platform || 'unknown';
      byPlatform[p] = (byPlatform[p] || 0) + 1;
      const d = new Date(r.created_at);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      byDayMap[key] = (byDayMap[key] || 0) + 1;
      if (r.product_id) byProduct[r.product_id] = (byProduct[r.product_id] || 0) + 1;
    }

    const byDay: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      byDay.push({ date: key, count: byDayMap[key] || 0 });
    }

    const topIds = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 8);
    let topProducts: { id: string; count: number; name: string; brand: string }[] = [];
    if (topIds.length) {
      const { data: prods } = await adminSupabase
        .from('affiliate_products')
        .select('id, product_name, brand')
        .in('id', topIds.map(([id]) => id));
      const pm: Record<string, any> = {};
      (prods || []).forEach((p: any) => { pm[p.id] = p; });
      topProducts = topIds.map(([id, c]) => ({ id, count: c as number, name: pm[id]?.product_name || '(삭제된 상품)', brand: pm[id]?.brand || '' }));
    }

    return NextResponse.json({ total: total || 0, today, last7, last30: rows.length, byPlatform, byDay, topProducts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
