// 발행 전 품질 검증·게이트 + 리포트 (generateDetail의 마지막 단계).
// - 필수(좌표·대표리뷰) 미달 → 자동 비공개
// - reviewer_count(맛집채널/코너로 인증한 유튜버 수) 집계 → "N명 유튜버 인증" 신호
// - 필드 완성도 리포트 출력
// 실행: node src/scripts/verify_region.mjs [REGION=광주]
import postgres from 'postgres';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { classifyChannel } from '../lib/channelPolicy.mjs';

const ROOT = 'C:/modoo-matjip/food-feat-rebranding-modoo-matjip';
const env = fs.readFileSync(`${ROOT}/.env.local`, 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const REGION = process.env.REGION || '광주';
const filled = (v) => v && String(v).trim() !== '' && v !== '정보 없음';

async function run() {
  await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS reviewer_count int`;

  const rows = await sql`
    SELECT r.id, r.name, r.lat, r.lng, r.representative_video_id rvid, r.phone, r.business_hours bh, r.is_published,
           rv.ai_insights ai
    FROM restaurants r
    LEFT JOIN restaurant_videos rv ON rv.restaurant_id = r.id AND rv.video_id = r.representative_video_id
    WHERE r.address LIKE ${'%' + REGION + '%'}`;

  // 식당별 인증 유튜버 수(맛집채널/코너 = allow/gray, block 제외; 채널 중복 제거)
  const vids = await sql`
    SELECT rv.restaurant_id rid, v.title, v.is_short, c.name channel
    FROM restaurant_videos rv JOIN videos v ON v.id = rv.video_id LEFT JOIN channels c ON c.id = v.channel_id
    JOIN restaurants r ON r.id = rv.restaurant_id WHERE r.address LIKE ${'%' + REGION + '%'}`;
  const reviewers = new Map();
  for (const v of vids) {
    if (classifyChannel({ channelName: v.channel, title: v.title, isShort: v.is_short }).verdict === 'block') continue;
    if (!reviewers.has(v.rid)) reviewers.set(v.rid, new Set());
    reviewers.get(v.rid).add(v.channel || '?');
  }

  let unpublished = 0, ok = 0;
  const stat = { review: 0, hours: 0, phone: 0, multi: 0 };
  for (const r of rows) {
    const hasReview = !!(r.ai && (r.ai.review || (r.ai.picks || []).some(p => p.ate)));
    const hasCoords = r.lat != null && r.lng != null;
    const critical = hasReview && hasCoords && r.rvid;
    const rc = reviewers.get(r.id)?.size || 0;
    await sql`UPDATE restaurants SET reviewer_count = ${rc} WHERE id = ${r.id}`;

    if (!critical && r.is_published) {
      await sql`UPDATE restaurants SET is_published = false WHERE id = ${r.id}`;
      unpublished++; console.log(`⏸ 비공개: ${r.name} (리뷰 ${hasReview ? 'O' : 'X'}, 좌표 ${hasCoords ? 'O' : 'X'})`);
      continue;
    }
    if (critical && r.is_published) {
      ok++;
      if (hasReview) stat.review++;
      if (filled(r.bh)) stat.hours++;
      if (filled(r.phone)) stat.phone++;
      if (rc >= 2) stat.multi++;
    }
  }

  console.log(`\n=== ${REGION} 품질 검증 ===`);
  console.log(`공개 유지: ${ok} · 신규 비공개: ${unpublished}`);
  console.log(`완성도(공개 ${ok}곳 중): 리뷰 ${stat.review} · 영업시간 ${stat.hours} · 전화 ${stat.phone} · 유튜버2명+ 인증 ${stat.multi}`);
  await sql.end();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) run();
