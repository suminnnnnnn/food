'use client';

import { useEffect, useState } from 'react';

export default function GlobalErrorHandler() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setErrorMsg(`Error: ${event.message}\nAt: ${event.filename}:${event.lineno}`);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      setErrorMsg(`Promise Rejection: ${event.reason?.message || event.reason}`);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (!errorMsg) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      backgroundColor: 'rgba(255, 0, 0, 0.9)', color: 'white',
      padding: '20px', wordBreak: 'break-word', fontFamily: 'monospace',
      fontSize: '12px', maxHeight: '50vh', overflowY: 'auto'
    }}>
      <h3>🛑 Crash Detected!</h3>
      <pre>{errorMsg}</pre>
      <button 
        onClick={() => setErrorMsg(null)}
        style={{ marginTop: '10px', padding: '5px 10px', background: 'white', color: 'red', border: 'none', borderRadius: '4px' }}
      >
        Dismiss
      </button>
    </div>
  );
}
