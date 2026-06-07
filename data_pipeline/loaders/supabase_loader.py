from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY
from tenacity import retry, stop_after_attempt, wait_exponential

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def upsert_restaurant(data: dict):
    """
    동기 Supabase Client를 이용하여 식당 정보 UPSERT (kakao_place_id를 기준키로 사용하기 보다는 
    보통 id나 kakao_place_id conflict를 피하기 위해 먼저 조회하거나 ON CONFLICT 사용)
    supabase-py의 upsert는 primary key나 unique constraint 기반으로 동작.
    """
    # 1. kakao_place_id로 기존 레코드 확인 (중복 방지)
    kakao_id = data.get('kakao_place_id')
    if kakao_id:
        existing = supabase.table('restaurants').select('id').eq('kakao_place_id', kakao_id).execute()
        if existing.data:
            # Update
            restaurant_id = existing.data[0]['id']
            res = supabase.table('restaurants').update(data).eq('id', restaurant_id).execute()
            return res.data[0] if res.data else None
            
    # Insert (또는 unique 제약조건에 의한 에러 대비)
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
