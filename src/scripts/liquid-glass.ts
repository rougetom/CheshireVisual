const MAX_TILT = 8;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const bindGlass = (card: HTMLElement) => {
  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const py = (event.clientY - rect.top) / Math.max(rect.height, 1);

    card.style.setProperty('--lg-mx', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--lg-my', `${(py * 100).toFixed(1)}%`);
    card.style.setProperty('--lg-gloss', '0.85');

    if (!reduceMotion) {
      card.style.setProperty('--lg-rx', `${((px - 0.5) * MAX_TILT * 2).toFixed(2)}deg`);
      card.style.setProperty('--lg-ry', `${(-(py - 0.5) * MAX_TILT * 2).toFixed(2)}deg`);
    }
  });

  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--lg-gloss', '0.55');
    card.style.setProperty('--lg-rx', '0deg');
    card.style.setProperty('--lg-ry', '0deg');
  });
};

document.querySelectorAll<HTMLElement>('[data-liquid-glass]').forEach(bindGlass);
