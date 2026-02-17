import { existsSync, rmSync, cpSync } from 'fs';
import path from 'path';

const rootDir = process.cwd();
const adminNextDir = path.resolve(rootDir, 'apps/admin/.next');
const rootNextDir = path.resolve(rootDir, '.next');

if (!existsSync(adminNextDir)) {
  console.error(`Next build 출력 폴더를 찾을 수 없습니다: ${adminNextDir}`);
  process.exit(1);
}

if (existsSync(rootNextDir)) {
  rmSync(rootNextDir, { recursive: true, force: true });
}

cpSync(adminNextDir, rootNextDir, { recursive: true });
console.log(`Copied Next.js build from ${adminNextDir} to ${rootNextDir}`);
