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
    await conn.execute('CREATE EXTENSION IF NOT EXISTS vector;')
    print("Enabled vector extension.")
    await conn.execute('''
    CREATE TABLE IF NOT EXISTS restaurant_embeddings (
      restaurant_id   UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
      embedding       vector(768) NOT NULL,
      source_text     TEXT,
      updated_at      TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE restaurant_embeddings DISABLE ROW LEVEL SECURITY;
    ''')
    print("Created restaurant_embeddings table and disabled RLS.")
    await conn.execute('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS image_url TEXT;')
    print("Added image_url column.")
    await conn.execute('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS description_summary TEXT;')
    print("Added description_summary column.")
    await conn.execute('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tags TEXT[];')
    print("Added tags column.")
    await conn.execute("NOTIFY pgrst, 'reload schema';")
    print("Reloaded PostgREST schema cache.")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(run())
