/**
 * DART Financial Bot - Electron 엔트리포인트
 * Next.js 독립형(Standalone) 서버를 띄우고 데스크톱 앱 창을 엽니다.
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let nextProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    autoHideMenuBar: true,
  });
  
  // Next.js 로컬 구동 대기 후 접속
  mainWindow.loadURL('http://localhost:3000');
}

function startNextApp() {
  // standalone 빌드 결과물의 서버 실행 파일 경로
  const serverPath = path.join(__dirname, '.next', 'standalone', 'server.js');
  
  nextProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: '3000', NODE_ENV: 'production', HOSTNAME: '127.0.0.1' },
    stdio: 'inherit' // 로그 연동
  });
  
  // 서버가 응답할 때까지 대기핑 시도 (매 1초)
  const checkServer = setInterval(() => {
    http.get('http://127.0.0.1:3000', (res) => {
      if (res.statusCode === 200 || res.statusCode === 404) {
        clearInterval(checkServer);
        createWindow();
      }
    }).on('error', () => { /* 대기 중 */ });
  }, 1000);
}

app.whenReady().then(() => {
  startNextApp();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (nextProcess) nextProcess.kill();
});
