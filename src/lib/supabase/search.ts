import { supabase } from './client';
import { Restaurant } from '@/types';

export async function searchRestaurantsVector(queryEmbedding: number[]): Promise<Restaurant[]> {
  // TODO: pgvector를 이용한 유사도 검색 함수 구현 (rpc 호출)
  const { data, error } = await supabase.rpc('match_restaurants', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 10,
  });

  if (error) {
    console.error('Error in vector search:', error);
    throw error;
  }

  return data as unknown as Restaurant[];
}
