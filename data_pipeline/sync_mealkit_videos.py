import os
import sys
import argparse
import time
import logging
from dotenv import load_dotenv

# Ensure we can import from data_pipeline root
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from extractors.mealkit_extractor import search_mealkit_videos_fallback, extract_products_with_gemini, generate_coupang_search_url
from loaders.supabase_loader import supabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("SyncMealkitVideos")

def sync_mealkit_videos(limit: int = 5, query: str = "인기 밀키트 추천 리뷰", test_only: bool = False):
    logger.info(f"Searching YouTube for: '{query}' (limit: {limit})")
    
    videos = search_mealkit_videos_fallback(query, limit)
    
    if not videos:
        logger.warning("No videos found.")
        return

    for idx, video in enumerate(videos):
        logger.info(f"[{idx+1}/{len(videos)}] Processing Video: '{video['title']}' (Views: {video['view_count']})")
        
        products = extract_products_with_gemini(video)
        logger.info(f"Extracted {len(products)} products.")
        
        if test_only:
            print(f"Video: {video['title']}")
            for p in products:
                print(f" - Product: {p.get('product_name')} (Brand: {p.get('brand')})")
                print(f"   URL: {generate_coupang_search_url(p.get('product_name', ''))}")
            print("-" * 40)
            time.sleep(1)
            continue
            
        if not supabase:
            logger.error("Supabase client not initialized.")
            continue
            
        # 1. Insert Video
        video_data = {
            "youtube_video_id": video["youtube_video_id"],
            "title": video["title"],
            "description": video["description"],
            "thumbnail_url": video["thumbnail_url"],
            "channel_title": video["channel_title"],
            "view_count": video["view_count"],
            "published_at": video["published_at"]
        }
        
        # Check existing
        existing_video = supabase.table("affiliate_videos").select("id").eq("youtube_video_id", video["youtube_video_id"]).execute()
        
        video_db_id = None
        if existing_video.data:
            video_db_id = existing_video.data[0]["id"]
            supabase.table("affiliate_videos").update(video_data).eq("id", video_db_id).execute()
        else:
            res = supabase.table("affiliate_videos").insert(video_data).execute()
            if res.data:
                video_db_id = res.data[0]["id"]
            
        if not video_db_id:
            logger.error(f"Failed to upsert video: {video['title']}")
            continue
            
        # 2. Insert Products
        # First, delete old products for this video to avoid duplicates
        supabase.table("affiliate_products").delete().eq("video_id", video_db_id).execute()
        
        for p in products:
            product_name = p.get("product_name")
            if not product_name:
                continue
                
            product_data = {
                "video_id": video_db_id,
                "product_name": product_name,
                "brand": p.get("brand", ""),
                "search_url": generate_coupang_search_url(product_name)
            }
            supabase.table("affiliate_products").insert(product_data).execute()
            
        logger.info(f"Saved video and {len(products)} products to DB.")
        time.sleep(2)

if __name__ == "__main__":
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Sync top viewed YouTube meal kit videos and extract products.")
    parser.add_argument("--limit", type=int, default=3, help="Max number of videos to process.")
    parser.add_argument("--query", type=str, default="밀키트 리뷰 추천", help="Search query.")
    parser.add_argument("--test-only", action="store_true", help="Print extracted data without saving to DB.")
    
    args = parser.parse_args()
    
    sync_mealkit_videos(limit=args.limit, query=args.query, test_only=args.test_only)
