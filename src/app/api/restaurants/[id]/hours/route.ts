import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
  (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
);

// 이용자 영업시간 제보 — 즉시 반영하되 출처를 'user'(이용자 제보)로 표기해 공식 정보와 구분.
// 법적 리스크 완화: '이용자 제보' 라벨 + 정정/신고 창구로 상시 수정 가능.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const hours = typeof body.business_hours === 'string' ? body.business_hours.trim().slice(0, 300) : '';
    if (!hours) {
      return NextResponse.json({ error: '영업시간을 입력해 주세요' }, { status: 400 });
    }
    const { error } = await supabase
      .from('restaurants')
      .update({ business_hours: hours, business_hours_source: 'user' })
      .eq('id', id);
    if (error) throw error;

    // 감사/검수용 기록(있을 때만; 실패해도 본 반영에는 영향 없음)
    try {
      await supabase.from('restaurant_info_suggestions').insert({ restaurant_id: id, business_hours: hours, status: 'applied' });
    } catch { /* noop */ }

    return NextResponse.json({ ok: true, business_hours: hours });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
