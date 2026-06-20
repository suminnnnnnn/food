import asyncio
import aiohttp
import sys
from config import TOUR_API_KEY
from extractors.good_price_client import extract_gov_good_price_data

async def test():
    async with aiohttp.ClientSession() as session:
        # TOUR_API_KEY가 공공데이터포털 일반 인증키이므로 이를 재사용해 행안부 API에 요청을 날립니다.
        results = await extract_gov_good_price_data(session, TOUR_API_KEY, "전라남도", "나주시")
        print(f"총 {len(results)}개의 나주시 착한가격업소 데이터를 성공적으로 조회했습니다.")
        for idx, item in enumerate(results[:5]):
            print(f"[{idx+1}] {item['name']}")
            print(f" - 주소: {item['address']}")
            print(f" - 업종: {item['category']}")
            print(f" - 메뉴: {item['menu_info']}")

if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    asyncio.run(test())
