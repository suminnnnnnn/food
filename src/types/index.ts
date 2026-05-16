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
