/**
 * AffiliateDisclosure
 *
 * 표시·광고의 공정화에 관한 법률 및 쿠팡파트너스 약관에 따라
 * 제휴 상품 영역에 반드시 고지문을 노출합니다.
 *
 * 검수 사전 점검 스크립트(ait-precheck.js)가 코드베이스에서
 * "쿠팡파트너스" 문자열을 찾으므로, 이 컴포넌트가 적어도 한 군데 이상
 * import되어 렌더링되어야 합니다.
 *
 * 사용 위치:
 *  - 식당 상세 페이지의 <AffiliateProductsSection> 하단
 *  - 마이 페이지의 약관/고지 메뉴 → /legal/affiliate 라우트
 */
import React from 'react';

interface Props {
  /** 'compact'은 상품 카드 하단용, 'full'은 전용 페이지용 */
  variant?: 'compact' | 'full';
  className?: string;
}

export function AffiliateDisclosure({ variant = 'compact', className = '' }: Props) {
  if (variant === 'compact') {
    return (
      <p
        className={`text-xs text-gray-500 mt-2 ${className}`}
        role="note"
        aria-label="제휴 마케팅 고지"
      >
        이 페이지의 일부 상품 링크는 쿠팡파트너스 활동의 일환으로
        일정 수수료를 제공받습니다.
      </p>
    );
  }

  return (
    <section className={`prose prose-sm text-gray-700 ${className}`}>
      <h2 className="text-base font-semibold">제휴 마케팅 고지</h2>
      <p>
        "모두의맛집"은 쿠팡파트너스 활동의 일환으로 일정 수수료를 지급받습니다.
        이 수수료는 상품 가격에 영향을 주지 않으며, 모두의맛집은
        독립적으로 식당과 콘텐츠를 큐레이션합니다.
      </p>
      <p>
        제휴 상품의 가격, 재고, 배송 정보는 쿠팡(또는 해당 판매처)에서
        관리하며, 모두의맛집은 이에 대한 책임을 지지 않습니다. 정확한 정보는
        판매처에서 확인해 주세요.
      </p>
      <p className="text-xs text-gray-500">
        문의: support@modoo-matjip.kr <br />
        관련 법령: 표시·광고의 공정화에 관한 법률, 전자상거래법
      </p>
    </section>
  );
}
