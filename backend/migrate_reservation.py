# path: backend/migrate_reservation.py
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

async def migrate():
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0}
    )
    async with engine.connect() as conn:
        # 디버깅: 현재 DB 및 스키마 확인
        db_info = await conn.execute(text("SELECT current_database(), current_schema()"))
        info = db_info.fetchone()
        print(f"Connected to DB: {info[0]}, Schema: {info[1]}")

        # 테이블 존재 여부 재확인
        result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
        tables = [row[0] for row in result.fetchall()]
        print(f"Tables in 'public': {tables}")

        if "harness_restaurants" in tables:
            print("Starting migration: adding reservation columns to harness_restaurants...")
            await conn.execute(text("""
                ALTER TABLE "harness_restaurants" 
                ADD COLUMN IF NOT EXISTS reservation_url TEXT;
            """))
            await conn.execute(text("""
                ALTER TABLE "harness_restaurants" 
                ADD COLUMN IF NOT EXISTS platform_type VARCHAR(50);
            """))
            await conn.commit()
            print("Migration completed successfully!")
        else:
            print("Error: harness_restaurants table NOT found in this schema.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
