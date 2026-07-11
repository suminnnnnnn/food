import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
  (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
);

const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null);

// 이용자 정보 수정 제안 (영업시간·메뉴·전화 등). 검수 후 반영.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const row = {
      restaurant_id: id,
      business_hours: clean(body.business_hours),
      menu_info: clean(body.menu_info),
      phone: clean(body.phone),
      note: clean(body.note),
    };
    if (!row.business_hours && !row.menu_info && !row.phone && !row.note) {
      return NextResponse.json({ error: '제안 내용을 입력해 주세요' }, { status: 400 });
    }
    const { error } = await supabase.from('restaurant_info_suggestions').insert(row);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
