import os
import logging
import datetime
import json
from googleapiclient.discovery import build
import google.generativeai as genai
import yt_dlp


logger = logging.getLogger("YoutubeExtractor")

def search_youtube_official(api_key: str, query: str, limit: int = 5):
    """
    공식 YouTube Data API v3를 사용하여 비디오 검색 및 조회수 기준 정렬
    """
    logger.info(f"[Official API] Searching for: '{query}'")
    try:
        youtube = build("youtube", "v3", developerKey=api_key)
        
        # 1. 비디오 검색 (조회수 정보를 바로 가져올 수 없으므로 비디오 ID 리스트 획득 필요)
        search_response = youtube.search().list(
            q=query,
            part="id,snippet",
            maxResults=limit,
            type="video"
        ).execute()
        
        video_ids = []
        for item in search_response.get("items", []):
            video_id = item.get("id", {}).get("videoId")
            if video_id:
                video_ids.append(video_id)
                
        if not video_ids:
            logger.info("[Official API] No videos found.")
            return []
            
        # 2. 비디오 상세 정보 및 통계(조회수) 일괄 조회
        videos_response = youtube.videos().list(
            part="id,snippet,statistics",
            id=",".join(video_ids)
        ).execute()
        
        videos = []
        for item in videos_response.get("items", []):
            snippet = item.get("snippet", {})
            statistics = item.get("statistics", {})
            
            # 고화질 순으로 썸네일 탐색
            thumbnails = snippet.get("thumbnails", {})
            thumbnail_url = None
            for size in ["maxres", "standard", "high", "medium", "default"]:
                if size in thumbnails:
                    thumbnail_url = thumbnails[size].get("url")
                    break
                    
            published_at = snippet.get("publishedAt")
            channel_id = snippet.get("channelId")
            channel_title = snippet.get("channelTitle")
            view_count = int(statistics.get("viewCount", 0))
            
            videos.append({
                "youtube_video_id": item.get("id"),
                "title": snippet.get("title"),
                "thumbnail_url": thumbnail_url,
                "view_count": view_count,
                "published_at": published_at,
                "channel_id": channel_id,
                "channel_title": channel_title
            })
            
        # 조회수 내림차순 정렬
        videos.sort(key=lambda x: x["view_count"], reverse=True)
        return videos
    except Exception as e:
        logger.error(f"[Official API] Error searching for '{query}': {e}")
        return []

def search_youtube_fallback(query: str, limit: int = 5):
    """
    yt-dlp를 사용하여 비인증 상태로 유튜브 비디오 검색 및 조회수 기준 정렬
    """
    logger.info(f"[Fallback yt-dlp] Searching for: '{query}'")
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'extract_flat': True,
        'force_generic_extractor': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # ytsearch{limit}:{query} 형태로 검색 실행
            search_results = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
            if not search_results or 'entries' not in search_results:
                logger.info("[Fallback yt-dlp] No videos found.")
                return []
                
            videos = []
            for entry in search_results['entries']:
                if not entry:
                    continue
                
                # 업로드 일자 파싱
                published_at = None
                if entry.get('timestamp'):
                    published_at = datetime.datetime.fromtimestamp(entry['timestamp'], tz=datetime.timezone.utc).isoformat()
                elif entry.get('upload_date'):
                    date_str = entry['upload_date']
                    if len(date_str) == 8:
                        published_at = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}T00:00:00Z"
                        
                # 썸네일 파싱 (최고 화질 썸네일 선택)
                thumbnail_url = None
                thumbnails = entry.get('thumbnails', [])
                if thumbnails:
                    thumbnail_url = thumbnails[-1].get('url')
                    
                # 채널 ID 파싱
                channel_id = entry.get('uploader_id') or entry.get('channel_id')
                if not channel_id and entry.get('channel_url'):
                    url_parts = entry['channel_url'].split('/')
                    if len(url_parts) > 0:
                        channel_id = url_parts[-1]
                        
                view_count = entry.get('view_count') or 0
                
                videos.append({
                    "youtube_video_id": entry.get('id'),
                    "title": entry.get('title'),
                    "thumbnail_url": thumbnail_url,
                    "view_count": int(view_count),
                    "published_at": published_at,
                    "channel_id": channel_id,
                    "channel_title": entry.get('uploader')
                })
                
            # 조회수 내림차순 정렬
            videos.sort(key=lambda x: x["view_count"], reverse=True)
            return videos
    except Exception as e:
        logger.error(f"[Fallback yt-dlp] Error searching for '{query}': {e}")
        return []

def verify_video_match(title: str, restaurant_name: str, sigungu: str) -> bool:
    """
    유튜브 비디오 제목과 식당 정보 간의 정합성을 검증합니다.
    """
    if not title or not restaurant_name:
        return False
        
    title_clean = title.lower().replace(" ", "").replace(",", "").replace("-", "").replace("!", "")
    name_clean = restaurant_name.lower().replace(" ", "")
    sigungu_clean = sigungu.replace(" ", "") if sigungu else ""
    
    # 음식/식당 연관 키워드 리스트
    food_keywords = {
        '맛집', '먹방', '식당', '음식', '푸드', '요리', '식사', '메뉴', '카페', '커피', 
        '디저트', '빵', '베이커리', '존맛', '맛있는', '리뷰', '투어', '오마카세', '참치', 
        '초밥', '스시', '갈비', '삼겹살', '고기', '국밥', '해장국', '찌개', '탕', '면', 
        '국수', '우동', '라멘', '짜장', '짬뽕', '탕수육', '피자', '치킨', '햄버거', '파스타',
        '브이로그', 'vlog', 'koreanfood', 'mukbang', '한식', '일식', '중식', '양식'
    }
    
    # 제목에 음식 관련 키워드가 하나라도 들어있는지 검사
    has_food_keyword = any(kw in title_clean for kw in food_keywords)
    
    # 상호명이 3글자 이하로 극히 짧은 경우, 제목에 음식 관련 맥락 키워드가 필수적으로 있어야 함
    if len(name_clean) <= 3 and not has_food_keyword:
        return False
        
    # 1. 상호명 자체가 제목에 직접 포함되어 있는가? (가장 이상적)
    if name_clean in title_clean:
        return True
        
    # 2. 식당명 분할 검사 (핵심어 매칭)
    # 지점명이나 극히 일반적인 맛집 단어를 필터링
    common_words = {'식당', '카페', '국밥', '추어탕', '참치', '초밥', '갈비', '삼겹살', '구이', '한우', '양식', '중식', '일식', '분식', '커피', '점', '본점', '나주점', '혁신점'}
    
    # 공백 기준으로 단어를 나누고 일반 단어 필터링
    name_parts = [p for p in restaurant_name.split() if p not in common_words and len(p) >= 2]
    
    # 공백이 없는 긴 상호명의 경우 핵심 키워드 임의 추출 시도 (예: '광주공원진미국밥' -> '광주공원', '진미')
    if not name_parts and len(restaurant_name) >= 3:
        clean_name = restaurant_name
        for word in common_words:
            clean_name = clean_name.replace(word, "")
        if len(clean_name) >= 2:
            name_parts = [clean_name]
            
    for part in name_parts:
        part_clean = part.lower().replace(" ", "")
        if part_clean in title_clean:
            # 핵심 단어가 존재하고, 시군구 지역명도 함께 들어있는 경우 매칭 인정
            if sigungu_clean and sigungu_clean.lower() in title_clean:
                # 상호명 핵심어 매칭 시에도 짧은 키워드 매칭 오류를 위해 음식 연관 키워드 재체크
                if len(part_clean) <= 2 and not has_food_keyword:
                    continue
                return True
            # 시군구가 명시되어 있지 않은 경우, 최소한 핵심 고유상호명이 매칭되면 인정
            if not sigungu_clean:
                if len(part_clean) <= 2 and not has_food_keyword:
                    continue
                return True
                
    return False


def fetch_video_details_fallback(video_id: str) -> dict:
    """
    단일 비디오 ID에 대해 상세 정보(description)를 조회합니다.
    """
    logger.info(f"[Fallback yt-dlp] Fetching details for video ID: {video_id}")
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'force_generic_extractor': False,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            return {
                "description": info.get("description", "") or "",
                "tags": info.get("tags", []) or []
            }
    except Exception as e:
        logger.error(f"[Fallback yt-dlp] Error fetching details for video {video_id}: {e}")
        return {"description": "", "tags": []}

def verify_video_with_gemini(restaurant_name: str, address: str, video_info: dict) -> dict:
    """
    제보 심사 API와 동일하게 Gemini 2.5 Flash를 사용하여 
    검색된 영상이 실제 해당 맛집의 영상이 맞는지 정밀 심사합니다.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY 누락으로 AI 심사를 생략하고 기본 승인 처리합니다.")
        return {"is_valid": True, "confidence_score": 100, "reason": "GEMINI_API_KEY 미설정으로 심사 생략"}
        
    logger.info(f"[Gemini AI Review] Auditing video '{video_info.get('title')}' for restaurant '{restaurant_name}'")
    genai.configure(api_key=api_key)
    
    video_desc = video_info.get("description", "") or ""
    video_title = video_info.get("title", "") or ""
    channel_title = video_info.get("channel_title", "") or ""
    
    prompt = f"""
당신은 대한민국 최고의 식당 리뷰 검증 및 매칭 정합성 판정 AI이자 맛집 가이드 에디터입니다.
기존 맛집 데이터베이스에 있는 맛집에 대해 유튜브에서 자동으로 검색된 추천 영상 후보가 전달되었습니다. 
이 영상이 실제 해당 맛집(동일한 상호 및 지점/지역)을 방문하여 직접 소개/리뷰한 영상이 맞는지 정합성을 심사해 주세요.

[맛집 정보]
- 상호명: {restaurant_name}
- 주소: {address}

[검색된 유튜브 영상 정보]
- 채널명: {channel_title}
- 영상 제목: {video_title}
- 영상 설명: {video_desc}

[판정 및 심사 핵심 지침]
1. 이 유튜브 영상이 해당 식당을 직접 방문하여 미식 리뷰를 진행한 영상이 맞는지 진위 확률을 구하세요.
   - 단지 지역명이 겹치거나, 다른 맛집 리스트를 소개하는 모음집 영상에 식당이 아주 짧게 스치듯 지나가는 경우 신뢰도가 낮습니다.
   - 프랜차이즈의 경우, 해당 지점(예: '송현불고기 나주점')이 맞는지 주소 정보를 통해 면밀히 확인하세요. 만약 다른 지점(예: '송현불고기 광주점')의 영상이라면 승인할 수 없습니다.
2. 영상이 최종 승인(is_valid: true)될 수 있으려면 신뢰도가 70점 이상이어야 합니다.
3. 승인 시(is_valid가 true일 때):
   - "summary": 해당 유튜브 영상에서 다룬 맛집에 대한 평가 내용(맛, 분위기, 추천 메뉴 등 영상에서의 평가 요지)을 바탕으로 친근하고 명확한 한국어 요약 설명글을 작성해줘 (2~3줄 내외, 최대 150자 내외).
   - "tags": 영상에서 나타난 식당에 어울리는 분위기나 목적 관련 추천 해시태그 목록을 3~5개 내외의 배열로 작성해줘 (예: ["데이트", "가족외식", "가성비", "인스타감성", "조용한"]). '#' 기호는 제외할 것.
4. 승인이 안 될 경우(is_valid가 false일 때) summary는 빈 문자열(""), tags는 빈 배열([])로 반환하십시오.
5. 분석 이유를 'reason'에 한 줄로 명확히 작성하세요.

반드시 아래 JSON 형식으로만 응답해야 하며, 마크다운 백틱(```json) 등 불필요한 텍스트를 절대 섞지 마십시오.
{{
  "is_valid": true 또는 false,
  "confidence_score": 0에서 100 사이의 숫자,
  "reason": "최종 검수 판정 사유 및 매칭 판단 근거에 대한 짧은 요약",
  "summary": "영상 기반 맛집 평가 요약글 또는 빈 문자열",
  "tags": ["태그1", "태그2", "태그3"]
}}
"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text.strip())
        logger.info(f"[Gemini AI Review] Result: is_valid={result.get('is_valid')}, score={result.get('confidence_score')}, reason={result.get('reason')}, summary={result.get('summary')}, tags={result.get('tags')}")
        return result
    except Exception as e:
        logger.error(f"[Gemini AI Review] Error running Gemini review: {e}")
        return {"is_valid": False, "confidence_score": 0, "reason": f"AI 심사 중 오류 발생: {e}", "summary": "", "tags": []}

def get_best_youtube_video(query: str, restaurant_name: str, sigungu: str, api_key: str = None, limit: int = 5):
    """
    유튜브에서 검색어(query)로 비디오를 검색하여 가장 조회수가 많고 검증된 비디오를 반환합니다.
    API 키가 주어지거나 환경변수에 존재할 경우 공식 API를 쓰고, 실패하거나 없을 시 yt-dlp fallback을 씁니다.
    """
    if not api_key:
        api_key = os.environ.get("YOUTUBE_API_KEY")
        
    videos = []
    if api_key:
        videos = search_youtube_official(api_key, query, limit)
        
    if not videos:
        videos = search_youtube_fallback(query, limit)
        
    if videos:
        # 1차 제목 정합성 검증 적용
        matched_videos = [v for v in videos if verify_video_match(v["title"], restaurant_name, sigungu)]
        
        # 통과한 비디오들을 대상으로 AI 심사 로직을 거침
        for candidate_video in matched_videos:
            # yt-dlp인 경우 상세 설명(description)을 얻기 위해 추가 호출
            video_id = candidate_video["youtube_video_id"]
            details = fetch_video_details_fallback(video_id)
            candidate_video["description"] = details.get("description", "")
            
            # AI 2차 검수 수행
            # 주소 정보 제공을 위해 시군구명을 address 파라미터로 넘겨줌
            ai_result = verify_video_with_gemini(restaurant_name, sigungu, candidate_video)
            
            if ai_result.get("is_valid") and ai_result.get("confidence_score", 0) >= 70:
                # 심사 결과(reason 등)를 비디오 데이터에 병합하여 반환
                candidate_video["ai_review"] = ai_result
                logger.info(f"Successfully passed AI Audit: '{candidate_video['title']}' (Score: {ai_result.get('confidence_score')})")
                return candidate_video
            else:
                logger.warning(f"Failed AI Audit for: '{candidate_video['title']}'. Reason: {ai_result.get('reason')}")
                
        logger.warning(f"No video passed AI Audit for restaurant '{restaurant_name}' (Sigungu: '{sigungu}').")
            
    return None


