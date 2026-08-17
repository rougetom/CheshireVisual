const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const els = document.querySelectorAll<HTMLElement>('[data-reveal]');

if (reduceMotion) {
  els.forEach((el) => el.classList.add('is-visible'));
} else {
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

  els.forEach((el) => io.observe(el));
}
