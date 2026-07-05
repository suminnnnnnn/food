import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../../lib/admin-auth';

// 승인/반려 (status 변경). min_price 등 수기 보정도 허용.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const patch: Record<string, any> = {};
    if (body.status && ['pending', 'approved', 'rejected'].includes(body.status)) patch.status = body.status;
    if (typeof body.category === 'string') patch.category = body.category;
    if (typeof body.min_price === 'number') patch.min_price = body.min_price;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: '변경할 필드가 없습니다' }, { status: 400 });
    }

    const { error } = await adminSupabase.from('affiliate_videos').update(patch).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 반려·오수집 영상 삭제 (products는 FK CASCADE 가정, 아니면 별도 삭제)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    await adminSupabase.from('affiliate_products').delete().eq('video_id', id);
    const { error } = await adminSupabase.from('affiliate_videos').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
