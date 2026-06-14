import aiohttp
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential
from config import KAKAO_REST_API_KEY

from transformers.geo_utils import address_to_coordinates

KAKAO_LOCAL_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=1, max=5))
async def resolve_kakao_place_id(session: aiohttp.ClientSession, name: str, address: str, lon: float = None, lat: float = None):
    """
    카카오 로컬 API '키워드 장소 검색'을 호출하여 kakao_place_id와 phone, 그리고 정밀 좌표를 반환합니다.
    주소 근처 500m 이내 반경 검색을 적용하여 오매칭을 방지하고, 좌표가 없을 경우 지오코딩 Fallback을 수행합니다.
    """
    headers = {
        "Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"
    }
    
    # 1. 위경도가 없는 경우 지오코딩 시도
    if not lon or not lat:
        lon, lat = await address_to_coordinates(session, address)
        
    # 주소 앞 3단어(시/도, 시/군/구, 동/읍/면) 추출로 오매칭 방지
    addr_parts = address.split() if address else []
    addr_prefix = " ".join(addr_parts[:3]) if len(addr_parts) >= 3 else (address or "")
    query = f"{addr_prefix} {name}".strip()
    if not query:
        query = name
        
    params = {
        "query": query,
        "size": 1
    }
    
    # 2. 위경도 좌표가 존재하는 경우 반경 500m 이내 검색 적용
    if lon and lat:
        params["x"] = str(lon)
        params["y"] = str(lat)
        params["radius"] = 500  # 500미터 반경
        
    async with session.get(KAKAO_LOCAL_SEARCH_URL, headers=headers, params=params) as response:
        response.raise_for_status()
        data = await response.json()
        documents = data.get("documents", [])
        is_fallback = False
        if not documents:
            # Fallback 1: 반경 제한을 풀고 주소+가게명 검색 시도
            is_fallback = True
            if "radius" in params:
                del params["x"]
                del params["y"]
                del params["radius"]
            async with session.get(KAKAO_LOCAL_SEARCH_URL, headers=headers, params=params) as fb1_response:
                fb1_response.raise_for_status()
                fb1_data = await fb1_response.json()
                documents = fb1_data.get("documents", [])
                
        if not documents:
            # Fallback 2: 그냥 가게명으로만 검색 시도
            is_fallback = True
            params["query"] = name
            if "radius" in params:
                del params["x"]
                del params["y"]
                del params["radius"]
            async with session.get(KAKAO_LOCAL_SEARCH_URL, headers=headers, params=params) as fb2_response:
                fb2_response.raise_for_status()
                fb2_data = await fb2_response.json()
                documents = fb2_data.get("documents", [])
                
        if documents:
            doc = documents[0]
            return (
                doc.get("id"), 
                doc.get("phone", ""), 
                float(doc.get("x")), 
                float(doc.get("y")), 
                doc.get("place_name", ""),
                doc.get("category_name", ""),
                is_fallback
            )
            
        return None, "", None, None, "", "", False

if __name__ == "__main__":
    async def test():
        async with aiohttp.ClientSession() as session:
            place_id, phone, lon, lat = await resolve_kakao_place_id(session, "스타벅스 역삼대로점", "서울 강남구 역삼동")
            print("Result:", place_id, phone, lon, lat)
            
    asyncio.run(test())
