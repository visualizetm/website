import { useRef, useState } from 'react';
import { Icon } from './icons';
import { durationMs } from './motion';
/**
 * SwipeRow (CRM mobile revamp, milestone 5): a row with a fast action under each thumb direction, and a long press.
 *
 * The row follows the finger; the action it reveals names itself; past the threshold the label arms, and releasing
 * there runs the action. Releasing short of it springs back and nothing happens. A long press (no movement for
 * HOLD ms) calls onHold instead, and the tap that would follow is swallowed. Every action must also exist in the row's
 * menu or a sheet: this is a shortcut, never the only way. It only listens for a touch, only on a phone, and gives up
 * the moment the touch turns vertical (the list scrolls) or starts on something that scrolls sideways.
 *
 * @param {object} props
 * @param {{label: string, icon?: string, tone?: 'primary'|'danger'|'callback', onCommit: Function}} [props.right] revealed by dragging right
 * @param {{label: string, icon?: string, tone?: 'primary'|'danger'|'callback', onCommit: Function}} [props.left] revealed by dragging left
 * @param {Function} [props.onHold] long press
 * @param {boolean} [props.enabled=true] false renders the children alone (a computer, a select mode)
 * @param {Function} [props.gate] (touchstart event) => false leaves this touch alone (the doc editor does not swipe a block whose text has focus)
 */
export const SWIPE_AT = 88; // px past which a release commits
export const HOLD_MS = 500;
const MAX = 140;

export default function SwipeRow({ right, left, onHold, enabled = true, gate, className = '', children }) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const st = useRef(null);
  const swallow = useRef(0);
  if (!enabled) return children;
  const reset = () => { setDrag(false); setDx(0); };
  const cancelTimer = () => { if (st.current?.timer) clearTimeout(st.current.timer); };
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    if (gate && !gate(e)) return;
    for (let n = e.target; n && n !== e.currentTarget; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return;
    }
    const t = e.touches[0];
    st.current = { x: t.clientX, y: t.clientY, axis: null, timer: onHold ? setTimeout(() => { if (st.current && !st.current.axis) { st.current.held = true; swallow.current = Date.now(); onHold(); } }, HOLD_MS) : 0 };
  };
  const onTouchMove = (e) => {
    const s = st.current; if (!s || s.held) return;
    const t = e.touches[0]; const ddx = t.clientX - s.x; const ddy = t.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      cancelTimer();
      if (Math.abs(ddy) >= Math.abs(ddx) * 0.9 || (ddx > 0 && !right) || (ddx < 0 && !left)) { st.current = null; return; }
      s.axis = 'x'; setDrag(true);
    }
    if (e.cancelable) e.preventDefault();
    const side = ddx > 0 ? right : left;
    setDx(side ? Math.max(-MAX, Math.min(MAX, ddx)) : 0);
  };
  const onTouchEnd = (e) => {
    const s = st.current; st.current = null; cancelTimer();
    /* A long press ends without a tap: the click a browser may synthesize on release would land on what the sheet put under the finger. */
    if (s?.held && e.cancelable) e.preventDefault();
    if (!s?.axis) return;
    const d = dx; reset();
    if (d >= SWIPE_AT) { swallow.current = Date.now(); right?.onCommit?.(); } else if (d <= -SWIPE_AT) { swallow.current = Date.now(); left?.onCommit?.(); }
  };
  const onTouchCancel = () => { cancelTimer(); st.current = null; reset(); };
  /* The tap that follows a long press or a committed swipe is not a tap. */
  const onClickCapture = (e) => { if (Date.now() - swallow.current < 700) { e.stopPropagation(); e.preventDefault(); } };
  const armedR = dx >= SWIPE_AT; const armedL = dx <= -SWIPE_AT;
  const ms = durationMs('--v-dur-base');
  const hint = (side, spec, armed) => spec && (
    <span className={`v-swipe-hint v-swipe-hint--${side} v-swipe-hint--${spec.tone || 'primary'}${armed ? ' is-armed' : ''}`} aria-hidden="true">
      {spec.icon && <Icon icon={spec.icon} size={16} />} {spec.label}
    </span>
  );
  return (
    <div className={`v-swipe${drag ? ' is-dragging' : ''} ${className}`.trim()} data-swipe={drag ? (armedR || armedL ? 'armed' : 'dragging') : 'idle'}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel} onClickCapture={onClickCapture}>
      {dx > 0 && hint('right', right, armedR)}
      {dx < 0 && hint('left', left, armedL)}
      <div className="v-swipe-fg" style={{ transform: dx ? `translate3d(${dx}px, 0, 0)` : undefined, transition: drag ? 'none' : ms ? `transform ${ms}ms var(--v-ease-out)` : 'none' }}>{children}</div>
    </div>
  );
}

export const swipeRowStyles = `
  .v-swipe { position: relative; border-radius: var(--v-radius-lg); touch-action: pan-y; }
  .v-swipe-fg { position: relative; z-index: 1; will-change: transform; }
  .v-swipe-hint { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; gap: var(--v-space-2); padding: 0 var(--v-space-4); border-radius: var(--v-radius-lg); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); }
  .v-swipe-hint--right { left: 0; right: 40%; justify-content: flex-start; }
  .v-swipe-hint--left { right: 0; left: 40%; justify-content: flex-end; }
  .v-swipe-hint--primary { background: var(--v-status-booked-soft); color: var(--v-status-booked-text); }
  .v-swipe-hint--callback { background: var(--v-status-callback-soft); color: var(--v-status-callback-text); }
  .v-swipe-hint--danger { background: var(--v-status-danger-soft); color: var(--v-status-danger-text); }
  .v-swipe-hint.is-armed { outline: 2px solid currentColor; outline-offset: -2px; }
`;
