import { useEffect, useRef, useState } from 'react';
import { durationMs } from './motion';
/**
 * Badge: the count bubble on tabs and rails, or a bare dot. Ticks (a small scale bounce) when the count grows.
 * @param {object} props
 * @param {number} [props.count] hidden when 0 or missing unless `dot`
 * @param {number} [props.max=99] renders "99+" above
 * @param {boolean} [props.dot] 8px dot, no number
 * @param {string} [props.tone='won'] status tone (won = brand red)
 * @param {boolean} [props.inline] sits in text flow instead of pinned to a corner
 * @param {import('react').ReactNode} [props.children] wrap an element to pin the badge on its corner
 */
export default function Badge({ count, max = 99, dot = false, tone = 'won', inline = false, className = '', children, ...rest }) {
  const prev = useRef(count);
  const [tick, setTick] = useState(false);
  useEffect(() => {
    if (typeof count === 'number' && typeof prev.current === 'number' && count > prev.current) { setTick(true); const t = setTimeout(() => setTick(false), durationMs('--v-dur-slow') + 20); prev.current = count; return () => clearTimeout(t); }
    prev.current = count; return undefined;
  }, [count]);
  const show = dot || (typeof count === 'number' && count > 0);
  const text = dot ? '' : count > max ? `${max}+` : String(count);
  const badge = show ? (
    <span className={`v-badge${dot ? ' v-badge--dot' : ''}${inline || !children ? ' v-badge--inline' : ''}${tick ? ' is-tick' : ''} ${className}`.trim()}
      style={{ '--v-badge-bg': `var(--v-status-${tone}-solid)`, '--v-badge-fg': tone === 'won' || tone === 'danger' ? 'var(--v-text-on-red)' : 'var(--v-text-inverse)' }}
      aria-label={dot ? 'Has updates' : `${count} new`} {...rest}>{text}</span>
  ) : null;
  if (!children) return badge;
  return <span className="v-badge-anchor">{children}{badge}</span>;
}

export const badgeStyles = `
  .v-badge-anchor { position: relative; display: inline-flex; }
  .v-badge {
    position: absolute; top: -6px; right: -8px;
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px; border-radius: var(--v-radius-pill);
    background: var(--v-badge-bg); color: var(--v-badge-fg);
    font-size: 11px; line-height: 1; font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums;
    box-shadow: 0 0 0 2px var(--v-bar);
  }
  .v-badge--inline { position: static; box-shadow: none; }
  .v-badge.is-tick { animation: v-badge-tick var(--v-dur-slow) var(--v-ease-spring) 1; }
  @keyframes v-badge-tick { 0% { transform: scale(1); } 40% { transform: scale(1.3); } 100% { transform: scale(1); } }
  .v-badge--dot { min-width: 8px; width: 8px; height: 8px; padding: 0; top: -2px; right: -2px; }
`;
