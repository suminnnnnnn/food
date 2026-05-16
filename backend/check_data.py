
import asyncio
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.models.video import HarnessVideo, HarnessRestaurant

async def check():
    async with AsyncSessionLocal() as db:
        v_count = await db.execute(select(func.count(HarnessVideo.id)))
        r_count = await db.execute(select(func.count(HarnessRestaurant.id)))
        print(f"Videos: {v_count.scalar()}")
        print(f"Restaurants: {r_count.scalar()}")
        
        # Sample data
        stmt = select(HarnessRestaurant).limit(5)
        result = await db.execute(stmt)
        for r in result.scalars():
            print(f"R: {r.name}, {r.category}, {r.reservation_url}")

if __name__ == "__main__":
    asyncio.run(check())
