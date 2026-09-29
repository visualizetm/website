import { useState } from 'react';
import { PageShell, ScrollArea, Card, Stack, Row, Sheet, EmptyState, useMediaQuery, useToast } from '../ui';
import { COPY } from '../shared/copy';

/* Computer only (CRM revamp, step 7): the Showcase editor, the Planner,
 * the Concepts editor and the Landing screen need a wide screen, and so
 * do New project, Start a retainer and Fill from filters. Under 768px
 * those render this card instead: the message, the record's name, and
 * Copy link, which copies the admin URL so Rob can open it at the desk.
 * Between 768 and 1023 nothing changes. */
export const PHONE_QUERY = '(max-width: 767px)';
export const usePhone = () => useMediaQuery(PHONE_QUERY);
const adminUrl = (path) => { try { return `${window.location.origin}${path || window.location.pathname}${path ? '' : window.location.search}`; } catch { return path || ''; } };

export default function ComputerOnly({ what, name = '', path = '', className = '', page = false }) {
  const toast = useToast();
  const C = COPY.empty['computer.only'];
  const copy = async () => { try { await navigator.clipboard.writeText(adminUrl(path)); toast.success('Link copied. Open it on your computer.'); } catch { toast.error(COPY.error.copy); } };
  const card = (
    <Card className={`co-card ${className}`.trim()} data-v-enter="">
      <EmptyState size="sm" icon="Monitor01" title={C.title} description={`${what}${name ? ` for ${name}` : ''} ${C.description}`}
        action={{ label: C.action, icon: 'Copy01', onClick: copy }} />
      <Row gap={2} justify="center"><span className="co-url lay-truncate">{adminUrl(path)}</span></Row>
      <style>{computerOnlyStyles}</style>
    </Card>
  );
  // As a whole section (the four editors on a phone) it sits in the page shell with its gutters; in a sheet it is just the card.
  return page ? <PageShell className="aa-main aa-main--wide co-shell"><ScrollArea>{card}</ScrollArea></PageShell> : card;
}

/** A phone opens the card in a sheet from a button: { phone, open(what, name), sheet }. */
export function useComputerOnly() {
  const phone = usePhone();
  const [req, setReq] = useState(null);
  return {
    phone,
    open: (what, name = '') => setReq({ what, name }),
    sheet: req ? <Sheet open onClose={() => setReq(null)} title="Open on your computer" label="Open on your computer"><Stack gap={2}><ComputerOnly what={req.what} name={req.name} /></Stack></Sheet> : null,
  };
}
export const computerOnlyStyles = `
  .co-card { max-width: 560px; margin: 0 auto; width: 100%; }
  .co-url { font-size: var(--v-text-xs); color: var(--v-text-3); max-width: 100%; }
`;
