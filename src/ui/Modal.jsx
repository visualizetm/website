import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import useFocusTrap from './useFocusTrap';
import useScrollLock from './useScrollLock';
import { portalRoot } from './portal';
/**
 * Modal: centered dialog for confirmations and short forms. Focus trap,
 * scroll lock, Escape and backdrop close, z from --v-z-modal.
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose
 * @param {import('react').ReactNode} [props.title]
 * @param {import('react').ReactNode} [props.description]
 * @param {import('react').ReactNode} [props.footer] action row
 * @param {'sm'|'md'|'lg'} [props.size='sm'] 420 / 560 / 720
 * @param {boolean} [props.danger] red title accent for destructive dialogs
 * @param {boolean} [props.closeButton=true]
 * @param {string} [props.label] aria-label when there is no title
 */
export default function Modal({ open, onClose, title, description, footer, size = 'sm', danger = false, closeButton = true, label, className = '', children }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const boxRef = useRef(null);
  const close = useCallback(() => onClose?.(), [onClose]);
  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); return undefined; }
    if (!mounted) return undefined;
    setClosing(true);
    const t = setTimeout(() => { setMounted(false); setClosing(false); }, 220);
    return () => clearTimeout(t);
  }, [open, mounted]);
  useScrollLock(mounted);
  useFocusTrap(boxRef, open && mounted, { onEscape: close });
  if (!mounted) return null;
  const root = portalRoot();
  if (!root) return null;
  return createPortal(
    <div className={`v-modal-back lay-overlay${closing ? ' is-closing' : ''}`} onClick={close}>
      <div ref={boxRef} className={`v-modal v-modal--${size}${danger ? ' v-modal--danger' : ''}${closing ? ' is-closing' : ''} ${className}`.trim()}
        role="dialog" aria-modal="true" aria-label={title ? undefined : label} aria-labelledby={title ? 'v-modal-title' : undefined} tabIndex={-1}
        onClick={(e) => e.stopPropagation()}>
        {(title || closeButton) && (
          <header className="v-modal-head">
            <div className="v-modal-text">
              {title && <h2 id="v-modal-title" className="v-modal-title">{title}</h2>}
              {description && <p className="v-modal-desc">{description}</p>}
            </div>
            {closeButton && <button type="button" className="v-modal-x" onClick={close} aria-label="Close"><XClose width={18} height={18} /></button>}
          </header>
        )}
        {children && <div className="v-modal-body">{children}</div>}
        {footer && <footer className="v-modal-foot">{footer}</footer>}
      </div>
    </div>,
    root,
  );
}

export const modalStyles = `
  .v-modal-back { z-index: var(--v-z-modal); background: var(--v-overlay); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; animation: v-fade var(--v-dur-base) var(--v-ease-out) both; }
  .v-modal-back.is-closing { animation: v-fade var(--v-dur-base) var(--v-ease-out) reverse both; }
  .v-modal { display: flex; flex-direction: column; width: 100%; max-width: 420px; max-height: calc(100dvh - var(--v-space-8) - var(--v-inset-top) - var(--v-inset-bottom)); background: var(--v-surface-2); border: 1px solid var(--v-border-strong); border-radius: var(--v-radius-xl); box-shadow: var(--v-shadow-3); color: var(--v-text); outline: 0; animation: v-modal-in var(--v-dur-slow) var(--v-ease-spring) both; }
  .v-modal.is-closing { animation: v-modal-out var(--v-dur-base) var(--v-ease-out) both; }
  @keyframes v-modal-in { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
  @keyframes v-modal-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px) scale(0.98); } }
  .v-modal--md { max-width: 560px; }
  .v-modal--lg { max-width: 720px; }
  .v-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--v-space-3); padding: var(--v-space-6) var(--v-space-6) 0; }
  .v-modal-text { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .v-modal-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); }
  .v-modal--danger .v-modal-title { color: var(--v-status-danger-text); }
  .v-modal-desc { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .v-modal-x { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); margin: -10px -12px 0 0; border-radius: var(--v-radius-md); border: 0; background: transparent; color: var(--v-text-2); cursor: pointer; }
  .v-modal-x:hover { background: var(--v-surface-3); color: var(--v-text); }
  .v-modal-x:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-modal-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: var(--v-space-4) var(--v-space-6) 0; display: flex; flex-direction: column; gap: var(--v-space-4); }
  .v-modal-foot { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--v-space-2); padding: var(--v-space-5) var(--v-space-6) var(--v-space-6); }
  @media (max-width: 480px) { .v-modal-foot > .v-btn { flex: 1 1 45%; } }
`;
