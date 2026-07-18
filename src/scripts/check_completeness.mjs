import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const [r] = await sql`
  SELECT count(*)::int total,
    count(*) FILTER (WHERE phone IS NOT NULL AND phone <> '정보 없음')::int phone,
    count(*) FILTER (WHERE menu_info IS NOT NULL AND menu_info <> '정보 없음')::int menu,
    count(*) FILTER (WHERE business_hours IS NOT NULL AND business_hours <> '정보 없음')::int hours,
    count(*) FILTER (WHERE reservation IS NOT NULL AND reservation <> '정보 없음')::int reservation,
    count(*) FILTER (WHERE parking IS NOT NULL AND parking <> '정보 없음')::int parking,
    count(*) FILTER (WHERE packaging IS NOT NULL AND packaging <> '정보 없음')::int packaging
  FROM restaurants`;
const [c] = await sql`SELECT count(*)::int total, count(*) FILTER (WHERE profile_image_url IS NOT NULL)::int with_profile, count(*) FILTER (WHERE subscriber_count IS NOT NULL)::int with_subs FROM channels`;
const [v] = await sql`SELECT count(*)::int videos FROM videos`;
console.log(`식당 ${r.total} | 전화 ${r.phone} | 메뉴 ${r.menu} | 영업시간 ${r.hours} | 예약 ${r.reservation} | 주차 ${r.parking} | 포장 ${r.packaging}`);
console.log(`채널 ${c.total} | 프로필 ${c.with_profile} | 구독자수 ${c.with_subs} | 영상 ${v.videos}`);
await sql.end(); process.exit(0);
