import { AffiliateDisclosure } from '@/components/AffiliateDisclosure';

export const metadata = {
  title: '제휴 마케팅 고지 | 모두의맛집',
};

export default function AffiliateLegalPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <AffiliateDisclosure variant="full" />
    </main>
  );
}
