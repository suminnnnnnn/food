import { Info } from 'lucide-react';

// 제휴 마케팅 고지 — .md 인포메이션(admonition) 형식: 옅은 주황 배경 + 아이콘 + "안내" 라벨
export default function AffiliateDisclosure() {
  return (
    <div
      className="mt-3 p-3 rounded-xl"
      style={{ background: 'rgba(255, 111, 0, 0.08)', border: '1px solid rgba(255, 111, 0, 0.16)' }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Info size={14} style={{ color: '#FF6F00' }} />
        <span className="text-[11px] font-extrabold" style={{ color: '#FF6F00' }}>안내</span>
      </div>
      <p className="text-[11.5px] leading-relaxed" style={{ color: '#8a4b18' }}>
        본 서비스는 쿠팡파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  );
}
