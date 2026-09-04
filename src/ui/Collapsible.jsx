import { useEffect, useRef, useState } from 'react';
/**
 * Collapsible: measured-height open/close so sections animate reliably on
 * mobile (no max-height guessing). Content stays mounted.
 * @param {object} props
 * @param {boolean} props.open
 * @param {import('react').ReactNode} props.children
 */
export default function Collapsible({ open, className = '', children }) {
  const ref = useRef(null);
  const [h, setH] = useState(open ? 'auto' : 0);
  const first = useRef(true);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    if (first.current) { first.current = false; setH(open ? 'auto' : 0); return undefined; }
    const full = el.scrollHeight;
    if (open) { setH(full); const t = setTimeout(() => setH('auto'), 340); return () => clearTimeout(t); }
    setH(full); const raf = requestAnimationFrame(() => requestAnimationFrame(() => setH(0)));
    return () => cancelAnimationFrame(raf);
  }, [open]);
  return (
    <div className={`v-collapsible${open ? ' is-open' : ''} ${className}`.trim()} style={{ height: h === 'auto' ? 'auto' : `${h}px` }} aria-hidden={!open}>
      <div ref={ref} className="v-collapsible-inner">{children}</div>
    </div>
  );
}
export const collapsibleStyles = `
  .v-collapsible { overflow: hidden; transition: height var(--v-dur-slow) var(--v-ease-in-out); min-width: 0; }
  .v-collapsible:not(.is-open) { visibility: hidden; }
  .v-collapsible-inner { min-width: 0; }
`;
