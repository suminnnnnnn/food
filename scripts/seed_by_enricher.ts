import { enrichRestaurantByName, saveEnrichedDataToDB } from '../src/lib/enricher';

// 1. 적재할 14곳의 대표 식당 상호명 및 대략적인 위치 힌트 리스트
const targetRestaurants = [
  { name: '유즈라멘', address: '서울 중구 만리재로 217' },
  { name: '호수집', address: '서울 중구 청파로 443' },
  { name: '도동집', address: '서울 용산구 후암로 48' },
  { name: '오근내7닭갈비', address: '서울 중구 한강대로 413' },
  { name: '일미장어', address: '서울 용산구 후암로57길 35-15' },
  { name: '서부고려족발', address: '서울 중구 청파로 439-1' },
  { name: '명동칼국수', address: '서울 중구 한강대로 405' },
  { name: '서울역철도떡볶이', address: '서울 용산구 청파로93길 18-1' },
  { name: '충무칼국수', address: '서울 용산구 한강대로104길 84' },
  { name: '그릴', address: '서울 용산구 한강대로 405' },
  { name: '해성막창집 본점', address: '부산 해운대구 중동1로19번길 29' },
  { name: '중앙떡볶이', address: '대구 중구 동성로2길 81' },
  { name: '영미오리탕', address: '광주 북구 경열로 126' },
  { name: '가보정', address: '경기 수원시 팔달구 장다리로 282' }
];

async function runEnrichedSeeding() {
  console.log('🚀 [Seed By Enricher] 조회수 최다 영상 매핑 및 AI 상세정보 자동 시딩 가동...\n');

  let successCount = 0;
  let failCount = 0;

  for (const target of targetRestaurants) {
    try {
      // 1. 공통 정보 보강 모듈을 호출하여 카카오 검색 -> 읍면동 파싱 -> 유튜브 조회수 1위 검색 -> Gemini AI 편의 정보 보강 실행
      const result = await enrichRestaurantByName(target.name, target.address);
      
      if (!result) {
        console.error(`❌ [${target.name}] 정보 보강 실패. 다음 식당으로 넘어갑니다.`);
        failCount++;
        continue;
      }

      // 2. 보강된 통합 식당/비디오 데이터를 Supabase DB에 적재
      const saveSuccess = await saveEnrichedDataToDB(result);
      if (saveSuccess) {
        console.log(`✨ [${target.name}] 데이터베이스 적재 최종 완료!`);
        successCount++;
      } else {
        console.error(`❌ [${target.name}] 데이터베이스 적재 과정 오류 발생.`);
        failCount++;
      }
    } catch (error) {
      console.error(`❌ [${target.name}] 처리 도중 예외 에러 발생:`, error);
      failCount++;
    }

    // 유튜브 API 및 Gemini API 호출 속도 제한 방지를 위한 대기 시간 추가
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n=========================================');
  console.log(`🎉 [Seeding Completed] 성공: ${successCount}곳 / 실패: ${failCount}곳`);
  console.log('=========================================');
}

runEnrichedSeeding();
