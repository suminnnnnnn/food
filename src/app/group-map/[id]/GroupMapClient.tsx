'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase/client';
import { useMapBounds } from '@/hooks/useMapBounds';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useIsMobile } from '@/hooks/useIsMobile';
import SharedMapSidebar from '@/components/map/SharedMapSidebar';
import MobileGroupVotingView from '@/components/map/MobileGroupVotingView';
import { AnimatePresence } from 'framer-motion';
import { Vote } from 'lucide-react';

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), { 
  ssr: false,
  loading: () => <div className="w-full h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">Loading Maps...</div>
});

export default function GroupMapClient({ id }: { id: string }) {
  const [groupMap, setGroupMap] = useState<any>(null);
  const { bounds, updateBounds } = useMapBounds();
  const { restaurants, loading, error } = useRestaurants(bounds);
  const isMobile = useIsMobile();
  const [showMobileVoting, setShowMobileVoting] = useState(false);
  
  // 외부 호버 및 식당 선택 공통 상향 상태 선언 (사이드바 - 지도 연동)
  const [hoveredRestaurantId, setHoveredRestaurantId] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);

  useEffect(() => {
    async function fetchGroupMap() {
      const { data, error } = await supabase.from('group_maps').select('*').eq('id', id).single();
      if (data) setGroupMap(data);
    }
    fetchGroupMap();
  }, [id]);

  if (!groupMap) return <div className="w-full h-screen bg-brand-charcoal text-white flex items-center justify-center font-bold text-xl">지도 불러오는 중...</div>;

  return (
    <main className="relative w-full h-screen bg-brand-charcoal overflow-hidden">
      <MapContainer 
        restaurants={restaurants} 
        onBoundsChange={updateBounds} 
        hideDefaultSidebar={true} 
        hideOmniSearch={true}
        hideGameFAB={true}
        externalHoveredRestaurantId={hoveredRestaurantId}
        externalSelectedRestaurant={selectedRestaurant}
        onExternalSelectedChange={setSelectedRestaurant}
      />
      
      {isMobile ? (
        <>
          {/* Mobile Bottom Floating Action Button */}
          <button
            onClick={() => setShowMobileVoting(true)}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-4 bg-primary text-on-primary rounded-full shadow-[0_8px_24px_rgba(164,60,18,0.35)] hover:opacity-95 active:scale-95 transition-all animate-bounce"
          >
            <Vote className="w-5 h-5" />
            <span className="font-bold text-[14px] tracking-tight">투표 목록 🗳️</span>
          </button>

          {/* Slide-up voting Overlay */}
          <AnimatePresence>
            {showMobileVoting && (
              <MobileGroupVotingView
                groupId={id}
                groupTitle={groupMap.title}
                availableRestaurants={restaurants}
                onClose={() => setShowMobileVoting(false)}
              />
            )}
          </AnimatePresence>
        </>
      ) : (
        /* PC Left/Right absolute Sidebar */
        <SharedMapSidebar 
          groupId={id} 
          groupTitle={groupMap.title} 
          availableRestaurants={restaurants} 
          hoveredRestaurantId={hoveredRestaurantId}
          onHoverRestaurantChange={setHoveredRestaurantId}
          onSelectRestaurant={setSelectedRestaurant}
        />
      )}
    </main>
  );
}


