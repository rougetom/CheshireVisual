# Cheshire Visual

Marketing site for [cheshirevisual.co.uk](https://cheshirevisual.co.uk) — a drone, aerial and 360°
photography/video studio based in Cheshire, serving the North West of England.

Built with [Astro](https://astro.build) for fast, SEO-first static output. Plain black-and-white
design: white background, black type, grayscale imagery, no colour accent. The whole page sits
inside a fixed, rounded, bordered frame (see below); the hero is a full-bleed video that scrubs to
scroll position, Wolverine Worldwide–style, with the nav floating transparently over it until you
scroll past; and content fades/scales/blurs in as it scrolls into view, elsewhere in the page.

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
                 VideoPanel.astro — the reusable framed video panel (see below)
  layouts/       Layout.astro — <head>, SEO, and the site's fixed frame/scroll shell
  scripts/       reveal.ts (fly-in scroll-reveal)
  styles/        tokens.css (design tokens — plain black/white), global.css
public/
  videos/        section footage lives here (see below)
```

## The frame shell

`src/layouts/Layout.astro` wraps every page in `.site-frame` — `position: fixed; inset: 12px`, a
1.5px black border, 24px border radius, `overflow: hidden` — so the whole site reads as a single
card sitting 12px in from the true (white) page edge, permanently in place. **All scrolling happens
inside `.site-scroll`** (a plain `overflow-y: auto` div filling the frame, `id="siteScroll"`), not
on `<html>`/`<body>` — `body` has `overflow: hidden` so the browser's own scrollbar never appears;
`.site-scroll` gets a thin styled one instead.

This has one consequence worth knowing if you touch scroll-driven code: anything that needs to react
to scrolling **must listen on `document.getElementById('siteScroll')`, not `window`** — `window`
never fires `scroll` events here, since the document itself doesn't scroll. `IntersectionObserver`
doesn't need special handling (its default `root: null` still correctly clips against `.site-scroll`
as an intervening scroll container), which is why `reveal.ts` needed no changes for this.

`.site-frame` also carries `transform: translateZ(0)` — with no transform, any `position: fixed`
descendant (the header, the mobile nav overlay) would position itself against the raw browser
viewport and ignore the frame entirely; a transform makes an element the containing block for fixed
descendants, so they stay correctly contained within the rounded, bordered frame instead of
escaping it.

## Header

`src/components/Header.astro` is `position: fixed` (so it never occupies layout space — the hero's
video sits truly full-bleed at y=0 beneath it) and starts fully transparent with white text,
floating directly over the hero's video. An `IntersectionObserver` on `#hero` (rooted at
`#siteScroll`) flips `data-solid="true"` once the hero has scrolled completely out of view, at which
point it becomes a solid, blurred white bar with black text — needed once subsequent sections'
white backgrounds are behind it instead of the dark hero video. Nav links, the CTA and the mobile
menu button all use `color: inherit`/`currentColor` off `.site-header`'s own `color`, so they flip
together automatically; the mobile nav's full-screen overlay hardcodes dark text (`.primary-nav`
sets its own `color`) since its background is always solid white regardless of header state.

## Hero

`src/components/Hero.astro` is a tall (`220vh`) scene containing a `position: sticky; top: 0;
height: 100vh` stage — the video pins in place and fills the viewport while you scroll through the
scene, then releases and scrolls away normally once you're past it (the classic pinned-hero
pattern). An inline script listens for `scroll` on `#siteScroll`, computes how far through the
scene you are, and sets `video.currentTime` directly — so scrolling scrubs through the clip like a
showreel rather than it just autoplaying. The video is desaturated (`filter: grayscale(1)`) and
sits under a bottom-heavy black gradient scrim so the white headline stays legible regardless of
what's in frame.

## Video panels

`src/components/VideoPanel.astro` is the reusable **framed**, in-flow video/photo panel used inside
sections (currently just `About`) — a bordered box with corner brackets, an optional label, and the
same grayscale treatment as the hero. It's deliberately a contained panel rather than a full-bleed
backdrop, since a full-bleed dark backdrop doesn't suit a white page — only the hero (a distinct,
full-bleed treatment of its own) breaks that rule.

**Every video reference points at the same clip today** (`public/videos/hero.mp4`) — there's only
one piece of footage. To add more, drop additional files at `public/videos/<name>.mp4`:

```bash
ffmpeg -i input.mov -an -vcodec libx264 -crf 23 -preset slow -vf "scale='min(1920,iw)':-2" -movflags +faststart public/videos/<name>.mp4
```

(`-movflags +faststart` matters for the hero specifically, since it's scrubbed before fully
downloaded — harmless elsewhere.) Point the hero's `<source>` or a `VideoPanel`'s `src` prop at the
new file.

## Content fly-in

Anything marked `data-reveal` (see `src/styles/global.css`) starts translated down, scaled to 90%
and blurred, then settles to its resting position, full size and in focus — content arriving out of
the depth of the shot, like it's moving with the same camera as the background. `src/scripts/reveal.ts`
drives it two ways:

- **Scroll-triggered** (the default): an `IntersectionObserver` adds `.is-visible` the first time an
  element crosses into view (`threshold: 0.16`, `rootMargin: '0px 0px -8% 0px'`).
- **On load** (`data-reveal-trigger="load"`, used by the hero's content): reveals immediately on
  page load instead of waiting on the observer. Above-the-fold elements near the bottom of the
  viewport can end up with zero overlap against the observer's shrunk root and never "intersect"
  until the user scrolls, even though they're already on screen — the hero's copy hit exactly this,
  which is why it's load-triggered rather than scroll-triggered.

Where a section has several sibling `data-reveal` elements (or repeated ones, like the `Services`
columns or `UseCases` tiles), each component adds its own `transition-delay` stagger via
`:nth-child` in its scoped `<style>` block, so they fly in as a short cascade rather than all at
once. `prefers-reduced-motion` disables all of it — reveals apply `.is-visible`'s end state
immediately with no transition.

## SEO

- Single `<h1>` (hero headline); one `<h2>` per section.
- `src/components/Seo.astro` sets canonical URL, Open Graph/Twitter tags, and a `LocalBusiness` /
  `ProfessionalService` JSON-LD block (service area: Cheshire, North West England).
- `robots.txt` + auto-generated sitemap (`@astrojs/sitemap`, wired via `site` in
  `astro.config.mjs`).
- Copy in `About.astro` targets drone/aerial/360° + Cheshire/North West keywords naturally.
- **TODO before launch:** replace the placeholder email/phone in `Contact.astro` and the JSON-LD
  in `Seo.astro`, and generate a real 1200×630 `public/og-image.png` (referenced by default in
  `Seo.astro`; currently unset).
