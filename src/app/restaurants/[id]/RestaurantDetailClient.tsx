'use client';

import { Restaurant, Video, AffiliateProduct } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Utensils, Navigation, Share2, Flame, Play, ShoppingBag,
  ExternalLink, Home, X, Volume2, Sparkles, Phone, Clock, ChevronDown,
  ChevronUp, Star, Car, CalendarCheck, Package, Info, Copy, Check,
  ChevronRight
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { MichelinIcon, BlueRibbonIcon } from '@/components/icons/CustomIcons';
import { openExternal } from '@/lib/external-link';
import { supabase } from '@/lib/supabase/client';
import { AffiliateDisclosure } from '@/components/AffiliateDisclosure';
import Link from 'next/link';
import { getRestaurantRatings } from '@/lib/constants/ratings';

// ─── Helper Functions ─────────────────────────────────────────────────

const getFallbackThumbnail = (category: string) => {
  const cat = category || '';
  if (cat.includes('삼겹살') || cat.includes('고기') || cat.includes('갈비') || cat.includes('육류'))
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80';
  if (cat.includes('곱창') || cat.includes('전골') || cat.includes('찌개') || cat.includes('탕') || cat.includes('국물'))
    return 'https://images.unsplash.com/photo-1547928500-3001aa3092a0?w=500&q=80';
  if (cat.includes('일식') || cat.includes('라멘') || cat.includes('면') || cat.includes('스시') || cat.includes('초밥'))
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80';
  if (cat.includes('파스타') || cat.includes('양식') || cat.includes('이탈리안') || cat.includes('피자') || cat.includes('브런치'))
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80';
  if (cat.includes('카페') || cat.includes('디저트') || cat.includes('빵') || cat.includes('베이커리'))
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80';
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80';
};

const getYouTubeId = (urlOrId: string): string => {
  if (!urlOrId) return '';
  if (urlOrId.length === 11 && !urlOrId.includes('/') && !urlOrId.includes('?')) return urlOrId;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = urlOrId.match(regExp);
  return (match && match[2].length === 11) ? match[2] : urlOrId;
};

const formatRelativeTime = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24) return `${diffHr}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
  if (diffMonth < 12) return `${diffMonth}개월 전`;
  return `${diffYear}년 전`;
};

const checkAvailability = (value: string | null | undefined): boolean => {
  if (!value || value === '정보 없음' || value.trim() === '') return false;
  const cleanVal = value.trim();
  const temp = cleanVal
    .replace(/불가능/g, '').replace(/불가/g, '').replace(/없음/g, '')
    .replace(/미지원/g, '').replace(/미제공/g, '').replace(/금지/g, '');
  const hasPositiveException = /가능|지원|제공|이용/.test(temp);
  const hasNegation = /불가|없음|불가능|금지|미지원|미제공/.test(cleanVal);
  if (hasNegation && !hasPositiveException) return false;
  return true;
};

interface OpenStatus {
  status: 'open' | 'closed' | 'break' | 'unknown';
  label: string;
  colorClass: string;
}

const getStoreOpenStatus = (hoursText?: string | null): OpenStatus => {
  if (!hoursText || hoursText === '정보 없음' || hoursText.trim() === '') {
    return { status: 'unknown', label: '영업 정보 없음', colorClass: 'text-zinc-400 bg-zinc-700/40 border border-zinc-600/30' };
  }

  try {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstDate = new Date(utc + (3600000 * 9));
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const currentDay = dayNames[kstDate.getDay()];
    const currentHour = kstDate.getHours();
    const currentMin = kstDate.getMinutes();
    const currentTime = currentHour * 60 + currentMin;

    const holidayRegex = new RegExp(`(${currentDay}요일\\s*정기?\\s*휴무|${currentDay}요일\\s*휴무|매주\\s*${currentDay}요일|${currentDay}\\s*휴무)`);
    if (holidayRegex.test(hoursText) && !hoursText.includes(`${currentDay}요일: 1`) && !hoursText.includes(`${currentDay}요일 1`)) {
      return { status: 'closed', label: '정기 휴무일', colorClass: 'text-red-400 bg-red-500/10 border border-red-500/20' };
    }

    const timeRegex = /(\d{2}):(\d{2})/g;
    const times: { time: number; str: string }[] = [];
    let match;
    while ((match = timeRegex.exec(hoursText)) !== null) {
      times.push({ time: parseInt(match[1], 10) * 60 + parseInt(match[2], 10), str: match[0] });
    }

    if (times.length >= 2) {
      let openTime = times[0].time;
      let closeTime = times[1].time;
      const isWeekend = kstDate.getDay() === 0 || kstDate.getDay() === 6;
      if (hoursText.includes('평일') && hoursText.includes('주말') && times.length >= 4) {
        if (isWeekend) { openTime = times[2].time; closeTime = times[3].time; }
        else { openTime = times[0].time; closeTime = times[1].time; }
      }

      let breakStart = -1, breakEnd = -1;
      const breakMatch = hoursText.match(/(?:브레이크\s*타임|브레이크타임)\s*(\d{2}):(\d{2})\s*[-~–]\s*(\d{2}):(\d{2})/);
      if (breakMatch) {
        breakStart = parseInt(breakMatch[1], 10) * 60 + parseInt(breakMatch[2], 10);
        breakEnd = parseInt(breakMatch[3], 10) * 60 + parseInt(breakMatch[4], 10);
      }

      let isOpenRange = false;
      if (closeTime < openTime) isOpenRange = currentTime >= openTime || currentTime < closeTime;
      else isOpenRange = currentTime >= openTime && currentTime < closeTime;

      if (isOpenRange) {
        if (breakStart !== -1 && breakEnd !== -1 && currentTime >= breakStart && currentTime < breakEnd) {
          return { status: 'break', label: `브레이크 타임`, colorClass: 'text-orange-400 bg-orange-500/10 border border-orange-500/20' };
        }
        const lastOrderTime = closeTime - 30;
        if (currentTime >= lastOrderTime && currentTime < closeTime) {
          return { status: 'open', label: '곧 마감', colorClass: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' };
        }
        return { status: 'open', label: '영업 중', colorClass: 'text-green-400 bg-green-500/10 border border-green-500/20' };
      } else {
        return { status: 'closed', label: '영업 종료', colorClass: 'text-zinc-400 bg-zinc-700/30 border border-zinc-600/20' };
      }
    }
  } catch (e) {
    console.error('Error parsing business hours status:', e);
  }

  return { status: 'unknown', label: '영업 정보 있음', colorClass: 'text-green-400/90 bg-green-500/10 border border-green-500/20' };
};

const splitHoursIntoLines = (hoursText: string): string[] => {
  const rawLines = hoursText.split('\n');
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (trimmed.includes(',') && !trimmed.includes('\n')) {
      let parenDepth = 0;
      let current = '';
      const subLines: string[] = [];
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        if (char === '(' || char === '[') { parenDepth++; current += char; }
        else if (char === ')' || char === ']') { parenDepth = Math.max(0, parenDepth - 1); current += char; }
        else if (char === ',' && parenDepth === 0) { if (current.trim()) subLines.push(current.trim()); current = ''; }
        else current += char;
      }
      if (current.trim()) subLines.push(current.trim());
      lines.push(...subLines);
    } else lines.push(trimmed);
  }
  return lines;
};

const getTodayHoursLine = (lines: string[]): { todayLine: string; todayIndex: number } => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kstDate = new Date(utc + (3600000 * 9));
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const currentDay = dayNames[kstDate.getDay()];
  const isWeekend = kstDate.getDay() === 0 || kstDate.getDay() === 6;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const regex = new RegExp(`(${currentDay}요일|\\b${currentDay}\\b|^${currentDay}[\\s~-]|[^a-zA-Z0-9가-힣]${currentDay}[\\s~-])`);
    if (regex.test(line)) {
      const rangeMatch = line.match(/([월화수목금토일])\s*[~-]\s*([월화수목금토일])/);
      if (rangeMatch) {
        const startIndex = dayNames.indexOf(rangeMatch[1]);
        const endIndex = dayNames.indexOf(rangeMatch[2]);
        const todayIndex = kstDate.getDay();
        let inRange = startIndex <= endIndex ? (todayIndex >= startIndex && todayIndex <= endIndex) : (todayIndex >= startIndex || todayIndex <= endIndex);
        if (inRange) return { todayLine: line, todayIndex: i };
      } else return { todayLine: line, todayIndex: i };
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rangeMatch = line.match(/([월화수목금토일])\s*[~-]\s*([월화수목금토일])/);
    if (rangeMatch) {
      const startIndex = dayNames.indexOf(rangeMatch[1]);
      const endIndex = dayNames.indexOf(rangeMatch[2]);
      const todayIndex = kstDate.getDay();
      let inRange = startIndex <= endIndex ? (todayIndex >= startIndex && todayIndex <= endIndex) : (todayIndex >= startIndex || todayIndex <= endIndex);
      if (inRange) return { todayLine: line, todayIndex: i };
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (isWeekend && lines[i].includes('주말')) return { todayLine: lines[i], todayIndex: i };
    if (!isWeekend && lines[i].includes('평일')) return { todayLine: lines[i], todayIndex: i };
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('매일')) return { todayLine: lines[i], todayIndex: i };
  }
  return { todayLine: lines[0] || '정보 없음', todayIndex: 0 };
};

const getCleanTodayLine = (line: string): string => {
  return line.replace(/\s*\([^)]*(?:브레이크|쉬는시간|라스트|order|LO)[^)]*\)/gi, '').trim();
};

interface MenuItem { name: string; price?: string; description?: string; }

const splitMenuItems = (str: string): string[] => {
  const items: string[] = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(' || char === '[') { parenDepth++; current += char; }
    else if (char === ')' || char === ']') { parenDepth = Math.max(0, parenDepth - 1); current += char; }
    else if ((char === ',' || char === '/' || char === '\n') && parenDepth === 0) {
      const isThousandsSeparator = char === ',' && i > 0 && i < str.length - 1 && /\d/.test(str[i-1]) && /\d/.test(str[i+1]);
      if (isThousandsSeparator) current += char;
      else { if (current.trim()) items.push(current.trim()); current = ''; }
    } else current += char;
  }
  if (current.trim()) items.push(current.trim());
  return items;
};

const parseSingleMenuItem = (item: string): MenuItem => {
  const cleanItem = item.trim();
  const cleanDescStr = (desc?: string | null) => {
    if (!desc) return undefined;
    let d = desc.trim();
    if (d.endsWith('.')) d = d.slice(0, -1);
    if (d.startsWith('(') && d.endsWith(')')) d = d.slice(1, -1);
    d = d.trim();
    return d ? `(${d})` : undefined;
  };
  if (cleanItem.includes(':')) {
    const parts = cleanItem.split(':');
    const rawName = parts[0].trim();
    const right = parts.slice(1).join(':').trim();
    const match = right.match(/^((?:\d{1,3}(?:,\d{3})+|\d+)\s*원?(?:\s*~\s*(?:\d{1,3}(?:,\d{3})+|\d+)\s*원?)?)(?:\s*[.\s(]+(.*?)\)?)?$/);
    if (match) return { name: rawName, price: match[1].trim(), description: cleanDescStr(match[2]?.trim()) };
    return { name: rawName, price: right };
  }
  const match = cleanItem.match(/^(.*?)\s+((?:\d{1,3}(?:,\d{3})+|\d+)\s*원?)(?:\s*[.\s(]+(.*?)\)?)?$/);
  if (match) {
    const price = match[2].trim();
    return { name: match[1].trim(), price: price.endsWith('원') ? price : `${Number(price.replace(/,/g, '')).toLocaleString()}원`, description: cleanDescStr(match[3]?.trim()) };
  }
  return { name: cleanItem };
};

const parseMenuData = (menuInfoStr: string | null | undefined): MenuItem[] => {
  if (!menuInfoStr) return [];
  try {
    if (menuInfoStr.trim().startsWith('[')) {
      const parsed = JSON.parse(menuInfoStr);
      if (Array.isArray(parsed)) {
        return parsed.map((m: any) => {
          if (m && typeof m === 'object' && m.name) return { name: m.name, price: m.price ? `${Number(m.price).toLocaleString()}원` : undefined };
          return parseSingleMenuItem(String(m));
        });
      }
    }
  } catch (e) { console.warn("Failed to parse menu_info as JSON:", e); }
  const cleaned = menuInfoStr.replace(/<br\s*\/?>/gi, '\n');
  return splitMenuItems(cleaned).map(item => item.trim()).filter(item => item.length > 0 && item !== '없음').map(parseSingleMenuItem);
};

const getTagStyle = (source: string) => {
  switch (source) {
    case 'michelin': return { bg: 'bg-red-700/20 border border-red-500/30', text: 'text-red-300', icon: MichelinIcon };
    case 'blueribbon': return { bg: 'bg-blue-600/20 border border-blue-500/30', text: 'text-blue-300', icon: BlueRibbonIcon };
    case 'ddoganjib': return { bg: 'bg-orange-500/20 border border-orange-500/30', text: 'text-brand-orange-light', icon: Flame };
    case 'netflix_chef': return { bg: 'bg-gray-800 border border-white/10', text: 'text-white/90', icon: Utensils };
    default: return { bg: 'bg-white/5 border border-white/5', text: 'text-white/80', icon: null };
  }
};

// ─── Fade-in animation variant ─────────────────────────────────────────
const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── Mock Affiliate Product ─────────────────────────────────────────────

const getMockProduct = (res: Restaurant): AffiliateProduct => {
  const cat = res.category || '';
  const name = res.name || '';
  if (cat.includes('삼겹살') || cat.includes('고기') || name.includes('갈비') || name.includes('고기'))
    return { id: 'mock-1', title: '[로켓프레시] 프리미엄 벌집 삼겹살 & 파절이 밀키트', price: 15900, image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80', deeplink_url: 'https://www.coupang.com', category: '육류' };
  if (cat.includes('곱창') || cat.includes('전골') || cat.includes('찌개') || cat.includes('탕'))
    return { id: 'mock-2', title: '[로켓프레시] 소곱창 전골 명가 밀키트 (2~3인분)', price: 19800, image_url: 'https://images.unsplash.com/photo-1547928500-3001aa3092a0?w=500&q=80', category: '국물/요리', deeplink_url: 'https://www.coupang.com' };
  if (cat.includes('일식') || cat.includes('라멘') || cat.includes('면') || name.includes('우동'))
    return { id: 'mock-3', title: '[로켓프레시] 수제 챠슈 돈코츠라멘 2인 패키지', price: 12500, image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80', category: '면류', deeplink_url: 'https://www.coupang.com' };
  if (cat.includes('파스타') || cat.includes('양식') || cat.includes('이탈리안') || cat.includes('피자'))
    return { id: 'mock-4', title: '[로켓프레시] 쉬림프 로제 파스타 세트 (2인분)', price: 11900, image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80', category: '양식', deeplink_url: 'https://www.coupang.com' };
  return { id: 'mock-default', title: `[로켓프레시] ${res.name} 시그니처 프리미엄 밀키트`, price: 14900, image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80', category: '간편조리', deeplink_url: 'https://www.coupang.com' };
};

// ─── Main Component ─────────────────────────────────────────────────

interface RelatedRestaurant {
  id: string;
  name: string;
  category: string;
  address: string;
  thumbnail?: string;
}

interface RestaurantDetailClientProps {
  restaurant: Restaurant;
  relatedRestaurants?: RelatedRestaurant[];
}

export default function RestaurantDetailClient({ restaurant, relatedRestaurants = [] }: RestaurantDetailClientProps) {

  // ─── Deep link helpers ─────────────────────────────────────────────
  const openNaverDeeplink = (name: string, address?: string) => {
    const query = name + ' ' + (address ? address.split(' ').slice(0, 2).join(' ') : '');
    const encodedQuery = encodeURIComponent(query);
    if (typeof window === 'undefined') return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `nmap://search?query=${encodedQuery}&appname=modoo-matjip`;
      setTimeout(() => { window.open(`https://m.map.naver.com/search2/search.naver?query=${encodedQuery}`, '_blank', 'noopener,noreferrer'); }, 1500);
    } else {
      openExternal(`https://map.naver.com/p/search/${encodedQuery}`, { reason: 'naver_map_review' });
    }
  };

  const openKakaoDeeplink = (name: string, kakaoPlaceId?: string, lat?: number, lng?: number) => {
    if (typeof window === 'undefined') return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      const appUrl = kakaoPlaceId ? `kakaomap://look?id=${kakaoPlaceId}` : `kakaomap://search?q=${encodeURIComponent(name)}`;
      window.location.href = appUrl;
      setTimeout(() => {
        const webUrl = kakaoPlaceId ? `https://place.map.kakao.com/${kakaoPlaceId}` : `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }, 1500);
    } else {
      const pcUrl = kakaoPlaceId ? `https://place.map.kakao.com/${kakaoPlaceId}` : `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
      openExternal(pcUrl, { reason: 'kakao_map_review' });
    }
  };

  const openKakaoRouteDeeplink = (name: string, kakaoPlaceId?: string, lat?: number, lng?: number) => {
    if (typeof window === 'undefined') return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      const appUrl = kakaoPlaceId ? `kakaomap://route?ep=${kakaoPlaceId}&by=CAR` : `kakaomap://route?ep=${lat},${lng}&by=CAR`;
      window.location.href = appUrl;
      setTimeout(() => {
        const webUrl = kakaoPlaceId ? `https://map.kakao.com/link/to/${kakaoPlaceId}` : `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }, 1500);
    } else {
      const pcUrl = kakaoPlaceId ? `https://map.kakao.com/link/to/${kakaoPlaceId}` : `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
      openExternal(pcUrl, { reason: 'kakao_navi' });
    }
  };

  // ─── State ─────────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const [isShareHovered, setIsShareHovered] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  useEffect(() => {
    const saved = localStorage.getItem('modoo-matjip-favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  const toggleFavorite = (id: string) => {
    let updated;
    if (favorites.includes(id)) {
      updated = favorites.filter(favId => favId !== id);
    } else {
      updated = [...favorites, id];
    }
    setFavorites(updated);
    localStorage.setItem('modoo-matjip-favorites', JSON.stringify(updated));
    localStorage.setItem('favorite_restaurants', JSON.stringify(updated));
    window.dispatchEvent(new Event('favoritesUpdated'));
  };

  const sortedVideos = restaurant.videos ? [...restaurant.videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)) : [];
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [isHoursExpanded, setIsHoursExpanded] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const activeVideo = sortedVideos[activeVideoIndex];

  const cleanYoutubeId = activeVideo ? getYouTubeId(activeVideo.youtube_id) : '';
  const thumbnailFallback = activeVideo?.thumbnail || (cleanYoutubeId ? `https://img.youtube.com/vi/${cleanYoutubeId}/0.jpg` : '');

  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isStickyVideo, setIsStickyVideo] = useState(false);
  const [isPipClosed, setIsPipClosed] = useState(false);
  const mainVideoRef = useRef<HTMLDivElement>(null);

  const [affiliateProduct, setAffiliateProduct] = useState<AffiliateProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  const loadAffiliateProduct = async (res: Restaurant) => {
    setLoadingProduct(true);
    try {
      const { data } = await supabase.from('affiliate_products').select('*').limit(5);
      if (data && data.length > 0) {
        const matched = data.find(p =>
          p.keywords?.some((k: string) => res.category?.includes(k) || res.name?.includes(k)) ||
          p.title.includes(res.category || '')
        );
        if (matched) { setAffiliateProduct(matched as AffiliateProduct); return; }
        setAffiliateProduct(data[0] as AffiliateProduct);
      } else setAffiliateProduct(getMockProduct(res));
    } catch (err) {
      console.error("Affiliate product load fallback:", err);
      setAffiliateProduct(getMockProduct(res));
    } finally { setLoadingProduct(false); }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveVideoIndex(0);
    setIsPlayingVideo(false);
    setIsStickyVideo(false);
    setIsPipClosed(false);
    setIsBookmarkHovered(false);
    setIsShareHovered(false);
    setShowRouteModal(false);
    loadAffiliateProduct(restaurant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  // IntersectionObserver for PIP
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isPlayingVideo) { setIsStickyVideo(false); return; }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.boundingClientRect && entry.boundingClientRect.width === 0) return;
        if (typeof window !== 'undefined' && window.scrollY < 100) { setIsStickyVideo(false); return; }
        setIsStickyVideo(!entry.isIntersecting);
      },
      { root: null, threshold: 0.05 }
    );
    if (mainVideoRef.current) observer.observe(mainVideoRef.current);
    return () => { observer.disconnect(); };
  }, [restaurant.id, isPlayingVideo]);

  useEffect(() => { if (!isStickyVideo) setIsPipClosed(false); }, [isStickyVideo]);

  const handleProductClick = async (product: AffiliateProduct) => {
    try {
      const parsedProductId = typeof product.id === 'number' ? product.id : null;
      await supabase.from('affiliate_events').insert({
        restaurant_id: restaurant.id, product_id: parsedProductId, event_type: 'click',
        session_id: `session-isr-${Date.now()}`,
        metadata: { source: 'isr_detail_bridge', product_title: product.title, is_mock: typeof product.id === 'string' }
      });
    } catch (e) { console.error("Failed to log event:", e); }
    openExternal(product.deeplink_url, { reason: 'affiliate_shop' });
  };

  const staticMapUrl = `https://dapi.kakao.com/v2/maps/staticmap?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY || '96324fa9ee898b3f2c5e53cc0bcf8d74'}&cx=${restaurant.lng}&cy=${restaurant.lat}&level=4&mx=${restaurant.lng}&my=${restaurant.lat}&w=600&h=300&m=pin`;
  const isPipActive = isPlayingVideo && isStickyVideo && !isPipClosed;

  const openStatus = getStoreOpenStatus(restaurant.business_hours);
  const hasParking = checkAvailability(restaurant.parking);
  const hasReservation = checkAvailability(restaurant.reservation);
  const hasPackaging = checkAvailability(restaurant.packaging);
  const menuItems = parseMenuData(restaurant.menu_info);
  const hasMenu = restaurant.menu_info && restaurant.menu_info !== '정보 없음' && menuItems.length > 0;

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-3xl mx-auto select-none pb-12">
      {/* Global SVG Gradient */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="red-orange-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
        </defs>
      </svg>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: Header Bar
          ═══════════════════════════════════════════════════════════════ */}
      <header className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-white/5 shrink-0">
        <Link href="/" className="flex items-center gap-2 group text-white/70 hover:text-white transition-colors">
          <div className="p-2.5 bg-zinc-800 group-hover:bg-gradient-to-tr group-hover:from-red-600 group-hover:to-orange-500 rounded-2xl border border-zinc-700 group-hover:border-orange-500/30 transition-all">
            <Home size={18} />
          </div>
          <span className="font-extrabold text-sm tracking-tight hidden sm:inline">모두의 맛집</span>
        </Link>
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-orange-500 px-3.5 py-1.5 rounded-full text-xs font-black shadow-lg shadow-red-600/15">
          🔥 CREATOR PICK
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: Video Player
          ═══════════════════════════════════════════════════════════════ */}
      {activeVideo ? (
        <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
          <div ref={mainVideoRef} className="relative w-full aspect-video bg-black/60 z-20">
            {/* Video Container (PIP or Inline) */}
            <div className={
              isPipActive
                ? "fixed bottom-24 right-4 w-[170px] sm:w-[280px] aspect-video z-50 rounded-2xl shadow-[0_12px_45px_rgba(234,88,12,0.4)] border-2 border-orange-500 bg-black overflow-hidden transition-all duration-500"
                : "absolute inset-0 w-full h-full border-b border-white/10 bg-black overflow-hidden transition-all duration-500"
            }>
              {isPlayingVideo ? (
                <div className="relative w-full h-full group">
                  <iframe
                    src={`https://www.youtube.com/embed/${cleanYoutubeId}?autoplay=1&mute=1&playsinline=1`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  {isPipActive && (
                    <div className="absolute inset-x-0 top-0 p-2 bg-gradient-to-b from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between z-10">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-white/90 truncate max-w-[110px] sm:max-w-[180px]">
                        {activeVideo.youtuber.name} 추천 영상
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsPipClosed(true); }}
                        className="p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-all border border-white/15 cursor-pointer"
                      >
                        <X size={10} className="stroke-[2.5]" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative w-full h-full">
                  <img
                    src={thumbnailFallback}
                    alt={activeVideo.title}
                    className="w-full h-full object-cover brightness-[0.85]"
                    onError={(e) => { (e.target as HTMLImageElement).src = getFallbackThumbnail(restaurant.category || ''); }}
                  />
                  {activeVideo.is_short && (
                    <div className="absolute bottom-3 right-3 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg z-20">
                      <Play size={7} fill="currentColor" /> SHORTS
                    </div>
                  )}
                  <button
                    onClick={() => openExternal(`https://www.youtube.com/watch?v=${cleanYoutubeId}`, { reason: 'original_youtube_jump' })}
                    className="absolute top-4 right-4 z-20 px-3 py-1.5 bg-black/60 hover:bg-orange-500 backdrop-blur-md text-white text-[10px] font-bold rounded-full border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    유튜브 앱으로 열기 <ExternalLink size={10} />
                  </button>
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsPlayingVideo(true)}
                      className="w-16 h-16 rounded-full bg-gradient-to-r from-red-600 to-orange-500 flex items-center justify-center text-white shadow-[0_8px_30px_rgba(234,88,12,0.5)] cursor-pointer border border-orange-500/25"
                    >
                      <Play size={22} className="ml-1 fill-current" />
                    </motion.button>
                  </div>
                  {activeVideo.view_count !== undefined && activeVideo.view_count !== null && (
                    <div className="absolute bottom-4 left-4 z-20 bg-black/55 backdrop-blur-md border border-white/10 text-white/90 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <Flame size={12} className="text-red-500 fill-current" />
                      조회수 {activeVideo.view_count.toLocaleString()}회{activeVideo.published_at && ` · ${formatRelativeTime(activeVideo.published_at)}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PIP placeholder */}
            {isPipActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-center p-6 space-y-3">
                <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-orange-400/75">
                  <Volume2 size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-white text-xs font-extrabold">화면 구석에서 영상 재생 중</p>
                  <p className="text-zinc-500 text-[10px] font-semibold">스크롤을 맨 위로 복귀하면 메인 화면으로 돌아옵니다.</p>
                </div>
              </div>
            )}
          </div>

          {/* Mute notice (simplified) */}
          {isPlayingVideo && !isPipActive && (
            <div className="mx-4 sm:mx-6 mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-zinc-400 bg-zinc-900/60 border border-zinc-800 py-2 px-4 rounded-xl">
              <Volume2 size={12} className="text-orange-400 shrink-0" />
              <span>브라우저 정책에 따라 음소거로 시작됩니다. 영상 내 볼륨 아이콘을 클릭해 소리를 켜세요.</span>
            </div>
          )}
        </motion.div>
      ) : (
        /* No-video fallback for curated restaurants */
        <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="relative w-full aspect-[21/9] bg-gradient-to-br from-zinc-900 to-zinc-950 border-b border-white/5 flex flex-col justify-center items-center text-center overflow-hidden">
          <div className="relative z-10 space-y-3 flex flex-col items-center">
            <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-full flex items-center justify-center">
              <Sparkles size={20} className="fill-current" />
            </div>
            <div className="space-y-1">
              <h3 className="text-white text-base font-black tracking-tight">공식 미식 가이드 인증 매장</h3>
              <p className="text-zinc-500 text-[11px] font-semibold max-w-md leading-relaxed">미쉐린 가이드 및 블루리본 등의 검증 기관 공인 미식 성지입니다.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: Unified Profile Card
          식당명 + 평점 + 영업상태 + 배지 + AI요약 + 편의정보 통합
          ═══════════════════════════════════════════════════════════════ */}
      <motion.section initial="hidden" animate="visible" variants={fadeInUp} className="mx-4 sm:mx-6 mt-5 bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-28 h-28 bg-orange-500/8 rounded-full filter blur-3xl -z-10" />

        {/* Row 1: Name */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
          {restaurant.name}
        </h1>

        {/* Row 2: Category + Ratings */}
        <div className="flex items-center flex-wrap gap-2 mb-3">
          <span className="text-[13px] font-semibold text-zinc-400">{restaurant.category}</span>
          <span className="text-zinc-700">·</span>
          {(() => {
            const { naverRating, kakaoRating } = getRestaurantRatings(restaurant.name, restaurant.id);
            return (
              <div className="flex items-center gap-1.5 text-[11px] font-bold select-none">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md">
                  <span>네이버</span>
                  <Star size={9.5} className="fill-current shrink-0" />
                  <span>{naverRating}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-md">
                  <span>카카오</span>
                  <Star size={9.5} className="fill-current shrink-0" />
                  <span>{kakaoRating}</span>
                </span>
              </div>
            );
          })()}
        </div>

        {/* Row 2.5: Quick Action Buttons (전화, 즐겨찾기, 공유하기, 길찾기) */}
        <div className="grid grid-cols-4 gap-3 pt-1 pb-2">
          {/* 전화 */}
          <button
            onClick={() => {
              if (restaurant.phone && restaurant.phone !== '정보 없음' && restaurant.phone.trim() !== '') {
                window.location.href = `tel:${restaurant.phone}`;
              } else {
                alert('등록된 전화번호가 없습니다.');
              }
            }}
            className="flex flex-col items-center justify-center py-2.5 bg-zinc-800/40 hover:bg-zinc-800/80 border border-white/5 rounded-2xl transition-all gap-1 cursor-pointer group"
          >
            <Phone size={15} className="text-zinc-400 group-hover:text-white transition-colors" />
            <span className="text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors">전화</span>
          </button>

          {/* 즐겨찾기 */}
          <button
            onClick={() => toggleFavorite && toggleFavorite(restaurant.id)}
            onMouseEnter={() => setIsBookmarkHovered(true)}
            onMouseLeave={() => setIsBookmarkHovered(false)}
            className={`flex flex-col items-center justify-center py-2.5 border rounded-2xl transition-all gap-1 cursor-pointer group ${
              (favorites.includes(restaurant.id) || isBookmarkHovered)
                ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_2px_10px_rgba(255,75,0,0.15)]'
                : 'bg-zinc-800/40 hover:bg-zinc-800/80 border-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <Star 
              size={15} 
              stroke={(favorites.includes(restaurant.id) || isBookmarkHovered) ? 'url(#red-orange-grad)' : 'currentColor'}
              fill={(favorites.includes(restaurant.id) || isBookmarkHovered) ? 'url(#red-orange-grad)' : 'none'} 
              strokeWidth={(favorites.includes(restaurant.id) || isBookmarkHovered) ? 2.5 : 2}
            />
            <span className="text-[11px] font-bold">즐겨찾기</span>
          </button>

          {/* 공유하기 */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: restaurant.name,
                  text: `[모두의 맛집] ${restaurant.name} - ${restaurant.category}`,
                  url: window.location.href,
                }).catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('맛집 링크가 클립보드에 복사되었습니다.');
              }
            }}
            onMouseEnter={() => setIsShareHovered(true)}
            onMouseLeave={() => setIsShareHovered(false)}
            className={`flex flex-col items-center justify-center py-2.5 border rounded-2xl transition-all gap-1 cursor-pointer group ${
              isShareHovered
                ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_2px_10px_rgba(255,75,0,0.15)]'
                : 'bg-zinc-800/40 hover:bg-zinc-800/80 border-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <Share2 
              size={15} 
              stroke={isShareHovered ? 'url(#red-orange-grad)' : 'currentColor'}
              fill={isShareHovered ? 'url(#red-orange-grad)' : 'none'}
              strokeWidth={isShareHovered ? 2.5 : 2}
            />
            <span className="text-[11px] font-bold">공유하기</span>
          </button>

          {/* 길찾기 */}
          <button
            onClick={() => setShowRouteModal(true)}
            className="flex flex-col items-center justify-center py-2.5 bg-zinc-800/40 hover:bg-zinc-800/80 border border-white/5 rounded-2xl transition-all gap-1 cursor-pointer group"
          >
            <Navigation size={15} className="text-zinc-400 group-hover:text-white transition-colors" />
            <span className="text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors">길찾기</span>
          </button>
        </div>

        {/* Row 6: Facilities List */}
        <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800 text-[13px] font-medium text-zinc-300">
          {/* Hours */}
          <div className="flex items-start gap-2.5">
            <Clock size={14} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {restaurant.business_hours && restaurant.business_hours !== '정보 없음' ? (() => {
                const lines = splitHoursIntoLines(restaurant.business_hours);
                const { todayLine, todayIndex } = getTodayHoursLine(lines);
                const hasMultipleLines = lines.length > 1 || todayLine.includes('브레이크') || todayLine.includes('쉬는시간');
                const cleanTodayLine = getCleanTodayLine(todayLine);

                // Helper to render inline sleek badge
                const renderStatusBadge = () => {
                  let textColor = 'text-zinc-500';
                  let dotBg = 'bg-zinc-500';
                  
                  if (openStatus.status === 'open') {
                    textColor = 'text-green-400';
                    dotBg = 'bg-green-400';
                  } else if (openStatus.status === 'break') {
                    textColor = 'text-orange-400';
                    dotBg = 'bg-orange-400';
                  } else if (openStatus.status === 'closed') {
                    textColor = 'text-red-400';
                    dotBg = 'bg-red-400';
                  }

                  let cleanLabel = openStatus.label;
                  if (cleanLabel.includes('브레이크 타임')) {
                    cleanLabel = '브레이크 타임';
                  }

                  return (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-zinc-800/40 border border-zinc-700/30 ${textColor} select-none shrink-0 ml-1.5`}>
                      <span className={`w-1 h-1 rounded-full ${dotBg} ${openStatus.status === 'open' ? 'animate-pulse' : ''}`} />
                      {cleanLabel}
                    </span>
                  );
                };

                if (hasMultipleLines) {
                  return (
                    <div className="flex flex-col gap-1 w-full">
                      <div
                        onClick={() => setIsHoursExpanded(!isHoursExpanded)}
                        className="flex items-center justify-between w-full cursor-pointer group"
                      >
                        <div className="flex items-center flex-wrap gap-1 min-w-0">
                          <span className={`text-[13px] leading-relaxed transition-colors ${isHoursExpanded ? 'font-black text-white' : 'font-bold text-zinc-200'}`}>
                            {isHoursExpanded ? todayLine : cleanTodayLine}
                          </span>
                          {!isHoursExpanded && renderStatusBadge()}
                        </div>
                        <div className="text-zinc-500 group-hover:text-white transition-colors p-0.5 shrink-0 ml-1">
                          {isHoursExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </div>
                      </div>
                      <AnimatePresence initial={false}>
                        {isHoursExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col gap-1.5 mt-1.5 pl-2 border-l border-zinc-700 overflow-hidden"
                          >
                            {lines.map((line, idx) => (
                              <div key={idx} className="flex items-center flex-wrap gap-1 min-w-0">
                                <span className={`text-[12px] leading-relaxed ${idx === todayIndex ? 'font-black text-white' : 'font-semibold text-zinc-400'}`}>
                                  {line}
                                </span>
                                {idx === todayIndex && renderStatusBadge()}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center flex-wrap gap-1 min-w-0">
                    <span className="text-[13px] font-bold text-zinc-200 block">{cleanTodayLine}</span>
                    {renderStatusBadge()}
                  </div>
                );
              })() : <span className="text-[13px] font-bold text-zinc-400 block">영업시간 정보 없음</span>}
            </div>
          </div>

          {/* Parking */}
          {restaurant.parking && restaurant.parking !== '정보 없음' && (
            <div className="flex items-start gap-2.5">
              <Car size={14} className="text-orange-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-bold text-zinc-200">주차 {hasParking ? '가능' : '불가'}</span>
                <span className="text-zinc-500 text-[12px] font-semibold ml-1.5">({restaurant.parking})</span>
              </div>
            </div>
          )}

          {/* Reservation / Packaging */}
          <div className="flex items-start gap-2.5">
            <CalendarCheck size={14} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-bold text-zinc-200">
                예약 {hasReservation ? '가능' : '불가'} · 포장 {hasPackaging ? '가능' : '불가'}
              </span>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-2.5">
            <MapPin size={14} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-bold text-zinc-200 leading-normal">{restaurant.address}</span>
              <button
                onClick={() => handleCopy(restaurant.address)}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer shrink-0"
                title="주소 복사"
              >
                {copiedAddress ? <Check size={11} className="text-brand-orange" /> : <Copy size={11} />}
              </button>
            </div>
          </div>
        </div>

        {/* Row 7: AI 꿀팁 (Gemini 추천) */}
        {restaurant.description_summary && (
          <div className="pt-4 border-t border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-orange-400" />
              <span className="text-[13px] font-black text-zinc-200">AI 꿀팁 (Gemini 추천)</span>
            </div>
            <div className="text-[13px] text-zinc-300 font-medium leading-relaxed bg-zinc-800/40 border border-zinc-700/30 rounded-2xl p-4 whitespace-pre-wrap select-text">
              {restaurant.description_summary}
            </div>
          </div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: Creator Lounge
          ═══════════════════════════════════════════════════════════════ */}
      {restaurant.videos && restaurant.videos.length > 0 && (
        <motion.section initial="hidden" animate="visible" variants={fadeInUp} className="mx-4 sm:mx-6 mt-4 bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-1.5 mb-4">
            <Flame size={16} className="text-red-500 fill-current" />
            <span className="text-[14px] font-black tracking-tight text-white">이 맛집을 인증한 크리에이터들</span>
          </div>

          {/* Creator avatar carousel */}
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-3">
            {sortedVideos.map((vid, idx) => {
              const isActive = activeVideoIndex === idx;
              return (
                <div
                  key={vid.id}
                  onClick={() => { setActiveVideoIndex(idx); setIsPlayingVideo(false); }}
                  className="flex flex-col items-center gap-2 cursor-pointer shrink-0 group select-none"
                >
                  <div className={`p-[3px] rounded-full bg-gradient-to-tr ${isActive ? 'from-red-600 to-orange-500 scale-105' : 'from-zinc-700 to-zinc-600 hover:from-zinc-500 hover:to-zinc-400'} transition-all duration-300 transform group-hover:scale-105`}>
                    <div className="p-0.5 bg-zinc-900 rounded-full">
                      <img
                        src={vid.youtuber.profile_image}
                        className="w-12 h-12 rounded-full object-cover border border-zinc-700"
                        alt={vid.youtuber.name}
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(vid.youtuber.name)}&background=random&color=fff&size=128`; }}
                      />
                    </div>
                  </div>
                  <span className={`text-[11px] max-w-[72px] truncate text-center ${isActive ? 'font-black text-orange-400' : 'font-semibold text-zinc-500 group-hover:text-zinc-300'}`}>
                    {vid.youtuber.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* AI keyword tags */}
          {activeVideo?.keywords && activeVideo.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-4 border-t border-zinc-800 mt-3">
              {activeVideo.keywords.map((kw, idx) => (
                <Link
                  key={`${activeVideo.id}-${kw}-${idx}`}
                  href={`/?search=%23${encodeURIComponent(kw)}`}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-orange-500/30 text-orange-400 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                >
                  #{kw}
                </Link>
              ))}
            </div>
          )}
        </motion.section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: Menu (Simplified text list)
          ═══════════════════════════════════════════════════════════════ */}
      {hasMenu && (
        <motion.section initial="hidden" animate="visible" variants={fadeInUp} className="mx-4 sm:mx-6 mt-4 bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Utensils size={16} className="text-orange-500" />
            <span className="text-[14px] font-black tracking-tight text-white">대표 메뉴 & 가격</span>
          </div>
          <div className="flex flex-col gap-1 w-full">
            {menuItems.map((menu, index) => {
              const isSignature = index < 2;
              return (
                <div key={index} className={`flex items-baseline gap-1.5 py-2.5 ${index < menuItems.length - 1 ? 'border-b border-zinc-800/60' : ''}`}>
                  {isSignature && (
                    <span className="shrink-0 px-1.5 py-[1px] bg-orange-500/15 text-orange-400 text-[9px] font-black rounded tracking-tight border border-orange-500/20">
                      대표
                    </span>
                  )}
                  <span className={`font-bold text-zinc-100 ${isSignature ? 'text-[14px]' : 'text-[13px] text-zinc-300'}`}>
                    {menu.name}
                  </span>
                  {menu.description && (
                    <span className="text-[10px] text-zinc-500 font-medium">{menu.description}</span>
                  )}
                  <div className="flex-1 border-b border-dashed border-zinc-700/50 mx-1.5 min-w-[8px] h-3" />
                  {menu.price && (
                    <span className={`font-black text-orange-400 shrink-0 ${isSignature ? 'text-[14px]' : 'text-[13px]'}`}>
                      {menu.price}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="pt-3 flex items-center gap-1.5 border-t border-zinc-800 mt-2">
            <Info size={10} className="text-zinc-600 shrink-0" />
            <p className="text-[10px] text-zinc-600 font-semibold">실제 메뉴 구성 및 가격은 매장 상황에 따라 다를 수 있습니다.</p>
          </div>
        </motion.section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6: Related Restaurants (NEW)
          ═══════════════════════════════════════════════════════════════ */}
      {relatedRestaurants.length > 0 && (
        <motion.section initial="hidden" animate="visible" variants={fadeInUp} className="mx-4 sm:mx-6 mt-4 bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-1.5 mb-4">
            <Sparkles size={16} className="text-orange-400" />
            <span className="text-[14px] font-black tracking-tight text-white">비슷한 맛집 추천</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {relatedRestaurants.map((rel) => (
              <Link
                key={rel.id}
                href={`/restaurants/${rel.id}`}
                className="group bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 hover:border-orange-500/30 rounded-2xl overflow-hidden transition-all"
              >
                <div className="aspect-[16/10] bg-zinc-800 overflow-hidden">
                  <img
                    src={rel.thumbnail || getFallbackThumbnail(rel.category)}
                    alt={rel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 brightness-90"
                    onError={(e) => { (e.target as HTMLImageElement).src = getFallbackThumbnail(rel.category); }}
                  />
                </div>
                <div className="p-3">
                  <h4 className="text-[12px] font-bold text-zinc-100 truncate group-hover:text-orange-400 transition-colors">{rel.name}</h4>
                  <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">{rel.category}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 7: Map & Navigation
          ═══════════════════════════════════════════════════════════════ */}
      <motion.section initial="hidden" animate="visible" variants={fadeInUp} className="mx-4 sm:mx-6 mt-4 bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} className="text-orange-400" />
          <h3 className="font-extrabold text-white text-[14px] tracking-tight">위치</h3>
        </div>

        {/* Static Map */}
        <div
          onClick={() => openKakaoDeeplink(restaurant.name, restaurant.kakao_place_id, restaurant.lat, restaurant.lng)}
          className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden border border-zinc-700/50 cursor-pointer group"
        >
          <img src={staticMapUrl} alt="위치 지도" className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500 brightness-90" />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/30 transition-all">
            <div className="px-3.5 py-2 bg-zinc-900/85 border border-zinc-700 backdrop-blur-md text-[11px] font-bold rounded-xl flex items-center gap-1.5 text-white">
              <MapPin size={11} className="text-orange-400" /> 큰 지도로 보기
            </div>
          </div>
        </div>

        {/* Platform Links */}
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => openNaverDeeplink(restaurant.name, restaurant.address)}
            className="bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 hover:border-green-500/30 rounded-2xl p-3 flex items-center justify-center gap-2 transition-all cursor-pointer group"
          >
            <img
              src="/naver_map_logo.png?v=3"
              alt="Naver" className="w-4 h-4 rounded object-contain"
            />
            <span className="text-[11px] font-bold text-zinc-200 group-hover:text-green-400 transition-colors">네이버 지도</span>
            <ExternalLink size={10} className="text-zinc-600 group-hover:text-green-400 transition-colors shrink-0" />
          </div>
          <div
            onClick={() => openKakaoDeeplink(restaurant.name, restaurant.kakao_place_id, restaurant.lat, restaurant.lng)}
            className="bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 hover:border-yellow-500/30 rounded-2xl p-3 flex items-center justify-center gap-2 transition-all cursor-pointer group"
          >
            <img
              src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAOVBMVEVHcEwAdv//5wD/5AD74gAAfP/64QD64QD64QD74gC4wIOApbw+i+ejtZvv3CJaldjTzlwlhfLc0kuK1weQAAAACnRSTlMA////Fv//+bQX9hPeKgAAALpJREFUKJF901sSgyAMBVBIBHlKcf+LLYYWCYL5ccZjLoFBIazZ9aR2Y4WwM6llhVmjEV0mQinsksVNOqack8ObG4KTUpWS6oMjoiMibvrHo1mpoRP9hTJkekRkCDUPgNIDMKRUX95BuL5aYXoixaoD4JzE1oGU97OB+FbGfb4eggb/UxnhcbZ1zmK+WYdaE+bbeqRl5YlTpNNJXSPD0soaGWqUoW8cMDpkyC4tMtvfr+a2xnLlt/Xv8AWzshIVTzb8eQAAAABJRU5ErkJggg=="
              alt="Kakao" className="w-4 h-4 rounded object-contain"
            />
            <span className="text-[11px] font-bold text-zinc-200 group-hover:text-yellow-400 transition-colors">카카오맵</span>
            <ExternalLink size={10} className="text-zinc-600 group-hover:text-yellow-400 transition-colors shrink-0" />
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 8: Instant Taste (Slim Banner)
          ═══════════════════════════════════════════════════════════════ */}
      {affiliateProduct && (
        <motion.section initial="hidden" animate="visible" variants={fadeInUp} className="mx-4 sm:mx-6 mt-4 bg-gradient-to-r from-orange-500/8 to-transparent border border-zinc-800 rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <ShoppingBag size={14} className="text-orange-400" />
            <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">Instant Taste</span>
          </div>
          <div className="flex gap-3 items-center">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-zinc-700/50">
              <img
                src={affiliateProduct.image_url}
                alt="Meal Kit"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80'; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[12px] font-bold text-zinc-200 leading-snug truncate">{affiliateProduct.title}</h4>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-black text-orange-400">{affiliateProduct.price.toLocaleString()}원</span>
                <span className="text-[10px] text-zinc-600 line-through">{Math.floor(affiliateProduct.price * 1.2 / 100) * 100}원</span>
              </div>
            </div>
            <button
              onClick={() => handleProductClick(affiliateProduct)}
              className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 hover:brightness-110 text-white font-bold rounded-xl text-[11px] transition-all cursor-pointer shrink-0"
            >
              바로가기
            </button>
          </div>
        </motion.section>
      )}

      {/* Affiliate Disclosure */}
      <div className="mx-4 sm:mx-6 mt-3">
        <AffiliateDisclosure />
      </div>

      {/* Route selection modal */}
      <AnimatePresence>
        {showRouteModal && restaurant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRouteModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 text-white z-10"
            >
              <div className="space-y-1.5 text-center">
                <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Navigation size={18} />
                </div>
                <h3 className="text-base font-black tracking-tight">길찾기 앱 선택</h3>
                <p className="text-zinc-400 text-xs font-semibold">출발지: 현재 위치 · 도착지: {restaurant.name}</p>
              </div>

              <div className="flex flex-col gap-2">
                {/* 네이버 지도 */}
                <button
                  onClick={() => {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobile) {
                      const appUrl = `nmap://route/car?dlat=${restaurant.lat}&dlng=${restaurant.lng}&dname=${encodeURIComponent(restaurant.name)}&appname=modoo-matjip`;
                      window.location.href = appUrl;
                      setTimeout(() => {
                        const webUrl = `https://map.naver.com/p/directions/-/${restaurant.lat},${restaurant.lng},${encodeURIComponent(restaurant.name)}/-/car`;
                        window.open(webUrl, '_blank', 'noopener,noreferrer');
                      }, 1500);
                    } else {
                      const pcUrl = `https://map.naver.com/p/directions/-/${restaurant.lat},${restaurant.lng},${encodeURIComponent(restaurant.name)}/-/car`;
                      openExternal(pcUrl, { reason: 'naver_map_route' });
                    }
                    setShowRouteModal(false);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-green-500/30 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src="/naver_map_logo.png?v=3" 
                      alt="Naver" className="w-5 h-5 rounded object-contain shrink-0" 
                    />
                    <span className="text-[13px] font-bold text-zinc-200 group-hover:text-white transition-colors">네이버 지도</span>
                  </div>
                  <ChevronRight size={14} className="text-zinc-500 group-hover:text-white transition-colors shrink-0" />
                </button>

                {/* 카카오맵 */}
                <button
                  onClick={() => {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobile) {
                      const appUrl = restaurant.kakao_place_id 
                        ? `kakaomap://route?ep=${restaurant.kakao_place_id}&by=CAR` 
                        : `kakaomap://route?ep=${restaurant.lat},${restaurant.lng}&by=CAR`;
                      window.location.href = appUrl;
                      setTimeout(() => {
                        const webUrl = restaurant.kakao_place_id 
                          ? `https://map.kakao.com/link/to/${restaurant.kakao_place_id}`
                          : `https://map.kakao.com/link/to/${encodeURIComponent(restaurant.name)},${restaurant.lat},${restaurant.lng}`;
                        window.open(webUrl, '_blank', 'noopener,noreferrer');
                      }, 1500);
                    } else {
                      const pcUrl = restaurant.kakao_place_id 
                        ? `https://map.kakao.com/link/to/${restaurant.kakao_place_id}`
                        : `https://map.kakao.com/link/to/${encodeURIComponent(restaurant.name)},${restaurant.lat},${restaurant.lng}`;
                      openExternal(pcUrl, { reason: 'kakao_navi' });
                    }
                    setShowRouteModal(false);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-yellow-500/30 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAOVBMVEVHcEwAdv//5wD/5AD74gAAfP/64QD64QD64QD74gC4wIOApbw+i+ejtZvv3CJaldjTzlwlhfLc0kuK1weQAAAACnRSTlMA////Fv//+bQX9hPeKgAAALpJREFUKJF901sSgyAMBVBIBHlKcf+LLYYWCYL5ccZjLoFBIazZ9aR2Y4WwM6llhVmjEV0mQinsksVNOqack8ObG4KTUpWS6oMjoiMibvrHo1mpoRP9hTJkekRkCDUPgNIDMKRUX95BuL5aYXoixaoD4JzE1oGU97OB+FbGfb4eggb/UxnhcbZ1zmK+WYdaE+bbeqRl5YlTpNNJXSPD0soaGWqUoW8cMDpkyC4tMtvfr+a2xnLlt/Xv8AWzshIVTzb8eQAAAABJRU5ErkJggg==" 
                      alt="Kakao" className="w-5 h-5 rounded object-contain shrink-0" 
                    />
                    <span className="text-[13px] font-bold text-zinc-200 group-hover:text-white transition-colors">카카오맵</span>
                  </div>
                  <ChevronRight size={14} className="text-zinc-500 group-hover:text-white transition-colors shrink-0" />
                </button>

                {/* 티맵 */}
                <button
                  onClick={() => {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobile) {
                      const appUrl = `tmap://route?rGoName=${encodeURIComponent(restaurant.name)}&rGoX=${restaurant.lng}&rGoY=${restaurant.lat}`;
                      window.location.href = appUrl;
                      setTimeout(() => {
                        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                        const webUrl = isIOS 
                          ? 'https://apps.apple.com/kr/app/tmap-%EB%84%A4%EB%B9%84%EA%B2%8C%EC%9D%B4%EC%85%98-%EC%A7%80%EB%8F%84/id431294717'
                          : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku';
                        window.open(webUrl, '_blank', 'noopener,noreferrer');
                      }, 1500);
                    } else {
                      alert('티맵 앱 길찾기는 모바일 기기에서만 지원합니다. PC에서는 네이버 또는 카카오 지도를 이용해주세요.');
                    }
                    setShowRouteModal(false);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-blue-500/30 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src="/tmap_logo.png?v=3" 
                      alt="Tmap" className="w-5 h-5 rounded object-contain shrink-0" 
                    />
                    <span className="text-[13px] font-bold text-zinc-200 group-hover:text-white transition-colors">티맵 (TMAP)</span>
                  </div>
                  <ChevronRight size={14} className="text-zinc-500 group-hover:text-white transition-colors shrink-0" />
                </button>
              </div>

              <button
                onClick={() => setShowRouteModal(false)}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] transition-all text-white font-bold rounded-2xl text-[12px] cursor-pointer"
              >
                닫기
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
