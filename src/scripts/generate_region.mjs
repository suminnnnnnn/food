// 지역 하나에 대해 상세페이지 생성 파이프라인을 순차 실행하는 오케스트레이터(Phase 1).
// seed_region → enrich_reviews(멀티모달·게이트) → enrich_restaurants(전화·영업시간·시설) → enrich_from_chakhan(착한가격) → enrich_embeddings.
// 실행: node src/scripts/generate_region.mjs gwangju   (STEP=seed,reviews 로 일부만)
import { spawn } from 'child_process';
import { getRegion } from '../lib/regionConfig.mjs';

const key = process.argv[2] || 'gwangju';
const cfg = getRegion(key);
const only = (process.env.STEP || '').split(',').filter(Boolean); // 비면 전체
const S = 'src/scripts';

// [이름, 명령어, 인자, 추가 env]
const STEPS = [
  ['seed', 'node', ['--env-file=.env.local', `${S}/seed_region.mjs`, key], {}],
  ['reviews', 'node', [`${S}/enrich_reviews.mjs`], { REGION: cfg.label }],
  ['restaurants', 'node', ['--env-file=.env.local', `${S}/enrich_restaurants.mjs`], {}],
  ['tourapi', 'node', ['--env-file=.env.local', `${S}/enrich_tourapi.mjs`], { REGION: cfg.label }],
  ['chakhan', 'node', ['--env-file=.env.local', `${S}/enrich_from_chakhan.mjs`], {}],
  ['embeddings', 'node', [`${S}/enrich_embeddings.mjs`], { REGION: cfg.label }],
  ['verify', 'node', [`${S}/verify_region.mjs`], { REGION: cfg.label }],
];

function runStep(name, cmd, args, extraEnv) {
  return new Promise((resolve, reject) => {
    console.log(`\n\n═══════════ [${name}] 시작 ═══════════`);
    const p = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...extraEnv }, shell: false });
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(`[${name}] 종료코드 ${code}`)));
    p.on('error', reject);
  });
}

async function main() {
  console.log(`🚀 ${cfg.label} 상세페이지 생성 파이프라인 시작` + (only.length ? ` (STEP=${only.join(',')})` : ' (전체)'));
  for (const [name, cmd, args, env] of STEPS) {
    if (only.length && !only.includes(name)) { console.log(`\n(건너뜀: ${name})`); continue; }
    try { await runStep(name, cmd, args, env); }
    catch (e) { console.error(`\n❌ ${e.message} — 파이프라인 중단`); process.exit(1); }
  }
  console.log(`\n\n✅ ${cfg.label} 파이프라인 완료`);
  process.exit(0);
}
main();
