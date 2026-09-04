import { cloneElement, useId, useState } from 'react';
import useMediaQuery, { HOVER_QUERY } from './useMediaQuery';
/**
 * Tooltip: desktop only (hover + focus on fine pointers). On touch devices
 * the child renders alone; keep its aria-label for screen readers.
 * @param {object} props
 * @param {string} props.label
 * @param {'top'|'bottom'} [props.side='top']
 * @param {import('react').ReactElement} props.children a single focusable element
 */
export default function Tooltip({ label, side = 'top', children }) {
  const canHover = useMediaQuery(HOVER_QUERY);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!canHover || !label) return children;
  const child = cloneElement(children, {
    'aria-describedby': open ? id : children.props['aria-describedby'],
    onMouseEnter: (e) => { children.props.onMouseEnter?.(e); setOpen(true); },
    onMouseLeave: (e) => { children.props.onMouseLeave?.(e); setOpen(false); },
    onFocus: (e) => { children.props.onFocus?.(e); setOpen(true); },
    onBlur: (e) => { children.props.onBlur?.(e); setOpen(false); },
    onKeyDown: (e) => { children.props.onKeyDown?.(e); if (e.key === 'Escape') setOpen(false); },
  });
  return (
    <span className="v-tip-anchor">
      {child}
      {open && <span id={id} role="tooltip" className={`v-tip v-tip--${side}`}>{label}</span>}
    </span>
  );
}
export const tooltipStyles = `
  .v-tip-anchor { position: relative; display: inline-flex; }
  .v-tip { position: absolute; left: 50%; transform: translateX(-50%); z-index: var(--v-z-toast); padding: var(--v-space-1) var(--v-space-2); border-radius: var(--v-radius-sm); background: var(--v-surface-3); border: 1px solid var(--v-border-strong); color: var(--v-text); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); font-weight: var(--v-weight-semibold); white-space: nowrap; pointer-events: none; box-shadow: var(--v-shadow-2); animation: v-fade var(--v-dur-fast) var(--v-ease-out) both; }
  .v-tip--top { bottom: calc(100% + 6px); }
  .v-tip--bottom { top: calc(100% + 6px); }
`;
