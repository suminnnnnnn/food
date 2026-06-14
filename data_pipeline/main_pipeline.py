import asyncio
import aiohttp
import sys
import logging
import json

from extractors.tourapi_client import extract_tour_data, fetch_tour_api_detail_intro
from extractors.commercial_api_client import extract_commercial_data
from extractors.good_price_client import extract_good_price_data
from transformers.geo_utils import parse_coordinates
from transformers.kakao_resolution import resolve_kakao_place_id
from transformers.ontology import map_category
from transformers.menu_parser import parse_menu_to_json
from transformers.summary_generator import generate_store_summary
from loaders.embedding_generator import generate_context_string, generate_embedding
from loaders.supabase_loader import upsert_restaurant, upsert_embedding, soft_delete_restaurant_by_address
from config import GEMINI_CALL_DELAY, BATCH_SIZE, BATCH_COOLDOWN

# 콘솔 한글 깨짐 방지
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("DataPipeline")

async def process_store_data(session: aiohttp.ClientSession, item_data: dict, source_name: str):
    """
    공통 맛집 데이터 처리 및 적재 파이프라인.
    지오코딩 보정, 반경 검색 기반 매칭 신뢰도 판별, LLM 메뉴/요약/태그 생성 및 Supabase 로드를 통합 수행합니다.
    """
    name = item_data.get("name", "")
    address = item_data.get("address", "")
    road_address = item_data.get("road_address", "")
    lat = item_data.get("lat")
    lng = item_data.get("lng")
    category = item_data.get("category", "")
    image_url = item_data.get("image_url", "")
    
    if not name:
        return

    # 1. 좌표 파싱
    try:
        lat_val = float(lat) if lat else None
        lng_val = float(lng) if lng else None
    except (ValueError, TypeError):
        lat_val, lng_val = None, None

    # 2. 카카오 API로 가게 정보 해소 (오매칭 판정을 위한 is_fallback 여부 포함)
    kakao_id, phone, kakao_lon, kakao_lat, kakao_name, kakao_category, is_fallback = await resolve_kakao_place_id(
        session, name, address, lng_val, lat_val
    )

    if not kakao_id:
        logger.info(f"[{source_name}] Kakao ID resolution failed for {name}. Skipping.")
        return

    # 카카오맵의 실제 상호명 및 카테고리로 정보 동기화
    if kakao_name:
        name = kakao_name
    if kakao_category:
        # 식음료 매장 검증 (오매칭 방어: 음식점/카페/제과점 등 식음 키워드가 카카오 카테고리에 포함되어야 함)
        allowed_categories = ["음식점", "카페", "제과점", "식당", "베이커리", "커피", "디저트", "호프", "술집", "치킨"]
        if not any(cat in kakao_category for cat in allowed_categories):
            logger.info(f"[{source_name}] Skipping non-restaurant category '{kakao_category}' for {name}.")
            return
            
        parts = kakao_category.split(" > ")
        if len(parts) >= 2:
            category = parts[1].strip()
        else:
            category = parts[0].strip()

    # 3. LLM 메뉴 정보 정형화
    raw_menu = item_data.get("menu_raw", "")
    menu_info_str = ""
    if raw_menu:
        parsed_menu = await parse_menu_to_json(raw_menu)
        if parsed_menu:
            menu_info_str = json.dumps(parsed_menu, ensure_ascii=False)

    # 4. LLM 요약글 및 분위기 태그 생성
    raw_desc = item_data.get("description_raw", "")
    summary_input_menu = raw_menu if raw_menu else item_data.get("menu_info", "")
    summary_res = await generate_store_summary(name, category, address, summary_input_menu, raw_desc)
    description_summary = summary_res.get("summary", "")
    tags = summary_res.get("tags", [])

    # 5. DB 적재 레코드 구축
    db_record = {
        "kakao_place_id": kakao_id,
        "name": name,
        "address": address,
        "road_address": road_address if road_address else address,
        "lat": kakao_lat if kakao_lat else lat_val,
        "lng": kakao_lon if kakao_lon else lng_val,
        "category": category,
        "image_url": image_url,
        "phone": phone if phone else item_data.get("phone", ""),
        "parking": item_data.get("parking", ""),
        "packaging": item_data.get("packaging", ""),
        "reservation": item_data.get("reservation", ""),
        "business_hours": item_data.get("business_hours", ""),
        "menu_info": menu_info_str if menu_info_str else item_data.get("menu_info", ""),
        "description_summary": description_summary,
        "tags": tags,
        "is_published": not is_fallback  # fallback이 발생한 불확실한 매칭 건은 비공개(False) 처리
    }

    # 6. Supabase Upsert 및 임베딩 적재
    try:
        saved_record = await asyncio.to_thread(upsert_restaurant, db_record)
        if saved_record and "id" in saved_record:
            restaurant_id = saved_record["id"]
            
            # 임베딩 생성 및 저장
            context = generate_context_string(db_record)
            embedding = await generate_embedding(context)
            await asyncio.to_thread(upsert_embedding, restaurant_id, embedding, context)
            logger.info(f"[{source_name}] Successfully processed and embedded: {name}")
    except Exception as e:
        import traceback
        logger.error(f"[{source_name}] Failed to save restaurant {name}: {e}\n{traceback.format_exc()}")
    finally:
        # API Rate Limit 초과 방지를 위한 강제 Cooldown
        await asyncio.sleep(GEMINI_CALL_DELAY)

async def process_tour_item_adapted(session: aiohttp.ClientSession, item: dict):
    """
    TourAPI 전용 중간 가공 어댑터.
    """
    lon, lat = parse_coordinates(item.get("mapx"), item.get("mapy"))
    raw_name = item.get("title", "")
    raw_addr = item.get("addr1", "")
    if not raw_name:
        return
        
    category = map_category("", raw_name)
    image_url = item.get("firstimage") or item.get("firstimage2") or ""

    # TourAPI 상세 정보 가져오기
    content_id = item.get("contentid")
    content_type_id = item.get("contenttypeid", "39")
    
    parking = ""
    packaging = ""
    reservation = ""
    business_hours = ""
    menu_raw = ""
    
    if content_id and content_type_id == "39":
        detail_intro = await fetch_tour_api_detail_intro(session, content_id, content_type_id)
        if detail_intro:
            parking = detail_intro.get("parkingfood", "")
            packaging = detail_intro.get("packing", "")
            reservation = detail_intro.get("reservationfood", "")
            business_hours = detail_intro.get("opentimefood", "")
            
            first = detail_intro.get("firstmenu", "")
            treat = detail_intro.get("treatmenu", "")
            if first and treat:
                menu_raw = f"대표메뉴: {first}\n취급메뉴: {treat}"
            elif first:
                menu_raw = f"대표메뉴: {first}"
            else:
                menu_raw = treat

    item_data = {
        "name": raw_name,
        "address": raw_addr,
        "road_address": item.get("addr2", ""),
        "lat": lat,
        "lng": lon,
        "category": category,
        "image_url": image_url,
        "parking": parking,
        "packaging": packaging,
        "reservation": reservation,
        "business_hours": business_hours,
        "menu_raw": menu_raw,
        "description_raw": raw_name  # TourAPI는 본문설명이 부실하므로 타이틀 전달
    }
    
    await process_store_data(session, item_data, "TourAPI")

def chunk_list(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

async def run_pipeline(naju_only: bool = False):
    logger.info("Starting ETL Pipeline...")
    
    async with aiohttp.ClientSession() as session:
        if not naju_only:
            # Phase 1: TourAPI Data
            logger.info("--- Phase 1: Extracting from TourAPI ---")
            try:
                tour_items = await extract_tour_data()
                logger.info(f"Fetched {len(tour_items)} items from TourAPI")
                
                # 테스트를 위해 상위 10개 데이터를 배치 분할 처리
                target_items = tour_items[:10]
                sem = asyncio.semaphore(2) if hasattr(asyncio, "semaphore") else asyncio.Semaphore(2)  # 카카오 및 제미나이 동시 호출 완화를 위해 Semaphore를 2로 낮춤
                
                async def sem_task(item):
                    async with sem:
                        await process_tour_item_adapted(session, item)
                
                chunks = list(chunk_list(target_items, BATCH_SIZE))
                for chunk_idx, chunk in enumerate(chunks):
                    logger.info(f"Processing TourAPI Chunk {chunk_idx+1}/{len(chunks)} (Size: {len(chunk)})")
                    await asyncio.gather(*(sem_task(item) for item in chunk))
                    if chunk_idx < len(chunks) - 1:
                        logger.info(f"Applying Batch Cooldown for {BATCH_COOLDOWN}s...")
                        await asyncio.sleep(BATCH_COOLDOWN)
            except Exception as e:
                logger.error(f"TourAPI pipeline failed: {e}")
                
            # Phase 2: Commercial Data (Soft Deletes)
            logger.info("--- Phase 2: Processing Commercial Data Deletions ---")
            try:
                comm_items = await extract_commercial_data()
                logger.info(f"Fetched {len(comm_items)} commercial items")
                deleted_count = 0
                for item in comm_items:
                    if item.get("bizesSttsCd") == "2":
                        addr = item.get("rdnmAdr") or item.get("ldongAdr")
                        if addr:
                            res = await asyncio.to_thread(soft_delete_restaurant_by_address, addr)
                            deleted_count += res
                logger.info(f"Soft deleted {deleted_count} restaurants")
            except Exception as e:
                logger.error(f"Commercial API pipeline failed: {e}")

            # Phase 3: Good Price Store Data
            logger.info("--- Phase 3: Processing Good Price Stores ---")
            try:
                good_items = await extract_good_price_data(session, start=1, end=10) # 10개 데이터 적재 테스트
                logger.info(f"Fetched {len(good_items)} items from Good Price API")
                
                sem = asyncio.Semaphore(2)
                async def sem_task_good(item):
                    async with sem:
                        await process_store_data(session, item, "GoodPrice")
                
                good_chunks = list(chunk_list(good_items, BATCH_SIZE))
                for chunk_idx, chunk in enumerate(good_chunks):
                    logger.info(f"Processing GoodPrice Chunk {chunk_idx+1}/{len(good_chunks)} (Size: {len(chunk)})")
                    await asyncio.gather(*(sem_task_good(item) for item in chunk))
                    if chunk_idx < len(good_chunks) - 1:
                        logger.info(f"Applying Batch Cooldown for {BATCH_COOLDOWN}s...")
                        await asyncio.sleep(BATCH_COOLDOWN)
            except Exception as e:
                logger.error(f"Good Price pipeline failed: {e}")
        else:
            logger.info("Skipping Phase 1, 2, and 3 as --naju is enabled.")

        # Phase 4: Naju TourAPI Restaurant Data
        if naju_only:
            logger.info("--- Phase 4: Processing Naju TourAPI Restaurants ---")
            try:
                from extractors.tourapi_client import fetch_naju_tour_data
                naju_items = await fetch_naju_tour_data(session, page_no=1, num_of_rows=40)
                logger.info(f"Fetched {len(naju_items)} items from Naju TourAPI")
                
                # 테스트를 위해 상위 20개만 처리
                target_naju_items = naju_items[:20]
                sem = asyncio.Semaphore(2)
                async def sem_task_naju(item):
                    async with sem:
                        await process_tour_item_adapted(session, item)
                
                naju_chunks = list(chunk_list(target_naju_items, BATCH_SIZE))
                for chunk_idx, chunk in enumerate(naju_chunks):
                    logger.info(f"Processing Naju Chunk {chunk_idx+1}/{len(naju_chunks)} (Size: {len(chunk)})")
                    await asyncio.gather(*(sem_task_naju(item) for item in chunk))
                    if chunk_idx < len(naju_chunks) - 1:
                        logger.info(f"Applying Batch Cooldown for {BATCH_COOLDOWN}s...")
                        await asyncio.sleep(BATCH_COOLDOWN)
            except Exception as e:
                logger.error(f"Naju TourAPI pipeline failed: {e}")
                
            # Phase 4.5: Processing Naju Government Good Price Restaurants
            logger.info("--- Phase 4.5: Processing Naju Government Good Price Restaurants ---")
            try:
                from extractors.good_price_client import extract_gov_good_price_data
                from config import TOUR_API_KEY
                
                gov_good_items = await extract_gov_good_price_data(session, TOUR_API_KEY, "전라남도", "나주시")
                logger.info(f"Fetched {len(gov_good_items)} Gov Good Price items for Naju")
                
                sem = asyncio.Semaphore(2)
                async def sem_task_gov_good(item):
                    menu_info_str = json.dumps(item["menu_info"], ensure_ascii=False) if item.get("menu_info") else ""
                    
                    item_data = {
                        "name": item["name"],
                        "address": item["address"],
                        "road_address": item["address"],
                        "lat": item["lat"],
                        "lng": item["lng"],
                        "category": item["category"],
                        "image_url": "",
                        "phone": item["phone"],
                        "parking": "",
                        "packaging": "",
                        "reservation": "",
                        "business_hours": "",
                        "menu_info": menu_info_str,
                        "menu_raw": "", # Gemini 파싱 건너뜀
                        "description_raw": item["name"] # 한눈에 보는 요약 생성에 사용
                    }
                    async with sem:
                        await process_store_data(session, item_data, "GovGoodPrice")
                        
                gov_chunks = list(chunk_list(gov_good_items, BATCH_SIZE))
                for chunk_idx, chunk in enumerate(gov_chunks):
                    logger.info(f"Processing GovGoodPrice Chunk {chunk_idx+1}/{len(gov_chunks)} (Size: {len(chunk)})")
                    await asyncio.gather(*(sem_task_gov_good(item) for item in chunk))
                    if chunk_idx < len(gov_chunks) - 1:
                        logger.info(f"Applying Batch Cooldown for {BATCH_COOLDOWN}s...")
                        await asyncio.sleep(BATCH_COOLDOWN)
            except Exception as e:
                logger.error(f"Naju Gov Good Price pipeline failed: {e}")
            
    logger.info("ETL Pipeline completed.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Modoo Matjip ETL Pipeline")
    parser.add_argument("--naju", action="store_true", help="Run Naju commercial data collection test only")
    args = parser.parse_args()
    
    asyncio.run(run_pipeline(naju_only=args.naju))
