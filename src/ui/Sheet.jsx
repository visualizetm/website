import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import useFocusTrap from './useFocusTrap';
import useScrollLock from './useScrollLock';
import useMediaQuery, { DESKTOP_QUERY } from './useMediaQuery';
import { portalRoot } from './portal';
/**
 * Sheet: bottom sheet on mobile (drag handle, sized to content, swipe down to
 * dismiss, respects --v-safe-bottom), right side panel on desktop. Focus trap,
 * scroll lock, Escape closes, z from --v-z-sheet.
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose
 * @param {import('react').ReactNode} [props.title]
 * @param {import('react').ReactNode} [props.description]
 * @param {import('react').ReactNode} [props.footer] pinned action row
 * @param {number|string} [props.width=420] desktop panel width
 * @param {boolean} [props.tall] mobile: take the full height instead of fitting content
 * @param {string} [props.label] aria-label when there is no title
 */
export default function Sheet({ open, onClose, title, description, footer, width = 420, tall = false, label, className = '', children }) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const drag = useRef(null);
  const boxRef = useRef(null);
  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); setDragY(0); return undefined; }
    if (!mounted) return undefined;
    setClosing(true);
    const t = setTimeout(() => { setMounted(false); setClosing(false); }, 260);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useScrollLock(mounted);
  useFocusTrap(boxRef, open && mounted, { onEscape: close });

  const onPointerDown = (e) => {
    if (desktop) return;
    drag.current = { y0: e.clientY, t0: performance.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => { if (drag.current) setDragY(Math.max(0, e.clientY - drag.current.y0)); };
  const onPointerUp = (e) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.y0;
    const v = dy / Math.max(1, performance.now() - drag.current.t0);
    drag.current = null;
    if (dy > 110 || v > 0.6) close(); else setDragY(0);
  };

  if (!mounted) return null;
  const root = portalRoot();
  if (!root) return null;
  return createPortal(
    <div className={`v-sheet-back${closing ? ' is-closing' : ''}`} onClick={close}>
      <div ref={boxRef} className={`v-sheet ${desktop ? 'v-sheet--side' : 'v-sheet--bottom'}${tall ? ' v-sheet--tall' : ''}${closing ? ' is-closing' : ''} ${className}`.trim()}
        role="dialog" aria-modal="true" aria-label={title ? undefined : label} aria-labelledby={title ? 'v-sheet-title' : undefined} tabIndex={-1}
        style={{ width: desktop ? (typeof width === 'number' ? `${width}px` : width) : undefined, transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? 'none' : undefined }}
        onClick={(e) => e.stopPropagation()}>
        {!desktop && <div className="v-sheet-handle" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}><span /></div>}
        {(title || description) && (
          <header className="v-sheet-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <div className="v-sheet-text">
              {title && <h2 id="v-sheet-title" className="v-sheet-title">{title}</h2>}
              {description && <p className="v-sheet-desc">{description}</p>}
            </div>
            <button type="button" className="v-sheet-x" onClick={close} aria-label="Close"><XClose width={18} height={18} /></button>
          </header>
        )}
        <div className="v-sheet-body">{children}</div>
        {footer && <footer className="v-sheet-foot">{footer}</footer>}
      </div>
    </div>,
    root,
  );
}

export const sheetStyles = `
  .v-sheet-back { position: fixed; inset: 0; z-index: var(--v-z-sheet); background: var(--v-overlay); backdrop-filter: blur(3px); display: flex; align-items: flex-end; justify-content: center; animation: v-fade var(--v-dur-base) var(--v-ease-out) both; }
  .v-sheet-back.is-closing { animation: v-fade var(--v-dur-base) var(--v-ease-out) reverse both; }
  @keyframes v-fade { from { opacity: 0; } to { opacity: 1; } }
  .v-sheet { display: flex; flex-direction: column; min-width: 0; background: var(--v-surface-1); border: 1px solid var(--v-border-strong); color: var(--v-text); box-shadow: var(--v-shadow-3); outline: 0; }
  .v-sheet--bottom { width: 100%; max-height: calc(100dvh - var(--v-space-8) - var(--v-inset-top)); border-radius: var(--v-radius-xl) var(--v-radius-xl) 0 0; border-bottom: 0; padding-bottom: var(--v-inset-bottom); animation: v-sheet-up var(--v-dur-slow) var(--v-ease-out) both; transition: transform var(--v-dur-base) var(--v-ease-out); }
  .v-sheet--bottom.v-sheet--tall { height: calc(100dvh - var(--v-space-8) - var(--v-inset-top)); }
  .v-sheet--bottom.is-closing { animation: v-sheet-up var(--v-dur-base) var(--v-ease-out) reverse both; }
  @keyframes v-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .v-sheet--side { position: absolute; top: 0; right: 0; bottom: 0; max-width: 100%; height: 100%; border-top: 0; border-bottom: 0; border-right: 0; animation: v-sheet-in var(--v-dur-slow) var(--v-ease-out) both; }
  .v-sheet--side.is-closing { animation: v-sheet-in var(--v-dur-base) var(--v-ease-out) reverse both; }
  @keyframes v-sheet-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  .v-sheet-handle { display: flex; justify-content: center; padding: var(--v-space-3) 0 var(--v-space-1); touch-action: none; cursor: grab; flex-shrink: 0; }
  .v-sheet-handle span { width: 40px; height: 5px; border-radius: var(--v-radius-pill); background: var(--v-border-strong); }
  .v-sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--v-space-3); padding: var(--v-space-3) var(--v-space-5) var(--v-space-3); flex-shrink: 0; touch-action: none; }
  .v-sheet--side .v-sheet-head { padding-top: var(--v-space-5); border-bottom: 1px solid var(--v-border); touch-action: auto; }
  .v-sheet-text { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; }
  .v-sheet-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); }
  .v-sheet-desc { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .v-sheet-x { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); margin: -6px -10px 0 0; border-radius: var(--v-radius-md); border: 0; background: transparent; color: var(--v-text-2); cursor: pointer; }
  .v-sheet-x:hover { background: var(--v-surface-2); color: var(--v-text); }
  .v-sheet-x:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-sheet-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: var(--v-space-2) var(--v-space-5) var(--v-space-5); display: flex; flex-direction: column; gap: var(--v-space-4); }
  .v-sheet-foot { flex-shrink: 0; display: flex; gap: var(--v-space-2); justify-content: flex-end; padding: var(--v-space-3) var(--v-space-5); border-top: 1px solid var(--v-border); background: var(--v-surface-1); }
  .v-sheet-foot > .v-btn { flex: 1; }
  .v-sheet--side .v-sheet-foot > .v-btn { flex: 0 1 auto; }
`;
