import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase } from '../../../../lib/admin-auth';

// 제휴 클릭 로깅 (공개 엔드포인트 — 사용자 클릭 기록). fire-and-forget.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const event_type = ['click', 'conversion'].includes(body.event_type) ? body.event_type : 'click';

    const row = {
      product_id: typeof body.product_id === 'string' ? body.product_id : null,
      video_id: typeof body.video_id === 'string' ? body.video_id : null,
      event_type,
      platform: typeof body.platform === 'string' ? body.platform.slice(0, 40) : null,
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 80) : null,
      url: typeof body.url === 'string' ? body.url.slice(0, 2000) : null,
      referrer: (req.headers.get('referer') || '').slice(0, 2000) || null,
      session_id: typeof body.session_id === 'string' ? body.session_id.slice(0, 100) : null,
      user_agent: (req.headers.get('user-agent') || '').slice(0, 500) || null,
    };

    const { error } = await adminSupabase.from('mealkit_click_events').insert(row);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // 로깅 실패가 사용자 흐름을 막지 않도록 200으로 흡수
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}
