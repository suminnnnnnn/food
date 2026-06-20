import { useState, useCallback } from 'react';

export interface MapBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export function useMapBounds() {
  const [bounds, setBounds] = useState<MapBounds | null>(null);

  const updateBounds = useCallback((newBounds: MapBounds) => {
    setBounds(newBounds);
  }, []);

  return { bounds, updateBounds };
}
