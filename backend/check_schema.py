# path: backend/check_schema.py
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def check_schema():
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={
            "prepared_statement_cache_size": 0,
            "statement_cache_size": 0
        }
    )
    async with engine.connect() as conn:
        # 테이블 목록 조회
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """))
        tables = [row[0] for row in result.fetchall()]
        print(f"\n[Current Tables]: {tables}")

        # harness_restaurants 테이블 컬럼 확인
        if "harness_restaurants" in tables:
            result = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'harness_restaurants'"))
            columns = result.fetchall()
            print(f"\n[Harness Restaurants Columns]:")
            for col in columns:
                print(f" - {col[0]} ({col[1]})")

        # harness_videos 테이블 컬럼 확인
        if "harness_videos" in tables:
            result = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'harness_videos'"))
            columns = result.fetchall()
            print(f"\n[Harness Videos Columns]:")
            for col in columns:
                print(f" - {col[0]} ({col[1]})")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_schema())
