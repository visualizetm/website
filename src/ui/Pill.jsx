import { Icon } from './icons';
import { resolveSemantic } from './semantic';
import { SkeletonBlock } from './Skeleton';
/**
 * Pill: status pill driven by a semantics id. Label, tone, and icon resolve
 * automatically; any prop given explicitly wins.
 * @param {object} props
 * @param {string} [props.id] semantics id ('booked', 'hot', 'callback') or a tone name
 * @param {Array} [props.list] which semantics list to resolve from when ids collide
 * @param {string} [props.label]
 * @param {string} [props.tone]
 * @param {string|Function|false} [props.icon] false hides the icon
 * @param {'soft'|'solid'|'outline'} [props.variant='soft']
 * @param {'sm'|'md'} [props.size='md']
 * @param {boolean} [props.dot] leading dot instead of an icon
 */
export default function Pill({ id, list, label, tone, icon, variant = 'soft', size = 'md', dot = false, className = '', style, children, ...rest }) {
  const r = resolveSemantic({ id, list, label, tone, icon });
  const showIcon = icon !== false && !dot && r.icon;
  return (
    <span className={`v-pill v-pill--${variant} v-pill--${size} ${className}`.trim()}
      style={{ '--v-pill-solid': `var(--v-status-${r.tone}-solid)`, '--v-pill-soft': `var(--v-status-${r.tone}-soft)`, '--v-pill-text': `var(--v-status-${r.tone}-text)`, '--v-pill-on-solid': r.tone === 'won' ? 'var(--v-text-on-red)' : 'var(--v-text-inverse)', ...style }} {...rest}>
      {dot && <span className="v-pill-dot" />}
      {showIcon && <Icon icon={r.icon} size={size === 'sm' ? 11 : 13} />}
      <span className="v-pill-label">{children ?? r.label}</span>
    </span>
  );
}
Pill.Skeleton = function PillSkeleton({ width = 72 }) { return <SkeletonBlock width={width} height={24} radius="var(--v-radius-pill)" />; };

export const pillStyles = `
  .v-pill {
    display: inline-flex; align-items: center; gap: var(--v-space-1); flex-shrink: 0;
    font-size: var(--v-text-xs); line-height: 1; font-weight: var(--v-weight-bold); letter-spacing: 0.04em;
    padding: 0 var(--v-space-3); height: 26px; border-radius: var(--v-radius-pill); white-space: nowrap; max-width: 100%;
    border: 1px solid transparent;
  }
  .v-pill--sm { height: 22px; padding: 0 var(--v-space-2); }
  .v-pill--soft { background: var(--v-pill-soft); color: var(--v-pill-text); border-color: color-mix(in srgb, var(--v-pill-text) 30%, transparent); }
  .v-pill--solid { background: var(--v-pill-solid); color: var(--v-pill-on-solid); }
  .v-pill--outline { background: transparent; color: var(--v-pill-text); border-color: var(--v-border-strong); }
  .v-pill-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--v-pill-text); box-shadow: 0 0 0 3px color-mix(in srgb, var(--v-pill-text) 22%, transparent); }
  .v-pill--solid .v-pill-dot { background: var(--v-pill-on-solid); box-shadow: none; }
  .v-pill-label { overflow: hidden; text-overflow: ellipsis; }
`;
