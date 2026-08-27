// Attaches every [data-scene] video's HLS stream (Bunny CDN) to its
// <video> element. Native <video> only understands HLS in Safari — every
// other browser needs hls.js to demux/feed it through the Media Source
// Extensions API. Either way the result is a normal HTMLVideoElement with
// a working .currentTime, so scene.ts's scroll-scrub logic downstream
// doesn't need to know or care which path a given browser took.
//
// hls.js is dynamically imported rather than a static import so it's a
// separate, lazily-fetched chunk — Safari never needs it at all (it takes
// the native branch below), and every other browser only pays for it once,
// off the critical path rather than bundled into the main script.

const videos = document.querySelectorAll<HTMLVideoElement>('[data-scene] video[data-hls-src]');
const nativeVideos: HTMLVideoElement[] = [];
const jsVideos: HTMLVideoElement[] = [];

videos.forEach((video) => {
  if (!video.dataset.hlsSrc) return;
  // Safari: native HLS support is more capable/efficient than hls.js
  // here, so hls.js explicitly recommends not using itself on Safari.
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    nativeVideos.push(video);
  } else {
    jsVideos.push(video);
  }
});

nativeVideos.forEach((video) => {
  video.src = video.dataset.hlsSrc!;
});

if (jsVideos.length) {
  import('hls.js').then(({ default: Hls }) => {
    if (!Hls.isSupported()) return;
    jsVideos.forEach((video) => {
      const hls = new Hls();
      hls.loadSource(video.dataset.hlsSrc!);
      hls.attachMedia(video);
    });
  });
}
