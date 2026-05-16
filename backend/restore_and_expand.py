# path: backend/restore_and_expand.py
import os
import asyncio
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

async def restore():
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0}
    )
    async with engine.begin() as conn:
        print("Restoring and Expanding Harness Map Schema...")

        # 1. PostGIS 확인
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))

        # 2. youtubers 테이블
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS youtubers (
                id UUID PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                channel_url TEXT,
                subscriber_count INTEGER,
                persona_description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # 3. harness_restaurants 테이블 (예약 컬럼 포함)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS harness_restaurants (
                id UUID PRIMARY KEY,
                kakao_place_id VARCHAR(50) UNIQUE,
                name VARCHAR(255) NOT NULL,
                address TEXT,
                category VARCHAR(100),
                location GEOMETRY(Point, 4326),
                total_heart_count INTEGER DEFAULT 0,
                reservation_url TEXT,
                platform_type VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # 4. harness_videos 테이블
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS harness_videos (
                id UUID PRIMARY KEY,
                youtuber_id UUID REFERENCES youtubers(id),
                restaurant_id UUID REFERENCES harness_restaurants(id),
                video_url TEXT NOT NULL,
                title TEXT,
                view_count INTEGER DEFAULT 0,
                upload_date DATE,
                seasonal_tags TEXT[],
                menu_items JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # 5. 시드 데이터 복구 및 예약 정보 추가
        y_id = uuid.uuid4()
        await conn.execute(text("INSERT INTO youtubers (id, name, persona_description) VALUES (:id, :name, :desc)"), 
                           {"id": y_id, "name": "하네스 가이드", "desc": "트렌디한 맛집을 소개합니다."})

        r_id = uuid.uuid4()
        await conn.execute(text("""
            INSERT INTO harness_restaurants (id, name, address, category, location, reservation_url, platform_type)
            VALUES (:id, :name, :address, :category, ST_SetSRID(ST_MakePoint(127.0276, 37.4979), 4326), :res_url, :p_type)
        """), {
            "id": r_id, "name": "강남 대방어 전문점", "address": "서울 강남구 역삼동 824-1", 
            "category": "해산물", "res_url": "https://app.catchtable.co.kr/ct/shop/example", "p_type": "catchtable"
        })

        await conn.execute(text("""
            INSERT INTO harness_videos (id, youtuber_id, restaurant_id, video_url, title, upload_date, seasonal_tags)
            VALUES (:vid, :yid, :rid, :vurl, :title, :date, :tags)
        """), {
            "vid": uuid.uuid4(), "yid": y_id, "rid": r_id, 
            "vurl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            "title": "역대급 겨울 대방어 해체쇼!", "date": date.today(), "tags": ["겨울", "제철"]
        })

        print("Restoration and Expansion successful!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(restore())
