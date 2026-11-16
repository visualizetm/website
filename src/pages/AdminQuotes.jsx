import { useMemo, useState } from 'react';
import { PageShell, ScrollArea, Section, Row, Stack, Card, Button, Chip, Pill, EmptyState, NoResults, ErrorState, SkeletonBlock, SkeletonText, useMediaQuery, useToast } from '../ui';
import { COPY } from '../shared/copy';
import { fmtDate } from '../shared/dates';
import { useTopBar } from '../shell/ShellContext';
import ListSearch from '../components/ListSearch';
import { quoteRows, quoteSums, quoteStatusOf, fmtMoney, QUOTE_STATUS, QUOTE_STATUS_IDS } from '../lib/quote';

/* Quotes (/quotes): every quote in one list, a section root reached from More, the sidebar and the quick add's New quote. The count
 * line, a search over business, person and number, chips with counts (All, Draft, Sent, Accepted, Declined), then one row per quote:
 * who it is for, its number, its total, where it stands and when it last changed. A row opens the editor (/quotes/:id); New quote is
 * the one primary action. Nothing here sends. */
export const QUOTE_TONE = { draft: 'neutral', sent: 'progress', accepted: 'booked', declined: 'danger' };
const CHIPS = [{ id: 'all', label: 'All' }, ...QUOTE_STATUS_IDS.map(id => ({ id, label: QUOTE_STATUS[id] }))];

export default function AdminQuotes({ quotesApi, loading = false }) {
  const toast = useToast();
  const phone = useMediaQuery('(max-width: 767px)');
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('all');
  const [busy, setBusy] = useState(false);
  useTopBar(null);
  const quotes = loading ? undefined : quotesApi?.quotes; // the audits' forced loading state shows nothing that has loaded
  const waiting = loading || !!quotesApi?.loading;
  const view = useMemo(() => quoteRows(quotes || [], { query: q, status: chip }), [quotes, q, chip]);
  const newQuote = async () => {
    setBusy(true);
    try { if (!(await quotesApi?.newQuote?.())) toast.error(COPY.error.create); } finally { setBusy(false); }
  };
  const clear = () => { setQ(''); setChip('all'); };
  const countLine = waiting ? ' ' : `${view.total} ${view.total === 1 ? 'quote' : 'quotes'}${q.trim() || chip !== 'all' ? `, ${view.rows.length} match` : ''}`;

  let body;
  if (quotesApi?.error && !view.total) body = <Card><ErrorState title="Quotes did not load" description="Nothing was lost. Try again." onRetry={quotesApi.reload} /></Card>;
  else if (waiting && !view.total) body = (
    /* The loaded shape: the search and New quote, the chips, then rows (two lines of text and a pill each). */
    <div className="qs-skel" aria-busy="true" aria-hidden="true">
      <div className="qs-top"><div className="qs-grow lsr-skel"><SkeletonBlock height={44} radius="var(--v-radius-md)" /></div><SkeletonBlock width={125} height={44} radius="var(--v-radius-md)" /></div>
      <div className="qs-chips">{[101, 95, 92, 126, 120].map((w, i) => <SkeletonBlock key={i} width={w} height={44} radius="var(--v-radius-pill)" />)}</div>
      <div className="qs-rows">{[0, 1, 2, 3].map(i => <Card key={i} padding={3} className="qs-row"><SkeletonText lines={2} /></Card>)}</div>
    </div>
  );
  else if (!view.total) { const E = COPY.empty.quotes; body = <EmptyState icon="Receipt" title={E.title} description={E.description} action={{ label: E.action, icon: 'Plus', onClick: newQuote }} />; }
  else body = (
    <>
      <div className="qs-top">
        <ListSearch value={q} onChange={setQ} placeholder={phone ? 'Search quotes' : 'Search business, person or number'} label="Search quotes" className="qs-grow qs-search" />
        <Button icon="Plus" loading={busy} onClick={newQuote} className="qs-new">New quote</Button>
      </div>
      <div className="qs-chips" role="group" aria-label="Show">
        {CHIPS.map(c => <Chip key={c.id} label={c.label} count={view.counts[c.id]} selected={chip === c.id} onClick={() => setChip(c.id)} className={`qs-chip qs-chip--${c.id}`} />)}
      </div>
      {view.rows.length === 0 ? <NoResults noun="quotes" query={q} filters={chip === 'all' ? [] : [QUOTE_STATUS[chip]]} onClear={clear} /> : (
        <ul className="qs-rows" data-v-enter>
          {view.rows.map(row => {
            const s = quoteSums(row.lines); const st = quoteStatusOf(row);
            const who = row.business || 'No one yet';
            return (
              <li key={row._id}>
                <Card as="div" padding={3} interactive className={`qs-row lay-card is-${st}`} data-row-id={String(row._id)}>
                  <button type="button" className="v-stretch" onClick={() => quotesApi.openQuote(row)} aria-label={`Open ${row.number} for ${who}, ${fmtMoney(s.total, s.hasCents)}, ${QUOTE_STATUS[st]}`}>{who}</button>
                  <Row gap={3} align="start" wrap={false} style={{ minWidth: 0 }}>
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <span className="qs-who lay-truncate">{who}</span>
                      <span className="qs-line lay-truncate">{[row.person, row.number, fmtDate(row.updatedAt || row.createdAt)].filter(Boolean).join(' · ')}</span>
                    </Stack>
                    <Stack gap={1} align="end">
                      <span className="qs-amt">{fmtMoney(s.total, s.hasCents)}</span>
                      <Pill tone={QUOTE_TONE[st]} label={QUOTE_STATUS[st]} size="sm" icon={false} />
                    </Stack>
                  </Row>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
  return (
    <PageShell className="aa-main aa-main--wide qs-shell">
      <ScrollArea wide className="qs-page">
        {!phone && <Section description={waiting ? undefined : countLine} loading={waiting} />}
        {phone && <p className="qs-count" aria-live="polite">{countLine}</p>}
        {body}
      </ScrollArea>
      <style>{qsStyles}</style>
    </PageShell>
  );
}
const qsStyles = `
  .qs-page { display: flex; flex-direction: column; gap: var(--v-space-4); }
  .qs-count { margin: 0; min-height: var(--v-lh-sm); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .qs-skel { display: flex; flex-direction: column; gap: var(--v-space-4); }
  .qs-top { display: flex; gap: var(--v-space-2); align-items: center; min-height: 52px; }
  .qs-grow { flex: 1 1 auto; min-width: 0; }
  .qs-new { flex: 0 0 auto; }
  .qs-chips { display: flex; flex-wrap: wrap; gap: var(--v-space-2); }
  .qs-skel .qs-chips { padding-bottom: var(--v-space-1); }
  .qs-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--v-space-2); }
  .qs-row { position: relative; min-height: 72px; }
  .qs-who { font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .qs-line { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .qs-amt { font-family: var(--v-font-display); font-size: var(--v-text-xl); line-height: 1; font-variant-numeric: tabular-nums; }
  .qs-rows[data-v-enter] > li { animation: v-enter var(--v-dur-enter) var(--v-ease-out) both; }
  @media (prefers-reduced-motion: reduce) { .qs-rows[data-v-enter] > li { animation: none; } }
`;
