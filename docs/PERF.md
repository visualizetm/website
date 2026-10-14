# Landing page performance

Measured by `scripts/perf-landing.mjs` against the fixture backed mock server (`DIST=dist PORT=4350 node scripts/mock-server.mjs`), so the API answers with the audit fixtures and the images are the fixture SVGs; the real site's photos are larger, the JS, the fonts and the document are the real build. Profile: Slow 4G (1.6 Mbps down, 750 Kbps up, 150 ms latency), CPU 4x slower, 390 x 844 at 3x, touch, no cache, no service worker. Each column is the median of 3 loads of `/`, each in a fresh context; the scroll is a scripted touch flick to the bottom.

| Metric | Baseline (2026-10-14) | After (2026-10-14) |
|---|---|---|
| First contentful paint | 600 ms | 560 ms |
| Largest contentful paint | 1552 ms | 2248 ms |
| LCP element | img visualize-icon-reversed.svg | h1.hero-title |
| Cumulative layout shift | 0 | 0 |
| INP, the slowest interaction of the scroll | 0 ms | 0 ms |
| JS over the wire (gzipped) | 195 KB | 109 KB |
| JS decoded | 652 KB | 344 KB |
| CSS over the wire | 9 KB | 8 KB |
| Fonts | 29 KB | 83 KB |
| Images over the wire | 12 KB | 7 KB |
| Document | 5 KB | 5 KB |
| Requests | 21 | 18 |
| Long tasks over 50 ms (whole load) | 11 | 3 |
| Longest task (whole load) | 318 ms | 153 ms |
| Long tasks over 50 ms during the scroll | 7 | 0 |
| Longest task during the scroll | 60 ms | 0 ms |
| Dropped frames during the scroll | 59 | 2 |
| Worst frame gap during the scroll | 67 ms | 50 ms |
| Frames sampled during the scroll | 1287 | 588 |
| Page height | 13569 px | 5988 px |

Chunks that loaded:
- Baseline: index-BJYFUBdh.js, Home-C898QPoF.js, SceneTest-DIf0pIl8.js, gsap-CcZvk_NV.js
- After: index-BWDVmvKf.js, Home-ZWDpuMgN.js, ScrollRoot-Dh8zYj7W.js, reviewPublic-BcvwYSt2.js, CaseStudy-CKCbgaVB.js, useScrollFade-Dr0g8MTn.js

Targets, against the After column:
- met: LCP under 2500 ms (2248 ms)
- met: CLS under 0.05 (0)
- met: no long task over 200 ms during the scroll (0 ms)
- missed: no dropped frames during the scroll (2)
- met: landing JS under 150 KB gzipped, or 30 percent under the baseline (109 KB (44 percent under the baseline's 195 KB))

## Notes

- Baseline (2026-10-14): the LCP element is the splash screen's logo icon, not the headline. The hero's text waits on the Home chunk, the SceneTest chunk the motion primitives were hoisted into, the gsap chunk and the showcase fetch before it paints, and by then the scripted scroll has begun, which ends LCP tracking. INP reads 0 ms because no interaction from the touch flicks took over 16 ms. The 59 dropped frames and the 7 long tasks during the scroll are the scrubbed pins writing styles on every frame under a 4x slower CPU.
- The real site's images are Cloudinary photos; the mock serves the fixture SVGs, so the image column is small in both runs and the transforms added in milestone 2 are judged by the request URLs, not by this table.
