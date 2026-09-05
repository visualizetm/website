import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useFocusTrap from './useFocusTrap';
import { portalRoot } from './portal';
/**
 * Popover: floating panel anchored to an element. Used by Menu and by the
 * command bar results. Closes on Escape, outside click, and scroll of an ancestor.
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose
 * @param {import('react').RefObject} props.anchorRef ref to the trigger element
 * @param {'start'|'end'|'stretch'} [props.align='start'] stretch = match the anchor width
 * @param {'bottom'|'top'} [props.side='bottom']
 * @param {number|string} [props.width] fixed width
 * @param {boolean} [props.trap=false] trap focus inside (menus yes, typeahead results no)
 * @param {string} [props.z='var(--v-z-command)']
 * @param {string} [props.label]
 */
export default function Popover({ open, onClose, anchorRef, align = 'start', side = 'bottom', width, trap = false, z = 'var(--v-z-command)', label, className = '', children }) {
  const boxRef = useRef(null);
  const [pos, setPos] = useState(null);
  // The box mounts once it is placed, so the trap arms on `pos`, not on `open` alone (Prompt 15).
  useFocusTrap(boxRef, open && trap && !!pos, { onEscape: onClose });
  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return undefined;
    const place = () => {
      const r = anchorRef.current.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const w = typeof width === 'number' ? width : align === 'stretch' ? r.width : Math.min(280, vw - 16);
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, vw - w - 8));
      const below = vh - r.bottom;
      const useTop = side === 'top' || (below < 200 && r.top > below);
      setPos({ left, width: w, top: useTop ? undefined : r.bottom + 6, bottom: useTop ? vh - r.top + 6 : undefined, maxH: Math.max(120, (useTop ? r.top : below) - 16) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, anchorRef, align, side, width]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!boxRef.current?.contains(e.target) && !anchorRef?.current?.contains(e.target)) onClose?.(); };
    const onKey = (e) => { if (e.key === 'Escape' && !trap) onClose?.(); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey); };
  }, [open, onClose, anchorRef, trap]);
  if (!open || !pos) return open && !pos ? null : null;
  const root = portalRoot();
  if (!root) return null;
  return createPortal(
    <div ref={boxRef} className={`v-pop ${className}`.trim()} role={trap ? 'dialog' : undefined} aria-label={label} tabIndex={-1}
      style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH, zIndex: z }}>
      {children}
    </div>,
    root,
  );
}
export const popoverStyles = `
  .v-pop { display: flex; flex-direction: column; min-width: 0; overflow: auto; overscroll-behavior: contain; background: var(--v-surface-2); border: 1px solid var(--v-border-strong); border-radius: var(--v-radius-md); box-shadow: var(--v-shadow-3); color: var(--v-text); outline: 0; animation: v-pop-in var(--v-dur-base) var(--v-ease-out) both; }
  @keyframes v-pop-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
`;
