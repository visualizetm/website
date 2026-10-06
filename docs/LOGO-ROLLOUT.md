# Logo rollout (Brand v3), one page

The mark is the Aperture Round: four round ended arcs around a red dot. The wordmark is "Visualize." with the
period (Inter ExtraBold 800, tracking minus 4 percent). Colors: Ink `#0A0A0A`, Paper `#FAFAFA`, Red `#D44C43`,
Red Deep `#C2413A`. The favicon and the app icon are the Aperture crosshair, never the V.

Retired, and gone from the repo: the red brain, the text wordmark in the display typeface, the red grid overlay,
`#CC2222`, the italic tagline, "Visualize Studio LLC", every old favicon and app icon. (Barlow Condensed is still
the display typeface of headings; it is a font, not a logo.)

## Where each file lives and what reads it

| File | Used by |
|---|---|
| `public/favicon.ico`, `public/favicon.svg` | browser tabs (`index.html`) |
| `public/apple-touch-icon.png` | iPhone Home Screen (`index.html`) |
| `public/icon-192.png` | both manifests, the push notification `icon` (`public/sw.js`) |
| `public/icon-512.png` | both manifests, JSON-LD `logo` (`index.html`) |
| `public/icon-512-maskable.png` | both manifests (Android maskable) |
| `public/badge-96.png` | the push notification `badge` (`public/sw.js`); white on transparent, made by `scripts/brand-render.mjs` |
| `public/site.webmanifest` | the public site's manifest (the pack's, `display: browser`) |
| `public/manifest.webmanifest` | the admin host's manifest (own name, `start_url`, `display: standalone`, pack icons); `index.html`'s pre-paint script points the admin host at it |
| `public/og-image.png` (1200 x 630) | `og:image` and `twitter:image` on every page, the prerendered client pages without a cover, `useHead` |
| `public/brand/svg/visualize-*.svg` | the `Logo` component and the loading screen |
| `public/brand/png/visualize-*.png` | emails, PDFs, anywhere SVG fails (see below) |
| `public/brand/png/visualize-wordmark-{primary,reversed}-480.png` | email headers and footers; made by `scripts/brand-render.mjs` |

Not made: the V. submark files (not in the upload and nothing needs them), so `Logo` has no `submark` variant. The pack's tagline wordmark SVGs are kept in `public/brand/svg/` but are not a variant: nothing uses them and the line says "our".

## The component

```jsx
import { Logo, LogoSpinner } from '../ui';          // admin screens
import Logo from '../ui/Logo';                       // the public site: by path, never the kit index
<Logo width={104} />                                 // wordmark, reversed (light letters), for dark surfaces
<Logo variant="lockup" width={220} tone="primary" /> // horizontal lockup, ink letters, for light surfaces
<Logo variant="icon" width={28} decorative />        // beside visible text: alt empty, hidden from assistive tech
<Logo width={128} tone="auto" clearSpace />          // the admin's own surfaces: reversed on its dark theme, primary on its light one
<LogoSpinner />                                      // the loading screen; layout inline | panel | screen | page; size >= 24
```

- `variant`: `wordmark` (default), `icon`, `lockup` (horizontal), `stacked`. `tone`: `reversed`, `primary`, `auto`.
- Give `width` or `height`, never both; the other follows the artwork's ratio. Minimums are enforced: wordmark 96 px wide
  (lockup 160, stacked 120), icon 24.
- It renders the pack SVG through an `<img>`, not an inline copy: the pack's fills are brand hexes and the hex audit
  scans `src/` (80 of 90 at the start of the rollout, 78 now). Same bytes, cached, precached by the service worker.
- Nothing is ever drawn around it: no outline, stroke, gradient, shadow, italic or filter. `scripts/brand-check.mjs`
  proves that on the pack files.
- `LogoSpinner`: the whole icon turns, linear, one turn every 1.1 s, red dot at the center. CSS keyframes on
  `transform` only. Reduced motion: no rotation, a slow opacity pulse between 0.55 and 1. `role="status"`,
  label "Loading". It shows only while something is loading; no minimum time. The public site's pre-JS splash is the
  same markup and the same stylesheet string (`src/ui/logoSpinner.styles.js`), painted by the parser through the vite
  plugin in `vite.config.js`. Inside a button or row keep `Spinner`.
- To change the logo everywhere: replace the files in `public/brand/svg/` (and the PNGs). Nothing else holds a copy.

## Emails

The four branded emails are Zapier hooks (`api/_lib/email.js` builds the payload, not the HTML), so no template is
in the repo. In Zapier, a header or footer logo is:

```html
<a href="https://visualizestudio.org"><img src="https://visualizestudio.org/brand/png/visualize-wordmark-reversed-480.png" width="240" height="42" alt="Visualize." style="display:block;border:0;height:auto"></a>
```

Use `-primary-480.png` on a light card. Keep the text fallback beside it (`Visualize` with a red period span).
Never SVG in an email.

## Rob must upload

| Where | File |
|---|---|
| Instagram profile photo (round crop, light red `#EDB4B0` or ink background) | `public/brand/png/visualize-icon-primary-512.png` or `visualize-icon-reversed-512.png` |
| Google Business profile logo | `public/icon-512.png` |
| Stripe branding (icon and logo) | icon: `public/icon-512.png`, logo: `public/brand/png/visualize-lockup-horizontal-reversed-1200.png` |
| Calendly branding | `public/brand/png/visualize-lockup-horizontal-primary-1200.png` |
| Zapier email footers and any Gmail signature | `public/brand/png/visualize-wordmark-primary-480.png`, shown 240 px wide |
| GitHub org avatar and Vercel project icon | `public/icon-512.png` |
| Google Drive client folder cover (optional) | `public/icon-512.png` |
