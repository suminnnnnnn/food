import postgres from 'postgres';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL')).split('=')[1].replace(/"/g, '').trim();
const sql = postgres(dbUrl, { ssl: 'require' });

async function run() {
  try {
    await sql`ALTER TABLE restaurant_videos ADD COLUMN IF NOT EXISTS keywords JSONB DEFAULT '[]'::jsonb;`;
    console.log('Successfully added keywords column to restaurant_videos');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
