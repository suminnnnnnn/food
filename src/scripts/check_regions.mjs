import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, {ssl:'require'});
sql`SELECT region_1depth, region_2depth, region_3depth FROM restaurants LIMIT 10`.then(r => {console.log(r); process.exit(0)});
