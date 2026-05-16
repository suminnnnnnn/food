import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 1. Run Next.js build
console.log('Running Next.js build...');
execSync('npm run build', { stdio: 'inherit' });

// 2. Wrap output in 'web/' directory
console.log('Wrapping output in web/ directory...');
const outDir = path.resolve('out');
const webDir = path.resolve('out', 'web');

if (!fs.existsSync(webDir)) {
  fs.mkdirSync(webDir);
}

const items = fs.readdirSync(outDir);
for (const item of items) {
  if (item === 'web') continue;
  const oldPath = path.join(outDir, item);
  const newPath = path.join(webDir, item);
  fs.renameSync(oldPath, newPath);
}

// 3. Run ait build
console.log('Running ait build...');
execSync('npx ait build', { stdio: 'inherit' });
