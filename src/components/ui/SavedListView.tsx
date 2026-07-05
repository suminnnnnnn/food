'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Star, MapPin, Check, Utensils, Play, Eye, Map as MapIcon, List } from 'lucide-react';
import { Restaurant, FolderRestaurantRelation, Video } from '@/types';
import {
  getFolderRestaurants,
  removeRestaurantFromFolder,
  updateFolderRestaurantRelation,
} from '@/lib/supabase/folders';

type StatusFilter = 'all' | 'wish' | 'visited';

interface SavedListViewProps {
  defaultFolderId: string;
  folderRelations: FolderRestaurantRelation[]; // 카운트/재조회 트리거
  onRefreshData: () => Promise<void>;
  onSelectRestaurant: (lat: number, lng: number, id: string) => void; // 지도 이동 + 정보카드
  activeVideoType?: '전체 리뷰' | '쇼츠 리뷰' | '롱폼 리뷰';
  mapMode?: boolean; // 지도 뷰 활성 여부 (부모=지도가 소유)
  onToggleMapMode?: (v: boolean) => void;
  statusFilter?: StatusFilter; // 리스트/지도 공유 필터 (controlled)
  onStatusChange?: (s: StatusFilter) => void;
}

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'wish', label: '가고싶은곳' },
  { id: 'visited', label: '방문완료' },
];

const formatViewCount = (count: number) => {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace('.0', '')}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}천`;
  return count.toLocaleString();
};

// 조회수 기준으로 대표 영상 선택 (영상 종류 선호 반영)
const getBestVideo = (videos: Video[] | undefined, preferredType?: string): Video | null => {
  if (!videos || videos.length === 0) return null;
  let targetVideos = videos;
  if (preferredType === '쇼츠 리뷰') {
    const shorts = videos.filter(v => v.is_short);
    if (shorts.length > 0) targetVideos = shorts;
  } else if (preferredType === '롱폼 리뷰') {
    const longs = videos.filter(v => !v.is_short);
    if (longs.length > 0) targetVideos = longs;
  }
  return targetVideos.reduce(
    (best, curr) => ((best.view_count || 0) > (curr.view_count || 0) ? best : curr),
    targetVideos[0]
  );
};

type SavedRestaurant = Restaurant & { folder_relation: FolderRestaurantRelation };

export default function SavedListView({
  defaultFolderId,
  folderRelations,
  onRefreshData,
  onSelectRestaurant,
  activeVideoType = '전체 리뷰',
  mapMode = false,
  onToggleMapMode,
  statusFilter: statusFilterProp,
  onStatusChange,
}: SavedListViewProps) {
  // controlled(부모 소유) 우선, 없으면 내부 상태로 폴백
  const [statusFilterLocal, setStatusFilterLocal] = useState<StatusFilter>('all');
  const statusFilter = statusFilterProp ?? statusFilterLocal;
  const setStatusFilter = (s: StatusFilter) => {
    setStatusFilterLocal(s);
    onStatusChange?.(s);
  };
  const [items, setItems] = useState<SavedRestaurant[]>([]);
  const [loading, setLoading] = useState(false);

  // 기본 폴더 내 저장 맛집 로드 (folderRelations 변동 시 동기화)
  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!defaultFolderId) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const list = await getFolderRestaurants(defaultFolderId);
        if (isMounted) setItems(list);
      } catch (err) {
        console.error('Failed to load saved restaurants', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [defaultFolderId, folderRelations]);

  const filteredItems = useMemo(() => {
    if (statusFilter === 'wish') return items.filter(it => !it.folder_relation.visited);
    if (statusFilter === 'visited') return items.filter(it => it.folder_relation.visited);
    return items;
  }, [items, statusFilter]);

  // 방문 상태 토글 (가고싶은곳 ↔ 방문완료)
  const handleToggleVisited = async (restaurant: SavedRestaurant) => {
    const rel = restaurant.folder_relation;
    const nextVisited = !rel.visited;
    try {
      await updateFolderRestaurantRelation(rel.folder_id, restaurant.id, {
        visited: nextVisited,
        visit_count: nextVisited ? Math.max(1, rel.visit_count) : 0,
      });
      setItems(prev =>
        prev.map(it =>
          it.id === restaurant.id
            ? { ...it, folder_relation: { ...it.folder_relation, visited: nextVisited, visit_count: nextVisited ? Math.max(1, rel.visit_count) : 0 } }
            : it
        )
      );
    } catch (err) {
      console.error('Failed to toggle visited', err);
    }
  };

  // 저장 해제
  const handleRemove = async (restaurant: SavedRestaurant) => {
    try {
      await removeRestaurantFromFolder(restaurant.folder_relation.folder_id, restaurant.id);
      setItems(prev => prev.filter(it => it.id !== restaurant.id));
      await onRefreshData(); // 지도 별 상태도 함께 갱신
    } catch (err) {
      console.error('Failed to remove saved restaurant', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 1. 헤더 */}
      <div className="px-5 pt-5 pb-3.5 shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bookmark
            size={18}
            className="shrink-0"
            style={{ fill: 'url(#saved-grad)', stroke: 'url(#saved-grad)' }}
          />
          {/* 그라데이션 아이콘용 svg defs */}
          <svg width="0" height="0" className="absolute">
            <defs>
              <linearGradient id="saved-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
          </svg>
          <h3 className="text-[15px] font-black text-slate-800 tracking-tight">내 저장 맛집</h3>
          <span className="text-[12px] font-bold text-slate-400">{items.length}</span>
        </div>

        {/* 리스트/지도 뷰 토글 */}
        {onToggleMapMode && (
          <div className="flex items-center p-0.5 rounded-full bg-slate-100 shrink-0">
            {([['list', '리스트', List], ['map', '지도', MapIcon]] as const).map(([id, label, Icon]) => {
              const active = (id === 'map') === mapMode;
              return (
                <button
                  key={id}
                  onClick={() => onToggleMapMode(id === 'map')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition-colors cursor-pointer ${
                    active ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon size={12} strokeWidth={2.5} /> {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. 상태 필터 칩 */}
      <div className="px-5 pb-3.5 shrink-0 flex items-center gap-1.5">
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`py-1.5 px-3 rounded-full text-[12px] font-bold transition-all border cursor-pointer ${
                active
                  ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* 지도 뷰: 안내 + 범례 (리스트 대신 지도의 핀으로 확인) */}
      {mapMode && (
        <div className="px-5 pb-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-[13px] font-black text-slate-700">지도에 {filteredItems.length}곳 표시 중</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">위 지도의 핀을 눌러 저장한 맛집을 확인하세요.</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f97316' }} /> 가고싶은곳
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} /> 방문완료
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. 카드 리스트 */}
      <div
        className={`flex-1 overflow-y-auto px-5 pb-5 space-y-3 portal-sidebar-scrollbar ${mapMode ? 'hidden' : ''}`}
        style={{ scrollbarWidth: 'none' }}
      >
        {loading && items.length === 0 ? (
          // 로딩 스켈레톤
          <div className="space-y-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="w-full rounded-2xl bg-slate-100 animate-pulse" style={{ aspectRatio: '16/9' }} />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          // 빈 상태
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center mb-4">
              <Star size={26} className="text-orange-300" />
            </div>
            <p className="text-[14px] font-bold text-slate-600">
              {statusFilter === 'all' ? '저장된 맛집이 없어요' : statusFilter === 'wish' ? '가고싶은 맛집이 없어요' : '방문한 맛집이 없어요'}
            </p>
            <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">
              지도나 목록에서 별을 눌러<br />맛집을 저장해 보세요.
            </p>
          </div>
        ) : (
          filteredItems.map(restaurant => {
            const rel = restaurant.folder_relation;
            const vid = getBestVideo(restaurant.videos, activeVideoType);
            return (
              <motion.div
                key={restaurant.id}
                onClick={() => onSelectRestaurant(restaurant.lat, restaurant.lng, restaurant.id)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                whileTap={{ scale: 0.97 }}
                className="group relative w-full rounded-2xl overflow-hidden cursor-pointer"
                style={{ aspectRatio: '16/9', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              >
                {/* 배경 이미지 */}
                {vid?.thumbnail ? (
                  <img src={vid.thumbnail} className="absolute inset-0 w-full h-full object-cover" alt={restaurant.name} />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                    <Utensils size={32} className="text-slate-500" />
                  </div>
                )}

                {/* Shorts 배지 */}
                {vid?.is_short && (
                  <div className="absolute bottom-2.5 right-2.5 bg-black/35 backdrop-blur-md border border-white/10 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm z-10">
                    <Play size={6} fill="currentColor" /> SHORTS
                  </div>
                )}

                {/* 그라데이션 오버레이 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

                {/* 상단: 방문 상태 배지(좌) + 저장 해제(우) */}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleToggleVisited(restaurant);
                    }}
                    className={`text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-0.5 shadow-md transition-colors ${
                      rel.visited ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'
                    }`}
                  >
                    {rel.visited ? (
                      <>
                        <Check size={9} strokeWidth={3} /> 방문완료{rel.visit_count > 1 ? ` (${rel.visit_count})` : ''}
                      </>
                    ) : (
                      '가고싶은곳'
                    )}
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleRemove(restaurant);
                    }}
                    className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/15 hover:bg-black/60 transition-colors"
                    title="저장 해제"
                  >
                    <Star size={12} className="text-orange-400 fill-orange-400" />
                  </button>
                </div>

                {/* 하단: 유튜버 + 식당명 + 조회수 */}
                <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3.5 z-10">
                  {vid?.youtuber?.name && (
                    <div className="flex items-center gap-1.5 mb-1">
                      {vid.youtuber.profile_image ? (
                        <img
                          src={vid.youtuber.profile_image}
                          className="w-4 h-4 rounded-full object-cover ring-1 ring-white/40"
                          alt={vid.youtuber.name}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : null}
                      <span className="text-[10px] font-semibold text-white/80 truncate max-w-[140px]">{vid.youtuber.name}</span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-[15px] font-black text-white leading-tight truncate">{restaurant.name}</p>
                    {restaurant.category && (
                      <span className="text-[10px] font-bold text-white/60 truncate shrink-0">{restaurant.category.split('>').pop()?.trim()}</span>
                    )}
                  </div>
                  {vid?.view_count !== undefined && vid.view_count > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Eye size={10} className="text-orange-300 shrink-0" />
                      <span className="text-[11px] font-bold text-orange-300">조회수 {formatViewCount(vid.view_count)}회</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
