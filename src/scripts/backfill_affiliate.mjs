// 기존 affiliate_* 데이터 보강 (일회성):
//  - 상품: 네이버 쇼핑 검색으로 실제 최저가·상품링크·이미지, 쿠팡/네이버 URL 채움
//  - 영상: Gemini로 밀키트 카테고리 재분류(간편식→구체 분류), 최저가 집계
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;
const GEMINI = process.env.GEMINI_API_KEY;
const MEALKIT_CATEGORIES = ['고기·구이', '국물·탕', '면·파스타', '분식', '해산물', '캠핑용', '홈파티', '야식', '다이어트'];

const coupangSearchUrl = (q) => `https://www.coupang.com/np/search?q=${encodeURIComponent(q)}`;
const naverSearchUrl = (q) => `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`;

async function naverShop(query) {
  if (!NAVER_ID || !NAVER_SECRET) return { price: null, link: null, image: null };
  try {
    const res = await fetch(`https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=1&sort=sim`, {
      headers: { 'X-Naver-Client-Id': NAVER_ID, 'X-Naver-Client-Secret': NAVER_SECRET },
    });
    if (!res.ok) return { price: null, link: null, image: null };
    const data = await res.json();
    const it = data.items?.[0];
    if (!it) return { price: null, link: null, image: null };
    return { price: parseInt(it.lprice) || null, link: it.link || null, image: it.image || null };
  } catch { return { price: null, link: null, image: null }; }
}

async function geminiCategory(title, description) {
  if (!GEMINI) return null;
  const prompt = `다음 밀키트 리뷰 영상의 종류를 아래 목록 중 하나로만 골라 정확히 그 단어만 답하라.
목록: ${MEALKIT_CATEGORIES.join(', ')}
제목: ${title}
설명: ${(description || '').substring(0, 600)}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    return MEALKIT_CATEGORIES.find((c) => text.includes(c)) || null;
  } catch { return null; }
}

try {
  const now = new Date().toISOString();

  const products = await sql`SELECT id, product_name, brand FROM affiliate_products`;
  console.log(`상품 ${products.length}건 보강…`);
  for (const p of products) {
    const q = `${p.brand || ''} ${p.product_name}`.trim();
    const nv = await naverShop(q);
    await sql`UPDATE affiliate_products SET
      coupang_url = ${coupangSearchUrl(q)},
      naver_url = ${nv.link || naverSearchUrl(q)},
      search_url = ${coupangSearchUrl(q)},
      price = ${nv.price},
      price_checked_at = ${nv.price ? now : null},
      thumbnail_url = COALESCE(${nv.image}, thumbnail_url)
      WHERE id = ${p.id}`;
    console.log(`  · ${q} → ${nv.price ? nv.price + '원' : '가격없음'}`);
  }

  const videos = await sql`SELECT id, title, description FROM affiliate_videos`;
  console.log(`영상 ${videos.length}건 재분류…`);
  for (const v of videos) {
    const cat = await geminiCategory(v.title, v.description);
    const [{ min }] = await sql`SELECT min(price)::int AS min FROM affiliate_products WHERE video_id = ${v.id}`;
    await sql`UPDATE affiliate_videos SET category = COALESCE(${cat}, category), min_price = ${min} WHERE id = ${v.id}`;
    console.log(`  · ${v.title.substring(0, 24)} → ${cat || '(유지)'} / 최저 ${min ?? '-'}`);
  }
  console.log('완료');
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
  process.exit(0);
}
