'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Star, ExternalLink, Flame, Award, Heart } from 'lucide-react';
import AffiliateDisclosure from './AffiliateDisclosure';

interface MealKitItem {
  id: string;
  name: string;
  restaurantName: string;
  youtuberName: string;
  imageUrl: string;
  originalPrice: number;
  salePrice: number;
  discountRate: number;
  rating: number;
  reviewCount: number;
  buyUrl: string;
  tags: string[];
}

export default function ShoppingTabView() {
  const mealKits: MealKitItem[] = [
    {
      id: 'kit-1',
      name: '짚불 향 가득 초벌 우대갈비 (800g)',
      restaurantName: '몽탄',
      youtuberName: '쯔양, 홍사운드 Pick',
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80',
      originalPrice: 62000,
      salePrice: 56000,
      discountRate: 9,
      rating: 4.9,
      reviewCount: 1842,
      buyUrl: 'https://search.shopping.naver.com/search/all?query=%EB%AA%BD%ED%83%84+%EC%9A%B0%EB%8C%80%EA%B0%88%EB%B9%84+%EB%B0%80%ED%82%A4%ED%8A%B8',
      tags: ['육즙 가득', '캠핑 강추']
    },
    {
      id: 'kit-2',
      name: '프리미엄 삿포로식 생양갈비 세트 (2인분)',
      restaurantName: '이치류',
      youtuberName: '영국남자 추천 맛집',
      imageUrl: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500&q=80',
      originalPrice: 38000,
      salePrice: 32900,
      discountRate: 13,
      rating: 4.8,
      reviewCount: 924,
      buyUrl: 'https://search.shopping.naver.com/search/all?query=%EC%9D%B4%EC%B9%98%EB%A5%98+%EC%96%95%EA%B0%88%EB%B9%84',
      tags: ['미쉐린 맛집', '양고기 입문']
    },
    {
      id: 'kit-3',
      name: '짚불구이 시그니처 뼈탄 삼겹살 (600g)',
      restaurantName: '뼈탄집',
      youtuberName: '쯔양 맛집투어 방영',
      imageUrl: 'https://images.unsplash.com/photo-1602490940801-724128f73fbf?w=500&q=80',
      originalPrice: 26000,
      salePrice: 22800,
      discountRate: 12,
      rating: 4.7,
      reviewCount: 512,
      buyUrl: 'https://search.shopping.naver.com/search/all?query=%EB%B2%88%ED%83%84%EC%A7%91+%EC%82%BC%EA%B2%B9%EC%82%B4',
      tags: ['두툼 육즙', '초보 조리']
    },
    {
      id: 'kit-4',
      name: '정통 LA식 수원 왕갈비 세트 (850g)',
      restaurantName: '청기와타운',
      youtuberName: '육식맨 갈비로드 격찬',
      imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=500&q=80',
      originalPrice: 36000,
      salePrice: 31500,
      discountRate: 12,
      rating: 4.9,
      reviewCount: 2011,
      buyUrl: 'https://search.shopping.naver.com/search/all?query=%EC%B2%AD%EA%B8%B0%EC%99%80%ED%83%80%EC%9A%B4+%EC%84%98%EC%9B%90%EC%99%95%EA%B0%88%EB%B9%84',
      tags: ['가족 외식', '단짠 명작']
    },
    {
      id: 'kit-5',
      name: '신당동 원조 미니네 즉석 떡볶이 (3인분)',
      restaurantName: '신당동 미니네',
      youtuberName: '쯔양 떡볶이 먹방 방영',
      imageUrl: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=500&q=80',
      originalPrice: 17500,
      salePrice: 13900,
      discountRate: 20,
      rating: 4.6,
      reviewCount: 785,
      buyUrl: 'https://search.shopping.naver.com/search/all?query=%EC%8B%A0%EB%8B%B9%EB%8F%99+%EB%AF%B8%EB%8B%88%EB%84%A4+%EB%96%A1%EB%B3%B6%EC%9D%B4',
      tags: ['가성비', '추억의 맛']
    },
    {
      id: 'kit-6',
      name: '소문난 춘천 원조 치즈닭갈비 (1kg)',
      restaurantName: '춘천 통나무집',
      youtuberName: '맛상무 닭갈비 분석기 방영',
      imageUrl: 'https://images.unsplash.com/photo-1616671276441-2f2c277b8bf4?w=500&q=80',
      originalPrice: 28000,
      salePrice: 24000,
      discountRate: 14,
      rating: 4.8,
      reviewCount: 1419,
      buyUrl: 'https://search.shopping.naver.com/search/all?query=%ED%86%B5%EB%82%98%EB%AC%B4%EC%A7%91+%EB%8B%AD%EA%B0%88%EB%B9%84',
      tags: ['치즈 폭탄', '원조 맛집']
    }
  ];

  return (
    <div className="space-y-6 pb-12 text-white">
      {/* 커머스 상단 브랜드 배너 */}
      <div className="relative overflow-hidden bg-gradient-to-tr from-zinc-950 to-zinc-900 border border-zinc-800/50 rounded-3xl p-5 shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-600/10 to-[#ff6b00]/10 rounded-full blur-2xl" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#ff6b00] rounded-full inline-block animate-pulse" />
            <span className="text-[10px] text-orange-400 font-extrabold uppercase tracking-widest">Premium Curation</span>
          </div>
          <h3 className="text-sm font-black text-white tracking-tight">유튜브 속 인생 맛집을 우리집 식탁으로</h3>
          <p className="text-[10.5px] text-zinc-500 leading-relaxed pt-0.5">
            방송과 유튜브 채널에서 격찬받은 시그니처 메뉴들을 최고의 밀키트 최저가 혜택으로 제휴 쇼핑할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 밀키트 카드 목록 */}
      <div className="grid grid-cols-1 gap-4">
        {mealKits.map((item, index) => (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            key={item.id}
            className="group bg-zinc-900/30 hover:bg-zinc-900/55 border border-zinc-900/90 hover:border-zinc-800/60 rounded-3xl p-4 flex gap-4 shadow-lg transition-all duration-300 overflow-hidden relative"
          >
            {/* 썸네일 영역 */}
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-zinc-950 border border-white/5">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
              {/* 할인율 스티커 */}
              <div className="absolute top-1 left-1.5 bg-gradient-to-r from-red-600 to-[#ff6b00] text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md">
                {item.discountRate}%
              </div>
            </div>

            {/* 상품 정보 영역 */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9.5px] font-black text-orange-400 bg-orange-500/10 border border-orange-500/10 px-1.5 py-0.2 rounded">
                    {item.restaurantName}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-400 truncate">
                    {item.youtuberName}
                  </span>
                </div>
                
                <h4 className="text-[12.5px] font-extrabold text-white mt-1.5 leading-snug truncate group-hover:text-orange-400 transition-colors">
                  {item.name}
                </h4>

                {/* 태그 리스트 */}
                <div className="flex gap-1 mt-1 flex-wrap">
                  {item.tags.map(t => (
                    <span key={t} className="text-[8px] font-medium text-zinc-500 bg-zinc-800/40 px-1 py-0.2 rounded-md">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* 하단 가격 및 구매 단추 */}
              <div className="flex items-end justify-between mt-2 pt-1 border-t border-zinc-900/40">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-zinc-500 line-through block font-medium">
                    {item.originalPrice.toLocaleString()}원
                  </span>
                  <span className="text-[13px] font-black text-white block tracking-tight">
                    {item.salePrice.toLocaleString()}원
                  </span>
                </div>

                <motion.a
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  href={item.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-[#ff6b00] text-[10px] font-black text-white shadow-md shadow-red-600/10 hover:shadow-orange-500/15 cursor-pointer transition-shadow"
                >
                  <ShoppingCart size={11} />
                  최저가 구매
                  <ExternalLink size={9} className="opacity-70" />
                </motion.a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 제휴 수수료 법적 공시 영역 */}
      <AffiliateDisclosure />
    </div>
  );
}
