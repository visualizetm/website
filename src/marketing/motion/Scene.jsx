// Scene: the one scroll primitive Home is built on (Site Prompt 11).
//
// A Scene pins its stage to the viewport for exactly steps * stepDistance
// viewports of scroll and exposes progress 0 to steps as --scene-p on its
// root, scrubbed to scroll, with no React render per frame. Children say
// which step they belong to with data-step="n": a child at step n is
// hidden until progress reaches n minus 1.35, reveals over 0.35 of a step
// (a fade and a 16px rise, or whatever a data-reveal="custom" child does
// with --sr), and then stays revealed for the rest of the scene. Nothing
// that has revealed hides while the scene is pinned; scrolling back
// reverses exactly, because every frame is a pure function of scroll.
//
// The stage is exactly one viewport tall, its content vertically centred,
// and the layout of the fully revealed stage is what is centred: children
// not yet revealed occupy their final space at opacity 0, so nothing moves
// as steps arrive and no heading ever sits over a hole that later fills.
// The stage sits under the sticky navbar by --nav-h so nothing overlaps
// it. On release the next scene arrives under this one as it scrolls away
// in normal flow: no curtain, no scale, no dim, one brand hairline along
// the stage's top edge from the moment it enters.
//
// steps=0 is not pinned: a normal section whose data-step children reveal
// on entering the viewport, in data-step order. Reduced motion and no
// engine render every child fully revealed with no pinning.
//
// Sticky, not ScrollTrigger's pin: the pin spacer and the sticky panel
// are the same CSS numbers (the root's height and the stage's), so they
// can never disagree, and no ancestor of a Scene carries a transform or
// clips, so sticky never silently stops. See docs/SCENE-ENGINE.md.
import { useEffect, useRef, useState } from 'react';
import { getScrollEngine, loadScrollEngine, scrubValue } from '../scroll';
import { cx, useMediaQuery, useMotionPreference } from './shared';
import { useScrollEngine, whenNear } from './useScroll';

const PHONE = '(max-width: 767px)';
export const REVEAL_SPAN = 0.35;   // of a step: how long a child takes to reveal
/** Where step n begins revealing: 0.35 of a step before its beat, so step 1 is
 * on screen at progress 0 and the last step holds a full beat before release. */
export const revealStart = (n) => n - 1 - REVEAL_SPAN;
/** A child's reveal, 0 to 1, at progress p: the same number the CSS computes. */
export const stepReveal = (p, n) => Math.max(0, Math.min(1, (p - revealStart(n)) / REVEAL_SPAN));

/** The page position at which `scene`'s progress is `p` (layout offsets, transform-free). */
function positionFor(root, p, steps) {
  let top = 0;
  for (let n = root; n; n = n.offsetParent) top += n.offsetTop;
  const stage = root.firstElementChild;
  const hold = Math.max(0, root.offsetHeight - (stage?.offsetHeight || 0));
  return top + (steps ? (p / steps) * hold : 0);
}

export function Scene({
  as: Tag = 'section',
  steps = 0,
  stepDistance = 0.7,
  mobileStepDistance = 0.4,   // 0.5 in the brief; 0.45 and then 0.4 were the allowed fallbacks for the length budget (see the Site Prompt 11 report)
  tone = 'a',
  label,
  indicator = false,
  indicatorLabels = null,
  indicatorLabel = 'Steps',
  onProgress = null,
  className = '',
  stageClassName = '',
  bodyClassName = '',
  backdrop = null,
  children,
  ...rest
}) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const bodyRef = useRef(null);
  const cb = useRef(onProgress);
  cb.current = onProgress;
  const state = useScrollEngine();
  const reduced = useMotionPreference();
  const phone = useMediaQuery(PHONE);
  const [active, setActive] = useState(1);
  const d = phone ? mobileStepDistance : stepDistance;
  const pinned = steps > 0 && state !== 'off';
  const flow = steps === 0 && !reduced;

  /* data-step="n" becomes --step: n on the element, so its CSS can compute
   * its own reveal from --scene-p. Every render, because children change
   * (the hero's covers arrive with the CRM data); a write only when the
   * value differs, so this is a cheap walk, never a style storm. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    for (const el of stage.querySelectorAll('[data-step]')) {
      const n = String(Number(el.getAttribute('data-step')) || 0);
      if (el.style.getPropertyValue('--step') !== n) el.style.setProperty('--step', n);
    }
  });

  /* Pinned: one scrubbed trigger over the hold, created once the scene is
   * near (whenNear), writing --scene-p and the indicator's active step. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !pinned || state !== 'on') return undefined;
    let trigger = null; let approach = null; let alive = true; let last = ''; let lastActive = 0;
    const body = bodyRef.current;
    /* The visible part of the stack is what is centred (Site Prompt 12,
     * bug 1). Centring the fully revealed layout left the reserved space
     * of the steps still to come as one blank band under the content:
     * a third of a phone's viewport at the hero's first step. So the
     * body is shifted down by half of what has not arrived yet, and
     * drifts up as each step lands. The heights come from layout offsets
     * once per refresh (H[k] is the stack's height with steps 0..k in);
     * per frame it is arithmetic and one style write. Transform only. */
    let H = []; let B = 0; let Hwrap = 0; let entry = 1; let lastP = 0; let padTop = 0; let cap = 0;
    const measure = () => {
      if (!body) return;
      B = body.clientHeight; Hwrap = body.firstElementChild?.offsetHeight || 0;
      padTop = parseFloat(getComputedStyle(root.firstElementChild).paddingTop) || 0;
      /* The most the block may sit below the navbar: 15 percent of the
       * viewport, less the stage's own gap under the navbar. */
      cap = Math.max(0, 0.14 * window.innerHeight - 12);
      const rel = (el) => { let t = 0; for (let n = el; n && n !== body; n = n.offsetParent) t += n.offsetTop; return t; };
      /* A data-step child that is display: none at this width (a desktop only
         deck) has no height and no place, and must not set the stack's top. */
      const items = [...body.querySelectorAll('[data-step]')].filter(el => el.offsetHeight > 0).map(el => ({ n: Number(el.getAttribute('data-step')) || 0, top: rel(el), bottom: rel(el) + el.offsetHeight }));
      const all = items.length ? items : [{ n: 0, top: 0, bottom: body.scrollHeight }];
      const top0 = Math.min(...all.map(i => i.top));
      H = [];
      for (let k = 0; k <= steps; k++) {
        const seen = all.filter(i => i.n <= k);
        H[k] = seen.length ? Math.max(...seen.map(i => i.bottom)) - top0 : 0;
      }
    };
    /* The drift leads the reveal by a third of a window: most of the move up
     * has happened before the arriving item is more than faintly visible,
     * so an item is never inside the indicator's box while it can be
     * seen, and the block is never more than a sixth of an item off centre.
     * The visible height is H[0] plus each step's own reveal (the same
     * 0.35 window the CSS uses) times the height that step adds. */
    /* Where the visible block sits (Site Prompt 12, bug 1): centred in the
     * body when it is tall enough, otherwise no lower than the cap, so a
     * short first step (one heading, one line) sits near the top and the
     * list builds downward from there rather than hanging in the middle of
     * a black stage. The static layout centres the full stack by auto
     * margins; this is the correction from that. While the stage is still
     * entering from below the body also loses the stage's top padding
     * (nothing is over it yet), blended back over the last tenth of the
     * entry, so the block stays put in the viewport while the stage's
     * edge slides up under it. Transform only, scrubbed. */
    const shift = (p) => {
      if (!body || !H.length) return;
      lastP = p;
      const q = p + 0.35 * REVEAL_SPAN;
      let visible = H[0];
      for (let n = 1; n <= steps; n++) visible += stepReveal(q, n) * (H[n] - H[n - 1]);
      /* No lower than the cap, and never lower than where the fully
       * revealed block will sit, so the block is centred once everything
       * has arrived even on a tall viewport where that is below the cap. */
      const floor = Math.max(cap, Math.max(0, (B - Hwrap) / 2));
      const want = Math.min(floor, Math.max(0, (B - visible) / 2));
      const k = Math.max(0, Math.min(1, (entry - 0.9) / 0.1));
      const total = want - (B - Hwrap) / 2 - (1 - k) * padTop;
      body.style.setProperty('--scene-shift', `${total.toFixed(1)}px`);
    };
    const stopNear = whenNear(root, () => loadScrollEngine().then((eng) => {
      if (!alive || !eng || !rootRef.current) return;
      const absTop = () => { let t = 0; for (let n = root; n; n = n.offsetParent) t += n.offsetTop; return t; };
      const hold = () => Math.max(1, root.offsetHeight - (root.firstElementChild?.offsetHeight || 0));
      measure(); shift(0);
      approach = eng.ScrollTrigger.create({
        trigger: root,
        start: () => absTop() - window.innerHeight,
        end: () => absTop(),
        scrub: scrubValue(),
        onUpdate: (self) => { const e = self.progress; if (Math.abs(e - entry) > 0.002) { entry = e; shift(lastP); } },
        onRefresh: (self) => { entry = self.progress; },
      });
      trigger = eng.ScrollTrigger.create({
        trigger: root,
        start: () => absTop(),
        end: () => absTop() + hold(),
        scrub: scrubValue(),
        onRefresh: (self) => { measure(); shift(self.progress * steps); },
        onUpdate: (self) => {
          const p = self.progress * steps;
          const next = p.toFixed(3);
          if (next !== last) {
            last = next;
            root.style.setProperty('--scene-p', next);
            shift(p);
            cb.current?.(p, root);
            const a = Math.max(1, Math.min(steps, Math.floor(p + REVEAL_SPAN + 1e-6) + 1));
            if (a !== lastActive) { lastActive = a; setActive(a); }
          }
        },
      });
    }));
    return () => { alive = false; stopNear(); trigger?.kill(); approach?.kill(); body?.style.removeProperty('--scene-shift'); };
  }, [pinned, state, steps]);

  /* Not pinned: data-step children reveal on entering the viewport, once,
   * in data-step order (a small stagger), through one observer. */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !flow || typeof IntersectionObserver === 'undefined') return undefined;
    const els = body.querySelectorAll('[data-step]');
    if (!els.length) return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.setAttribute('data-in', ''); io.unobserve(e.target); }
    }, { threshold: 0.15 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [flow, children]);

  const goTo = (i) => {
    const root = rootRef.current;
    if (!root) return;
    const top = positionFor(root, Math.max(0, i - 1), steps);
    const eng = getScrollEngine();
    if (eng?.lenis) eng.lenis.scrollTo(top);
    else window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  };

  const mode = pinned ? 'm-scene--pinned' : flow ? 'm-scene--flow' : 'm-scene--static';
  return (
    <Tag
      ref={rootRef}
      className={cx('m-scene', mode, `m-scene--tone-${tone === 'b' ? 'b' : 'a'}`, className)}
      style={{ '--scene-steps': steps, '--scene-d': d }}
      {...rest}
    >
      <div ref={stageRef} className={cx('m-scene-stage', stageClassName)} role="region" aria-label={label}>
        {/* The backdrop fills the whole stage behind the body (the hero's
            cover deck): scenery, not content, so it may sit under the
            navbar and does not count toward the body's fit. Its data-step
            children reveal like any other. */}
        {backdrop && <div className="m-scene-backdrop" aria-hidden="true">{backdrop}</div>}
        <div ref={bodyRef} className={cx('m-scene-body', bodyClassName)}>
          {children}
        </div>
        {pinned && indicator && steps > 1 && (
          <div className="m-scene-steps" role="tablist" aria-label={indicatorLabel}>
            {Array.from({ length: steps }, (_, k) => k + 1).map(i => (
              <button
                key={i}
                type="button"
                role="tab"
                className={cx('m-scene-seg', i === active && 'is-active')}
                style={{ '--seg-i': i }}
                aria-selected={i === active}
                aria-label={`${indicatorLabels?.[i - 1] || `Step ${i}`}, ${i} of ${steps}`}
                onClick={() => goTo(i)}
              >
                <span className="m-scene-seg-fill" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Tag>
  );
}
