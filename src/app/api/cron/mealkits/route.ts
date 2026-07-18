import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60; // Vercel: 최대 실행 시간(초)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

// 수집 파라미터
const SEARCH_QUERIES = ['밀키트 리뷰', '밀키트 추천', '밀키트 먹방', '밀키트 언박싱', '밀키트 내돈내산', '밀키트 요리'];
const PUBLISHED_WITHIN_DAYS = 21;
const MIN_VIEWS = 10000; // 1만 미만 미수집 (조회수 최우선 정책)
const MAX_PER_CHANNEL = 2;
const MAX_NEW_VIDEOS = 15; // 신규 추출 상한 (평시값 — 대량 backfill 시 일시 상향)

// 밀키트 전용 카테고리 (간편식 제외 — 쇼핑탭은 밀키트만 취급)
const MEALKIT_CATEGORIES = ['고기·구이', '국물·탕', '면·파스타', '분식', '해산물', '캠핑용', '홈파티', '야식', '다이어트'];

// ISO8601 duration(PT#H#M#S) → 초
function durationToSeconds(iso: string): number {
  const m = (iso || 'PT0S').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

function hoursSince(iso: string): number {
  const t = new Date(iso).getTime();
  return Math.max((Date.now() - t) / 3.6e6, 1);
}

function coupangSearchUrl(q: string) {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(q)}`;
}
function naverSearchUrl(q: string) {
  return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`;
}

// 네이버 쇼핑 검색 — 실제 최저가·상품링크·이미지 (기존 NAVER_CLIENT_ID/SECRET 재사용)
async function naverShopSearch(query: string): Promise<{ price: number | null; link: string | null; image: string | null }> {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return { price: null, link: null, image: null };
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=1&sort=sim`,
      { headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret } }
    );
    if (!res.ok) return { price: null, link: null, image: null };
    const data = await res.json();
    const it = data.items?.[0];
    if (!it) return { price: null, link: null, image: null };
    return { price: parseInt(it.lprice) || null, link: it.link || null, image: it.image || null };
  } catch {
    return { price: null, link: null, image: null };
  }
}

// YouTube search.list — 후보 videoId 수집
async function discoverVideoIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const publishedAfter = new Date(Date.now() - PUBLISHED_WITHIN_DAYS * 864e5).toISOString();
  for (const q of SEARCH_QUERIES) {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'video');
    url.searchParams.set('order', 'viewCount');
    url.searchParams.set('relevanceLanguage', 'ko');
    url.searchParams.set('regionCode', 'KR');
    url.searchParams.set('videoDuration', 'medium'); // 4~20분 (쇼츠 배제)
    url.searchParams.set('publishedAfter', publishedAfter);
    url.searchParams.set('maxResults', '25');
    url.searchParams.set('key', YOUTUBE_API_KEY!);
    const res = await fetch(url);
    const data = await res.json();
    (data.items || []).forEach((it: any) => { if (it.id?.videoId) ids.add(it.id.videoId); });
  }
  return ids;
}

// channels.list — 크리에이터 구독자수·프로필 (권위 배지용)
async function enrichChannels(channelIds: string[]): Promise<Record<string, { subs: number | null; thumb: string | null }>> {
  const out: Record<string, { subs: number | null; thumb: string | null }> = {};
  const uniq = [...new Set(channelIds.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 50) {
    const batch = uniq.slice(i, i + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'snippet,statistics');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('key', YOUTUBE_API_KEY!);
    try {
      const res = await fetch(url);
      const data = await res.json();
      (data.items || []).forEach((c: any) => {
        out[c.id] = {
          subs: c.statistics?.hiddenSubscriberCount ? null : parseInt(c.statistics?.subscriberCount) || null,
          thumb: c.snippet?.thumbnails?.default?.url || c.snippet?.thumbnails?.medium?.url || null,
        };
      });
    } catch { /* 채널 보강 실패는 무시 */ }
  }
  return out;
}

// videos.list — 통계·길이·설명 보강 (50개씩 배치)
async function enrichVideos(ids: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,statistics,contentDetails');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('key', YOUTUBE_API_KEY!);
    const res = await fetch(url);
    const data = await res.json();
    (data.items || []).forEach((v: any) => out.push(v));
  }
  return out;
}

// Gemini — 제목+설명에서 밀키트 상품 추출 (환각 방지: 근거 인용 필수)
async function extractProducts(title: string, description: string, viewCount?: number | null, subscriberCount?: number | null): Promise<{ category: string | null; products: any[] }> {
  const prompt = `너는 밀키트 리뷰·먹방 영상에서 소개된 "밀키트/간편식 상품"을 추출하고, 각 상품의 신뢰도를 평가하는 AI다.
아래 영상의 제목·설명·지표를 근거로, 실제 언급된 밀키트 상품만 추출해라.
추론·창작 금지 — 원문에서 근거(evidence)를 인용할 수 없으면 넣지 마라.

제목: ${title}
설명: ${(description || '').substring(0, 1800)}
영상 조회수: ${viewCount ?? '알수없음'}
채널 구독자수: ${subscriberCount ?? '알수없음'}

[추출 규칙]
- 제품명이 명확하면 그대로 추출한다.
- 브랜드는 명확하나 제품명이 두루뭉술하면(예: "야식이 밀키트") 브랜드 + 간단한 종류로 추출하되 confidence를 낮게 매긴다.
- "밀키트"만 막연히 나오고 브랜드·제품명 단서가 전혀 없으면 넣지 않는다.
- product_name에는 브랜드를 빼고, brand에 제조사/판매처를 넣는다(모르면 빈 문자열).

[confidence — 추출 확신도 0.0~1.0]
- 0.8~1.0: 브랜드와 제품명이 명확히 표기됨 / 0.5~0.7: 브랜드만 명확 / 0.3~0.4: 단서 약함

[maker_type — 제조 주체]
- chef: 유명 셰프가 만들거나 이름을 건 밀키트
- restaurant: 특정 맛집/식당이 직접 만든 밀키트 (예: "○○식당 시그니처 밀키트")
- manufacturer: 프레시지·CJ 등 식품 제조사의 대량 생산 제품
- unknown: 판단 불가

[trust_score — 밀키트 신뢰도 0~100]
**가장 중요한 요소는 영상 조회수다 (사회적 증거).** 먼저 조회수 구간으로 기본 점수를 정해라:
- 100만 이상: 90~100
- 50만~100만: 80~90
- 10만~50만: 65~80
- 3만~10만: 50~65
- 1만~3만: 35~50
그 다음 보조 요소로 소폭 가감한다:
- 셰프/식당 직접 제조(chef/restaurant)면 가산, 대량 제조사(manufacturer)/불명(unknown)은 가산 없음
- 채널 구독자수 많음·1인칭 직접 후기(내돈내산)·구체 정보(가격/조리법)면 가산
- 정보가 빈약하면 감산
(보조 가감은 기본 점수 대비 ±15점 이내로 제한한다)

[coupang_available — 쿠팡 구매 가능 추정]
우리는 쿠팡파트너스로만 구매를 연계하므로, 쿠팡에서 살 수 없는 제품은 소용이 없다.
- 대부분의 시판 밀키트는 쿠팡에서도 살 수 있으므로 기본값은 true.
- 다음처럼 특정 플랫폼 전용이 명확하면 false로 둔다:
  · 마켓컬리·오아시스·SSG 등의 자체 PB/단독 상품 ("컬리 전용", "컬리에서만", "Kurly's" 등)
  · 특정 식당·브랜드 자사몰에서만 파는 직판 제품 ("○○몰에서만 구매 가능")
- 애매하면 true로 둔다 (보수적으로).

각 상품에 대해 아래 JSON으로만 응답하라:
{
  "category": "추출된 상품이 속하는 종류 하나를 다음에서 고른다: ${MEALKIT_CATEGORIES.join(', ')}. 확실히 해당하는 게 없거나 상품이 없으면 빈 문자열로 둔다(억지로 고르지 말 것).",
  "products": [
    {
      "product_name": "브랜드를 제외한 제품명",
      "brand": "브랜드/제조사 (모르면 빈 문자열)",
      "subtitle": "설명에 근거한 한 줄 특징 (없으면 빈 문자열, 창작 금지)",
      "mention_time": "타임스탬프 mm:ss (설명에 있으면, 없으면 빈 문자열)",
      "maker_type": "chef | restaurant | manufacturer | unknown 중 하나",
      "maker_name": "셰프명 또는 식당명 (chef/restaurant일 때, 없으면 빈 문자열)",
      "confidence": 0.0~1.0,
      "trust_score": 0~100,
      "coupang_available": true 또는 false,
      "evidence": "이 상품이 언급된 제목/설명의 원문 인용 (필수)"
    }
  ]
}
상품이 하나도 명시되지 않았으면 products는 빈 배열로, category도 빈 문자열로 둬라.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    .replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(text);
  return { category: parsed.category || null, products: Array.isArray(parsed.products) ? parsed.products : [] };
}

async function runCollection() {
  const summary = { discovered: 0, candidates: 0, skippedExisting: 0, skippedNonCoupang: 0, inserted: 0, products: 0, errors: [] as string[] };

  // 1. 발견
  const idSet = await discoverVideoIds();
  summary.discovered = idSet.size;
  if (idSet.size === 0) return summary;

  // 2. 보강 + 필터
  const enriched = await enrichVideos([...idSet]);
  const perChannel: Record<string, number> = {};
  const candidates = enriched
    .map((v: any) => {
      const s = v.snippet, st = v.statistics, cd = v.contentDetails;
      const views = +(st?.viewCount || 0);
      const dur = durationToSeconds(cd?.duration);
      const text = `${s?.title || ''} ${s?.description || ''}`;
      return {
        youtube_video_id: v.id,
        title: s?.title || '',
        description: s?.description || '',
        channel_title: s?.channelTitle || '',
        channel_id: s?.channelId || '',
        published_at: s?.publishedAt || null,
        view_count: views,
        thumbnail_url: s?.thumbnails?.high?.url || s?.thumbnails?.medium?.url || null,
        _dur: dur,
        _mealkit: text.includes('밀키트'),
        _score: views / hoursSince(s?.publishedAt),
      };
    })
    .filter((v) => v._dur > 60 && v.view_count >= MIN_VIEWS && v._mealkit)
    .sort((a, b) => b._score - a._score)
    .filter((v) => {
      perChannel[v.channel_id] = (perChannel[v.channel_id] || 0) + 1;
      return perChannel[v.channel_id] <= MAX_PER_CHANNEL;
    });
  summary.candidates = candidates.length;

  // 3. 이미 수집된 영상 제외 (승인 상태 보존 + Gemini 비용 절약)
  const candIds = candidates.map((c) => c.youtube_video_id);
  const { data: existing } = await supabase
    .from('affiliate_videos')
    .select('youtube_video_id')
    .in('youtube_video_id', candIds);
  const existingSet = new Set((existing || []).map((e: any) => e.youtube_video_id));
  const fresh = candidates.filter((c) => !existingSet.has(c.youtube_video_id)).slice(0, MAX_NEW_VIDEOS);
  summary.skippedExisting = candidates.length - fresh.length;

  // 채널 구독자수·프로필 일괄 보강
  const chMap = await enrichChannels(fresh.map((f) => f.channel_id));

  // 4. 추출 + 적재 (영상별 격리 — 하나 실패해도 배치 지속)
  for (const v of fresh) {
    try {
      const { category, products } = await extractProducts(v.title, v.description, v.view_count, chMap[v.channel_id]?.subs ?? null);

      // 쿠팡 구매 불가(컬리 등 특정 플랫폼 전용) 제품 제외. 영상의 모든 상품이 제외되면 영상 자체를 건너뜀.
      const extracted = products.filter((p: any) => p.product_name);
      const linkable = extracted.filter((p: any) => p.coupang_available !== false);
      if (extracted.length > 0 && linkable.length === 0) {
        summary.skippedNonCoupang += 1;
        continue;
      }

      const { data: vid, error: vErr } = await supabase
        .from('affiliate_videos')
        .insert({
          youtube_video_id: v.youtube_video_id,
          title: v.title,
          description: v.description,
          thumbnail_url: v.thumbnail_url,
          channel_title: v.channel_title,
          channel_id: v.channel_id,
          subscriber_count: chMap[v.channel_id]?.subs ?? null,
          channel_thumbnail: chMap[v.channel_id]?.thumb ?? null,
          view_count: v.view_count,
          published_at: v.published_at,
          category,
          status: 'pending',
        })
        .select('id')
        .single();
      if (vErr) throw vErr;

      const now = new Date().toISOString();
      const rows = await Promise.all(
        linkable
          .map(async (p: any) => {
            const q = `${p.brand || ''} ${p.product_name}`.trim();
            const nv = await naverShopSearch(q); // 실제 최저가·상품링크·이미지
            return {
              video_id: vid.id,
              product_name: p.product_name,
              brand: p.brand || null,
              subtitle: p.subtitle || null,
              coupang_url: coupangSearchUrl(q),
              naver_url: nv.link || naverSearchUrl(q),
              search_url: coupangSearchUrl(q), // 하위호환(NOT NULL)
              platform: 'coupang',
              price: nv.price,
              price_checked_at: nv.price ? now : null,
              thumbnail_url: nv.image || null,
              mention_time: p.mention_time || null,
              confidence: typeof p.confidence === 'number' ? p.confidence : null,
              trust_score: typeof p.trust_score === 'number' ? Math.round(p.trust_score) : null,
              maker_type: p.maker_type || null,
              maker_name: p.maker_name || null,
              evidence: p.evidence || null,
            };
          })
      );
      if (rows.length > 0) {
        const { error: pErr } = await supabase.from('affiliate_products').insert(rows);
        if (pErr) throw pErr;
        summary.products += rows.length;

        // 영상 최저가 = 상품 가격 최솟값
        const prices = rows.map((r) => r.price).filter((x): x is number => typeof x === 'number');
        if (prices.length > 0) {
          await supabase.from('affiliate_videos').update({ min_price: Math.min(...prices) }).eq('id', vid.id);
        }
      }
      summary.inserted += 1;
    } catch (e: any) {
      summary.errors.push(`${v.youtube_video_id}: ${e.message}`);
    }
  }

  return summary;
}

export async function GET(req: NextRequest) {
  // 인증: CRON_SECRET이 설정돼 있으면 Bearer 헤더 또는 ?secret= 요구
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    const qs = req.nextUrl.searchParams.get('secret');
    if (auth !== `Bearer ${CRON_SECRET}` && qs !== CRON_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  if (!YOUTUBE_API_KEY || !GEMINI_API_KEY) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY / GEMINI_API_KEY 미설정' }, { status: 500 });
  }
  try {
    const summary = await runCollection();
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    console.error('mealkit cron error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
