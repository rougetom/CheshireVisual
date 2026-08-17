# Cheshire Visual

Marketing site for [cheshirevisual.co.uk](https://cheshirevisual.co.uk) — a drone, aerial and 360°
photography/video studio based in Cheshire, serving the North West of England.

Built with [Astro](https://astro.build) for fast, SEO-first static output. A 3D drone (Three.js)
flies across the page as you scroll, layered over per-section video/gradient backdrops.

## Stack

- **Astro** — static-first rendering, minimal client JS, great Core Web Vitals out of the box.
- **Three.js** — the scroll-driven drone overlay (`src/scripts/drone.ts`).
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
  layouts/       Layout.astro — shared <head>, SEO
  scripts/       drone.ts (3D overlay), reveal.ts (scroll-reveal)
  styles/        tokens.css (design tokens), global.css
public/
  models/        drone.glb — the 3D drone model
  videos/        drop section background footage here (see below)
```

## The 3D drone

`src/components/DroneOverlay.astro` renders a fixed, full-viewport, transparent `<canvas>` sitting
above each section's background footage and below its text (z-index 6; text sits at z-index 10,
the header at 50).

`src/scripts/drone.ts` loads `public/models/drone.glb` (optimised from a Sketchfab source model —
1.2MB, meshopt + WebP compressed, with only the `hover` animation clip kept). As you scroll, the
drone eases toward a waypoint associated with whichever section is centred in the viewport
(`WAYPOINTS` in `drone.ts` — tweak position/scale/rotation per section there). Rotors spin
continuously; the `hover` clip drives the body animation if present.

If `drone.glb` is ever missing or fails to load, a small procedural low-poly drone (built from
primitive geometry) renders instead automatically — the site never breaks without the asset.

Respects `prefers-reduced-motion`: the drone stops easing/idling and rotor spin/mixer playback
freezes.

**To swap the model:** replace `public/models/drone.glb` with another optimised GLB. Keep it under
~2MB for a background decorative element — run it through
[`@gltf-transform/cli optimize`](https://gltf-transform.dev/cli) first (see git history of this
file for the exact command used).

## Video backgrounds

Every section (`Hero`, `About`, `Services`, `UseCases`, `Clients`, `Contact`) renders via
`SectionBackdrop.astro`, which layers, back to front:

1. A graded CSS gradient with a slow "ken burns" drift — this is the fallback/poster and renders
   immediately (zero network cost).
2. An optional `<video muted loop playsinline>` (autoplaying footage) — enabled by passing a
   `videoId`/`videoSrc` prop.
3. A dark scrim gradient (for text legibility).
4. Film-grain texture.

**Right now no video files are wired in** — only the graded-gradient placeholder shows, matching
the original design handoff. To add real stock footage:

1. Source clips (e.g. Pexels, Coverr, Mixkit — check each clip's licence permits this commercial
   use) at roughly 1920×1080, and compress them (H.264 `.mp4`, ~5–8 Mbps, 10–20s, muted, looping
   cleanly) with something like:
   ```bash
   ffmpeg -i input.mov -an -vcodec libx264 -crf 23 -preset slow -vf scale=1920:-2 public/videos/hero.mp4
   ```
2. Drop the file at `public/videos/<name>.mp4`.
3. Pass `videoSrc="/videos/<name>.mp4"` to the relevant section's `<SectionBackdrop>` call (in
   `Hero.astro`, `About.astro`, `Services.astro`, `UseCases.astro`, `Clients.astro`,
   `Contact.astro`).

The hero section additionally **scrubs** its video to scroll position (see the inline script in
`Hero.astro`) rather than autoplaying — once `heroVideo` has a real `src`, scrolling through the
hero will scrub through the clip like a showreel.

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
