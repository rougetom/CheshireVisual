# Cheshire Visual

Marketing site for [cheshirevisual.co.uk](https://cheshirevisual.co.uk) — a drone, aerial and 360°
photography/video studio based in Cheshire, serving the North West of England.

Built with [Astro](https://astro.build) for fast, SEO-first static output. Plain black-and-white UI
chrome (white outer margin, black frame border, white nav text) around full-colour video. One
full-bleed background clip stays pinned in the frame; scroll scrubs it and fades section copy over
the top. The video never scales or moves.

## Stack

- **Astro** — static-first rendering, minimal client JS, great Core Web Vitals out of the box.
- **@fontsource** — self-hosted Space Grotesk + Instrument Serif (no third-party font requests).
- **@astrojs/sitemap** — automatic `sitemap-index.xml` at build time.
- **Bunny Stream MP4** — one native `<video>` playing a progressive H.264 file from the Stream
  pull zone (not HLS, not the iframe embed). See below for why.

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
                 BackgroundVideo.astro — the single fixed full-bleed clip
                 VideoScene.astro — sticky copy overlay for each section
  layouts/       Layout.astro — <head>, SEO, and the site's fixed frame/scroll shell
  lib/           bunny.ts — Stream pull-zone URLs (MP4 + poster)
  scripts/       scene.ts — content fade, scroll-scrub, in-page nav
  styles/        tokens.css (design tokens), global.css
wrangler.jsonc   Cloudflare Workers static-assets config (dist/, no SSR adapter)
```

## The frame shell

`src/layouts/Layout.astro` wraps every page in `.site-frame` — `position: fixed; inset: 12px`, a
1.5px black border, 24px border radius, `overflow: hidden` — so the whole site reads as a single
card sitting 12px in from the true (white) page edge, permanently in place. **All scrolling happens
inside `.site-scroll`** (a plain `overflow-y: auto` div filling the frame, `id="siteScroll"`), not
on `<html>`/`<body>` — `body` has `overflow: hidden` so the browser's own scrollbar never appears;
`.site-scroll` gets a thin styled one instead. Its background is transparent so the fixed
background video (a sibling behind it) shows through.

Anything that needs to react to scrolling **must listen on `document.getElementById('siteScroll')`,
not `window`** — `window` never fires `scroll` events here, since the document itself doesn't
scroll.

`.site-frame` also carries `transform: translateZ(0)` — with no transform, any `position: fixed`
descendant (the header, the mobile nav overlay) would position itself against the raw browser
viewport and ignore the frame entirely; a transform makes an element the containing block for fixed
descendants, so they stay correctly contained within the rounded, bordered frame instead of
escaping it.

## Background video + scroll scrubbing

There is **one** `<video>` for the whole page, rendered by `BackgroundVideo.astro` as an absolutely
positioned layer inside `.site-frame` (behind `.site-scroll`). It is `object-fit: cover`, fills the
rounded frame, and never changes size. `scene.ts` maps overall scroll progress to
`video.currentTime`, coalesced on the `seeked` event so we don't stack seeks faster than the
decoder can finish.

Every top-level section (`Hero`, `About`, `Services`, `UseCases`, `Clients`, `Contact`) is a
`VideoScene.astro`: a tall (`200vh`) wrapper containing a `position: sticky; top: 0; height: 100vh`
stage for the copy, so text stays pinned while the background clip scrubs. `scene.ts` fades each
scene's copy in over the first 14% of its local progress `p` and out over the last 14% so sections
don't stack. The first scene skips the entrance fade — it's what the page loads on.

Under `prefers-reduced-motion`, scrubbing is skipped and the video just autoplays/loops.

`scene.ts` also intercepts in-page `<a href="#id">` clicks: a scene's own top (`p=0`) is where copy
is still faded out for every scene except the hero, so a plain fragment-jump would look empty.
Clicks land at `p≈0.4` of the target scene instead.

### Why a native MP4, not Bunny's iframe or HLS

Bunny Stream exposes three ways to play a clip ([storage structure](https://bunny.net/docs/stream/storage-structure)):

| Method | URL | Use for scroll-scrubbing? |
| --- | --- | --- |
| Iframe embed | `player.mediadelivery.net/embed/{library}/{id}` | **No.** Seeks go through Player.js `postMessage` (async, not 60fps). Extra player UI/JS. |
| HLS playlist | `{zone}/{id}/playlist.m3u8` | **No.** Segmented + ABR: every `currentTime` jump may fetch a new fragment. Needs `hls.js` outside Safari. Fine for normal playback, poor for scrubbing. |
| **MP4 fallback** | `{zone}/{id}/play_{720p\|1080p}.mp4` | **Yes.** Progressive H.264, `Accept-Ranges: bytes`, `moov` at the front. Native `<video>` in every browser, no extra library. Enable **MP4 Fallback** on the Stream library (before upload) so these files exist. |

URLs live in `src/lib/bunny.ts`. The element picks 1080p above 900px and 720p otherwise, with
`thumbnail_1.jpg` as the poster. The pull zone currently **blocks empty Referer** — browser
requests are fine; bare `curl` without a `Referer` header gets 403.

Swap the clip later by changing the video id in `bunny.ts` (and confirming MP4 fallback was
enabled when that video was encoded).

## Header

`src/components/Header.astro` is `position: fixed` (so it never occupies layout space) and stays
permanently transparent with white text — the background beneath it is a dark video, so there's no
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
