const postgres = require('postgres');
const sql = postgres('postgres://postgres.nfsezjbsdvqesdbulbic:Tnals77474%21@aws-1-ap-south-1.pooler.supabase.com:6543/postgres');

const parseAddress = (addr) => {
  if (!addr) return { a1: null, a2: null, a3: null };
  const tokens = addr.split(' ');
  let a1 = tokens[0] || null;
  let a2 = tokens[1] || null;
  let a3 = tokens[2] || null;
  
  if (a1 === '서울') a1 = '서울특별시';
  else if (a1 === '부산') a1 = '부산광역시';
  else if (a1 === '대구') a1 = '대구광역시';
  else if (a1 === '인천') a1 = '인천광역시';
  else if (a1 === '광주') a1 = '광주광역시';
  else if (a1 === '대전') a1 = '대전광역시';
  else if (a1 === '울산') a1 = '울산광역시';
  else if (a1 === '세종') a1 = '세종특별자치시';
  else if (a1 === '경기') a1 = '경기도';
  else if (a1 === '강원') a1 = '강원도';
  else if (a1 === '충북') a1 = '충청북도';
  else if (a1 === '충남') a1 = '충청남도';
  else if (a1 === '전북') a1 = '전라북도';
  else if (a1 === '전남') a1 = '전라남도';
  else if (a1 === '경북') a1 = '경상북도';
  else if (a1 === '경남') a1 = '경상남도';
  else if (a1 === '제주') a1 = '제주특별자치도';

  // 광역시/특별시/특별자치시가 아닌 '도' 하위 지역 중, a2가 '시'로 끝나고 a3가 '구'로 시작하는 경우 (예: 경기 수원시 팔달구 우만동)
  // 이때 a2는 자치구가 아닌 행정구가 속한 일반시(수원시 등)가 되며, a2 자체를 수원시로 유지하고 a3의 구 정보는 클러스터링 수준에서 일반시로 단일화함.
  if (a2 && a2.endsWith('시') && a3 && a3.endsWith('구')) {
    // a3가 구(예: 팔달구)이면 region_2depth에 수원시(a2)를 대입하고, region_3depth에 구(a3) 또는 그 이하 주소를 넘김
    // 여기서는 일반시 단위로 클러스터링되도록 a2는 그대로 두고 a3는 그 하위 토큰 또는 동 정보를 활용할 수 있도록 함
  } else if (a2 && a2.endsWith('구') && !['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시'].includes(a1)) {
    // 혹시라도 '도' 이름 뒤에 바로 '구'가 오는 비정상적인 파싱이나 다른 예외 방어
  }
  
  return { a1, a2, a3 };
};

async function run() {
  console.log('Starting local migration based on text parsing...');
  const list = await sql`SELECT id, address FROM restaurants`;
  for (const r of list) {
    const { a1, a2, a3 } = parseAddress(r.address);
    await sql`UPDATE restaurants SET region_1depth = ${a1}, region_2depth = ${a2}, region_3depth = ${a3} WHERE id = ${r.id}`;
    console.log('Updated', r.address, '->', a1, a2, a3);
  }
  console.log('Local migration done!');
  process.exit(0);
}
run();
