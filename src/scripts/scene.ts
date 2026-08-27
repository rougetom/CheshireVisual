// Drives the page: one fixed background video, scrubbed from overall
// scroll, plus per-scene content fades. The video never scales or
// moves — it fills the frame behind everything. Each scene's local
// progress p (0 at the top of its own sticky range, 1 at the bottom)
// only fades that scene's copy in and out so sections don't stack.
//
// HLS / the Bunny iframe player are the wrong tools here: iframe
// seeks go through async postMessage, and HLS is segmented so every
// currentTime jump refetches a fragment. Native progressive MP4 with
// byte ranges is what we attach in BackgroundVideo.astro; this file
// just maps scroll → currentTime, coalesced on the seeked event so
// we never stack seeks faster than the decoder can keep up.

interface SceneRefs {
  el: HTMLElement;
  inner: HTMLElement;
}

const ENTER = 0.14;
const EXIT = 0.86;

const ease = (t: number) => t * t * (3 - 2 * t);

const scroller = document.getElementById('siteScroll');
const sceneEls = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'));
const video = document.querySelector<HTMLVideoElement>('[data-bg-video]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// In-page nav links (`href="#id"`) target a scene's id, but a scene's own
// top (p=0) is where it's still transparent for every scene except the
// first — the browser's native fragment jump would land the user on empty
// copy. Intercept these and land partway into the scene's range instead.
if (scroller) {
  const LANDING_P = 0.4;

  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement)?.closest('a[href^="#"]');
    if (!link) return;

    const id = link.getAttribute('href')!.slice(1);
    const target = document.getElementById(id);
    if (!target || !target.hasAttribute('data-scene')) return;

    event.preventDefault();
    const isFirst = sceneEls[0] === target;
    const range = target.offsetHeight - scroller.clientHeight;
    const top = isFirst ? 0 : target.offsetTop + LANDING_P * Math.max(range, 0);
    scroller.scrollTo({ top, behavior: reduceMotion ? 'instant' : 'smooth' });
  });
}

if (scroller && sceneEls.length) {
  const scenes: SceneRefs[] = sceneEls.map((el) => ({
    el,
    inner: el.querySelector<HTMLElement>('.stage-inner')!,
  }));

  const fadeScenes = () => {
    const viewportH = scroller.clientHeight;

    scenes.forEach(({ el, inner }, i) => {
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - viewportH;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));

      // The first scene is what the page loads on — fully visible at p=0.
      // Later scenes fade up as they cover the one before.
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
    });
  };

  if (reduceMotion) {
    video?.play().catch(() => {});
    scenes.forEach(({ inner }) => {
      inner.style.opacity = '1';
    });
  } else {
    let ticking = false;
    let seeking = false;
    let pendingTime: number | null = null;

    const applySeek = (time: number) => {
      if (!video || !video.duration) return;
      const next = Math.min(Math.max(time, 0), Math.max(video.duration - 0.04, 0));
      if (Math.abs(video.currentTime - next) < 0.03) return;

      if (seeking) {
        pendingTime = next;
        return;
      }

      seeking = true;
      video.currentTime = next;
    };

    video?.addEventListener('seeked', () => {
      seeking = false;
      if (pendingTime !== null) {
        const time = pendingTime;
        pendingTime = null;
        applySeek(time);
      }
    });

    const scrubVideo = () => {
      if (!video || !video.duration) return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const p = Math.min(1, Math.max(0, scroller.scrollTop / Math.max(max, 1)));
      applySeek(p * video.duration);
    };

    const update = () => {
      ticking = false;
      fadeScenes();
      scrubVideo();
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    // Unlock seeking on iOS: a muted play/pause primes the element so
    // subsequent currentTime writes actually paint a frame.
    const prime = () => {
      if (!video) return;
      const play = video.play();
      if (play) {
        play
          .then(() => {
            video.pause();
            update();
          })
          .catch(() => update());
      } else {
        update();
      }
    };

    if (video) {
      if (video.readyState >= 1) prime();
      else video.addEventListener('loadedmetadata', prime, { once: true });
    }

    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }
}
