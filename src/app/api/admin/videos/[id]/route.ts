import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../../lib/admin-auth';

const ALLOWED = ['title', 'is_short'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const patch: Record<string, any> = {};
    for (const k of ALLOWED) if (k in body) patch[k] = body[k];
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: '변경할 필드가 없습니다' }, { status: 400 });

    const { error } = await adminSupabase.from('videos').update(patch).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 영상 삭제 (restaurant_videos는 FK ON DELETE CASCADE)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const { error } = await adminSupabase.from('videos').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
