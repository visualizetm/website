import { Section, Row, IconButton, Collapsible } from '../ui';

/* A detail page section that folds to its one line summary (UX audit,
 * item 6). The kit's Section keeps the heading, the description slot and
 * the action slot; this only adds the chevron and puts the summary in the
 * description while closed, so a closed section is one line: the title,
 * what is in it, and the way in. A record opens on the section for its
 * stage (a lead on Overview, a booked lead on Meeting, a client on
 * Projects); the tab strip opens any other. */
export default function FoldSection({ id, title, description, summary, action, open = true, onToggle, className = '', children, ...rest }) {
  const toggle = onToggle ? () => onToggle(id) : undefined;
  return (
    <Section
      title={title}
      description={open ? description : (summary ?? description)}
      className={`dt-fold${open ? ' is-open' : ' is-closed'} ${className}`.trim()}
      action={(
        <Row gap={1} align="center" wrap>
          {open && action}
          {toggle && <IconButton icon={open ? 'ChevronUp' : 'ChevronDown'} label={open ? `Collapse ${title}` : `Expand ${title}`} variant="ghost" onClick={toggle} aria-expanded={open} aria-controls={`dt-fold-${id}`} className="dt-fold-btn" />}
        </Row>
      )}
      {...rest}
    >
      <Collapsible open={open}><div id={`dt-fold-${id}`} className="dt-fold-body">{children}</div></Collapsible>
    </Section>
  );
}
