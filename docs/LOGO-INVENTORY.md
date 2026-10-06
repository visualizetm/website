# Logo inventory (Brand v3 rollout)

The checklist for the rollout. Milestone 5 re-runs every search and proves nothing is left. Status is `todo`
until the milestone named in the last column lands it, then `done`. New logo files: `public/brand/svg/`,
`public/brand/png/`, and the root icons in `public/`. The shared component is `src/ui/Logo.jsx`; the loading
screen is `src/ui/LogoSpinner.jsx`.

Searched: index.html and every HTML entry, public/, src/, api/, scripts/, vercel.json, vite.config.js, the service
worker, the manifests, docs/, CLAUDE.md, .claude/. Terms: svg and img that draw a logo, logo, brand, icon, favicon,
apple-touch, og, manifest, mask-icon, og:image, twitter:image, theme-color, badge, `icon:` in push payloads, css
url(), background-image, Barlow, #CC2222, brain, "Visualize Studio LLC".

## Rows

| # | File | Line or usage | Surface | Old asset | Planned replacement | Milestone |
|---|---|---|---|---|---|---|
| 1 | index.html | favicon, touch icon, manifest, theme-color, og and twitter block | public | `/logo.svg` (brain), `/icons/apple-touch-icon.png`, `/manifest.webmanifest`, `og-default.png`, `#080808` | the contents of head-snippet.html, one block, duplicates removed | M2 |
| 2 | index.html | no structured data | public | none | one Organization JSON-LD with `logo` icon-512 and `image` og-image | M2 |
| 3 | index.html + vite.config.js | nothing paints before the bundle on the public host | public | none | the parser painted splash, LogoSpinner, removed by React's first commit | M2 |
| 4 | src/App.jsx:41 | LoadingScreen: wordmark pulse, gradient bar, glow, a 1300 ms timer | public | text Wordmark, `drop-shadow` glow, `linear-gradient` bar | `LogoSpinner layout="screen"` as the Suspense fallback, the timer and splash state removed | M2 |
| 5 | src/App.jsx:96 | ClientBoot (planner, review, concepts fallback) | public | text Wordmark pulse | `LogoSpinner layout="page"` | M2 |
| 6 | src/components/Wordmark.jsx | the text "Visualize." in Inter, red period span | public, admin | text wordmark (and `.wordmark` css) | deleted; every caller renders `Logo` | M2 |
| 7 | src/components/Navbar.jsx:44 | the header mark | public | Wordmark 17 | `Logo wordmark` | M2 |
| 8 | src/components/Navbar.jsx:102 | the mobile menu mark | public | Wordmark 20 | `Logo wordmark` | M2 |
| 9 | src/components/Footer.jsx:16 | the footer mark | public | Wordmark 22 | `Logo wordmark` | M2 |
| 10 | src/components/Hero.jsx:50 | Home's mark | public | Wordmark 34 | `Logo wordmark` | M2 |
| 11 | src/components/CTA.jsx:11 | the closing mark | public | Wordmark 28 | `Logo wordmark` | M2 |
| 12 | src/components/ClientPageChrome.jsx:18 | planner, review and concepts top bar | public (client facing) | Wordmark 20 | `Logo wordmark` | M2 |
| 13 | src/components/ClientPageChrome.jsx:27 | the one line footer | public (client facing) | Wordmark 16 | `Logo wordmark` | M2 |
| 14 | src/pages/Start.jsx:317 | the /start intro mark | public | Wordmark 18 | `Logo wordmark` | M2 |
| 15 | src/main.jsx:83 | maintenance page mark and h1 | public | `/logo.svg` (brain) and a text h1 | `Logo icon` over `Logo wordmark` | M2 |
| 16 | src/index.css | `.wordmark`, `.wordmark-dot` | public, admin | text wordmark rules | removed | M2 |
| 17 | src/index.css:9 | `--brand-deep: #cc2222` (defined, read nowhere) | public | retired color | removed | M2 |
| 18 | public/logo.svg | the red brain, read by index.html, Sidebar, main.jsx, sw.js, AdminDesignComponents | system | brain | deleted once unreferenced | M3 |
| 19 | public/icons/apple-touch-icon.png, icon-192.png, icon-512.png, maskable-512.png, badge-96.png | the brain on ink | system | brain | `public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `badge-96.png`; the folder deleted | M3 |
| 20 | public/manifest.webmanifest | the one manifest, both hosts, `theme_color` red, brain icons | system | brain icons | public host: `public/site.webmanifest` (pack); admin host: the same file's icons repointed, name, start_url and display kept, served on the admin host by a vercel.json rewrite | M2, M3 |
| 21 | public/og-default.png | the old share image (text wordmark, BRAND WEBSITE PRINT line) | public | old og | `public/og-image.png`; the file deleted | M2 |
| 22 | src/marketing/useHead.js:16 | `DEFAULT_OG_IMAGE` | public | `/og-default.png` | `/og-image.png` | M2 |
| 23 | scripts/prerender-clients.mjs:57-64 | the prerendered client pages' og:image fallback and the rest of the head | public | `og-default.png` | `og-image.png` plus og:image:width, height, alt, twitter:card, twitter:image, and the snippet's tags | M2 |
| 24 | public/VisualizeWordmark.png | the old wordmark PNG, referenced nowhere | system | old wordmark | deleted | M3 |
| 25 | src/shell/Sidebar.jsx:86 | the sidebar and collapsed rail mark | admin | `/logo.svg` (brain) | `Logo icon` | M3 |
| 26 | src/shell/Sidebar.jsx:88 | the expanded sidebar word (`.sh-wordmark`, Barlow text) | admin | text wordmark | `Logo wordmark` | M3 |
| 27 | src/pages/AdminApp.jsx:111 | the login and lock card mark | admin | Wordmark 22 | `Logo wordmark` | M3 |
| 28 | src/pages/AdminApp.jsx:690, src/App.jsx:148,156 | the session check and the admin chunk wait | admin | the shell skeleton frame (src/shell/bootFrame.js) | kept as the content skeleton the feel audit asserts; see MOBILE-DECISIONS | M3 |
| 29 | src/pages/AdminApp.jsx:716 | each screen's Suspense fallback is `null` | admin | blank panel | `LogoSpinner layout="panel"` | M3 |
| 30 | public/sw.js:14, 17, 27, 57, 58 | version, precache, shell asset test, push `icon` and `badge` | admin, system | `/icons/icon-192.png`, `/icons/badge-96.png`, `/logo.svg` | `/icon-192.png`, `/badge-96.png`, the new paths; VERSION bumped once | M3 |
| 31 | api/_lib/notify.js | web-push payload (title, body, url only; the worker sets icon and badge) | admin | none | nothing to change; recorded so M5 proves it | M3 |
| 32 | src/pages/AdminDesignComponents.jsx:213 | Avatar demo `src="/logo.svg"`; no logo section | admin | brain | Avatar demo repointed; a Logo and LogoSpinner section added | M3 |
| 33 | src/pages/AdminDoc.jsx, docs.styles.js | the doc print view | admin, print | no logo shown | nothing drawn today; recorded, no change | M3 |
| 34 | vercel.json | no logo reference; the CSP and the admin manifest rewrite | system | none | rewrite `/site.webmanifest` to the admin manifest on the admin host | M3 |
| 35 | .claude/skills/run-website/SKILL.md:85 | a stale note about `VisualizeWordmark.png` | docs | old wordmark | the note updated | M5 |
| 36 | docs/CRM-REBUILD-BRIEF.md:314, docs/ARCHITECTURE.md:49, CLAUDE.md:107, docs/COMPONENTS.md, docs/MOBILE-UI-GUIDE.md | words about `/logo.svg`, Wordmark, the old icons | docs | old names | updated to Logo, LogoSpinner and the new files | M5 |
| 37 | head-snippet.html (repo root, from the upload) | the pack's head tags | staging | n/a | applied in M2, then removed from the root | M5 |

## Not in the repo, so nothing to replace

- Email templates and invoice or contract PDFs: the four branded emails go out through Zapier hooks (api/_lib/email.js
  builds the payload only), so the HTML lives in Zapier. No template HTML, no generated PDF, no QR card is in the repo.
  The hosted PNGs they need are placed (`public/brand/png/`); the Zapier footer is on Rob's list.
- Client logos (concepts, showcase, planner brand cards, `logoStrip`) are the clients' own and are not replaced.
- `Barlow Condensed` is the display typeface (src/fonts.css, tokens), not a wordmark. It stays.

## Counts by surface (37 rows)

public 18 (16 site, 2 client facing), public and admin 2, admin 8 (7 admin, 1 admin and print), system 6 (5 system, 1 admin and system), docs 2, staging 1.
