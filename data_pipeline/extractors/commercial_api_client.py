import aiohttp
import asyncio
import json
from tenacity import retry, stop_after_attempt, wait_exponential
from config import COMMERCIAL_API_KEY
from urllib.parse import unquote

# 소상공인 상권정보 API (상가업소 조회)
COMMERCIAL_API_BASE_URL = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInUpjong"

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=10))
async def fetch_commercial_data(session: aiohttp.ClientSession, div_id: str, page_no: int, num_of_rows: int = 1000):
    """
    div_id: 대분류코드 (Q: 음식, D: 소매, N: 관광/여가/오락 등)
    """
    params = {
        "serviceKey": unquote(COMMERCIAL_API_KEY) if "%" in COMMERCIAL_API_KEY else COMMERCIAL_API_KEY,
        "pageNo": page_no,
        "numOfRows": num_of_rows,
        "divId": "indsLclsCd",
        "key": div_id,
        "type": "json"
    }
    
    async with session.get(COMMERCIAL_API_BASE_URL, params=params) as response:
        response.raise_for_status()
        data = await response.json()
        return data

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=10))
async def fetch_naju_commercial_data(session: aiohttp.ClientSession, page_no: int = 1, num_of_rows: int = 20) -> list:
    """
    나주시(시군구코드: 46170)에 위치한 음식점(대분류: I2) 상가 정보를 조회합니다.
    """
    url = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong"
    params = {
        "serviceKey": unquote(COMMERCIAL_API_KEY) if "%" in COMMERCIAL_API_KEY else COMMERCIAL_API_KEY,
        "pageNo": page_no,
        "numOfRows": num_of_rows,
        "divId": "signguCd",
        "key": "46170",  # 전남 나주시
        "type": "json"
    }
    
    try:
        async with session.get(url, params=params) as response:
            print(f"Response status: {response.status}")
            if response.status != 200:
                print(f"API Error Response: {await response.text()}")
                return []
            data = await response.json()
            print(f"Response JSON: {json.dumps(data, ensure_ascii=False)[:500]}...")
            items = data.get("body", {}).get("items", [])
            print(f"Items found: {len(items)}")
            
            results = []
            for item in items:
                # 음식 관련 분류 확인 (대분류 Q 또는 I2, 혹은 중분류명 음식 등)
                lcls_cd = item.get("indsLclsCd", "")
                mcls_nm = item.get("indsMclsNm", "")
                if lcls_cd in ["Q", "I2"] or "음식" in mcls_nm or "식당" in mcls_nm or "카페" in mcls_nm:
                    results.append({
                        "name": item.get("bizesNm", "").strip(),
                        "address": item.get("rdnmAdr", item.get("ldongAdr", "")).strip(),
                        "road_address": item.get("rdnmAdr", "").strip(),
                        "phone": "",
                        "menu_raw": f"인기 메뉴와 맛있는 음식을 취급하는 요식업소 {item.get('bizesNm', '')}입니다.",
                        "category": item.get("indsMclsNm", "").strip(),
                        "lat": item.get("lat"),
                        "lng": item.get("lon")
                    })
            return results
    except Exception as e:
        print(f"Error in fetch_naju_commercial_data: {e}")
        return []

async def extract_commercial_data():
    target_categories = ["I2", "G2", "R1"]
    async with aiohttp.ClientSession() as session:
        all_items = []
        for cat in target_categories:
            data = await fetch_commercial_data(session, div_id=cat, page_no=1)
            items = data.get("body", {}).get("items", [])
            all_items.extend(items)
        return all_items

if __name__ == "__main__":
    async def test():
        async with aiohttp.ClientSession() as session:
            items = await fetch_naju_commercial_data(session, num_of_rows=5)
            print(f"Fetched {len(items)} Naju restaurants:")
            for idx, item in enumerate(items):
                print(f" - {idx+1}: {item['name']} | Addr: {item['address']}")
    asyncio.run(test())
