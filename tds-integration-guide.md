# TDS (Toss Design System) 연동 가이드

이 가이드는 Next.js 프로젝트에 토스 디자인 시스템(TDS)을 연동하고 사용하는 방법을 설명합니다.

## 1. 패키지 설치
TDS를 사용하기 위해 필요한 패키지들을 설치합니다. 앱인토스(AIT) 환경을 위해 `@toss/tds-mobile-ait`가 필수입니다.

```bash
npm install @toss/tds-mobile @toss/tds-mobile-ait @emotion/react @emotion/styled
```

## 2. TDSProvider 설정 (Next.js App Router)
앱의 최상단(`src/app/layout.tsx`)에 `TDSMobileAITProvider`를 설정합니다. 이 작업은 클라이언트 컴포넌트에서 수행되어야 하므로 별도의 Provider 컴포넌트를 만들거나 `layout.tsx` 상단에 `'use client'`를 추가해야 합니다.

### 예시: src/app/providers.tsx
```tsx
'use client';

import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TDSMobileAITProvider>
      {children}
    </TDSMobileAITProvider>
  );
}
```

### 예시: src/app/layout.tsx
```tsx
import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## 3. 주요 컴포넌트 사용법

### Button (버튼)
```tsx
import { Button } from '@toss/tds-mobile';

function Example() {
  return (
    <Button size="big" type="primary" style="fill" onClick={() => {}}>
      확인
    </Button>
  );
}
```

### Txt (텍스트)
TDS에서는 타이포그래피 토큰을 `Txt` 컴포넌트의 `typography` prop으로 설정합니다.
```tsx
import { Txt } from '@toss/tds-mobile';

function Example() {
  return (
    <>
      <Txt typography="T1" color="grey900">제목</Txt>
      <Txt typography="T5" color="grey600">본문 내용입니다.</Txt>
    </>
  );
}
```

### BoardRow (리스트 아이템)
정보성 리스트나 아코디언 스타일의 UI를 구성할 때 사용합니다.
```tsx
import { BoardRow } from '@toss/tds-mobile';

function Example() {
  return (
    <BoardRow
      title="매도 환전이 무엇인가요?"
      prefix={<BoardRow.Text>Q</BoardRow.Text>}
      onClick={() => {}}
    >
      주식 거래가 실시간이 아니기 때문에 발생하는...
    </BoardRow>
  );
}
```

## 4. 주의 사항
- **TDSMobileAITProvider**: 토스 앱 내부(AIT) 환경에서 최적화된 테마와 동작을 보장하기 위해 반드시 사용해야 합니다.
- **Tailwind CSS 혼용**: 기존 Tailwind CSS와 함께 사용할 수 있으나, 가급적 TDS 컴포넌트를 우선적으로 사용하여 토스 앱의 일관된 Look & Feel을 유지하는 것이 좋습니다.
