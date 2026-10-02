import { useEffect, useRef } from 'react';
import { snapshotFor } from './nav-history';
import { durationMs } from '../ui/motion';

/* Interactive Back (CRM mobile revamp, milestone 3).
 *
 * A touch that starts within EDGE px of the left edge and moves right drags the current screen with the
 * finger. Under it, the screen it returns to shows (a static copy kept by nav-history.js at the push, or the
 * plain ground when it was too large to copy), shifted a third of the width to the left and sliding to rest
 * as the finger moves. Release past COMMIT of the width, or with a flick, slides the screen away and calls the
 * same Back the top bar calls (a screen's own leave guard included); anything less springs back.
 *
 * It never starts on a horizontally scrolling area, never on a phone with a dialog open, never at a section
 * root (there is no Back), and the browser's and the OS's own back gestures keep working: this only handles
 * a touch it can use. Every state is written to data-edge-back on .sh-col for the gesture test.
 * Reduced motion shortens the slide and the spring to nothing; the finger is still followed. */
export const EDGE = 24;
export const COMMIT = 0.4;
export const FLICK = 0.5; // px per ms
const PEEK = 1 / 3;

export function useEdgeBack({ enabled, onBack, idx, locKey }) {
  const live = useRef({});
  live.current = { enabled, onBack, idx, locKey };
  useEffect(() => {
    const col = document.querySelector('.sh-col');
    if (!col) return undefined;
    let g = null;
    const setState = (s) => { if (s) col.dataset.edgeBack = s; else delete col.dataset.edgeBack; };
    const isSideways = (el) => {
      for (let n = el; n && n !== col; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true;
      }
      return false;
    };
    const apply = (dx) => {
      const W = window.innerWidth; const p = Math.min(1, dx / W);
      g.main.style.transform = `translate3d(${dx}px, 0, 0)`;
      if (g.peek) { g.peek.style.transform = `translate3d(${(-(1 - p) * W * PEEK).toFixed(1)}px, 0, 0)`; g.peek.style.setProperty('--sh-peek-dim', String((1 - p) * 0.5)); }
    };
    const cleanup = () => {
      if (!g) return;
      const { main, peek } = g;
      main.style.transition = ''; main.style.transform = ''; main.style.boxShadow = ''; main.style.background = ''; main.style.willChange = '';
      peek?.remove();
      g = null; setState(null);
    };
    const settle = (to, done) => {
      const ms = durationMs('--v-dur-base');
      g.main.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none';
      if (g.peek) g.peek.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none';
      apply(to);
      setTimeout(done, ms + 20);
    };
    const begin = () => {
      const main = col.querySelector('.sh-content'); if (!main) { g = null; return false; }
      g.main = main;
      const peek = document.createElement('div');
      peek.className = 'sh-peek'; peek.setAttribute('aria-hidden', 'true');
      peek.style.top = `${main.offsetTop}px`; peek.style.height = `${main.offsetHeight}px`;
      const snap = snapshotFor((live.current.idx || 0) - 1);
      if (snap) peek.appendChild(snap.cloneNode(true));
      col.insertBefore(peek, main);
      g.peek = peek;
      main.style.willChange = 'transform'; main.style.background = 'var(--v-ground)'; main.style.boxShadow = '-12px 0 24px rgba(0, 0, 0, 0.35)';
      setState('dragging');
      return true;
    };
    const onStart = (e) => {
      const L = live.current;
      if (g || !L.enabled || e.touches.length !== 1 || window.innerWidth >= 768) return;
      if (document.querySelector('[role="dialog"]')) return;
      const t = e.touches[0];
      if (t.clientX > EDGE || isSideways(e.target)) return;
      g = { x0: t.clientX, y0: t.clientY, t0: performance.now(), dx: 0, axis: null, main: null, peek: null };
    };
    const onMove = (e) => {
      if (!g || g.settling) return;
      const t = e.touches[0]; const dx = t.clientX - g.x0; const dy = t.clientY - g.y0;
      if (!g.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (!(dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2) || !begin()) { g = null; return; }
        g.axis = 'x';
      }
      if (e.cancelable) e.preventDefault();
      g.dx = Math.max(0, dx);
      apply(g.dx);
    };
    const finish = () => {
      const keyBefore = live.current.locKey;
      g.settling = true;
      setState('commit');
      settle(window.innerWidth, () => {
        live.current.onBack?.();
        /* A leave guard may have kept the screen: when the entry did not change, the screen springs back. */
        setTimeout(() => {
          if (!g) return;
          if (live.current.locKey === keyBefore) { setState('cancel'); settle(0, cleanup); } else requestAnimationFrame(() => requestAnimationFrame(cleanup));
        }, 360);
      });
    };
    const onEnd = () => {
      if (!g) return;
      if (g.axis !== 'x' || g.settling) { if (!g.settling) g = null; return; }
      const W = window.innerWidth; const v = g.dx / Math.max(1, performance.now() - g.t0);
      if (g.dx > W * COMMIT || (v > FLICK && g.dx > 40)) finish();
      else { g.settling = true; setState('cancel'); settle(0, cleanup); }
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      cleanup();
    };
  }, []);
}

export const edgeBackStyles = `
  .sh-col { position: relative; }
  .sh-peek { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--v-ground); pointer-events: none; will-change: transform; }
  .sh-peek > * { flex: 1; min-height: 0; }
  .sh-peek::after { content: ''; position: absolute; inset: 0; background: black; opacity: var(--sh-peek-dim, 0.5); }
`;
