import { Children, useEffect, useRef, useState } from 'react';
/**
 * Stagger: sequential entrance for a list. The first `cap` children step in
 * --v-stagger apart; everything after arrives with the last stepped child, so
 * a list of 50 finishes in cap x stagger + enter. Plays once per mount, never
 * on re-render; children added later render settled.
 * @param {object} props
 * @param {number} [props.cap=8]
 * @param {string} [props.as='div'] wrapper tag (pass 'contents'-style layout via className)
 * @param {string} [props.className] applied to the wrapper (use Stack/Grid classes or your own)
 */
export default function Stagger({ cap = 8, as: Tag = 'div', className = '', style, children, ...rest }) {
  const [playing, setPlaying] = useState(true);
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return undefined;
    played.current = true;
    const root = document.documentElement;
    const ms = (v, d) => { const n = parseFloat(v); return Number.isNaN(n) ? d : n; };
    const cs = getComputedStyle(document.querySelector('.lay-root') || root);
    const total = ms(cs.getPropertyValue('--v-dur-enter'), 400) + cap * ms(cs.getPropertyValue('--v-stagger'), 40) + 50;
    const t = setTimeout(() => setPlaying(false), total);
    return () => clearTimeout(t);
  }, [cap]);
  const items = Children.toArray(children);
  return (
    <Tag className={`v-stagger${playing ? ' is-playing' : ''} ${className}`.trim()} style={style} {...rest}>
      {items.map((child, i) => (
        <div key={child.key ?? i} className="v-stagger-item" style={playing ? { animationDelay: `calc(${Math.min(i, cap)} * var(--v-stagger))` } : undefined}>{child}</div>
      ))}
    </Tag>
  );
}
export const staggerStyles = `
  .v-stagger { min-width: 0; }
  .v-stagger-item { min-width: 0; }
  .v-stagger.is-playing > .v-stagger-item { animation: v-enter var(--v-dur-enter) var(--v-ease-out) both; }
`;
