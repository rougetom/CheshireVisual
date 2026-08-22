# Cheshire Visual

Marketing site for [cheshirevisual.co.uk](https://cheshirevisual.co.uk) — a drone, aerial and 360°
photography/video studio based in Cheshire, serving the North West of England.

Built with [Astro](https://astro.build) for fast, SEO-first static output. A single fixed video
backdrop plays behind the whole page, tinted differently per section, while each section's content
fades and flies in toward the viewer as it scrolls into view — as if it's part of the same flight.

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
                 BackgroundVideo.astro — the fixed video backdrop (see below)
  layouts/       Layout.astro — shared <head>, SEO
  scripts/       backdrop.ts (video backdrop crossfade), reveal.ts (fly-in scroll-reveal)
  styles/        tokens.css (design tokens), global.css
public/
  videos/        section background footage lives here (see below)
```

## Video backgrounds

`src/components/BackgroundVideo.astro` renders **one** `<video>`, fixed to the viewport
(`position: fixed`, z-index 0 — `main`/the footer sit at z-index 1, the header at 50), sitting
behind the entire page rather than inside any one section. Back to front, it layers:

1. A graded CSS gradient with a slow "ken burns" drift — renders immediately, zero network cost,
   and is what's visible while the video is still loading (or under `prefers-reduced-motion`,
   which hides the video entirely).
2. The `<video muted loop playsinline autoplay>` itself.
3. A dark scrim gradient (for text legibility).
4. Film-grain texture.

Every section (`Hero`, `About`, `Services`, `UseCases`, `Clients`, `Contact`) is just a
`<section data-shot data-grade="..." data-scrim="..." data-anim="kb|kb2" data-video="...">` — no
per-section backdrop markup. `src/scripts/backdrop.ts` watches every `[data-shot]` section with an
`IntersectionObserver`, and whichever has the most viewport overlap right now has its
grade/scrim/video values applied to the fixed backdrop, crossfading the two ambient tint layers
(grade has two stacked instances, scrim too — the incoming one fades in as the outgoing one fades
out). The hero's shot is also rendered server-side into the first grade/scrim layer via
`BackgroundVideo`'s props, so it's already correct before any JS runs.

**Every section points at the same clip today** (`public/videos/hero.mp4`) — only the grade/scrim
tint actually changes per section right now. The mechanism supports different footage per section
already: give a section its own `data-video`, and the backdrop script swaps the `<video>`'s `src`
to it once that section becomes dominant (skipped entirely when the target clip is unchanged, which
is why nothing reloads today). That swap is a hard cut, not a crossfade — there's only one `<video>`
element. If/when real per-shot footage lands, upgrade `backdrop.ts` to a second `<video>` layer
(mirroring how the grade/scrim pairs already crossfade) for a smooth transition between clips.

To add or replace footage:

```bash
ffmpeg -i input.mov -an -vcodec libx264 -crf 23 -preset slow -vf "scale='min(1920,iw)':-2" -movflags +faststart public/videos/<name>.mp4
```

Drop the result at `public/videos/<name>.mp4` (H.264, muted, looping cleanly — no meshopt/Draco-style
concerns here, that constraint was specific to the drone model this project used to have) and point
the relevant section's `data-video` at it.

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
