import React from 'react';

export const MichelinIcon = ({ size = 24, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* 업로드된 이미지처럼 심플하고 얇은 선의 꽃 모양 */}
    <path d="M12 10 A 3 3 0 0 1 12 2 A 3 3 0 0 1 12 10" />
    <path d="M12 10 A 3 3 0 0 1 12 2 A 3 3 0 0 1 12 10" transform="rotate(60 12 12)" />
    <path d="M12 10 A 3 3 0 0 1 12 2 A 3 3 0 0 1 12 10" transform="rotate(120 12 12)" />
    <path d="M12 10 A 3 3 0 0 1 12 2 A 3 3 0 0 1 12 10" transform="rotate(180 12 12)" />
    <path d="M12 10 A 3 3 0 0 1 12 2 A 3 3 0 0 1 12 10" transform="rotate(240 12 12)" />
    <path d="M12 10 A 3 3 0 0 1 12 2 A 3 3 0 0 1 12 10" transform="rotate(300 12 12)" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

export const BlueRibbonIcon = ({ size = 24, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* 왼쪽 리본 루프 */}
    <path d="M10 10 C 3 6 2 15 10 13" />
    {/* 오른쪽 리본 루프 */}
    <path d="M14 10 C 21 6 22 15 14 13" />
    {/* 중앙 매듭 (Knot) */}
    <rect x="10" y="9" width="4" height="5" rx="1" fill={color} />
    {/* 왼쪽 꼬리 (끝부분 파임 처리) */}
    <path d="M10.5 14 L 6 22 L 9.5 20 L 11 22" />
    {/* 오른쪽 꼬리 */}
    <path d="M13.5 14 L 18 22 L 14.5 20 L 13 22" />
  </svg>
);
