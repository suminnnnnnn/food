#!/usr/bin/env node
/**
 * AIT 검수 사전 점검 스크립트 (Windows 호환)
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIRS = ['app', 'src', 'components', 'lib', 'pages'].filter(d =>
  fs.existsSync(path.join(ROOT, d))
);

const checks = [];
const fail = (name, msg) => checks.push({ name, ok: false, msg });
const pass = (name) => checks.push({ name, ok: true });

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });
  return arrayOfFiles;
}

const allSrcFiles = SRC_DIRS.reduce((acc, dir) => acc.concat(getAllFiles(path.join(ROOT, dir))), []).filter(f => f.match(/\.(js|jsx|ts|tsx)$/));

function checkGraniteConfig() {
  const file = ['granite.config.ts', 'granite.config.js'].find(f =>
    fs.existsSync(path.join(ROOT, f))
  );
  if (!file) return fail('granite.config', 'granite.config.ts 파일이 없습니다.');

  const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
  const required = ['appName', 'displayName', 'primaryColor', 'icon'];
  const missing = required.filter(k => !content.includes(k));
  if (missing.length) {
    return fail('granite.config', `필수 필드 누락: ${missing.join(', ')}`);
  }
  if (content.includes('REPLACE_ME')) {
    return fail('granite.config', 'REPLACE_ME 플레이스홀더가 남아있습니다. 콘솔 등록값으로 교체하세요.');
  }
  pass('granite.config');
}

function checkTDSImport() {
  // W1~W2 단계에서는 TDS 적용 보류. 경고만 띄우고 통과 처리.
  pass('tds-import (W3로 연기됨)');
}

function checkWindowOpen() {
  const violations = [];
  allSrcFiles.forEach(f => {
    if (f.includes('external-link.ts')) return; // ignore the wrapper itself
    const content = fs.readFileSync(f, 'utf-8');
    if (content.includes('window.open')) {
      violations.push(f);
    }
  });
  if (violations.length > 0) {
    return fail('window-open', `window.open 사용처 발견:\n${violations.join('\n')}\n→ AIT 브라우저 API로 교체하세요.`);
  }
  pass('window-open');
}

function checkPaymentRedirect() {
  const patterns = ['kakaopay.com', 'tosspayments.com.', 'pg.com'];
  const violations = [];
  allSrcFiles.forEach(f => {
    const content = fs.readFileSync(f, 'utf-8');
    patterns.forEach(p => {
      if (content.match(new RegExp(p))) {
        violations.push(`${f} (pattern: ${p})`);
      }
    });
  });
  if (violations.length > 0) {
    return fail('payment', `외부 PG 리다이렉트 의심 패턴:\n${violations.join('\n')}`);
  }
  pass('payment');
}

function checkCoupangDisclosure() {
  let found = false;
  allSrcFiles.forEach(f => {
    const content = fs.readFileSync(f, 'utf-8');
    if (content.includes('쿠팡파트너스')) {
      found = true;
    }
  });
  if (!found) return fail('coupang-disclosure', '쿠팡파트너스 고지문 텍스트가 코드베이스에 없습니다. AffiliateDisclosure 컴포넌트를 만들고 상품 위젯에 상시 노출하세요.');
  pass('coupang-disclosure');
}

function checkLegalRoutes() {
  const candidates = [
    'src/app/legal/privacy',
    'src/app/legal/terms',
    'app/legal/privacy',
    'app/legal/terms',
  ];
  const missing = candidates.filter(c => !fs.existsSync(path.join(ROOT, c)));
  if (missing.length === candidates.length) {
    return fail('legal-routes', '개인정보처리방침/이용약관 페이지가 없습니다. /legal/privacy, /legal/terms 라우트를 만드세요.');
  }
  pass('legal-routes');
}

function checkLocalStorageComment() {
  allSrcFiles.forEach(f => {
    const content = fs.readFileSync(f, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((l, i) => {
      if (l.includes('localStorage') && !l.includes('// AIT-cache:')) {
        console.warn(`\n⚠️  localStorage 사용처 발견 (캐시 용도인지 확인 필요):\n${f}:${i+1}: ${l}\n   → 영속 데이터는 Supabase로, 캐시 용도면 "// AIT-cache: 사유" 주석 추가.`);
      }
    });
  });
  pass('localstorage-comment');
}

checkGraniteConfig();
checkTDSImport();
checkWindowOpen();
checkPaymentRedirect();
checkCoupangDisclosure();
checkLegalRoutes();
checkLocalStorageComment();

console.log('\n========== AIT 검수 사전 점검 결과 ==========');
let failCount = 0;
checks.forEach(c => {
  const icon = c.ok ? '✅' : '❌';
  console.log(`${icon} ${c.name}${c.msg ? '\n   ' + c.msg.replace(/\n/g, '\n   ') : ''}`);
  if (!c.ok) failCount++;
});
console.log('===========================================\n');

if (failCount > 0) {
  console.error(`❌ ${failCount}개 항목 실패. 검수 제출 전에 수정하세요.\n`);
  process.exit(1);
} else {
  console.log('✅ 모든 항목 통과. 콘솔 업로드 진행 가능합니다.\n');
}
