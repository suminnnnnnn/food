// 랜드마크 근접 태그 데이터 + 반경 매칭 (검색용). 좌표는 Kakao 지오코딩 결과.
// 배치(enrich_search_tags.mjs)와 파이프라인(searchTags.ts) 양쪽에서 import.

export const LANDMARKS = [
  { name: '광주기아챔피언스필드', aliases: ['챔피언스필드', '챔필', '기아챔피언스필드'], situation: ['야구장맛집', '직관맛집'], radius: 1300, lat: 35.16820922, lng: 126.88911206 },
  { name: '국립아시아문화전당', aliases: ['아시아문화전당', '문화전당', 'ACC'], situation: ['문화전당맛집'], radius: 1000, lat: 35.14733372, lng: 126.92135353 },
  { name: '광주송정역', aliases: ['송정역', 'KTX송정역'], situation: ['송정역맛집', '기차역맛집'], radius: 1000, lat: 35.13766751, lng: 126.79080504 },
  { name: '유스퀘어', aliases: ['광천터미널', '광주종합버스터미널', '버스터미널'], situation: ['터미널맛집'], radius: 1000, lat: 35.16040761, lng: 126.87931250 },
  { name: '김대중컨벤션센터', aliases: ['컨벤션센터', '김대중컨벤션'], situation: ['컨벤션센터맛집'], radius: 1000, lat: 35.14704521, lng: 126.84055019 },
  { name: '전남대학교', aliases: ['전남대', '전대'], situation: ['대학가맛집', '전남대맛집'], radius: 1200, lat: 35.17596182, lng: 126.90856530 },
  { name: '조선대학교', aliases: ['조선대'], situation: ['대학가맛집', '조선대맛집'], radius: 1200, lat: 35.14273208, lng: 126.93470931 },
  { name: '광주월드컵경기장', aliases: ['월드컵경기장'], situation: ['경기장맛집'], radius: 1200, lat: 35.13368229, lng: 126.87489505 },
  { name: '무등산', aliases: ['무등산'], situation: ['등산맛집', '무등산맛집'], radius: 2500, lat: 35.13313716, lng: 126.99046193 },
  { name: '5·18민주광장', aliases: ['금남로', '충장로', '시내'], situation: ['시내맛집', '충장로맛집'], radius: 900, lat: 35.14749134, lng: 126.91980165 },
  { name: '상무지구', aliases: ['상무지구'], situation: ['상무지구맛집'], radius: 1300, lat: 35.15160893, lng: 126.84837934 },
  { name: '첨단지구', aliases: ['첨단지구', '광주과학기술원', 'GIST'], situation: ['첨단맛집'], radius: 1800, lat: 35.22736539, lng: 126.84160374 },
  { name: '양림동', aliases: ['양림동', '펭귄마을'], situation: ['양림동맛집'], radius: 900, lat: 35.13668038, lng: 126.91197782 },
  { name: '광주공항', aliases: ['광주공항'], situation: ['공항맛집'], radius: 1500, lat: 35.13993381, lng: 126.81071196 },
  { name: '대인시장', aliases: ['대인시장'], situation: ['시장맛집'], radius: 700, lat: 35.15389078, lng: 126.91680800 },
  { name: '광주역', aliases: ['광주역'], situation: ['광주역맛집'], radius: 900, lat: 35.16530024, lng: 126.90933351 },
  { name: '헤이리예술마을', aliases: ['헤이리'], situation: ['헤이리맛집'], radius: 1800, lat: 37.78804091, lng: 126.69930440 },
  { name: '오두산통일전망대', aliases: ['오두산전망대'], situation: [], radius: 2000, lat: 37.77327614, lng: 126.67722749 },
  { name: '파주프리미엄아울렛', aliases: ['파주아울렛', '신세계아울렛'], situation: ['아울렛맛집'], radius: 1500, lat: 37.76947081, lng: 126.69633445 },
];

function distanceM(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 좌표 반경 내 랜드마크의 검색용 근접 태그 배열 반환 */
export function nearbyLandmarkTags(lat, lng) {
  if (!lat || !lng) return [];
  const tags = new Set();
  for (const lm of LANDMARKS) {
    if (distanceM(lat, lng, lm.lat, lm.lng) <= lm.radius) {
      for (const n of [lm.name, ...lm.aliases]) {
        tags.add(`${n}맛집`);
        tags.add(`${n}근처맛집`);
      }
      for (const s of lm.situation) tags.add(s);
    }
  }
  return [...tags];
}
