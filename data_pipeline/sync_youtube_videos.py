import os
import sys
import argparse
import time
import logging
from dotenv import load_dotenv

# 현재 디렉토리 및 상위 경로 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from loaders.supabase_loader import (
    supabase, 
    upsert_youtube_channel, 
    upsert_youtube_video, 
    link_restaurant_video,
    update_restaurant_summary_and_tags,
    upsert_embedding
)
from extractors.youtube_extractor import get_best_youtube_video
from loaders.embedding_generator import generate_context_string, generate_embedding

# 로그 설정
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("SyncYoutubeVideos")

# 콘솔 한글 깨짐 방지
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

def extract_sigungu(address: str) -> str:
    """
    주소 문자열에서 시군구 단위를 추출합니다.
    """
    if not address:
        return ""
    # 영문 주소의 쉼표 제거 및 공백 정규화
    address = address.replace(",", " ")
    parts = address.split()
    if len(parts) > 1:
        # 경기도 수원시 장안구 등 '시'와 '구'가 연속되는 주소 처리
        if len(parts) > 2 and parts[2].endswith(('구', '시', '군')):
            if parts[1].endswith(('시', '군')):
                return f"{parts[1]} {parts[2]}"
        
        candidate = parts[1]
        if candidate.endswith(('시', '군', '구')):
            return candidate
            
    # 첫 번째 토큰이 직접 시인 경우 (예: 세종특별자치시)
    if parts and parts[0].endswith(('시')):
        return parts[0]
        
    return parts[0] if parts else ""


def sync_videos(limit: int, restaurant_id: str = None, force: bool = False, query_test: bool = False, naju_only: bool = False):
    """
    맛집 리스트를 순회하며 유튜브 최다 조회수 영상을 동기화합니다.
    """
    logger.info("Starting YouTube video synchronization...")
    
    # 1. 대상 맛집 조회
    query_builder = supabase.table("restaurants").select("id, name, address, road_address")
    
    if restaurant_id:
        query_builder = query_builder.eq("id", restaurant_id)
    elif naju_only:
        query_builder = query_builder.or_("address.ilike.%나주%,road_address.ilike.%나주%")
        
    res = query_builder.execute()
    if not res.data:
        logger.info("No restaurants found.")
        return
        
    restaurants = res.data
    logger.info(f"Retrieved {len(restaurants)} restaurants from DB.")
    
    # 이미 영상이 연결된 식당 ID 확인 (force가 아닐 때 건너뛰기 위함)
    linked_restaurant_ids = set()
    if not force and not restaurant_id:
        linked_res = supabase.table("restaurant_videos").select("restaurant_id").execute()
        if linked_res.data:
            linked_restaurant_ids = {item["restaurant_id"] for item in linked_res.data}
            logger.info(f"Skipping {len(linked_restaurant_ids)} restaurants that already have linked videos.")

    processed_count = 0
    for idx, rest in enumerate(restaurants):
        rest_id = rest["id"]
        
        # 이미 연동된 식당 건너뛰기
        if rest_id in linked_restaurant_ids:
            continue
            
        if processed_count >= limit:
            logger.info(f"Reached limit of {limit} restaurants. Stopping.")
            break
            
        name = rest["name"]
        addr = rest["road_address"] or rest["address"]
        sigungu = extract_sigungu(addr)
        
        # 2. 검색 쿼리 조립 (맛집 키워드를 빼서 엉뚱한 맛집 리스트 영상 유입 차단)
        search_query = f"{sigungu} {name}" if sigungu else name
        
        logger.info(f"[{idx+1}/{len(restaurants)}] Processing: '{name}' | Addr: '{addr}' | Sigungu: '{sigungu}'")
        logger.info(f"Generated Search Query: '{search_query}'")
        
        if query_test:
            # DB 연동 없이 쿼리 조립 및 비디오 검색 테스트만 수행
            best_video = get_best_youtube_video(search_query, name, sigungu)
            if best_video:
                ai_info = best_video.get("ai_review", {})
                print(f"-> Found video: Title: '{best_video['title']}' | Views: {best_video['view_count']}")
                print(f"   AI Audit Score: {ai_info.get('confidence_score')} | Reason: {ai_info.get('reason')}")
            else:
                print("-> No video found.")
            processed_count += 1
            print("-" * 50)
            time.sleep(1.0) # Rate limit 방지
            continue
            
        # 3. 유튜브 최다 조회수 비디오 검색
        try:
            best_video = get_best_youtube_video(search_query, name, sigungu)

            if not best_video:
                logger.warning(f"No video found for query: '{search_query}'")
                continue
                
            # 4. DB 적재
            # 채널 upsert
            channel_id = best_video.get("channel_id")
            channel_title = best_video.get("channel_title") or "Unknown Channel"
            
            # 비공식 크롤러 결과에서 채널 ID가 없는 경우 대체
            if not channel_id:
                channel_id = f"custom_channel_{channel_title.replace(' ', '_')}"
                
            channel_db_id = upsert_youtube_channel(channel_id, channel_title)
            if not channel_db_id:
                logger.error(f"Failed to upsert channel for: {channel_title}")
                continue
                
            # 비디오 upsert
            video_db_id = upsert_youtube_video(best_video, channel_db_id)
            if not video_db_id:
                logger.error(f"Failed to upsert video: {best_video['title']}")
                continue
                
            # 매핑 연결
            ai_review = best_video.get("ai_review", {})
            ai_reason = ai_review.get("reason", "AI 검수 승인됨")
            success = link_restaurant_video(rest_id, video_db_id, quote=ai_reason)

            if success:
                logger.info(f"Successfully linked '{name}' to video '{best_video['title']}'")
                processed_count += 1
                
                # 맛집 리뷰 기반 요약글 및 분위기 태그 업데이트
                summary = ai_review.get("summary", "")
                tags = ai_review.get("tags", [])
                
                if summary or tags:
                    logger.info(f"Updating restaurant summary and tags for '{name}'...")
                    updated_rest = update_restaurant_summary_and_tags(rest_id, summary, tags)
                    
                    if updated_rest:
                        # 신규 요약글/태그가 반영된 임베딩(Vector) 갱신
                        try:
                            context = generate_context_string(updated_rest)
                            logger.info(f"Regenerating embedding for '{name}' with context: {context}")
                            import asyncio
                            embedding = asyncio.run(generate_embedding(context))
                            upsert_embedding(rest_id, embedding, context)
                            logger.info(f"Successfully updated embedding for '{name}'")
                        except Exception as emb_err:
                            logger.error(f"Failed to update embedding for '{name}': {emb_err}")
            else:
                logger.error(f"Failed to link restaurant '{name}' to video.")
                
        except Exception as e:
            logger.error(f"Error processing restaurant '{name}': {e}", exc_info=True)
            
        # API Rate Limit 방어용 간격
        time.sleep(2.0)
        
    logger.info(f"Process finished. Total processed: {processed_count} restaurants.")

if __name__ == "__main__":
    # 환경변수 로드
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Sync top viewed YouTube videos for restaurants.")
    parser.add_argument("--limit", type=int, default=10, help="Max number of restaurants to process in this run.")
    parser.add_argument("--restaurant_id", type=str, default=None, help="Process a single specific restaurant ID.")
    parser.add_argument("--force", action="store_true", help="Reprocess even if restaurant already has a linked video.")
    parser.add_argument("--query-test", action="store_true", help="Print generated query and best video without saving to DB.")
    parser.add_argument("--naju", action="store_true", help="Filter and process Naju restaurants only.")
    
    args = parser.parse_args()
    
    sync_videos(
        limit=args.limit,
        restaurant_id=args.restaurant_id,
        force=args.force,
        query_test=args.query_test,
        naju_only=args.naju
    )
