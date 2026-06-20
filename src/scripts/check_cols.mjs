import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, {ssl:'require'});
sql`SELECT * FROM restaurants LIMIT 1`.then(r => {console.log(r); process.exit(0)});
