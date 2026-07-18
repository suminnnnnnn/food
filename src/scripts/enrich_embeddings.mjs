// 시맨틱 검색용 임베딩 재생성. 공개 맛집의 리치 컨텍스트 → gemini-embedding-001(768) → restaurant_embeddings.
// 실행: node src/scripts/enrich_embeddings.mjs [REGION=광주] [FORCE=1]
import postgres from 'postgres';
import fs from 'fs';
import { pathToFileURL } from 'url';

const ROOT = 'C:/modoo-matjip/food-feat-rebranding-modoo-matjip';
const env = fs.readFileSync(`${ROOT}/.env.local`, 'utf8');
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const sql = postgres(process.env.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'), { ssl: 'require' });
const KEY = process.env.GEMINI_API_KEY;
const REGION = process.env.REGION || null;
const FORCE = process.env.FORCE === '1';
const CONCURRENCY = 4;

function buildContext(r) {
  const a = r.ai || {};
  const parts = [`이곳은 ${r.name}입니다.`];
  if (r.category) parts.push(`카테고리는 ${r.category.split(' > ').pop()}입니다.`);
  if (r.address) parts.push(`위치는 ${r.address}입니다.`);
  if (a.signature) parts.push(a.signature);
  if (a.review) parts.push(a.review);
  const picks = (a.picks || []).filter(p => p.ate).map(p => p.name).slice(0, 8);
  if (picks.length) parts.push(`대표 메뉴: ${picks.join(', ')}.`);
  const tags = [...(a.mood_tags || []), ...(r.tags || [])];
  if (tags.length) parts.push(`관련 태그: ${[...new Set(tags)].slice(0, 10).join(', ')}.`);
  return parts.join(' ');
}

async function embed(text) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: 768,
    }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(d).slice(0, 200));
  return d.embedding?.values || [];
}

async function run() {
  const rows = await sql`
    SELECT DISTINCT ON (r.id) r.id, r.name, r.category, r.address, r.tags, rv.ai_insights AS ai,
           EXISTS(SELECT 1 FROM restaurant_embeddings e WHERE e.restaurant_id=r.id) AS done
    FROM restaurants r
    LEFT JOIN restaurant_videos rv ON rv.restaurant_id = r.id AND rv.video_id = r.representative_video_id
    WHERE r.is_published = true ${REGION ? sql`AND r.address LIKE ${'%' + REGION + '%'}` : sql``}
    ORDER BY r.id`;
  let targets = FORCE ? rows : rows.filter(r => !r.done);
  console.log(`임베딩 대상 ${targets.length}곳 (FORCE=${FORCE})`);

  let ok = 0, fail = 0;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(targets.slice(i, i + CONCURRENCY).map(async (r) => {
      try {
        const ctx = buildContext(r);
        const vec = await embed(ctx);
        if (vec.length !== 768) throw new Error(`dim ${vec.length}`);
        const lit = '[' + vec.join(',') + ']';
        await sql`
          INSERT INTO restaurant_embeddings (restaurant_id, embedding, source_text, updated_at)
          VALUES (${r.id}, ${lit}::vector, ${ctx}, now())
          ON CONFLICT (restaurant_id) DO UPDATE SET embedding = EXCLUDED.embedding, source_text = EXCLUDED.source_text, updated_at = now()`;
        ok++;
      } catch (e) { fail++; console.log(`✗ ${r.name}: ${String(e.message).slice(0, 80)}`); }
    }));
    process.stdout.write(`\r  진행 ${Math.min(i + CONCURRENCY, targets.length)}/${targets.length}`);
  }
  console.log(`\n완료: 성공 ${ok}, 실패 ${fail}`);
  await sql.end();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) run();
