// 검색용 태그 생성 배치 — 지역/방송/음식(대분류)/상황 + 랜드마크 근접 태그로 restaurants.tags(text[]) 채우기.
// 프롬프트는 src/lib/searchTags.ts와 동일 유지(수정 시 양쪽 동기화).
// 사용법: node src/scripts/enrich_search_tags.mjs            (tags 비어있는 것만)
//        FORCE=1 node ...                                   (전체 재생성)
//        ENRICH_LIMIT=5 node ...                            (개수 제한)
//        ADDR_LIKE=전남광주 node ...                         (주소 부분일치 필터)
import postgres from 'postgres';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { nearbyLandmarkTags } from '../lib/landmarks.mjs';

const env = fs.readFileSync('C:/modoo-matjip/food-feat-rebranding-modoo-matjip/.env.local', 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const KEY = process.env.GEMINI_API_KEY;
const FORCE = process.env.FORCE === '1';
const LIMIT = process.env.ENRICH_LIMIT ? parseInt(process.env.ENRICH_LIMIT, 10) : null;
const CONCURRENCY = 3;

export const SEARCH_TAG_PROMPT = `당신은 한국 맛집 검색 태그 생성 전문가다. 입력된 식당 정보를 바탕으로, 사람들이 실제로 검색창에 입력할 법한 표현만 골라 검색용 태그 배열을 생성한다.
## 태그 생성 규칙
### 1. 지역 태그 (검색어 변형을 모두 포괄)
주소를 광역시/도 → 시/군/구 → 동/읍/면 순으로 분해하고, 각 지역명에 대해 아래 변형을 생성한다.
- 공식 전체명 + "맛집" / 축약명 + "맛집" / 행정구역 접미사 제거형 / 구·동 단위 조합 / "지역명 + 음식종류" 조합 / 띄어쓰기 유무 두 버전
- ※ "전남광주통합특별시"는 전남·광주 통합 행정명의 접두어다. 그 다음 토큰이 광주 5개 구(동구/서구/남구/북구/광산구)이면 광주 지역이므로 정식형("전남광주맛집")과 실제 검색되는 축약형("광주맛집","광주 맛집") 및 구 축약형(광산구맛집, 광산맛집)을 함께 생성한다. 반대로 다음 토큰이 여수시·담양군·순천시 등 전남 시·군이면 그 시·군명 기준으로만 태그를 만들고 '광주'는 붙이지 않는다.
### 2. 방송·유튜브 출연 태그 (media 필드에 값이 있을 때만)
media 배열의 각 프로그램/채널명에 대해: 프로그램명 원형 / +"맛집" / "방송맛집","TV맛집","유튜브맛집" 포괄어 / 지역명+프로그램명 / 확실한 별칭(성시경먹을텐데 → 먹을텐데).
※ media가 비어 있으면 이 섹션 태그는 하나도 생성하지 않는다. 출연 사실을 추측·환각하지 않는다.
### 3. 음식·메뉴 태그 — 반드시 대분류로
- 메뉴는 세부 수식어를 떼고 대표 상위 카테고리로만 만든다. 예: "마늘갈비"→"갈비", "투쁠한우"→"한우", "얼큰순대국"→"순대국", "묵은지김치찜"→"김치찜".
- 카테고리 상위어도 포함 (예: 갈비 → 고기, 한식 / 스시 → 일식).
- 대표 음식 + 지역 조합 (예: 광주갈비).
### 4. 상황·목적 태그 (근거 있을 때만)
- 실제 검색될 상황어만: 회식, 데이트, 혼밥, 가족모임, 단체, 룸, 주차, 심야, 브런치, 노포, 웨이팅, 기념일, 가성비 등. 근거가 명확할 때만.
## 절대 금지 (검색창에 아무도 안 치는 것)
- 식당명 자체 또는 식당명이 포함된 태그 금지 (사람들은 식당명을 직접 검색하므로 태그로 불필요).
- 가격/프로모션 금지 (예: "소주2000원", "무한리필5000원").
- 홍보·서술 문구 금지 (예: "입소문", "착한가격", "친절한사장님", "분위기좋은집").
- 특정 사이드/디테일 금지 (예: "계란후라이무제한", "라면사리무제한").
- 랜드마크 근접 태그는 시스템이 별도로 처리하므로 생성하지 않는다.
## 출력 규칙
- 순수 JSON 배열만 출력. 설명·마크다운·코드펜스 금지. 중복 제거, 최대 45개.
- 오직 지역·음식종류·방송/유튜브·상황어처럼 검색창에 칠 만한 자연스러운 한국어만. 억지·환각 금지.
- media에 값이 없으면 방송 태그 금지. 확실하지 않은 지역/출연 이력 금지.`;

const normalizeTag = (t) => t.replace(/[\p{Extended_Pictographic}️#]/gu, '').replace(/\s+/g, ' ').trim();

function isNameTag(tag, name) {
  const bare = (s) => s.replace(/\s+/g, '');
  const n = bare(name || '');
  if (n.length < 2) return false;
  return bare(tag).includes(n);
}

export async function generateSearchTags(info) {
  const landmarkTags = nearbyLandmarkTags(info.lat, info.lng);

  let aiTags = [];
  if (KEY) {
    const payload = {
      name: info.name, address: info.address, category: info.category ?? null,
      menu: info.menu ?? null, description: info.description ?? null, media: info.media || [],
    };
    const prompt = `${SEARCH_TAG_PROMPT}\n\n[입력 식당 정보]\n${JSON.stringify(payload, null, 2)}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(d).slice(0, 300));
    const raw = d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    const m = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(m ? m[0] : raw);
    if (Array.isArray(parsed)) aiTags = parsed.filter(t => typeof t === 'string');
  }

  const seen = new Set();
  const out = [];
  for (const t of [...aiTags, ...landmarkTags]) {
    const n = normalizeTag(t);
    if (!n || seen.has(n)) continue;
    if (isNameTag(n, info.name)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= 50) break;
  }
  return out;
}

async function fetchMedia(id) {
  // 방송·프로그램 시리즈명만 (또간집/먹을텐데 등). 개별 채널명은 검색어가 아니므로 제외.
  const rows = await sql`
    SELECT DISTINCT s.name AS m FROM restaurant_videos rv
    JOIN videos v ON v.id = rv.video_id
    JOIN series s ON s.id = v.series_id
    WHERE rv.restaurant_id = ${id} AND s.name IS NOT NULL`;
  return rows.map(x => x.m).filter(Boolean);
}

async function run() {
  let rows = await sql`
    SELECT id, name, address, category, menu_info, description_summary, lat, lng, tags
    FROM restaurants
    WHERE address IS NOT NULL AND address <> ''
    ORDER BY id`;
  if (!FORCE) rows = rows.filter(r => !r.tags || r.tags.length === 0);
  if (process.env.ADDR_LIKE) rows = rows.filter(r => (r.address || '').includes(process.env.ADDR_LIKE));
  if (LIMIT) rows = rows.slice(0, LIMIT);
  console.log(`대상 ${rows.length}곳 (FORCE=${FORCE})`);

  let ok = 0, fail = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (r) => {
      try {
        const media = await fetchMedia(r.id);
        const tags = await generateSearchTags({
          name: r.name,
          address: r.address,
          category: r.category,
          menu: r.menu_info && r.menu_info !== '정보 없음' ? r.menu_info : null,
          description: r.description_summary || null,
          media,
          lat: r.lat,
          lng: r.lng,
        });
        await sql`UPDATE restaurants SET tags = ${tags} WHERE id = ${r.id}`;
        ok++;
        console.log(`✓ ${r.name} → ${tags.length}개`);
      } catch (e) {
        fail++;
        console.log(`✗ ${r.name}: ${String(e.message || e).slice(0, 120)}`);
      }
    }));
  }
  console.log(`\n완료: 성공 ${ok}, 실패 ${fail}`);
  await sql.end();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
