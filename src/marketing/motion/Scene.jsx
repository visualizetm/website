// Scene: the one scroll primitive Home is built on (Site Prompt 11).
//
// A Scene pins its stage to the viewport for exactly steps * stepDistance
// viewports of scroll and exposes progress 0 to steps as --scene-p on its
// root, scrubbed to scroll, with no React render per frame. Children say
// which step they belong to with data-step="n": a child at step n is
// hidden until progress reaches n minus 1, reveals over 0.35 of a step
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
export const REVEAL_SPAN = 0.35;   // of a step: how long a child takes to reveal once its step begins

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
    let trigger = null; let alive = true; let last = ''; let lastActive = 0;
    const stopNear = whenNear(root, () => loadScrollEngine().then((eng) => {
      if (!alive || !eng || !rootRef.current) return;
      const absTop = () => { let t = 0; for (let n = root; n; n = n.offsetParent) t += n.offsetTop; return t; };
      const hold = () => Math.max(1, root.offsetHeight - (root.firstElementChild?.offsetHeight || 0));
      trigger = eng.ScrollTrigger.create({
        trigger: root,
        start: () => absTop(),
        end: () => absTop() + hold(),
        scrub: scrubValue(),
        onUpdate: (self) => {
          const p = self.progress * steps;
          const next = p.toFixed(3);
          if (next !== last) {
            last = next;
            root.style.setProperty('--scene-p', next);
            cb.current?.(p, root);
            const a = Math.max(1, Math.min(steps, Math.floor(p + 1e-6) + 1));
            if (a !== lastActive) { lastActive = a; setActive(a); }
          }
        },
      });
    }));
    return () => { alive = false; stopNear(); trigger?.kill(); };
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
    const top = positionFor(root, i - 1 + REVEAL_SPAN, steps);
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
