import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import IconButton from './IconButton';

/**
 * PageHeader (the nav revamp): the one header shape every screen has.
 * A breadcrumb (the workspace, then the page), the title, Back when the
 * history entry has one, and the page's actions on the right. The shell's
 * top bar renders it for every screen (useTopBar supplies the title, Back
 * and the actions), so a screen never draws its own.
 * @param {object} props
 * @param {Array<{ id, label, onClick }>} [props.crumbs]  the breadcrumb, last one is the current page (not a link)
 * @param {string} props.title
 * @param {() => void} [props.onBack]
 * @param {import('react').ReactNode} [props.actions]
 * @param {import('react').ReactNode} [props.children]  the centre (the overview strip, the search)
 */
export default function PageHeader({ crumbs = [], title, onBack, actions = null, children = null, className = '' }) {
  const trail = crumbs.slice(0, -1);
  return (
    <div className={`v-ph ${className}`.trim()}>
      <div className="v-ph-left">
        {onBack && <IconButton icon={ArrowLeft} label="Back" onClick={onBack} tooltip={false} className="v-ph-back sh-top-back" />}
        <div className="v-ph-text">
          {trail.length > 0 && (
            <nav className="v-ph-crumbs" aria-label="Breadcrumb">
              {trail.map((c, i) => (
                <span key={c.id || i} className="v-ph-crumb">
                  {c.onClick ? <button type="button" className="v-ph-crumb-btn" onClick={c.onClick}>{c.label}</button> : <span>{c.label}</span>}
                  <span className="v-ph-sep" aria-hidden="true">/</span>
                </span>
              ))}
              <span className="v-ph-crumb v-ph-crumb--here" aria-current="page">{crumbs[crumbs.length - 1]?.label}</span>
            </nav>
          )}
          <h1 className="v-ph-title sh-top-title lay-truncate">{title}</h1>
        </div>
      </div>
      {children && <div className="v-ph-center">{children}</div>}
      {actions && <div className="v-ph-actions">{actions}</div>}
    </div>
  );
}

export const pageHeaderStyles = `
  .v-ph { display: contents; }
  .v-ph-left { display: flex; align-items: center; gap: var(--v-space-1); min-width: 0; }
  .v-ph-text { display: flex; flex-direction: column; min-width: 0; }
  .v-ph-crumbs { display: none; align-items: center; gap: var(--v-space-1); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); min-width: 0; }
  @media (min-width: 768px) { .v-ph-crumbs { display: flex; } }
  .v-ph-crumb { display: inline-flex; align-items: center; gap: var(--v-space-1); white-space: nowrap; }
  .v-ph-crumb--here { color: var(--v-text-2); }
  /* A 44px target that reads as a small word: the box is tall, the negative margins keep the line height. */
  .v-ph-crumb-btn { display: inline-flex; align-items: center; min-height: var(--v-tap); margin: -12px 0; padding: 0; border: 0; background: transparent; color: var(--v-text-3); cursor: pointer; font: inherit; }
  .v-ph-crumb-btn:hover { color: var(--v-text); text-decoration: underline; }
  .v-ph-crumb-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-sm); }
  .v-ph-sep { color: var(--v-text-3); }
  .v-ph-center { display: none; min-width: 0; align-items: center; justify-content: center; gap: var(--v-space-3); }
  @media (min-width: 768px) { .v-ph-center { display: flex; } }
  .v-ph-actions { display: flex; align-items: center; gap: var(--v-space-1); flex-shrink: 0; }
`;
