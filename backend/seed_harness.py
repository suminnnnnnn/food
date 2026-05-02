
import os
import asyncio
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

async def seed():
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0}
    )
    async with AsyncSession(engine) as session:
        # 1. 유튜버 생성 (id, channel_name, persona_tags 사용)
        youtuber_id = uuid.uuid4()
        await session.execute(text("""
            INSERT INTO youtubers (id, channel_name, persona_tags)
            VALUES (:id, :name, :tags)
            ON CONFLICT (id) DO NOTHING
        """), {"id": youtuber_id, "name": "하네스 가이드", "tags": ["강남", "맛집", "트렌드"]})

        # 2. 맛집 리스트 (강남역 중심 1km 반경)
        restaurants = [
            {
                "id": uuid.uuid4(), "name": "강남 대방어 전문점", "category": "해산물", "lat": 37.4979, "lng": 127.0276,
                "res_url": "https://app.catchtable.co.kr/ct/shop/example1", "platform": "catchtable",
                "video_title": "역대급 겨울 대방어 해체쇼!", "tags": ["겨울", "제철", "방어"]
            },
            {
                "id": uuid.uuid4(), "name": "신논현 마라전설", "category": "중식", "lat": 37.5045, "lng": 127.0240,
                "res_url": "https://booking.naver.com/example2", "platform": "naver",
                "video_title": "눈물 쏙 빠지는 찐 마라탕", "tags": ["마라", "매운맛", "트렌드"]
            },
            {
                "id": uuid.uuid4(), "name": "역삼 흑돼지 하우스", "category": "한식", "lat": 37.4999, "lng": 127.0350,
                "res_url": "https://app.catchtable.co.kr/ct/shop/example3", "platform": "catchtable",
                "video_title": "육즙 팡팡 터지는 흑돼지 구이", "tags": ["삼겹살", "회식", "고기"]
            },
            {
                "id": uuid.uuid4(), "name": "강남 스시 오마카세", "category": "일식", "lat": 37.5010, "lng": 127.0310,
                "res_url": "https://app.catchtable.co.kr/ct/shop/example4", "platform": "catchtable",
                "video_title": "입에서 녹는 하이엔드 스시", "tags": ["오마카세", "데이트", "트렌드"]
            },
            {
                "id": uuid.uuid4(), "name": "논현 양꼬치 본점", "category": "중식", "lat": 37.5060, "lng": 127.0220,
                "res_url": None, "platform": None,
                "video_title": "맥주를 부르는 마성의 양꼬치", "tags": ["양꼬치", "야식", "매운맛"]
            }
        ]

        for r in restaurants:
            # 맛집 추가
            await session.execute(text("""
                INSERT INTO harness_restaurants (id, name, address, category, location, reservation_url, platform_type)
                VALUES (:id, :name, '서울 강남구 역삼동 ' || floor(random()*900+100), :category, 
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :res_url, :platform)
                ON CONFLICT (id) DO NOTHING
            """), r)
            
            # 비디오 추가
            await session.execute(text("""
                INSERT INTO harness_videos (id, youtuber_id, restaurant_id, video_url, title, upload_date, seasonal_tags)
                VALUES (:vid, :yid, :rid, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 
                        :title, :date, :tags)
                ON CONFLICT (id) DO NOTHING
            """), {
                "vid": uuid.uuid4(), "yid": youtuber_id, "rid": r["id"],
                "title": r["video_title"], "date": date.today(), "tags": r["tags"]
            })

        await session.commit()
        print(f"Successfully seeded {len(restaurants)} restaurants!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
