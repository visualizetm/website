/**
 * Divider: hairline rule, optional centered label, optional vertical.
 * @param {object} props
 * @param {string} [props.label]
 * @param {boolean} [props.vertical]
 */
export default function Divider({ label, vertical = false, className = '', ...rest }) {
  if (vertical) return <span className={`v-divider v-divider--v ${className}`.trim()} role="separator" aria-orientation="vertical" {...rest} />;
  if (!label) return <hr className={`v-divider ${className}`.trim()} {...rest} />;
  return <div className={`v-divider v-divider--label ${className}`.trim()} role="separator" {...rest}><span>{label}</span></div>;
}

export const dividerStyles = `
  .v-divider { border: 0; height: 1px; width: 100%; background: var(--v-border); margin: 0; flex-shrink: 0; }
  .v-divider--v { width: 1px; height: auto; align-self: stretch; min-height: var(--v-space-4); }
  .v-divider--label { display: flex; align-items: center; gap: var(--v-space-3); background: none; height: auto; }
  .v-divider--label::before, .v-divider--label::after { content: ''; flex: 1; height: 1px; background: var(--v-border); }
  .v-divider--label span { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
`;
