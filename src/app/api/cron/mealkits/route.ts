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
const SEARCH_QUERIES = ['밀키트 리뷰', '밀키트 추천', '밀키트 먹방'];
const PUBLISHED_WITHIN_DAYS = 21;
const MIN_VIEWS = 3000;
const MAX_PER_CHANNEL = 2;
const MAX_NEW_VIDEOS = 8; // 하루 신규 추출 상한 (Gemini 비용·검수 부하 제어)

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
    url.searchParams.set('maxResults', '15');
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
async function extractProducts(title: string, description: string): Promise<{ category: string | null; products: any[] }> {
  const prompt = `너는 밀키트 리뷰 영상에서 소개된 "밀키트/간편식 상품"을 추출하는 AI다.
아래 영상의 제목과 설명에 **명시적으로 등장한 밀키트 상품만** 추출해라. 추론·창작 금지. 근거를 댈 수 없으면 넣지 마라.

제목: ${title}
설명: ${(description || '').substring(0, 1800)}

각 상품에 대해 아래 JSON으로만 응답하라:
{
  "category": "이 영상의 밀키트 종류 한 가지 (${MEALKIT_CATEGORIES.join(', ')} 중에서 가장 가까운 것)",
  "products": [
    {
      "product_name": "상품명 (브랜드 제외한 제품명)",
      "brand": "브랜드/제조사 (모르면 빈 문자열)",
      "subtitle": "한 줄 특징 (설명에 근거, 없으면 빈 문자열)",
      "mention_time": "타임스탬프 mm:ss (설명에 있으면, 없으면 빈 문자열)",
      "confidence": 0.0~1.0,
      "evidence": "이 상품이 언급된 제목/설명의 원문 인용 (필수)"
    }
  ]
}
상품이 하나도 명시되지 않았으면 products는 빈 배열로 둬라.`;

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
  const summary = { discovered: 0, candidates: 0, skippedExisting: 0, inserted: 0, products: 0, errors: [] as string[] };

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
      const { category, products } = await extractProducts(v.title, v.description);

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
        products
          .filter((p: any) => p.product_name)
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
