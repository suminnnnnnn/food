export type ContentSource = "youtube" | "ddoganjib" | "meogeultende" | "michelin" | "blueribbon" | "netflix_chef" | "tv_broadcast" | "default";

export interface Youtuber {
  id: string;
  name: string;
  profile_image: string;
  channel_url: string;
  subscriber_count?: number | null;
}

export interface Video {
  id: string;
  youtube_id: string;
  thumbnail: string;
  title: string;
  published_at: string;
  view_count: number;
  youtuber: Youtuber;
  is_short?: boolean;
  keywords?: string[];
  quote?: string;
}

export interface ContentTag {
  source: ContentSource;
  label: string;
  year?: number;
}

export interface Restaurant {
  id: string;
  kakao_place_id?: string;
  name: string;
  category: string;
  address: string;
  road_address?: string;
  lat: number;
  lng: number;
  videos: Video[];
  primary_video?: Video;
  content_tags: ContentTag[];
  is_trending?: boolean;
  phone?: string;
  parking?: string;
  packaging?: string;
  reservation?: string;
  business_hours?: string;
  business_hours_source?: string | null; // 'tour'(한국관광공사) | 'user'(이용자 제보) | null
  menu_info?: string;
  description_summary?: string;
}

export interface AffiliateProduct {
  id: number | string;
  title: string;
  price: number;
  image_url: string;
  deeplink_url: string;
  keywords?: string[];
  category?: string;
}

export interface ItineraryItem {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  place_url?: string;
  is_custom_spot: boolean;
  restaurant_id?: string;
  visit_time?: string;
  memo?: string;
  budget?: number;
  status?: 'pending' | 'confirmed';
  checklist?: { text: string; done: boolean }[];
  transportType?: 'walk' | 'transit' | 'car';
  customDuration?: number;
  customTransportDetail?: string;
}

export interface DailyItinerary {
  day: number;
  items: ItineraryItem[];
}

export interface Itinerary {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  companion?: string;
  theme?: string;
  transport?: string;
  days: DailyItinerary[];
  created_at: string;
}export interface UserFolder {
  id: string;
  name: string;
  emoji: string;
  color: string;
  creator_id: string;
  is_collaborative: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolderMember {
  folder_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
  nickname?: string;
  avatar_url?: string;
}

export interface FolderRestaurantRelation {
  folder_id: string;
  restaurant_id: string;
  user_id: string;
  memo?: string;
  visited: boolean;
  visit_count: number;
  tags: string[];
  rating?: number | null; // 개인 별점 1~5 (null=미평가)
  created_at: string;
  updated_at: string;
}
