import aiohttp
import logging

logger = logging.getLogger("GoodPriceClient")

SEOUL_GOOD_PRICE_URL = "http://openapi.seoul.go.kr:8088/{key}/json/ListPriceModelStoreService/{start}/{end}/"

SEOUL_GOOD_PRICE_URL = "http://openapi.seoul.go.kr:8088/{key}/json/ListPriceModelStoreService/{start}/{end}/"
GOV_GOOD_PRICE_API_URL = "https://api.odcloud.kr/api/3045247/v1/uddi:12a36b40-6230-4401-b647-b8456a789c7f"

async def extract_gov_good_price_data(session: aiohttp.ClientSession, key: str, target_sido: str = "전라남도", target_sigungu: str = "나주시") -> list:
    """
    행정안전부 전국 착한가격업소 표준 API를 호출하여 target_sido, target_sigungu에 해당하는 식당과 정형 메뉴/가격 데이터를 추출합니다.
    """
    from urllib.parse import unquote
    service_key = unquote(key) if key and "%" in key else key
    
    results = []
    page = 1
    per_page = 1000
    
    logger.info(f"Extracting Gov Good Price stores for {target_sido} {target_sigungu}...")
    
    while True:
        params = {
            "serviceKey": service_key,
            "page": page,
            "perPage": per_page,
            "returnType": "JSON"
        }
        try:
            async with session.get(GOV_GOOD_PRICE_API_URL, params=params) as response:
                if response.status != 200:
                    logger.error(f"Gov Good Price API HTTP error: {response.status}")
                    break
                
                data = await response.json()
                items = data.get("data", [])
                total_count = data.get("totalCount", 0)
                current_count = len(items)
                
                if current_count == 0:
                    break
                
                # 시도, 시군구 매칭 필터링
                for item in items:
                    sido = item.get("시도") or item.get("시/도") or ""
                    sigungu = item.get("시군") or item.get("시/군/구") or ""
                    
                    if target_sido in sido and target_sigungu in sigungu:
                        # 메뉴1~4, 가격1~4를 파싱하여 JSON menu_info 형식으로 생성
                        menus = []
                        for i in range(1, 5):
                            m_name = item.get(f"메뉴{i}")
                            m_price = item.get(f"가격{i}")
                            if m_name and m_name.strip() and m_name.strip() != "None" and m_name.strip() != "없음":
                                try:
                                    price_val = int(float(str(m_price).replace(",", "").strip())) if m_price else None
                                except (ValueError, TypeError):
                                    price_val = None
                                menus.append({
                                    "name": m_name.strip(),
                                    "price": price_val
                                })
                        
                        # 업종 필터 (외식업만 추출)
                        category = item.get("업종") or ""
                        if any(k in category for k in ["외식", "한식", "중식", "일식", "양식", "분식", "경양식", "기타"]):
                            name = item.get("업소명") or ""
                            address = item.get("주소(도로명 새주소 명기)") or item.get("주소") or ""
                            phone = item.get("연락처") or ""
                            results.append({
                                "name": name.strip(),
                                "address": address.strip() if isinstance(address, str) else "",
                                "phone": phone.strip() if isinstance(phone, str) else "",
                                "menu_info": menus, # 정형화된 JSON 리스트 객체 형태로 바로 저장 가능하게 반환
                                "category": category.strip(),
                                "lat": None, # 주소 기반 지오코딩 fallback을 위해 None 설정
                                "lng": None
                            })
                            
                if page * per_page >= total_count:
                    break
                page += 1
        except Exception as e:
            logger.error(f"Error fetching Gov Good Price page {page}: {e}")
            break
            
    logger.info(f"Successfully filtered {len(results)} Gov Good Price restaurants for {target_sido} {target_sigungu}")
    return results

async def extract_good_price_data(session: aiohttp.ClientSession, key: str = "sample", start: int = 1, end: int = 50) -> list:
    """
    서울시 착한가격업소 오픈 API를 통해 식당 및 메뉴 후보 정보를 수집합니다.
    """
    url = SEOUL_GOOD_PRICE_URL.format(key=key, start=start, end=end)
    
    try:
        async with session.get(url) as response:
            if response.status != 200:
                logger.error(f"Failed to fetch Good Price data: HTTP {response.status}")
                return get_dummy_good_price_data()
                
            text = await response.text()
            if "xml" in response.headers.get("content-type", "").lower() or text.strip().startswith("<"):
                logger.warning(f"Good Price API returned XML response/error. Using mock fallback. Response: {text[:150]}")
                return get_dummy_good_price_data()

            data = await response.json(content_type=None)
            service_result = data.get("ListPriceModelStoreService", {})
            row_data = service_result.get("row", [])
            
            logger.info(f"Fetched {len(row_data)} items from Good Price API")
            
            results = []
            for item in row_data:
                results.append({
                    "name": item.get("SH_NAME", "").strip(),
                    "address": item.get("SH_ADDR", "").strip(),
                    "phone": item.get("SH_PHONE", "").strip(),
                    "menu_raw": item.get("SH_PRIDE", "").strip(),
                    "category": item.get("INDUTY_CODE_SE_NAME", "").strip(),
                    "lat": item.get("LAT"),
                    "lng": item.get("LON")
                })
            return results
    except Exception as e:
        logger.warning(f"Error fetching Good Price data: {e}. Using mock fallback.")
        return get_dummy_good_price_data()

def get_dummy_good_price_data() -> list:
    """
    API 장애 시 파이프라인의 쿨다운 및 적재 흐름 테스트를 보장하기 위한 Mock 데이터를 제공합니다.
    """
    logger.info("Returning 7 dummy good price items for pipeline testing.")
    return [
        {
            "name": "일품짜장",
            "address": "서울 마포구 공덕동 10-1",
            "phone": "02-123-4567",
            "menu_raw": "대표메뉴: 짜장면 5000원, 짬뽕 6000원 / 취급메뉴: 탕수육 소 12000원",
            "category": "중식",
            "lat": 37.5432,
            "lng": 126.9543
        },
        {
            "name": "대박식당",
            "address": "서울 마포구 아현동 20-5",
            "phone": "02-987-6543",
            "menu_raw": "대표메뉴: 김치찌개 6000원, 된장찌개 6000원",
            "category": "한식",
            "lat": 37.5567,
            "lng": 126.9612
        },
        {
            "name": "가성비돈까스",
            "address": "서울 마포구 도화동 33-8",
            "phone": "02-456-7890",
            "menu_raw": "대표메뉴: 등심돈까스 7000원, 치즈돈까스 8500원",
            "category": "경양식",
            "lat": 37.5398,
            "lng": 126.9477
        },
        {
            "name": "착한칼국수",
            "address": "서울 서대문구 신촌동 44-1",
            "phone": "02-234-5678",
            "menu_raw": "대표메뉴: 손칼국수 5500원, 왕만두 6000원",
            "category": "한식",
            "lat": 37.5592,
            "lng": 126.9365
        },
        {
            "name": "소문난해장국",
            "address": "서울 종로구 묘동 55-2",
            "phone": "02-345-6789",
            "menu_raw": "대표메뉴: 뼈해장국 7000원, 선지해장국 6000원",
            "category": "한식",
            "lat": 37.5721,
            "lng": 126.9912
        },
        {
            "name": "삼청동라면",
            "address": "서울 종로구 화동 11-1",
            "phone": "02-567-8901",
            "menu_raw": "대표메뉴: 짬뽕라면 4500원, 치즈라면 4000원",
            "category": "분식",
            "lat": 37.5804,
            "lng": 126.9822
        },
        {
            "name": "원조떡볶이",
            "address": "서울 종로구 낙원동 22-9",
            "phone": "02-678-9012",
            "menu_raw": "대표메뉴: 쌀떡볶이 3000원, 모듬튀김 4000원",
            "category": "분식",
            "lat": 37.5735,
            "lng": 126.9885
        }
    ]

if __name__ == "__main__":
    import asyncio
    async def test():
        async with aiohttp.ClientSession() as session:
            stores = await extract_good_price_data(session, start=1, end=5)
            for idx, store in enumerate(stores):
                print(f"Store {idx+1}: {store['name']} | Addr: {store['address']} | Menu: {store['menu_raw'][:50]}...")
                
    asyncio.run(test())
