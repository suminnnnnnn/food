export type ContentSource = "youtube" | "ddoganjib" | "meogeultende" | "michelin" | "blueribbon" | "netflix_chef" | "tv_broadcast" | "default";

export interface Youtuber {
  id: string;
  name: string;
  profile_image: string;
  channel_url: string;
  subscriber_count?: number | null;
}

// 영상 멀티모달 분석(Gemini) 결과 — 유튜버가 영상에서 먹고 추천한 것 기반
export interface VideoPick {
  name: string;
  price?: string | null;      // 화면/음성에 실제 나온 가격만
  ate?: boolean;              // 유튜버가 실제 먹음
  price_source?: 'onscreen' | 'spoken' | 'none';
}
export interface VideoScene {
  ts: string;                // "mm:ss"
  desc: string;
}
export interface VideoInsights {
  picks?: VideoPick[];
  tips?: string[];           // 이용/주문 꿀팁
  signature?: string | null; // 시그니처/유명한 이유
  mood_tags?: string[];
  best_food_scenes?: VideoScene[];
  match_confidence?: number;
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
  ai_insights?: VideoInsights | null; // 영상 멀티모달 분석 결과
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
  tags?: string[]; // 검색용 태그 (지역/방송/음식/상황 변형) — 발견용, 표시 안 함
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
