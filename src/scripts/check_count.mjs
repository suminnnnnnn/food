import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, {ssl:'require'});
sql`SELECT COUNT(*) FROM restaurants`.then(r => {console.log(r); process.exit(0)});
