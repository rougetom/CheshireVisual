const modal = document.getElementById('mediaModal') as HTMLDialogElement | null;
const video = document.getElementById('mediaModalVideo') as HTMLVideoElement | null;
const embed = document.getElementById('mediaModalEmbed') as HTMLIFrameElement | null;
const closeBtn = document.querySelector('[data-media-close]');

const closeModal = () => {
  if (!modal) return;
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  if (embed) {
    embed.src = '';
  }
  modal.removeAttribute('data-mode');
  if (modal.open) modal.close();
};

const openModal = (trigger: HTMLElement) => {
  if (!modal) return;

  const mode = trigger.dataset.mediaMode === 'embed' ? 'embed' : 'video';
  modal.dataset.mode = mode;

  if (mode === 'embed' && embed) {
    const src = trigger.dataset.embedSrc;
    if (!src) return;
    embed.src = src;
  } else if (video) {
    const src = trigger.dataset.videoSrc;
    if (!src) return;
    video.src = src;
    video.poster = trigger.dataset.videoPoster || '';
    void video.play().catch(() => {});
  }

  if (!modal.open) modal.showModal();
};

document.querySelectorAll<HTMLElement>('[data-media-open]').forEach((el) => {
  el.addEventListener('click', () => openModal(el));
});

closeBtn?.addEventListener('click', closeModal);

modal?.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

modal?.addEventListener('close', closeModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal?.open) closeModal();
});
