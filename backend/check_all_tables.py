# path: backend/check_all_tables.py
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

async def check():
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0}
    )
    async with engine.connect() as conn:
        print("\n--- Scanning All Schemas (Excluding System) ---")
        result = await conn.execute(text("""
            SELECT schemaname, tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename;
        """))
        for row in result.fetchall():
            schema, table = row[0], row[1]
            print(f" - {schema}.{table}")
            if schema == 'public' and table in ['youtubers', 'harness_restaurants', 'harness_videos']:
                cols = await conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{table}'"))
                col_names = [c[0] for c in cols.fetchall()]
                print(f"    Columns: {col_names}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
