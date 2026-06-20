import asyncio
import aiohttp
import os
import sys
from urllib.parse import unquote
from config import TOUR_API_KEY

async def test():
    async with aiohttp.ClientSession() as session:
        url = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2"
        params = {
            "serviceKey": unquote(TOUR_API_KEY) if "%" in TOUR_API_KEY else TOUR_API_KEY,
            "numOfRows": 40,
            "pageNo": 1,
            "MobileOS": "ETC",
            "MobileApp": "ModooMatjip",
            "_type": "json",
            "arrange": "A",
            "contentTypeId": "39",      # 음식점
            "lDongRegnCd": "46",         # 전남
            "lDongSignguCd": "170"     # 나주시
        }
        async with session.get(url, params=params) as response:
            print("Status:", response.status)
            text = await response.text()
            print("Response:", text[:1000])

if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    asyncio.run(test())
