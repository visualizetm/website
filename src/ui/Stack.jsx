/**
 * Stack: vertical flex with a gap from the space scale.
 * @param {object} props
 * @param {number} [props.gap=4] space step 1..12
 * @param {'start'|'center'|'end'|'stretch'} [props.align='stretch']
 * @param {string} [props.as='div'] element tag
 */
export default function Stack({ gap = 4, align = 'stretch', as: Tag = 'div', className = '', style, children, ...rest }) {
  return (
    <Tag className={`v-stack ${className}`.trim()} style={{ gap: `var(--v-space-${gap})`, alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : align, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

export const stackStyles = `
  .v-stack { display: flex; flex-direction: column; min-width: 0; }
  .v-stack > * { min-width: 0; }
`;
