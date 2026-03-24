const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

console.log("1. Next.js 빌드를 시작합니다 (next build)...");
execSync('npx next build', { stdio: 'inherit' });

console.log("2. Electron 실행을 위한 Standalone 자산을 주입합니다...");
const standaloneDir = path.join(__dirname, '.next', 'standalone');

// Next.js standalone 에 정적(Static) 파일 이동
fs.copySync(path.join(__dirname, '.next', 'static'), path.join(standaloneDir, '.next', 'static'));
fs.copySync(path.join(__dirname, 'public'), path.join(standaloneDir, 'public'));

console.log("3. Electron Builder를 가동하여 .exe 파일을 생성합니다...");
try {
  execSync(`npx electron-builder --windows`, { stdio: 'inherit' });
  console.log("🚀 빌드가 왼료되었습니다! 'dist' 폴더 내부를 확인하세요.");
} catch(err) {
  console.error("Electron 빌드 실패:", err.message);
}
