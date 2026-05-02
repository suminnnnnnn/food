
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def debug():
    async with engine.connect() as conn:
        print("--- YouTubers ---")
        y = await conn.execute(text("SELECT * FROM youtubers"))
        print(y.fetchall())
        
        print("--- Restaurants ---")
        r = await conn.execute(text("SELECT id, name FROM harness_restaurants"))
        print(r.fetchall())
        
        print("--- Videos ---")
        v = await conn.execute(text("SELECT id, youtuber_id, restaurant_id FROM harness_videos"))
        print(v.fetchall())

if __name__ == "__main__":
    asyncio.run(debug())
