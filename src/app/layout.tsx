import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
import { Providers } from './providers';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: '모두의맛집',
  description: '그 유튜버가 갔던 그 집, 토스에서 한 번에',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="https://cdn.jsdelivr.net/gh/sunn-us/SUIT@latest/fonts/variable/woff2/SUIT-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          <GlobalErrorHandler>
            {children}
          </GlobalErrorHandler>
        </Providers>
      </body>
    </html>
  );
}
