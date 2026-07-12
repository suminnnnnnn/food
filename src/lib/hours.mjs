// 영업시간 정규화 — TourAPI 등 자유텍스트를 이용자 제보 포맷과 동일하게 변환.
// 출력 포맷(이용자 제보와 동일):
//   - 균일: "매일 HH:MM~HH:MM"
//   - 요일별: "월 HH:MM~HH:MM" / "수 휴무" 를 줄바꿈으로 (월→일 순)
// 준비시간·브레이크타임·라스트오더 등 부가정보는 이용자 포맷에 없으므로 제외.

export const HOUR_DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const IDX = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };
const SEG = '@@SEG@@';

function expandRange(a, b) {
  const out = [];
  for (let i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b) break; if (out.length > 7) break; }
  return out;
}

// 휴무 절에서 매주 정기휴무 요일만 추출 (연중무휴·명절·격주 등은 주간 휴무 아님 → 제외)
function parseClosedDays(hyuText) {
  const closed = new Set();
  if (!hyuText || /무휴/.test(hyuText)) return closed;
  const rangeRe = /([월화수목금토일])\s*요?일?\s*[~\-]\s*([월화수목금토일])\s*요?일?/g;
  let m;
  while ((m = rangeRe.exec(hyuText))) expandRange(IDX[m[1]], IDX[m[2]]).forEach((i) => closed.add(i));
  if (!/격주|둘째|넷째|첫째|셋째|마지막\s*주/.test(hyuText)) {
    const single = /(?:매주\s*)?([월화수목금토일])\s*요일/g;
    while ((m = single.exec(hyuText))) closed.add(IDX[m[1]]);
  }
  return closed;
}

// 요일 지정이 있는 per-day 패턴 파싱 → { dayIdx: [open, close] } 또는 null
function parsePerDay(body) {
  const tokenRe = /([월화수목금토일]요?일?\s*[~\-]\s*[월화수목금토일]요?일?|평일|주말|매일|공휴일|[월화수목금토일]요일)/g;
  const marked = body.replace(tokenRe, SEG + '$1');
  const segs = marked.split(SEG).map((x) => x.trim()).filter(Boolean);
  const map = {};
  let any = false;
  for (const seg of segs) {
    const t = seg.match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/);
    if (!t) continue;
    const open = `${String(+t[1]).padStart(2, '0')}:${t[2]}`;
    const close = `${String(+t[3]).padStart(2, '0')}:${t[4]}`;
    let days = [];
    if (/평일/.test(seg)) days = [0, 1, 2, 3, 4];
    else if (/주말/.test(seg)) days = [5, 6];
    else if (/매일|공휴일/.test(seg)) days = [0, 1, 2, 3, 4, 5, 6];
    else {
      const r = seg.match(/([월화수목금토일])\s*요?일?\s*[~\-]\s*([월화수목금토일])/);
      if (r) days = expandRange(IDX[r[1]], IDX[r[2]]);
      else { const one = seg.match(/([월화수목금토일])요일/); if (one) days = [IDX[one[1]]]; }
    }
    if (days.length) { any = true; for (const d of days) map[d] = [open, close]; }
  }
  return any ? map : null;
}

export function normalizeBusinessHours(raw) {
  if (!raw || raw === '정보 없음') return raw;
  const s = String(raw).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ');

  const hyu = s.match(/휴무\s*[:：]?\s*([^)\n]*)/);
  const closed = parseClosedDays(hyu ? hyu[1] : '');

  // 부가정보 제거 (이용자 포맷엔 없음)
  const body = s
    .replace(/\(?\s*휴무\s*[:：]?[^)]*\)?/g, ' ')
    .replace(/\(?\s*(준비시간|브레이크\s*타임|브레이크타임|라스트\s*오더|라스트오더|마지막\s*주문|점심\s*마지막\s*주문|저녁\s*마지막\s*주문)[^)]*\)?/g, ' ')
    .replace(/※[^\n]*/g, ' ')
    .replace(/[•]/g, ' ');

  const perDay = parsePerDay(body);
  if (perDay) {
    return HOUR_DAYS.map((d, i) => {
      if (closed.has(i)) return `${d} 휴무`;
      return perDay[i] ? `${d} ${perDay[i][0]}~${perDay[i][1]}` : `${d} 휴무`;
    }).join('\n');
  }

  // 균일: 본문 첫 시간쌍을 영업시간으로
  const bodyForTime = body.replace(/[\-]/g, ' ');
  const times = [];
  const re = /(\d{1,2}):(\d{2})/g;
  let tm;
  while ((tm = re.exec(bodyForTime))) times.push(`${String(+tm[1]).padStart(2, '0')}:${tm[2]}`);
  if (times.length < 2) return raw; // 파싱 실패 안전장치: 원문 유지

  const open = times[0], close = times[1];
  if (closed.size === 0) return `매일 ${open}~${close}`;
  return HOUR_DAYS.map((d, i) => (closed.has(i) ? `${d} 휴무` : `${d} ${open}~${close}`)).join('\n');
}
