import { useMemo, useState } from 'react';
import { PageShell, ScrollArea, Row, Button, Select, Menu, Pill, EmptyState, NoResults, ErrorState, Stagger, SkeletonBlock, SwipeRow, useDelayedLoading, useMediaQuery, useToast } from '../ui';
import RowSheet from '../components/RowSheet';
import ListSearch from '../components/ListSearch';
import DocRow from '../components/docs/DocRow';
import { copyText } from '../components/ClientWorkspace';
import { useTopBar } from '../shell/ShellContext';
import { DOC_TYPES, docPlainText } from '../shared/docBlocks';
import { docsOf, groupByType, sortDocs, matchDoc, typeLabel, fetchDoc } from '../lib/docs';
import { COPY } from '../shared/copy';

/* All docs (docs job, milestone 5), two doors into one screen:
 *   /clients/:id/docs   one client's docs, grouped by type, a focused screen (Back, the title, New doc)
 *   /docs               every client's docs (the More page's Docs section), flat, filtered by type and by client
 * Search looks at the title, the type and the block text; sort is by last edit or by creation, pinned first either way. Each row is the
 * Docs card's row. On a phone a swipe right pins, a swipe left deletes (with Undo), a long press opens the row's sheet (Open, Pin, Duplicate,
 * Copy as text, Delete); on a computer the row has a menu with the same items. Deleting moves a doc to Recently Deleted. */
const SORTS = [{ id: 'edited', label: 'Last edited' }, { id: 'created', label: 'Created' }];

export default function AdminDocs({ lead = null, forClient = false, leads = [], docsApi, loading = false, onBack }) {
  const toast = useToast();
  const phone = useMediaQuery('(max-width: 767px)');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('edited');
  const [typeId, setTypeId] = useState('');
  const [clientId, setClientId] = useState('');
  const [sheet, setSheet] = useState(null);       // a doc whose row sheet is open
  const ops = docsApi?.ops;
  const showSkel = useDelayedLoading(loading || !!docsApi?.loading);
  const now = Date.now();

  const byLead = useMemo(() => new Map(leads.map(l => [String(l._id), l])), [leads]);
  const mine = useMemo(() => (lead ? docsOf(docsApi?.docs, lead._id) : (docsApi?.docs || [])), [docsApi?.docs, lead]);
  const shown = useMemo(() => mine.filter(d => matchDoc(d, q) && (!typeId || (d.type || 'general') === typeId) && (!clientId || String(d.leadId) === clientId)), [mine, q, typeId, clientId]);
  const counts = useMemo(() => Object.fromEntries(DOC_TYPES.map(t => [t.id, mine.filter(d => (d.type || 'general') === t.id).length])), [mine]);
  const clientsWithDocs = useMemo(() => [...new Set(mine.map(d => String(d.leadId)))].map(id => ({ id, label: byLead.get(id)?.business || 'Client' })).sort((a, b) => a.label.localeCompare(b.label)), [mine, byLead]);
  const filterNames = [typeId ? typeLabel(typeId) : '', clientId ? byLead.get(clientId)?.business : ''].filter(Boolean);
  const clear = () => { setQ(''); setTypeId(''); setClientId(''); };

  const newDoc = () => { if (lead) docsApi.newDoc(lead); else docsApi.pickClient(); };
  /* A per client page is a focused screen and declares New doc; the all clients page is a tabs screen (More), whose top bar is Search, Quick add (it has New doc) and Notifications. */
  useTopBar({ title: 'Docs', back: onBack, actions: lead || forClient ? [{ id: 'new', label: 'New doc', icon: 'Plus', onClick: newDoc }] : undefined });

  const pin = async (d) => { const r = await ops.patch(d._id, { pinned: !d.pinned }); if (!r.ok) toast.error(COPY.error.save); else toast.success(d.pinned ? 'Unpinned.' : 'Pinned to the card.'); };
  const dup = async (d) => { const item = await ops.duplicate(d); if (item) toast.success('Duplicated.'); else toast.error(COPY.error.save); };
  const copyIt = async (d) => { const r = await fetchDoc(d._id); if (r.ok) copyText(toast, docPlainText(r.data.item), 'Doc'); else toast.error(COPY.error.copy); };
  const del = async (d) => {
    if (!(await ops.remove(d))) { toast.error(COPY.error.save); return; }
    toast.undo('Moved to Recently Deleted.', () => ops.restore(d._id), { seconds: 6 });
  };
  const itemsFor = (d) => [
    { id: 'open', label: 'Open', icon: 'File02', onSelect: () => docsApi.openDoc(d) },
    { id: 'pin', label: d.pinned ? 'Unpin from card' : 'Pin to card', icon: 'Pin01', onSelect: () => pin(d) },
    { id: 'dup', label: 'Duplicate', icon: 'FilePlus01', onSelect: () => dup(d) },
    { id: 'copy', label: 'Copy as text', icon: 'Copy01', onSelect: () => copyIt(d) },
    'divider',
    { id: 'del', label: 'Move to Recently Deleted', icon: 'Trash01', danger: true, onSelect: () => del(d) },
  ];
  const row = (d) => {
    const clientName = lead ? '' : (byLead.get(String(d.leadId))?.business || 'Client');
    return (
      <SwipeRow key={d._id} enabled={phone} right={{ label: d.pinned ? 'Unpin' : 'Pin', icon: 'Pin01', tone: 'primary', onCommit: () => pin(d) }} left={{ label: 'Delete', icon: 'Trash01', tone: 'danger', onCommit: () => del(d) }} onHold={() => setSheet(d)}>
        <ul className="ad-one"><DocRow doc={d} client={clientName} now={now} onOpen={docsApi.openDoc} controls={!phone ? <Menu label={`${d.title || 'Untitled'} actions`} items={itemsFor(d)} /> : undefined} /></ul>
      </SwipeRow>
    );
  };

  let body;
  if (showSkel) {
    /* The shape of the loaded list: the search, the three controls, then the rows (grouped by type for one client). Row heights follow the rows' own: one line titles are 64, a title that wraps is 86. */
    const perClient = !!lead || forClient;
    const rowH = phone ? [66, 88, 66, 66, 66, 66, 66] : [44, 62, 44, 44, 44, 44, 44];
    const rows = (hs) => hs.map((h, i) => <SkeletonBlock key={i} height={h} radius="var(--v-radius-md)" />);
    body = (
      <div className="ad-skel" aria-busy="true" aria-hidden="true">
        <SkeletonBlock height={44} radius="var(--v-radius-md)" className="lsr-skel" />
        <div className="ad-controls"><SkeletonBlock height={68} radius="var(--v-radius-md)" /><SkeletonBlock height={68} radius="var(--v-radius-md)" />{!perClient && <SkeletonBlock height={68} radius="var(--v-radius-md)" className="ad-client" />}</div>
        {perClient ? <div className="ad-groups">{rowH.slice(0, 5).map((h, i) => <section key={i} className="ad-group"><p className="ad-group-h"><SkeletonBlock width={72} height={16} /></p><div className="ad-rows">{rows([h])}</div></section>)}</div> : <div className="ad-rows">{rows(rowH)}</div>}
      </div>
    );
  } else if (forClient && !lead) {
    body = <EmptyState icon="File02" title="This client is not here" description="They may have been deleted. Their docs are in Recently Deleted until you purge them." action={{ label: 'Back', onClick: onBack }} />;
  } else if (docsApi?.error) {
    body = <ErrorState title="Docs did not load" description="Nothing was lost. Try again." onRetry={docsApi.reload} />;
  } else if (!mine.length) {
    body = lead
      ? <EmptyState icon="File02" title={COPY.empty['clients.docs'].title} description={COPY.empty['clients.docs'].description} action={{ label: 'New doc', icon: 'Plus', onClick: newDoc }} />
      : <EmptyState icon="File02" title={COPY.docs.allEmpty.title} description={COPY.docs.allEmpty.description} action={{ label: 'New doc', icon: 'Plus', onClick: newDoc }} />;
  } else {
    body = (
      <>
        <ListSearch value={q} onChange={setQ} placeholder="Search titles and what is in them" label="Search docs" className="ad-search" />
        <div className="ad-controls">
          <Select label="Type" value={typeId} onChange={(e) => setTypeId(e.target.value)} options={[{ id: '', label: 'All types' }, ...DOC_TYPES.filter(t => counts[t.id] > 0).map(t => ({ id: t.id, label: `${t.label}, ${counts[t.id]}` }))]} className="ad-type" />
          <Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} options={SORTS} className="ad-sort" />
          {!lead && clientsWithDocs.length > 1 && <Select label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)} options={[{ id: '', label: 'All clients' }, ...clientsWithDocs]} className="ad-client" />}
        </div>
        {shown.length === 0 ? <NoResults noun="docs" query={q} filters={filterNames} onClear={clear} /> : lead ? (
          <Stagger className="ad-groups" cap={4}>
            {groupByType(shown, sort).map(g => (
              <section key={g.id} className="ad-group" aria-label={g.label}>
                <p className="ad-group-h">{g.label}<span className="ad-group-n">{g.docs.length}</span></p>
                <div className="ad-rows">{g.docs.map(row)}</div>
              </section>
            ))}
          </Stagger>
        ) : (
          <Stagger className="ad-rows" cap={5}>{sortDocs(shown, sort).map(row)}</Stagger>
        )}
      </>
    );
  }

  return (
    <PageShell className="aa-main aa-main--wide ad-page">
      <ScrollArea wide className="ad-scroll">
        {!phone && (
          <div className="ad-top">
            <Row gap={2} align="center" justify="between" wrap>
              <Row gap={2} align="center" wrap style={{ minWidth: 0 }}>
                {(lead || forClient) && <Button variant="ghost" icon="ArrowLeft" onClick={onBack} className="ad-back">Back</Button>}
                <h1 className="ad-title lay-title">{lead ? `${lead.business}, docs` : 'Docs'}</h1>
                {mine.length > 0 && <Pill tone="neutral" label={`${mine.length}`} size="sm" icon={false} variant="soft" />}
              </Row>
              <Button icon="Plus" onClick={newDoc} className="ad-new">New doc</Button>
            </Row>
          </div>
        )}
        {phone && !lead && !forClient && (showSkel || mine.length > 0) && <div className="ad-phone-new">{showSkel ? <SkeletonBlock width={116} height={44} radius="var(--v-radius-md)" /> : <Button icon="Plus" variant="secondary" onClick={newDoc} className="ad-new">New doc</Button>}</div>}
        {phone && (lead || forClient) && <h1 className="ad-title ad-title--phone lay-title">{lead ? lead.business : <SkeletonBlock width={140} height={16} />}</h1>}
        <div className="ad-body">{body}</div>
      </ScrollArea>
      {sheet && <RowSheet title={sheet.title || 'Untitled'} subtitle={`${typeLabel(sheet.type)}${lead ? '' : `, ${byLead.get(String(sheet.leadId))?.business || ''}`}`} items={itemsFor(sheet)} onClose={() => setSheet(null)} />}
      <style>{adStyles}</style>
    </PageShell>
  );
}

const adStyles = `
  .ad-top { position: sticky; top: 0; z-index: var(--v-z-sticky); padding: var(--v-space-3) 0; background: var(--v-surface-1); border-bottom: 1px solid var(--v-border-1); }
  .ad-title { margin: 0; font-size: var(--v-text-lg); font-weight: var(--v-weight-bold); color: var(--v-text); min-width: 0; }
  .ad-title--phone { font-size: var(--v-text-md); line-height: var(--v-lh-md); min-height: var(--v-lh-md); color: var(--v-text-2); }
  .ad-body { display: flex; flex-direction: column; gap: var(--v-space-3); padding-top: var(--v-space-4); padding-bottom: var(--v-space-6); min-width: 0; }
  .ad-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--v-space-3); min-width: 0; }
  .ad-controls > .ad-client { grid-column: 1 / -1; }
  @media (min-width: 768px) { .ad-controls { grid-template-columns: repeat(3, minmax(0, 240px)); } .ad-controls > .ad-client { grid-column: auto; } }
  .ad-phone-new { display: flex; padding-top: var(--v-space-1); }
  .ad-skel { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .ad-groups, .ad-rows { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .ad-groups { gap: var(--v-space-4); }
  .ad-group { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .ad-group-h { margin: 0; display: flex; align-items: center; gap: var(--v-space-2); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .ad-group-n { font-variant-numeric: tabular-nums; }
  .ad-one { list-style: none; margin: 0; padding: 0; }
  .ad-hint { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-3); }
`;
