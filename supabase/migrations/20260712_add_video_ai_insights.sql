-- 영상 멀티모달 분석(Gemini) 결과 저장: picks(가격)/tips/signature/scenes/mood_tags
ALTER TABLE restaurant_videos ADD COLUMN IF NOT EXISTS ai_insights jsonb;
