/**
 * Reveal: single-element entrance (fade + 8px rise) using --v-dur-enter. Plays once on mount.
 * @param {object} props
 * @param {number} [props.delay=0] ms
 * @param {string} [props.as='div']
 */
export default function Reveal({ delay = 0, as: Tag = 'div', className = '', style, children, ...rest }) {
  return <Tag className={`v-reveal ${className}`.trim()} style={{ animationDelay: delay ? `${delay}ms` : undefined, ...style }} {...rest}>{children}</Tag>;
}
export const revealStyles = `
  .v-reveal { animation: v-enter var(--v-dur-enter) var(--v-ease-out) both; min-width: 0; }
  @keyframes v-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
`;
