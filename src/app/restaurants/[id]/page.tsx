import { Metadata } from 'next';
import { getRestaurantById } from '@/lib/supabase/restaurants';
import { notFound } from 'next/navigation';
import RestaurantDetailClient from './RestaurantDetailClient';

// ISR (Incremental Static Regeneration) - 1시간 단위 캐시 검증
export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

// 1. 빌드 타임에 일부 정적 경로 생성 (On-Demand 빌드 속도 및 정적 서빙 최적화)
export async function generateStaticParams() {
  return []; // 빈 배열을 리턴하여 최초 접근 시 On-Demand로 빌드(ISR)되도록 안전 설정
}

// 2. 동적 SEO 메타데이터 생성
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const restaurant = await getRestaurantById(resolvedParams.id);
  
  if (!restaurant) {
    return {
      title: '맛집을 찾을 수 없습니다 | 모두의 맛집',
      description: '요청하신 맛집 정보를 찾을 수 없습니다.',
    };
  }

  const cleanAddress = restaurant.address || '전국 핫플레이스';
  const cleanCategory = restaurant.category || '맛집';
  const ogImageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://modoo-matjip.vercel.app'}/api/og?id=${restaurant.id}`;

  return {
    title: `${restaurant.name} - 크리에이터 미식 성지 | 모두의 맛집`,
    description: `${restaurant.name} (${cleanCategory}): ${cleanAddress}에 위치한 화제의 핫플레이스! 유튜브 리뷰 영상과 상세 미식 포인트를 바로 확인해 보세요.`,
    alternates: {
      canonical: `/restaurants/${restaurant.id}`,
    },
    openGraph: {
      title: `${restaurant.name} | 모두의 맛집`,
      description: `${restaurant.name} - 크리에이터들이 검증한 침샘 자극 핫플 정보와 라이브 클립 영상을 만나보세요.`,
      url: `/restaurants/${restaurant.id}`,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${restaurant.name} 비주얼 썸네일`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${restaurant.name} | 모두의 맛집`,
      description: `${cleanAddress}에 위치한 크리에이터 검증 핫플레이스!`,
      images: [ogImageUrl],
    },
  };
}

export default async function RestaurantDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const restaurant = await getRestaurantById(resolvedParams.id);

  if (!restaurant) {
    notFound();
  }

  // 3. Schema.org JSON-LD 구조화 데이터 정의
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    'id': `https://modoo-matjip.vercel.app/restaurants/${restaurant.id}`,
    'name': restaurant.name,
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': restaurant.address,
      'addressCountry': 'KR',
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': restaurant.lat,
      'longitude': restaurant.lng,
    },
    'servesCuisine': restaurant.category,
    'image': restaurant.videos?.[0]?.thumbnail || '',
    'url': `https://modoo-matjip.vercel.app/restaurants/${restaurant.id}`,
  };

  return (
    <main className="min-h-screen bg-brand-charcoal text-white selection:bg-brand-orange selection:text-white overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* 검색엔진 색인을 돕는 JSON-LD 데이터 삽입 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* 프리미엄 클라이언트 인터랙션 뷰 서빙 */}
      <RestaurantDetailClient restaurant={restaurant} />
    </main>
  );
}
