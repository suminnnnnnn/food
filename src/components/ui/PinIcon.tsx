import React from 'react';

// 지도 기본 물방울 마커와 완전히 동일한 모양. 색상만 바뀐다.
// 내부엔 기본 마커처럼 작은 흰 구멍만 있고, 별·이모지 등 다른 요소는 넣지 않는다.
export default function PinIcon({
  color = '#FF6F00',
  filled = true,
  size = 20,
}: {
  color?: string;
  filled?: boolean;
  size?: number;
}) {
  return (
    <span style={{ display: 'inline-flex', width: size, height: size, flex: 'none' }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(-45deg)',
          background: filled ? color : 'transparent',
          boxShadow: filled ? '0 1px 3px rgba(0,0,0,0.28)' : `inset 0 0 0 2px ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: '50%',
            background: filled ? '#fff' : color,
          }}
        />
      </span>
    </span>
  );
}
