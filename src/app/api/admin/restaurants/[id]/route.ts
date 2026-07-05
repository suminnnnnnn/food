import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../../lib/admin-auth';

const ALLOWED = [
  'name', 'category', 'address', 'road_address', 'phone',
  'parking', 'packaging', 'reservation', 'business_hours', 'menu_info',
  'is_published', 'lat', 'lng',
];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const patch: Record<string, any> = {};
    for (const k of ALLOWED) if (k in body) patch[k] = body[k];
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: '변경할 필드가 없습니다' }, { status: 400 });

    const { error } = await adminSupabase.from('restaurants').update(patch).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 맛집 삭제 — 종속 레코드 정리 후 삭제 (FK 미cascade 대비 best-effort)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    for (const t of ['restaurant_videos', 'restaurant_curations', 'restaurant_embeddings', 'user_favorites']) {
      try { await adminSupabase.from(t).delete().eq('restaurant_id', id); } catch { /* 테이블 없거나 무관 시 무시 */ }
    }
    // 제보의 연결 해제 (삭제하지 않고 참조만 끊음)
    try { await adminSupabase.from('user_submissions').update({ resolved_restaurant_id: null }).eq('resolved_restaurant_id', id); } catch { /* noop */ }

    const { error } = await adminSupabase.from('restaurants').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
