'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark, Star, MapPin, Check, Utensils, Play, Eye, Map as MapIcon, List,
  ChevronLeft, ChevronRight, Search, ArrowUpDown, Plus, Pencil, X,
} from 'lucide-react';
import { Restaurant, FolderRestaurantRelation, UserFolder, Video } from '@/types';
import PinIcon from '@/components/ui/PinIcon';
import {
  getAllSavedRestaurants,
  removeRestaurantFromFolder,
  updateFolderRestaurantRelation,
} from '@/lib/supabase/folders';

type StatusFilter = 'all' | 'wish' | 'visited';
type SortKey = 'recent' | 'distance' | 'rating';

interface SavedListViewProps {
  folders: UserFolder[];
  folderRelations: FolderRestaurantRelation[]; // 재조회 트리거
  onRefreshData: () => Promise<void>;
  onSelectRestaurant: (lat: number, lng: number, id: string) => void;
  activeVideoType?: '전체 리뷰' | '쇼츠 리뷰' | '롱폼 리뷰';
  mapMode?: boolean;
  onToggleMapMode?: (v: boolean) => void;
  statusFilter?: StatusFilter;
  onStatusChange?: (s: StatusFilter) => void;
  userLocation?: { lat: number; lng: number } | null;
  onActiveFolderChange?: (folderId: string | null) => void;
}

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'wish', label: '가고싶은곳' },
  { id: 'visited', label: '방문완료' },
];
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'recent', label: '최근순' },
  { id: 'distance', label: '거리순' },
  { id: 'rating', label: '별점순' },
];

const formatViewCount = (count: number) => {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace('.0', '')}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}천`;
  return count.toLocaleString();
};

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

const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// 주소에서 '시/구' 단위 지역명 추출 (커버리지 통계용)
const regionOf = (address?: string): string => {
  if (!address) return '';
  const parts = address.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
};

type SavedRestaurant = Restaurant & { folder_relation: FolderRestaurantRelation };

export default function SavedListView({
  folders,
  folderRelations,
  onRefreshData,
  onSelectRestaurant,
  activeVideoType = '전체 리뷰',
  mapMode = false,
  onToggleMapMode,
  statusFilter: statusFilterProp,
  onStatusChange,
  userLocation,
  onActiveFolderChange,
}: SavedListViewProps) {
  const [statusFilterLocal, setStatusFilterLocal] = useState<StatusFilter>('all');
  const statusFilter = statusFilterProp ?? statusFilterLocal;
  const setStatusFilter = (s: StatusFilter) => { setStatusFilterLocal(s); onStatusChange?.(s); };

  const [allItems, setAllItems] = useState<SavedRestaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null); // null=컬렉션 홈
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [query, setQuery] = useState('');

  // 카드별 인라인 편집 상태
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState('');

  // 전체 폴더의 저장 맛집 로드 (관계 변동 시 동기화)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const list = await getAllSavedRestaurants();
        if (mounted) setAllItems(list);
      } catch (e) {
        console.error('Failed to load saved restaurants', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [folderRelations]);

  // 컬렉션 선택 상태를 부모(지도)에 알려 해당 폴더 맛집만 보이게 함
  useEffect(() => {
    onActiveFolderChange?.(activeFolderId);
    return () => { onActiveFolderChange?.(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolderId]);

  const activeFolder = folders.find(f => f.id === activeFolderId) || null;

  // 폴더별 그룹 (커버·개수)
  const byFolder = useMemo(() => {
    const acc: Record<string, SavedRestaurant[]> = {};
    allItems.forEach(it => {
      const fid = it.folder_relation.folder_id;
      (acc[fid] = acc[fid] || []).push(it);
    });
    return acc;
  }, [allItems]);

  // 전체 통계 (중복 맛집 제거)
  const stats = useMemo(() => {
    const uniq = new Map<string, SavedRestaurant>();
    allItems.forEach(it => { if (!uniq.has(it.id)) uniq.set(it.id, it); });
    const all = [...uniq.values()];
    const visited = all.filter(it => it.folder_relation.visited).length;
    const regions = new Set(all.map(it => regionOf(it.address)).filter(Boolean));
    return { total: all.length, visited, regions: regions.size };
  }, [allItems]);

  // 현재 폴더 상세 목록 (상태필터 → 검색 → 정렬)
  const detailItems = useMemo(() => {
    if (!activeFolderId) return [];
    let list = (byFolder[activeFolderId] || []).slice();
    if (statusFilter === 'wish') list = list.filter(it => !it.folder_relation.visited);
    else if (statusFilter === 'visited') list = list.filter(it => it.folder_relation.visited);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(it =>
        it.name.toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q) ||
        (it.folder_relation.memo || '').toLowerCase().includes(q) ||
        it.videos?.some(v => v.youtuber?.name?.toLowerCase().includes(q))
      );
    }
    if (sortKey === 'recent') {
      list.sort((a, b) => new Date(b.folder_relation.created_at).getTime() - new Date(a.folder_relation.created_at).getTime());
    } else if (sortKey === 'rating') {
      list.sort((a, b) => (b.folder_relation.rating || 0) - (a.folder_relation.rating || 0));
    } else if (sortKey === 'distance' && userLocation) {
      list.sort((a, b) =>
        getDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        getDistance(userLocation.lat, userLocation.lng, b.lat, b.lng));
    }
    return list;
  }, [activeFolderId, byFolder, statusFilter, query, sortKey, userLocation]);

  // ── 로컬 낙관적 업데이트 헬퍼 ─────────────────────────────
  const patchRelation = (folderId: string, restaurantId: string, patch: Partial<FolderRestaurantRelation>) => {
    setAllItems(prev => prev.map(it =>
      it.id === restaurantId && it.folder_relation.folder_id === folderId
        ? { ...it, folder_relation: { ...it.folder_relation, ...patch } }
        : it));
  };

  const handleToggleVisited = async (it: SavedRestaurant) => {
    const rel = it.folder_relation;
    const nextVisited = !rel.visited;
    patchRelation(rel.folder_id, it.id, { visited: nextVisited, visit_count: nextVisited ? Math.max(1, rel.visit_count) : 0 });
    try {
      await updateFolderRestaurantRelation(rel.folder_id, it.id, { visited: nextVisited, visit_count: nextVisited ? Math.max(1, rel.visit_count) : 0 });
    } catch (e) { console.error('toggle visited failed', e); }
  };

  const handleSetRating = async (it: SavedRestaurant, rating: number) => {
    const rel = it.folder_relation;
    const next = rel.rating === rating ? null : rating;
    patchRelation(rel.folder_id, it.id, { rating: next });
    try { await updateFolderRestaurantRelation(rel.folder_id, it.id, { rating: next }); }
    catch (e) { console.error('set rating failed', e); }
  };

  const handleSaveMemo = async (it: SavedRestaurant) => {
    const rel = it.folder_relation;
    const memo = memoDraft.trim();
    patchRelation(rel.folder_id, it.id, { memo });
    setEditingMemoId(null);
    try { await updateFolderRestaurantRelation(rel.folder_id, it.id, { memo }); }
    catch (e) { console.error('save memo failed', e); }
  };

  const handleRemove = async (it: SavedRestaurant) => {
    const rel = it.folder_relation;
    setAllItems(prev => prev.filter(x => !(x.id === it.id && x.folder_relation.folder_id === rel.folder_id)));
    try {
      await removeRestaurantFromFolder(rel.folder_id, it.id);
      await onRefreshData();
    } catch (e) { console.error('remove failed', e); }
  };

  // ───────────────────────── 렌더 ─────────────────────────
  return (
    <div className="flex flex-col h-full bg-white">
      <svg width="0" height="0" className="absolute"><defs>
        <linearGradient id="saved-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs></svg>

      {/* 헤더 */}
      <div className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between gap-2">
        {activeFolder ? (
          <button onClick={() => { setActiveFolderId(null); setQuery(''); }} className="flex items-center gap-1.5 min-w-0 group">
            <ChevronLeft size={18} className="shrink-0 text-slate-400 group-hover:text-slate-600" />
            <span className="shrink-0 flex items-center"><PinIcon color={activeFolder.color || '#F2735E'} filled size={18} /></span>
            <h3 className="text-[15px] font-black text-slate-800 tracking-tight truncate">{activeFolder.name}</h3>
            <span className="text-[12px] font-bold text-slate-400 shrink-0">{(byFolder[activeFolder.id] || []).length}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <Bookmark size={18} className="shrink-0" style={{ fill: 'url(#saved-grad)', stroke: 'url(#saved-grad)' }} />
            <h3 className="text-[15px] font-black text-slate-800 tracking-tight">내 저장</h3>
          </div>
        )}

        {onToggleMapMode && (
          <div className="flex items-center p-0.5 rounded-full bg-slate-100 shrink-0">
            {([['list', '리스트', List], ['map', '지도', MapIcon]] as const).map(([id, label, Icon]) => {
              const active = (id === 'map') === mapMode;
              return (
                <button key={id} onClick={() => onToggleMapMode(id === 'map')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition-colors cursor-pointer ${active ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  <Icon size={12} strokeWidth={2.5} /> {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 지도 뷰: 안내 + 범례 */}
      {mapMode && (
        <div className="px-5 pb-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-[13px] font-black text-slate-700">지도에 저장 맛집 표시 중</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">위 지도의 핀을 눌러 저장한 맛집을 확인하세요.</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f97316' }} /> 가고싶은곳</span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} /> 방문완료</span>
            </div>
          </div>
        </div>
      )}

      {!mapMode && !activeFolder && (
        /* ───────── 컬렉션 홈 ───────── */
        <div className="flex-1 overflow-y-auto px-5 pb-6 portal-sidebar-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {/* 통계 스트립 */}
          <div className="flex gap-2 mb-4">
            {[['저장', stats.total], ['방문완료', stats.visited], ['지역', stats.regions]].map(([label, val]) => (
              <div key={label as string} className="flex-1 bg-slate-50 rounded-2xl py-2.5 text-center border border-slate-100">
                <p className="text-[19px] font-black text-orange-500 tabular-nums leading-none">{val as number}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">{label as string}</p>
              </div>
            ))}
          </div>

          {loading && allItems.length === 0 ? (
            <div className="space-y-3">{[1, 2, 3].map(n => <div key={n} className="h-[92px] rounded-2xl bg-slate-100 animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {folders.map(folder => {
                const items = byFolder[folder.id] || [];
                const covers = items.map(it => getBestVideo(it.videos, activeVideoType)?.thumbnail).filter(Boolean).slice(0, 5) as string[];
                return (
                  <motion.button
                    key={folder.id}
                    onClick={() => { setActiveFolderId(folder.id); setStatusFilter('all'); setSortKey('recent'); }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                    whileTap={{ scale: 0.985 }}
                    className="w-full rounded-2xl overflow-hidden border border-slate-200 bg-white text-left shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                  >
                    {/* 커버 모자이크 */}
                    <div className="grid h-[78px] gap-0.5" style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
                      {covers.length === 0 ? (
                        <div className="col-span-3 row-span-2 flex items-center justify-center" style={{ background: (folder.color || '#F2735E') + '18' }}>
                          <PinIcon color={folder.color || '#F2735E'} filled size={30} />
                        </div>
                      ) : (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={`overflow-hidden bg-slate-100 ${i === 0 ? 'row-span-2' : ''}`}>
                            {covers[i] ? <img src={covers[i]} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full" style={{ background: (folder.color || '#f97316') + '14' }} />}
                          </div>
                        ))
                      )}
                    </div>
                    {/* 메타 */}
                    <div className="flex items-center gap-2 px-3.5 py-2.5">
                      <span className="shrink-0 flex items-center"><PinIcon color={folder.color || '#F2735E'} filled size={17} /></span>
                      <span className="text-[13.5px] font-black text-slate-800 truncate">{folder.name}</span>
                      {folder.is_collaborative && <span className="text-[9.5px] font-black text-orange-500 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full shrink-0">공유</span>}
                      <span className="ml-auto text-[11px] font-bold text-slate-400 shrink-0 tabular-nums">{items.length}곳</span>
                      <ChevronRight size={15} className="text-slate-300 shrink-0" />
                    </div>
                  </motion.button>
                );
              })}

              {folders.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center mb-4"><Star size={26} className="text-orange-300" /></div>
                  <p className="text-[14px] font-bold text-slate-600">아직 컬렉션이 없어요</p>
                  <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">지도나 목록에서 별을 눌러<br />맛집을 저장해 보세요.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!mapMode && activeFolder && (
        /* ───────── 컬렉션 상세 ───────── */
        <>
          {/* 검색 */}
          <div className="px-5 pb-2.5 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query} onChange={e => setQuery(e.target.value)}
                placeholder="저장한 맛집 검색"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-8 text-[13px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400"
              />
              {query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
            </div>
          </div>

          {/* 상태 필터 + 정렬 */}
          <div className="px-5 pb-3 shrink-0 flex items-center gap-1.5">
            {STATUS_FILTERS.map(f => {
              const active = statusFilter === f.id;
              return (
                <button key={f.id} onClick={() => setStatusFilter(f.id)}
                  className={`py-1.5 px-3 rounded-full text-[12px] font-bold transition-all border cursor-pointer ${active ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {f.label}
                </button>
              );
            })}
            <div className="ml-auto relative">
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="appearance-none bg-white border border-slate-200 rounded-full pl-7 pr-6 py-1.5 text-[12px] font-bold text-slate-600 cursor-pointer focus:outline-none focus:border-orange-400"
              >
                {SORTS.map(s => <option key={s.id} value={s.id} disabled={s.id === 'distance' && !userLocation}>{s.label}</option>)}
              </select>
              <ArrowUpDown size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 카드 리스트 */}
          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-3 portal-sidebar-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {detailItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center mb-4"><Star size={26} className="text-orange-300" /></div>
                <p className="text-[14px] font-bold text-slate-600">{query ? '검색 결과가 없어요' : '해당하는 맛집이 없어요'}</p>
              </div>
            ) : detailItems.map(it => {
              const rel = it.folder_relation;
              const vid = getBestVideo(it.videos, activeVideoType);
              const dist = userLocation ? getDistance(userLocation.lat, userLocation.lng, it.lat, it.lng) : null;
              const distLabel = dist == null ? null : dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
              const isEditingMemo = editingMemoId === it.id;
              return (
                <motion.div key={rel.folder_id + it.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                  className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                  {/* 썸네일 */}
                  <div className="relative w-full cursor-pointer" style={{ aspectRatio: '16/9' }}
                    onClick={() => onSelectRestaurant(it.lat, it.lng, it.id)}>
                    {vid?.thumbnail ? <img src={vid.thumbnail} className="absolute inset-0 w-full h-full object-cover" alt={it.name} />
                      : <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center"><Utensils size={30} className="text-slate-500" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

                    <span
                      className={`absolute top-2.5 left-2.5 text-[9.5px] font-black px-2.5 py-1 rounded-full flex items-center gap-0.5 shadow-md ${rel.visited ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}>
                      {rel.visited ? <><Check size={9} strokeWidth={3} /> 방문완료{rel.visit_count > 1 ? ` (${rel.visit_count})` : ''}</> : '가고싶은곳'}
                    </span>
                    <button onClick={e => { e.stopPropagation(); handleRemove(it); }}
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/15 hover:bg-black/60 transition-colors" title="이 컬렉션에서 빼기">
                      <Star size={12} className="text-orange-400 fill-orange-400" />
                    </button>

                    <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3 z-10">
                      {vid?.youtuber?.name && (
                        <div className="flex items-center gap-1.5 mb-1">
                          {vid.youtuber.profile_image && <img src={vid.youtuber.profile_image} className="w-4 h-4 rounded-full object-cover ring-1 ring-white/40" alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                          <span className="text-[10px] font-semibold text-white/80 truncate max-w-[150px]">{vid.youtuber.name}</span>
                        </div>
                      )}
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-[15px] font-black text-white leading-tight truncate">{it.name}</p>
                        {it.category && <span className="text-[10px] font-bold text-white/60 truncate shrink-0">{it.category.split('>').pop()?.trim()}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-bold">
                        {vid && vid.view_count > 0 && <span className="flex items-center gap-1 text-orange-300"><Eye size={10} />{formatViewCount(vid.view_count)}</span>}
                        {distLabel && <span className="flex items-center gap-0.5 text-white/70"><MapPin size={10} />{distLabel}</span>}
                      </div>
                    </div>
                  </div>

                  {/* 개인화 푸터: 별점 · 메모 · 태그 */}
                  <div className="px-3.5 py-3">
                    {/* 별점 */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => handleSetRating(it, n)} className="p-0.5 active:scale-90 transition-transform">
                          <Star size={16} className={(rel.rating || 0) >= n ? 'text-orange-400 fill-orange-400' : 'text-slate-200'} />
                        </button>
                      ))}
                      {rel.rating ? <span className="ml-1 text-[11px] font-black text-orange-500">{rel.rating}.0</span> : <span className="ml-1 text-[11px] font-semibold text-slate-300">평가하기</span>}
                    </div>

                    {/* 메모 */}
                    {isEditingMemo ? (
                      <div className="mt-2">
                        <textarea autoFocus value={memoDraft} onChange={e => setMemoDraft(e.target.value)} rows={2} maxLength={140}
                          placeholder="메모 (예: 주차 편함, 웨이팅 김)"
                          className="w-full bg-slate-50 border border-orange-200 rounded-xl px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:border-orange-400 resize-none" />
                        <div className="flex gap-2 mt-1.5 justify-end">
                          <button onClick={() => setEditingMemoId(null)} className="px-3 py-1 rounded-lg text-[11px] font-bold text-slate-500 bg-slate-100">취소</button>
                          <button onClick={() => handleSaveMemo(it)} className="px-3 py-1 rounded-lg text-[11px] font-black text-white" style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}>저장</button>
                        </div>
                      </div>
                    ) : rel.memo ? (
                      <button onClick={() => { setEditingMemoId(it.id); setMemoDraft(rel.memo || ''); }}
                        className="mt-2 w-full text-left flex items-start gap-1.5 bg-slate-50 rounded-xl px-3 py-2 group">
                        <span className="text-[12px] text-slate-600 flex-1 leading-relaxed">{rel.memo}</span>
                        <Pencil size={11} className="text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5" />
                      </button>
                    ) : (
                      <button onClick={() => { setEditingMemoId(it.id); setMemoDraft(''); }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-orange-500">
                        <Plus size={12} /> 메모 추가
                      </button>
                    )}

                    {/* 방문완료 버튼 */}
                    <button
                      onClick={() => handleToggleVisited(it)}
                      className={`mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12.5px] font-black transition-colors ${
                        rel.visited
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                      {rel.visited ? `방문완료${rel.visit_count > 1 ? ` · ${rel.visit_count}회` : ''}` : '방문 체크'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
