# Cheshire Visual

Marketing site for [cheshirevisual.co.uk](https://cheshirevisual.co.uk) — a drone, aerial and 360°
photography/video studio based in Cheshire, serving the North West of England.

Built with [Astro](https://astro.build) for fast, SEO-first static output. Plain black-and-white UI
chrome (white outer margin, black frame border, white nav text) around full-colour video. The page
never pans vertically — every section is a full-bleed video "step". Scrolling is a gesture that
advances to the next step, not a position: each step's video plays through at its own pace, content
fades in a beat after the step becomes active (so you see the shot before you read the copy), and
you can't advance to the next step until the current video has finished. It reads as moving forward
through a sequence of shots, one at a time, not scrolling down a document.

## Stack

- **Astro** — static-first rendering, minimal client JS, great Core Web Vitals out of the box.
- **@fontsource** — self-hosted Space Grotesk + Instrument Serif (no third-party font requests).
- **@astrojs/sitemap** — automatic `sitemap-index.xml` at build time.

## Getting started

```bash
npm install
npm run dev       # http://localhost:4321
npm run build      # astro check + production build to dist/
npm run preview    # serve the production build locally
```

## Project structure

```
src/
  components/    Section components (Header, Hero, About, Services, UseCases, Clients, Contact, Footer)
                 VideoScene.astro — the shared full-bleed video "step" wrapper (see below)
  layouts/       Layout.astro — <head>, SEO, and the site's fixed frame/scroll shell
  scripts/       scene.ts — the paginated step state machine (advance gating, content delay, nav)
  styles/        tokens.css (design tokens), global.css
public/
  videos/        section footage lives here (see below)
```

## The frame shell

`src/layouts/Layout.astro` wraps every page in `.site-frame` — `position: fixed; inset: 12px`, a
1.5px black border, 24px border radius, `overflow: hidden` — so the whole site reads as a single
card sitting 12px in from the true (white) page edge, permanently in place. **All scrolling happens
inside `.site-scroll`** (a plain `overflow-y: auto` div filling the frame, `id="siteScroll"`), not
on `<html>`/`<body>` — `body` has `overflow: hidden` so the browser's own scrollbar never appears;
`.site-scroll` gets a thin styled one instead, and its own background is black (matching the video
scenes) rather than the frame's white.

`.site-scroll` is a normal `overflow-y: auto` div by default — that's the progressive-enhancement
fallback (works with no JS, and is what stays active under `prefers-reduced-motion`): every step
just stacks in plain document flow, one viewport tall, videos autoplaying, content always visible,
free-scrollable. `src/scripts/scene.ts` opts into the paginated experience by setting
`data-paginate="true"` on `#siteScroll`, which is what every paginated-mode CSS rule (in
`global.css`) keys off — see "Video steps" below.

`.site-frame` also carries `transform: translateZ(0)` — with no transform, any `position: fixed`
descendant (the header, the mobile nav overlay) would position itself against the raw browser
viewport and ignore the frame entirely; a transform makes an element the containing block for fixed
descendants, so they stay correctly contained within the rounded, bordered frame instead of
escaping it.

## Video steps — gated pagination, not scroll-scrubbing

Every top-level section (`Hero`, `About`, `Services`, `UseCases`, `Clients`, `Contact`) is a
`VideoScene.astro` — a full-bleed, full-viewport video with content overlaid on it — and the
`Footer` is a final, video-less step of the same kind. `src/scripts/scene.ts` treats all of them
(anything with `[data-scene]`) as one ordered sequence and runs a small state machine over it:

- **One step visible at a time.** Steps are `position: absolute; inset: 0` stacked on each other
  (see the `#siteScroll[data-paginate="true"]` rules in `global.css`); only `.is-active` is opaque
  and interactive. Activating a step resets its video to `currentTime = 0` and plays it, and pauses
  whatever step was just left.
- **Advancing is gated on the video finishing.** Wheel, touch-swipe and arrow/page keys all funnel
  into `next()`/`prev()`; `next()` is a no-op unless the current step's video `ended` (or is within
  `END_TOLERANCE_S` of its duration — video-end precision is imperfect, and a video with no/broken
  duration never hard-locks the visitor). Until then, more scrolling simply does nothing — the point
  is that the video is watched, not skipped past.
- **Content arrives a beat late.** Each step's `.content` fades in `CONTENT_DELAY_MS` (550ms) after
  it becomes active, so the shot reads before the copy does, rather than both slamming in at once.
- **In-page nav links bypass the gate.** Clicking "Contact" is a deliberate jump, not organic forward
  progress, so `scene.ts` intercepts `<a href="#id">` clicks and activates that step directly
  instead of going through `next()`.

**Progressive enhancement / `prefers-reduced-motion`:** this whole system is opt-in — `scene.ts`
only sets `data-paginate="true"` (and only then do the stacking/gating CSS rules in `global.css`
apply) when JS has run and motion isn't reduced. Without JS, or with reduced motion requested, every
step just stays in the plain stacked-document-flow layout `VideoScene.astro`/`Footer.astro` define
by default: free-scrollable, all content visible, videos autoplaying without gating.

**Every step points at the same clip today** (`public/videos/hero.mp4`) — there's only one piece of
footage yet. Swapping in more is just pointing a `VideoScene`'s `video` prop at a different file; the
gating/timing logic is per-step already, nothing to update elsewhere. To add footage:

```bash
ffmpeg -i input.mov -an -vcodec libx264 -crf 23 -preset slow -vf "scale='min(1920,iw)':-2" public/videos/<name>.mp4
```

## Header

`src/components/Header.astro` is `position: fixed` (so it never occupies layout space) and stays
permanently transparent with white text — every scene beneath it is a dark video, so there's no
"solid white bar" state to flip to. A soft top-down black gradient (`::before`) keeps it legible
over bright footage without needing an opaque background block. The mobile nav's full-screen
overlay is a solid dark panel regardless, since it's meant to fully replace the view while open.

## SEO

- Single `<h1>` (hero headline); one `<h2>` per section.
- `src/components/Seo.astro` sets canonical URL, Open Graph/Twitter tags, and a `LocalBusiness` /
  `ProfessionalService` JSON-LD block (service area: Cheshire, North West England).
- `robots.txt` + auto-generated sitemap (`@astrojs/sitemap`, wired via `site` in
  `astro.config.mjs`).
- Copy in `About.astro` targets drone/aerial/360° + Cheshire/North West keywords naturally — trimmed
  down from earlier drafts so each section's text fits comfortably within one viewport at rest,
  since sections no longer scroll internally.
- **TODO before launch:** replace the placeholder email/phone in `Contact.astro` and the JSON-LD
  in `Seo.astro`, and generate a real 1200×630 `public/og-image.png` (referenced by default in
  `Seo.astro`; currently unset).
