import { Restaurant } from '@/types';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { MapPin, Utensils, ArrowLeft, Navigation, Play, Flame, Sparkles, X, ChevronLeft, ChevronRight, Eye, Share2, Copy, Star, Plus, Phone, Clock, Info, Check, PlaySquare, ExternalLink, ChevronDown, ChevronUp, Car, CalendarCheck, Coffee, Croissant, Beer, Pizza, Fish, Wine, IceCream2, Sandwich, Soup, Beef, Flag, Tag } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import InfoSuggestModal from './InfoSuggestModal';
import HoursReportModal from './HoursReportModal';
import { openExternal } from '@/lib/external-link';
import { nearbyLandmarks } from '@/lib/landmarks.mjs';

// 표시용 칩 = 근처 랜드마크(대표 1개씩) + 음식 대분류 + 상황어 + 대표 지역. 지역 변형 50개는 매칭 전용이라 숨김.
const SITUATION_TAGS = new Set(['회식', '데이트', '혼밥', '가족모임', '단체', '룸', '심야', '브런치', '노포', '웨이팅', '기념일', '가성비', '주차', '점심', '야식']);

interface DisplayChip { label: string; query: string; }

function buildDisplayChips(restaurant: Restaurant): DisplayChip[] {
  const tags = restaurant.tags || [];
  const lms = nearbyLandmarks(restaurant.lat, restaurant.lng);

  // 방송·큐레이션 칩 (또간집·먹을텐데·흑백요리사·미쉐린·블루리본·착한가격업소 등). content_tags 기반.
  const broadcastChips: DisplayChip[] = [];
  const bcSeen = new Set<string>();
  for (const ct of restaurant.content_tags || []) {
    const label = (ct.label || '').trim();
    if (!label || ct.source === 'youtube' || label === '유튜브 핫플' || label === '유튜브핫플') continue;
    if (bcSeen.has(label)) continue;
    bcSeen.add(label);
    broadcastChips.push({ label, query: label });
  }

  // 근처 랜드마크: 랜드마크당 대표 칩 1개 (약칭 우선), 검색어는 실제 태그(OO맛집)
  const landmarkChips: DisplayChip[] = lms.map((lm) => {
    const label = lm.aliases[0] || lm.name;
    return { label, query: `${label}맛집` };
  });
  // 랜드마크 관련 태그는 아래 버킷에서 제외
  const lmTagSet = new Set<string>();
  for (const lm of lms) {
    for (const n of [lm.name, ...lm.aliases]) { lmTagSet.add(`${n}맛집`); lmTagSet.add(`${n}근처맛집`); }
    for (const s of lm.situation) lmTagSet.add(s);
  }

  // 주소 기반 지역 토큰 (음식/지역 구분용). 시·군·구 + 동(도로명 앞부분)까지 추출.
  const regionTokens = new Set<string>(['광주', '전남광주', '전남']);
  for (const tokRaw of (restaurant.address || '').split(/\s+/)) {
    const tok = tokRaw.trim();
    if (!tok) continue;
    regionTokens.add(tok);
    regionTokens.add(tok.replace(/(통합특별시|광역시|특별자치시|특별자치도|특별시|자치구|구|시|군|동|읍|면|리)$/, ''));
    regionTokens.add(tok.replace(/(대로|번길|로|길|가)\d*.*$/, '')); // 호동로15번길 → 호동
  }
  // 근처 랜드마크명(및 접미사 제거형)도 지역어로 취급 (첨단지구→첨단 등 음식 오분류 방지)
  for (const lm of lms) {
    for (const n of [lm.name, ...lm.aliases]) {
      regionTokens.add(n);
      regionTokens.add(n.replace(/(지구|동|역|공항|시장|터미널|대학교|대학|전당|센터|광장|마을|전망대|아울렛|경기장|필드|산)$/, ''));
    }
  }
  regionTokens.delete('');
  const isRegiony = (t: string) => [...regionTokens].some((rt) => rt.length >= 2 && t.includes(rt));

  const food: string[] = [], situ: string[] = [], region: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = (raw || '').trim();
    if (!t) continue;
    const key = t.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    if (lmTagSet.has(t)) continue; // 랜드마크는 이미 칩으로
    if (t.includes('전남광주통합특별시')) continue; // 너무 긴 정식명은 표시 제외
    if (SITUATION_TAGS.has(t)) situ.push(t);
    else if (!/맛집$/.test(t) && !/\s/.test(t) && !isRegiony(t) && t.length <= 5) food.push(t); // 순수 음식 대분류만
    else if (/맛집$/.test(t) && !/\s/.test(t)) region.push(t); // 지역맛집 (조합/변형어는 표시 제외)
  }
  // 대표 지역 2개 (짧은 것 우선: 광주맛집, 광산맛집)
  const regionTop = region.sort((a, b) => a.length - b.length).slice(0, 2);

  const toChip = (t: string): DisplayChip => ({ label: t, query: t });
  // 중복 라벨 제거(방송칩이 우선)
  const combined = [
    ...broadcastChips,
    ...landmarkChips,
    ...food.slice(0, 6).map(toChip),
    ...situ.slice(0, 4).map(toChip),
    ...regionTop.map(toChip),
  ];
  const outSeen = new Set<string>();
  const result: DisplayChip[] = [];
  for (const c of combined) {
    if (outSeen.has(c.label)) continue;
    outSeen.add(c.label);
    result.push(c);
  }
  return result.slice(0, 14);
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// 유튜브 Iframe API 로더
const loadYouTubeIframeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const previousOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousOnReady) previousOnReady();
      resolve();
    };

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    } else {
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    }
  });
};

const getFallbackThumbnail = (category: string) => {
  const cat = category || '';
  if (cat.includes('삼겹살') || cat.includes('고기') || cat.includes('갈비') || cat.includes('육류')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80';
  }
  if (cat.includes('곱창') || cat.includes('전골') || cat.includes('찌개') || cat.includes('탕') || cat.includes('국물')) {
    return 'https://images.unsplash.com/photo-1547928500-3001aa3092a0?w=500&q=80';
  }
  if (cat.includes('일식') || cat.includes('라멘') || cat.includes('면') || cat.includes('스시') || cat.includes('초밥')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80';
  }
  if (cat.includes('파스타') || cat.includes('양식') || cat.includes('이탈리안') || cat.includes('피자') || cat.includes('브런치')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80';
  }
  if (cat.includes('카페') || cat.includes('디저트') || cat.includes('빵') || cat.includes('베이커리')) {
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80';
  }
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80';
};

const getYouTubeId = (urlOrId: string): string => {
  if (!urlOrId) return '';
  if (urlOrId.length === 11 && !urlOrId.includes('/') && !urlOrId.includes('?')) {
    return urlOrId;
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = urlOrId.match(regExp);
  return (match && match[2].length === 11) ? match[2] : urlOrId;
};

const getFormattedCategory = (categoryStr?: string | null) => {
  if (!categoryStr) return '';
  const parts = categoryStr.split('>');
  if (parts.length >= 2) {
    const main = parts[0].trim();
    const sub = parts[parts.length - 1].trim();
    return `${main} › ${sub}`;
  }
  return categoryStr.trim();
};

const getCategoryIcon = (category?: string | null): React.ReactElement => {
  const c = (category ?? '').toLowerCase();
  if (c.includes('카페') || c.includes('커피') || c.includes('coffee')) return <Coffee size={18} />;
  if (c.includes('베이커리') || c.includes('빵') || c.includes('제과') || c.includes('도넛') || c.includes('bakery')) return <Croissant size={18} />;
  if (c.includes('아이스크림') || c.includes('빙수') || c.includes('디저트')) return <IceCream2 size={18} />;
  if (c.includes('피자')) return <Pizza size={18} />;
  if (c.includes('샌드위치') || c.includes('버거') || c.includes('햄버거') || c.includes('패스트푸드')) return <Sandwich size={18} />;
  if (c.includes('초밥') || c.includes('스시') || c.includes('회') || c.includes('해산물') || c.includes('수산')) return <Fish size={18} />;
  if (c.includes('일식') || c.includes('라멘') || c.includes('우동') || c.includes('소바')) return <Soup size={18} />;
  if (c.includes('삼겹살') || c.includes('갈비') || c.includes('고기') || c.includes('육류') || c.includes('스테이크') || c.includes('소고기') || c.includes('beef')) return <Beef size={18} />;
  if (c.includes('치킨') || c.includes('닭') || c.includes('구이')) return <Flame size={18} />;
  if (c.includes('술') || c.includes('와인') || c.includes('wine') || c.includes('바 ') || c.includes('bar')) return <Wine size={18} />;
  if (c.includes('맥주') || c.includes('호프') || c.includes('beer') || c.includes('펍')) return <Beer size={18} />;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* 숟가락 — 왼쪽 타원 머리 + 손잡이 */}
      <ellipse cx="7" cy="6.5" rx="3.5" ry="4.5" />
      <line x1="7" y1="11" x2="7" y2="22" />
      {/* 젓가락 — 오른쪽 두 선 */}
      <line x1="16" y1="2" x2="16" y2="22" />
      <line x1="20" y1="2" x2="20" y2="22" />
    </svg>
  );
};

const formatViewCount = (count: number) => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1).replace('.0', '')}만`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace('.0', '')}천`;
  }
  return count.toLocaleString();
};


// DB의 menu_info 필드를 파싱하여 배열로 반환하는 헬퍼
interface MenuItem {
  name: string;
  price?: string;
  description?: string;
}

const checkAvailability = (value: string | null | undefined): boolean => {
  if (!value || value === '정보 없음' || value.trim() === '') return false;
  const cleanVal = value.trim();
  
  // Strip out negative expressions so they don't trigger positive matches like '가능' inside '불가능'
  const temp = cleanVal
    .replace(/불가능/g, '')
    .replace(/불가/g, '')
    .replace(/없음/g, '')
    .replace(/미지원/g, '')
    .replace(/미제공/g, '')
    .replace(/금지/g, '');
    
  const hasPositiveException = /가능|지원|제공|이용/.test(temp);
  const hasNegation = /불가|없음|불가능|금지|미지원|미제공/.test(cleanVal);
  
  if (hasNegation && !hasPositiveException) {
    return false;
  }
  return true;
};

interface OpenStatus {
  status: 'open' | 'closed' | 'break' | 'unknown';
  label: string;
  colorClass: string;
}

const getStoreOpenStatus = (hoursText?: string | null): OpenStatus => {
  if (!hoursText || hoursText === '정보 없음' || hoursText.trim() === '') {
    return { status: 'unknown', label: '영업 정보 없음', colorClass: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' };
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

    // 1. 휴무일 판별
    const holidayRegex = new RegExp(`(${currentDay}요일\\s*정기?\\s*휴무|${currentDay}요일\\s*휴무|매주\\s*${currentDay}요일|${currentDay}\\s*휴무)`);
    if (holidayRegex.test(hoursText) && !hoursText.includes(`${currentDay}요일: 1`) && !hoursText.includes(`${currentDay}요일 1`)) {
      return { status: 'closed', label: '정기 휴무일', colorClass: 'text-red-400 bg-red-500/10 border border-red-500/20' };
    }

    // 2. 영업시간 파싱
    const timeRegex = /(\d{2}):(\d{2})/g;
    const times: { time: number; str: string }[] = [];
    let match;
    while ((match = timeRegex.exec(hoursText)) !== null) {
      times.push({
        time: parseInt(match[1], 10) * 60 + parseInt(match[2], 10),
        str: match[0]
      });
    }

    if (times.length >= 2) {
      let openTime = times[0].time;
      let closeTime = times[1].time;
      
      const isWeekend = kstDate.getDay() === 0 || kstDate.getDay() === 6;
      if (hoursText.includes('평일') && hoursText.includes('주말') && times.length >= 4) {
        if (isWeekend) {
          openTime = times[2].time;
          closeTime = times[3].time;
        } else {
          openTime = times[0].time;
          closeTime = times[1].time;
        }
      }

      let breakStart = -1;
      let breakEnd = -1;
      const breakMatch = hoursText.match(/(?:브레이크\s*타임|브레이크타임)\s*(\d{2}):(\d{2})\s*[-~–]\s*(\d{2}):(\d{2})/);
      if (breakMatch) {
        breakStart = parseInt(breakMatch[1], 10) * 60 + parseInt(breakMatch[2], 10);
        breakEnd = parseInt(breakMatch[3], 10) * 60 + parseInt(breakMatch[4], 10);
      }

      let isOpenRange = false;
      if (closeTime < openTime) {
        isOpenRange = currentTime >= openTime || currentTime < closeTime;
      } else {
        isOpenRange = currentTime >= openTime && currentTime < closeTime;
      }

      if (isOpenRange) {
        if (breakStart !== -1 && breakEnd !== -1) {
          if (currentTime >= breakStart && currentTime < breakEnd) {
            return { 
              status: 'break', 
              label: `브레이크 타임 (${Math.floor(breakStart/60)}:${String(breakStart%60).padStart(2,'0')}~${Math.floor(breakEnd/60)}:${String(breakEnd%60).padStart(2,'0')})`, 
              colorClass: 'text-orange-400 bg-orange-500/10 border border-orange-500/20' 
            };
          }
        }
        
        const lastOrderTime = closeTime - 30;
        if (currentTime >= lastOrderTime && currentTime < closeTime) {
          return { status: 'open', label: '영업 중 (곧 마감)', colorClass: 'text-amber-400 bg-amber-500/10 border border-amber-500/20 animate-pulse' };
        }

        return { status: 'open', label: '영업 중', colorClass: 'text-green-400 bg-green-500/10 border border-green-500/20' };
      } else {
        return { status: 'closed', label: '영업 종료', colorClass: 'text-zinc-400 bg-zinc-500/5 border border-zinc-500/10' };
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
        if (char === '(' || char === '[') {
          parenDepth++;
          current += char;
        } else if (char === ')' || char === ']') {
          parenDepth = Math.max(0, parenDepth - 1);
          current += char;
        } else if (char === ',' && parenDepth === 0) {
          if (current.trim()) {
            subLines.push(current.trim());
          }
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) {
        subLines.push(current.trim());
      }
      lines.push(...subLines);
    } else {
      lines.push(trimmed);
    }
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
        const startDay = rangeMatch[1];
        const endDay = rangeMatch[2];
        const startIndex = dayNames.indexOf(startDay);
        const endIndex = dayNames.indexOf(endDay);
        const todayIndex = kstDate.getDay();
        
        let inRange = false;
        if (startIndex <= endIndex) {
          inRange = todayIndex >= startIndex && todayIndex <= endIndex;
        } else {
          inRange = todayIndex >= startIndex || todayIndex <= endIndex;
        }
        if (inRange) {
          return { todayLine: line, todayIndex: i };
        }
      } else {
        return { todayLine: line, todayIndex: i };
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rangeMatch = line.match(/([월화수목금토일])\s*[~-]\s*([월화수목금토일])/);
    if (rangeMatch) {
      const startDay = rangeMatch[1];
      const endDay = rangeMatch[2];
      const startIndex = dayNames.indexOf(startDay);
      const endIndex = dayNames.indexOf(endDay);
      const todayIndex = kstDate.getDay();
      
      let inRange = false;
      if (startIndex <= endIndex) {
        inRange = todayIndex >= startIndex && todayIndex <= endIndex;
      } else {
        inRange = todayIndex >= startIndex || todayIndex <= endIndex;
      }
      if (inRange) {
        return { todayLine: line, todayIndex: i };
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isWeekend && line.includes('주말')) {
      return { todayLine: line, todayIndex: i };
    }
    if (!isWeekend && line.includes('평일')) {
      return { todayLine: line, todayIndex: i };
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('매일')) {
      return { todayLine: line, todayIndex: i };
    }
  }

  return { todayLine: lines[0] || '정보 없음', todayIndex: 0 };
};

const getCleanTodayLine = (line: string): string => {
  return line.replace(/\s*\([^)]*(?:브레이크|쉬는시간|준비시간|준비|라스트|order|LO)[^)]*\)/gi, '').trim();
};

const splitMenuItems = (str: string): string[] => {
  const items: string[] = [];
  let current = '';
  let parenDepth = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(' || char === '[') {
      parenDepth++;
      current += char;
    } else if (char === ')' || char === ']') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += char;
    } else if ((char === ',' || char === '/' || char === '\n') && parenDepth === 0) {
      const isThousandsSeparator = char === ',' && i > 0 && i < str.length - 1 && /\d/.test(str[i-1]) && /\d/.test(str[i+1]);
      if (isThousandsSeparator) {
        current += char;
      } else {
        if (current.trim()) {
          items.push(current.trim());
        }
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    items.push(current.trim());
  }
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
    if (match) {
      const price = match[1].trim();
      const desc = match[2]?.trim();
      return {
        name: rawName,
        price,
        description: cleanDescStr(desc)
      };
    }
    return { name: rawName, price: right };
  }
  
  const match = cleanItem.match(/^(.*?)\s+((?:\d{1,3}(?:,\d{3})+|\d+)\s*원?)(?:\s*[.\s(]+(.*?)\)?)?$/);
  if (match) {
    const nameOnly = match[1].trim();
    const price = match[2].trim();
    const desc = match[3]?.trim();
    return {
      name: nameOnly,
      price: price.endsWith('원') ? price : `${Number(price.replace(/,/g, '')).toLocaleString()}원`,
      description: cleanDescStr(desc)
    };
  }
  
  return { name: cleanItem };
};

const parseMenuInfo = (menuInfo?: string | null): MenuItem[] => {
  if (!menuInfo) return [];
  try {
    if (menuInfo.trim().startsWith('[')) {
      const parsed = JSON.parse(menuInfo);
      if (Array.isArray(parsed)) {
        return parsed.map((m: any) => {
          if (m && typeof m === 'object' && m.name) {
            return {
              name: m.name,
              price: m.price ? `${Number(m.price).toLocaleString()}원` : undefined
            };
          }
          return parseSingleMenuItem(String(m));
        });
      }
    }
  } catch (e) {
    console.warn("Failed to parse menu_info as JSON:", e);
  }
  
  const cleaned = menuInfo.replace(/<br\s*\/?>/gi, '\n');
  const rawItems = splitMenuItems(cleaned);
  return rawItems
    .map(item => item.trim())
    .filter(item => item.length > 0 && item !== '없음')
    .map(parseSingleMenuItem);
};

const parseBusinessHours = (hours?: string | null) => {
  if (!hours) return null;
  return hours.replace(/<br\s*\/?>/gi, '\n').trim();
};

// 가격 표기 정규화: 메뉴판의 "15.0"/"8" 같은 천원단위 표기 → "15,000원", 콤마·원 보정
const formatPrice = (raw?: string | null): string | null => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    let n = parseFloat(s);
    if (s.includes('.') || n < 1000) n = Math.round(n * 1000); // 천원 단위 표기(15.0=15,000)
    return n.toLocaleString('ko-KR') + '원';
  }
  if (/^[\d,]+$/.test(s)) return s + '원'; // 콤마 숫자에 '원'만 보정
  return s; // 그 외(이미 '원' 포함 등)는 그대로
};

// 지도 검색 정확도용 지역 힌트: 구/군 + 동/읍/면 (도 접두어·특별시 제외)
const buildRegionHint = (address?: string | null): string => {
  if (!address) return '';
  const toks = address.split(/\s+/).filter(Boolean);
  const gu = toks.find((t) => /[가-힣]+(구|군)$/.test(t))
    || toks.find((t) => /[가-힣]+시$/.test(t) && !/특별|광역|통합/.test(t)) || '';
  const dong = toks.find((t) => /[가-힣]+(동|읍|면)$/.test(t)) || '';
  return [gu, dong].filter(Boolean).join(' ');
};
const naverSearchUrl = (name: string, address?: string | null) =>
  `https://map.naver.com/p/search/${encodeURIComponent(`${name} ${buildRegionHint(address)}`.trim())}`;

interface RestaurantInfoCardProps {
  restaurant: Restaurant | null;
  onClose: () => void;
  isSidebarCollapsed?: boolean;
  favorites?: string[];
  toggleFavorite?: (id: string) => void;
  isPlanningMode?: boolean;
  isRecommendedRouteItem?: boolean;
  onAddToPlanning?: (restaurant: Restaurant) => void;
  onInsertToPlanningRoute?: (restaurant: Restaurant) => void;
  onRequestVideoSubmit?: (restaurant: Restaurant) => void;
  onKeywordSearch?: (keyword: string) => void;
  windowWidth?: number;
  sidebarWidth?: number;
}


export default function RestaurantInfoCard({
  restaurant,
  onClose,
  favorites = [],
  toggleFavorite,
  isPlanningMode = false,
  isRecommendedRouteItem = false,
  onInsertToPlanningRoute,
  onRequestVideoSubmit,
  onKeywordSearch,
}: RestaurantInfoCardProps) {
  // 탭 하나만 열기: 표준 window.open(openExternal). 네이버는 지역 힌트로 정확도↑
  const openNaverDeeplink = (name: string, address?: string) => {
    openExternal(naverSearchUrl(name, address), { reason: 'naver_map_review' });
  };

  const openKakaoDeeplink = (name: string, kakaoPlaceId?: string, _lat?: number, _lng?: number) => {
    const url = kakaoPlaceId
      ? `https://place.map.kakao.com/${kakaoPlaceId}`
      : `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;
    openExternal(url, { reason: 'kakao_map_review' });
  };


  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobileDevice(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sortedVideos = restaurant?.videos 
    ? [...restaurant.videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    : [];

  // 스토리 링 Framer Motion 캐러셀 및 휠 스크롤 제어
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 });
  const storyX = useMotionValue(0);

  // 드래그 제약 조건 계산
  const updateConstraints = () => {
    if (containerRef.current && trackRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const trackWidth = trackRef.current.scrollWidth;
      const maxDrag = containerWidth - trackWidth;
      setDragConstraints({
        left: maxDrag < 0 ? maxDrag : 0,
        right: 0
      });
    }
  };

  useEffect(() => {
    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    return () => window.removeEventListener('resize', updateConstraints);
  }, [sortedVideos.length]);

  // 맛집 변경 시 스토리 캐러셀 위치 초기화 (첫 번째 크리에이터가 "리"자 위치로 복귀)
  useEffect(() => {
    storyX.set(0);
    setTimeout(() => updateConstraints(), 50);
  }, [restaurant?.id]);

  // 마우스 휠 스크롤 감속 감쇄 감지 핸들러
  const handleStoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const currentX = storyX.get();
    let newX = currentX - e.deltaY * 0.8;
    const minX = dragConstraints.left;
    const maxX = dragConstraints.right;
    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;

    animate(storyX, newX, {
      type: 'spring',
      stiffness: 400,
      damping: 35,
      mass: 0.5
    });
  };

  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const activeVideo = sortedVideos[activeVideoIndex];
  // 리뷰 크리에이터 페이지네이션 (4개씩)
  const [creatorPage, setCreatorPage] = useState(0);



  // 액션 버튼 개별 호버 상태
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const [isShareHovered, setIsShareHovered] = useState(false);
  const [isPhoneHovered, setIsPhoneHovered] = useState(false);
  const [isNavHovered, setIsNavHovered] = useState(false);

  // 복사 피드백 애니메이션 상태
  const [copiedAddress, setCopiedAddress] = useState(false);

  const handleCopy = (text: string, type: 'address' | 'phone') => {
    navigator.clipboard.writeText(text);
    if (type === 'address') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  // 유튜브 ID 정제 및 썸네일 Fallback
  const cleanYoutubeId = activeVideo ? getYouTubeId(activeVideo.youtube_id) : '';
  const thumbnailFallback = activeVideo?.thumbnail || (cleanYoutubeId ? `https://img.youtube.com/vi/${cleanYoutubeId}/0.jpg` : '');

  // 미디어 재생 및 에러 제어 상태
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const [isHoursExpanded, setIsHoursExpanded] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false); // 정보 정정·신고 모달
  const [isHoursReportOpen, setIsHoursReportOpen] = useState(false); // 영업시간 제보 모달
  const [localHours, setLocalHours] = useState<string | null>(null); // 제보 즉시 반영
  const [showRouteModal, setShowRouteModal] = useState(false);
  const playerInstanceRef = useRef<any>(null);

  // 식당이 바뀌면 재생 상태 및 비디오 세션 초기화
  useEffect(() => {
    setActiveVideoIndex(0);
    setCreatorPage(0);
    setIsPlayingVideo(false);
    setEmbedError(false);
    setIsBookmarkHovered(false);
    setIsShareHovered(false);
    setIsHoursExpanded(false);
    setShowRouteModal(false);
  }, [restaurant?.id]);

  // 유튜브 Iframe Player API 동적 로딩 및 재생 제어
  useEffect(() => {
    if (!isPlayingVideo || !cleanYoutubeId) {
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {
          console.error('Error destroying YouTube Player:', e);
        }
        playerInstanceRef.current = null;
      }
      return;
    }

    let destroyed = false;
    setEmbedError(false);
    let mountTimer: NodeJS.Timeout | null = null;

    loadYouTubeIframeAPI().then(() => {
      if (destroyed) return;

      const currentContainerId = isMobileDevice ? 'yt-player-container-mobile' : 'yt-player-container-desktop';

      // 1. 이미 플레이어 인스턴스가 존재하고, API가 정상 동작 가능한 경우 재사용
      if (playerInstanceRef.current && typeof playerInstanceRef.current.loadVideoById === 'function') {
        try {
          playerInstanceRef.current.loadVideoById({
            videoId: cleanYoutubeId,
            startSeconds: 0
          });
          playerInstanceRef.current.unMute();
          playerInstanceRef.current.playVideo();
          return;
        } catch (e) {
          console.warn('Failed to reuse YouTube Player instance, fallback to recreate:', e);
          try {
            playerInstanceRef.current.destroy();
          } catch (_) {}
          playerInstanceRef.current = null;
        }
      }

      // 2. 플레이어 인스턴스가 없거나 재사용에 실패한 경우 새로 생성
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (_) {}
        playerInstanceRef.current = null;
      }

      mountTimer = setTimeout(() => {
        if (destroyed) return;
        const container = document.getElementById(currentContainerId);
        if (!container) return;

        try {
          const newPlayer = new window.YT.Player(currentContainerId, {
            videoId: cleanYoutubeId,
            playerVars: {
              autoplay: 1,
              mute: 0,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              controls: 1,
            },
            events: {
              onReady: (event: any) => {
                if (destroyed) return;
                try {
                  event.target.unMute();
                  event.target.playVideo();
                } catch (playErr) {
                  console.error('Error playing video onReady:', playErr);
                }
              },
              onError: (event: any) => {
                if (destroyed) return;
                const errCode = event.data;
                console.warn(`YouTube Player error [Code: ${errCode}] detected: ${cleanYoutubeId}`);
                if (errCode === 101 || errCode === 150 || errCode === 100 || errCode === 2 || errCode === 5) {
                  setEmbedError(true);
                }
              }
            }
          });
          playerInstanceRef.current = newPlayer;
        } catch (initErr) {
          console.error('Failed to initialize YouTube Player:', initErr);
          setEmbedError(true);
        }
      }, 50);
    });

    return () => {
      destroyed = true;
      if (mountTimer) clearTimeout(mountTimer);
    };
  }, [isPlayingVideo, cleanYoutubeId, isMobileDevice]);

  // 영업시간: 이용자 제보 시 즉시 반영을 위한 로컬 오버라이드
  const effHours = localHours ?? restaurant?.business_hours;
  const effHoursSource = localHours ? 'user' : (restaurant?.business_hours_source ?? null);
  const hasHours = !!effHours && effHours !== '정보 없음';

  // DB 연동 데이터 파싱
  const menuList = parseMenuInfo(restaurant?.menu_info);
  const businessHours = parseBusinessHours(effHours);
  const hasParking = checkAvailability(restaurant?.parking);
  const hasReservation = checkAvailability(restaurant?.reservation);
  const hasPackaging = checkAvailability(restaurant?.packaging);
  const openStatus = getStoreOpenStatus(effHours || '');

  const renderContent = () => {
    if (!restaurant) return null;

    // 검색 태그 (#방송·랜드마크·음식·상황·지역) — 탭하면 검색
    const displayChips = buildDisplayChips(restaurant);

    return (
      <div className="flex flex-col h-full relative bg-brand-charcoal md:bg-white select-none">
        {/* 데스크탑 전용 상단 툴바 (네이버 지도 스타일) */}
        <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white shrink-0 select-none">
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors cursor-pointer"
            title="뒤로가기/닫기"
          >
            <ArrowLeft size={18} />
          </button>
          
          <div className="flex items-center gap-2">
            {/* 즐겨찾기 */}
            <button
              onClick={() => toggleFavorite && toggleFavorite(restaurant.id)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                favorites.includes(restaurant.id)
                  ? 'text-orange-500 hover:bg-orange-50'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
              title="즐겨찾기"
            >
              <Star 
                size={18} 
                fill={favorites.includes(restaurant.id) ? 'currentColor' : 'none'} 
              />
            </button>
            
            {/* 공유하기 */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('맛집 링크가 클립보드에 복사되었습니다.');
              }}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="공유하기"
            >
              <Share2 size={18} />
            </button>
            
            {/* 닫기 X */}
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 모바일 전용 드래그 핸들 */}
        <div className="w-full flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-12 h-1.5 bg-white/10 rounded-full"></div>
        </div>

        {/* 모바일 전용 닫기 액션 버튼 */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 bg-black/50 hover:bg-black/75 backdrop-blur-md rounded-full text-white border border-white/10 shadow-xl transition-all z-45 cursor-pointer md:hidden"
        >
          <X size={18} />
        </button>

        {/* Scrollable Container */}
        <div className="overflow-y-auto hide-scrollbar flex-1 pb-8 md:bg-white text-white md:text-slate-800">
          {/* 유튜브 플레이어 및 썸네일 영역 */}
          {restaurant.videos && restaurant.videos.length > 0 ? (
            <div className="relative w-full bg-black shrink-0 aspect-video rounded-t-[28px] md:rounded-t-none overflow-hidden z-20">
              <div className="relative w-full h-full flex justify-center items-center">
                {!isPlayingVideo ? (
                  <>
                    <img
                      src={thumbnailFallback}
                      alt="Video Thumbnail"
                      className="w-full h-full object-cover relative z-10 brightness-[0.65]"
                      draggable={false}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getFallbackThumbnail(restaurant.category || '');
                      }}
                    />

                    {/* 채널 정보 — 상단 */}
                    {activeVideo?.youtuber && (
                      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
                        {activeVideo.youtuber.profile_image ? (
                          <img
                            src={activeVideo.youtuber.profile_image}
                            className="w-7 h-7 rounded-full object-cover ring-2 ring-white/30 shrink-0"
                            alt={activeVideo.youtuber.name}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                            {activeVideo.youtuber.name?.[0]}
                          </div>
                        )}
                        <span className="text-[12px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                          {activeVideo.youtuber.name}
                        </span>
                      </div>
                    )}

                    {/* 영상 제목 + 조회수 + Shorts badge — 하단 */}
                    <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-4">
                      {activeVideo?.title && (
                        <p className="text-[13px] font-bold text-white leading-snug line-clamp-2 mb-1.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                          {activeVideo.title}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        {activeVideo?.view_count !== undefined && activeVideo.view_count > 0 ? (
                          <div className="flex items-center gap-1">
                            <Eye size={11} className="text-orange-300 shrink-0" />
                            <span className="text-[11px] font-bold text-orange-300">{formatViewCount(activeVideo.view_count)}회</span>
                          </div>
                        ) : <div />}
                        {activeVideo?.is_short && (
                          <div className="bg-black/35 backdrop-blur-md border border-white/10 text-white text-[10px] font-black px-1.5 py-[2px] rounded-md flex items-center gap-0.5 shadow-sm">
                            <Play size={8} fill="currentColor" /> SHORTS
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      onClick={() => setIsPlayingVideo(true)}
                      className="absolute inset-0 flex items-center justify-center group cursor-pointer transition-all z-20"
                    >
                      <motion.div
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-16 h-16 bg-black/60 hover:bg-black/75 text-white/95 rounded-full flex items-center justify-center shadow-2xl transition-all border border-white/20 select-none cursor-pointer"
                      >
                        <Play size={22} className="ml-1 text-white fill-current" />
                      </motion.div>
                    </div>
                  </>
                ) : (
                  <div className="relative w-full h-full">
                    <div id={isMobileDevice ? 'yt-player-container-mobile' : 'yt-player-container-desktop'} className="w-full h-full border-0" />

                    {embedError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141416]/95 backdrop-blur-md p-4 text-center z-30 space-y-2">
                        <p className="text-white/50 text-[10px] font-bold">
                          동영상 제공 정책으로 인해 모바일 또는 외부 유튜브 앱으로 연결합니다.
                        </p>
                        <button
                          onClick={() => openExternal(`https://www.youtube.com/watch?v=${cleanYoutubeId}`, { reason: 'embed_fallback_jump' })}
                          className="relative z-10 px-4 py-2 bg-[#2d2d31] hover:bg-brand-orange text-white text-[10px] font-black rounded-lg shadow-lg cursor-pointer border border-white/10"
                        >
                          YouTube 앱으로 바로 감상
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="relative w-full py-12 bg-[#121214] border-b border-white/5 flex flex-col justify-center items-center text-center shrink-0 px-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-3 shadow-inner">
                <PlaySquare size={22} className="text-orange-400" />
              </div>
              <p className="text-zinc-400 text-[12px] font-bold mb-4">앗, 등록된 영상 리뷰가 없어요!</p>
              
              <button
                onClick={() => onRequestVideoSubmit && onRequestVideoSubmit(restaurant)}
                className="group flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-orange-500/30 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg"
              >
                <Plus size={14} className="text-orange-500 group-hover:rotate-90 transition-transform duration-300" />
                <span className="text-[12px] font-black text-white/90 group-hover:text-white">이 식당의 영상 제보하기</span>
              </button>
            </div>
          )}

          <div className="p-3 md:p-4 flex flex-col gap-3 text-white md:text-slate-800">
            {/* Unified Profile Card (Profile, AI briefing, Facility info merged) */}
            <div className="order-2 bg-zinc-900/80 md:bg-slate-50 border border-zinc-800 md:border-slate-200/60 rounded-2xl p-3 relative overflow-hidden space-y-2 shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/8 md:bg-orange-500/5 rounded-full filter blur-2xl -z-10" />

              {/* Row 1: Name */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-orange-400 md:text-orange-500">
                  {getCategoryIcon(restaurant.category)}
                </span>
                <h3 className="text-[18px] md:text-[20px] font-black text-white md:text-slate-900 tracking-tight leading-snug truncate">
                  {restaurant.name}
                </h3>
              </div>

              {/* Row 2: Category */}
              <div className="flex items-center flex-wrap gap-1.5 text-[13px] font-semibold text-zinc-400 md:text-slate-500 select-none -mt-0.5">
                {restaurant.category && (
                  <span>{getFormattedCategory(restaurant.category)}</span>
                )}
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {/* 전화 */}
                <button
                  onClick={() => {
                    if (restaurant.phone && restaurant.phone !== '정보 없음' && restaurant.phone.trim() !== '') {
                      window.location.href = `tel:${restaurant.phone}`;
                    } else {
                      alert('등록된 전화번호가 없습니다.');
                    }
                  }}
                  onMouseEnter={() => setIsPhoneHovered(true)}
                  onMouseLeave={() => setIsPhoneHovered(false)}
                  className={`flex flex-col items-center justify-center py-2.5 border rounded-xl transition-all gap-1 cursor-pointer group ${
                    isPhoneHovered
                      ? 'bg-red-500/10 border-red-500/30 md:border-red-500/20 text-red-500 shadow-[0_2px_10px_rgba(255,75,0,0.15)] md:shadow-none'
                      : 'bg-zinc-800/40 md:bg-white hover:bg-zinc-800/80 md:hover:bg-slate-100 border-white/5 md:border-slate-200 text-zinc-400 md:text-slate-500'
                  }`}
                >
                  <Phone
                    size={20}
                    stroke={isPhoneHovered ? 'url(#red-orange-grad)' : 'currentColor'}
                    strokeWidth={isPhoneHovered ? 2.5 : 2}
                  />
                  <span className="text-[11px] font-bold">전화</span>
                </button>

                {/* 저장 */}
                <button
                  onClick={() => toggleFavorite && toggleFavorite(restaurant.id)}
                  onMouseEnter={() => setIsBookmarkHovered(true)}
                  onMouseLeave={() => setIsBookmarkHovered(false)}
                  className={`flex flex-col items-center justify-center py-2.5 border rounded-xl transition-all gap-1 cursor-pointer group ${
                    (favorites.includes(restaurant.id) || isBookmarkHovered)
                      ? 'bg-red-500/10 border-red-500/30 md:border-red-500/20 text-red-500 shadow-[0_2px_10px_rgba(255,75,0,0.15)] md:shadow-none'
                      : 'bg-zinc-800/40 md:bg-white hover:bg-zinc-800/80 md:hover:bg-slate-100 border-white/5 md:border-slate-200 text-zinc-400 md:text-slate-500 hover:text-white md:hover:text-slate-800'
                  }`}
                >
                  <Star
                    size={20}
                    stroke={(favorites.includes(restaurant.id) || isBookmarkHovered) ? 'url(#red-orange-grad)' : 'currentColor'}
                    fill={(favorites.includes(restaurant.id) || isBookmarkHovered) ? 'url(#red-orange-grad)' : 'none'}
                    strokeWidth={(favorites.includes(restaurant.id) || isBookmarkHovered) ? 2.5 : 2}
                  />
                  <span className="text-[11px] font-bold">저장</span>
                </button>

                {/* 공유 */}
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
                  className={`flex flex-col items-center justify-center py-2.5 border rounded-xl transition-all gap-1 cursor-pointer group ${
                    isShareHovered
                      ? 'bg-red-500/10 border-red-500/30 md:border-red-500/20 text-red-500 shadow-[0_2px_10px_rgba(255,75,0,0.15)] md:shadow-none'
                      : 'bg-zinc-800/40 md:bg-white hover:bg-zinc-800/80 md:hover:bg-slate-100 border-white/5 md:border-slate-200 text-zinc-400 md:text-slate-500 hover:text-white md:hover:text-slate-800'
                  }`}
                >
                  <Share2
                    size={20}
                    stroke={isShareHovered ? 'url(#red-orange-grad)' : 'currentColor'}
                    fill={isShareHovered ? 'url(#red-orange-grad)' : 'none'}
                    strokeWidth={isShareHovered ? 2.5 : 2}
                  />
                  <span className="text-[11px] font-bold">공유</span>
                </button>

                {/* 길찾기 */}
                <button
                  onClick={() => setShowRouteModal(true)}
                  onMouseEnter={() => setIsNavHovered(true)}
                  onMouseLeave={() => setIsNavHovered(false)}
                  className={`flex flex-col items-center justify-center py-2.5 border rounded-xl transition-all gap-1 cursor-pointer group ${
                    isNavHovered
                      ? 'bg-red-500/10 border-red-500/30 md:border-red-500/20 text-red-500 shadow-[0_2px_10px_rgba(255,75,0,0.15)] md:shadow-none'
                      : 'bg-zinc-800/40 md:bg-white hover:bg-zinc-800/80 md:hover:bg-slate-100 border-white/5 md:border-slate-200 text-zinc-400 md:text-slate-500'
                  }`}
                >
                  <Navigation
                    size={20}
                    stroke={isNavHovered ? 'url(#red-orange-grad)' : 'currentColor'}
                    strokeWidth={isNavHovered ? 2.5 : 2}
                  />
                  <span className="text-[11px] font-bold">길찾기</span>
                </button>
              </div>

              {/* Row 6: Facilities List */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-800 md:border-slate-200 text-sm font-medium text-zinc-300 md:text-slate-600">
                {/* Hours */}
                <div className="flex items-start gap-2.5">
                  <Clock size={13} className="text-orange-400 md:text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    {hasHours && businessHours ? (() => {
                      const lines = splitHoursIntoLines(businessHours);
                      const { todayLine, todayIndex } = getTodayHoursLine(lines);
                      const hasMultipleLines = lines.length > 1 || todayLine.includes('브레이크') || todayLine.includes('쉬는시간');
                      const cleanTodayLine = getCleanTodayLine(todayLine);

                      // Helper to render inline sleek badge
                      const renderStatusBadge = () => {
                        let textColor = 'text-zinc-500 md:text-slate-400';
                        let dotBg = 'bg-zinc-500 md:bg-slate-400';
                        let badgeBg = 'bg-zinc-800/40 md:bg-slate-100 border-zinc-700/30 md:border-slate-200';
                        
                        if (openStatus.status === 'open') {
                          textColor = 'text-green-400 md:text-green-600';
                          dotBg = 'bg-green-400 md:bg-green-500';
                          badgeBg = 'bg-zinc-800/40 md:bg-green-50 border-zinc-700/30 md:border-green-100';
                        } else if (openStatus.status === 'break') {
                          textColor = 'text-orange-400 md:text-orange-600';
                          dotBg = 'bg-orange-400 md:bg-orange-500';
                          badgeBg = 'bg-zinc-800/40 md:bg-orange-50 border-zinc-700/30 md:border-orange-100';
                        } else if (openStatus.status === 'closed') {
                          textColor = 'text-red-400 md:text-red-600';
                          dotBg = 'bg-red-400 md:bg-red-500';
                          badgeBg = 'bg-zinc-800/40 md:bg-red-50 border-zinc-700/30 md:border-red-100';
                        }

                        let cleanLabel = openStatus.label;
                        if (cleanLabel.includes('브레이크 타임')) {
                          cleanLabel = '브레이크';
                        }

                        return (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold border ${badgeBg} ${textColor} select-none shrink-0 ml-1.5`}>
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
                                <span className={`text-[14px] transition-colors ${isHoursExpanded ? 'font-black text-white md:text-slate-900' : 'font-bold text-zinc-200 md:text-slate-700'}`}>
                                  {isHoursExpanded ? todayLine : cleanTodayLine}
                                </span>
                                {!isHoursExpanded && renderStatusBadge()}
                              </div>
                              <div className="text-zinc-500 md:text-slate-400 group-hover:text-white md:group-hover:text-slate-700 transition-colors p-0.5 shrink-0 ml-1">
                                {isHoursExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </div>
                            </div>
                            <AnimatePresence initial={false}>
                              {isHoursExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex flex-col gap-1 mt-1 pl-2 border-l border-zinc-700 md:border-slate-200 overflow-hidden"
                                >
                                  {lines.map((line, idx) => (
                                    <div key={idx} className="flex items-center flex-wrap gap-1 min-w-0">
                                      <span className={`text-[13px] ${idx === todayIndex ? 'font-black text-white md:text-slate-900' : 'font-semibold text-zinc-400 md:text-slate-500'}`}>
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
                          <span className="text-[14px] font-bold text-zinc-200 md:text-slate-700 block">{cleanTodayLine}</span>
                          {renderStatusBadge()}
                        </div>
                      );
                    })() : (
                      <button
                        onClick={() => setIsHoursReportOpen(true)}
                        className="inline-flex items-center gap-0.5 text-[14px] font-bold text-orange-400 md:text-orange-600 hover:underline cursor-pointer"
                      >
                        영업시간 제보하기 <ChevronRight size={13} />
                      </button>
                    )}
                    {hasHours && effHoursSource && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-zinc-500 md:text-slate-400">
                        {effHoursSource === 'user' ? (
                          <>
                            <Flag size={9} /> 이용자 제보
                            <button onClick={() => setIsHoursReportOpen(true)} className="underline hover:text-zinc-300 md:hover:text-slate-600 ml-1 cursor-pointer">수정</button>
                          </>
                        ) : effHoursSource === 'video' ? (
                          <><PlaySquare size={9} /> 출처: {sortedVideos[0]?.youtuber?.name || '유튜브 영상'}</>
                        ) : (
                          <>출처: 한국관광공사</>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 편의정보 (예약·주차·포장 등 — 있는 것만, 텍스트 나열) */}
                {(hasParking || hasReservation || hasPackaging) && (
                  <div className="flex items-start gap-2.5">
                    <Tag size={13} className="text-orange-400 md:text-orange-500 shrink-0 mt-0.5" />
                    <span className="text-[14px] font-bold text-zinc-200 md:text-slate-700 leading-normal">
                      {[hasParking && '주차 가능', hasReservation && '예약 가능', hasPackaging && '포장 가능'].filter(Boolean).join('  ·  ')}
                    </span>
                  </div>
                )}

                {/* Address */}
                <div className="flex items-start gap-2.5">
                  <MapPin size={13} className="text-orange-400 md:text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[14px] font-bold text-zinc-200 md:text-slate-700 leading-normal">{restaurant.address}</span>
                    <button
                      onClick={() => handleCopy(restaurant.address, 'address')}
                      className="flex items-center gap-1 text-zinc-500 md:text-slate-400 hover:text-zinc-300 md:hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                      title="주소 복사"
                    >
                      {copiedAddress ? <Check size={11} className="text-brand-orange" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                {/* 정보 출처 · 정정/신고 */}
                <div className="pt-2.5 mt-0.5 border-t border-zinc-800/60 md:border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10.5px] text-zinc-500 md:text-slate-400 font-medium leading-snug">
                    영업시간·메뉴는 <b className="font-bold text-zinc-400 md:text-slate-500">제보·자동수집 기반</b>이라 실제와 다를 수 있어요.
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {restaurant.kakao_place_id && (
                      <a
                        href={`https://place.map.kakao.com/${restaurant.kakao_place_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10.5px] font-bold text-zinc-300 md:text-slate-600 bg-white/5 md:bg-white border border-white/10 md:border-slate-200 px-2.5 py-1 rounded-full hover:bg-white/10 md:hover:bg-slate-100 transition-colors"
                        title="카카오맵에서 영업시간 등 공식 정보 확인"
                      >
                        카카오맵 <ExternalLink size={10} />
                      </a>
                    )}
                    <a
                      href={naverSearchUrl(restaurant.name, restaurant.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10.5px] font-bold text-zinc-300 md:text-slate-600 bg-white/5 md:bg-white border border-white/10 md:border-slate-200 px-2.5 py-1 rounded-full hover:bg-white/10 md:hover:bg-slate-100 transition-colors"
                      title="네이버 지도에서 영업시간 등 공식 정보 확인"
                    >
                      네이버 <ExternalLink size={10} />
                    </a>
                    <button
                      onClick={() => setIsSuggestOpen(true)}
                      className="inline-flex items-center gap-1 text-[10.5px] font-bold text-zinc-300 md:text-slate-600 bg-white/5 md:bg-white border border-white/10 md:border-slate-200 px-2.5 py-1 rounded-full hover:bg-white/10 md:hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Flag size={10} /> 정정·신고
                    </button>
                  </div>
                </div>
              </div>

              {/* 검색 태그 (#방송·랜드마크·음식·상황·지역) — 탭하면 검색 실행 */}
              {displayChips.length > 0 && (
                <div className="pt-3 border-t border-zinc-800 md:border-slate-200 flex flex-wrap gap-x-2.5 gap-y-1.5">
                  {displayChips.map((c) => (
                    <button
                      key={c.query}
                      onClick={() => onKeywordSearch?.(c.query)}
                      disabled={!onKeywordSearch}
                      className="text-[12.5px] font-bold text-orange-300 md:text-orange-500 hover:underline disabled:no-underline cursor-pointer disabled:cursor-default"
                    >
                      #{c.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Row 7: AI 꿀팁 (Gemini 추천) */}
              {restaurant.description_summary && (
                <div className="pt-3 border-t border-zinc-800 md:border-slate-200 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-orange-400 md:text-orange-500" />
                    <span className="text-[16px] font-black text-zinc-200 md:text-slate-800">AI 꿀팁 (Gemini 추천)</span>
                  </div>
                  <div className="text-[16px] text-zinc-300 md:text-slate-600 font-medium leading-relaxed bg-zinc-800/40 md:bg-orange-500/5 border border-zinc-700/30 md:border-orange-500/10 rounded-xl p-3 whitespace-pre-wrap select-text">
                    {restaurant.description_summary}
                  </div>
                </div>
              )}
            </div>

            {/* planning mode route button */}
            {isPlanningMode && isRecommendedRouteItem && (
              <button
                onClick={() => onInsertToPlanningRoute && onInsertToPlanningRoute(restaurant)}
                className="order-3 w-full py-3 rounded-xl text-xs font-black text-white bg-gradient-to-r from-red-600 to-orange-500 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(239,68,68,0.25)] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={12} />
                <span>경로 중간에 경유지로 추가하기</span>
              </button>
            )}

            {/* Creator Story Carousel */}
            {sortedVideos && sortedVideos.length > 0 && (
              <div className="order-1 bg-white/5 md:bg-slate-50 border border-white/5 md:border-slate-200/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group/story">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10.5px] font-extrabold text-zinc-400 md:text-slate-500 tracking-tight select-none">리뷰 크리에이터</span>
                  <button
                    onClick={() => onRequestVideoSubmit && onRequestVideoSubmit(restaurant)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white/5 md:bg-white hover:bg-white/10 md:hover:bg-slate-100 border border-white/10 md:border-slate-200 rounded-full cursor-pointer transition-colors z-20"
                  >
                    <Plus size={10} className="text-brand-orange" />
                    <span className="text-[9.5px] font-bold text-white/90 md:text-slate-600">영상 제보</span>
                  </button>
                </div>

                {(() => {
                  const perPage = 4;
                  const pageCount = Math.max(1, Math.ceil(sortedVideos.length / perPage));
                  const page = Math.min(creatorPage, pageCount - 1);
                  const start = page * perPage;
                  const pageVideos = sortedVideos.slice(start, start + perPage);
                  const showArrows = sortedVideos.length > perPage;
                  const arrowCls = "shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-white/5 md:bg-white border border-white/10 md:border-slate-200 text-white/70 md:text-slate-500 disabled:opacity-25 hover:bg-white/10 md:hover:bg-slate-100 transition-colors cursor-pointer disabled:cursor-default";
                  return (
                    <div className="flex items-center gap-1">
                      {showArrows && (
                        <button onClick={() => setCreatorPage(p => Math.max(0, p - 1))} disabled={page === 0} className={arrowCls} aria-label="이전 크리에이터">
                          <ChevronLeft size={15} />
                        </button>
                      )}
                      <div className="flex-1 grid grid-cols-4 gap-2 justify-items-center">
                        {pageVideos.map((vid, i) => {
                          const idx = start + i;
                          const isActive = activeVideoIndex === idx;
                          return (
                            <div
                              key={vid.id}
                              onClick={() => { setActiveVideoIndex(idx); setIsPlayingVideo(false); setEmbedError(false); }}
                              className="flex flex-col items-center gap-1.5 cursor-pointer group select-none min-w-0"
                            >
                              <div className={`relative w-[50px] h-[50px] rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-gradient-to-tr from-red-600 to-brand-orange scale-105 shadow-[0_0_10px_rgba(255,75,0,0.4)]' : 'bg-white/10 md:bg-slate-200 hover:bg-white/30'} transition-all duration-300 transform group-hover:scale-105`}>
                                <div className="w-[46px] h-[46px] bg-[#121214] md:bg-white rounded-full flex items-center justify-center shrink-0">
                                  <img
                                    src={vid.youtuber.profile_image}
                                    className="w-[42px] h-[42px] rounded-full object-cover shrink-0 shadow-inner"
                                    alt={vid.youtuber.name}
                                    draggable={false}
                                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(vid.youtuber.name)}&background=random&color=fff&size=128`; }}
                                  />
                                </div>
                                {vid.view_count !== undefined && vid.view_count !== null && (
                                  <div className="absolute bottom-[-2px] right-[-4px] bg-white/[0.12] md:bg-slate-100/90 backdrop-blur-[4px] border border-white/15 md:border-slate-200 px-1.5 py-[1px] rounded-full text-[8px] font-black text-white md:text-slate-700 leading-none shadow-md z-20 whitespace-nowrap">
                                    {formatViewCount(vid.view_count)}
                                  </div>
                                )}
                              </div>
                              <span title={vid.youtuber.name} className={`block text-[10px] w-full leading-tight text-center break-words line-clamp-2 ${isActive ? 'font-black text-brand-orange' : 'font-bold text-white/40 md:text-slate-500 group-hover:text-white/70 md:group-hover:text-slate-800'}`}>
                                {vid.youtuber.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {showArrows && (
                        <button onClick={() => setCreatorPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className={arrowCls} aria-label="다음 크리에이터">
                          <ChevronRight size={15} />
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 유튜버 Pick — 영상 멀티모달 분석(가격 포함) 우선, 없으면 menu_info 폴백 */}
            {(() => {
              const picker = sortedVideos[0]?.youtuber;
              const pickerName = picker?.name;
              const insights = sortedVideos[0]?.ai_insights || null;
              const allPicks: { name: string; price?: string | null; ate?: boolean }[] =
                insights?.picks && insights.picks.length > 0
                  ? [...insights.picks].filter((p) => p?.name).sort((a, b) => (b.ate ? 1 : 0) - (a.ate ? 1 : 0))
                  : menuList.map((m) => ({ name: m.name, price: (m.price as string | undefined) || null, ate: false }));
              const picks = allPicks.slice(0, 12); // 먹은 것 우선 정렬 후 최대 12개 (메뉴판 전체 OCR 방지)
              if (picks.length === 0) return null;
              return (
                <div className="order-4 bg-white/[0.02] md:bg-slate-50 border border-white/10 md:border-slate-200/80 rounded-[24px] p-5 space-y-3 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-1 shrink-0">
                    {picker?.profile_image ? (
                      <img
                        src={picker.profile_image}
                        alt={pickerName || ''}
                        className="w-6 h-6 rounded-full object-cover ring-1 ring-orange-500/50 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(pickerName || '?')}&background=random&color=fff&size=64`; }}
                      />
                    ) : (
                      <Utensils size={14} className="text-brand-orange shrink-0" />
                    )}
                    <div className="min-w-0 leading-tight">
                      <span className="text-[13px] font-black text-white md:text-slate-800 tracking-tight">
                        {pickerName ? `${pickerName} Pick` : '유튜버 Pick'}
                      </span>
                      <span className="block text-[9.5px] text-zinc-500 md:text-slate-400 font-bold">영상에서 먹고 추천한 메뉴예요</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 w-full">
                    {picks.map((menu, index) => {
                      const price = formatPrice(menu.price);
                      return (
                        <div key={index} className={`flex items-baseline gap-1.5 py-2 ${index < picks.length - 1 ? 'border-b border-zinc-800/60 md:border-slate-200' : ''}`}>
                          {menu.ate && (
                            <span className="shrink-0 self-center px-1.5 py-[1px] bg-orange-500/15 text-orange-400 md:text-orange-600 text-[9px] font-black rounded border border-orange-500/20">Pick</span>
                          )}
                          <span className="font-bold text-zinc-100 md:text-slate-700 text-[13px]">{menu.name}</span>
                          <div className="flex-1 border-b border-dashed border-zinc-700/50 md:border-slate-200 mx-1.5 min-w-[8px] h-3" />
                          {price && (
                            <span className="font-black text-orange-400 md:text-orange-600 shrink-0 text-[13px]">{price}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 시그니처 — 이 집이 유명한 이유 */}
                  {insights?.signature && (
                    <div className="flex items-start gap-1.5 pt-2.5 border-t border-white/5 md:border-slate-200">
                      <Sparkles size={11} className="text-orange-400 md:text-orange-500 shrink-0 mt-0.5" />
                      <p className="text-[11.5px] text-zinc-300 md:text-slate-600 font-semibold leading-relaxed">{insights.signature}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 border-t border-white/5 md:border-slate-200 pt-2.5">
                    <Info size={10} className="text-zinc-500 md:text-slate-400 shrink-0" />
                    <p className="text-[9px] text-zinc-500 md:text-slate-400 font-extrabold">영상 콘텐츠 기반이라 실제 메뉴·가격과 다를 수 있어요.</p>
                  </div>
                </div>
              );
            })()}

            {/* 이렇게 즐기세요 — 유튜버 꿀팁 (영상 분석) */}
            {(() => {
              const tips = (sortedVideos[0]?.ai_insights?.tips || []).filter(Boolean).slice(0, 6);
              if (tips.length === 0) return null;
              const pickerName = sortedVideos[0]?.youtuber?.name;
              return (
                <div className="order-5 bg-white/[0.02] md:bg-slate-50 border border-white/10 md:border-slate-200/80 rounded-[24px] p-5 space-y-3 shadow-sm">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[14px]">💡</span>
                    <span className="text-[13px] font-black text-white md:text-slate-800 tracking-tight">
                      이렇게 즐기세요{pickerName ? ` · ${pickerName} Tip` : ''}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {tips.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-[12.5px] text-zinc-300 md:text-slate-600 font-medium leading-relaxed">
                        <span className="text-orange-400 md:text-orange-500 font-black shrink-0">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Platform links */}
            <div className="order-6 grid grid-cols-2 gap-3 pt-1 shrink-0">
              <div 
                onClick={() => openNaverDeeplink(restaurant.name, restaurant.address)}
                className="bg-white/5 md:bg-slate-50 hover:bg-white/10 md:hover:bg-slate-100 border border-white/5 md:border-slate-200 rounded-2xl p-3 flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute -right-6 -bottom-6 w-12 h-12 bg-green-500/10 rounded-full blur-xl group-hover:bg-green-500/20 transition-all duration-300" />
                <div className="flex items-center gap-2 relative z-10">
                  <img 
                    src="/naver_map_logo.png?v=3" 
                    alt="Naver Map Logo" 
                    className="w-4 h-4 rounded shadow-sm object-contain"
                  />
                  <span className="text-[11px] font-bold text-white md:text-slate-700 group-hover:text-green-400 md:group-hover:text-green-600 transition-colors">네이버 지도</span>
                </div>
                <ExternalLink size={11} className="text-white/30 md:text-slate-400 group-hover:text-green-400 md:group-hover:text-green-600 transition-colors relative z-10 shrink-0" />
              </div>

              {/* 카카오맵 바로가기 카드 */}
              <div 
                onClick={() => openKakaoDeeplink(restaurant.name, restaurant.kakao_place_id, restaurant.lat, restaurant.lng)}
                className="bg-white/5 md:bg-slate-50 hover:bg-white/10 md:hover:bg-slate-100 border border-white/5 md:border-slate-200 rounded-2xl p-3.5 flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute -right-6 -bottom-6 w-12 h-12 bg-yellow-500/10 rounded-full blur-xl group-hover:bg-yellow-500/20 transition-all duration-300" />
                <div className="flex items-center gap-2 relative z-10">
                  <img 
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAOVBMVEVHcEwAdv//5wD/5AD74gAAfP/64QD64QD64QD74gC4wIOApbw+i+ejtZvv3CJaldjTzlwlhfLc0kuK1weQAAAACnRSTlMA////Fv//+bQX9hPeKgAAALpJREFUKJF901sSgyAMBVBIBHlKcf+LLYYWCYL5ccZjLoFBIazZ9aR2Y4WwM6llhVmjEV0mQinsksVNOqack8ObG4KTUpWS6oMjoiMibvrHo1mpoRP9hTJkekRkCDUPgNIDMKRUX95BuL5aYXoixaoD4JzE1oGU97OB+FbGfb4eggb/UxnhcbZ1zmK+WYdaE+bbeqRl5YlTpNNJXSPD0soaGWqUoW8cMDpkyC4tMtvfr+a2xnLlt/Xv8AWzshIVTzb8eQAAAABJRU5ErkJggg==" 
                    alt="Kakao Map Logo" 
                    className="w-4 h-4 rounded shadow-sm object-contain"
                  />
                  <span className="text-[11px] font-bold text-white md:text-slate-700 group-hover:text-yellow-400 md:group-hover:text-yellow-600 transition-colors">카카오맵</span>
                </div>
                <ExternalLink size={11} className="text-white/30 md:text-slate-400 group-hover:text-yellow-400 md:group-hover:text-yellow-600 transition-colors relative z-10 shrink-0" />
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  };

  return (
    <>
      {/* 글로벌 SVG 그라데이션 정의 */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="red-orange-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF0000" />
            <stop offset="100%" stopColor="#FF7A00" />
          </linearGradient>
        </defs>
      </svg>

      <AnimatePresence>
        {restaurant && (
          <>
            {/* 뒷배경 Dimmer 오버레이 - 모바일 전용 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="md:hidden absolute inset-0 bg-black/60 z-20"
            />

            {/* 모바일 하단 시트 */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="md:hidden absolute bottom-0 left-1/2 -translate-x-1/2 z-30 w-full max-w-md bg-brand-charcoal/95 border border-white/10 backdrop-blur-2xl text-white rounded-t-[32px] shadow-[0_-10px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[85vh]"
            >
              {isMobileDevice && renderContent()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 데스크탑 전용 상세 패널 (인라인 플렉스 패널로 개편) */}
      <AnimatePresence initial={false}>
        {restaurant && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="hidden md:flex flex-col h-full bg-white border-r border-slate-200 text-slate-800 shrink-0 overflow-hidden relative z-20 shadow-sm"
          >
            {!isMobileDevice && renderContent()}
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* 정보 정정·신고 모달 */}
      {restaurant && (
        <InfoSuggestModal
          isOpen={isSuggestOpen}
          onClose={() => setIsSuggestOpen(false)}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
        />
      )}

      {/* 영업시간 제보 모달 */}
      {restaurant && (
        <HoursReportModal
          isOpen={isHoursReportOpen}
          onClose={() => setIsHoursReportOpen(false)}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          initialHours={effHours || ''}
          onSubmitted={(h) => { setLocalHours(h); window.dispatchEvent(new Event('refresh-restaurants')); }}
        />
      )}
    </>
  );
}
