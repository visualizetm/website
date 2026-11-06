import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import { COPY } from '../shared/copy';
import { safeHref } from '../lib/safeUrl';

/* The small pieces the client facing concepts page and its full screen stage share (src/pages/Concepts.jsx,
 * src/components/ConceptsStage.jsx): the session storage helpers, the dialog hook, one contained image, the chip
 * that says where a direction stands. Nothing here talks to the network. */
export const NOTE_MAX = 1000;
export const DRAFT_PREFIX = 'vz_concepts_note';
export const FS_KEY = 'vz_concepts_fs'; // set once the client has entered full screen in this tab: the big cue becomes a small chip
export const letterOf = (i) => String.fromCharCode(65 + i);
export const readSS = (k, d = '') => { try { return sessionStorage.getItem(k) ?? d; } catch { return d; } };
export const writeSS = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* private mode */ } };
export const overlay = (node) => (typeof document === 'undefined' ? node : createPortal(node, document.body));
export const R = COPY.concepts.review;

/* A dialog: labelled, focus trapped, Escape closes. Every layer that means "the screen" is portaled to the body so a
 * transform up the tree never becomes its containing block (the planner's note). Focus goes to [data-autofocus], else
 * the first control, once when the dialog opens (a parent that re-renders and hands in a new onClose does not steal it
 * back), and returns to what held it when the dialog closes. */
export function useDialog(onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = typeof document !== 'undefined' ? document.activeElement : null;
    const root = ref.current;
    const first = root?.querySelector('[data-autofocus]') || root?.querySelector('button, input, textarea, [tabindex="0"]');
    first?.focus?.();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const f = [...(ref.current?.querySelectorAll('button:not([disabled]), input, textarea, [tabindex="0"]') || [])];
      if (!f.length) return;
      const a = f[0]; const b = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (before && before !== document.body && document.contains(before)) before.focus?.();
    };
  }, []);
  return ref;
}

/* One image, contained, never cropped. `eager` is the stage's current image: it loads at once, the page's others stay lazy. */
export function Pic({ item, className = '', sizes, eager = false }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [item.image]);
  const src = safeHref(item.image);
  if (!src || broken) return <span className={`cp-pic cp-pic--empty ${className}`.trim()} aria-hidden="true">{broken ? 'Image did not load' : ''}</span>;
  return <img className={`cp-pic ${className}`.trim()} src={src} alt={item.caption || ''} loading={eager ? 'eager' : 'lazy'} decoding="async" sizes={sizes} onError={() => setBroken(true)} />;
}

/* The chip that says where a section stands. */
export function StateChip({ kind }) {
  if (!kind) return null;
  const tone = kind === 'approved' || kind === 'picked' ? 'ok' : kind === 'changes' ? 'warn' : 'quiet';
  return <span className={`cp-chip cp-chip--${tone}`} data-chip={kind}>{kind === 'approved' || kind === 'picked' ? <Check width={14} height={14} aria-hidden="true" /> : kind === 'changes' ? <Edit02 width={14} height={14} aria-hidden="true" /> : null}{kind === 'picked' ? COPY.concepts.direction.picked : R.chip[kind]}</span>;
}

/* A media query as state (this page does not load the admin kit). */
export function useQuery(q) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    f();
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, [q]);
  return on;
}
