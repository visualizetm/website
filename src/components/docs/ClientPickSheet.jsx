import { useMemo, useState } from 'react';
import { Sheet, Stack, ListRow, Pill } from '../../ui';
import ListSearch from '../ListSearch';
import { matchesSearch } from '../../lib/leads';
import { normalizeStage } from '../../shared/semantics';

/* Which client? (docs job): the first step of a New doc that does not start on a client's page (the More page's Docs, the Quick add menu).
 * Clients first, then leads; search by business or contact. */
export default function ClientPickSheet({ leads, onPick, onClose }) {
  const [q, setQ] = useState('');
  const rank = (l) => (['won', 'client'].includes(normalizeStage(l)) ? 0 : 1);
  const list = useMemo(() => leads.filter(l => !l.deleted && (!q.trim() || matchesSearch(l, q))).sort((a, b) => rank(a) - rank(b) || String(a.business).localeCompare(String(b.business))).slice(0, 40), [leads, q]);
  return (
    <Sheet open onClose={onClose} title="Which client?" label="Pick a client for the new doc" tall className="ad-pick">
      <Stack gap={2}>
        <ListSearch value={q} onChange={setQ} placeholder="Search by business or contact" label="Search clients" autoFocus />
        {list.length === 0 ? <p className="cp-hint">No client matches "{q}".</p> : list.map(l => (
          <ListRow key={l._id} title={l.business} subtitle={l.askFor || undefined} trailing={rank(l) === 0 ? <Pill tone="booked" label="Client" size="sm" icon={false} variant="soft" /> : null} onClick={() => { onClose(); onPick(l); }} />
        ))}
      </Stack>
      <style>{`.cp-hint { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-3); }`}</style>
    </Sheet>
  );
}


