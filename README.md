<p align="center">
  <img src="public/assets/logo.png" width="48" height="48" alt="">
</p>

<h1 align="center">Ringus</h1>

<p align="center">
  Marketing site for the Ringus digital medical ring — a 2.4 g titanium ring that reads heart rate,
  blood oxygen, skin temperature and sleep around the clock.
</p>

<p align="center">
  <a href="https://rignus-ring-website.vercel.app"><strong>rignus-ring-website.vercel.app</strong></a>
</p>

---

## Highlights

- **Interactive 3D ring** — a procedurally built titanium band (no model file) rendered with Three.js.
  Drag to rotate, scroll to spin, hotspot callouts that track the geometry, and **WebXR** buttons that
  appear only on devices that can actually enter VR or AR.
- **Cinematic hero** — a background clip that plays forward natively and then *backwards* through a
  canvas-assisted frame cache, so the loop never cuts. Includes a pause control (WCAG 2.2.2).
- **Live sample vitals** — an animated ECG trace, radial SpO₂ gauge, sleep bars and count-up numbers,
  all driven by GSAP + ScrollTrigger.
- **Section-by-section presentation** — every section is a viewport-height slide on laptops with
  scroll-snap, and flows naturally on phones.
- **Accessible by default** — semantic landmarks, keyboard-operable accordion and carousel, visible
  focus rings, `prefers-reduced-motion` honoured everywhere, and a never-hidden guarantee: if
  JavaScript fails, nothing on the page is left invisible.

## Stack

| Layer | Choice |
| --- | --- |
| Build | [Vite](https://vite.dev) 8 + TypeScript 5.9 (strict) |
| 3D | [Three.js](https://threejs.org) 0.185, lazy-loaded when the product section nears |
| Motion | [GSAP](https://gsap.com) 3.15 + ScrollTrigger |
| Icons | [Lucide](https://lucide.dev), tree-shaken |
| Type | Host Grotesk (Google Fonts) |
| Hosting | Vercel |

No UI framework. Plain HTML, CSS custom properties, and TypeScript modules.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then builds to dist/
npm run preview    # serves the production build on :4173
```

Requires Node 20.19 or newer.

## Project layout

```
index.html                 single page, all sections
public/
  assets/                  video, photography, logo
  favicon.svg · og.png · robots.txt · sitemap.xml
src/
  main.ts                  boot order
  lib/
    motion.ts              GSAP setup, reveals, counters, magnetic buttons, forms
    pingpong.ts            forward/reverse video loop engine
    cursor.ts · icons.ts
  three/
    ring.ts                procedural ring geometry + materials
    scene.ts               renderer, lights, interaction, hotspots, WebXR
  sections/                one module per section (nav, hero, product, vitals, …)
  styles/
    tokens.css             design tokens (dark + light surfaces)
    base.css · layout.css · components.css
    sections/              one stylesheet per section
```

## Design system

All colour, spacing, radius, type and motion values are CSS custom properties in
`src/styles/tokens.css`. Sections compose the primitives in `components.css` (`.btn`, `.card`,
`.pill`, `.eyebrow`, `.acc`, `.switch`, …) and never restyle them. A light surface is a single
class — `.theme-light` remaps the semantic tokens in place.

## Accessibility and motion

- Every reveal, counter and entrance animation is gated behind `prefers-reduced-motion` and an
  `html.motion` class that the script adds only when it is about to animate. Without it, elements
  render in their final state.
- The 3D canvas falls back to a photograph when WebGL is unavailable.
- The background video can be paused at any time; the engine also pauses when the hero is off-screen.

## Deployment

The site is a static build. On Vercel, the framework preset is detected as Vite; `vercel.json`
adds long-lived cache headers for hashed assets and basic security headers.

## License

All rights reserved. Photography and video are used under licence for this project.
