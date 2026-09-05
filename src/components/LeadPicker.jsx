import { useMemo, useState } from 'react';
import { COPY } from '../shared/copy';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import { Sheet, Input, Stack, ListRow, Avatar, Pill, EmptyState } from '../ui';
import { STAGES, normalizeStage } from '../shared/semantics';
import { matchesSearch } from '../lib/leads';
import { formatPhone } from '../shared/phone';

/**
 * LeadPicker (Prompt 11): a Sheet with a search over the loaded leads.
 * @param {object} props
 * @param {Array} props.leads
 * @param {Function} props.onPick (lead) => void
 * @param {Function} props.onClose
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {Function} [props.filter] (lead) => boolean, default: not lost
 * @param {Function} [props.sort] (a, b) => number
 */
export default function LeadPicker({ leads = [], onPick, onClose, title = 'Pick a lead', description, filter, sort }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const keep = filter || ((l) => normalizeStage(l) !== 'lost');
    const pool = leads.filter(l => keep(l) && matchesSearch(l, q));
    const ordered = sort ? [...pool].sort(sort) : pool.sort((a, b) => { const sa = normalizeStage(a) === 'client' ? 0 : 1; const sb = normalizeStage(b) === 'client' ? 0 : 1; return sa - sb || String(a.business).localeCompare(String(b.business)); });
    return ordered.slice(0, 40);
  }, [leads, q, filter, sort]);
  return (
    <Sheet open onClose={onClose} title={title} description={description} tall width={480} className="lp-sheet">
      <Stack gap={2}>
        <Input placeholder="Search by business, contact, phone" value={q} onChange={(e) => setQ(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label="Search leads" data-autofocus />
        {list.length ? list.map(l => (
          <ListRow key={l._id} leading={<Avatar name={l.business} size="sm" />} title={l.business} subtitle={[l.askFor, formatPhone(l.phone), l.industry].filter(Boolean).join(', ')} trailing={<Pill id={normalizeStage(l)} list={STAGES} size="sm" variant="outline" />} onClick={() => onPick(l)} className="lp-row" />
        )) : <EmptyState size="sm" icon="SearchMd" title={COPY.empty['leads.picker'].title} description={COPY.empty['leads.picker'].description} />}
      </Stack>
    </Sheet>
  );
}
