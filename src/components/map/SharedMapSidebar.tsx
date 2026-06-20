'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { MapPin, Plus, Heart, Trash2, Search, X } from 'lucide-react';
import { Restaurant } from '@/types';

interface SharedMapSidebarProps {
  groupId: string;
  groupTitle: string;
  availableRestaurants: Restaurant[];
  hoveredRestaurantId: string | null;
  onHoverRestaurantChange: (id: string | null) => void;
  onSelectRestaurant: (restaurant: Restaurant | null) => void;
}

export default function SharedMapSidebar({ 
  groupId, 
  groupTitle, 
  availableRestaurants,
  hoveredRestaurantId,
  onHoverRestaurantChange,
  onSelectRestaurant
}: SharedMapSidebarProps) {
  const [items, setItems] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const searchScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    fetchItems();

    // 실시간 업데이트 구독
    const channel = supabase
      .channel(`group_map_${groupId}`)
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
    // 1. 공유지도 후보 아이템 조회
    const { data: itemsData } = await supabase
      .from('group_map_items')
      .select('*, restaurants(*)')
      .eq('group_map_id', groupId);

    if (!itemsData) return;

    // 2. 투표 데이터 조회
    const itemIds = itemsData.map(item => item.id);
    if (itemIds.length === 0) {
      setItems([]);
      return;
    }

    const { data: votesData } = await supabase
      .from('group_map_votes')
      .select('*')
      .in('item_id', itemIds);

    // 3. 포맷팅 및 정렬
    const formatted = itemsData.map(item => {
      const itemVotes = votesData?.filter(v => v.item_id === item.id) || [];
      const hasVoted = user ? itemVotes.some(v => v.user_id === user.id) : false;
      return {
        ...item,
        voteCount: itemVotes.length,
        hasVoted
      };
    });

    // 투표수 기준 내림차순 정렬
    formatted.sort((a, b) => b.voteCount - a.voteCount);
    setItems(formatted);
  };

  const handleVote = async (itemId: string, hasVoted: boolean) => {
    if (!user) {
      alert("투표하려면 로그인이 필요합니다.");
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
      alert("식당을 추가하려면 로그인이 필요합니다.");
      return;
    }
    
    // 이미 추가된 식당인지 체크
    const isAlreadyAdded = items.some(item => item.restaurant_id === restaurantId);
    if (isAlreadyAdded) {
      alert("이미 공유 지도에 추가된 식당입니다.");
      return;
    }

    await supabase.from('group_map_items').insert({
      group_map_id: groupId,
      restaurant_id: restaurantId,
      added_by: user.id
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
      alert("자신이 추가한 맛집만 삭제할 수 있습니다.");
      return;
    }

    if (confirm("이 맛집을 공유 지도에서 삭제하시겠습니까?")) {
      await supabase.from('group_map_items').delete().eq('id', itemId);
      fetchItems();
    }
  };

  const filteredSearch = availableRestaurants.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10);

  return (
    <motion.div
      initial={{ x: 450, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute top-6 right-6 bottom-6 w-[420px] z-30 flex flex-col bg-[#0c0c0e]/85 border border-white/8 backdrop-blur-3xl rounded-[28px] shadow-2xl overflow-hidden pointer-events-auto"
    >
      <div className="p-6.5 bg-gradient-to-b from-brand-charcoal to-brand-charcoal/90 border-b border-white/5 shrink-0">
        <h2 className="text-[26px] font-black text-white tracking-tight mb-2.5">{groupTitle}</h2>
        <p className="text-white/50 text-[15px]">친구들과 함께 맛집을 추가하고 투표해보세요!</p>
        <button 
          onClick={() => setIsAdding(true)}
          className="mt-4.5 w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-brand-orange to-brand-orange-light rounded-xl text-white text-[16px] font-bold tracking-tight shadow-lg shadow-brand-orange/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus size={20} /> 식당 추가하기
        </button>
      </div>

      <div ref={mainScrollRef} className="flex-1 overflow-y-auto p-4.5 space-y-3.5 hide-scrollbar">
        {items.length === 0 ? (
          <div className="text-center text-white/40 mt-10 text-[15px]">
            아직 추가된 식당이 없습니다.<br/>첫 번째 식당을 추가해보세요!
          </div>
        ) : (
          items.map((item, idx) => (
            <div 
              key={item.id} 
              onClick={() => {
                if (item.restaurants) {
                  onSelectRestaurant(item.restaurants);
                }
              }}
              onMouseEnter={() => {
                if (item.restaurants?.id) {
                  onHoverRestaurantChange(item.restaurants.id);
                }
              }}
              onMouseLeave={() => onHoverRestaurantChange(null)}
              className="group relative bg-white/[0.03] backdrop-blur-md rounded-3xl p-4.5 cursor-pointer border border-white/10 hover-acrylic-glow flex flex-col overflow-hidden"
            >

              {idx === 0 && item.voteCount > 0 && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-brand-orange/20 to-transparent px-3 py-1 text-[11px] font-bold text-brand-orange rounded-bl-xl border-l border-b border-brand-orange/15 flex items-center gap-1 z-10">
                  👑 1위 맛집
                </div>
              )}
              <div className="pr-10 z-10">
                <span className="text-[11px] text-brand-orange font-bold uppercase tracking-wider bg-brand-orange/10 px-2 py-0.5 rounded-md">
                  {item.restaurants?.category?.split('>').pop()?.trim()}
                </span>
                <h3 className="text-white font-black text-lg mt-1.5 mb-1 truncate">{item.restaurants?.name}</h3>
                <p className="text-white/60 text-xs truncate">{item.restaurants?.address}</p>
              </div>
              
              <div className="flex items-center justify-between mt-4 z-10">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVote(item.id, item.hasVoted);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    item.hasVoted 
                      ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30' 
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Heart size={13} fill={item.hasVoted ? "currentColor" : "none"} />
                  <span>{item.voteCount || 0}</span>
                </button>

                {user && item.added_by === user.id && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    className="p-2 text-white/40 hover:text-red-500 rounded-lg hover:bg-white/5 transition-all"
                    title="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 식당 추가 오버레이 패널 */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 bg-[#0c0c0e] z-40 flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="relative flex-1 mr-3">
                <input 
                  type="text" 
                  autoFocus
                  placeholder="식당 이름으로 검색..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder-white/30 focus:outline-none focus:border-brand-orange transition-all"
                />
                <Search className="absolute left-3 top-3 text-white/30" size={16} />
              </div>
              <button 
                onClick={() => setIsAdding(false)} 
                className="p-2 bg-white/5 rounded-full text-white/60 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div ref={searchScrollRef} className="flex-1 overflow-y-auto p-4.5 space-y-2.5 hide-scrollbar">
              {filteredSearch.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex-1 min-w-0 pr-3">
                    <span className="text-[10px] text-brand-orange font-bold">
                      {r.category?.split('>').pop()?.trim()}
                    </span>
                    <h4 className="text-white font-bold text-sm truncate mt-0.5">{r.name}</h4>
                    {r.address && <p className="text-white/40 text-[11px] truncate mt-0.5">{r.address}</p>}
                  </div>
                  <button 
                    onClick={() => handleAddRestaurant(r.id)}
                    className="bg-brand-orange/10 hover:bg-brand-orange text-brand-orange hover:text-white border border-brand-orange/20 hover:border-brand-orange px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
                  >
                    추천
                  </button>
                </div>
              ))}
              {searchQuery && filteredSearch.length === 0 && (
                <div className="text-center text-white/40 mt-10 text-[15px]">검색 결과가 없습니다.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}