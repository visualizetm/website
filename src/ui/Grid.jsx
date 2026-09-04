/**
 * Grid: responsive columns that fit as many minColumnWidth tracks as the
 * container allows (the dashboard stat-card pattern).
 * @param {object} props
 * @param {number} [props.minColumnWidth=180] px
 * @param {number} [props.columns] fixed column count instead of auto-fit
 * @param {number} [props.gap=3] space step
 */
export default function Grid({ minColumnWidth = 180, columns, gap = 3, className = '', style, children, ...rest }) {
  const cols = columns ? `repeat(${columns}, minmax(0, 1fr))` : `repeat(auto-fit, minmax(min(${minColumnWidth}px, 100%), 1fr))`;
  return (
    <div className={`v-grid ${className}`.trim()} style={{ gridTemplateColumns: cols, gap: `var(--v-space-${gap})`, ...style }} {...rest}>
      {children}
    </div>
  );
}

export const gridStyles = `
  .v-grid { display: grid; min-width: 0; width: 100%; }
  .v-grid > * { min-width: 0; }
`;
