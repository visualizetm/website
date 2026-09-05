import { SkeletonBlock, SkeletonText } from './Skeleton';
/**
 * Card: the surface every list row, tile, and panel sits on.
 * @param {object} props
 * @param {1|2|3} [props.level=1] surface step
 * @param {number} [props.padding=4] space step (0 for none)
 * @param {boolean} [props.interactive] hover lift, press, focus ring; renders a button when onClick is given
 * @param {string} [props.glow] status tone or semantics id for the soft corner glow
 * @param {import('react').ReactNode} [props.header]
 * @param {import('react').ReactNode} [props.footer]
 * @param {boolean} [props.selected]
 * @param {string} [props.as] tag override
 */
export default function Card({
  level = 1, padding = 4, interactive = false, glow, header, footer, selected = false,
  as, onClick, className = '', style, children, ...rest
}) {
  const Tag = as || (onClick ? 'button' : 'div');
  const cls = [
    'v-card', 'lay-card', `v-card--l${level}`,
    interactive || onClick ? 'v-card--interactive' : '',
    glow ? 'v-card--glow' : '',
    selected ? 'is-selected' : '',
    className,
  ].filter(Boolean).join(' ');
  const styles = { padding: padding ? `var(--v-space-${padding})` : 0, ...(glow ? { '--v-card-glow': `var(--v-status-${glow}-solid)` } : {}), ...style };
  return (
    <Tag className={cls} style={styles} onClick={onClick} type={Tag === 'button' ? 'button' : undefined} {...rest}>
      {header && <div className="v-card-head">{header}</div>}
      {children}
      {footer && <div className="v-card-foot">{footer}</div>}
    </Tag>
  );
}

/** Card.Skeleton: same box, shimmer inside. */
Card.Skeleton = function CardSkeleton({ level = 1, padding = 4, lines = 3, height, className = '' }) {
  return (
    <div className={`v-card lay-card v-card--l${level} ${className}`.trim()} style={{ padding: `var(--v-space-${padding})`, minHeight: height }} aria-busy="true">
      {lines > 0 ? <SkeletonText lines={lines} /> : <SkeletonBlock height={height ? height - 32 : 40} />}
    </div>
  );
};

export const cardStyles = `
  .v-card {
    position: relative; display: flex; flex-direction: column; gap: var(--v-space-3);
    border: 1px solid var(--v-border); border-radius: var(--v-radius-lg);
    color: var(--v-text); text-align: left; font: inherit;
    overflow: hidden; isolation: isolate;
    transition: transform var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out), box-shadow var(--v-dur-fast) var(--v-ease-out);
  }
  .v-card--l1 { background: var(--v-surface-1); }
  .v-card--l2 { background: var(--v-surface-2); }
  .v-card--l3 { background: var(--v-surface-3); }
  .v-card--interactive { cursor: pointer; }
  .v-card--interactive:hover { border-color: var(--v-border-strong); transform: translateY(-1px); box-shadow: var(--v-shadow-2); }
  .v-card--interactive:active { transform: translateY(0) scale(0.995); }
  .v-card--interactive:focus-visible, .v-card.is-selected { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-card.is-selected { border-color: var(--v-red); }
  /* The corner glow is a background layer, not a pseudo element box: a box hanging 40px past the
     edge widened the document's scrollable area even under overflow hidden (found by the
     reduced motion layout audit, Prompt 14). */
  .v-card--glow { background-image: radial-gradient(110px circle at calc(100% + 30px) -30px, color-mix(in srgb, var(--v-card-glow) 28%, transparent) 0%, transparent 100%); }
  /* Success moment (Prompt 14): a one shot ring and lift in the won tone, color and scale only. */
  .v-pulse-won { animation: v-pulse-won calc(var(--v-dur-slow) * 2) var(--v-ease-out) 1; }
  @keyframes v-pulse-won { 0% { box-shadow: 0 0 0 0 var(--v-status-won-soft); transform: scale(1); } 30% { box-shadow: 0 0 0 6px var(--v-status-won-soft), 0 0 0 1px var(--v-status-won-solid); transform: scale(1.012); } 100% { box-shadow: 0 0 0 0 transparent; transform: scale(1); } }
  .v-card-head, .v-card-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); min-width: 0; }
  .v-card-foot { padding-top: var(--v-space-3); border-top: 1px solid var(--v-border); }
`;
