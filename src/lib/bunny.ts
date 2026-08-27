// Bunny Stream pull-zone URLs for the site's background clip.
// Direct MP4 fallbacks (not the HLS playlist, not the iframe embed) —
// progressive H.264 files with a front-loaded moov atom and byte-range
// support, which is what scroll-scrubbing actually needs. See README.

const ZONE = 'https://vz-fa5f7bf1-41c.b-cdn.net';
const VIDEO = '1222f359-d210-400e-afdc-7f0222e0d18b';

export const bunnyMp4 = {
  poster: `${ZONE}/${VIDEO}/thumbnail_1.jpg`,
  p720: `${ZONE}/${VIDEO}/play_720p.mp4`,
  p1080: `${ZONE}/${VIDEO}/play_1080p.mp4`,
};
