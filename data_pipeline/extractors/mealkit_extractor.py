import os
import json
import logging
import urllib.parse
import datetime
import google.generativeai as genai
import yt_dlp

logger = logging.getLogger("MealkitExtractor")

def extract_products_with_gemini(video_info: dict) -> list:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY 누락")
        return []

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')

    prompt = f"""
    당신은 한국의 유튜브 먹방/밀키트 리뷰 영상에서 소개된 제품을 식별하는 AI입니다.
    다음 유튜브 영상의 제목, 설명, 채널명을 분석하여 언급되거나 리뷰된 모든 밀키트/간편식/식품 제품명과 브랜드를 추출하세요.

    [영상 정보]
    제목: {video_info.get("title", "")}
    설명: {video_info.get("description", "")}
    채널: {video_info.get("channel_title", "")}

    [출력 조건]
    1. 제품명(product_name)과 브랜드(brand)를 추출하세요. 브랜드가 불명확하면 빈 문자열을 넣으세요.
    2. 중복을 제거하세요.
    3. 반드시 아래 JSON 형식으로만 응답해야 하며, 마크다운 백틱(```json) 등 불필요한 텍스트를 절대 섞지 마십시오.

    {{
      "products": [
        {{"product_name": "애슐리 볶음밥", "brand": "애슐리"}},
        {{"product_name": "비비고 왕교자", "brand": "비비고"}}
      ]
    }}
    """
    
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text.strip())
        return result.get("products", [])
    except Exception as e:
        logger.error(f"[Gemini] 추출 오류: {e}")
        return []

def search_mealkit_videos_fallback(query: str, limit: int = 5):
    logger.info(f"[Fallback yt-dlp] Searching for: '{query}'")
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'extract_flat': True,
        'force_generic_extractor': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            search_results = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
            if not search_results or 'entries' not in search_results:
                return []
                
            videos = []
            for entry in search_results['entries']:
                if not entry:
                    continue
                
                published_at = None
                if entry.get('timestamp'):
                    published_at = datetime.datetime.fromtimestamp(entry['timestamp'], tz=datetime.timezone.utc).isoformat()
                elif entry.get('upload_date'):
                    date_str = entry['upload_date']
                    if len(date_str) == 8:
                        published_at = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}T00:00:00Z"
                        
                thumbnail_url = None
                thumbnails = entry.get('thumbnails', [])
                if thumbnails:
                    thumbnail_url = thumbnails[-1].get('url')
                    
                channel_title = entry.get('uploader') or entry.get('channel')
                view_count = entry.get('view_count') or 0
                
                # Fetch full description if missing from extract_flat
                video_id = entry.get('id')
                description = entry.get('description', '')
                
                if not description or len(description) < 50:
                    try:
                        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                        description = info.get('description', '')
                    except Exception:
                        pass
                
                videos.append({
                    "youtube_video_id": video_id,
                    "title": entry.get('title'),
                    "thumbnail_url": thumbnail_url,
                    "view_count": int(view_count),
                    "published_at": published_at,
                    "channel_title": channel_title,
                    "description": description
                })
                
            videos.sort(key=lambda x: x["view_count"], reverse=True)
            return videos
    except Exception as e:
        logger.error(f"[Fallback yt-dlp] Error searching for '{query}': {e}")
        return []

def generate_coupang_search_url(product_name: str) -> str:
    encoded = urllib.parse.quote(product_name)
    return f"https://www.coupang.com/np/search?q={encoded}&channel=user"
