import asyncio
import aiohttp
import os
import sys
import subprocess
from urllib.parse import unquote
from config import TOUR_API_KEY

async def check_api_status(session: aiohttp.ClientSession) -> bool:
    url = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2"
    params = {
        "serviceKey": unquote(TOUR_API_KEY) if "%" in TOUR_API_KEY else TOUR_API_KEY,
        "numOfRows": 1,
        "pageNo": 1,
        "MobileOS": "ETC",
        "MobileApp": "ModooMatjip",
        "_type": "json",
        "arrange": "A",
        "contentTypeId": "39",
        "lDongRegnCd": "46",
        "lDongSignguCd": "170"
    }
    try:
        async with session.get(url, params=params, timeout=10) as response:
            if response.status == 200:
                data = await response.json()
                code = data.get("response", {}).get("header", {}).get("resultCode")
                if code == "0000":
                    return True
    except Exception:
        pass
    return False

async def monitor():
    print("TourAPI 장애 복구 자동 모니터링 데몬이 시작되었습니다.")
    print("3분 간격으로 API 핑을 시도하며, 복구 감지 즉시 나주 식당 파이프라인을 기동합니다.")
    
    async with aiohttp.ClientSession() as session:
        while True:
            is_recovered = await check_api_status(session)
            if is_recovered:
                print("\n[!] TourAPI 복구가 감지되었습니다! 나주시 데이터 적재 파이프라인을 기동합니다.")
                try:
                    # main_pipeline.py --naju 실행
                    python_bin = os.path.join("venv", "Scripts", "python")
                    process = subprocess.run([python_bin, "-m", "main_pipeline", "--naju"], capture_output=True, text=True, encoding="utf-8")
                    print("--- 파이프라인 실행 완료 ---")
                    print("STDOUT:", process.stdout)
                    print("STDERR:", process.stderr)
                    print("[!] 나주시 20개 식당 데이터 적재 및 검증이 완료되었습니다. 모니터링을 종료합니다.")
                except Exception as e:
                    print(f"파이프라인 실행 중 오류 발생: {e}")
                break
            else:
                print(".", end="", flush=True)
                await asyncio.sleep(180) # 3분 대기

if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    asyncio.run(monitor())
