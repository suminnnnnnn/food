import React from 'react';

// 지도의 기본 물방울 마커를 그대로 축소한 아이콘 (별 대체용).
// filled=저장됨(색상 채움), filled=false=미저장(외곽선만). emoji 지정 시 마커 내부에 표시.
export default function PinIcon({
  color = '#FF6F00',
  filled = true,
  size = 20,
  emoji,
}: {
  color?: string;
  filled?: boolean;
  size?: number;
  emoji?: string;
}) {
  return (
    <span style={{ display: 'inline-flex', position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill={filled ? color : 'transparent'}
          stroke={color}
          strokeWidth={filled ? 0 : 2}
        />
        {filled && <circle cx="12" cy="9" r={emoji ? 4.6 : 2.6} fill="#fff" />}
      </svg>
      {filled && emoji && (
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '37.5%',
            transform: 'translate(-50%,-50%)',
            fontSize: size * 0.34,
            lineHeight: 1,
          }}
        >
          {emoji}
        </span>
      )}
    </span>
  );
}
