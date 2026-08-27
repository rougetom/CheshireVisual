// Per-scene full-bleed clips, each scrubbed from that scene's own scroll
// range. While the wheel is moving the playhead tracks scroll; after it
// stops, leftover velocity keeps the clip playing so the frame doesn't
// freeze on a keyframe.

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
  lastDesired: number;
  display: number;
  vel: number;
  seeking: boolean;
  watchdog: number;
  playPending: boolean;
  playGen: number;
  lastProgress: number;
  lastInput: number;
}

const LANDING_P = 0.4;
// Dissolve the clip over this much of the frame as the next stage slides in.
const VIDEO_FADE = 0.08;
// Copy holds until this scene starts to yield the frame.
const COPY_HOLD = 0.88;
const COPY_FADE = 0.1;
// Track scroll speed tightly while the wheel is moving.
const VEL_ATTACK = 0.08;
// After the wheel stops, keep that speed for a beat so playback coasts.
const VEL_RELEASE = 0.55;
// Reverse / catch-up seeks ease toward the scroll mapping.
const POS_TAU = 0.4;
const PLAY_START = 0.1;
const PLAY_HOLD = 0.03;
const MIN_RATE = 0.28;
const MAX_RATE = 3.5;
// Keep the clip playing at least this long after the last scroll delta.
const COAST_HOLD = 0.7;

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

      const videoOpacity =
        coverage <= 0 ? 0 : coverage >= VIDEO_FADE ? 1 : ease(coverage / VIDEO_FADE);

      let copyOpacity: number;
      if (coverage >= COPY_HOLD) {
        copyOpacity = 1;
      } else if (coverage <= COPY_HOLD - COPY_FADE) {
        copyOpacity = 0;
      } else {
        copyOpacity = ease((coverage - (COPY_HOLD - COPY_FADE)) / COPY_FADE);
      }

      inner.style.opacity = String(copyOpacity);
      if (video) video.style.opacity = String(videoOpacity);

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
              playPending: false,
              playGen: 0,
              lastProgress: 0,
              lastInput: 0,
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

    const ensurePlay = (s: Scrubber) => {
      const { video } = s;
      if (!video.paused || s.playPending) return;
      s.playPending = true;
      s.playGen += 1;
      const gen = s.playGen;
      const play = video.play();
      if (play) {
        play
          .then(() => {
            if (s.playGen !== gen) return;
            s.playPending = false;
            // rAF owns pause. A late play() resolve must not stop a coast.
          })
          .catch(() => {
            if (s.playGen === gen) s.playPending = false;
          });
      } else {
        s.playPending = false;
      }
    };

    // Preload every clip so later scenes have duration and can scrub.
    // Only prime the hero decoder; the rAF loop starts playback for coast.
    scenes.forEach(({ video }, i) => {
      if (!video) return;
      video.preload = 'auto';
      if (video.readyState < 1) video.load();
      if (i !== 0) return;
      const s = scrubberFor(video);
      if (!s) return;
      const start = () => ensurePlay(s);
      if (video.readyState >= 1) start();
      else video.addEventListener('loadedmetadata', start, { once: true });
    });

    const unlock = () => {
      const visible = scenes.find(({ video }) => {
        if (!video) return false;
        const opacity = Number.parseFloat(video.style.opacity || '0');
        return opacity > 0.05;
      });
      const clip = visible?.video ?? scenes[0]?.video;
      if (!clip) return;
      const s = scrubberFor(clip);
      if (s) ensurePlay(s);
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });

    if (content) {
      lenis = new Lenis({
        wrapper: scroller,
        content,
        eventsTarget: scroller,
        autoRaf: false,
        lerp: 0.048,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.15,
        smoothWheel: true,
      });
    }

    let lastTs = performance.now();

    if (import.meta.env.DEV) {
      (window as unknown as { __scrub: () => unknown }).__scrub = () =>
        scrubbers.map((s) => ({
          id: s.video.dataset.sceneVideo,
          time: Number(s.video.currentTime.toFixed(3)),
          paused: s.video.paused,
          rate: Number(s.video.playbackRate.toFixed(2)),
          vel: Number(s.vel.toFixed(2)),
          desired: Number(s.desired.toFixed(3)),
        }));
    }

    const tick = (time: number) => {
      const dt = Math.min(0.05, (time - lastTs) / 1000);
      lastTs = time;
      lenis?.raf(time);

      const progresses = fadeScenes();

      scenes.forEach(({ video }, i) => {
        const s = scrubberFor(video);
        if (!s || !video?.duration) return;
        const duration = video.duration;
        const end = Math.max(duration - 0.05, 0);
        s.desired = Math.min(progresses[i] * duration, end);

        // Only snap on real teleports (in-page nav). A hero clip is ~22s, so a
        // single wheel tick can move >1.5s of video — that is still scrolling.
        if (Math.abs(progresses[i] - s.lastProgress) > 0.45) {
          s.lastProgress = progresses[i];
          s.lastDesired = s.desired;
          s.display = s.desired;
          s.vel = 0;
          s.lastInput = 0;
          if (!video.paused) video.pause();
          flushSeek(s);
          return;
        }
        s.lastProgress = progresses[i];

        const targetVel = dt > 1e-4 ? (s.desired - s.lastDesired) / dt : 0;
        s.lastDesired = s.desired;
        if (targetVel > 0.08) s.lastInput = time;
        if (targetVel < -0.08) s.lastInput = 0;
        const tau = Math.abs(targetVel) > 0.05 ? VEL_ATTACK : VEL_RELEASE;
        s.vel += (targetVel - s.vel) * (1 - Math.exp(-dt / tau));
        s.vel = Math.min(MAX_RATE, Math.max(-MAX_RATE, s.vel));

        const shown = Number.parseFloat(video.style.opacity || '0');
        const holding = !video.paused || s.playPending;
        const canPlayForward =
          video.currentTime < end - 0.02 && shown > 0.05;
        const coasting = s.lastInput > 0 && time - s.lastInput < COAST_HOLD * 1000;
        const shouldPlay =
          canPlayForward &&
          (s.vel > (holding ? PLAY_HOLD : PLAY_START) || coasting);

        // Forward: play at the decaying scroll rate so every frame is shown.
        // Seeking only hits ~1s keyframes, which looks like an instant stop.
        if (shouldPlay) {
          const lag = s.desired - video.currentTime;
          let rate = Math.min(Math.max(s.vel, MIN_RATE), MAX_RATE);
          if (lag > 0.12) rate = Math.min(Math.max(s.vel + lag * 1.8, MIN_RATE), MAX_RATE);
          if (coasting) rate = Math.max(rate, 0.85);
          video.playbackRate = rate;
          ensurePlay(s);
          if (!video.paused) {
            s.display = video.currentTime;
            return;
          }
          // play() not running yet (or blocked): keep the playhead moving.
          s.display = Math.min(Math.max(video.currentTime + s.vel * dt, 0), end);
          if (!s.playPending) flushSeek(s);
          return;
        }

        if (!video.paused) {
          video.pause();
          s.display = video.currentTime;
        }

        const reversing = s.vel < -PLAY_START;
        const behind = s.desired - s.display > 0.12 && s.vel <= PLAY_HOLD;
        if (reversing || behind) {
          s.display += (s.desired - s.display) * (1 - Math.exp(-dt / POS_TAU));
          s.display = Math.min(Math.max(s.display, 0), end);
          flushSeek(s);
        }
      });

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
