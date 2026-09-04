import { Icon } from './icons';
import Spinner from './Spinner';
/**
 * Button.
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'|'icon'} [props.variant='primary']
 * @param {'md'|'lg'} [props.size='md'] md = --v-control-h, lg = --v-tap-lg
 * @param {boolean} [props.loading] swaps the label for a spinner without changing width
 * @param {boolean} [props.disabled]
 * @param {string|Function} [props.icon] leading icon
 * @param {string|Function} [props.iconEnd]
 * @param {boolean} [props.full] stretch to the container width
 * @param {string} [props.href] renders an <a>
 * @param {string} [props.type='button']
 */
export default function Button({
  variant = 'primary', size = 'md', loading = false, disabled = false, icon, iconEnd, full = false,
  href, type = 'button', className = '', children, ...rest
}) {
  const Tag = href ? 'a' : 'button';
  const iconOnly = variant === 'icon';
  const cls = ['v-btn', `v-btn--${variant}`, `v-btn--${size}`, full ? 'v-btn--full' : '', loading ? 'is-loading' : '', className].filter(Boolean).join(' ');
  return (
    <Tag className={cls} href={href} type={href ? undefined : type} disabled={disabled || loading || undefined}
      aria-disabled={href && (disabled || loading) ? true : undefined} aria-busy={loading || undefined} {...rest}>
      <span className="v-btn-inner">
        {icon && <Icon icon={icon} size={size === 'lg' ? 'var(--v-icon-md)' : 'var(--v-icon-sm)'} />}
        {!iconOnly && children && <span className="v-btn-label">{children}</span>}
        {iconEnd && <Icon icon={iconEnd} size="var(--v-icon-sm)" />}
      </span>
      {loading && <span className="v-btn-spin"><Spinner size={size === 'lg' ? 18 : 15} /></span>}
    </Tag>
  );
}

export const buttonStyles = `
  .v-btn {
    position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    min-height: var(--v-control-h); min-width: var(--v-tap); padding: 0 var(--v-space-4);
    border-radius: var(--v-radius-md); border: 1px solid transparent; cursor: pointer;
    font-family: var(--v-font-body); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-bold); letter-spacing: 0.01em;
    text-decoration: none; white-space: nowrap; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    transition: background var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out), transform var(--v-dur-fast) var(--v-ease-out), box-shadow var(--v-dur-fast) var(--v-ease-out);
  }
  .v-btn:active { transform: scale(0.97); }
  .v-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-btn:disabled, .v-btn[aria-disabled='true'] { cursor: not-allowed; opacity: 0.5; transform: none; }
  .v-btn--lg { min-height: var(--v-tap-lg); padding: 0 var(--v-space-6); font-size: var(--v-text-md); border-radius: var(--v-radius-lg); }
  .v-btn--full { width: 100%; }
  .v-btn-inner { display: inline-flex; align-items: center; justify-content: center; gap: var(--v-space-2); min-width: 0; }
  .v-btn-label { overflow: hidden; text-overflow: ellipsis; }
  .v-btn.is-loading .v-btn-inner { visibility: hidden; }
  .v-btn-spin { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }

  .v-btn--primary { background: var(--v-red-hover); color: var(--v-text-on-red); border-color: var(--v-red-hover); box-shadow: var(--v-glow-red); }
  .v-btn--primary:hover:not(:disabled) { background: var(--v-red); border-color: var(--v-red); }
  .v-btn--primary:active:not(:disabled) { background: var(--v-red-highlight); border-color: var(--v-red-highlight); }

  .v-btn--secondary { background: var(--v-surface-3); color: var(--v-text); border-color: var(--v-border-strong); }
  .v-btn--secondary:hover:not(:disabled) { background: color-mix(in srgb, var(--v-surface-3) 70%, var(--v-text) 8%); }

  .v-btn--ghost { background: transparent; color: var(--v-text-2); }
  .v-btn--ghost:hover:not(:disabled) { background: var(--v-surface-2); color: var(--v-text); }

  .v-btn--danger { background: var(--v-status-danger-soft); color: var(--v-status-danger-text); border-color: color-mix(in srgb, var(--v-status-danger-text) 35%, transparent); }
  .v-btn--danger:hover:not(:disabled) { background: var(--v-status-danger-solid); color: var(--v-text-on-red); border-color: var(--v-status-danger-solid); }

  .v-btn--icon { width: var(--v-control-h); padding: 0; background: transparent; color: var(--v-text-2); border-color: var(--v-border); }
  .v-btn--icon.v-btn--lg { width: var(--v-tap-lg); }
  .v-btn--icon:hover:not(:disabled) { background: var(--v-surface-2); color: var(--v-text); border-color: var(--v-border-strong); }
`;
