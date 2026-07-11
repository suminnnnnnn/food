-- 영업시간 출처 구분: 'tour'(한국관광공사 TourAPI) | 'user'(이용자 제보) | NULL
-- 표시할 때 출처를 명시해 법적 리스크(공식 단정 오인)를 낮춘다. (additive)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS business_hours_source text;
