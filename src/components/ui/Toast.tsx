'use client';

interface ToastProps {
  message: string | null;
  isVisible: boolean;
}

export default function Toast({ message, isVisible }: ToastProps) {
  if (!message && !isVisible) return null;

  return (
    <div 
      className={`fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[1000] px-5 py-3.5 bg-gray-800 text-white text-[15px] font-medium rounded-2xl shadow-xl transition-all duration-300 ease-out whitespace-nowrap
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
    >
      {message}
    </div>
  );
}
