// Per-scene full-bleed clips, each scrubbed from that scene's own scroll
// range. The playhead is tied to scroll but eased (and Lenis coasts the
// scroller) so lifting off the wheel doesn't freeze the frame.

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

interface SceneRefs {
  el: HTMLElement;
  inner: HTMLElement;
  video: HTMLVideoElement | null;
}

interface Scrubber {
  video: HTMLVideoElement;
  desired: number;
  lastDesired: number;
  display: number;
  vel: number;
  seeking: boolean;
  watchdog: number;
}

const ENTER = 0.14;
const EXIT = 0.86;
const LANDING_P = 0.4;
// Velocity smoothing: last scroll speed keeps driving the playhead after
// the wheel stops. Position correction is slower so it can overshoot.
const VEL_TAU = 0.16;
const POS_TAU = 0.45;

const ease = (t: number) => t * t * (3 - 2 * t);

const scroller = document.getElementById('siteScroll');
const content = document.getElementById('siteScrollInner');
const sceneEls = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scenes: SceneRefs[] = sceneEls.map((el) => ({
  el,
  inner: el.querySelector<HTMLElement>('.stage-inner')!,
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
    const viewportH = scroller.clientHeight;
    const progresses: number[] = [];

    scenes.forEach(({ el, inner, video }, i) => {
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - viewportH;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));
      progresses.push(p);

      let opacity: number;
      if (i === 0) {
        opacity = p > EXIT ? 1 - ease((p - EXIT) / (1 - EXIT)) : 1;
      } else if (p < ENTER) {
        opacity = ease(p / ENTER);
      } else if (p > EXIT) {
        opacity = 1 - ease((p - EXIT) / (1 - EXIT));
      } else {
        opacity = 1;
      }

      inner.style.opacity = String(opacity);
      if (video) video.style.opacity = String(opacity);

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
              lastDesired: 0,
              display: 0,
              vel: 0,
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

    scenes.forEach(({ video }) => {
      if (!video) return;
      video.preload = 'auto';
      if (video.readyState < 1) video.load();
      const start = () => prime(video);
      if (video.readyState >= 1) start();
      else video.addEventListener('loadedmetadata', start, { once: true });
    });

    if (content) {
      lenis = new Lenis({
        wrapper: scroller,
        content,
        eventsTarget: scroller,
        autoRaf: false,
        lerp: 0.055,
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

      scenes.forEach(({ video }, i) => {
        const s = scrubberFor(video);
        if (!s || !video?.duration) return;
        const duration = video.duration;
        s.desired = progresses[i] * duration;
        if (Math.abs(s.desired - s.lastDesired) > 1.5) {
          s.lastDesired = s.desired;
          s.display = s.desired;
          s.vel = 0;
          flushSeek(s);
          return;
        }
        const targetVel = dt > 1e-4 ? (s.desired - s.lastDesired) / dt : 0;
        s.lastDesired = s.desired;
        const vk = 1 - Math.exp(-dt / VEL_TAU);
        const pk = 1 - Math.exp(-dt / POS_TAU);
        s.vel += (targetVel - s.vel) * vk;
        s.vel = Math.min(8, Math.max(-8, s.vel));
        s.display += s.vel * dt;
        s.display += (s.desired - s.display) * pk;
        s.display = Math.min(Math.max(s.display, 0), Math.max(duration - 0.05, 0));
        flushSeek(s);
      });

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
