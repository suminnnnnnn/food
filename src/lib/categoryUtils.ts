import { Restaurant } from '@/types';

/**
 * 네이버맵 / 카카오맵 공인 표준 2단 분류에 맞추어 식당의 카테고리를 정교하게 정제합니다.
 * @param res 식당 객체
 * @returns 정제된 계층형 카테고리 (예: '한식 > 육류,고기요리')
 */
export const getRefinedCategory = (res: Restaurant | null): string => {
  if (!res) return '한식 > 한식당';
  const rawCat = res.category || '';
  const name = res.name || '';
  
  // 무의미한 단순 수집 카테고리 체크
  const isGeneric = ['유튜브 맛집', '유튜브 핫플', '제보 맛집', '제보맛집', '기타', '미분류', '전체'].some(
    g => rawCat.includes(g) || rawCat === ''
  );
  
  // 이미 올바른 계층구조(>)로 존재한다면 그대로 사용
  if (!isGeneric && rawCat.includes('>')) return rawCat;

  // 1. 식당 이름(Name) 분석을 통한 1차 지능형 분류 매핑 (네이버/카카오 기준)
  if (name.includes('갈비') || name.includes('삼겹') || name.includes('고기') || name.includes('갈비집') || name.includes('돼지') || name.includes('한우') || name.includes('등심') || name.includes('구이') || name.includes('숯불') || name.includes('갈매기')) {
    return '한식 > 육류,고기요리';
  }
  if (name.includes('곱창') || name.includes('막창') || name.includes('대창') || name.includes('양곱창') || name.includes('곱창전골')) {
    return '한식 > 곱창,막창';
  }
  if (name.includes('국밥') || name.includes('해장국') || name.includes('설렁탕') || name.includes('순대국') || name.includes('곰탕') || name.includes('추어탕') || name.includes('도가니') || name.includes('평양온반')) {
    return '한식 > 국밥';
  }
  if (name.includes('칼국수') || name.includes('만두') || name.includes('수제비') || name.includes('만두집') || name.includes('만두국')) {
    return '한식 > 칼국수,만두';
  }
  if (name.includes('찌개') || name.includes('전골') || name.includes('부대찌개') || name.includes('김치찌개') || name.includes('동태탕') || name.includes('동태찌개')) {
    return '한식 > 찌개,전골';
  }
  if (name.includes('국수') || name.includes('밀면') || name.includes('냉면') || name.includes('막국수') || name.includes('메밀')) {
    return '한식 > 국수,면요리';
  }
  if (name.includes('족발') || name.includes('보쌈')) {
    return '한식 > 족발,보쌈';
  }
  if (name.includes('횟집') || name.includes('스시') || name.includes('초밥') || name.includes('참치') || name.includes('회집') || name.includes('바다')) {
    return '일식 > 일식당';
  }
  if (name.includes('돈까스') || name.includes('돈가스') || name.includes('가츠') || name.includes('카츠')) {
    return '일식 > 돈가스';
  }
  if (name.includes('우동') || name.includes('소바') || name.includes('라멘')) {
    return '일식 > 우동,소바,라멘';
  }
  if (name.includes('짜장') || name.includes('짬뽕') || name.includes('중국집') || name.includes('중화') || name.includes('양꼬치') || name.includes('마라') || name.includes('양갈비')) {
    return '중식 > 중식당';
  }
  if (name.includes('파스타') || name.includes('피자') || name.includes('양식') || name.includes('스테이크') || name.includes('이탈리') || name.includes('레스토랑')) {
    return '양식 > 이탈리아음식';
  }
  if (name.includes('버거') || name.includes('샌드위치') || name.includes('패스트푸드')) {
    return '양식 > 햄버거';
  }
  if (name.includes('떡볶이') || name.includes('김밥') || name.includes('분식') || name.includes('순대') || name.includes('튀김')) {
    return '분식 > 분식당';
  }
  if (name.includes('카페') || name.includes('커피') || name.includes('디저트') || name.includes('빵') || name.includes('베이커리') || name.includes('찻집')) {
    return '카페 > 카페,디저트';
  }
  if (name.includes('맥주') || name.includes('호프') || name.includes('술집') || name.includes('포차') || name.includes('포장마차') || name.includes('이자카야') || name.includes('와인') || name.includes('바')) {
    return '술집 > 요리주점';
  }

  // 2. 기존 raw 카테고리를 활용한 정교한 보정 매핑
  const cat = rawCat.toLowerCase();
  if (cat.includes('고기') || cat.includes('육류') || cat.includes('갈비') || cat.includes('삼겹살') || cat.includes('구이')) return '한식 > 육류,고기요리';
  if (cat.includes('곱창') || cat.includes('막창') || cat.includes('대창')) return '한식 > 곱창,막창';
  if (cat.includes('국밥') || cat.includes('탕') || cat.includes('찌개') || cat.includes('전골')) return '한식 > 국밥,찌개,전골';
  if (cat.includes('칼국수') || cat.includes('만두') || cat.includes('수제비')) return '한식 > 칼국수,만두';
  if (cat.includes('면') || cat.includes('국수') || cat.includes('냉면') || cat.includes('밀면')) return '한식 > 국수,면요리';
  if (cat.includes('일식') || cat.includes('스시') || cat.includes('초밥') || cat.includes('회')) return '일식 > 일식당';
  if (cat.includes('돈가스') || cat.includes('돈까스')) return '일식 > 돈가스';
  if (cat.includes('라멘') || cat.includes('우동') || cat.includes('소바')) return '일식 > 우동,소바,라멘';
  if (cat.includes('중식') || cat.includes('중화요리') || cat.includes('양꼬치') || cat.includes('마라')) return '중식 > 중식당';
  if (cat.includes('이탈리') || cat.includes('피자') || cat.includes('파스타') || cat.includes('스테이크') || cat.includes('양식')) return '양식 > 이탈리아음식';
  if (cat.includes('버거') || cat.includes('햄버거')) return '양식 > 햄버거';
  if (cat.includes('분식') || cat.includes('떡볶이') || cat.includes('김밥')) return '분식 > 분식당';
  if (cat.includes('카페') || cat.includes('커피') || cat.includes('디저트') || cat.includes('베이커리')) return '카페 > 카페,디저트';
  if (cat.includes('술집') || cat.includes('호프') || cat.includes('맥주') || cat.includes('와인') || cat.includes('포차') || cat.includes('주점')) return '술집 > 요리주점';

  // 최종 폴백 매핑
  return '한식 > 한식당';
};

/**
 * 해시태그 정규화 및 표준화 작업을 진행합니다.
 * @param keyword 검색어 또는 해시태그
 * @returns 표준 정제된 태그명 (유효하지 않으면 null)
 */
export const normalizeSearchTag = (keyword: string): string | null => {
  if (!keyword) return null;
  const clean = keyword.replace('#', '').replace(/\s+/g, '').trim().toLowerCase();
  
  if (!clean) return null;
  
  // 무의미한 단어 제외 필터링
  if (['맛집', '추천', '강추', '존맛', '내돈내산', '영상', '클립', '유튜브'].includes(clean)) {
    return null;
  }

  // 동의어 매핑
  if (['삼겹살', '오겹살', '목살', '돼지고기', '삼겹', '소고기', '한우'].some(w => clean.includes(w))) return '고기구이';
  if (['곱창', '막창', '대창', '양곱창'].some(w => clean.includes(w))) return '곱창,막창';
  if (['국밥', '순대국', '돼지국밥', '뼈해장국', '해장국'].some(w => clean.includes(w))) return '국밥';
  if (['칼국수', '수제비', '만두'].some(w => clean.includes(w))) return '칼국수,만두';
  if (['라멘', '라면'].some(w => clean.includes(w))) return '라멘';
  if (['스시', '초밥', '사시미', '회'].some(w => clean.includes(w))) return '일식,초밥';
  if (['돈까스', '돈가스', '규카츠', '카츠'].some(w => clean.includes(w))) return '돈가스';
  if (['파스타', '스파게티', '피자', '스테이크'].some(w => clean.includes(w))) return '양식,이탈리안';
  if (['떡볶이', '튀김', '김밥', '순대'].some(w => clean.includes(w))) return '떡볶이,분식';
  if (['디저트', '케이크', '빵', '베이커리', '커피', '카페'].some(w => clean.includes(w))) return '카페,디저트';
  if (['술집', '맥주', '이자카야', '와인', '하이볼', '포차'].some(w => clean.includes(w))) return '술집,주점';

  // 글자수가 5글자 이하이고 대표성을 띨 수 있는 키워드는 폴백 보존
  if (clean.length <= 5) {
    return clean;
  }
  
  return null;
};

/**
 * 식당의 모든 표준 인덱싱용 검색 태그를 추출하여 단일 평탄화 배열로 만듭니다.
 * 이 리스트는 클라이언트 검색 엔진에서 식당 매칭 속도를 혁신적으로 올리기 위해 사용됩니다.
 * @param res 식당 정보
 * @returns 모든 적용 가능한 해시태그 목록 (예: ['데이트코스', '주차가능', '라멘', '또간집', '미쉐린'])
 */
export const getRestaurantTags = (res: Restaurant): string[] => {
  const tagsSet = new Set<string>();

  // 1. 공인 큐레이션 출처 및 배지 이름 추가 (미쉐린, 블루리본, 또간집 등)
  res.content_tags?.forEach(tag => {
    if (tag.label) {
      tagsSet.add(tag.label.replace('#', '').trim());
    }
  });

  // 2. 네이버/카카오 지도 2단계 표준 소분류 카테고리를 해시태그로 추가
  const refinedCat = getRefinedCategory(res);
  const subCat = refinedCat.includes(' > ') ? refinedCat.split(' > ')[1] : refinedCat;
  if (subCat) {
    const cleanSubCat = subCat.replace(',', '').replace(' ', '').trim();
    tagsSet.add(cleanSubCat);
  }

  // 3. 비디오 키워드를 토대로 LCPC 표준 정제 해시태그 추출 추가
  const rawKeywords = res.videos?.flatMap(v => v.keywords || []) || [];
  rawKeywords.forEach(k => {
    const normalized = normalizeSearchTag(k);
    if (normalized) {
      tagsSet.add(normalized);
    }
  });

  return Array.from(tagsSet);
};