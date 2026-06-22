import aiohttp
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential
from config import TOUR_API_KEY
from urllib.parse import unquote

# TourAPI 4.0 endpoint
TOUR_API_BASE_URL = "https://apis.data.go.kr/B551011/KorService2/areaBasedSyncList2"

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=10))
async def fetch_tour_api_sync_list(session: aiohttp.ClientSession, page_no: int, num_of_rows: int = 100, sync_status: str = "A"):
    """
    sync_status: A (Create), U (Update), D (Delete)
    """
    # TOUR_API_KEY might be url-encoded already, unquote it to pass safely if needed, or just pass as is.
    params = {
        "serviceKey": unquote(TOUR_API_KEY) if TOUR_API_KEY and "%" in TOUR_API_KEY else TOUR_API_KEY,
        "numOfRows": num_of_rows,
        "pageNo": page_no,
        "MobileOS": "ETC",
        "MobileApp": "ModooMatjip",
        "_type": "json",
        "showflag": 1
    }
    
    # We might need areaBasedSyncList1 or areaBasedSyncList2 depending on the API spec.
    # The prompt mentioned areaBasedSyncList2, but the official KorService1 has areaBasedSyncList1.
    # We'll use areaBasedSyncList1 but support URL override if needed.
    # But let's try with areaBasedSyncList1 which is the standard sync endpoint.
    
    url = "https://apis.data.go.kr/B551011/KorService2/areaBasedSyncList2"
    
    async with session.get(url, params=params) as response:
        response.raise_for_status()
        data = await response.json()
        return data

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=10))
async def fetch_tour_api_detail_intro(session: aiohttp.ClientSession, content_id: str, content_type_id: str = "39"):
    params = {
        "serviceKey": unquote(TOUR_API_KEY) if TOUR_API_KEY and "%" in TOUR_API_KEY else TOUR_API_KEY,
        "MobileOS": "ETC",
        "MobileApp": "ModooMatjip",
        "_type": "json",
        "contentId": content_id,
        "contentTypeId": content_type_id
    }
    
    url = "https://apis.data.go.kr/B551011/KorService2/detailIntro2"
    
    async with session.get(url, params=params) as response:
        try:
            response.raise_for_status()
            data = await response.json()
            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            return items[0] if items else None
        except Exception as e:
            # logging or return None
            return None

async def extract_tour_data():
    async with aiohttp.ClientSession() as session:
        # Example to fetch first page
        data = await fetch_tour_api_sync_list(session, page_no=1)
        items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
        return items

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=10))
async def fetch_naju_tour_data(session: aiohttp.ClientSession, page_no: int = 1, num_of_rows: int = 50) -> list:
    """
    TourAPI areaBasedList1을 호출하여 전라남도 나주시(areaCode=38, sigunguCode=4)의 음식점(contentTypeId=39) 정보를 수집합니다.
    """
    url = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2"
    params = {
        "serviceKey": unquote(TOUR_API_KEY) if TOUR_API_KEY and "%" in TOUR_API_KEY else TOUR_API_KEY,
        "numOfRows": num_of_rows,
        "pageNo": page_no,
        "MobileOS": "ETC",
        "MobileApp": "ModooMatjip",
        "_type": "json",
        "arrange": "A",
        "contentTypeId": "39",      # 음식점
        "lDongRegnCd": "46",         # 전남
        "lDongSignguCd": "170"     # 나주시 (법정동 시군구코드 3자리)
    }
    
    try:
        async with session.get(url, params=params) as response:
            print(f"TourAPI status: {response.status}")
            if response.status != 200:
                print(f"TourAPI error response: {await response.text()}")
                return []
            data = await response.json()
            print(f"TourAPI response JSON: {data}")
            print(f"TourAPI response JSON keys: {data.keys()}")
            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            if isinstance(items, dict):
                return [items]
            return items if isinstance(items, list) else []
    except Exception as e:
        print(f"Error fetching Naju TourAPI data: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    async def test():
        async with aiohttp.ClientSession() as session:
            items = await fetch_naju_tour_data(session, num_of_rows=5)
            print(f"Fetched {len(items)} Naju TourAPI items")
            for item in items:
                print(f" - {item.get('title')} | Addr: {item.get('addr1')}")
    asyncio.run(test())
