// Drives every VideoScene: computed purely from each scene's own scroll
// position, independent of the others. For a scene's local progress p
// (0 at the top of its scroll range, 1 at the bottom):
//   - opacity fades in over the first ENTER fraction, holds, then fades
//     out over the last (1 - EXIT) fraction
//   - scale grows continuously from SCALE_FROM to SCALE_TO across the
//     whole range — the "flying toward camera" z-axis feel
//   - the scene's video is scrubbed directly to p * duration
//
// The page itself never pans: each scene is `position: sticky`, so once a
// later scene starts sticking it simply paints over the (by then
// faded-to-transparent) scene before it. That's what produces the
// fade-through-black transition — no separate crossfade element needed,
// as long as every stage has an opaque background (see VideoScene.astro).

interface SceneRefs {
  el: HTMLElement;
  inner: HTMLElement;
  video: HTMLVideoElement | null;
}

const ENTER = 0.14;
const EXIT = 0.86;
const SCALE_FROM = 0.86;
const SCALE_TO = 1.16;

const ease = (t: number) => t * t * (3 - 2 * t);

const scroller = document.getElementById('siteScroll');
const sceneEls = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// In-page nav links (`href="#id"`) target a scene's id, but a scene's own
// top (p=0) is where it's still transparent/black for every scene except
// the first — the browser's native fragment jump would land the user on a
// black screen. Intercept these and land partway into the scene's range
// instead, where it's already fully faded in.
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
    video: el.querySelector('video'),
  }));

  if (reduceMotion) {
    scenes.forEach(({ video }) => video?.play().catch(() => {}));
  } else {
    let ticking = false;

    const update = () => {
      ticking = false;
      const viewportH = scroller.clientHeight;

      scenes.forEach(({ el, inner, video }, i) => {
        const rect = el.getBoundingClientRect();
        const total = el.offsetHeight - viewportH;
        const p = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));

        // The very first scene is what the page loads on — it must be
        // fully visible at p=0 (no scroll yet), not faded out waiting for
        // an entrance that requires scrolling to trigger. Every later
        // scene's "fade up from black" entrance instead coincides with the
        // moment it starts covering the scene before it, which is what
        // makes it read as a transition rather than a load-time flash.
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

        const scale = SCALE_FROM + (SCALE_TO - SCALE_FROM) * p;

        inner.style.opacity = String(opacity);
        inner.style.transform = `scale(${scale.toFixed(4)})`;

        if (video && video.readyState >= 1 && video.duration) {
          video.currentTime = p * video.duration;
        }
      });
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }
}
