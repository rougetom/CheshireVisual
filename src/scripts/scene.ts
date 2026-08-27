// Drives the paginated video-scene experience: one step fills the screen
// at a time (every VideoScene, plus the footer as a final non-video step),
// and advancing to the next step is gated on the current step's video
// having finished playing — "scroll" is really just an advance/retreat
// gesture, not a continuous position.
//
// Progressive enhancement: without this script (or under
// prefers-reduced-motion, where it deliberately does nothing beyond
// autoplaying videos), every step's own base CSS keeps it in normal
// stacked document flow — visible, scrollable, no gating. Paginated mode
// is opt-in, switched on by setting `data-paginate="true"` on #siteScroll,
// which is what the CSS in global.css keys off of.

interface Step {
  el: HTMLElement;
  video: HTMLVideoElement | null;
  content: HTMLElement | null;
}

const CONTENT_DELAY_MS = 550; // let the video read on its own before text arrives
const TRANSITION_LOCK_MS = 1150; // must cover the CSS opacity/scale transition durations
const END_TOLERANCE_S = 0.25;
const WHEEL_DELTA_THRESHOLD = 8;
const WHEEL_COOLDOWN_MS = 250;
const SWIPE_THRESHOLD_PX = 40;

const scroller = document.getElementById('siteScroll');
const main = document.getElementById('main');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const stepEls = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'));

if (reduceMotion) {
  // No gating, no locking — just make sure every step's video is playing
  // for whoever's landed on it, since the fallback CSS shows them all.
  stepEls.forEach((el) => el.querySelector('video')?.play().catch(() => {}));
} else if (scroller && main && stepEls.length) {
  scroller.dataset.paginate = 'true';

  const steps: Step[] = stepEls.map((el) => ({
    el,
    video: el.querySelector('video'),
    content: el.querySelector<HTMLElement>('.content'),
  }));

  let activeIndex = 0;
  let transitioning = false;
  let contentTimer: ReturnType<typeof setTimeout> | null = null;

  const canAdvance = (): boolean => {
    const video = steps[activeIndex].video;
    if (!video) return true;
    if (!Number.isFinite(video.duration)) return true; // never hard-lock on a broken video
    return video.ended || video.duration - video.currentTime < END_TOLERANCE_S;
  };

  const activate = (index: number) => {
    steps.forEach((step, i) => step.el.classList.toggle('is-active', i === index));

    if (contentTimer) clearTimeout(contentTimer);
    const { video, content } = steps[index];
    content?.classList.remove('is-shown');

    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }

    contentTimer = setTimeout(() => content?.classList.add('is-shown'), CONTENT_DELAY_MS);
  };

  const goTo = (index: number) => {
    if (index < 0 || index >= steps.length || index === activeIndex || transitioning) return;
    transitioning = true;
    steps[activeIndex].video?.pause();
    activeIndex = index;
    activate(index);
    window.setTimeout(() => {
      transitioning = false;
    }, TRANSITION_LOCK_MS);
  };

  const next = () => {
    if (transitioning || !canAdvance()) return;
    goTo(activeIndex + 1);
  };

  const prev = () => {
    if (transitioning) return;
    goTo(activeIndex - 1);
  };

  let wheelCooldown = false;
  scroller.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      if (wheelCooldown || Math.abs(event.deltaY) < WHEEL_DELTA_THRESHOLD) return;
      wheelCooldown = true;
      window.setTimeout(() => {
        wheelCooldown = false;
      }, WHEEL_COOLDOWN_MS);
      if (event.deltaY > 0) next();
      else prev();
    },
    { passive: false }
  );

  let touchStartY = 0;
  scroller.addEventListener(
    'touchstart',
    (event) => {
      touchStartY = event.touches[0].clientY;
    },
    { passive: true }
  );
  scroller.addEventListener(
    'touchend',
    (event) => {
      const dy = touchStartY - event.changedTouches[0].clientY;
      if (Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
      if (dy > 0) next();
      else prev();
    },
    { passive: true }
  );

  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      prev();
    }
  });

  // In-page nav links (`href="#id"`) jump straight to a step, bypassing
  // the video-end gate — that gate is for organic forward progress, not a
  // deliberate "take me to Contact" click.
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement)?.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href')!.slice(1);
    const index = stepEls.findIndex((el) => el.id === id);
    if (index === -1) return;
    event.preventDefault();
    if (index === activeIndex) return;
    transitioning = false; // a deliberate jump always wins over an in-flight lock
    steps[activeIndex].video?.pause();
    activeIndex = index;
    activate(index);
  });

  activate(0);
}
