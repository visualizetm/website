import { useEffect } from 'react';
let locks = 0;
let prev = '';
/** Locks body scroll while `active`; reference counted so stacked overlays cooperate. */
export default function useScrollLock(active) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    if (locks === 0) { prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    locks += 1;
    return () => { locks -= 1; if (locks === 0) document.body.style.overflow = prev; };
  }, [active]);
}
