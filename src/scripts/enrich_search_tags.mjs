// 검색용 태그 생성 배치 — 사용자 규칙(지역/방송/랜드마크/음식/상황)으로 restaurants.tags(text[]) 채우기.
// 사용법: node src/scripts/enrich_search_tags.mjs            (tags 비어있는 것만)
//        FORCE=1 node ...                                   (전체 재생성)
//        ENRICH_LIMIT=5 node ...                            (개수 제한)
import postgres from 'postgres';
import fs from 'fs';
import { pathToFileURL } from 'url';

const env = fs.readFileSync('C:/modoo-matjip/food-feat-rebranding-modoo-matjip/.env.local', 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const KEY = process.env.GEMINI_API_KEY;
const FORCE = process.env.FORCE === '1';
const LIMIT = process.env.ENRICH_LIMIT ? parseInt(process.env.ENRICH_LIMIT, 10) : null;
const CONCURRENCY = 3;

export const SEARCH_TAG_PROMPT = `당신은 한국 맛집 검색 태그 생성 전문가다. 입력된 식당 정보를 바탕으로, 사용자들이 어떤 표현으로 검색하든 이 식당이 노출되도록 검색용 태그 배열을 생성한다.
## 태그 생성 규칙
### 1. 지역 태그 (검색어 변형을 모두 포괄)
주소를 광역시/도 → 시/군/구 → 동/읍/면 순으로 분해하고, 각 지역명에 대해 아래 변형을 모두 생성한다.
- 공식 전체명 + "맛집" (예: 광주광역시맛집)
- 축약명 + "맛집" (예: 광주맛집)
- 행정구역 접미사 제거형 (예: 서구맛집)
- 구·동 단위 조합 (예: 광주서구맛집)
- "지역명 + 음식종류" 조합 (예: 광주삼겹살)
- 띄어쓰기 유무 두 버전 모두 포함 (예: "광주 맛집", "광주맛집")
### 2. 방송·유튜브 출연 태그 (media 필드에 값이 있을 때만)
media 배열의 각 프로그램/채널명에 대해:
- 프로그램명 원형 (예: 또간집, 최자로드)
- 프로그램명 + "맛집" (예: 또간집맛집, 최자로드맛집)
- "방송맛집", "TV맛집", "유튜브맛집" 등 상위 포괄어
- 지역명 + 프로그램명 조합 (예: 광주또간집)
- 별칭·구어체가 확실한 경우만 추가 (예: 성시경먹을텐데 → 먹을텐데)
※ media가 비어 있으면 이 섹션 태그는 하나도 생성하지 않는다. 출연 사실을 추측·환각하지 않는다.
### 3. 랜드마크 근접 태그 (nearby_landmarks 필드에 값이 있을 때만)
nearby_landmarks 배열의 각 랜드마크에 대해:
- 랜드마크 정식명 + "맛집" / 통용 약칭 + "맛집" / +"근처맛집"/"주변맛집" / 성격 기반 상황어 / 지역명+랜드마크 조합
※ 통용 약칭이 확실할 때만 쓰고, 불확실하면 정식명만. 근접 여부를 추측하지 않는다.
### 4. 음식·메뉴 태그
- 카테고리 상위어/하위어 (예: 일식 → 일식/스시/오마카세)
- 대표 메뉴명 + 동의어·구어체 (예: 삼겹살/생삼겹/돼지고기)
- 대표 메뉴 + 지역 조합
### 5. 상황·목적 태그 (description·category에서 추론, 근거 있을 때만)
데이트, 회식, 혼밥, 가족모임, 단체, 룸, 주차가능, 심야, 브런치, 분위기좋은, 가성비, 노포, 웨이팅, 기념일 등 해당하는 것만.
## 출력 규칙
- 순수 JSON 배열만 출력. 설명·마크다운·코드펜스 금지.
- 중복 제거, 최대 50개.
- 실제로 검색될 법한 자연스러운 한국어만. 억지 조합·환각 금지.
- media·nearby_landmarks에 값이 없으면 관련 태그를 절대 만들지 않는다.
- 확실하지 않은 지역/랜드마크/출연 이력은 생성하지 않는다.`;

// Kakao가 광주광역시를 "전남광주통합특별시"로 반환하는 이상 케이스 보정
function normalizeAddressForTags(addr) {
  if (!addr) return addr;
  return addr.replace(/전남\s*광주\s*통합특별시/g, '광주광역시');
}

export async function generateSearchTags(info) {
  const payload = { ...info, address: normalizeAddressForTags(info.address) };
  const prompt = `${SEARCH_TAG_PROMPT}\n\n[입력 식당 정보]\n${JSON.stringify(payload, null, 2)}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(d).slice(0, 300));
  const raw = d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  const m = raw.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(m ? m[0] : raw);
  // 정규화: 문자열만, trim, 이모지/# 제거, 공백정리, 중복 제거, 최대 50
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    if (typeof t !== 'string') continue;
    const n = t.replace(/[\p{Extended_Pictographic}️#]/gu, '').replace(/\s+/g, ' ').trim();
    if (n && !seen.has(n)) { seen.add(n); out.push(n); }
    if (out.length >= 50) break;
  }
  return out;
}

async function fetchMedia(id) {
  const rows = await sql`
    SELECT DISTINCT COALESCE(s.name, ch.name) AS m FROM restaurant_videos rv
    JOIN videos v ON v.id = rv.video_id
    LEFT JOIN series s ON s.id = v.series_id
    LEFT JOIN channels ch ON ch.id = v.channel_id
    WHERE rv.restaurant_id = ${id}`;
  return rows.map(x => x.m).filter(Boolean);
}

async function run() {
  let rows = await sql`
    SELECT id, name, address, category, menu_info, description_summary, tags
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
        const info = {
          name: r.name,
          address: r.address,
          category: r.category,
          menu: r.menu_info && r.menu_info !== '정보 없음' ? r.menu_info : null,
          description: r.description_summary || null,
          media,
          nearby_landmarks: [],
        };
        const tags = await generateSearchTags(info);
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

// 직접 실행일 때만 배치 수행 (import 시엔 함수만 노출)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
