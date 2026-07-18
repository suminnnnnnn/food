-- 밀키트 신뢰도 스코어링 컬럼 (additive)
-- trust_score: 0~100 (셰프/식당 직접 제조·조회수·후기 등 종합)
-- maker_type : chef | restaurant | manufacturer | unknown
-- maker_name : 셰프명/식당명
ALTER TABLE affiliate_products
  ADD COLUMN IF NOT EXISTS trust_score int,
  ADD COLUMN IF NOT EXISTS maker_type  text,
  ADD COLUMN IF NOT EXISTS maker_name  text;
