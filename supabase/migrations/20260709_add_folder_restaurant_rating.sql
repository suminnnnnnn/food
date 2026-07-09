-- 저장탭 개인화: 사용자별 맛집 별점 (1~5, NULL=미평가)
-- folder_restaurants(폴더-맛집 매핑)에 개인 평가 rating 컬럼 추가 (additive)
ALTER TABLE folder_restaurants
  ADD COLUMN IF NOT EXISTS rating smallint;
