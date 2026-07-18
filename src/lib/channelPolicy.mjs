// 채널/콘텐츠 화이트리스트 정책 (하이브리드 게이트의 1차 결정론 레이어).
// verdict: 'allow' | 'block' | 'gray'(=LLM tasting_review_score로 최종 판정)
// 기준: 맛집 전문 채널·미식 코너만. 방송사(종합)·예능·기업·자체계정·ASMR먹방·쇼츠 제외. 대식가는 허용.

const norm = (s) => (s || '').toLowerCase().replace(/[\s　]/g, '').replace(/[^0-9a-z가-힣]/g, '');

// ── 전국 대표 미식 채널·코너 (인지도 높은 브랜드) ──
const ALLOW_NATIONAL = [
  '또간집', '먹을텐데', '성시경', '최자로드', '쯔양', 'tzuyang', '히밥', 'heebab',
  '정육왕', 'meatcreator', '입짧은햇님', '김사원세끼', '맛있는녀석들', '백종원', 'paikjongwon',
];

// ── 광주 데이터의 허용 채널(인기·미식 전문) ──
const ALLOW_LOCAL = [
  '애주가tv참pd', '더들리', '맛상무', '맛있겠다yummy', '잡솨', '회사랑', 'rawfisheater',
  '박종욱', 'onfood', '온푸드', '맛객리우', '푸드로드', 'foodroad',
  '키다리짬뽕아저씨', '1분광주맛집', '찐아재', '탐구생활', '명현만', 'myunghyunman',
  '스튜디오워매', '광주맛집밥쪼', '팔자스튜디오', '맛집따개',
];

const ALLOW = new Set([...ALLOW_NATIONAL, ...ALLOW_LOCAL].map(norm));

// ── 제외 채널 (방송사·예능·기업·자체계정·ASMR) ──
const BLOCK = new Set([
  'sbsentertainment', 'sbs', '광주mbc', 'kbs', 'mbc', 'tvn',        // 방송사·종합
  '자이언트펭tv', '펭수',                                           // 예능 캐릭터
  '페퍼저축은행aipeppers배구단', '페퍼스',                          // 기업/스포츠
  '어항',                                                          // 스시어항 자체계정
  '효닝', 'hyoning',                                               // ASMR 먹방
].map(norm));

// ── 코너/포맷 제목 패턴 (종합채널이어도 이 코너면 허용) ──
const ALLOW_CORNER = /또간집|먹을텐데|처먹을텐데|최자로드|스트리트\s*푸드\s*파이터|골목식당/i;

// ── 제외 제목 패턴 (쇼츠·ASMR·순수먹방) ──
const BLOCK_TITLE = /asmr|리얼\s*사운드|real\s*sound|#\s*shorts|\bshorts\b|이팅사운드|eating\s*sound/i;

/**
 * @param {{channelName?:string, title?:string, isShort?:boolean, durationSec?:number}} v
 * @returns {{verdict:'allow'|'block'|'gray', reason:string}}
 */
export function classifyChannel(v) {
  const ch = norm(v.channelName);
  const title = v.title || '';

  // 1) 쇼츠 하드 제외
  if (v.isShort === true || (v.durationSec != null && v.durationSec > 0 && v.durationSec <= 60)) {
    return { verdict: 'block', reason: 'shorts' };
  }
  // 2) 제목 기반 제외(ASMR/리얼사운드/shorts)
  if (BLOCK_TITLE.test(title)) return { verdict: 'block', reason: 'asmr/shorts-title' };

  // 3) 코너 포맷이면 허용(방송사 채널이어도)
  if (ALLOW_CORNER.test(title)) return { verdict: 'allow', reason: 'corner' };

  // 4) 블랙리스트 채널 (부분일치)
  for (const b of BLOCK) if (b && ch.includes(b)) return { verdict: 'block', reason: `block:${b}` };

  // 5) 화이트리스트 채널 (부분일치)
  for (const a of ALLOW) if (a && ch.includes(a)) return { verdict: 'allow', reason: `allow:${a}` };

  // 6) 미등록 → LLM 판정
  return { verdict: 'gray', reason: 'unknown-channel' };
}

export const CHANNEL_POLICY = { ALLOW, BLOCK, ALLOW_CORNER, BLOCK_TITLE };
