export interface Landmark {
  name: string;
  aliases: string[];
  situation: string[];
  radius: number;
  lat: number;
  lng: number;
}
export const LANDMARKS: Landmark[];
export function nearbyLandmarkTags(lat: number | null | undefined, lng: number | null | undefined): string[];
