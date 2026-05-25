import { useState, useCallback, useEffect } from 'react';

interface ToastOptions {
  message: string;
  duration?: number;
}

export function useToast() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showToast = useCallback(({ message, duration = 2500 }: ToastOptions) => {
    setToastMessage(message);
    setIsVisible(true);

    setTimeout(() => {
      setIsVisible(false);
    }, duration);
  }, []);

  // 애니메이션이 끝나면 DOM에서 아예 제거하기 위한 딜레이
  useEffect(() => {
    if (!isVisible && toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 300); // fade-out duration
      return () => clearTimeout(timer);
    }
  }, [isVisible, toastMessage]);

  return { toastMessage, isVisible, showToast };
}
