const postgres = require('postgres');

const connectionString = 'postgres://postgres.nfsezjbsdvqesdbulbic:Tnals77474%21@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function run() {
  try {
    console.log('--- SYSTEM DATABASE STATS CHECK ---');

    // 1. Overall table counts
    const [{ count: restCount }] = await sql`SELECT count(*)::int FROM restaurants`;
    const [{ count: chanCount }] = await sql`SELECT count(*)::int FROM channels`;
    const [{ count: vidCount }] = await sql`SELECT count(*)::int FROM videos`;
    const [{ count: mapCount }] = await sql`SELECT count(*)::int FROM restaurant_videos`;
    const [{ count: embCount }] = await sql`SELECT count(*)::int FROM restaurant_embeddings`;

    console.log(`Summary of Tables:`);
    console.log(` - Restaurants: ${restCount}`);
    console.log(` - Channels: ${chanCount}`);
    console.log(` - Videos: ${vidCount}`);
    console.log(` - Mappings (Restaurant-Video): ${mapCount}`);
    console.log(` - Embeddings: ${embCount}`);

    // 2. Count Naju vs Prestigious
    const [{ count: najuCount }] = await sql`SELECT count(*)::int FROM restaurants WHERE address LIKE '%나주%'`;
    const [{ count: seoulStationCount }] = await sql`SELECT count(*)::int FROM restaurants WHERE address NOT LIKE '%나주%'`;

    console.log(`\nGeographic Breakdown:`);
    console.log(` - Naju Restaurants: ${najuCount} (Expected: 24)`);
    console.log(` - Prestigious Restaurants (Nationwide + Seoul Station): ${seoulStationCount} (Expected: 14)`);

    // 3. Verification of 14 prestigious restaurants
    const targetNames = [
      '유즈라멘',
      '호수집',
      '도동집',
      '오근내7닭갈비',
      '일미장어',
      '서부족발',
      '명동칼국수',
      '서울역철도떡볶이',
      '충무칼국수',
      '그릴', // 티티그릴 or 그릴 in DB
      '해성막창집 본점',
      '중앙떡볶이',
      '영미오리탕',
      '가보정'
    ];

    console.log('\n--- VERIFYING 14 PRESTIGIOUS RESTAURANTS ---');
    let foundCount = 0;
    for (const name of targetNames) {
      // Use ILIKE or name search
      const rows = await sql`
        SELECT r.id, r.name, r.category, r.address, r.is_published, 
               v.title as video_title, v.is_short, rv.quote, re.embedding::text as emb_str
        FROM restaurants r
        LEFT JOIN restaurant_videos rv ON r.id = rv.restaurant_id
        LEFT JOIN videos v ON rv.video_id = v.id
        LEFT JOIN restaurant_embeddings re ON r.id = re.restaurant_id
        WHERE r.name ILIKE ${'%' + name + '%'}
      `;
      if (rows.length > 0) {
        foundCount++;
        const row = rows[0];
        const embDim = row.emb_str ? row.emb_str.split(',').length : 0;
        console.log(`[V] ${row.name} (Matched for query: "${name}")`);
        console.log(`    - Category: ${row.category}`);
        console.log(`    - Address: ${row.address}`);
        console.log(`    - Embedding Dimension: ${embDim}`);
        console.log(`    - Video: "${row.video_title}" | Shorts: ${row.is_short}`);
        console.log(`    - Quote: "${row.quote}"`);
      } else {
        console.log(`[X] NOT Found: ${name}`);
      }
    }
    console.log(`\nVerification Summary: Found ${foundCount} out of 14 expected query groups.`);

    // 4. Verify embedding dimensionalities
    const sampleEmbeddings = await sql`
      SELECT r.name, re.embedding::text as emb_str
      FROM restaurant_embeddings re
      JOIN restaurants r ON re.restaurant_id = r.id
      LIMIT 5
    `;
    console.log('\n--- SAMPLE EMBEDDING DIMENSION CHECK ---');
    for (const sample of sampleEmbeddings) {
      const dim = sample.emb_str ? sample.emb_str.split(',').length : 0;
      console.log(` - ${sample.name}: Dimension = ${dim}`);
    }

  } catch (err) {
    console.error('Error checking stats:', err);
  } finally {
    await sql.end();
  }
}

run();
