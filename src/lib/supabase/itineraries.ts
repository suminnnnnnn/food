import { supabase } from './client';
import { Itinerary } from '@/types';

const LOCAL_STORAGE_KEY = 'user_itineraries';

// LocalStorage 헬퍼
export function getLocalItineraries(): Itinerary[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading local itineraries:', e);
    return [];
  }
}

export function saveLocalItinerary(itinerary: Itinerary): Itinerary[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = getLocalItineraries();
    const index = list.findIndex(item => item.id === itinerary.id);
    
    if (index >= 0) {
      list[index] = itinerary; // 업데이트
    } else {
      list.unshift(itinerary); // 새로 추가
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Error saving local itinerary:', e);
    return [];
  }
}

export function deleteLocalItinerary(id: string): Itinerary[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = getLocalItineraries();
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (e) {
    console.error('Error deleting local itinerary:', e);
    return [];
  }
}

// Supabase DB 연동 헬퍼 (로그인 유저용)
export async function getItinerariesFromServer(userId: string): Promise<Itinerary[]> {
  try {
    const { data, error } = await supabase
      .from('user_itineraries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as Itinerary[];
  } catch (e) {
    console.error('Error getting itineraries from server:', e);
    return [];
  }
}

export async function saveItineraryToServer(userId: string, itinerary: Itinerary): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_itineraries')
      .upsert({
        id: itinerary.id,
        user_id: userId,
        title: itinerary.title,
        days: itinerary.days,
        created_at: itinerary.created_at,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (e) {
    console.error('Error saving itinerary to server:', e);
    throw e;
  }
}

export async function deleteItineraryFromServer(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_itineraries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (e) {
    console.error('Error deleting itinerary from server:', e);
    throw e;
  }
}
