
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'youtubers'"))
        print(f"Youtubers Columns: {[row[0] for row in res]}")

if __name__ == "__main__":
    asyncio.run(check())
