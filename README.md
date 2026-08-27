# Cheshire Visual

Marketing site for [cheshirevisual.co.uk](https://cheshirevisual.co.uk) — a drone, aerial and 360°
photography/video studio based in Cheshire, serving the North West of England.

Built with [Astro](https://astro.build) for fast, SEO-first static output. Plain black-and-white UI
chrome (white outer margin, black frame border, white nav text) around full-colour video. The page
never pans vertically — every section is a full-bleed video "scene" that fades up from black, grows
slightly and scrubs its video as you scroll, then fades back to black as the next one covers it. It
reads as moving forward through a sequence of shots on the z-axis, not scrolling down a document.

## Stack

- **Astro** — static-first rendering, minimal client JS, great Core Web Vitals out of the box.
- **@fontsource** — self-hosted Space Grotesk + Instrument Serif (no third-party font requests).
- **@astrojs/sitemap** — automatic `sitemap-index.xml` at build time.
- **hls.js** — plays the Bunny Stream HLS video source in every browser except Safari (which has
  native HLS support); lazy-loaded so non-Safari browsers only fetch it when a scene needs it.

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
                 VideoScene.astro — the shared full-bleed video "scene" wrapper (see below)
  layouts/       Layout.astro — <head>, SEO, and the site's fixed frame/scroll shell
  scripts/       hls.ts — attaches each scene's Bunny CDN HLS stream to its <video> element
                 scene.ts — drives every scene's fade/scale/video-scrub and in-page nav
  styles/        tokens.css (design tokens), global.css
```

## The frame shell

`src/layouts/Layout.astro` wraps every page in `.site-frame` — `position: fixed; inset: 12px`, a
1.5px black border, 24px border radius, `overflow: hidden` — so the whole site reads as a single
card sitting 12px in from the true (white) page edge, permanently in place. **All scrolling happens
inside `.site-scroll`** (a plain `overflow-y: auto` div filling the frame, `id="siteScroll"`), not
on `<html>`/`<body>` — `body` has `overflow: hidden` so the browser's own scrollbar never appears;
`.site-scroll` gets a thin styled one instead, and its own background is black (matching the video
scenes) rather than the frame's white.

Anything that needs to react to scrolling **must listen on `document.getElementById('siteScroll')`,
not `window`** — `window` never fires `scroll` events here, since the document itself doesn't
scroll.

`.site-frame` also carries `transform: translateZ(0)` — with no transform, any `position: fixed`
descendant (the header, the mobile nav overlay) would position itself against the raw browser
viewport and ignore the frame entirely; a transform makes an element the containing block for fixed
descendants, so they stay correctly contained within the rounded, bordered frame instead of
escaping it.

## Video scenes — the z-axis scroll

Every top-level section (`Hero`, `About`, `Services`, `UseCases`, `Clients`, `Contact`) is a
`VideoScene.astro`: a full-bleed, full-viewport video with content overlaid on it. Structurally,
each is a tall (`200vh`) wrapper (`.scene`) containing a `position: sticky; top: 0; height: 100vh`
stage, so it pins in place and fills the viewport for the length of its own scroll range, then
releases once you've scrolled past it — the classic pinned-section trick, applied to every section
rather than just the hero.

`src/scripts/scene.ts` drives all of them from one shared loop. For each scene it computes a local
progress `p` from 0 (top of that scene's own scroll range) to 1 (bottom), purely from
`getBoundingClientRect()` — independent of every other scene — and applies:

- **Opacity**: fades in over the first 14% of `p`, holds fully visible, fades out over the last 14%.
- **Scale**: grows continuously from 0.86× to 1.16× across the whole range — the "z-axis flythrough"
  feel, applied to a `.stage-inner` wrapper (not the sticky `.stage` itself, which stays untransformed
  so its `overflow: hidden` keeps correctly clipping the scaled content).
- **Video**: `video.currentTime = p * video.duration` — scrubbed directly, never autoplaying and
  never `.play()`-ed (except under `prefers-reduced-motion`, where scrubbing is meaningless and
  each video just autoplays/loops instead). `preload="auto"` on every `<video>` means the browser
  proactively buffers/decodes on its own — this is what actually gets a frame on screen before the
  first scroll, no `autoplay` attribute or `.play()` call required for that.

**The page never pans.** Because every `.stage` has an opaque background (video, or `#000` before it
loads) and stays `position: sticky`, a later scene simply paints over the one before it the instant
it starts sticking — no crossfade element needed, no z-index management. Since the outgoing scene
has already faded toward transparent/black by the time the next one arrives, and the incoming one
fades up from the sticky stage's own black background, the transition reads as "fade to black, then
fade up into the next shot" exactly as intended, for free.

One deliberate special case: the **first** scene (the hero) is what the page loads on, so it skips
the entrance fade — it's fully opaque at `p=0` (just slightly scaled down, at rest) rather than
requiring the user to scroll before it appears. Every other scene's entrance is untouched, since
their `p=0` coincides with the moment they start covering the previous scene, which is when a
fade-up-from-black reads as a transition rather than a load-time flash.

`scene.ts` also intercepts in-page `<a href="#id">` clicks (nav links, the "discuss your brief"
link, etc.): a scene's own top (`p=0`) is where it's still transparent for every scene except the
hero, so a plain browser fragment-jump would land the visitor on a black screen. Clicks are
redirected to `p≈0.4` of the target scene's range instead, where it's already fully visible.

**Every scene points at the same clip today**, streamed live from Bunny Stream as HLS rather than
served as a local file — there's only one piece of footage yet. A `VideoScene`'s `video` prop is an
`.m3u8` manifest URL (currently
`https://vz-fa5f7bf1-41c.b-cdn.net/1222f359-d210-400e-afdc-7f0222e0d18b/playlist.m3u8`), passed straight
through to the `<video>` as `data-hls-src` rather than a child `<source>`. Swapping in more footage
later is just a matter of pointing a `VideoScene`'s `video` prop at a different manifest URL; there's
no shared/crossfading state between scenes to update since each one is already independent.

`src/scripts/hls.ts` runs before `scene.ts` and attaches each `[data-hls-src]` video to its stream:

- **Safari** understands HLS natively and does it better than any JS library can, so it just gets
  `video.src = <manifest url>` directly — no library involved.
- **Every other browser** needs [`hls.js`](https://github.com/video-dev/hls.js) to demux the stream
  through Media Source Extensions. It's dynamically `import()`-ed (not a static import) so it lands
  in its own lazily-fetched chunk — Safari never downloads it, and no browser pays for it until a
  scene actually needs it.

Either path ends with a normal `HTMLVideoElement` with a working `.currentTime`, so `scene.ts`'s
scroll-scrub logic downstream doesn't need to know or care which one a given browser took.

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
