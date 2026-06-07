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
      id, kakao_place_id, name, category, address, road_address, lat, lng, phone, parking, packaging, reservation, business_hours, menu_info,
      restaurant_videos (
        quote, mention_time, keywords,
        videos (
          id, youtube_video_id, title, thumbnail_url, is_short, view_count, published_at,
          channels ( id, name, profile_image_url, youtube_channel_id ),
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
      name: row.name,
      category: row.category || '',
      address: row.road_address || row.address || '',
      lat: row.lat,
      lng: row.lng,
      videos,
      content_tags,
      phone: row.phone || '',
      parking: row.parking || '',
      packaging: row.packaging || '',
      reservation: row.reservation || '',
      business_hours: row.business_hours || '',
      menu_info: row.menu_info || '',
    };
  });
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      id, kakao_place_id, name, category, address, road_address, lat, lng, phone, parking, packaging, reservation, business_hours, menu_info,
      restaurant_videos (
        quote, mention_time, keywords,
        videos (
          id, youtube_video_id, title, thumbnail_url, is_short, view_count, published_at,
          channels ( id, name, profile_image_url, youtube_channel_id ),
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
    name: data.name,
    category: data.category || '',
    address: data.road_address || data.address || '',
    lat: data.lat,
    lng: data.lng,
    videos,
    content_tags,
    phone: data.phone || '',
    parking: data.parking || '',
    packaging: data.packaging || '',
    reservation: data.reservation || '',
    business_hours: data.business_hours || '',
    menu_info: data.menu_info || '',
  };
}

export async function getRestaurantsByIds(ids: string[]): Promise<Restaurant[]> {
  if (!ids || ids.length === 0) return [];
  
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      id, kakao_place_id, name, category, address, road_address, lat, lng, phone, parking, packaging, reservation, business_hours, menu_info,
      restaurant_videos (
        quote, mention_time, keywords,
        videos (
          id, youtube_video_id, title, thumbnail_url, is_short, view_count, published_at,
          channels ( id, name, profile_image_url, youtube_channel_id ),
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
        youtuber: {
          id: c?.id || '',
          name: c?.name || 'Unknown',
          profile_image: c?.profile_image_url || '',
          channel_url: c?.youtube_channel_id ? 'https://youtube.com/channel/' + c.youtube_channel_id : ''
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
      name: row.name,
      category: row.category || '',
      address: row.road_address || row.address || '',
      lat: row.lat,
      lng: row.lng,
      videos,
      content_tags,
      phone: row.phone || '',
      parking: row.parking || '',
      packaging: row.packaging || '',
      reservation: row.reservation || '',
      business_hours: row.business_hours || '',
      menu_info: row.menu_info || '',
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
