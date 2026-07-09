import { supabase } from './client';
import { UserFolder, FolderMember, FolderRestaurantRelation, Restaurant, Video, ContentTag } from '@/types';

const LOCAL_FOLDERS_KEY = 'modoo-matjip-local-folders';
const LOCAL_RELATIONS_KEY = 'modoo-matjip-local-relations';

function getLocalFolders(): UserFolder[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = window.localStorage.getItem(LOCAL_FOLDERS_KEY);
    if (data) return JSON.parse(data);
    
    // 기본 폴더 생성
    const defaultFolder: UserFolder = {
      id: 'local-default-folder',
      name: '내 저장',
      emoji: '⭐',
      color: '#ef4444',
      creator_id: 'local-user',
      is_collaborative: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    window.localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify([defaultFolder]));
    return [defaultFolder];
  } catch (e) {
    console.error('Error reading local folders:', e);
    return [];
  }
}

function saveLocalFolders(folders: UserFolder[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
  } catch (e) {
    console.error('Error saving local folders:', e);
  }
}

function getLocalRelations(): FolderRestaurantRelation[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = window.localStorage.getItem(LOCAL_RELATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading local relations:', e);
    return [];
  }
}

function saveLocalRelations(relations: FolderRestaurantRelation[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_RELATIONS_KEY, JSON.stringify(relations));
  } catch (e) {
    console.error('Error saving local relations:', e);
  }
}

export async function getAllUserFolderRelations(): Promise<FolderRestaurantRelation[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return getLocalRelations();
    }

    const { data, error } = await supabase
      .from('folder_restaurants')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('getAllUserFolderRelations failed, falling back to local storage:', err);
    return getLocalRelations();
  }
}

// ------------------------------------------------------------
// 1. Folder CRUD
// ------------------------------------------------------------

export async function getUserFolders(): Promise<UserFolder[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return getLocalFolders();
    }

    const { data, error } = await supabase
      .from('user_folders')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('getUserFolders failed, falling back to local storage:', err);
    return getLocalFolders();
  }
}

// 사용자의 기본 저장 폴더를 보장(없으면 생성). 단일 리스트 모델의 진입점.
export async function getOrCreateDefaultFolder(): Promise<UserFolder> {
  try {
    const folders = await getUserFolders();
    if (folders.length > 0) return folders[0];
    return createFolder('내 저장', '⭐', '#ef4444', false);
  } catch (err) {
    console.warn('getOrCreateDefaultFolder failed, falling back to local default:', err);
    const localFolders = getLocalFolders();
    if (localFolders.length > 0) return localFolders[0];
    
    const defaultFolder: UserFolder = {
      id: 'local-default-folder',
      name: '내 저장',
      emoji: '⭐',
      color: '#ef4444',
      creator_id: 'local-user',
      is_collaborative: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return defaultFolder;
  }
}

export async function createFolder(
  name: string,
  emoji: string = '⭐',
  color: string = '#ff6b00',
  isCollaborative: boolean = false
): Promise<UserFolder> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .from('user_folders')
      .insert({
        name,
        emoji,
        color,
        creator_id: user.id,
        is_collaborative: isCollaborative
      })
      .select()
      .single();

    if (error) throw error;

    // If collaborative, add the creator as owner in folder_members
    if (isCollaborative && data) {
      await supabase.from('folder_members').insert({
        folder_id: data.id,
        user_id: user.id,
        role: 'owner'
      });
    }

    return data;
  } catch (err) {
    console.warn('createFolder failed, falling back to local storage:', err);
    const localFolders = getLocalFolders();
    const newFolder: UserFolder = {
      id: 'local-folder-' + Math.random().toString(36).substr(2, 9),
      name,
      emoji,
      color,
      creator_id: 'local-user',
      is_collaborative: isCollaborative,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    localFolders.push(newFolder);
    saveLocalFolders(localFolders);
    return newFolder;
  }
}

export async function updateFolder(
  folderId: string,
  updates: Partial<Pick<UserFolder, 'name' | 'emoji' | 'color' | 'is_collaborative'>>
): Promise<UserFolder> {
  try {
    const { data, error } = await supabase
      .from('user_folders')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', folderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('updateFolder failed, falling back to local storage:', err);
    const localFolders = getLocalFolders();
    const index = localFolders.findIndex(f => f.id === folderId);
    if (index >= 0) {
      const updated = {
        ...localFolders[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      localFolders[index] = updated;
      saveLocalFolders(localFolders);
      return updated;
    }
    throw new Error('Folder not found in local storage');
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_folders')
      .delete()
      .eq('id', folderId);

    if (error) throw error;
  } catch (err) {
    console.warn('deleteFolder failed, falling back to local storage:', err);
    const localFolders = getLocalFolders();
    const filteredFolders = localFolders.filter(f => f.id !== folderId);
    saveLocalFolders(filteredFolders);

    const localRelations = getLocalRelations();
    const filteredRelations = localRelations.filter(r => r.folder_id !== folderId);
    saveLocalRelations(filteredRelations);
  }
}

// ------------------------------------------------------------
// 2. Folder Collaborative Members
// ------------------------------------------------------------

export async function getFolderMembers(folderId: string): Promise<FolderMember[]> {
  try {
    const { data, error } = await supabase
      .from('folder_members')
      .select(`
        folder_id, user_id, role, created_at,
        users ( nickname, avatar_url )
      `)
      .eq('folder_id', folderId);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      folder_id: row.folder_id,
      user_id: row.user_id,
      role: row.role,
      created_at: row.created_at,
      nickname: row.users?.nickname || '닉네임 없음',
      avatar_url: row.users?.avatar_url || ''
    }));
  } catch (err) {
    console.warn('getFolderMembers failed, returning empty:', err);
    return [];
  }
}

export async function addFolderMemberByEmail(folderId: string, email: string): Promise<void> {
  try {
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('nickname', email.trim())
      .single();

    if (userError || !userProfile) {
      throw new Error('해당 닉네임을 가진 사용자를 찾을 수 없습니다.');
    }

    const { error } = await supabase
      .from('folder_members')
      .insert({
        folder_id: folderId,
        user_id: userProfile.id,
        role: 'editor'
      });

    if (error) {
      console.error('Error adding folder member:', error);
      throw new Error('멤버를 추가하는 데 실패했습니다. 이미 등록된 멤버일 수 있습니다.');
    }
  } catch (err: any) {
    console.warn('addFolderMemberByEmail failed:', err);
    throw err;
  }
}

export async function removeFolderMember(folderId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('folder_members')
      .delete()
      .eq('folder_id', folderId)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (err) {
    console.warn('removeFolderMember failed:', err);
    throw err;
  }
}

// ------------------------------------------------------------
// 3. Folder Restaurant Mapping CRUD
// ------------------------------------------------------------

export async function addRestaurantToFolder(
  folderId: string,
  restaurantId: string,
  memo: string = '',
  tags: string[] = []
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { error } = await supabase
      .from('folder_restaurants')
      .insert({
        folder_id: folderId,
        restaurant_id: restaurantId,
        user_id: user.id,
        memo,
        tags,
        visited: false,
        visit_count: 0
      });

    if (error) throw error;
  } catch (err) {
    console.warn('addRestaurantToFolder failed, falling back to local storage:', err);
    const localRelations = getLocalRelations();
    const exists = localRelations.some(r => r.folder_id === folderId && r.restaurant_id === restaurantId);
    if (!exists) {
      const newRelation: FolderRestaurantRelation = {
        folder_id: folderId,
        restaurant_id: restaurantId,
        user_id: 'local-user',
        memo,
        tags,
        visited: false,
        visit_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      localRelations.push(newRelation);
      saveLocalRelations(localRelations);
    }
  }
}

export async function updateFolderRestaurantRelation(
  folderId: string,
  restaurantId: string,
  updates: Partial<Pick<FolderRestaurantRelation, 'memo' | 'visited' | 'visit_count' | 'tags' | 'rating'>>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('folder_restaurants')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('folder_id', folderId)
      .eq('restaurant_id', restaurantId);

    if (error) throw error;
  } catch (err) {
    console.warn('updateFolderRestaurantRelation failed, falling back to local storage:', err);
    const localRelations = getLocalRelations();
    const index = localRelations.findIndex(r => r.folder_id === folderId && r.restaurant_id === restaurantId);
    if (index >= 0) {
      localRelations[index] = {
        ...localRelations[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      saveLocalRelations(localRelations);
    }
  }
}

export async function removeRestaurantFromFolder(folderId: string, restaurantId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('folder_restaurants')
      .delete()
      .eq('folder_id', folderId)
      .eq('restaurant_id', restaurantId);

    if (error) throw error;
  } catch (err) {
    console.warn('removeRestaurantFromFolder failed, falling back to local storage:', err);
    const localRelations = getLocalRelations();
    const filtered = localRelations.filter(r => !(r.folder_id === folderId && r.restaurant_id === restaurantId));
    saveLocalRelations(filtered);
  }
}

export async function getFolderRestaurants(
  folderId: string
): Promise<(Restaurant & { folder_relation: FolderRestaurantRelation })[]> {
  try {
    // 로컬 폴더 ID인 경우 로컬 스토리지에서 먼저 매핑 관계를 조회
    if (folderId.startsWith('local-')) {
      const localRelations = getLocalRelations().filter(r => r.folder_id === folderId);
      if (localRelations.length === 0) return [];
      const restaurantIds = localRelations.map(r => r.restaurant_id);

      // Supabase에서 해당 맛집 정보 일괄 조회 (restaurants는 퍼블릭 테이블)
      const { data: restaurantData, error: dbError } = await supabase
        .from('restaurants')
        .select(`
          id, kakao_place_id, name, category, address, road_address, lat, lng, phone, parking, packaging, reservation, business_hours, menu_info, description_summary,
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
        .in('id', restaurantIds);

      if (dbError) throw dbError;
      if (!restaurantData) return [];

      return restaurantData.map((r: any) => {
        const relation = localRelations.find(lr => lr.restaurant_id === r.id);
        
        const videos: Video[] = r.restaurant_videos?.map((rv: any) => {
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

        const content_tags: ContentTag[] = [];
        r.restaurant_curations?.forEach((rc: any) => {
          if (rc.curation_sources) {
            content_tags.push({
              source: rc.curation_sources.code,
              label: rc.metadata?.label || rc.curation_sources.name,
              year: rc.metadata?.year
            });
          }
        });

        r.restaurant_videos?.forEach((rv: any) => {
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
          }
        });

        const primary_video = videos.length > 0 ? videos[0] : undefined;

        const restaurantObj: Restaurant = {
          id: r.id,
          kakao_place_id: r.kakao_place_id,
          name: r.name,
          category: r.category,
          address: r.address,
          road_address: r.road_address,
          lat: r.lat,
          lng: r.lng,
          phone: r.phone,
          parking: r.parking,
          packaging: r.packaging,
          reservation: r.reservation,
          business_hours: r.business_hours,
          menu_info: r.menu_info,
          description_summary: r.description_summary,
          videos,
          primary_video,
          content_tags
        };

        const folder_relation: FolderRestaurantRelation = {
          folder_id: folderId,
          restaurant_id: r.id,
          user_id: relation?.user_id || 'local-user',
          memo: relation?.memo || '',
          visited: relation?.visited || false,
          visit_count: relation?.visit_count || 0,
          tags: relation?.tags || [],
          rating: relation?.rating ?? null,
          created_at: relation?.created_at || new Date().toISOString(),
          updated_at: relation?.updated_at || new Date().toISOString()
        };

        return {
          ...restaurantObj,
          folder_relation
        };
      });
    }

    const { data, error } = await supabase
      .from('folder_restaurants')
      .select(`
        folder_id, restaurant_id, user_id, memo, visited, visit_count, tags, rating, created_at, updated_at,
        restaurants (
          id, kakao_place_id, name, category, address, road_address, lat, lng, phone, parking, packaging, reservation, business_hours, menu_info, description_summary,
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
        )
      `)
      .eq('folder_id', folderId);

    if (error) throw error;
    if (!data) return [];

    return data
      .filter((row: any) => row.restaurants !== null)
      .map((row: any) => {
        const r = row.restaurants;
        const videos: Video[] = r.restaurant_videos?.map((rv: any) => {
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

        const content_tags: ContentTag[] = [];
        r.restaurant_curations?.forEach((rc: any) => {
          if (rc.curation_sources) {
            content_tags.push({
              source: rc.curation_sources.code,
              label: rc.metadata?.label || rc.curation_sources.name,
              year: rc.metadata?.year
            });
          }
        });

        r.restaurant_videos?.forEach((rv: any) => {
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
          }
        });

        const primary_video = videos.length > 0 ? videos[0] : undefined;

        const restaurantObj: Restaurant = {
          id: r.id,
          kakao_place_id: r.kakao_place_id,
          name: r.name,
          category: r.category,
          address: r.address,
          road_address: r.road_address,
          lat: r.lat,
          lng: r.lng,
          phone: r.phone,
          parking: r.parking,
          packaging: r.packaging,
          reservation: r.reservation,
          business_hours: r.business_hours,
          menu_info: r.menu_info,
          description_summary: r.description_summary,
          videos,
          primary_video,
          content_tags
        };

        const folder_relation: FolderRestaurantRelation = {
          folder_id: row.folder_id,
          restaurant_id: row.restaurant_id,
          user_id: row.user_id,
          memo: row.memo || '',
          visited: row.visited || false,
          visit_count: row.visit_count || 0,
          tags: row.tags || [],
          rating: row.rating ?? null,
          created_at: row.created_at,
          updated_at: row.updated_at
        };

        return {
          ...restaurantObj,
          folder_relation
        };
      });
  } catch (err) {
    console.warn('getFolderRestaurants failed, returning empty:', err);
    return [];
  }
}

// 사용자의 모든 폴더에 걸친 저장 맛집을 한 번에 조회 (컬렉션 홈/전체 뷰용).
// 같은 맛집이 여러 폴더에 있으면 폴더 수만큼 행이 나온다(folder_relation.folder_id로 구분).
export async function getAllSavedRestaurants(): Promise<
  (Restaurant & { folder_relation: FolderRestaurantRelation })[]
> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // 비로그인: 로컬 관계 전체를 폴더별로 로드
      const rels = getLocalRelations();
      const folderIds = Array.from(new Set(rels.map(r => r.folder_id)));
      const all: (Restaurant & { folder_relation: FolderRestaurantRelation })[] = [];
      for (const fid of folderIds) {
        const list = await getFolderRestaurants(fid);
        all.push(...list);
      }
      return all;
    }

    const { data, error } = await supabase
      .from('folder_restaurants')
      .select(`
        folder_id, restaurant_id, user_id, memo, visited, visit_count, tags, rating, created_at, updated_at,
        restaurants (
          id, kakao_place_id, name, category, address, road_address, lat, lng, phone, parking, packaging, reservation, business_hours, menu_info, description_summary,
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
        )
      `)
      .eq('user_id', user.id);

    if (error) throw error;
    if (!data) return [];

    return data
      .filter((row: any) => row.restaurants !== null)
      .map((row: any) => {
        const r = row.restaurants;
        const videos: Video[] = r.restaurant_videos?.map((rv: any) => {
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

        const content_tags: ContentTag[] = [];
        r.restaurant_curations?.forEach((rc: any) => {
          if (rc.curation_sources) {
            content_tags.push({
              source: rc.curation_sources.code,
              label: rc.metadata?.label || rc.curation_sources.name,
              year: rc.metadata?.year
            });
          }
        });
        r.restaurant_videos?.forEach((rv: any) => {
          const series = rv.videos?.series;
          if (series && series.name && !content_tags.some(t => t.label === series.name)) {
            let sourceCode = 'youtube';
            if (series.name.includes('또간집')) sourceCode = 'ddoganjib';
            else if (series.name.includes('먹을텐데')) sourceCode = 'meogeultende';
            content_tags.push({ source: sourceCode as any, label: series.name });
          }
        });

        const primary_video = videos.length > 0 ? videos[0] : undefined;

        const restaurantObj: Restaurant = {
          id: r.id,
          kakao_place_id: r.kakao_place_id,
          name: r.name,
          category: r.category,
          address: r.address,
          road_address: r.road_address,
          lat: r.lat,
          lng: r.lng,
          phone: r.phone,
          parking: r.parking,
          packaging: r.packaging,
          reservation: r.reservation,
          business_hours: r.business_hours,
          menu_info: r.menu_info,
          description_summary: r.description_summary,
          videos,
          primary_video,
          content_tags
        };

        const folder_relation: FolderRestaurantRelation = {
          folder_id: row.folder_id,
          restaurant_id: row.restaurant_id,
          user_id: row.user_id,
          memo: row.memo || '',
          visited: row.visited || false,
          visit_count: row.visit_count || 0,
          tags: row.tags || [],
          rating: row.rating ?? null,
          created_at: row.created_at,
          updated_at: row.updated_at
        };

        return { ...restaurantObj, folder_relation };
      });
  } catch (err) {
    console.warn('getAllSavedRestaurants failed, returning empty:', err);
    return [];
  }
}
