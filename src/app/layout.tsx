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
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="stylesheet" as="style" crossOrigin="" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.onerror = function(msg, url, line, col, error) {
            var div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.9);color:white;z-index:999999;padding:20px;word-break:break-all;overflow:auto;';
            div.innerHTML = '<h2>🛑 FATAL JS ERROR</h2><p><b>Msg:</b> ' + msg + '</p><p><b>URL:</b> ' + url + '</p><p><b>Line:</b> ' + line + ':' + col + '</p>';
            if(document.body) document.body.appendChild(div);
            else window.addEventListener('DOMContentLoaded', function() { document.body.appendChild(div); });
          };
          window.addEventListener('unhandledrejection', function(e) {
            var msg = e.reason && e.reason.message ? e.reason.message : e.reason;
            var div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(200,0,0,0.9);color:white;z-index:999999;padding:20px;word-break:break-all;overflow:auto;';
            div.innerHTML = '<h2>🛑 UNHANDLED PROMISE</h2><p>' + msg + '</p>';
            if(document.body) document.body.appendChild(div);
            else window.addEventListener('DOMContentLoaded', function() { document.body.appendChild(div); });
          });
        `}} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <GlobalErrorHandler>
            {children}
          </GlobalErrorHandler>
        </Providers>
      </body>
    </html>
  );
}
