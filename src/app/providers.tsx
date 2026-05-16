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
