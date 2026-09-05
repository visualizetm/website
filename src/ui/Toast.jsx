import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import AlertCircle from '@untitled-ui/icons-react/build/esm/AlertCircle';
import InfoCircle from '@untitled-ui/icons-react/build/esm/InfoCircle';
import FlipBackward from '@untitled-ui/icons-react/build/esm/FlipBackward';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import { portalRoot } from './portal';
import { durationMs } from './motion';
/**
 * Toast system. Mount <ToastProvider> once in the app shell (it renders the
 * host); call useToast() anywhere below it.
 *
 *   const toast = useToast();
 *   toast.success('Saved.');
 *   toast.error('Could not save.');
 *   toast.info('Enrichment runs tonight.');
 *   toast.undo('Lead deleted.', () => restore(id), { seconds: 6 });
 *   const id = toast.show({ title, description, variant: 'info', duration: 4000, action: { label, onClick } });
 *   toast.dismiss(id);
 *
 * Stacked bottom center above the tab bar on mobile, bottom right on desktop.
 */
const Ctx = createContext(null);
const fallback = {
  show: (t) => { console.warn('[toast] no ToastProvider mounted', t); return 0; },
  success: () => 0, error: () => 0, info: () => 0, undo: () => 0, dismiss: () => {},
};
export function useToast() { return useContext(Ctx) || fallback; }

const ICON = { success: CheckCircle, error: AlertCircle, info: InfoCircle, undo: FlipBackward };
const TONE = { success: 'booked', error: 'danger', info: 'progress', undo: 'neutral' };

export function ToastProvider({ children, max = 4 }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setItems(list => list.map(t => (t.id === id ? { ...t, leaving: true } : t))), []);
  useEffect(() => {
    const leaving = items.filter(t => t.leaving);
    if (!leaving.length) return undefined;
    const t = setTimeout(() => setItems(list => list.filter(x => !x.leaving)), durationMs('--v-dur-base') + 20);
    return () => clearTimeout(t);
  }, [items]);
  const show = useCallback((opts) => {
    const id = ++seq.current;
    const t = { id, variant: 'info', duration: 4000, ...opts, at: Date.now() };
    setItems(list => [...list.filter(x => !x.leaving), t].slice(-max));
    return id;
  }, [max]);
  const api = useMemo(() => ({
    show,
    dismiss,
    success: (title, o) => show({ variant: 'success', title, ...o }),
    error: (title, o) => show({ variant: 'error', title, duration: 6000, ...o }),
    info: (title, o) => show({ variant: 'info', title, ...o }),
    undo: (title, onUndo, o = {}) => show({ variant: 'undo', title, duration: (o.seconds || 5) * 1000, countdown: true, action: { label: o.label || 'Undo', onClick: onUndo }, ...o }),
  }), [show, dismiss]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <ToastHost items={items} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

function ToastItem({ t, onDismiss }) {
  const I = ICON[t.variant] || InfoCircle;
  const timer = useRef(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!t.duration || paused) return undefined;
    timer.current = setTimeout(() => onDismiss(t.id), t.duration);
    return () => clearTimeout(timer.current);
  }, [t.id, t.duration, paused, onDismiss]);
  return (
    <div className={`v-toast v-toast--${t.variant}${t.leaving ? ' is-leaving' : ''}`}
      style={{ '--v-toast-c': `var(--v-status-${TONE[t.variant] || 'neutral'}-text)`, '--v-toast-dur': `${t.duration || 0}ms` }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <I width={18} height={18} className="v-toast-icon" aria-hidden="true" />
      <div className="v-toast-text">
        <p className="v-toast-title">{t.title}</p>
        {t.description && <p className="v-toast-desc">{t.description}</p>}
      </div>
      {t.action && (
        <button type="button" className="v-toast-action" onClick={() => { t.action.onClick?.(); onDismiss(t.id); }}>{t.action.label}</button>
      )}
      <button type="button" className="v-toast-x" onClick={() => onDismiss(t.id)} aria-label="Dismiss"><XClose width={14} height={14} /></button>
      {t.countdown && t.duration > 0 && <span className={`v-toast-bar${paused ? ' is-paused' : ''}`} aria-hidden="true" />}
    </div>
  );
}

/** ToastHost: rendered by ToastProvider. Exported for the design page only. */
export function ToastHost({ items, onDismiss }) {
  const root = portalRoot();
  if (!root) return null;
  // The region stays mounted even when empty (Prompt 15): a live region that appears with its first
  // message is not announced reliably, one that exists and changes is.
  return createPortal(
    <div className="v-toasts" role="status" aria-live="polite" aria-relevant="additions">
      {items.map(t => <ToastItem key={t.id} t={t} onDismiss={onDismiss} />)}
    </div>,
    root,
  );
}
export default ToastProvider;

export const toastStyles = `
  .v-toasts { position: fixed; left: var(--v-gutter-l); right: var(--v-gutter-r); bottom: calc(var(--v-safe-bottom) + var(--v-space-3)); z-index: var(--v-z-toast); display: flex; flex-direction: column; align-items: center; gap: var(--v-space-2); pointer-events: none; }
  .v-toasts:empty { display: none; }
  @media (min-width: 768px) { .v-toasts { left: auto; right: var(--v-space-6); bottom: var(--v-space-6); align-items: flex-end; } }
  .v-toast {
    position: relative; overflow: hidden; pointer-events: auto;
    display: flex; align-items: center; gap: var(--v-space-3); width: 100%; max-width: 420px; min-height: var(--v-tap);
    padding: var(--v-space-3) var(--v-space-3) var(--v-space-3) var(--v-space-4);
    background: var(--v-surface-3); border: 1px solid var(--v-border-strong); border-left: 3px solid var(--v-toast-c); border-radius: var(--v-radius-md);
    box-shadow: var(--v-shadow-3); color: var(--v-text);
    animation: v-toast-in var(--v-dur-slow) var(--v-ease-spring) both;
  }
  .v-toast.is-leaving { animation: v-toast-out var(--v-dur-base) var(--v-ease-out) both; }
  @keyframes v-toast-in { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
  @keyframes v-toast-out { from { opacity: 1; } to { opacity: 0; transform: translateY(6px); } }
  .v-toast-icon { color: var(--v-toast-c); flex-shrink: 0; }
  .v-toast-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .v-toast-title { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-bold); overflow-wrap: anywhere; }
  .v-toast-desc { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  .v-toast-action { flex-shrink: 0; min-height: 36px; padding: 0 var(--v-space-3); border-radius: var(--v-radius-sm); border: 1px solid var(--v-border-strong); background: var(--v-surface-2); color: var(--v-text); cursor: pointer; font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); }
  .v-toast-action:hover { border-color: var(--v-red); color: var(--v-red-highlight); }
  .v-toast-action:focus-visible, .v-toast-x:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-toast-x { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--v-radius-sm); border: 0; background: transparent; color: var(--v-text-3); cursor: pointer; }
  .v-toast-x:hover { color: var(--v-text); background: var(--v-surface-2); }
  .v-toast-bar { position: absolute; left: 0; bottom: 0; height: 2px; width: 100%; background: var(--v-toast-c); transform-origin: left; animation: v-toast-count var(--v-toast-dur) linear both; }
  .v-toast-bar.is-paused { animation-play-state: paused; }
  @keyframes v-toast-count { from { transform: scaleX(1); } to { transform: scaleX(0); } }
`;
