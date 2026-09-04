/**
 * Row: horizontal flex.
 * @param {object} props
 * @param {number} [props.gap=3] space step 1..12
 * @param {'start'|'center'|'end'|'baseline'|'stretch'} [props.align='center']
 * @param {'start'|'center'|'end'|'between'} [props.justify='start']
 * @param {boolean} [props.wrap=false]
 */
const J = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' };
const A = { start: 'flex-start', center: 'center', end: 'flex-end', baseline: 'baseline', stretch: 'stretch' };
export default function Row({ gap = 3, align = 'center', justify = 'start', wrap = false, as: Tag = 'div', className = '', style, children, ...rest }) {
  return (
    <Tag className={`v-row ${className}`.trim()} style={{ gap: `var(--v-space-${gap})`, alignItems: A[align], justifyContent: J[justify], flexWrap: wrap ? 'wrap' : 'nowrap', ...style }} {...rest}>
      {children}
    </Tag>
  );
}

export const rowStyles = `
  .v-row { display: flex; min-width: 0; }
  .v-row > * { min-width: 0; }
`;
