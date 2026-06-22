from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY
from tenacity import retry, stop_after_attempt, wait_exponential

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def upsert_restaurant(data: dict):
    """
    동기 Supabase Client를 이용하여 식당 정보 UPSERT 및 데이터 병합 처리.
    """
    kakao_id = data.get('kakao_place_id')
    if not kakao_id:
        return None
        
    # 1. kakao_place_id로 기존 레코드 확인 (중복 방지 및 병합)
    existing = supabase.table('restaurants').select('*').eq('kakao_place_id', kakao_id).execute()
    if existing.data:
        existing_record = existing.data[0]
        restaurant_id = existing_record['id']
        
        # 병합 데이터 생성
        merged_data = {}
        
        # (1) 한 번이라도 공개된 적이 있다면 공개(is_published=True) 상태를 유지
        if existing_record.get('is_published') is True:
            merged_data['is_published'] = True
        else:
            merged_data['is_published'] = data.get('is_published', existing_record.get('is_published', False))
            
        # (2) 기존에 비어있던 필드들만 신규 데이터로 보완
        for key in ['name', 'category', 'address', 'road_address', 'lat', 'lng', 'phone', 
                    'parking', 'packaging', 'reservation', 'business_hours', 'image_url']:
            if key in data:
                if not existing_record.get(key):
                    merged_data[key] = data[key]
                    
        # (3) 메뉴 정보 병합 (기존 메뉴가 비어있는 경우에만 채워줌)
        if not existing_record.get('menu_info') and data.get('menu_info'):
            merged_data['menu_info'] = data['menu_info']
            
        # (4) 한눈에 보는 요약 및 추천 태그 병합
        for key in ['description_summary', 'tags']:
            if key in data and not existing_record.get(key):
                merged_data[key] = data[key]
                
        if merged_data:
            res = supabase.table('restaurants').update(merged_data).eq('id', restaurant_id).execute()
            return res.data[0] if res.data else None
        return existing_record
        
    # 2. 신규 등록인 경우
    res = supabase.table('restaurants').insert(data).execute()
    return res.data[0] if res.data else None

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def upsert_embedding(restaurant_id: str, embedding: list[float], source_text: str):
    """
    식당 ID를 기반으로 임베딩 벡터를 UPSERT
    """
    data = {
        "restaurant_id": restaurant_id,
        "embedding": embedding,
        "source_text": source_text
    }
    
    # Check existing
    existing = supabase.table('restaurant_embeddings').select('restaurant_id').eq('restaurant_id', restaurant_id).execute()
    if existing.data:
        res = supabase.table('restaurant_embeddings').update(data).eq('restaurant_id', restaurant_id).execute()
    else:
        res = supabase.table('restaurant_embeddings').insert(data).execute()
    return res.data

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def soft_delete_restaurant_by_address(address: str, zip_code: str = None):
    """
    주소(또는 도로명주소)와 우편번호 등을 통해 기존 식당을 조회하고, 
    상권정보에서 폐업한 것으로 간주될 경우 is_published = False 처리
    """
    # 아주 단순한 주소 매칭 (실제로는 정교한 토큰 비교 필요)
    # 여기서는 예시로 address 컬럼에 포함되는지 확인
    res = supabase.table('restaurants').select('id').ilike('address', f"%{address}%").execute()
    if res.data:
        for r in res.data:
            supabase.table('restaurants').update({'is_published': False}).eq('id', r['id']).execute()
        return len(res.data)
    return 0

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def upsert_youtube_channel(youtube_channel_id: str, name: str):
    """
    유튜브 채널 정보가 없으면 생성하고, 이미 존재하면 ID를 반환
    """
    if not youtube_channel_id:
        return None
        
    # 기존 채널 검사
    existing = supabase.table('channels').select('id').eq('youtube_channel_id', youtube_channel_id).execute()
    if existing.data:
        return existing.data[0]['id']
        
    # 신규 등록
    data = {
        "youtube_channel_id": youtube_channel_id,
        "name": name or "알 수 없는 채널"
    }
    res = supabase.table('channels').insert(data).execute()
    return res.data[0]['id'] if res.data else None

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def upsert_youtube_video(video_data: dict, channel_db_id: str):
    """
    유튜브 비디오 정보를 저장하거나 업데이트
    """
    youtube_video_id = video_data.get("youtube_video_id")
    if not youtube_video_id:
        return None
        
    data = {
        "channel_id": channel_db_id,
        "youtube_video_id": youtube_video_id,
        "title": video_data.get("title"),
        "thumbnail_url": video_data.get("thumbnail_url"),
        "view_count": video_data.get("view_count", 0),
        "published_at": video_data.get("published_at"),
        "is_short": video_data.get("is_short", False)
    }
    
    # 기존 비디오 검사
    existing = supabase.table('videos').select('id').eq('youtube_video_id', youtube_video_id).execute()
    if existing.data:
        video_id = existing.data[0]['id']
        res = supabase.table('videos').update(data).eq('id', video_id).execute()
        return res.data[0]['id'] if res.data else video_id
        
    # 신규 등록
    res = supabase.table('videos').insert(data).execute()
    return res.data[0]['id'] if res.data else None

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def link_restaurant_video(restaurant_id: str, video_id: str, quote: str = None, mention_time: int = None):
    """
    식당과 유튜브 영상을 다대다 매핑 (restaurant_videos)
    """
    data = {
        "restaurant_id": restaurant_id,
        "video_id": video_id,
        "quote": quote,
        "mention_time": mention_time
    }
    
    # 이미 매핑되어 있는지 확인
    existing = supabase.table('restaurant_videos').select('*')\
        .eq('restaurant_id', restaurant_id)\
        .eq('video_id', video_id).execute()
        
    if existing.data:
        # 이미 매핑이 있으면 한줄평이나 멘션시간 등 업데이트
        update_data = {}
        if quote is not None:
            update_data["quote"] = quote
        if mention_time is not None:
            update_data["mention_time"] = mention_time
            
        if update_data:
            supabase.table('restaurant_videos').update(update_data)\
                .eq('restaurant_id', restaurant_id)\
                .eq('video_id', video_id).execute()
        return True
        
    # 신규 매핑 삽입
    supabase.table('restaurant_videos').insert(data).execute()
    return True

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def update_restaurant_summary_and_tags(restaurant_id: str, summary: str, tags: list[str]):
    """
    식당의 한눈에 보는 요약(description_summary) 및 분위기 태그(tags)를 업데이트합니다.
    """
    data = {
        "description_summary": summary,
        "tags": tags
    }
    res = supabase.table('restaurants').update(data).eq('id', restaurant_id).execute()
    return res.data[0] if res.data else None


