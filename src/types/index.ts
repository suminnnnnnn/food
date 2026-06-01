export type ContentSource = "youtube" | "ddoganjib" | "meogeultende" | "michelin" | "blueribbon" | "netflix_chef" | "tv_broadcast" | "default";

export interface Youtuber {
  id: string;
  name: string;
  profile_image: string;
  channel_url: string;
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
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  videos: Video[];
  primary_video?: Video;
  content_tags: ContentTag[];
  is_trending?: boolean;
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
}


