import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import { SkeletonBlock, SkeletonCircle } from './Skeleton';
/**
 * ListRow: leading slot, title + subtitle, meta line, trailing slot. Tap target
 * height is at least --v-tap. Titles truncate one line per LAYOUT.md.
 * @param {object} props
 * @param {import('react').ReactNode} [props.leading] Avatar, IconTile, Checkbox
 * @param {import('react').ReactNode} props.title
 * @param {import('react').ReactNode} [props.subtitle]
 * @param {import('react').ReactNode} [props.meta] right-aligned small text (time, count)
 * @param {import('react').ReactNode} [props.trailing] Pill, Badge, Menu
 * @param {Function} [props.onClick] renders a button with a chevron
 * @param {boolean} [props.selected]
 * @param {boolean} [props.chevron=true]
 */
export default function ListRow({ leading, title, subtitle, meta, trailing, onClick, selected = false, chevron = true, className = '', ...rest }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`v-lrow lay-card${onClick ? ' v-lrow--btn' : ''}${selected ? ' is-selected' : ''} ${className}`.trim()} type={onClick ? 'button' : undefined} onClick={onClick} aria-current={selected || undefined} {...rest}>
      {leading && <span className="v-lrow-lead">{leading}</span>}
      <span className="v-lrow-main">
        <span className="v-lrow-title lay-truncate">{title}</span>
        {subtitle && <span className="v-lrow-sub lay-truncate">{subtitle}</span>}
      </span>
      {(meta || trailing) && (
        <span className="v-lrow-side">
          {meta && <span className="v-lrow-meta">{meta}</span>}
          {trailing}
        </span>
      )}
      {onClick && chevron && <ChevronRight width={16} height={16} className="v-lrow-chev" aria-hidden="true" />}
    </Tag>
  );
}
ListRow.Skeleton = function ListRowSkeleton({ leading = true, trailing = true, className = '' }) {
  return (
    <div className={`v-lrow lay-card ${className}`.trim()} aria-busy="true">
      {leading && <span className="v-lrow-lead"><SkeletonCircle size={40} /></span>}
      <span className="v-lrow-main" style={{ gap: 6 }}>
        <SkeletonBlock width="55%" height={14} />
        <SkeletonBlock width="35%" height={12} />
      </span>
      {trailing && <span className="v-lrow-side"><SkeletonBlock width={64} height={24} radius="var(--v-radius-pill)" /></span>}
    </div>
  );
};

export const listRowStyles = `
  .v-lrow {
    display: flex; align-items: center; gap: var(--v-space-3);
    min-height: var(--v-tap-lg); padding: var(--v-space-2) var(--v-space-3);
    background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-md);
    color: var(--v-text); text-align: left; font: inherit;
    transition: border-color var(--v-dur-fast) var(--v-ease-out), background var(--v-dur-fast) var(--v-ease-out);
  }
  .v-lrow--btn { cursor: pointer; }
  .v-lrow--btn:hover { border-color: var(--v-border-strong); background: var(--v-surface-2); }
  .v-lrow--btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-lrow.is-selected { border-color: var(--v-red); background: var(--v-surface-2); }
  .v-lrow-lead { flex-shrink: 0; display: inline-flex; }
  .v-lrow-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .v-lrow-title { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-semibold); }
  .v-lrow-sub { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .v-lrow-side { flex-shrink: 0; display: inline-flex; align-items: center; gap: var(--v-space-2); }
  .v-lrow-meta { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .v-lrow-chev { flex-shrink: 0; color: var(--v-text-3); }
`;
