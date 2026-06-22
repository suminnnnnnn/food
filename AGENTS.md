# 모두의맛집 (modoo-matjip) 에이전트 작업 위키 & 규칙

이 문서에는 프로젝트 개발 효율성을 높이고, 에이전트가 작업할 때 발생하기 쉬운 오류를 예방하기 위한 핵심 지침들이 정리되어 있습니다. 모든 AI 에이전트는 본 문서를 최우선으로 참고하여 작업에 반영해야 합니다.

---

## 1. 개발 환경 및 도구 사용 규칙 (오류 방지)

### 📌 Windows 환경에서의 npm 명령어 실행 규칙
- **이슈**: Windows 환경의 PowerShell 실행 정책(Execution Policy) 제한으로 인해 `npm` 직접 실행 시 오류가 발생할 수 있습니다.
- **규칙**: terminal command 실행 시 반드시 `npm` 대신 **`npm.cmd`**로 실행하여 우회해야 합니다.
  ```powershell
  # 올바른 예
  npm.cmd run dev
  ```
- **규칙**: `node`나 `npm.cmd` 실행 전, 새로 설치된 Node.js가 감지되지 않으면 반드시 PATH 환경 변수를 셸 프로세스에 재로드한 후 실행하십시오.
  ```powershell
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  ```

---

## 2. API 설정 및 환경 변수 규칙

### 📌 Supabase 연동 오류 예방
- **이슈**: Supabase URL에 `/rest/v1/` 경로를 명시하면 클라이언트 라이브러리 내부에서 중복 경로가 생성되어 API 호출이 실패합니다.
- **규칙**: `SUPABASE_URL`은 하위 경로 없이 **도메인 베이스까지만** 기재되어야 합니다.
  - ❌ 잘못된 예: `https://nfsezjbsdvqesdbulbic.supabase.co/rest/v1/`
  -  올바른 예: `https://nfsezjbsdvqesdbulbic.supabase.co`
- **로컬 테스트**: 로컬 실행 시 항상 [`.env.local`](file:///C:/modoo-matjip/food-feat-rebranding-modoo-matjip/.env.local) 파일이 존재하는지 검증해야 하며, 누락되었을 때는 백업 복원 또는 수동 확인 후 기입해야 합니다.

---

## 3. 플랫폼 스펙 변경 및 배제 규칙

### 📌 토스 웹뷰 (AIT) 미니앱 기능 완전 배제
- **규칙**: 이 프로젝트는 토스 웹뷰(AIT) 플랫폼 환경이 아닌 일반 모바일/PC 반응형 웹 서비스로만 작동합니다. 
- 따라서 `granite.config.ts` 등의 설정 파일을 새로 만들지 마십시오.
- 소스 코드에 `isInAIT()`, `window.AppsInToss`와 같은 토스 웹뷰 종속성이나 기기 분기 코드를 추가하지 마십시오. 외부 브라우저 창 열기(`openExternal`) 시 항상 표준 `window.open` 방식으로 처리합니다.

---

## 4. 프론트엔드 컴포넌트 개발 규칙

### 📌 카카오맵 튕김/굳음 버그 방지 규칙 (매우 중요)
- **이슈**: `react-kakao-maps-sdk`의 `<Map>` 컴포넌트 `center` 속성에 동적인 state를 바인딩하면, 사용자가 지도를 드래그하여 중심이 바뀔 때 부모 컴포넌트가 리렌더링되면서 지도가 원래 설정된 최초 좌표로 강제 복귀(튕김)하는 현상이 발생합니다.
- **규칙**:
  1. `<Map>`의 `center` 속성에는 최초 1회만 설정되도록 영구 상수(예: `INITIAL_CENTER`)를 바인딩하십시오.
  2. 지도 이동이 필요할 때는 카카오맵 인스턴스(`map`)를 확보한 후 `map.panTo(new kakao.maps.LatLng(lat, lng))` 메서드를 직접 호출하여 카메라를 이동시켜야 합니다.

### 📌 이미지 엑박 방지 3중 폴백 전략
- 크리에이터 및 맛집 썸네일 이미지 링크 만료로 인한 엑박(Broken Image) 발생을 방지하기 위해 다음 3단계 방어를 유지하십시오:
  1. `onError` 핸들러 구현: 로딩 실패 시 기본 이미지로 교체.
  2. `ui-avatars.com` 활용: 유튜버 프로필 이미지 누락 시 이름 이니셜 기반 아바타 자동 생성 연동.
  3. 카테고리별 기본 테마 이미지 바인딩.

---

## 5. 브랜드 아이덴티티 규칙
- 우리 서비스의 아이덴티티 색상은 **빨간색(Red)과 주황색(Orange)의 그라데이션**입니다.
- 주요 테마 컬러, 프로필 링, 북마크 활성화 상태 및 강조 인터랙션 요소에는 이 그라데이션을 적용해야 합니다.
