import asyncio
import aiohttp
import sys
import logging

from extractors.tourapi_client import extract_tour_data, fetch_tour_api_detail_intro
from extractors.commercial_api_client import extract_commercial_data
from transformers.geo_utils import parse_coordinates
from transformers.kakao_resolution import resolve_kakao_place_id
from transformers.ontology import map_category
from loaders.embedding_generator import generate_context_string, generate_embedding
from loaders.supabase_loader import upsert_restaurant, upsert_embedding, soft_delete_restaurant_by_address

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("DataPipeline")

async def process_tour_item(session: aiohttp.ClientSession, item: dict):
    # 1. Transform coordinates
    lon, lat = parse_coordinates(item.get("mapx"), item.get("mapy"))
    if not lon or not lat:
        logger.warning(f"Invalid coordinates for {item.get('title')}")
        return

    # 2. Extract basic info
    raw_name = item.get("title", "")
    raw_addr = item.get("addr1", "")
    if not raw_name:
        return
        
    # 3. Ontology mapping
    # TourAPI cat1, cat2, cat3... we can combine them or just use title
    # For simplicity, passing empty raw_category if not explicitly known
    category = map_category("", raw_name)
    
    # 4. Resolve Kakao Place ID & Phone
    kakao_id, phone = await resolve_kakao_place_id(session, raw_name, raw_addr)
    if not kakao_id:
        logger.info(f"Kakao ID resolution failed for {raw_name}")
        # 임시로 uuid나 자체 키 사용, 혹은 스킵 (여기서는 kakao_place_id 필수라면 스킵)
        return

    # Extract Image URL
    image_url = item.get("firstimage") or item.get("firstimage2") or ""

    # 4.5 Fetch Detail Intro from TourAPI
    content_id = item.get("contentid")
    content_type_id = item.get("contenttypeid", "39")
    
    parking = ""
    packaging = ""
    reservation = ""
    business_hours = ""
    menu_info = ""
    
    if content_id and content_type_id == "39":
        detail_intro = await fetch_tour_api_detail_intro(session, content_id, content_type_id)
        if detail_intro:
            parking = detail_intro.get("parkingfood", "")
            packaging = detail_intro.get("packing", "")
            reservation = detail_intro.get("reservationfood", "")
            business_hours = detail_intro.get("opentimefood", "")
            
            # Combine menu info
            first = detail_intro.get("firstmenu", "")
            treat = detail_intro.get("treatmenu", "")
            if first and treat:
                menu_info = f"대표메뉴: {first}\n취급메뉴: {treat}"
            elif first:
                menu_info = f"대표메뉴: {first}"
            else:
                menu_info = treat

    # 5. Prepare DB Record
    db_record = {
        "kakao_place_id": kakao_id,
        "name": raw_name,
        "address": raw_addr,
        "road_address": item.get("addr2", ""), # or from kakao local result
        "lat": lat,
        "lng": lon,
        "category": category,
        "image_url": image_url,
        "phone": phone,
        "parking": parking,
        "packaging": packaging,
        "reservation": reservation,
        "business_hours": business_hours,
        "menu_info": menu_info,
        "is_published": True
    }
    
    # 6. Upsert to Supabase
    try:
        saved_record = await asyncio.to_thread(upsert_restaurant, db_record)
        if saved_record and "id" in saved_record:
            restaurant_id = saved_record["id"]
            
            # 7. Generate Embedding
            context = generate_context_string(db_record)
            embedding = await generate_embedding(context)
            
            # 8. Save Embedding
            await asyncio.to_thread(upsert_embedding, restaurant_id, embedding, context)
            logger.info(f"Successfully processed and embedded: {raw_name}")
    except Exception as e:
        logger.error(f"Failed to process {raw_name}: {e}")

async def run_pipeline():
    logger.info("Starting ETL Pipeline...")
    
    async with aiohttp.ClientSession() as session:
        # Phase 1: TourAPI Data Extraction & Processing
        logger.info("Extracting from TourAPI...")
        try:
            tour_items = await extract_tour_data()
            logger.info(f"Fetched {len(tour_items)} items from TourAPI")
            
            tasks = []
            for item in tour_items:
                tasks.append(process_tour_item(session, item))
            
            # Batch execution with concurrency limit to respect rate limits
            sem = asyncio.Semaphore(5) # limit concurrent API calls
            
            async def sem_task(t):
                async with sem:
                    await t
                    
            await asyncio.gather(*(sem_task(t) for t in tasks))
        except Exception as e:
            logger.error(f"TourAPI pipeline failed: {e}")
            
        # Phase 2: Commercial Data (Soft Deletes)
        logger.info("Extracting from Commercial API for Deletions...")
        try:
            comm_items = await extract_commercial_data()
            logger.info(f"Fetched {len(comm_items)} commercial items")
            # Logic to find closed stores (e.g. comparing bizesSttsCd, or diff with existing)
            # This is a stub for soft deleting. If the data is large, we should process in chunks.
            # For demonstration, let's say items have closed status
            deleted_count = 0
            for item in comm_items:
                # bizesSttsCd '2' usually means closed in some commercial datasets, or we use our own diff logic
                if item.get("bizesSttsCd") == "2":
                    addr = item.get("rdnmAdr") or item.get("ldongAdr")
                    if addr:
                        res = await asyncio.to_thread(soft_delete_restaurant_by_address, addr)
                        deleted_count += res
            logger.info(f"Soft deleted {deleted_count} restaurants")
        except Exception as e:
            logger.error(f"Commercial API pipeline failed: {e}")
            
    logger.info("ETL Pipeline completed.")

if __name__ == "__main__":
    asyncio.run(run_pipeline())
