import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    load_dotenv("../.env.local")
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def check():
    if not supabase_url or not supabase_key:
        print("Supabase URL or Key is missing in environment variables.")
        return
        
    client: Client = create_client(supabase_url, supabase_key)
    response = client.table("restaurants").select("*").like("address", "%나주%").execute()
    data = response.data
    print(f"Total Naju restaurants found: {len(data)}")
    for idx, row in enumerate(data):
        print(f"\n[{idx+1}] {row.get('name')}")
        print(f" - 주소: {row.get('address')}")
        print(f" - 카테고리: {row.get('category')}")
        print(f" - 연락처: {row.get('phone')}")
        print(f" - 한줄요약: {row.get('description_summary')}")
        print(f" - 태그: {row.get('tags')}")
        print(f" - 메뉴: {row.get('menu_info')}")
        print(f" - 공개여부: {row.get('is_published')}")

if __name__ == "__main__":
    asyncio.run(check())
