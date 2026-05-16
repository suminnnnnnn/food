'use client';

import { useRestaurants } from '@/hooks/useRestaurants';
import { useMapBounds } from '@/hooks/useMapBounds';
import MapContainer from '@/components/map/MapContainer';

export default function HomePage() {
  const { bounds, updateBounds } = useMapBounds();
  const { restaurants, loading, error } = useRestaurants(bounds);

  return (
    <main className="relative w-full h-screen">
      {/* 에러 상태를 표시할 UI 추가 */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 text-red-600 font-bold px-4 py-2 rounded-xl shadow-lg border border-red-100">
          데이터를 불러오지 못했습니다.
        </div>
      )}

      <MapContainer 
        restaurants={restaurants} 
        onBoundsChange={updateBounds} 
      />
    </main>
  );
}
