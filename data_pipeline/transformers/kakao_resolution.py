import aiohttp
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential
from config import KAKAO_REST_API_KEY

KAKAO_LOCAL_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=1, max=5))
async def resolve_kakao_place_id(session: aiohttp.ClientSession, name: str, address: str):
    """
    카카오 로컬 API '키워드 장소 검색'을 호출하여 kakao_place_id와 phone을 반환합니다.
    주소와 이름을 조합하여 검색 퀄리티를 높입니다.
    """
    headers = {
        "Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"
    }
    
    # query는 주소 동 + 가게명으로 구성하면 정확도가 올라감 (예: 역삼동 스타벅스)
    # 간단히 name과 address 일부를 조합
    address_dong = address.split(" ")[-1] if address else ""
    query = f"{address_dong} {name}".strip()
    if not query:
        query = name
        
    params = {
        "query": query,
        "size": 1
    }
    
    async with session.get(KAKAO_LOCAL_SEARCH_URL, headers=headers, params=params) as response:
        response.raise_for_status()
        data = await response.json()
        
        documents = data.get("documents", [])
        if not documents:
            # Fallback to just name
            params["query"] = name
            async with session.get(KAKAO_LOCAL_SEARCH_URL, headers=headers, params=params) as fb_response:
                fb_response.raise_for_status()
                fb_data = await fb_response.json()
                documents = fb_data.get("documents", [])
                
        if documents:
            # 첫 번째 결과의 id와 phone 반환
            return documents[0].get("id"), documents[0].get("phone", "")
            
        return None, ""

if __name__ == "__main__":
    async def test():
        async with aiohttp.ClientSession() as session:
            place_id, phone = await resolve_kakao_place_id(session, "스타벅스", "서울 강남구 역삼동")
            print("Kakao Place ID:", place_id, "Phone:", phone)
            
    asyncio.run(test())
