/* Layout regression audit, walks every admin route at phone/tablet/desktop
 * widths and fails if ANY element extends past the viewport or the page can
 * scroll sideways. Run it after touching admin layout:
 *
 *   npm run build
 *   npx vite preview --port 4330 &
 *   node scripts/layout-audit.mjs
 *
 * Uses mocked admin APIs (with deliberately hostile long names) so it needs
 * no database and never touches real data. Chromium path can be overridden
 * with PW_CHROME=/path/to/chrome.
 */
import { chromium } from 'playwright-core';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const WIDTHS = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(',').map(Number) : [320, 390, 430, 768, 1280];
const SHOTS = process.env.AUDIT_SHOTS || ''; // directory: save a screenshot per check
const THEME = process.env.AUDIT_THEME || 'dark';   // dark | light (Prompt 14): the admin theme under test
const MOTION = process.env.AUDIT_MOTION || 'normal'; // normal | reduce: the in-app Reduce motion switch

import { LONG, UNBROKEN, leads, items, orders, json, mockRoutes } from './audit-fixtures.mjs';


// Elements allowed to scroll sideways on purpose (their CONTENT may be wide,
// the element itself must still fit the viewport).
// (Site Prompt 6 added the last three: TrackScroll's row is wider than
// the screen by design and clipped by .m-track-viewport, and a cover
// settling in from 1.08 is briefly wider than the frame that clips it,
// .cs-cover on a detail page and .wk-card-media on a card. All three
// frames are themselves still checked, so a frame that genuinely does
// not fit still fails.)
const HSCROLL_OK = ['.li-tablewrap', '.v-tabs', '.v-seg', '.db-funnel', '.ld-board', '.ld-frow-chips', '.v-table-scroll', '.cw-stepper', '.ds-table-wrap', '.cal-strip', '.cal-week', '.cal-month', '.m-marquee', '.m-track-viewport', '.cs-cover', '.wk-card-media', '.cs-ig-highlights', '.pl-cal-wrap'];
// Decorative elements meant to spill past their own edge and be clipped by
// an overflow:hidden parent (a glow, a background flourish): a real position
// past the viewport, but never a page-level overflow (Site Prompt 3, Part 5).
const CLIP_OK = [];

/* Touch targets (Prompt 15): every interactive element is at least 44 by 44.
 * Text links inside running prose are the one exemption (WCAG 2.5.8 inline
 * exception); everything else, including the smallest icon buttons, must
 * measure up. TARGET_MIN can be lowered for a diagnostic run. */
const TARGET_MIN = Number(process.env.AUDIT_TARGET_MIN || 44);
const TARGET_SEL = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="radio"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [tabindex]:not([tabindex="-1"])';
async function collectSmallTargets(page) {
  return page.evaluate(([sel, min]) => {
    const bad = []; const seen = new Set();
    const inProse = (el) => !!el.closest('p, li, td, figcaption, .dt-muted, .v-toast-desc, .v-empty-desc, .v-error-desc');
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
      if (el.matches('a') && inProse(el)) continue;
      // The stretched open control is the whole card or row; its parent is the target.
      const box = el.classList.contains('v-stretch') ? el.parentElement : el;
      const r = box.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // A hidden native input inside a kit control (checkbox, toggle) is measured by its visible wrapper.
      const hit = el.matches('input[type="checkbox"]') ? el.closest('.v-check, .v-toggle') || el : el.matches('input, select, textarea') ? el.closest('.v-field-shell') || el : box;
      const hr = hit.getBoundingClientRect();
      if (hr.width + 0.5 >= min && hr.height + 0.5 >= min) continue;
      const key = (el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName) + ':' + Math.round(hr.width) + 'x' + Math.round(hr.height);
      if (seen.has(key)) continue;
      seen.add(key);
      bad.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), w: Math.round(hr.width), h: Math.round(hr.height), text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30) });
    }
    return bad.slice(0, 12);
  }, [TARGET_SEL, TARGET_MIN]);
}

/* The scroll check (the admin mobile scroll fix). Every admin screen has
 * one scroller, the kit's .lay-scroll, and two things have to be true of
 * it: it can actually reach its own bottom, and the last thing in it is
 * fully visible above the tab bar and above any floating bar over it.
 *
 * The first catches the failure this check was written for: a flex item
 * in the chain without min-height: 0 grows to its content, the scroller
 * inherits that height, clientHeight equals scrollHeight, and the page
 * silently stops scrolling with everything below the fold unreachable.
 * The second catches content hidden behind the chrome.
 *
 * .lay-scroll's scroll-behavior is smooth, so the scroll is done with it
 * turned off, or the read below happens mid-animation and every screen
 * looks stuck. The scroll position is restored afterwards. */
async function collectScrollProblems(page) {
  return page.evaluate(async () => {
    const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const scrollers = [...document.querySelectorAll('.lay-scroll')].filter(e => e.offsetParent !== null && e.clientHeight > 40);
    if (!scrollers.length) return [];
    const main = scrollers.sort((a, b) => b.clientHeight - a.clientHeight)[0];
    const out = [];
    const name = `.${String(main.className || '').split(' ').slice(0, 2).join('.')}`;
    const prevTop = main.scrollTop;
    const prevBehavior = main.style.scrollBehavior;
    main.style.scrollBehavior = 'auto';
    main.scrollTop = main.scrollHeight;
    await frame();
    const reached = main.scrollTop + main.clientHeight >= main.scrollHeight - 4;
    if (!reached) {
      out.push({ kind: 'stuck', el: name, h: Math.round(main.clientHeight), sh: Math.round(main.scrollHeight), top: Math.round(main.scrollTop) });
    }
    /* The scroller itself must fit on the screen. When it does not, it has
     * grown to its content instead of being constrained, clientHeight
     * equals scrollHeight, "reached the bottom" is trivially true, and the
     * page does not scroll at all. Naming that directly beats reporting
     * only its symptom. */
    const box = main.getBoundingClientRect();
    if (box.bottom > window.innerHeight + 1) {
      out.push({ kind: 'oversized', el: name, h: Math.round(main.clientHeight), sh: Math.round(main.scrollHeight), bottom: Math.round(box.bottom) });
    }
    const content = main.querySelector(':scope > .lay-content') || main;
    const kids = [...content.children].filter((e) => {
      const cs = getComputedStyle(e);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.position !== 'fixed' && e.getBoundingClientRect().height > 4;
    });
    const last = kids[kids.length - 1]?.getBoundingClientRect();
    if (last) {
      const tabBar = document.querySelector('.sh-tabs')?.getBoundingClientRect();
      const floating = [...document.querySelectorAll('.sb-bar.is-open, .v-stickyfooter')]
        .map(e => e.getBoundingClientRect()).filter(r => r.height > 4);
      const limit = Math.min(
        window.innerHeight,
        tabBar && tabBar.height > 4 ? tabBar.top : window.innerHeight,
        ...floating.map(r => r.top),
      );
      if (last.bottom > limit + 1) {
        out.push({ kind: 'covered', el: name, bottom: Math.round(last.bottom), limit: Math.round(limit) });
      }
    }
    main.scrollTop = prevTop;
    main.style.scrollBehavior = prevBehavior;
    await frame();
    return out;
  });
}

/* Site Prompt 7, Part 4: the image rule, checked rather than trusted.
 *
 *   1. every <img> sits inside an .img-fit box (which clips, so an image
 *      inside one can never visually spill past it),
 *   2. an image stays inside that box's rectangle, unless something between
 *      the two is transformed, which is the parallax drift and the settle
 *      from 1.08 doing their job inside a box that clips them, and
 *   3. no two boxes overlap each other.
 *
 * Together those are what "never extends past its container or over a
 * neighbour" means. Boxes the page deliberately stacks (the hero deck,
 * whose cards are one on top of another by design, and the marquee's
 * duplicated loop) are exempt from 3, since their overlap IS the design.
 */
const STACK_OK = ['.hero-deck', '.m-marquee'];
async function collectImageProblems(page) {
  return page.evaluate((stackOk) => {
    const out = [];
    const rectOf = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const boxes = new Map();
    for (const img of document.querySelectorAll('img')) {
      const cs = getComputedStyle(img);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = rectOf(img);
      if (r.w < 2 || r.h < 2) continue;
      const name = `${img.className || 'img'}[${(img.getAttribute('src') || '').split('/').pop().slice(0, 24)}]`;
      /* A full screen viewer is the one place an image is not in a declared
         box: it is sized to the viewport at its own aspect, with contain, so
         it cannot draw outside anything. The box rule exists to stop an
         image escaping its frame, and here the frame is the screen. */
      if (img.closest('.pl-zoom')) continue;
      const frame = img.closest('.img-fit');
      if (!frame) { out.push({ kind: 'no-box', el: name }); continue; }
      // Is anything between the image and its box transformed?
      let transformed = false;
      for (let n = img; n && n !== frame.parentElement; n = n.parentElement) {
        if (getComputedStyle(n).transform !== 'none') { transformed = true; break; }
      }
      const f = rectOf(frame);
      if (!transformed && (r.l < f.l - 1 || r.t < f.t - 1 || r.r > f.r + 1 || r.b > f.b + 1)) {
        out.push({ kind: 'outside-box', el: name, img: r, box: f });
        continue;
      }
      /* Which layer the box is on. An open Sheet or Modal is drawn over the
         page on its own opaque layer, so a preview inside one sitting on top
         of a thumbnail behind it is not an overlap anybody can see; only
         boxes on the SAME layer can really collide. */
      const layer = frame.closest('.v-sheet, .v-modal, .pl-panel') ? 'overlay' : 'page';
      if (!boxes.has(frame)) boxes.set(frame, { name, r: f, layer, stacked: stackOk.some(sel => frame.closest(sel)) });
    }
    const list = [...boxes.values()];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.stacked && b.stacked) continue;
        if (a.layer !== b.layer) continue; // an overlay over the page, not a collision
        const overlap = Math.min(a.r.r, b.r.r) - Math.max(a.r.l, b.r.l) > 1 && Math.min(a.r.b, b.r.b) - Math.max(a.r.t, b.r.t) > 1;
        if (overlap) out.push({ kind: 'overlap', el: a.name, other: b.name });
      }
    }
    return out.slice(0, 12);
  }, STACK_OK);
}

/* Stuck overlays (the client planner scrim). A scrim, a backdrop or a
 * splash is a full screen layer with a background, drawn over the page on
 * its own z-index. While a dialog is open that is exactly right. While
 * nothing is open it is a page nobody can read or touch, which is what the
 * marketing splash was doing to the client planner: rendered on both of
 * those routes on a 1300ms timer, and left up for as long as the page's
 * own chunk took to arrive.
 *
 * So, with no dialog, sheet or modal mounted, nothing covering more than
 * half the viewport may have a non-transparent background and a z-index
 * above the content. An element still fading out is caught too, at
 * whatever opacity it is currently painting.
 *
 * The one layer that is allowed over a page with nothing open is the
 * marketing site's boot splash, and only on its own terms: only on a
 * marketing route (never on a client's planner or review form, which have
 * their own in-flow placeholder), and only while it is still inside its
 * own life. A splash still in the document three seconds after navigation
 * started has stopped being a splash and become a scrim.
 */
const DIALOG_SEL = '[role="dialog"], [role="alertdialog"], dialog[open], .v-sheet, .v-sheet-back, .v-modal, .pl-panel-wrap, .pl-zoom';
const SPLASH_LIFE_MS = 3000;
async function collectStuckOverlays(page) {
  return page.evaluate(([dialogSel, splashLife]) => {
    if (document.querySelector(dialogSel)) return []; // something is open: a backdrop belongs here
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    const out = [];
    const describe = (el, cs, cover, why) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), bg: cs.backgroundColor, opacity: cs.opacity, z: cs.zIndex, pe: cs.pointerEvents, cover, why });

    const splash = document.querySelector('.app-loader');
    if (splash) {
      const cs = getComputedStyle(splash);
      const onClientPage = /^\/(planner|review)(\/|$)/.test(location.pathname);
      if (onClientPage) out.push(describe(splash, cs, 100, 'the marketing splash, on a standalone client page'));
      else if (performance.now() > splashLife) out.push(describe(splash, cs, 100, `still in the document ${Math.round(performance.now())}ms after navigation started`));
    }

    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.app-loader')) continue; // the splash has its own rule above
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      // Only a layer drawn over the page can strand one; in-flow backgrounds are the page.
      if (cs.position !== 'fixed' && cs.position !== 'absolute' && cs.position !== 'sticky') continue;
      const z = cs.zIndex === 'auto' ? 0 : Number(cs.zIndex) || 0;
      if (z <= 0) continue;
      const bg = cs.backgroundColor;
      if (!bg || bg === 'transparent' || /,\s*0\)$/.test(bg)) continue;
      const r = el.getBoundingClientRect();
      const w = Math.min(r.right, vw) - Math.max(r.left, 0);
      const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (w <= 0 || h <= 0 || w * h < vw * vh * 0.5) continue;
      out.push(describe(el, cs, Math.round((w * h) / (vw * vh) * 100), 'over the page with nothing open'));
    }
    return out.slice(0, 6);
  }, [DIALOG_SEL, SPLASH_LIFE_MS]);
}

async function collectOffenders(page) {
  return page.evaluate(([hscrollOk, clipOk]) => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // inside an intended horizontal scroller?
      if (hscrollOk.some(sel => el.closest(sel) && !el.matches(sel))) continue;
      // decoration meant to spill past its own edge, clipped by an overflow:hidden parent?
      if (clipOk.some(sel => el.matches(sel))) continue;
      const overRight = r.right > vw + 1;
      const overLeft = r.left < -1 && r.right > 0;
      if ((overRight && r.left < vw) || overLeft) {
        const key = el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName;
        if (seen.has(key)) continue;
        seen.add(key);
        bad.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).slice(0, 60),
          rect: { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) },
        });
      }
    }
    return {
      vw,
      scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      offenders: bad.slice(0, 12),
    };
  }, [HSCROLL_OK, CLIP_OK]);
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let failures = 0;

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 500, reducedMotion: MOTION === 'reduce' ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(([theme, motion]) => { try { localStorage.setItem('vz_theme', theme); localStorage.setItem('vz_boot', '1'); if (motion === 'reduce') localStorage.setItem('vz_motion', 'reduce'); } catch {} }, [THEME, MOTION]);
  await mockRoutes(page);

  const check = async (label, targetPage = page) => {
    await targetPage.waitForTimeout(650);
    if (SHOTS) await targetPage.screenshot({ path: `${SHOTS}/${width}-${label.replace(/[^a-z0-9]+/gi, '_')}.png` }).catch(() => {});
    const res = await collectOffenders(targetPage);
    const small = await collectSmallTargets(targetPage);
    const imgs = await collectImageProblems(targetPage);
    const scrolls = await collectScrollProblems(targetPage);
    const stuck = await collectStuckOverlays(targetPage);
    const hscroll = res.scrollW > res.vw + 1;
    if (hscroll || res.offenders.length || small.length || imgs.length || scrolls.length || stuck.length) {
      failures++;
      console.log(`  FAIL [${width}px] ${label}${hscroll || res.offenders.length ? `, scrollW=${res.scrollW} vw=${res.vw}` : ''}${small.length ? `, ${small.length} target${small.length === 1 ? '' : 's'} under ${TARGET_MIN}px` : ''}${imgs.length ? `, ${imgs.length} image problem${imgs.length === 1 ? '' : 's'}` : ''}${scrolls.length ? `, ${scrolls.length} scroll problem${scrolls.length === 1 ? '' : 's'}` : ''}${stuck.length ? `, ${stuck.length} stuck overlay${stuck.length === 1 ? '' : 's'}` : ''}`);
      for (const o of res.offenders) console.log(`        <${o.tag} class="${o.cls}"> left=${o.rect.left} right=${o.rect.right} w=${o.rect.w}`);
      for (const t of small) console.log(`        target <${t.tag} class="${t.cls}"> ${t.w}x${t.h} "${t.text}"`);
      for (const im of imgs) {
        if (im.kind === 'no-box') console.log(`        image not in an .img-fit box: ${im.el}`);
        else if (im.kind === 'outside-box') console.log(`        image outside its box: ${im.el} img=${Math.round(im.img.l)},${Math.round(im.img.t)},${Math.round(im.img.r)},${Math.round(im.img.b)} box=${Math.round(im.box.l)},${Math.round(im.box.t)},${Math.round(im.box.r)},${Math.round(im.box.b)}`);
        else console.log(`        images overlap: ${im.el} over ${im.other}`);
      }
      for (const sc of scrolls) {
        if (sc.kind === 'stuck') console.log(`        scroller cannot reach its bottom: ${sc.el} clientHeight=${sc.h} scrollHeight=${sc.sh} (stopped at ${sc.top})`);
        else if (sc.kind === 'oversized') console.log(`        scroller grew to its content instead of the screen: ${sc.el} clientHeight=${sc.h} scrollHeight=${sc.sh}, bottom at ${sc.bottom}`);
        else console.log(`        last content hidden behind the chrome: ${sc.el} ends at ${sc.bottom}, visible to ${sc.limit}`);
      }
      for (const o of stuck) console.log(`        overlay ${o.why}: <${o.tag} class="${o.cls}"> covers ${o.cover}% bg=${o.bg} opacity=${o.opacity} z=${o.z} pointer-events=${o.pe}`);
    } else {
      console.log(`  ok   [${width}px${THEME === 'light' ? ' light' : ''}${MOTION === 'reduce' ? ' reduce' : ''}] ${label}`);
    }
  };

  // A layout check that also requires some text on the page (end to end proof).
  const checkText = async (label, text) => {
    await check(label);
    const found = await page.getByText(text, { exact: false }).count().catch(() => 0);
    if (!found) { failures++; console.log(`  FAIL [${width}px] ${label}: expected text "${text}" not found`); }
  };

  // domcontentloaded + settle delay: 'networkidle' never settles with the
  // PWA service worker active, so bounded waits keep the audit fast.
  const goto = (path) => page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  const only = process.env.AUDIT_ONLY; // 'settings', 'clients', 'studio', 'design', 'dashboard', 'landing', 'marketing', or 'a11y' reruns just that block
  if (only === 'a11y') {
    /* Prompt 15: 200 percent zoom and the WCAG text spacing overrides on the
     * Dashboard, Leads, and the call room. Browser zoom at 200 percent is a
     * viewport of half the CSS pixels at twice the device scale, which is
     * exactly what a second context with those settings reproduces; the
     * same overflow and target checks run there. Below 320 CSS pixels
     * (a 390 phone at 200 percent is 195) WCAG allows horizontal scrolling
     * (1.4.10 reflow), so at that width only clipped or overlapping content
     * fails, not a wide document. */
    const ROOM = { ids: ['L0', 'L1', 'L3', 'L4', 'L6', 'L7'], idx: 0, stats: {}, logged: {}, startedAt: Date.now(), size: 6, mode: 'room' };
    const targets = [['dashboard', '/admin', () => localStorage.removeItem('vz_call_session')], ['leads', '/admin/leads', () => localStorage.setItem('vz_leads_view', JSON.stringify('list'))], ['call room', '/admin/calls', (s) => localStorage.setItem('vz_call_session', JSON.stringify(s))]];
    const zctx = await browser.newContext({ viewport: { width: Math.round(width / 2), height: 422 }, deviceScaleFactor: 2, hasTouch: width < 500, reducedMotion: MOTION === 'reduce' ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
    const zpage = await zctx.newPage();
    await zpage.addInitScript(([theme, motion]) => { try { localStorage.setItem('vz_theme', theme); localStorage.setItem('vz_boot', '1'); if (motion === 'reduce') localStorage.setItem('vz_motion', 'reduce'); } catch {} }, [THEME, MOTION]);
    await mockRoutes(zpage);
    const clipped = async (pg) => pg.evaluate(() => {
      // Text that is cut off by an ancestor with overflow hidden and no ellipsis, or two text nodes drawn on top of each other.
      const bad = []; const seen = new Set();
      for (const el of document.querySelectorAll('.sh-content *, .v-sheet *')) {
        if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        if (el.classList.contains('v-sr-only')) continue; // visually hidden text for assistive tech is clipped on purpose
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (el.scrollHeight > el.clientHeight + 4 && cs.overflowY === 'hidden' && cs.textOverflow !== 'ellipsis' && !el.classList.contains('lay-truncate') && el.clientHeight > 0) {
          const key = el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName;
          if (!seen.has(key)) { seen.add(key); bad.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), text: el.textContent.trim().slice(0, 30) }); }
        }
      }
      return bad.slice(0, 10);
    });
    for (const [name, path, prep] of targets) {
      await zpage.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await zpage.evaluate(prep, ROOM).catch(() => {});
      await zpage.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await zpage.waitForTimeout(900);
      const res = await collectOffenders(zpage);
      const clip = await clipped(zpage);
      const vw = res.vw;
      const wide = vw >= 320 && res.scrollW > vw + 1;
      const off = vw >= 320 ? res.offenders : [];
      if (wide || off.length || clip.length) { failures++; console.log(`  FAIL [${width}px at 200% zoom = ${vw}px] ${name}${wide ? `, scrollW=${res.scrollW}` : ''}`); for (const o of off) console.log(`        <${o.tag} class="${o.cls}"> right=${o.rect.right}`); for (const c of clip) console.log(`        clipped <${c.tag} class="${c.cls}"> "${c.text}"`); }
      else console.log(`  ok   [${width}px at 200% zoom = ${vw}px] ${name}`);
    }
    await zctx.close();
    // Text spacing overrides (WCAG 1.4.12) at the normal zoom.
    const SPACING = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
    for (const [name, path, prep] of targets) {
      await goto('/admin');
      await page.evaluate(prep, ROOM).catch(() => {});
      await goto(path);
      await page.addStyleTag({ content: SPACING }).catch(() => {});
      await page.waitForTimeout(900);
      const res = await collectOffenders(page);
      const clip = await clipped(page);
      const hscroll = res.scrollW > res.vw + 1;
      if (hscroll || res.offenders.length || clip.length) { failures++; console.log(`  FAIL [${width}px text spacing] ${name}${hscroll ? `, scrollW=${res.scrollW}` : ''}`); for (const o of res.offenders) console.log(`        <${o.tag} class="${o.cls}"> right=${o.rect.right} w=${o.rect.w}`); for (const c of clip) console.log(`        clipped <${c.tag} class="${c.cls}"> "${c.text}"`); }
      else console.log(`  ok   [${width}px text spacing] ${name}`);
    }
    await ctx.close(); continue;
  }
  if (only === 'dashboard') {
    await goto('/admin');
    await page.evaluate(() => localStorage.removeItem('vz_call_session'));
    await check('dashboard');
    await page.waitForTimeout(1200);
    await check('dashboard (settled)');
    await goto('/admin/?loading=1');
    await check('dashboard skeleton');
    if (width >= 768) {
      await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
      await check('sidebar collapsed: dashboard');
      await page.evaluate(() => localStorage.removeItem('vz_shell_collapsed')).catch(() => {});
    }
    await ctx.close(); continue;
  }
  if (only === 'design') {
    await goto('/admin/design');
    await check('design system (tokens + components)');
    await page.locator('.dc-open-sheet').first().click({ timeout: 4000 }).catch(() => {});
    await check('design: Sheet open');
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    await page.locator('.dc-open-modal').first().click({ timeout: 4000 }).catch(() => {});
    await check('design: Modal open');
    await ctx.close(); continue;
  }

  if (only === 'landing') {
    // Site Prompt 2 (Part 3): logo strip, featured work, testimonials, stats.
    await goto('/admin/landing');
    await check('landing: full');
    await goto('/admin/landing?loading=1');
    await check('landing: skeleton');
    await goto('/admin/landing');
    await page.locator('.ld-stat-toggle .v-toggle, .ld-stat-toggle input[type="checkbox"]').first().click({ timeout: 3000 }).catch(() => {});
    await check('landing: a stat toggled off');
    if (width >= 768) {
      await page.locator('.v-menu-trig').first().click({ timeout: 3000 }).catch(() => {});
      await check('landing: row actions menu open');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    }
    await ctx.close(); continue;
  }

  // Site Prompt 7, Part 5: the marketing site is dark only. A light pass
  // here would measure a theme the public host can no longer render, so it
  // is skipped rather than quietly passing against the wrong palette.
  if ((!only || only === 'marketing') && THEME !== 'light') {
    // Site Prompt 1: the public marketing pages, overflow and 44px targets
    // at every width. (The print shop was removed in Site Prompt 6.)
    await goto('/');
    await check('marketing: Home');
    await goto('/services');
    await check('marketing: Services');
    // Site Prompt 3: Clients (renamed from Work), driven by /api/showcase.
    await goto('/clients');
    await check('marketing: Clients (list)');
    await goto('/clients/full-showcase-co');
    await check('marketing: Clients (detail, full showcase)');
    await goto('/clients/brand-only-co');
    await check('marketing: Clients (detail, brand only)');
    // The highlights prompt: circles above the post grid, some linked.
    await goto('/clients/portrait-co');
    await check('marketing: Clients (detail, Instagram highlights)');
    await goto('/clients/does-not-exist');
    await check('marketing: Clients (error state, unknown slug)');
    // /work and /work/:slug: the client-side Navigate fallback (vercel.json
    // does the real 301 for a direct server hit, not reachable from vite preview).
    await goto('/work');
    await page.waitForURL('**/clients', { timeout: 4000 }).catch(() => {});
    if (new URL(page.url()).pathname !== '/clients') throw new Error(`/work did not redirect to /clients (landed on ${page.url()})`);
    await goto('/work/full-showcase-co');
    await page.waitForURL('**/clients/full-showcase-co', { timeout: 4000 }).catch(() => {});
    if (new URL(page.url()).pathname !== '/clients/full-showcase-co') throw new Error(`/work/:slug did not redirect to /clients/:slug (landed on ${page.url()})`);
    // Empty state ("New work is being added...") needs its own mocked /api/showcase,
    // so it runs on a separate page in this same context.
    {
      const emptyPage = await ctx.newPage();
      await emptyPage.addInitScript(([theme, motion]) => { try { localStorage.setItem('vz_theme', theme); localStorage.setItem('vz_boot', '1'); if (motion === 'reduce') localStorage.setItem('vz_motion', 'reduce'); } catch {} }, [THEME, MOTION]);
      await mockRoutes(emptyPage, { empty: ['showcase'] });
      await emptyPage.goto(`${BASE}/clients`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await check('marketing: Clients (empty state)', emptyPage);
      await emptyPage.close();
    }
    // Site Prompt 4: Home with an empty landing object, every client-fed
    // section hidden, the hero still shows its default image.
    {
      const emptyHome = await ctx.newPage();
      await emptyHome.addInitScript(([theme, motion]) => { try { localStorage.setItem('vz_theme', theme); localStorage.setItem('vz_boot', '1'); if (motion === 'reduce') localStorage.setItem('vz_motion', 'reduce'); } catch {} }, [THEME, MOTION]);
      await mockRoutes(emptyHome, { empty: ['showcase'] });
      await emptyHome.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await check('marketing: Home (empty landing)', emptyHome);
      await emptyHome.close();
    }
    await goto('/contact');
    await check('marketing: Contact');
    await goto('/start');
    await check('marketing: Start');
    // The review prompt: /review and /review/<slug>, plus the thank you the
    // form is replaced by (five stars, so the Google button is in it too).
    await goto('/review');
    await check('marketing: Review (no slug)');
    await goto('/review/full-showcase-co');
    await check('marketing: Review (the moment it opens)');
    await page.waitForTimeout(1200);
    await check('marketing: Review (client slug)');
    {
      await page.route('**/api/submissions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"S1"}' }));
      await page.fill('#rvw-name', 'Jamie Owner');
      await page.locator('.rvw-star[data-star="5"]').click();
      await page.fill('#rvw-text', 'Fast, clear, and it landed on the first try.');
      await page.locator('.rvw-btn[type=submit]').click();
      await page.waitForSelector('.rvw-done', { timeout: 5000 }).catch(() => {});
      await check('marketing: Review (thank you)');
      await page.unroute('**/api/submissions').catch(() => {});
    }
    /* The client facing Content Planner (planner prompt 3): both views, the
       detail in a review status and in a settled one, the change request
       form, an empty month, and the dead end a revoked link lands on. */
    await goto('/planner/plnrTESTtoken0123456789abcdEF');
    /* The moment it opens, before anything settles: this is where the
       marketing splash used to be sitting on top of the finished page, and
       it is the one state the stuck overlay check has to see. */
    await check('marketing: Planner (the moment it opens)');
    await page.locator('.pl-legend').first().waitFor({ timeout: 5000 }).catch(() => {});
    /* The calendar is only offered from 430 up, where seven 44px columns
       actually fit; below that the list is the whole story, so this row
       measures whichever view the width can honestly show. */
    await page.locator('.pl-view', { hasText: 'Calendar' }).first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
    await check('marketing: Planner (calendar view)');
    await page.locator('.pl-view', { hasText: 'List' }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await check('marketing: Planner (list view)');
    await page.locator('.pl-row').filter({ hasText: 'Needs your approval' }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await check('marketing: Planner (detail, needs approval)');
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    /* A post on three platforms with hashtags, and a story with no caption
       at all: the two shapes the detail panel has to hold. */
    await page.locator('.pl-row').filter({ hasText: 'Instagram, Facebook, TikTok' }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await check('marketing: Planner (detail, three platforms)');
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    await page.locator('.pl-row').filter({ hasText: 'Story' }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await check('marketing: Planner (detail, a story with no caption)');
    /* The whole image, expanded. A dialog fit to the viewport. */
    await page.locator('button.pl-img--whole').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await check('marketing: Planner (the whole image, expanded)');
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    /* Closed again: the viewer has to take its backdrop with it. */
    await check('marketing: Planner (the whole image, closed again)');
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    await check('marketing: Planner (detail closed, nothing over the page)');
    /* An image whose real shape does not match its format, both ways: a 1:1
       on a story, and a wide one on a portrait post. */
    await page.locator('.pl-row').filter({ hasText: 'Needs your approval' }).last().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await check('marketing: Planner (detail, an image that is not the format shape)');
    await page.locator('.pl-ask-btn').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await check('marketing: Planner (change request form)');
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    await page.locator('.pl-row').filter({ hasText: 'Posted' }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await check('marketing: Planner (detail, a settled post)');
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    await page.locator('.pl-monthnav button').last().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
    await check('marketing: Planner (a month with nothing in it)');
    await goto('/planner/notarealtokenatall000000000');
    await check('marketing: Planner (a link that is not active)');
    if (only === 'marketing') { await ctx.close(); continue; }
  }

  if (!only || only === 'settings') {
  // Settings and Submissions (Prompt 12).
  await goto('/admin/submissions');
  await check('submissions list');
  for (const f of ['Unread', 'Brief', 'Contact', 'Review', 'Shop order', 'Other']) {
    await page.locator('.sb-chips .v-chip', { hasText: new RegExp('^' + f) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`submissions list: ${f.toLowerCase()}`);
    await page.locator('.sb-chips .v-chip', { hasText: /^All/ }).first().click({ timeout: 3000 }).catch(() => {});
  }
  await goto('/admin/submissions?loading=1');
  await check('submissions skeleton');
  await goto('/admin/submissions');
  if (width >= 1024) await page.locator('.v-tr', { hasText: 'Business 5' }).first().click({ timeout: 4000 }).catch(() => {});
  else await page.getByRole('button', { name: /^Open submission from Business 5/ }).first().click({ timeout: 4000 }).catch(() => {});
  await check('submission detail (brief)');
  await page.locator('.sb-open-brief').first().click({ timeout: 3000 }).catch(() => {});
  await check('submission: brief view');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.sb-link').first().click({ timeout: 3000 }).catch(() => {});
  await check('submission: link to lead sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.sb-convert').first().click({ timeout: 3000 }).catch(() => {});
  await check('submission: convert to lead sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await goto('/admin/submissions');
  if (width >= 1024) await page.locator('.v-tr', { hasText: LONG }).first().click({ timeout: 4000 }).catch(() => {});
  else await page.getByRole('button', { name: new RegExp('^Open submission from Philly') }).first().click({ timeout: 4000 }).catch(() => {});
  await check('submission detail (long name, shop order)');

  await goto('/admin/settings');
  await check('settings: profile');
  for (const t of ['Notifications', 'Integrations', 'Data', 'Automation', 'Shortcuts', 'Danger zone']) {
    await page.getByRole('tab', { name: new RegExp('^' + t) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`settings: ${t.toLowerCase()}`);
    if (t === 'Integrations') {
      await page.locator('.st-reconcile').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: reconcile sheet');
      await page.locator('.st-link-event').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: reconcile link to client');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    }
    if (t === 'Data') {
      await page.locator('.st-import-leads').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: lead import sheet');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.locator('.st-import-orders').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: orders csv import sheet');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.evaluate(() => { try { localStorage.setItem('vz_print_orders', JSON.stringify([{ id: 1, date: new Date().toISOString(), source: 'shop', status: 'pending', name: 'Local Person Superlongunbrokenname', email: 'p4@x.com', phone: '', cartItems: [{ productId: 'logo-sticker', productName: 'Logo Die-Cut Sticker', label: 'Qty 100', priceMode: 'sticker', priceTotal: 100, vals: { qty: '100', size: '3 in' } }], summary: 'x', estimatedSubtotal: 100, hasQuoteItems: false }])); } catch {} }).catch(() => {});
      await page.locator('.st-import-device').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: device import preview');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.evaluate(() => localStorage.removeItem('vz_print_orders')).catch(() => {});
    }
  }
  await goto('/admin/settings?loading=1');
  await check('settings skeleton');
  await goto('/admin/settings/deleted');
  await check('settings: recently deleted via nav');
  if (width >= 768) {
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await goto('/admin/settings');
    await check('sidebar collapsed: settings');
    await goto('/admin/submissions');
    await check('sidebar collapsed: submissions');
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await page.evaluate(() => localStorage.removeItem('vz_shell_collapsed')).catch(() => {});
  }
  if (only === 'settings') { await ctx.close(); continue; }

  await goto('/admin');
  await page.evaluate(() => localStorage.removeItem('vz_call_session'));
  await check('dashboard');
  await goto('/admin/?loading=1');
  await check('dashboard skeleton');

  await goto('/admin/orders');
  await check('orders list');

  await goto('/admin/landing');
  await check('landing screen');

  await goto('/admin/design');
  await check('design system (tokens + components)');
  await page.locator('.dc-open-sheet').first().click({ timeout: 4000 }).catch(() => {});
  await check('design: Sheet open');
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('.dc-open-modal').first().click({ timeout: 4000 }).catch(() => {});
  await check('design: Modal open');
  await page.keyboard.press('Escape').catch(() => {});

  await goto('/admin/calls');
  await page.evaluate(() => localStorage.removeItem('vz_call_session')).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await check('call console builder');
  await goto('/admin/calls?loading=1');
  await check('call console skeleton');
  await goto('/admin/calls');
  await page.locator('.cc-start').click({ timeout: 4000 }).catch(() => {});
  await check('call session queue');
  if (width < 1024) { await page.locator('.cc-qcard .lc').first().click({ timeout: 4000 }).catch(() => {}); }
  await check('call room (script)');
  for (const t of ['Objections', 'Close', 'Intel', 'Notes', 'History']) {
    const tab = page.getByRole('tab', { name: new RegExp('^' + t) });
    if (await tab.count()) { await tab.first().click({ timeout: 3000 }).catch(() => {}); await check(`call room (${t.toLowerCase()})`); }
  }
  for (const o of ['booked', 'callback', 'no-answer', 'no', 'wrong-number']) {
    await page.locator('.cc-out--' + o).first().click({ timeout: 4000 }).catch(() => {});
    await check(`outcome sheet: ${o}`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(350);
  }
  if (width >= 1024) {
    await page.locator('.cc-keys-btn').first().click({ timeout: 4000 }).catch(() => {});
    await check('shortcuts modal');
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.locator('.cc-edit-btn').first().click({ timeout: 4000 }).catch(() => {});
  await check('edit lead sheet');
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('vz_call_session')); if (s) { s.mode = 'summary'; localStorage.setItem('vz_call_session', JSON.stringify(s)); } } catch {} }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await check('session summary');
  await page.evaluate(() => localStorage.removeItem('vz_call_session')).catch(() => {});

  for (const v of ['day', 'week', 'month']) {
    await page.evaluate((x) => localStorage.setItem('vz_cal_view', JSON.stringify(x)), v).catch(() => {});
    await goto('/admin/calendar');
    await check(`calendar ${v}`);
    if (v === 'day') {
      for (const f of ['Meetings', 'Callbacks', 'Calendly', 'New leads']) {
        await page.locator('.cal-filters .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
        await check(`calendar day: ${f.toLowerCase()} filter`);
        await page.locator('.cal-filters .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
      }
      await page.locator('.cal-add').first().click({ timeout: 3000 }).catch(() => {});
      await check('calendar: add callback sheet');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.locator('.cal-row .v-ibtn').first().click({ timeout: 3000 }).catch(() => {});
      await page.getByRole('menuitem', { name: 'Link to lead' }).first().click({ timeout: 2000 }).catch(() => {});
      await check('calendar: link to lead sheet');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    }
    if (v === 'week' && width >= 1024) {
      await page.locator('.cal-block').first().click({ timeout: 3000 }).catch(() => {});
      await check('calendar week: event popover');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    }
  }
  await goto('/admin/calendar?loading=1');
  await check('calendar skeleton');

  await goto('/admin/booked');
  await check('booked list');
  for (const f of ['This week', 'Upcoming', 'No date set', 'Needs concepts', 'Awaiting outcome']) {
    await page.locator('.bk-chips .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`booked list: ${f.toLowerCase()}`);
  }
  await page.locator('.bk-chips .v-chip', { hasText: 'All' }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/booked?loading=1');
  await check('booked skeleton');
  await goto('/admin/booked');
  await page.locator('.lc').first().click({ timeout: 4000 }).catch(() => {});
  await check('booked detail (overview)');
  for (const t of ['Playbook', 'Meeting', 'Notes', 'History']) {
    await page.getByRole('tab', { name: new RegExp('^' + t) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`booked detail (${t.toLowerCase()})`);
  }
  await page.locator('.dt-addopt').first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('.dt-addopt').first().click({ timeout: 3000 }).catch(() => {});
  await check('booked detail: three pricing options');
  await page.getByRole('switch', { name: 'Call mode' }).first().click({ timeout: 3000 }).catch(() => {});
  await check('booked detail: call mode on');
  await page.getByRole('switch', { name: 'Call mode' }).first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('.dt-resched').first().click({ timeout: 3000 }).catch(() => {});
  await check('reschedule sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.dt-won').first().click({ timeout: 3000 }).catch(() => {});
  await check('won dialog');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.dt-editall').first().click({ timeout: 3000 }).catch(() => {});
  await check('edit all sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);

  await page.evaluate(() => localStorage.setItem('vz_leads_view', JSON.stringify('kanban'))).catch(() => {});
  await goto('/admin/leads');
  await page.locator('.lc').first().click({ timeout: 4000 }).catch(() => {});
  await check('lead detail (overview, long name)');
  for (const t of ['Playbook', 'Notes', 'History']) {
    await page.getByRole('tab', { name: new RegExp('^' + t) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`lead detail (${t.toLowerCase()})`);
  }

  } // end !only

  if (only !== 'studio') {
  // Clients module (Prompt 10).
  const openClient = async (name) => {
    await goto('/admin/clients');
    if (width >= 1024) await page.locator('.v-tr', { hasText: name }).first().click({ timeout: 4000 }).catch(() => {});
    else await page.getByRole('button', { name: `Open ${name}` }).first().click({ timeout: 4000 }).catch(() => {});
  };
  const clientTab = async (t) => page.getByRole('tab', { name: new RegExp('^' + t) }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/clients');
  await check('clients list');
  for (const f of ['Active project', 'On retainer', 'Delivered', 'Paused', 'Owes a payment', 'Ready to deliver']) {
    await page.locator('.cl-chips .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`clients list: ${f.toLowerCase()}`);
  }
  await page.locator('.cl-chips .v-chip', { hasText: 'All' }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/clients?loading=1');
  await check('clients skeleton');
  await openClient('Lead Business 11');
  await check('client detail (overview, plan client)');
  for (const t of ['Projects', 'Payments', 'Retainer', 'Deliverables', 'Notes', 'History']) {
    await clientTab(t);
    await check(`client detail (${t.toLowerCase()})`);
  }
  /* Site Prompt 7, Part 3: the Showcase editor is its own page now, and its
   * image previews are exactly where a badly shaped upload would show, so
   * this is where the image check earns its keep on the admin side. */
  await goto('/admin/clients/L11/showcase');
  await page.locator('.sc-thumb').first().waitFor({ timeout: 4000 }).catch(() => {});
  await check('showcase editor (published, every section populated)');
  await page.locator('.dt-block-btn').first().click({ timeout: 3000 }).catch(() => {});
  await check('showcase editor (a section collapsed)');
  await goto('/admin/clients/L14/showcase');
  await page.locator('.sc-thumb').first().waitFor({ timeout: 4000 }).catch(() => {});
  await check('showcase editor (portrait and panoramic uploads)');

  /* The Content Planner editor (planner prompt 2, part 6): the page on and
     off, a month with nothing in it, the post editor Sheet, the save bar,
     and the regenerate dialog. The image check earns its keep here too: a
     post thumbnail is a 1:1 box holding whatever shape was uploaded. */
  await goto('/admin/clients/L11/planner');
  await page.locator('.pl-post').first().waitFor({ timeout: 4000 }).catch(() => {});
  await check('planner editor (enabled, a full month)');
  await page.locator('.pl-post .v-stretch').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await check('planner editor (post editor sheet)');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(400);
  /* The Sheet closed again: no backdrop left behind over the page. */
  await check('planner editor (post editor sheet, closed again)');
  /* The two format cases: a story (no hashtag field, a 9:16 preview) and a
     portrait post that cannot go out for approval yet. */
  await page.locator('.pl-post').filter({ hasText: 'Story' }).first().locator('.v-stretch').click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await check('planner editor (post editor sheet, a story)');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(400);
  await page.locator('.pl-post').filter({ hasText: 'Waiting on the photo' }).first().locator('.v-stretch').click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await check('planner editor (post editor sheet, approval blocked)');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.pl-setup textarea').first().fill('An edit, so the save bar is up.').catch(() => {});
  await page.waitForTimeout(500);
  await check('planner editor (save bar shown)');
  await page.locator('.pl-regen').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  await check('planner editor (regenerate dialog)');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await goto('/admin/clients/L13/planner');
  await check('planner editor (disabled)');
  await goto('/admin/clients/L11/planner?month=2030-07');
  await check('planner editor (a month with no posts)');
  /* The save bar is the one floating control on this page, and on a phone
     it has to clear the tab bar completely: the scroll check below is what
     catches it sitting on top of the last card, and the target check is
     what catches Save being cut in half. Toggling Publish is the cheapest
     way to open it. */
  await page.locator('.sc-publish .v-toggle').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await check('showcase editor (save bar shown)');
  /* Story highlights: circular covers in a sideways-scrolling row, which is
     both an image-fit case and an overflow case. */
  await goto('/admin/clients/L14/showcase');
  await page.locator('.dt-block-head, button').filter({ hasText: /^Instagram/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await check('showcase editor (Instagram highlights)');
  await openClient('Lead Business 11');
  await clientTab('Projects');
  await page.locator('.cw-new-project').first().click({ timeout: 3000 }).catch(() => {});
  await check('new project sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.cw-extra-round').first().click({ timeout: 3000 }).catch(() => {});
  await check('log extra round modal');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await clientTab('Payments');
  await check('payment plan block at month 5');
  await page.locator('.cw-mark-paid').first().click({ timeout: 3000 }).catch(() => {});
  await check('mark paid modal');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.cw-add-manual').first().click({ timeout: 3000 }).catch(() => {});
  await check('add manual payment sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await clientTab('Retainer');
  await page.locator('.cw-start-retainer').first().click({ timeout: 3000 }).catch(() => {});
  await check('start retainer sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await clientTab('Deliverables');
  await check('deliverables (toggle disabled)');
  await openClient('Lead Business 13');
  await clientTab('Deliverables');
  await check('deliverables (released, toggle enabled)');
  await clientTab('Projects');
  await check('delivered project (send delivery checklist)');
  await goto('/admin/clients/L13/showcase');
  await check('showcase editor (draft, never published)');
  await openClient('Lead Business 12');
  await clientTab('Retainer');
  await check('retainer (content kit months)');
  await page.locator('.cw-log-delivery').first().click({ timeout: 3000 }).catch(() => {});
  await check('log delivery modal');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await goto('/admin/clients/L12/showcase');
  await check('showcase editor (published, brand only)');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await openClient('Lead Business 10');
  await check('client detail (hostile long name, single project)');
  await clientTab('Payments');
  await check('client detail (owes a payment)');
  await goto('/admin/clients');
  await page.locator('.cl-add').first().click({ timeout: 3000 }).catch(() => {});
  await check('add client sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  if (width >= 768) {
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await check('sidebar collapsed: clients list');
    await openClient('Lead Business 11');
    await check('sidebar collapsed: client detail');
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await page.evaluate(() => localStorage.removeItem('vz_shell_collapsed')).catch(() => {});
  }
  } // end clients block

  // Studio (Prompt 11): print orders, concepts, reviews.
  const openOrder = async (name) => {
    await goto('/admin/orders');
    if (width >= 1024) await page.locator('.v-tr', { hasText: name }).first().click({ timeout: 4000 }).catch(() => {});
    else await page.getByRole('button', { name: new RegExp(`^Open order for ${name}`) }).first().click({ timeout: 4000 }).catch(() => {});
  };
  await goto('/admin/orders');
  await check('orders list (import banner)');
  for (const f of ['New', 'Designed', 'Cut', 'Packed', 'Delivered', 'Cancelled', 'Rush', 'Due this week']) {
    await page.locator('.po-chips .v-chip', { hasText: new RegExp('^' + f) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`orders list: ${f.toLowerCase()}`);
  }
  await page.locator('.po-chips .v-chip', { hasText: /^All/ }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/orders?loading=1');
  await check('orders skeleton');
  await openOrder('Person 0');
  await check('order detail (rush shop order, long names)');
  await page.locator('.po-link-client').first().click({ timeout: 3000 }).catch(() => {});
  await check('order: link to client sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.po-mark-paid').first().click({ timeout: 3000 }).catch(() => {});
  await check('order: mark paid modal');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await openOrder('Lead Business 11');
  await check('order detail (delivered, packaging checklist)');
  await goto('/admin/orders');
  await page.locator('.po-new').first().click({ timeout: 3000 }).catch(() => {});
  await check('new order sheet');
  await page.locator('.po-add-item').first().click({ timeout: 3000 }).catch(() => {});
  await check('new order sheet: item added');
  await page.locator('.po-pick-client').first().click({ timeout: 3000 }).catch(() => {});
  await check('new order: pick a client');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);

  await goto('/admin/concepts');
  await check('concepts grid');
  await page.locator('.cp-kinds .v-chip', { hasText: /^Social/ }).first().click({ timeout: 3000 }).catch(() => {});
  await check('concepts grid: social filter');
  await page.locator('.cp-kinds .v-chip', { hasText: /^Social/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('.cp-inds .v-chip').first().click({ timeout: 3000 }).catch(() => {});
  await check('concepts grid: industry filter');
  await page.locator('.cp-inds .v-chip').first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/concepts?loading=1');
  await check('concepts skeleton');
  await goto('/admin/concepts');
  await page.getByRole('button', { name: /^Open Universal logo directions/ }).first().click({ timeout: 4000 }).catch(() => {});
  for (const h of ['Direction 2', 'Direction 3']) await page.locator('.cp-prompt-head', { hasText: h }).first().click({ timeout: 2000 }).catch(() => {});
  await check('pack detail (prompts expanded)');
  await page.locator('.cp-link-lead').first().click({ timeout: 3000 }).catch(() => {});
  await check('pack: link a lead sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await goto('/admin/concepts');
  await page.locator('.cp-new').first().click({ timeout: 3000 }).catch(() => {});
  await check('new pack sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await goto('/admin/booked');
  await page.locator('.lc').first().click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('tab', { name: /^Meeting/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.getByRole('button', { name: 'Add the usual five' }).first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('.dt-from-library').first().click({ timeout: 3000 }).catch(() => {});
  await check('booked: from library picker');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);

  await goto('/admin/reviews');
  await check('reviews list');
  for (const f of ['Has NFC card', 'No Google link', 'Never asked', 'Asked this month', 'Delivered not asked']) {
    await page.locator('.rv-chips .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`reviews list: ${f.toLowerCase()}`);
  }
  await page.locator('.rv-chips .v-chip', { hasText: /^All/ }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/reviews?loading=1');
  await check('reviews skeleton');
  await goto('/admin/reviews');
  await page.getByRole('button', { name: /^Open reviews for Lead Business 12/ }).first().click({ timeout: 4000 }).catch(() => {});
  await check('review sheet (nfc, counts, asks)');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.rv-link-form').first().click({ timeout: 3000 }).catch(() => {});
  await check('reviews: link form submission');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  if (width >= 768) {
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await goto('/admin/orders');
    await check('sidebar collapsed: orders');
    await goto('/admin/concepts');
    await check('sidebar collapsed: concepts');
    await goto('/admin/reviews');
    await check('sidebar collapsed: reviews');
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await page.evaluate(() => localStorage.removeItem('vz_shell_collapsed')).catch(() => {});
  }
  if (only) { await ctx.close(); continue; }

  await goto('/admin/leads');
  await page.locator('.sh-bell').first().click({ timeout: 4000 }).catch(() => {});
  await check('notifications sheet');
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);

  if (width < 768) {
    await page.locator('.sh-tab--more').click({ timeout: 4000 }).catch(() => {});
    await check('mobile More sheet');
    await page.keyboard.press('Escape').catch(() => {});
  } else {
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await check('sidebar collapsed: leads list');
    await goto('/admin');
    await check('sidebar collapsed: dashboard');
    await goto('/admin/?loading=1');
    await check('sidebar collapsed: dashboard skeleton');
    await goto('/admin/calls');
    await check('sidebar collapsed: call console builder');
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await page.evaluate(() => localStorage.removeItem('vz_shell_collapsed')).catch(() => {});
  }

  await ctx.close();
}

await browser.close();
if (failures) {
  console.log(`\n${failures} failing view(s). Fix before shipping.`);
  process.exit(1);
}
console.log('\nAll routes clean at every width, zero offenders.');
