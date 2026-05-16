import { useState, useEffect } from 'react';
import { Restaurant } from '@/types';
import { MapBounds } from './useMapBounds';
import { getRestaurantsInBounds } from '@/lib/supabase/restaurants';

export function useRestaurants(bounds: MapBounds | null) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!bounds) return;

    let isMounted = true;
    setLoading(true);

    const fetchRestaurants = async () => {
      try {
        const { swLat, swLng, neLat, neLng } = bounds;
        const data = await getRestaurantsInBounds(swLat, swLng, neLat, neLng);
        
        if (isMounted) {
          setRestaurants(data || []);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err);
          setRestaurants([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRestaurants();

    return () => {
      isMounted = false;
    };
  }, [bounds]);

  return { restaurants, loading, error };
}
