import { useEffect } from 'react';
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/**
 * Traps Tab inside `ref` while `active`, focuses the first focusable (or the
 * container) on open, restores focus on close, and calls onEscape on Escape.
 */
export default function useFocusTrap(ref, active, { onEscape, initialFocus } = {}) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const node = ref.current;
    const restore = document.activeElement;
    const first = initialFocus?.current || node.querySelector('[data-autofocus]') || node.querySelector(FOCUSABLE) || node;
    const t = setTimeout(() => first.focus?.({ preventScroll: true }), 0);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onEscape?.(); return; }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { e.preventDefault(); node.focus(); return; }
      const i = items.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && (i === items.length - 1 || i === -1)) { e.preventDefault(); items[0].focus(); }
    };
    node.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); node.removeEventListener('keydown', onKey); restore?.focus?.({ preventScroll: true }); };
  }, [ref, active, onEscape, initialFocus]);
}
