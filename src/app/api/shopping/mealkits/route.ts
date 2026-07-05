import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

// view_count(int) → "124만" / "8,700" 표시 문자열
function formatViews(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (v >= 10000) return `${Math.floor(v / 10000)}만`;
  return v.toLocaleString('ko-KR');
}

// 원화 정수 → "24,000원" (없으면 null → 컴포넌트가 "가격 정보 준비 중"으로 표시)
function formatWon(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

// 가격 기준시각 → "7/4" (가격 변동 대비 기준일 표기)
function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export async function GET(req: NextRequest) {
  try {
    // 검수 통과(approved)한 영상만 노출
    const { data: videos, error: videoError } = await supabase
      .from('affiliate_videos')
      .select('*')
      .eq('status', 'approved')
      .order('published_at', { ascending: false })
      .limit(20);

    if (videoError) throw videoError;
    if (!videos || videos.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const videoIds = videos.map((v: any) => v.id);
    const { data: products, error: prodError } = await supabase
      .from('affiliate_products')
      .select('*')
      .in('video_id', videoIds);

    if (prodError) throw prodError;

    // DB 스키마 → 컴포넌트(AffiliateVideo/AffiliateProduct) 형태로 매핑·포맷팅
    // ⑥ 상품 중심 집계: 정규화 상품명이 여러 영상에 등장하면 사회적 증거
    const normKey = (brand: string, name: string) => `${brand || ''}${name || ''}`.toLowerCase().replace(/[\s\-()]/g, '');
    const nameCount: Record<string, number> = {};
    (products ?? []).forEach((p: any) => {
      const k = normKey(p.brand ?? '', p.product_name ?? '');
      nameCount[k] = (nameCount[k] || 0) + 1;
    });

    const result = videos.map((video: any) => ({
      id: video.id,
      youtube_video_id: video.youtube_video_id,
      title: video.title,
      description: video.description ?? null,
      channel_title: video.channel_title ?? '',
      channel_thumbnail: video.channel_thumbnail ?? null,
      subscriber_count: video.subscriber_count ?? null,
      view_count: video.view_count ?? 0,
      published_at: video.published_at ?? null,
      category: video.category ?? '기타',
      views: formatViews(video.view_count),
      min_price: formatWon(video.min_price),
      is_short: video.is_short ?? false,
      products: (products ?? [])
        .filter((p: any) => p.video_id === video.id)
        .map((p: any) => ({
          id: p.id,
          product_name: p.product_name,
          subtitle: p.subtitle ?? '',
          brand: p.brand ?? '',
          thumbnail_url: p.thumbnail_url ?? null,
          coupang_url: p.coupang_url ?? p.search_url ?? null,
          naver_url: p.naver_url ?? null,
          price: formatWon(p.price),
          price_date: formatDate(p.price_checked_at), // "7/4" 기준일
          badge: p.badge ?? undefined,
          timestamp: p.mention_time ?? undefined, // DB mention_time → 컴포넌트 timestamp
          also_count: nameCount[normKey(p.brand ?? '', p.product_name ?? '')] || 1,
        })),
    }));

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error fetching mealkits:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
