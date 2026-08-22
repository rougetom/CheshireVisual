// Drives the fixed video backdrop (BackgroundVideo.astro): watches every
// `[data-shot]` section and crossfades the backdrop's grade/scrim tint to
// match whichever section currently has the most viewport overlap.
//
// The <video> itself only reloads when a section's `data-video` actually
// differs from what's playing. Every section points at the same clip today,
// so in practice the video just keeps playing uninterrupted and only the
// tint changes. Once real per-section footage exists, give each section its
// own `data-video` — this will start hard-cutting to the new clip on swap;
// upgrade to a second <video> layer here for a true crossfade at that point.

interface Shot {
  grade: string;
  scrim: string;
  anim: 'kb' | 'kb2';
  video: string;
}

const root = document.getElementById('bgVideo');
const sections = document.querySelectorAll<HTMLElement>('[data-shot]');

if (root && sections.length) {
  const gradeLayers = Array.from(root.querySelectorAll<HTMLElement>('.grade'));
  const scrimLayers = Array.from(root.querySelectorAll<HTMLElement>('.scrim'));
  const video = root.querySelector<HTMLVideoElement>('.footage');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const readShot = (el: HTMLElement): Shot => ({
    grade: el.dataset.grade ?? '',
    scrim: el.dataset.scrim ?? '',
    anim: (el.dataset.anim as Shot['anim']) ?? 'kb',
    video: el.dataset.video ?? '',
  });

  // Layer 0 (grade/scrim) is already showing the hero's shot server-side.
  let activeLayer = 0;
  let currentVideoSrc = sections[0].dataset.video ?? '';
  let current: Element = sections[0];

  const showShot = (shot: Shot) => {
    const next = activeLayer === 0 ? 1 : 0;
    const grade = gradeLayers[next];
    const scrim = scrimLayers[next];

    if (grade) {
      grade.style.background = shot.grade;
      grade.classList.remove('kb', 'kb2');
      grade.classList.add(shot.anim);
    }
    if (scrim) scrim.style.background = shot.scrim;

    gradeLayers[activeLayer]?.classList.remove('is-active');
    scrimLayers[activeLayer]?.classList.remove('is-active');
    grade?.classList.add('is-active');
    scrim?.classList.add('is-active');
    activeLayer = next;

    if (video && shot.video && shot.video !== currentVideoSrc) {
      currentVideoSrc = shot.video;
      video.src = shot.video;
      if (!reduceMotion) video.play().catch(() => {});
    }
  };

  // Track every section's intersection ratio and act on whichever is
  // currently dominant — IntersectionObserver only reports entries whose
  // ratio changed since the last callback, so the running map is needed to
  // compare against sections that didn't change this time.
  const ratios = new Map<Element, number>();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio));

      let bestEl: Element | null = null;
      let bestRatio = 0;
      ratios.forEach((ratio, el) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestEl = el;
        }
      });

      if (bestEl && bestEl !== current && bestRatio > 0.1) {
        current = bestEl;
        showShot(readShot(bestEl as HTMLElement));
      }
    },
    { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
  );

  sections.forEach((el) => observer.observe(el));
}
