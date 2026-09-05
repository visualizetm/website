import { useEffect, useMemo, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Chip, Pill, Avatar, Input, Button, ProgressBar, Table, Sheet, EmptyState, ErrorState, Stagger, SkeletonBlock, useDelayedLoading, useMediaQuery, useToast, useRetry,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar, useShell } from '../shell/ShellContext';
import ClientCard, { clientLine } from '../components/ClientCard';
import LeadDetail from '../components/LeadDetail';
import LeadForm from '../components/LeadForm';
import { defaultLead } from '../lib/defaultLead';
import { PROJECT_STAGES } from '../shared/semantics';
import { money } from '../shared/format';
import { fmtDate } from '../shared/dates';
import { matchesSearch } from '../lib/leads';
import { isClientLead, isOnRetainer, lifetimeValue, CLIENT_FILTERS, clientPasses, isFullyPaid, localDate } from '../lib/projects';

/* Clients (Prompt 10): the paid side of the business. A client is a
 * call_leads document with stage 'client'; projects, payments, retainers and
 * deliverables render through LeadDetail's client mode. */

const fmtDay = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };

export default function AdminClients({
  leads, submissions = [], loading, error, onRetry, projects = [], onCreateProject, onPatchProject, onRefreshProjects,
  onPatch, onCreate, onDelete, onRefresh, onLinkSubmission, onMobileOpen, onMobileClose, onGo, openId, createPreset,
}) {
  const shell = useShell();
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const E = (k) => COPY.empty[k];
  const desktop = useMediaQuery('(min-width: 1024px)');
  const wide = useMediaQuery('(min-width: 1280px)');
  const [selId, setSelId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const showSkel = useDelayedLoading(loading); // projects load after leads, and the counts need both
  const pending = loading && !showSkel;
  const now = Date.now();

  const clients = useMemo(() => leads.filter(isClientLead).sort((a, b) => new Date(b.clientSince || b.bookedOutcome?.at || b.updatedAt || 0) - new Date(a.clientSince || a.bookedOutcome?.at || a.updatedAt || 0)), [leads]);
  const counts = useMemo(() => Object.fromEntries(CLIENT_FILTERS.map(([id]) => [id, clients.filter(l => clientPasses(l, projects, id, now)).length])), [clients, projects, now]);
  const list = useMemo(() => clients.filter(l => clientPasses(l, projects, filter, now) && (!q.trim() || matchesSearch(l, q))), [clients, projects, filter, q, now]);
  const collected = useMemo(() => clients.reduce((n, l) => n + lifetimeValue(l), 0), [clients]);
  const onRet = counts.retainer;
  const summary = `${clients.length} client${clients.length === 1 ? '' : 's'}, ${onRet} on retainer, ${money(collected)} collected`;

  const sel = selId ? leads.find(l => l._id === selId) : null;
  const pick = (id) => { setSelId(id); setCreating(false); onMobileOpen?.(); };
  const back = () => { setSelId(null); setCreating(false); onMobileClose?.(); };
  useEffect(() => { if (openId?.id) { setSelId(openId.id); setCreating(false); onMobileOpen?.(); } }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (createPreset) { setCreating(true); } }, [createPreset]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const pendingOpen = !!openId?.id && loading && !sel;
  if (pendingOpen) {
    return (
      <>
        <aside className={`aa-panel cl-panel${wide ? '' : ' cl-panel--rail'}`} aria-label="Clients"><ScrollArea bare className="cl-panel-scroll"><Stack gap={2}>{showSkel && [1, 2, 3].map(i => <ClientCard.Skeleton key={i} />)}</Stack></ScrollArea></aside>
        <div className="aa-main cl-main">{showSkel && <LeadDetail.Skeleton />}</div>
        <style>{clStyles}</style>
      </>
    );
  }

  if (sel) {
    return (
      <>
        <aside className={`aa-panel cl-panel${wide ? '' : ' cl-panel--rail'}`} aria-label="Clients">
          <ScrollArea bare className="cl-panel-scroll"><Stack gap={2}><p className="cl-muted">{list.length} shown</p><div className="cl-stack">{list.map(l => <ClientCard key={l._id} lead={l} projects={projects} compact onOpen={() => pick(l._id)} selected={sel._id === l._id} />)}</div></Stack></ScrollArea>
        </aside>
        <div className="aa-main cl-main">
          <LeadDetail lead={sel} submissions={submissions} onPatch={onPatch} onDelete={onDelete ? async (id) => { const ok = await onDelete(id); if (ok) back(); else toast.error(COPY.error.del); return ok; } : undefined} onLinkSubmission={onLinkSubmission} onClose={back} client={clientProps} />
        </div>
        {addSheet}
        <style>{clStyles}</style>
      </>
    );
  }

  const columns = [
    { id: 'business', label: 'Business', always: true, sortable: false, render: (r) => <span className="cl-cell-biz"><Avatar name={r.lead.business} size="sm" status={isOnRetainer(r.lead) ? 'booked' : undefined} /><span className="lay-truncate">{r.lead.business}</span></span> },
    { id: 'package', label: 'Package', width: 150, render: (r) => r.project?.name || <span className="cl-muted-cell">None</span> },
    { id: 'stage', label: 'Stage', width: 140, render: (r) => (r.project ? <Pill id={r.project.stage} list={PROJECT_STAGES} size="sm" /> : <Pill id={r.lead.clientStatus || 'active'} tone="neutral" label={r.lead.clientStatus || 'active'} size="sm" icon={false} variant="outline" />) },
    { id: 'paid', label: 'Paid / Total', render: (r) => (r.project ? <span className="cl-cell-pay"><ProgressBar value={r.pct} tone={isFullyPaid(r.project) ? 'booked' : 'progress'} size="sm" /><span>{money(r.paid)} / {money(r.total)}</span></span> : <span className="cl-muted-cell">{money(lifetimeValue(r.lead))} lifetime</span>) },
    { id: 'retainer', label: 'Retainer', render: (r) => (r.retainer ? <Pill tone="booked" label={`${r.retainer.label} ${money(r.retainerAmount)}/mo`} size="sm" icon="RefreshCw01" /> : <span className="cl-muted-cell">None</span>) },
    { id: 'next', label: 'Next date', render: (r) => (r.next ? `${r.next.kind === 'bill' ? 'Bill' : 'Payment'} ${fmtDay(r.next.dueAt)}` : <span className="cl-muted-cell">None</span>) },
    { id: 'since', label: 'Since', render: (r) => fmtDate(r.lead.clientSince) || fmtDate(r.lead.bookedOutcome?.at) || <span className="cl-muted-cell">Unknown</span> },
  ];
  const rows = list.map(l => ({ _id: l._id, lead: l, ...clientLine(l, projects) }));

  return (
    <PageShell className="aa-main aa-main--wide cl-shell">
      <ScrollArea wide className="cl-page">
        <Section title="Clients" loading={loading} description={loading ? undefined : summary} action={<Button icon={Plus} onClick={() => setCreating(true)} className="cl-add">Add client</Button>}>
          <Stack gap={2}>
            <Input className="cl-search" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label="Search clients"
              trailing={q ? <button type="button" className="cl-clear" onClick={() => setQ('')} aria-label="Clear search"><XClose width={14} height={14} /></button> : undefined} />
            <Row gap={2} wrap className="cl-chips">{CLIENT_FILTERS.map(([id, label]) => <Chip key={id} label={label} count={counts[id]} selected={filter === id} onClick={() => setFilter(id)} />)}</Row>
          </Stack>
        </Section>
        {pending ? null : showSkel ? (
          desktop ? <Table.Skeleton rows={5} cols={7} selectable={false} /> : <Stack gap={2} aria-busy="true">{[1, 2, 3, 4].map(i => <ClientCard.Skeleton key={i} />)}</Stack>
        ) : error && !leads.length ? (
          <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>
        ) : !clients.length ? (
          <Card><EmptyState icon="Briefcase01" title={E('clients.none').title} description={E('clients.none').description} action={{ label: E('clients.none').action, onClick: () => (shell ? shell.go('booked') : onGo?.('booked')) }} /></Card>
        ) : !list.length ? (
          <Card><EmptyState size="sm" icon="SearchMd" title={E('clients.filter').title} description={E('clients.filter').description} action={{ label: E('clients.filter').action, onClick: () => { setFilter('all'); setQ(''); } }} /></Card>
        ) : desktop ? (
          <Table aria-label="Clients" columns={columns} rows={rows} onRowClick={(r) => pick(r._id)} storageKey="vz_clients_cols" density="md" className="cl-table" />
        ) : (
          <Stagger className="cl-stack">{list.map(l => <ClientCard key={l._id} lead={l} projects={projects} onOpen={() => pick(l._id)} />)}</Stagger>
        )}
        {loading ? null : <Row gap={2} justify="end"><Button variant="ghost" size="md" icon="RefreshCw01" onClick={() => { onRefresh?.(); onRefreshProjects?.(); }}>Refresh</Button></Row>}
      </ScrollArea>
      {addSheet}
      <style>{clStyles}</style>
    </PageShell>
  );
}

const clStyles = `
  /* The list page rules (.cl-shell, .cl-page, .cl-search, .cl-clear, .cl-stack, .cl-muted, .cl-cell-biz) ship in uiStyles (src/ui/lead.styles.js). */
  .cl-cell-pay { display: inline-flex; align-items: center; gap: var(--v-space-2); min-width: 160px; font-variant-numeric: tabular-nums; }
  .cl-cell-pay .v-bar { width: 72px; }
  .cl-table .v-td { max-width: 260px; }
  .cl-table .v-td .v-pill { max-width: none; }
  .cl-panel { padding: var(--v-space-3); }
  .cl-panel-scroll { padding: 0; }
  @media (min-width: 1024px) and (max-width: 1279px) { .cl-panel--rail { width: 232px; } }
  .cl-main { display: flex; flex-direction: column; min-width: 0; }
  @media (max-width: 767px) { .aa-app.has-detail .aa-main.cl-main { display: flex; } }
`;
