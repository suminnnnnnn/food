// 검색용 태그 생성 (지역/방송/랜드마크/음식/상황 변형) — 발견용, 표시 안 함.
// 배치 스크립트(src/scripts/enrich_search_tags.mjs)와 동일 규칙. 프롬프트 수정 시 양쪽 동기화.

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

export interface SearchTagInput {
  name: string;
  address: string | null;
  category?: string | null;
  menu?: string | null;
  description?: string | null;
  media?: string[];
  nearby_landmarks?: string[];
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Kakao가 광주광역시를 "전남광주통합특별시"로 반환하는 이상 케이스 보정 (검색어는 '광주맛집')
export function normalizeAddressForTags(addr: string | null): string | null {
  if (!addr) return addr;
  return addr.replace(/전남\s*광주\s*통합특별시/g, '광주광역시');
}

/** 식당 정보로 검색용 태그 배열 생성. 실패 시 빈 배열. */
export async function generateSearchTags(
  info: SearchTagInput,
  apiKey = process.env.GEMINI_API_KEY,
): Promise<string[]> {
  if (!apiKey) return [];
  const payload: SearchTagInput = {
    ...info,
    address: normalizeAddressForTags(info.address),
    media: info.media || [],
    nearby_landmarks: info.nearby_landmarks || [],
  };
  const prompt = `${SEARCH_TAG_PROMPT}\n\n[입력 식당 정보]\n${JSON.stringify(payload, null, 2)}`;
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const raw: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') || '';
  const match = raw.match(/\[[\s\S]*\]/);
  let arr: unknown;
  try {
    arr = JSON.parse(match ? match[0] : raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    if (typeof t !== 'string') continue;
    const n = t
      .replace(/[\p{Extended_Pictographic}️#]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
    if (out.length >= 50) break;
  }
  return out;
}
