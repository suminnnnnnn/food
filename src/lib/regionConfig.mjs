// 지역별 수집 설정 (전국 확장의 파라미터). Kakao 지역명 반환 특성(오매칭 함정) 포함.
// 새 지역 추가 시 이 객체만 채우면 seed_region/generate_region이 그대로 동작.

export const REGIONS = {
  gwangju: {
    key: 'gwangju',
    label: '광주',
    // Kakao 주소가 이 접두어들로 시작. ⚠️ Kakao는 전남 전역을 "전남광주통합특별시"로 반환하므로 guTokens로 최종 판별.
    addressPrefixes: ['광주광역시', '전남광주통합특별시'],
    guTokens: ['동구', '서구', '남구', '북구', '광산구'],
    target: 50,
    viewFloor: 30000,
    searchQueries: [
      '광주 맛집', '광주 먹방', '광주 노포', '광주 백반', '광주 국밥', '광주 혼밥', '광주 밥집', '광주 안주',
      '광주 동구 맛집', '광주 서구 맛집', '광주 남구 맛집', '광주 북구 맛집', '광주 광산구 맛집',
      '광주 상무지구 맛집', '광주 충장로 맛집', '광주 첨단 맛집', '광주 수완지구 맛집', '광주 양림동 맛집', '광주 봉선동 맛집', '광주 동명동 맛집',
      '광주 삼겹살', '광주 고기집', '광주 오리탕', '광주 육전', '광주 상추튀김', '광주 냉면', '광주 국수', '광주 칼국수', '광주 백숙',
      '광주 회 맛집', '광주 초밥', '광주 짜장면', '광주 파스타', '광주 피자', '광주 브런치', '광주 빵집', '광주 카페', '광주 술집', '광주 포차',
      '성시경 먹을텐데 광주', '또간집 광주', '최자로드 광주', '정육왕 광주', '광주 현지인 맛집', '광주 숨은 맛집', '광주 기사식당',
    ],
  },
  // 예: 부산 (전국 확장 시 채움) —
  // busan: { key:'busan', label:'부산', addressPrefixes:['부산광역시'], guTokens:['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'], target:50, viewFloor:30000, searchQueries:[...] },
};

// 주소가 해당 지역인지 판별 (접두어 + 구/군 토큰).
export function isInRegion(address, cfg) {
  if (!address) return false;
  for (const p of cfg.addressPrefixes) {
    if (address.includes(p)) {
      const tok = address.split(p)[1].trim().split(/\s+/)[0];
      return cfg.guTokens.includes(tok);
    }
  }
  return false;
}

export function getRegion(key) {
  const cfg = REGIONS[key];
  if (!cfg) throw new Error(`알 수 없는 지역: ${key} (사용가능: ${Object.keys(REGIONS).join(', ')})`);
  return cfg;
}
