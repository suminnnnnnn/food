import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv('../.env.local')

async def run():
    url = os.getenv('DATABASE_URL').replace('+asyncpg', '')
    print("Connecting to DB...")
    conn = await asyncpg.connect(url)
    print("Connected. Altering table...")
    await conn.execute('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS image_url TEXT;')
    print("Added image_url column.")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(run())
