import aiohttp
import asyncio
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

async def extract_commercial_data():
    # 음식점(I2), 소매업(G2), 여가관련업(R1) - 최신 표준산업분류 기준 반영
    target_categories = ["I2", "G2", "R1"]
    
    async with aiohttp.ClientSession() as session:
        all_items = []
        for cat in target_categories:
            data = await fetch_commercial_data(session, div_id=cat, page_no=1)
            items = data.get("body", {}).get("items", [])
            all_items.extend(items)
        return all_items

if __name__ == "__main__":
    items = asyncio.run(extract_commercial_data())
    print(f"Fetched {len(items)} commercial items")
