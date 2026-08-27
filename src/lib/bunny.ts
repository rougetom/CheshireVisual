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

export function bunnyClip(id: string): BunnyClip {
  return {
    id,
    poster: `${ZONE}/${id}/thumbnail_1.jpg`,
    p720: `${ZONE}/${id}/play_720p.mp4`,
    p1080: `${ZONE}/${id}/play_1080p.mp4`,
  };
}

export const clips = {
  hero: bunnyClip('1222f359-d210-400e-afdc-7f0222e0d18b'),
  about: bunnyClip('42d2f657-a408-475d-b5a0-cb5eabf776a7'),
  services: bunnyClip('22069af4-c34e-4451-879e-e7a7738a730d'),
  // No dedicated clip supplied yet — own <video> so the playhead still
  // restarts with the section rather than continuing the previous one.
  'use-cases': bunnyClip('1222f359-d210-400e-afdc-7f0222e0d18b'),
  clients: bunnyClip('58d80039-fd3c-4c6c-8438-6b4cb83969f3'),
  contact: bunnyClip('f0d7ee86-1cad-44aa-a753-542d80c05d8a'),
} as const;

export type SceneId = keyof typeof clips;

export const sceneIds = Object.keys(clips) as SceneId[];
