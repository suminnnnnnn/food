import os
from dotenv import load_dotenv

# .env 로드
load_dotenv()

# Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

# API Keys
TOUR_API_KEY = os.environ.get("TOUR_API_KEY")
COMMERCIAL_API_KEY = os.environ.get("COMMERCIAL_API_KEY")
KAKAO_REST_API_KEY = os.environ.get("KAKAO_REST_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_CALL_DELAY = float(os.environ.get("GEMINI_CALL_DELAY", 4.0))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 5))
BATCH_COOLDOWN = float(os.environ.get("BATCH_COOLDOWN", 10.0))

if not all([SUPABASE_URL, SUPABASE_KEY, TOUR_API_KEY, COMMERCIAL_API_KEY, KAKAO_REST_API_KEY, GEMINI_API_KEY]):
    print("Warning: Missing some API keys in environment.")
