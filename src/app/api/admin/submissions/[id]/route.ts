import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, adminSupabase } from '../../../../../lib/admin-auth';

// 상태 변경 — 반려/보류/대기복원만 허용.
// 'approved'는 식당 생성·영상연계 인제스천이 필요하므로 여기서 처리하지 않고
// /api/review (force 옵션)로 승인해야 함.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const patch: Record<string, any> = {};
    if (body.status && ['pending', 'held', 'rejected'].includes(body.status)) patch.status = body.status;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "변경할 필드가 없습니다 ('approved'는 AI 심사/강제 승인으로 처리하세요)" },
        { status: 400 },
      );
    }

    const { error } = await adminSupabase.from('user_submissions').update(patch).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 제보 삭제 (submission_reviews는 FK ON DELETE CASCADE). 연결된 식당은 삭제하지 않음.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const { error } = await adminSupabase.from('user_submissions').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
