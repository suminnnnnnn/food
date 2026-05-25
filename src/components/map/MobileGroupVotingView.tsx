'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { MapPin, Plus, Heart, Trash2, Search, X, Star, Check, Bell } from 'lucide-react';
import { Restaurant } from '@/types';

interface MobileGroupVotingViewProps {
  groupId: string;
  groupTitle: string;
  availableRestaurants: Restaurant[];
  onClose: () => void;
}

export default function MobileGroupVotingView({
  groupId,
  groupTitle,
  availableRestaurants,
  onClose,
}: MobileGroupVotingViewProps) {
  const [items, setItems] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // 사용자 정보 로드
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    fetchItems();

    // 수파베이스 실시간 변경 구독 (아이템 추가/삭제 & 투표 변경 감지 시 즉시 패치)
    const channel = supabase
      .channel(`group_map_mobile_${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_map_items', filter: `group_map_id=eq.${groupId}` },
        fetchItems
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_map_votes' },
        fetchItems
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, user?.id]);

  const fetchItems = async () => {
    // 1. 공유 지도 후보 아이템 조회
    const { data: itemsData } = await supabase
      .from('group_map_items')
      .select('*, restaurants(*)')
      .eq('group_map_id', groupId);

    if (!itemsData) return;

    // 2. 투표 데이터와 투표한 사용자의 정보(닉네임, 아바타) 조인 조회
    const itemIds = itemsData.map((item) => item.id);
    if (itemIds.length === 0) {
      setItems([]);
      return;
    }

    const { data: votesData } = await supabase
      .from('group_map_votes')
      .select('*')
      .in('item_id', itemIds);

    // 3. 포맷팅 및 정렬
    const formatted = itemsData.map((item) => {
      const itemVotes = votesData?.filter((v: any) => v.item_id === item.id) || [];
      const hasVoted = user ? itemVotes.some((v: any) => v.user_id === user.id) : false;
      return {
        ...item,
        voteCount: itemVotes.length,
        hasVoted,
      };
    });

    // 투표수 기준 내림차순 정렬
    formatted.sort((a, b) => b.voteCount - a.voteCount);
    setItems(formatted);
  };

  const handleVote = async (itemId: string, hasVoted: boolean) => {
    if (!user) {
      alert('투표하려면 로그인이 필요합니다.');
      return;
    }
    if (hasVoted) {
      await supabase
        .from('group_map_votes')
        .delete()
        .match({ item_id: itemId, user_id: user.id });
    } else {
      await supabase
        .from('group_map_votes')
        .insert({ item_id: itemId, user_id: user.id });
    }
    fetchItems();
  };

  const handleAddRestaurant = async (restaurantId: string) => {
    if (!user) {
      alert('식당을 추가하려면 로그인이 필요합니다.');
      return;
    }

    // 이미 추가된 식당인지 체크
    const isAlreadyAdded = items.some((item) => item.restaurant_id === restaurantId);
    if (isAlreadyAdded) {
      alert('이미 공유 지도에 추가된 식당입니다.');
      return;
    }

    await supabase.from('group_map_items').insert({
      group_map_id: groupId,
      restaurant_id: restaurantId,
      added_by: user.id,
    });
    setIsAdding(false);
    setSearchQuery('');
    fetchItems();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user) return;
    const { data: item } = await supabase
      .from('group_map_items')
      .select('added_by')
      .eq('id', itemId)
      .single();

    if (item && item.added_by !== user.id) {
      alert('자신이 추가한 맛집만 삭제할 수 있습니다.');
      return;
    }

    if (confirm('이 맛집을 공유 지도에서 삭제하시겠습니까?')) {
      await supabase.from('group_map_items').delete().eq('id', itemId);
      fetchItems();
    }
  };

  const filteredSearch = availableRestaurants
    .filter(
      (r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center pointer-events-auto">
      {/* 바깥 영역 탭 시 닫힘 */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-md bg-[#0c0c0e]/95 border-t border-white/10 backdrop-blur-3xl rounded-t-[32px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10"
      >
        {/* 바텀시트 손잡이 */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3 shrink-0" />

        {/* 헤더 */}
        <div className="px-6 pb-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">{groupTitle} 🗳️</h2>
            <p className="text-white/40 text-[13px] mt-0.5">친구들과 함께 후보 맛집을 투표해보세요!</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 rounded-full text-white/60 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* 맛집 목록 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 hide-scrollbar">
          {items.length === 0 ? (
            <div className="text-center text-white/30 py-12 text-[14px]">
              아직 추가된 식당이 없습니다.<br />하단의 '식당 추천하기'를 터치해 첫 맛집을 추가해보세요!
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                className="bg-white/5 rounded-2xl p-4 border border-white/5 relative overflow-hidden group hover:bg-white/10 transition-all flex flex-col justify-between"
              >
                {idx === 0 && item.voteCount > 0 && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-brand-orange/20 to-transparent px-3 py-1 text-[10px] font-bold text-brand-orange rounded-bl-xl border-l border-b border-brand-orange/15 flex items-center gap-1">
                    👑 1위 맛집
                  </div>
                )}
                <div className="pr-12">
                  <span className="text-[10px] text-brand-orange font-bold uppercase tracking-wider bg-brand-orange/10 px-2 py-0.5 rounded-md inline-block">
                    {item.restaurants?.category?.split('>').pop()?.trim()}
                  </span>
                  <h3 className="text-white font-black text-base mt-1.5 mb-0.5 truncate">
                    {item.restaurants?.name}
                  </h3>
                  <p className="text-white/50 text-[11px] truncate">{item.restaurants?.address}</p>
                </div>

                <div className="flex items-center justify-between mt-3.5 pt-3.5 border-t border-white/5">
                  <button
                    onClick={() => handleVote(item.id, item.hasVoted)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      item.hasVoted
                        ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <Heart size={12} fill={item.hasVoted ? 'currentColor' : 'none'} />
                    <span>{item.voteCount || 0}</span>
                  </button>

                  {user && item.added_by === user.id && (
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-white/40 hover:text-red-500 rounded-lg hover:bg-white/5 transition-all"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 푸터 식당 추가 버튼 */}
        <div className="p-4 bg-gradient-to-t from-[#0c0c0e] to-[#0c0c0e]/90 border-t border-white/5 shrink-0">
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-brand-orange to-brand-orange-light rounded-xl text-white text-[15px] font-bold tracking-tight shadow-lg shadow-brand-orange/20 hover:scale-[1.01] active:scale-95 transition-all"
          >
            <Plus size={18} /> 식당 추천하기
          </button>
        </div>

        {/* 검색 및 추가 패널 (바텀시트 내부 슬라이드업 오버레이) */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 380 }}
              className="absolute inset-0 bg-[#0c0c0e] z-50 flex flex-col"
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="relative flex-1 mr-3">
                  <input
                    type="text"
                    autoFocus
                    placeholder="식당 이름으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-white text-sm placeholder-white/30 focus:outline-none focus:border-brand-orange transition-all"
                  />
                  <Search className="absolute left-3 top-3.5 text-white/30" size={14} />
                </div>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-2 bg-white/5 rounded-full text-white/60 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4.5 space-y-2.5 hide-scrollbar">
                {filteredSearch.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <span className="text-[10px] text-brand-orange font-bold inline-block">
                        {r.category?.split('>').pop()?.trim()}
                      </span>
                      <h4 className="text-white font-bold text-sm truncate mt-0.5">{r.name}</h4>
                      {r.address && (
                        <p className="text-white/40 text-[11px] truncate mt-0.5">{r.address}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddRestaurant(r.id)}
                      className="bg-brand-orange/10 hover:bg-brand-orange text-brand-orange hover:text-white border border-brand-orange/20 hover:border-brand-orange px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
                    >
                      추천
                    </button>
                  </div>
                ))}
                {searchQuery && filteredSearch.length === 0 && (
                  <div className="text-center text-white/40 mt-10 text-[14px]">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}