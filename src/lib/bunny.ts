// Bunny Stream pull-zone URLs. Progressive H.264 MP4 fallbacks (not HLS,
// not the iframe embed) — byte-range + front-loaded moov, which is what
// scroll-scrubbing needs. Use the Stream play URL's video id.

const ZONE = 'https://vz-fa5f7bf1-41c.b-cdn.net';

export interface BunnyClip {
  id: string;
  poster: string;
  p720: string;
  p1080: string;
}

export function bunnyClip(id: string, poster?: string): BunnyClip {
  return {
    id,
    poster: poster ?? `${ZONE}/${id}/thumbnail_1.jpg`,
    p720: `${ZONE}/${id}/play_720p.mp4`,
    p1080: `${ZONE}/${id}/play_1080p.mp4`,
  };
}

/** Animated WebP preview thumbnail from Bunny Stream. */
export function bunnyPreview(id: string): string {
  return `${ZONE}/${id}/preview.webp`;
}

export const clips = {
  hero: bunnyClip('5a783278-f0c5-4b28-a4cf-5b69beb6e663', '/hero-lqip.jpg'),
  about: bunnyClip('22069af4-c34e-4451-879e-e7a7738a730d'),
  services: bunnyClip('42d2f657-a408-475d-b5a0-cb5eabf776a7'),
  // No dedicated clip supplied yet — own <video> so the playhead still
  // restarts with the section rather than continuing the previous one.
  'use-cases': bunnyClip('1222f359-d210-400e-afdc-7f0222e0d18b'),
  clients: bunnyClip('58d80039-fd3c-4c6c-8438-6b4cb83969f3'),
  contact: bunnyClip('f0d7ee86-1cad-44aa-a753-542d80c05d8a'),
} as const;

export type SceneId = keyof typeof clips;

export const sceneIds = Object.keys(clips) as SceneId[];
