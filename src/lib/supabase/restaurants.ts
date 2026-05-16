import { supabase } from './client';
import { Restaurant, Video, ContentTag } from '@/types';

export async function getRestaurantsInBounds(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number
): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      id, kakao_place_id, name, category, address, road_address, lat, lng,
      restaurant_videos (
        quote, mention_time,
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
    };
  });
}
