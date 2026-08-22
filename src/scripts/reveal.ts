const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const els = document.querySelectorAll<HTMLElement>('[data-reveal]');

if (reduceMotion) {
  els.forEach((el) => el.classList.add('is-visible'));
} else {
  // Above-the-fold content (the hero) plays its entrance on load rather than
  // waiting on IntersectionObserver — an element sitting near the bottom
  // edge of the viewport at load time can have zero overlap with the
  // observer's shrunk root and never "intersect" until the user scrolls,
  // even though it's already on screen.
  const loadEls = document.querySelectorAll<HTMLElement>('[data-reveal-trigger="load"]');
  const scrollEls = document.querySelectorAll<HTMLElement>(
    '[data-reveal]:not([data-reveal-trigger="load"])'
  );

  requestAnimationFrame(() => {
    loadEls.forEach((el) => el.classList.add('is-visible'));
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
  );

  scrollEls.forEach((el) => io.observe(el));
}
