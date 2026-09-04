import { Icon } from './icons';
import Badge from './Badge';
import Tooltip from './Tooltip';
/**
 * IconButton: square, tap sized, with a required label for the tooltip and screen readers.
 * @param {object} props
 * @param {string|Function} props.icon
 * @param {string} props.label accessible name and tooltip
 * @param {'ghost'|'secondary'|'primary'|'danger'} [props.variant='ghost']
 * @param {'md'|'lg'} [props.size='md']
 * @param {boolean} [props.active] pressed / current state
 * @param {number} [props.badge] count bubble on the corner
 * @param {boolean} [props.tooltip=true]
 */
export default function IconButton({ icon, label, variant = 'ghost', size = 'md', active = false, badge, tooltip = true, className = '', ...rest }) {
  const btn = (
    <button type="button" className={`v-ibtn v-ibtn--${variant} v-ibtn--${size}${active ? ' is-active' : ''} ${className}`.trim()} aria-label={label} aria-pressed={active || undefined} {...rest}>
      <Icon icon={icon} size={size === 'lg' ? 'var(--v-icon-lg)' : 'var(--v-icon-md)'} />
      {badge > 0 && <Badge count={badge} />}
    </button>
  );
  return tooltip ? <Tooltip label={label}>{btn}</Tooltip> : btn;
}

export const iconButtonStyles = `
  .v-ibtn {
    position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    width: var(--v-tap); height: var(--v-tap); padding: 0; border-radius: var(--v-radius-md);
    border: 1px solid transparent; background: transparent; color: var(--v-text-2); cursor: pointer;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    transition: background var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out), transform var(--v-dur-fast) var(--v-ease-out);
  }
  .v-ibtn--lg { width: var(--v-tap-lg); height: var(--v-tap-lg); border-radius: var(--v-radius-lg); }
  .v-ibtn:hover { background: var(--v-surface-2); color: var(--v-text); }
  .v-ibtn:active { transform: scale(0.94); }
  .v-ibtn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-ibtn:disabled { opacity: 0.5; cursor: not-allowed; }
  .v-ibtn.is-active { color: var(--v-red-highlight); background: var(--v-red-soft); }
  .v-ibtn--secondary { background: var(--v-surface-2); border-color: var(--v-border); }
  .v-ibtn--secondary:hover { border-color: var(--v-border-strong); background: var(--v-surface-3); }
  .v-ibtn--primary { background: var(--v-red-hover); color: var(--v-text-on-red); box-shadow: var(--v-glow-red); }
  .v-ibtn--primary:hover { background: var(--v-red); color: var(--v-text-on-red); }
  .v-ibtn--danger { color: var(--v-status-danger-text); }
  .v-ibtn--danger:hover { background: var(--v-status-danger-soft); color: var(--v-status-danger-text); }
  .v-ibtn .v-badge { top: 4px; right: 4px; }
`;
