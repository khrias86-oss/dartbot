# DART 봇 웹버전 퍼블리싱 가이드 (Vercel 연동)

이 가이드를 따라 진행하시면, 로컬 PC에서만 돌아가던 애플리케이션을 인터넷 상(모바일/스마트폰 호환)에서 접속되는 형태(`https://YOUR-APP.vercel.app`)로 단 몇 분 만에 배포할 수 있습니다!

## 1단계: 소스코드를 GitHub에 업로드하기
1. GitHub 계정에 로그인하고 새 레포지토리(Repository)를 만듭니다 (예: `dartbot-web`).
2. VSCode (또는 터미널)에서 로컬 코드를 깃허브로 Push 합니다.
   ```bash
   git init
   git add .
   git commit -m "Init DART bot"
   git branch -M main
   git remote add origin https://github.com/내아이디/dartbot-web.git
   git push -u origin main
   ```

## 2단계: Vercel 배포(Deploy) 시작
1. [Vercel 공식 홈페이지](https://vercel.com/) 에 접속하여 GitHub 계정으로 로그인합니다.
2. 우측 상단의 `Add New -> Project` 버튼을 클릭합니다.
3. 방금 업로드한 `dartbot-web` 레포지토리가 리스트에 보일 것입니다. **[Import]** 버튼을 누릅니다.

## 3단계: 필수 환경변수(DART API KEY) 세팅 <span style="color:red">(중요 🔥)</span>
Vercel 설정畫面의 아랫부분으로 스크롤하면 **Environment Variables (환경 변수)** 탭이 있습니다.
여기에 봇이 FSS(금감원) 데이터 서버와 통신할 수 있도록 본인의 DART 금감원 키 정보를 반드시 등록해야 합니다.

- **NAME** 란에 입력할 텍스트: `DART_API_KEY`
- **VALUE** 란에 입력할 텍스트: `본인이 발급받은 40자리 난수 API 키` (예: `abcd1234abcd1234...`)
  
반드시 입력 후 **[Add]** 버튼을 눌러 목록에 추가합니다.

## 4단계: 퍼블리싱 및 접속 완료
1. 모든 설정이 완료되었다면, **[Deploy]** 파란색 버튼을 누릅니다.
2. 약 1분 정도 Vercel이 자동으로 프로젝트를 압축(빌드)하고 서버에 올리는 과정이 진행됩니다. 폭죽이 터지는 애니메이션 화면이 나오면 퍼블리싱에 성공한 것입니다!
3. 연결된 주소 공간(예: `https://dartbot-web-abcdef.vercel.app`)으로 입장하면 실시간으로 동작하는 인텔리전트 DART 봇을 만나보실 수 있습니다.

> 💎 **향후 코드 업데이트 방법**:
> 브라우저 내 헤더 디자인 변경 등 추가 수정 코드가 생길 경우 터미널에서 `git commit` 및 `git push`만 하시면 됩니다. Vercel이 이를 감지하여 **자동으로 새 버전으로 다시 배포**해 줍니다. 매우 간편합니다!
