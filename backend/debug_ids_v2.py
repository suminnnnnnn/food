
import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql+asyncpg://")

# Disable all logging
logging.getLogger('sqlalchemy').setLevel(logging.ERROR)

async def debug():
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={
            "prepared_statement_cache_size": 0,
            "statement_cache_size": 0
        }
    )
    async with engine.connect() as conn:
        print("--- YouTubers ---")
        y = await conn.execute(text("SELECT id, channel_name FROM youtubers"))
        rows = y.fetchall()
        for row in rows:
            print(f"Y: {row}")
        
        print("\n--- Videos ---")
        v = await conn.execute(text("SELECT id, youtuber_id, restaurant_id FROM harness_videos"))
        rows = v.fetchall()
        for row in rows:
            print(f"V: {row}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(debug())
