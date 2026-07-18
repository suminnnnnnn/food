import { supabase } from './client';
import { Restaurant, Video, ContentTag } from '@/types';

export async function getRestaurantsInBounds(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
  includeNonRestaurants: boolean = false
): Promise<Restaurant[]> {
  let query = supabase
    .from('restaurants')
    .select(`
      id, kakao_place_id, name, category, address, road_address, lat, lng, phone, parking, packaging, reservation, business_hours, business_hours_source, menu_info, description_summary, tags, representative_video_id,
      restaurant_videos (
        quote, mention_time, keywords, ai_insights,
        videos (
          id, youtube_video_id, title, thumbnail_url, is_short, view_count, published_at,
          channels ( id, name, profile_image_url, youtube_channel_id, subscriber_count ),
          series ( id, name, host_name )
        )
      ),
      restaurant_curations (
        metadata,
        curation_sources ( id, code, name )
      )
    `)
    .gte('lat', swLat)
    .lte('lat', neLat)
    .gte('lng', swLng)
    .lte('lng', neLng);

  if (!includeNonRestaurants) {
    query = query.neq('category', '기타');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching restaurants:', error);
    throw error;
  }

  if (!data) return [];

  return data.map((row: any) => {
    // 비디오 매핑
    const videos: Video[] = row.restaurant_videos?.map((rv: any) => {
      const v = rv.videos;
      const c = v.channels;
      return {
        id: v.id,
        youtube_id: v.youtube_video_id,
        thumbnail: v.thumbnail_url || '',
        title: v.title,
        published_at: v.published_at || '',
        view_count: v.view_count || 0,
        is_short: v.is_short || false,
        keywords: rv.keywords || [],
        quote: rv.quote || '',
        ai_insights: rv.ai_insights || null,
        youtuber: {
          id: c?.id || '',
          name: c?.name || 'Unknown',
          profile_image: c?.profile_image_url || '',
          channel_url: c?.youtube_channel_id ? 'https://youtube.com/channel/' + c.youtube_channel_id : '',
          subscriber_count: c?.subscriber_count ?? null
        }
      };
    }) || [];

    // 큐레이션(미쉐린, 블루리본 등) 및 유튜브 시리즈 태그 결합
    const content_tags: ContentTag[] = [];
    
    row.restaurant_curations?.forEach((rc: any) => {
      if (rc.curation_sources) {
        content_tags.push({
          source: rc.curation_sources.code,
          label: rc.metadata?.label || rc.curation_sources.name,
          year: rc.metadata?.year
        });
      }
    });

    // 유튜브 시리즈 (또간집, 먹을텐데)를 태그로 취급할 경우 추가 (선택적)
    // 여기서는 기본적으로 curation 태그와 youtube 태그를 같이 제공.
    row.restaurant_videos?.forEach((rv: any) => {
      const series = rv.videos?.series;
      if (series && series.name) {
        // 이미 같은 라벨이 있는지 확인
        if (!content_tags.some(t => t.label === series.name)) {
          let sourceCode = 'youtube';
          if (series.name.includes('또간집')) sourceCode = 'ddoganjib';
          else if (series.name.includes('먹을텐데')) sourceCode = 'meogeultende';
          
          content_tags.push({
            source: sourceCode as any,
            label: series.name
          });
        }
      } else if (rv.videos?.channels) {
          if (!content_tags.some(t => t.source === 'youtube')) {
              content_tags.push({
                  source: 'youtube',
                  label: '유튜브 핫플'
              });
          }
      }
    });

    return {
      id: row.id,
      kakao_place_id: row.kakao_place_id,
      name: row.name,
      category: row.category || '',
      address: row.road_address || row.address || '',
      lat: row.lat,
      lng: row.lng,
      videos,
      representative_video_id: row.representative_video_id ?? null,
      content_tags,
      phone: row.phone || '',
      parking: row.parking || '',
      packaging: row.packaging || '',
      reservation: row.reservation || '',
      business_hours: row.business_hours || '',
      business_hours_source: row.business_hours_source ?? null,
      menu_info: row.menu_info || '',
      description_summary: row.description_summary || '',
      tags: Array.isArray(row.tags) ? row.tags : [],
    };
  });
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      id, kakao_place_id, name, category, address, road_address, lat, lng, phone, parking, packaging, reservation, business_hours, business_hours_source, menu_info, description_summary, tags, representative_video_id,
      restaurant_videos (
        quote, mention_time, keywords, ai_insights,
        videos (
          id, youtube_video_id, title, thumbnail_url, is_short, view_count, published_at,
          channels ( id, name, profile_image_url, youtube_channel_id, subscriber_count ),
          series ( id, name, host_name )
        )
      ),
      restaurant_curations (
        metadata,
        curation_sources ( id, code, name )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching restaurant by id:', error);
    throw error;
  }

  if (!data) return null;

  // 비디오 매핑
  const videos: Video[] = data.restaurant_videos?.map((rv: any) => {
    const v = rv.videos;
    const c = v?.channels;
    return {
      id: v?.id || '',
      youtube_id: v?.youtube_video_id || '',
      thumbnail: v?.thumbnail_url || '',
      title: v?.title || '',
      published_at: v?.published_at || '',
      view_count: v?.view_count || 0,
      is_short: v?.is_short || false,
      keywords: rv.keywords || [],
      quote: rv.quote || '',
      ai_insights: rv.ai_insights || null,
      youtuber: {
        id: c?.id || '',
        name: c?.name || 'Unknown',
        profile_image: c?.profile_image_url || '',
        channel_url: c?.youtube_channel_id ? 'https://youtube.com/channel/' + c.youtube_channel_id : ''
      }
    };
  }) || [];

  // 큐레이션(미쉐린, 블루리본 등) 및 유튜브 시리즈 태그 결합
  const content_tags: ContentTag[] = [];
  
  data.restaurant_curations?.forEach((rc: any) => {
    if (rc.curation_sources) {
      content_tags.push({
        source: rc.curation_sources.code,
        label: rc.metadata?.label || rc.curation_sources.name,
        year: rc.metadata?.year
      });
    }
  });

  data.restaurant_videos?.forEach((rv: any) => {
    const series = rv.videos?.series;
    if (series && series.name) {
      if (!content_tags.some(t => t.label === series.name)) {
        let sourceCode = 'youtube';
        if (series.name.includes('또간집')) sourceCode = 'ddoganjib';
        else if (series.name.includes('먹을텐데')) sourceCode = 'meogeultende';
        
        content_tags.push({
          source: sourceCode as any,
          label: series.name
        });
      }
    } else if (rv.videos?.channels) {
      if (!content_tags.some(t => t.source === 'youtube')) {
        content_tags.push({
          source: 'youtube',
          label: '유튜브 핫플'
        });
      }
    }
  });

  return {
    id: data.id,
    kakao_place_id: data.kakao_place_id,
    name: data.name,
    category: data.category || '',
    address: data.road_address || data.address || '',
    lat: data.lat,
    lng: data.lng,
    videos,
    representative_video_id: data.representative_video_id ?? null,
    content_tags,
    phone: data.phone || '',
    parking: data.parking || '',
    packaging: data.packaging || '',
    reservation: data.reservation || '',
    business_hours: data.business_hours || '',
    business_hours_source: data.business_hours_source ?? null,
    menu_info: data.menu_info || '',
    description_summary: data.description_summary || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}

export async function getRestaurantsByIds(ids: string[]): Promise<Restaurant[]> {
  if (!ids || ids.length === 0) return [];
  
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      id, kakao_place_id, name, category, address, road_address, lat, lng, phone, parking, packaging, reservation, business_hours, business_hours_source, menu_info, description_summary, tags, representative_video_id,
      restaurant_videos (
        quote, mention_time, keywords, ai_insights,
        videos (
          id, youtube_video_id, title, thumbnail_url, is_short, view_count, published_at,
          channels ( id, name, profile_image_url, youtube_channel_id, subscriber_count ),
          series ( id, name, host_name )
        )
      ),
      restaurant_curations (
        metadata,
        curation_sources ( id, code, name )
      )
    `)
    .in('id', ids);

  if (error) {
    console.error('Error fetching restaurants by ids:', error);
    throw error;
  }

  if (!data) return [];

  return data.map((row: any) => {
    const videos: Video[] = row.restaurant_videos?.map((rv: any) => {
      const v = rv.videos;
      const c = v?.channels;
      return {
        id: v?.id || '',
        youtube_id: v?.youtube_video_id || '',
        thumbnail: v?.thumbnail_url || '',
        title: v?.title || '',
        published_at: v?.published_at || '',
        view_count: v?.view_count || 0,
        is_short: v?.is_short || false,
        keywords: rv.keywords || [],
        ai_insights: rv.ai_insights || null,
        youtuber: {
          id: c?.id || '',
          name: c?.name || 'Unknown',
          profile_image: c?.profile_image_url || '',
          channel_url: c?.youtube_channel_id ? 'https://youtube.com/channel/' + c.youtube_channel_id : '',
          subscriber_count: c?.subscriber_count ?? null
        }
      };
    }) || [];

    const content_tags: ContentTag[] = [];
    
    row.restaurant_curations?.forEach((rc: any) => {
      if (rc.curation_sources) {
        content_tags.push({
          source: rc.curation_sources.code,
          label: rc.metadata?.label || rc.curation_sources.name,
          year: rc.metadata?.year
        });
      }
    });

    row.restaurant_videos?.forEach((rv: any) => {
      const series = rv.videos?.series;
      if (series && series.name) {
        if (!content_tags.some(t => t.label === series.name)) {
          let sourceCode = 'youtube';
          if (series.name.includes('또간집')) sourceCode = 'ddoganjib';
          else if (series.name.includes('먹을텐데')) sourceCode = 'meogeultende';
          
          content_tags.push({
            source: sourceCode as any,
            label: series.name
          });
        }
      } else if (rv.videos?.channels) {
        if (!content_tags.some(t => t.source === 'youtube')) {
          content_tags.push({
            source: 'youtube',
            label: '유튜브 핫플'
          });
        }
      }
    });

    return {
      id: row.id,
      kakao_place_id: row.kakao_place_id,
      name: row.name,
      category: row.category || '',
      address: row.road_address || row.address || '',
      lat: row.lat,
      lng: row.lng,
      videos,
      representative_video_id: row.representative_video_id ?? null,
      content_tags,
      phone: row.phone || '',
      parking: row.parking || '',
      packaging: row.packaging || '',
      reservation: row.reservation || '',
      business_hours: row.business_hours || '',
      business_hours_source: row.business_hours_source ?? null,
      menu_info: row.menu_info || '',
      description_summary: row.description_summary || '',
      tags: Array.isArray(row.tags) ? row.tags : [],
    };
  });
}

export async function getDiscoverVideos(): Promise<any[]> {
  const { data, error } = await supabase
    .from('videos')
    .select(`
      id, youtube_video_id, title, thumbnail_url, is_short, view_count, published_at,
      channels ( id, name, profile_image_url, youtube_channel_id ),
      series ( id, name, host_name ),
      restaurant_videos (
        quote, mention_time, keywords,
        restaurants ( id, name, category, road_address, address, lat, lng )
      )
    `)
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error fetching discover videos:', error);
    throw error;
  }
  return data || [];
}

/**
 * 관련 맛집 추천: 같은 크리에이터의 다른 식당 + 같은 카테고리 주변 식당
 */
export async function getRelatedRestaurants(
  restaurantId: string,
  channelIds: string[],
  category: string,
  limit: number = 6
): Promise<{ id: string; name: string; category: string; address: string; thumbnail?: string }[]> {
  const results: Map<string, { id: string; name: string; category: string; address: string; thumbnail?: string }> = new Map();

  // 1. 같은 크리에이터의 다른 식당 (채널 ID 기반)
  if (channelIds.length > 0) {
    const { data: creatorData } = await supabase
      .from('restaurant_videos')
      .select(`
        restaurants ( id, name, category, road_address, address ),
        videos!inner ( thumbnail_url, channels!inner ( id ) )
      `)
      .in('videos.channels.id', channelIds)
      .neq('restaurant_id', restaurantId)
      .limit(limit * 2);

    if (creatorData) {
      for (const rv of creatorData as any[]) {
        const r = rv.restaurants;
        if (r && !results.has(r.id)) {
          results.set(r.id, {
            id: r.id,
            name: r.name,
            category: r.category || '',
            address: r.road_address || r.address || '',
            thumbnail: rv.videos?.thumbnail_url || undefined,
          });
        }
        if (results.size >= limit) break;
      }
    }
  }

  // 2. 같은 카테고리 식당 (부족분 채우기)
  if (results.size < limit && category) {
    const { data: catData } = await supabase
      .from('restaurants')
      .select(`
        id, name, category, road_address, address,
        restaurant_videos ( videos ( thumbnail_url ) )
      `)
      .eq('category', category)
      .neq('id', restaurantId)
      .limit(limit - results.size + 2);

    if (catData) {
      for (const r of catData as any[]) {
        if (!results.has(r.id)) {
          const thumb = r.restaurant_videos?.[0]?.videos?.thumbnail_url;
          results.set(r.id, {
            id: r.id,
            name: r.name,
            category: r.category || '',
            address: r.road_address || r.address || '',
            thumbnail: thumb || undefined,
          });
        }
        if (results.size >= limit) break;
      }
    }
  }

  return Array.from(results.values()).slice(0, limit);
}
