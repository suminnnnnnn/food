# Next.js App Router 파비콘(Favicon) 캐싱 트러블슈팅

## 🚨 문제 상황
`src/app/icon.png` 또는 `favicon.ico` 파일을 교체하고, 브라우저를 새로고침해도 로컬 개발 서버(`npm run dev`)에서 이전 아이콘 이미지가 계속 나타나는 현상.

## 🔍 원인 파악
Next.js의 Turbopack과 서버 구동 시스템은 `/app` 하위의 메타데이터 파일(특히 이미지)을 메모리와 `.next` 폴더 내부에 매우 강력하게 캐싱(Caching)합니다.
또한, 브라우저 자체도 `favicon.ico` 요청에 대해 응답을 영구적으로 저장하려는 성질이 있습니다.

## 💡 해결 로직
개발 서버 동작 중에는 단순히 이미지 파일 덮어쓰기만으로 즉각적인 HMR(Hot Module Replacement)이 일어나지 않을 확률이 매우 높습니다. 다음의 "확인 사살" 절차가 필요합니다.

1. **Next.js 개발 서버 완전히 종료** (Ctrl+C 또는 프로세스 Kill)
2. **`.next` (빌드 및 캐시 폴더) 완전히 삭제**
   ```bash
   # Windows (PowerShell)
   Remove-Item -Recurse -Force .next
   
   # Mac/Linux
   rm -rf .next
   ```
3. **서버 재시작** (`npm run dev`)
4. **브라우저 하드 리프레시**:
   - `http://localhost:3000/icon.png` (정적 자원 주소)로 직접 접속하여 강력 새로고침(`Ctrl + Shift + R`).
   - 메인 웹페이지로 돌아와서 다시 강력 새로고침.

## 🧠 AI 어시스턴트 행동 강령
- 사용자가 "이미지나 아이콘을 바꿨는데 안 뜬다"라고 호소할 경우, 캐싱 문제를 1순위로 지목할 것.
- HMR 핑계로 대충 브라우저 새로고침을 요구하지 말고, `.next` 폴더 삭제 후 서버를 껐다 켜주는 `run_command` 스크립트를 즉시 실행할 것.
