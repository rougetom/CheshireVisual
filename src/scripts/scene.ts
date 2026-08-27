// Per-scene full-bleed clips, each scrubbed from that scene's own scroll
// range. The playhead is tied to scroll but eased (and Lenis coasts the
// scroller) so lifting off the wheel doesn't freeze the frame.

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

interface SceneRefs {
  el: HTMLElement;
  inner: HTMLElement;
  stage: HTMLElement;
  video: HTMLVideoElement | null;
}

interface Scrubber {
  video: HTMLVideoElement;
  desired: number;
  display: number;
  seeking: boolean;
  watchdog: number;
}

const LANDING_P = 0.4;
// Crossfade window as a fraction of the frame. Wide enough that both clips
// overlap, short enough that we don't sit on a long mix.
const CROSSFADE = 0.6;
const MAX_BLUR = 20;
// Copy holds until this scene starts to yield the frame.
const COPY_HOLD = 0.88;
const COPY_FADE = 0.1;
// Seconds to cover ~63% of the remaining playhead error. Higher = more
// coast after the wheel stops; still pulled toward the scroll mapping.
const PLAYHEAD_TAU = 0.28;

const ease = (t: number) => t * t * (3 - 2 * t);

const scroller = document.getElementById('siteScroll');
const content = document.getElementById('siteScrollInner');
const sceneEls = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scenes: SceneRefs[] = sceneEls.map((el) => ({
  el,
  inner: el.querySelector<HTMLElement>('.stage-inner')!,
  stage: el.querySelector<HTMLElement>('.stage')!,
  video: document.querySelector<HTMLVideoElement>(`[data-scene-video="${el.id}"]`),
}));

const offsetInScroller = (target: HTMLElement) => {
  if (!scroller) return 0;
  const sRect = scroller.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  return scroller.scrollTop + (tRect.top - sRect.top);
};

let lenis: Lenis | null = null;

if (scroller) {
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement)?.closest('a[href^="#"]');
    if (!link) return;

    const id = link.getAttribute('href')!.slice(1);
    const target = document.getElementById(id);
    if (!target || !target.hasAttribute('data-scene')) return;

    event.preventDefault();
    const isFirst = sceneEls[0] === target;
    const range = target.offsetHeight - scroller.clientHeight;
    const top = isFirst ? 0 : offsetInScroller(target) + LANDING_P * Math.max(range, 0);

    if (lenis && !reduceMotion) {
      lenis.scrollTo(top, { duration: 1.15 });
    } else {
      scroller.scrollTo({ top, behavior: reduceMotion ? 'instant' : 'smooth' });
    }
  });
}

if (scroller && sceneEls.length) {
  const fadeScenes = () => {
    const viewRect = scroller.getBoundingClientRect();
    const viewportH = viewRect.height;
    const progresses: number[] = [];

    scenes.forEach(({ el, inner, stage, video }, i) => {
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - viewportH;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));
      progresses.push(p);

      const stageRect = stage.getBoundingClientRect();
      const visible =
        Math.min(stageRect.bottom, viewRect.bottom) - Math.max(stageRect.top, viewRect.top);
      const coverage = Math.min(1, Math.max(0, visible / Math.max(viewportH, 1)));

      const t = coverage <= 0 ? 0 : coverage >= CROSSFADE ? 1 : ease(coverage / CROSSFADE);
      const videoOpacity = t;
      const blur = (1 - t) * MAX_BLUR;

      let copyOpacity: number;
      if (coverage >= COPY_HOLD) {
        copyOpacity = 1;
      } else if (coverage <= COPY_HOLD - COPY_FADE) {
        copyOpacity = 0;
      } else {
        copyOpacity = ease((coverage - (COPY_HOLD - COPY_FADE)) / COPY_FADE);
      }

      inner.style.opacity = String(copyOpacity);
      if (video) {
        video.style.opacity = String(videoOpacity);
        video.style.filter = t <= 0 || t >= 1 ? 'none' : `blur(${blur.toFixed(2)}px)`;
      }

      // Start fetching the next clip before it covers this one.
      if (p > 0.55) {
        const next = scenes[i + 1]?.video;
        if (next && next.preload !== 'auto') {
          next.preload = 'auto';
        }
      }
    });

    return progresses;
  };

  if (reduceMotion) {
    scenes.forEach(({ inner, video }) => {
      inner.style.opacity = '1';
      if (video) {
        video.style.opacity = '1';
        video.style.filter = 'none';
        video.play().catch(() => {});
      }
    });
  } else {
    const scrubbers: Scrubber[] = scenes.flatMap(({ video }) =>
      video
        ? [
            {
              video,
              desired: 0,
              display: 0,
              seeking: false,
              watchdog: 0,
            },
          ]
        : [],
    );

    const scrubberFor = (video: HTMLVideoElement | null) =>
      video ? scrubbers.find((s) => s.video === video) : undefined;

    const flushSeek = (s: Scrubber) => {
      const { video } = s;
      if (!video.duration) return;
      const next = Math.min(Math.max(s.display, 0), Math.max(video.duration - 0.05, 0));
      if (Math.abs(video.currentTime - next) < 0.03) {
        s.seeking = false;
        return;
      }
      if (s.seeking) return;
      s.seeking = true;
      video.currentTime = next;
      window.clearTimeout(s.watchdog);
      s.watchdog = window.setTimeout(() => {
        s.seeking = false;
        flushSeek(s);
      }, 160);
    };

    scrubbers.forEach((s) => {
      s.video.addEventListener('seeked', () => {
        s.seeking = false;
        window.clearTimeout(s.watchdog);
        flushSeek(s);
      });
    });

    const prime = (video: HTMLVideoElement) => {
      const play = video.play();
      if (play) {
        play.then(() => video.pause()).catch(() => {});
      }
    };

    scenes.forEach(({ video }, i) => {
      if (!video) return;
      if (i === 0) {
        if (video.readyState >= 1) prime(video);
        else video.addEventListener('loadedmetadata', () => prime(video), { once: true });
      } else {
        video.addEventListener('loadeddata', () => prime(video), { once: true });
      }
    });

    if (content) {
      lenis = new Lenis({
        wrapper: scroller,
        content,
        eventsTarget: scroller,
        autoRaf: false,
        lerp: 0.075,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.15,
        smoothWheel: true,
      });
    }

    let lastTs = performance.now();

    const tick = (time: number) => {
      const dt = Math.min(0.05, (time - lastTs) / 1000);
      lastTs = time;
      lenis?.raf(time);

      const progresses = fadeScenes();
      const k = 1 - Math.exp(-dt / PLAYHEAD_TAU);

      scenes.forEach(({ video }, i) => {
        const s = scrubberFor(video);
        if (!s || !video?.duration) return;
        s.desired = progresses[i] * video.duration;
        s.display += (s.desired - s.display) * k;
        flushSeek(s);
      });

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
