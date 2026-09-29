import { useEffect, useMemo, useState } from 'react';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Chip, Pill, Menu, Button, Table, EmptyState, ErrorState, Stagger, SkeletonBlock, useDelayedLoading, useMediaQuery, useRetry,
} from '../ui';
import { COPY } from '../shared/copy';
import { PROJECT_STAGES, INVOICE_STATUSES } from '../shared/semantics';
import { money } from '../shared/format';
import { fmtDate, relativeTime } from '../shared/dates';
import { apiFetch } from '../shared/api';
import { useShell, useTopBar } from '../shell/ShellContext';
import ListSearch, { matchesList, matchLine } from '../components/ListSearch';
import TaskSheet from '../components/TaskSheet';
import { isTask } from '../lib/tasks';
import { useScreenOrigin, useRestore } from '../shell/nav-history';
import { invoicesOf, invoiceStatus, nextUnpaidInvoice, invoicesPastDue } from '../lib/invoices';
import { liveNextAction } from '../lib/nextAction';
import { packageOf } from '../shared/pricing';

/* Projects (CRM revamp, step 7): every project on one screen. A desktop
 * shows a table (Client, Package, Stage, Next action, Next invoice, Last
 * touch) sorted overdue first then by the next invoice's day, with a
 * summary strip above it; a phone shows the same as cards. A row opens the
 * client record on its Projects fold. Retainers sit in the list with a
 * Retainer pill; archived projects stay hidden behind a chip. */
const DAY = 864e5;
const fmtDay = (s) => (s ? fmtDate(`${String(s).slice(0, 10)}T12:00:00`) : '');
export const projectIsOverdue = (p, ctx, now = Date.now()) => { const a = liveNextAction(p, ctx, now); return !!a && !a.doneAt && !!a.dueAt && new Date(a.dueAt).getTime() < now; };
export const overdueProjects = (projects, ctx, now = Date.now()) => (projects || []).filter(p => !p.archived && projectIsOverdue(p, ctx, now)).length;
const lastTouchOf = (p) => [p.updatedAt, p.createdAt, ...(p.revisions?.log || []).map(r => r.at), ...invoicesOf(p).map(i => i.paidAt)].filter(Boolean).map(v => new Date(v).getTime()).filter(t => !Number.isNaN(t)).sort((a, b) => b - a)[0] || 0;

export default function AdminProjects({ projects = [], leads = [], loading = false, error = false, onRetry, onOpen, onNew, onPatch }) {
  const shell = useShell();
  const [retry, retrying] = useRetry(onRetry);
  const showSkel = useDelayedLoading(loading);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState(null); // loaded on demand
  const [q, setQ] = useState('');
  const [taskFor, setTaskFor] = useState(null); // the project a Set task sheet is open for
  useTopBar(null);
  useScreenOrigin(() => ({ filters: { showArchived, q } }));
  useRestore((o) => { if (o.filters) { setShowArchived(!!o.filters.showArchived); setQ(o.filters.q || ''); } });
  const now = Date.now();
  const ctx = useMemo(() => ({ projects, sets: shell?.sets || [] }), [projects, shell?.sets]);
  const byId = useMemo(() => new Map((leads || []).map(l => [String(l._id), l])), [leads]);
  useEffect(() => { if (showArchived && archived === null) apiFetch('/api/admin/projects?archived=1').then(r => setArchived(r.ok ? (r.data?.items || []) : [])); }, [showArchived, archived]);
  const rows = useMemo(() => {
    const list = [...(projects || []).filter(p => !p.archived), ...(showArchived ? (archived || []) : [])];
    return list.map(p => {
      const lead = byId.get(String(p.leadId)) || null;
      const action = liveNextAction(p, ctx, now);
      const overdue = !!action && !action.doneAt && !!action.dueAt && new Date(action.dueAt).getTime() < now;
      const next = nextUnpaidInvoice(invoicesOf(p), now);
      return { p, lead, action, overdue, next, nextKey: next?.dueAt || '9999-99-99', touch: lastTouchOf(p) };
    }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.nextKey.localeCompare(b.nextKey) || b.touch - a.touch);
  }, [projects, archived, showArchived, byId, ctx, now]);
  const allRows = rows;
  const shown = useMemo(() => (q.trim() ? allRows.filter(r => (r.lead && matchesList(r.lead, q)) || String(r.p.name || '').toLowerCase().includes(q.trim().toLowerCase())) : allRows), [allRows, q]);
  const summary = useMemo(() => {
    const live = (projects || []).filter(p => !p.archived);
    const open = live.filter(p => p.stage !== 'delivered').length;
    const weekEnd = now + 7 * DAY;
    let dueWeek = 0; let pastDue = 0;
    for (const p of live) {
      const lines = invoicesOf(p);
      if (invoicesPastDue(lines, now).length) pastDue++;
      for (const s of lines) { const st = invoiceStatus(s, now); if (st === 'paid' || st === 'draft' || !s.dueAt) continue; const t = new Date(`${s.dueAt}T12:00:00`).getTime(); if (t <= weekEnd) dueWeek += Number(s.amount) || 0; }
    }
    return { open, dueWeek, pastDue };
  }, [projects, now]);
  const open = (r) => { if (r.lead) onOpen?.(r.lead, 'projects'); };
  const stagePill = (p) => (p.kind === 'retainer' ? <Pill tone="callback" label="Retainer" size="sm" icon="RefreshCw01" /> : <Pill id={p.stage} list={PROJECT_STAGES} size="sm" />);
  const actionCell = (r) => (r.action && !r.action.doneAt ? <span className={`pj-action${r.overdue ? ' is-overdue' : ''}`}>{r.action.label}{r.action.dueAt ? `, ${fmtDate(r.action.dueAt)}` : ''}</span> : <span className="pj-muted">Nothing due</span>);
  const invoiceCell = (r) => (r.next ? <Row gap={2} align="center" wrap><span>{money(r.next.amount)}, {fmtDay(r.next.dueAt)}</span><Pill id={invoiceStatus(r.next, now)} list={INVOICE_STATUSES} size="sm" /></Row> : <span className="pj-muted">None</span>);
  const columns = [
    { id: 'client', label: 'Client', sticky: true, always: true, render: (r) => <span className="pj-client lay-truncate">{r.lead?.business || 'Unknown client'}</span> },
    { id: 'package', label: 'Package', render: (r) => packageOf(r.p.packageId)?.label || r.p.name || '' },
    { id: 'stage', label: 'Stage', width: 150, render: (r) => <Row gap={1} align="center">{stagePill(r.p)}{r.p.archived && <Pill tone="neutral" label="Archived" size="sm" icon={false} />}</Row> },
    { id: 'action', label: 'Next action', render: actionCell },
    { id: 'invoice', label: 'Next invoice', render: invoiceCell },
    { id: 'touch', label: 'Last touch', hidden: true, render: (r) => (r.touch ? relativeTime(r.touch) : '') },
  ];
  const rowMenu = (r) => [
    { id: 'open', label: 'Open the client', icon: 'ArrowRight', disabled: !r.lead, onSelect: () => open(r) },
    { id: 'money', label: 'Open Money', icon: 'CurrencyDollar', disabled: !r.lead, onSelect: () => { if (r.lead) onOpen?.(r.lead, 'payments'); } },
    ...(onPatch ? [{ id: 'task', label: isTask(r.action) && !r.action.doneAt ? 'Edit task' : 'Set task', icon: 'CheckCircle', onSelect: () => setTaskFor(r) }] : []),
  ];
  const E = COPY.empty['projects.none'];
  const strip = showSkel ? <p className="pj-strip" aria-hidden="true"><SkeletonBlock width={300} height={27} /></p> : (
    <p className="pj-strip" role="status">{summary.open} open, {money(summary.dueWeek)} due this week, {summary.pastDue} past due</p>
  );
  const body = showSkel ? (
    desktop ? <div aria-busy="true"><Table.Skeleton rows={4} cols={5} /></div>
      : <Stack gap={2} aria-busy="true">{[1, 2, 3, 4].map(i => <Card key={i} as="div" padding={3}><Stack gap={2}><Row gap={2} justify="between" align="start"><SkeletonBlock width="55%" height={22} /><SkeletonBlock width={72} height={22} radius="var(--v-radius-pill)" /></Row><SkeletonBlock width="40%" height={18} /><SkeletonBlock width="70%" height={18} /><Row gap={2} align="center"><SkeletonBlock width={110} height={18} /><SkeletonBlock width={56} height={22} radius="var(--v-radius-pill)" /></Row><SkeletonBlock width="45%" height={14} /></Stack></Card>)}</Stack>
  ) : error && !projects.length ? (
    <Card><ErrorState title={COPY.error.projects.title} description={COPY.error.projects.description} onRetry={retry} retrying={retrying} /></Card>
  ) : !shown.length ? (
    <Card><EmptyState icon="Folder" title={E.title} description={E.description} action={{ label: E.action, icon: 'Briefcase01', onClick: () => shell?.go('clients') }} /></Card>
  ) : desktop ? (
    <Table aria-label="Projects" columns={columns} rows={shown} rowKey={(r) => String(r.p._id)} rowId={(r) => r.lead?._id} storageKey="vz_projects_cols" onRowClick={open} rowActions={(r) => <Menu label={`Actions for ${r.lead?.business || 'project'}`} items={rowMenu(r)} />} rowClassName={(r) => (r.overdue ? 'pj-row-overdue' : '')} />
  ) : (
    <Stagger className="pj-stack" cap={6}>
      {shown.map(r => (
        <Card key={r.p._id} as="article" padding={3} interactive className={`pj-card${r.overdue ? ' is-overdue' : ''}`} data-row-id={r.lead?._id}>
          <button type="button" className="v-stretch" onClick={() => open(r)} aria-label={`Open ${r.lead?.business || 'project'}`}>{`Open ${r.lead?.business || 'project'}`}</button>
          <Stack gap={1}>
            <Row gap={2} justify="between" align="start"><span className="pj-client lay-truncate">{r.lead?.business || 'Unknown client'}</span><span className="v-above">{stagePill(r.p)}</span></Row>
            <span className="pj-pkg">{packageOf(r.p.packageId)?.label || r.p.name || ''}{r.p.archived ? ', archived' : ''}</span>
            <span className="pj-line">{actionCell(r)}</span>
            <span className="pj-line">{invoiceCell(r)}</span>
            <span className="pj-muted">{r.touch ? `Last touch ${relativeTime(r.touch)}` : ''}</span>
          </Stack>
        </Card>
      ))}
    </Stagger>
  );
  return (
    <PageShell className="aa-main aa-main--wide pj-shell">
      <ScrollArea wide>
        <Section title="Projects" loading={showSkel} description={showSkel ? undefined : q.trim() ? matchLine(rows.length, 'projects', shown.length) : `${rows.filter(r => !r.p.archived).length} in the list`}
          action={<Row gap={2} wrap><Chip label="Show archived" icon="Trash01" selected={showArchived} onClick={() => setShowArchived(v => !v)} count={showArchived && archived ? archived.length : undefined} />{onNew && <Button icon="Plus" onClick={onNew} className="pj-new">New project</Button>}</Row>} />
        {strip}
        <ListSearch value={q} onChange={setQ} placeholder="Search client, project" label="Search projects" className="pj-search" />
        {body}
      </ScrollArea>
      {taskFor && <TaskSheet business={`${taskFor.lead?.business || 'Project'}, ${taskFor.p.name}`} task={isTask(taskFor.action) && !taskFor.action.doneAt ? taskFor.action : null} onClose={() => setTaskFor(null)} onSave={(na) => onPatch(taskFor.p._id, { nextAction: na })} onDone={isTask(taskFor.action) && !taskFor.action.doneAt ? () => onPatch(taskFor.p._id, { nextAction: { ...taskFor.action, doneAt: new Date().toISOString() } }) : null} />}
      <style>{pjStyles}</style>
    </PageShell>
  );
}

const pjStyles = `
  .pj-shell.aa-main { display: flex; flex-direction: column; }
  .pj-strip { margin: 0 0 var(--v-space-3); font-family: var(--v-font-display); font-size: var(--v-text-lg); font-weight: var(--v-weight-semibold); color: var(--v-text); font-variant-numeric: tabular-nums; }
  .pj-client { font-weight: var(--v-weight-semibold); color: var(--v-text); min-width: 0; }
  .pj-pkg { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .pj-line { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .pj-muted { font-size: var(--v-text-xs); color: var(--v-text-3); }
  .pj-action { color: var(--v-status-progress-text); }
  .pj-action.is-overdue { color: var(--v-status-danger-text); font-weight: var(--v-weight-semibold); }
  .pj-row-overdue .v-td:first-child { box-shadow: inset 3px 0 0 var(--v-status-danger-solid); }
  .pj-stack { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .pj-stack > .v-stagger-item { display: contents; }
  .pj-card { position: relative; }
  .pj-card.is-overdue { border-color: var(--v-status-danger-solid); }
`;
