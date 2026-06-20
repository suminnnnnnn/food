import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

async def run():
    url = os.getenv('DATABASE_URL').replace('+asyncpg', '')
    conn = await asyncpg.connect(url)
    rows = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'restaurants'")
    for r in rows:
        print(r['column_name'])
    await conn.close()

if __name__ == '__main__':
    asyncio.run(run())
