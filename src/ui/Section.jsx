/**
 * Section: a titled block with consistent spacing.
 * @param {object} props
 * @param {import('react').ReactNode} props.title
 * @param {import('react').ReactNode} [props.description]
 * @param {import('react').ReactNode} [props.action] right-side slot (button, link)
 * @param {number} [props.gap=3] gap between header and body
 */
export default function Section({ title, description, action, gap = 3, className = '', children, ...rest }) {
  return (
    <section className={`v-section ${className}`.trim()} style={{ gap: `var(--v-space-${gap})` }} {...rest}>
      <header className="v-section-head">
        <div className="v-section-text">
          <h2 className="v-section-title">{title}</h2>
          {description && <p className="v-section-desc">{description}</p>}
        </div>
        {action && <div className="v-section-action">{action}</div>}
      </header>
      {children}
    </section>
  );
}

export const sectionStyles = `
  .v-section { display: flex; flex-direction: column; min-width: 0; }
  .v-section-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--v-space-3); min-width: 0; }
  .v-section-text { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; flex: 1 1 180px; }
  .v-section-title { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .v-section-desc { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .v-section-action { flex-shrink: 0; display: flex; align-items: center; gap: var(--v-space-2); }
`;
