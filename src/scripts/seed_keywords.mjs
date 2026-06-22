import postgres from 'postgres';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL')).split('=')[1].replace(/"/g, '').trim();
const sql = postgres(dbUrl, { ssl: 'require' });

async function seed() {
  await sql`UPDATE restaurant_videos SET keywords = '["웨이팅 필수", "갓성비", "해장 끝판왕"]'::jsonb WHERE quote IS NOT NULL`;
  console.log('Seeded keywords for existing videos.');
  process.exit(0);
}
seed();
