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
  videos/        drop section background footage here (see below)
```

## The 3D drone

`src/components/DroneOverlay.astro` renders a fixed, full-viewport, transparent `<canvas>` sitting
above each section's background footage and below its text (z-index 6; text sits at z-index 10,
the header at 50).

The drone model is `public/models/drone.glb` — a real mesh (curved shell, modelled gimbal, proper
prop geometry), loaded via `GLTFLoader` in `initDroneOverlay()` (`src/scripts/drone.ts`). It's
optimised from a much larger source asset (dedup/weld/prune + WebP textures, ~4.6MB) with
**no `EXT_meshopt_compression`/Draco on purpose** — those need a WASM decoder at runtime, and
strict CSPs (e.g. this project's own artifact-preview sandbox) can silently block WASM
instantiation, which previously made the model fail to load with no visible error. If you
re-export the model, keep that constraint: `@gltf-transform/cli optimize --compress false`.

A `buildProceduralDrone()` fallback (primitives only — boxes, cylinders, an extruded blade
profile) renders immediately and is swapped out the moment the GLB resolves, so the overlay is
never blank while the ~4.6MB model loads, and never breaks outright if it fails to. Its geometry
was itself hand-corrected against a reference photo (dark paddle-shaped blades, hinge knuckles,
differentiated nose sensors) — the fallback should look reasonable on its own even though it's
rarely what's on screen.

The GLB drives its propellers via named skeleton joints (`prop_1_jnt`..`prop_4_jnt`), found by
`model.traverse()` after load and spun directly each frame — its baked-in "hover" animation clip
is deliberately **not** played, because it carries a large body-relative vertical excursion that
fights the site's own flight-position waypoints and periodically carried the model out of frame.

Local +Z is "forward" (the direction the camera gimbal points), so a rig at `rotation.y = 0`
faces the viewer; the GLB's own axes needed an empirically-found offset (`rotationY: 1.57` at the
hero waypoint) to achieve that, since it isn't authored with that convention.

As you scroll, the drone eases toward a waypoint associated with whichever section is centred in
the viewport (`WAYPOINTS` in `drone.ts` — tweak position/scale/rotation per section there). On
load it flies in from below the viewport over a 1.6s entrance tween (separate from the snappier
scroll-follow easing, which converges too fast on its own to read as motion).

Respects `prefers-reduced-motion`: the entrance, idle bob and rotor spin all freeze.

**To swap the model:** replace `public/models/drone.glb` with another GLB (no meshopt/Draco —
see above) and re-check the `prop_1_jnt`-style joint names / the `rotationY` "faces viewer"
calibration, since both are specific to this asset's rig and axes.

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
