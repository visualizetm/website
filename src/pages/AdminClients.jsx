import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import FilterLines from '@untitled-ui/icons-react/build/esm/FilterLines';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Chip, Pill, Badge, Button, Menu, Table, Sheet, EmptyState, NoResults, ErrorState, Stagger, useDelayedLoading, useMediaQuery, useToast, useRetry,
} from '../ui';
import { COPY } from '../shared/copy';
import ListSearch, { matchLine } from '../components/ListSearch';
import { useTopBar, useShell } from '../shell/ShellContext';
import { useSelection, useScreenOrigin, useRestore } from '../shell/nav-history';
import ClientCard, { clientLine } from '../components/ClientCard';
import HoldRow from '../components/HoldRow';
import { clientRowPill } from '../lib/clientRowPill';
import LeadDetail from '../components/LeadDetail';
import LeadForm from '../components/LeadForm';
import { defaultLead } from '../lib/defaultLead';
import { money } from '../shared/format';
import { fmtDate } from '../shared/dates';
import { matchesSearch } from '../lib/leads';
import { isClientLead, lifetimeValue, CLIENT_FILTERS, clientPasses, localDate } from '../lib/projects';
import { formatPhone, telHref } from '../shared/phone';

/* Clients (Prompt 10): the paid side of the business. A client is a
 * call_leads document with stage 'client'; projects, payments, retainers and
 * deliverables render through LeadDetail's client mode. */

const fmtDay = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };
/* UI simplification, part B: the status chips stay in view; the rest wait behind one Filters button. */
const FIRST_CHIPS = new Set(['all', 'active', 'delivered', 'paused']);

export default function AdminClients({
  leads, submissions = [], loading, error, onRetry, projects = [], posts = [], onCreateProject, onPatchProject, onRefreshProjects,
  onPatch, onCreate, onDelete, onRefresh, onLinkSubmission, onGo, createPreset,
}) {
  const shell = useShell();
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const E = (k) => COPY.empty[k];
  const desktop = useMediaQuery('(min-width: 1024px)');
  const wide = useMediaQuery('(min-width: 1280px)');
  /* Back (done once): the open record rides on the history entry; a row tap pushes, Back pops. */
  const { selId, entry: openEntry, open: openSel, close } = useSelection('clients');
  const [creating, setCreating] = useState(false);
  /* The sidebar's Projects and Planner entries are this screen with a filter (?filter=active, ?filter=planner). */
  const location = useLocation();
  const urlFilter = new URLSearchParams(location.search).get('filter');
  const [filter, setFilter] = useState(CLIENT_FILTERS.some(([id]) => id === urlFilter) ? urlFilter : 'all');
  useEffect(() => { if (CLIENT_FILTERS.some(([id]) => id === urlFilter)) setFilter(urlFilter); else if (urlFilter === null) setFilter('all'); }, [urlFilter]);
  const [q, setQ] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showSkel = useDelayedLoading(loading); // projects load after leads, and the counts need both
  const pending = loading && !showSkel;
  const now = Date.now();

  const clients = useMemo(() => leads.filter(isClientLead).sort((a, b) => new Date(b.clientSince || b.bookedOutcome?.at || b.updatedAt || 0) - new Date(a.clientSince || a.bookedOutcome?.at || a.updatedAt || 0)), [leads]);
  const counts = useMemo(() => Object.fromEntries(CLIENT_FILTERS.map(([id]) => [id, clients.filter(l => clientPasses(l, projects, id, now, posts)).length])), [clients, projects, posts, now]);
  const list = useMemo(() => clients.filter(l => clientPasses(l, projects, filter, now, posts) && (!q.trim() || matchesSearch(l, q))), [clients, projects, posts, filter, q, now]);
  const collected = useMemo(() => clients.reduce((n, l) => n + lifetimeValue(l), 0), [clients]);
  const onRet = counts.retainer;
  // One line beside Add client at every width: the phone drops the retainer count (the sheet's chip carries it).
  const summary = desktop ? `${clients.length} client${clients.length === 1 ? '' : 's'}, ${onRet} on retainer, ${money(collected)} collected` : `${clients.length} client${clients.length === 1 ? '' : 's'}, ${money(collected)} collected`;

  const sel = selId ? leads.find(l => l._id === selId) : null;
  const pick = (id) => { setCreating(false); openSel(id); };
  const back = () => close();
  useEffect(() => { if (createPreset) { setCreating(true); } }, [createPreset]);
  useScreenOrigin(() => ({ filters: { filter, q }, selectedId: selId }));
  useRestore((o) => { if (o.filters) { if (o.filters.filter) setFilter(o.filters.filter); setQ(o.filters.q || ''); } });  
  useTopBar(null);
  const clientProps = { projects, onCreateProject, onPatchProject };

  const addClient = async (f) => {
    const ok = await onCreate({ ...defaultLead(f), stage: 'client', clientSince: new Date().toISOString(), clientStatus: 'active' });
    if (ok) { toast.success(`${f.business} added as a client.`); setCreating(false); } else toast.error(COPY.error.create);
  };
  const addSheet = creating && (
    <Sheet open onClose={() => setCreating(false)} title="Add client" description="For walk ins that never went through the pipeline." tall width={640}>
      <LeadForm creating onSave={addClient} onCancel={() => setCreating(false)} />
    </Sheet>
  );

  const pendingOpen = !!selId && loading && !sel;
  if (pendingOpen) {
    return (
      <>
        <aside className={`aa-panel cl-panel${wide ? '' : ' cl-panel--rail'}`} aria-label="Clients"><ScrollArea bare className="cl-panel-scroll"><Stack gap={2}>{showSkel && [1, 2, 3].map(i => <ClientCard.Skeleton key={i} />)}</Stack></ScrollArea></aside>
        <div className="aa-main cl-main">{showSkel && <LeadDetail.Skeleton mode="client" />}</div>
        <style>{clStyles}</style>
      </>
    );
  }

  if (sel) {
    return (
      <>
        <aside className={`aa-panel cl-panel${wide ? '' : ' cl-panel--rail'}`} aria-label="Clients">
          <ScrollArea bare className="cl-panel-scroll"><Stack gap={2}><p className="cl-muted">{list.length} shown</p><div className="cl-stack">{list.map(l => <ClientCard key={l._id} lead={l} projects={projects} onOpen={() => pick(l._id)} selected={sel._id === l._id} />)}</div></Stack></ScrollArea>
        </aside>
        <div className="aa-main cl-main">
          <LeadDetail lead={sel} submissions={submissions} onPatch={onPatch} onDelete={onDelete ? async (id) => { const ok = await onDelete(id); if (ok) back(); else toast.error(COPY.error.del); return ok; } : undefined} onLinkSubmission={onLinkSubmission} onClose={back} intent={openEntry?.intent || null} client={clientProps} />
        </div>
        {addSheet}
        <style>{clStyles}</style>
      </>
    );
  }

  /* The desktop table (UI simplification, part B): business, the one pill (the card's rule), package, paid, next date, menu. Since stays in the chooser. */
  const rowMenu = (l) => [
    { id: 'open', label: 'Open', icon: 'ArrowRight', onSelect: () => pick(l._id) },
    ...(l.phone ? [{ id: 'call', label: `Call ${formatPhone(l.phone)}`, icon: 'Phone', onSelect: () => { window.location.href = telHref(l.phone); } }] : []),
    ...(shell?.openShowcase ? [{ id: 'showcase', label: 'Showcase', icon: 'Image01', onSelect: () => shell.openShowcase(l) }] : []),
    ...(shell?.openPlanner ? [{ id: 'planner', label: 'Planner', icon: 'Calendar', onSelect: () => shell.openPlanner(l) }] : []),
    ...(shell?.openTasks ? [{ id: 'tasks', label: 'Tasks', icon: 'CheckDone01', onSelect: () => shell.openTasks(l) }] : []),
  ];
  const columns = [
    { id: 'business', label: 'Business', always: true, sortable: false, render: (r) => <span className="cl-cell-biz lay-truncate">{r.lead.business}</span> },
    { id: 'pill', label: 'Status', width: 170, render: (r) => <Pill tone={r.pill.tone} label={r.pill.label} size="sm" icon={false} /> },
    { id: 'package', label: 'Package', width: 150, render: (r) => r.project?.name || <span className="cl-muted-cell">None</span> },
    { id: 'paid', label: 'Paid', render: (r) => (r.project ? <span className="cl-cell-pay">{money(r.paid)} of {money(r.total)}</span> : <span className="cl-muted-cell">No project</span>) },
    { id: 'next', label: 'Next date', render: (r) => (r.next ? `${r.next.kind === 'bill' ? 'Bill' : 'Payment'} ${fmtDay(r.next.dueAt)}` : <span className="cl-muted-cell">None</span>) },
    { id: 'since', label: 'Since', hidden: true, render: (r) => fmtDate(r.lead.clientSince) || fmtDate(r.lead.bookedOutcome?.at) || <span className="cl-muted-cell">Unknown</span> },
  ];
  const rows = list.map(l => ({ _id: l._id, lead: l, pill: clientRowPill(l, projects, now), ...clientLine(l, projects) }));

  return (
    <PageShell className="aa-main aa-main--wide cl-shell">
      <ScrollArea wide className="cl-page">
        <Section title="Clients" loading={loading} description={loading ? undefined : (q.trim() || filter !== 'all') ? matchLine(clients.length, 'clients', list.length) : summary} action={<Button icon={Plus} onClick={() => setCreating(true)} className="cl-add">Add client</Button>}>
          <Stack gap={2}>
            <ListSearch className="cl-search" placeholder="Search clients" value={q} onChange={setQ} label="Search clients" />
            <Row gap={2} wrap className="cl-chips">{CLIENT_FILTERS.filter(([id]) => FIRST_CHIPS.has(id)).map(([id, label]) => <Chip key={id} label={label} count={counts[id]} selected={filter === id} onClick={() => setFilter(id)} />)}<Badge count={FIRST_CHIPS.has(filter) ? 0 : 1} aria-label="1 set"><Button variant="secondary" size="md" icon={FilterLines} onClick={() => setFiltersOpen(true)} className="cl-filters-btn" aria-expanded={filtersOpen}>Filters</Button></Badge></Row>
          </Stack>
        </Section>
        {pending ? null : showSkel ? (
          desktop ? <Table.Skeleton rows={5} cols={6} selectable={false} /> : <Stack gap={2} aria-busy="true">{[1, 2, 3, 4].map(i => <ClientCard.Skeleton key={i} />)}</Stack>
        ) : error && !leads.length ? (
          <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>
        ) : !clients.length ? (
          <Card><EmptyState icon="Briefcase01" title={E('clients.none').title} description={E('clients.none').description} action={{ label: E('clients.none').action, onClick: () => (shell ? shell.go('deals') : onGo?.('deals')) }} /></Card>
        ) : !list.length ? (
          <Card><NoResults noun="clients" query={q} filters={filter !== 'all' ? [(CLIENT_FILTERS.find(([id]) => id === filter) || [])[1]] : []} onClear={() => { setFilter('all'); setQ(''); }} /></Card>
        ) : desktop ? (
          <Table aria-label="Clients" columns={columns} rows={rows} onRowClick={(r) => pick(r._id)} rowActions={(r) => <Menu label={`Actions for ${r.lead.business}`} items={rowMenu(r.lead)} />} storageKey="vz_clients_cols" density="md" className="cl-table" />
        ) : (
          <Stagger className="cl-stack">{list.map(l => <HoldRow key={l._id} title={l.business} subtitle={[l.industry, l.area].filter(Boolean).join(' · ')} items={rowMenu(l)} enabled={!desktop}
            facts={[{ label: 'Phone', value: l.phone ? formatPhone(l.phone) : '' }, { label: 'Since', value: l.clientSince ? fmtDate(l.clientSince) : '' }, { label: 'Contact', value: l.askFor }]}><ClientCard lead={l} projects={projects} onOpen={() => pick(l._id)} /></HoldRow>)}</Stagger>
        )}
        {loading ? null : <Row gap={2} justify="end"><Button variant="ghost" size="md" icon="RefreshCw01" onClick={() => { onRefresh?.(); onRefreshProjects?.(); }}>Refresh</Button></Row>}
      </ScrollArea>
      {addSheet}
      {filtersOpen && (
        <Sheet open onClose={() => setFiltersOpen(false)} title="Filters" description="Money, retainers and delivery" label="Filters" width={440}
          footer={<><Button variant="ghost" onClick={() => setFilter('all')} disabled={FIRST_CHIPS.has(filter)}>Clear</Button><Button onClick={() => setFiltersOpen(false)}>Done</Button></>}>
          <Row gap={2} wrap className="cl-chips">{CLIENT_FILTERS.filter(([id]) => !FIRST_CHIPS.has(id)).map(([id, label]) => <Chip key={id} label={label} count={counts[id]} selected={filter === id} onClick={() => setFilter(filter === id ? 'all' : id)} />)}</Row>
        </Sheet>
      )}
      <style>{clStyles}</style>
    </PageShell>
  );
}

const clStyles = `
  /* The list page rules (.cl-shell, .cl-page, .cl-search, .cl-clear, .cl-stack, .cl-muted, .cl-cell-biz) ship in uiStyles (src/ui/lead.styles.js). */
  .cl-cell-pay { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cl-filters-btn { flex-shrink: 0; }
  .cl-table .v-td { max-width: 260px; }
  .cl-table .v-td .v-pill { max-width: none; }
  .cl-panel { padding: var(--v-space-3); }
  .cl-panel-scroll { padding: 0; }
  @media (min-width: 1024px) and (max-width: 1279px) { .cl-panel--rail { width: 232px; } }
  /* min-height: 0 is not optional on a flex item that holds a scroller:
     without it the item's automatic minimum size is its content, so it
     grows to the full height of the detail and the ScrollArea inside it
     has nothing left to scroll (the mobile scroll fix). */
  .cl-main { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
  @media (max-width: 767px) { .aa-app.has-detail .aa-main.cl-main { display: flex; } }
`;
