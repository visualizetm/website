import { useMemo } from 'react';
import {
  PageShell, ScrollArea, Stack, Card, Button, StatCard, EmptyState, ErrorState, Stagger, useDelayedLoading, useRetry,
} from '../ui';
import { COPY } from '../shared/copy';
import { useShell, useTopBar } from '../shell/ShellContext';
import { fmtDate, fmtWeekdayDateTime, relativeTime } from '../shared/dates';
import { money, isClientLead, isActiveProject, isOnRetainer } from '../lib/projects';
import { invoicesOf, invoiceStatus } from '../lib/invoices';
import { nextUpItems } from '../lib/nextAction';
import { livePosts, postsInReview, monthOf, isDone } from '../lib/posts';
import { Dash, DashSkeleton, dashStyles } from './AdminPipeline';

/* The Clients dashboard (the nav revamp, milestone 5): the Clients
 * workspace's home. Active clients, projects in progress, retainers and
 * their monthly total, unpaid invoices, tasks due across clients, the
 * planner's state and the latest activity, on the same card grid as the
 * Pipeline dashboard. Every number is the selector its screen uses
 * (isClientLead, isActiveProject, isOnRetainer, invoicesOf and
 * invoiceStatus, nextUpItems, livePosts), never a second count. */


export default function AdminOverview({ leads = [], projects = [], posts = [], sets = [], loading = false, error = false, onRetry }) {
  const shell = useShell();
  const [retry, retrying] = useRetry(onRetry);
  const showSkel = useDelayedLoading(loading);
  useTopBar(null);
  const now = Date.now();

  const clients = useMemo(() => leads.filter(l => !l.deleted && isClientLead(l)), [leads]);
  const clientIds = useMemo(() => new Set(clients.map(l => String(l._id))), [clients]);
  const active = useMemo(() => projects.filter(p => isActiveProject(p) && clientIds.has(String(p.leadId))), [projects, clientIds]);
  const retainers = useMemo(() => clients.filter(isOnRetainer), [clients]);
  const mrr = useMemo(() => retainers.reduce((n, l) => n + (Number(l.retainer?.amount) || 0), 0), [retainers]);
  const unpaid = useMemo(() => {
    const out = [];
    for (const p of projects) { if (p.archived || !clientIds.has(String(p.leadId))) continue; for (const inv of invoicesOf(p)) { const st = invoiceStatus(inv, now); if (st !== 'paid' && st !== 'draft') out.push({ inv, st, name: p.name || 'Project', leadId: p.leadId }); } }
    for (const l of clients) for (const inv of invoicesOf(l.deal)) { const st = invoiceStatus(inv, now); if (st !== 'paid' && st !== 'draft') out.push({ inv, st, name: 'Deal', leadId: l._id }); }
    return out.sort((a, b) => String(a.inv.dueAt || '').localeCompare(String(b.inv.dueAt || '')));
  }, [projects, clients, clientIds, now]);
  const owed = unpaid.reduce((n, u) => n + (Number(u.inv.amount) || 0), 0);
  const pastDue = unpaid.filter(u => u.st === 'past-due').length;
  const tasks = useMemo(() => { const q = nextUpItems(clients, projects.filter(p => clientIds.has(String(p.leadId))), sets, now); return { overdue: q.overdue, today: q.today, later: q.later, rows: [...q.overdue, ...q.today, ...q.later].slice(0, 5) }; }, [clients, projects, clientIds, sets, now]);
  const planner = useMemo(() => {
    const live = livePosts(posts).filter(p => clientIds.has(String(p.leadId)));
    const month = monthOf(new Date(now).toISOString());
    const mine = live.filter(p => p.month === month);
    return { review: postsInReview(live), planned: mine.length, done: mine.filter(isDone).length, making: mine.filter(p => p.status === 'making').length };
  }, [posts, clientIds, now]);
  const activity = useMemo(() => {
    const byId = new Map(clients.map(l => [String(l._id), l]));
    const out = [];
    const add = (at, text, lead) => { const t = Date.parse(at || '') || 0; if (t && t <= now && lead) out.push({ at: t, text, lead }); };
    for (const l of clients) {
      add(l.clientSince, 'became a client', l);
      for (const pu of l.purchases || []) add(pu.at, `paid ${money(pu.amount)}${pu.label ? `, ${pu.label}` : ''}`, l);
      for (const c of l.checklists || []) for (const it of c.items || []) add(it.doneAt, `finished ${it.text || 'a task'}`, l);
    }
    for (const p of projects) { const lead = byId.get(String(p.leadId)); if (!lead) continue; for (const c of p.checklists || []) for (const it of c.items || []) add(it.doneAt, `finished ${it.text || 'a task'}`, lead); }
    for (const p of livePosts(posts)) { const lead = byId.get(String(p.leadId)); add(p.approvedAt, `approved ${p.title || 'a post'}`, lead); }
    return out.sort((a, b) => b.at - a.at).slice(0, 5);
  }, [clients, projects, posts, now]);

  const open = (l) => shell.openRecord(l);
  const openById = (id) => { const l = leads.find(x => String(x._id) === String(id)); if (l) open(l); };

  const body = showSkel ? <DashSkeleton cards={5} stats={6} /> : error && !leads.length ? (
    <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>
  ) : (
    <Stagger className="dash-grid" cap={6}>
      <div className="dash-stats dash-card--wide" data-card="stats">
        <StatCard icon="Briefcase01" tone="booked" value={clients.length} label={clients.length === 1 ? 'active client' : 'active clients'} onClick={() => shell.go('clients')} data-stat="clients" />
        <StatCard icon="Package" tone="progress" value={active.length} label={active.length === 1 ? 'project in progress' : 'projects in progress'} onClick={() => shell.go('projects')} data-stat="projects" />
        <StatCard icon="RefreshCw01" tone="new" value={retainers.length} label={`${retainers.length === 1 ? 'retainer' : 'retainers'}, ${money(mrr)} a month`} onClick={() => shell.go('clients')} data-stat="retainers" />
        <StatCard icon="CurrencyDollarCircle" tone={pastDue ? 'danger' : 'neutral'} value={money(owed)} label={`unpaid, ${unpaid.length} ${unpaid.length === 1 ? 'invoice' : 'invoices'}${pastDue ? `, ${pastDue} past due` : ''}`} onClick={() => shell.go('projects')} data-stat="unpaid" />
        <StatCard icon="CheckDone01" tone={tasks.overdue.length ? 'danger' : 'neutral'} value={tasks.overdue.length + tasks.today.length} label={`${tasks.overdue.length + tasks.today.length === 1 ? 'task' : 'tasks'} due today${tasks.overdue.length ? `, ${tasks.overdue.length} overdue` : ''}`} onClick={() => shell.openTasks ? shell.go('tasks') : shell.go('dashboard')} data-stat="tasks" />
        <StatCard icon="Pencil01" tone={planner.review ? 'new' : 'neutral'} value={planner.review} label={`${planner.review === 1 ? 'post' : 'posts'} with clients, ${planner.done} of ${planner.planned} done this month`} onClick={() => shell.go('calendar')} data-stat="planner" />
      </div>

      <Dash title="Tasks due across clients" data-card="tasks">
        {!tasks.rows.length ? <EmptyState size="sm" icon="CheckDone01" title="Nothing due this week" description="Open tasks with a due date show here." /> : (
          <Stack gap={1} className="dash-rows">
            {tasks.rows.map(it => (
              <div key={it.id} className="dash-row">
                <button type="button" className="dash-row-main" onClick={() => open(it.lead)}>
                  <span className="dash-row-title lay-truncate">{it.action?.label || it.action?.text || 'Task'}</span>
                  <span className={`dash-row-sub${it.bucket === 'overdue' ? ' dash-row-sub--danger' : ''}`}>{it.lead?.business}{it.action?.dueAt ? `, ${it.bucket === 'overdue' ? 'overdue ' : ''}${fmtDate(it.action.dueAt)}` : ''}</span>
                </button>
              </div>
            ))}
          </Stack>
        )}
      </Dash>

      <Dash title={`Unpaid invoices, ${unpaid.length}`} data-card="invoices">
        {!unpaid.length ? <EmptyState size="sm" icon="CurrencyDollarCircle" title="Nothing outstanding" description="Sent invoices show here until they are marked paid." /> : (
          <Stack gap={1} className="dash-rows">
            {unpaid.slice(0, 5).map((u, i) => (
              <div key={u.inv.id || i} className="dash-row">
                <button type="button" className="dash-row-main" onClick={() => openById(u.leadId)}>
                  <span className="dash-row-title lay-truncate">{money(u.inv.amount)}, {u.name}</span>
                  <span className={`dash-row-sub${u.st === 'past-due' ? ' dash-row-sub--danger' : ''}`}>{u.st === 'past-due' ? 'Past due' : u.st === 'due' ? 'Due' : 'Sent'}{u.inv.dueAt ? `, ${fmtDate(u.inv.dueAt)}` : ''}</span>
                </button>
              </div>
            ))}
          </Stack>
        )}
      </Dash>

      <Dash title="Projects in progress" data-card="projects" action={<Button variant="ghost" size="md" icon="ArrowRight" onClick={() => shell.go('projects')}>Projects</Button>}>
        {!active.length ? <EmptyState size="sm" icon="Package" title="No project in progress" description="A project opens from a client's record." /> : (
          <Stack gap={1} className="dash-rows">
            {active.slice(0, 5).map(p => (
              <div key={p._id} className="dash-row">
                <button type="button" className="dash-row-main" onClick={() => openById(p.leadId)}>
                  <span className="dash-row-title lay-truncate">{p.name || 'Project'}</span>
                  <span className="dash-row-sub lay-truncate">{leads.find(l => String(l._id) === String(p.leadId))?.business}{p.stage ? `, ${p.stage}` : ''}</span>
                </button>
              </div>
            ))}
          </Stack>
        )}
      </Dash>

      <Dash title="Retainers" data-card="retainers">
        {!retainers.length ? <EmptyState size="sm" icon="RefreshCw01" title="No retainer running" description="A client on a monthly plan shows here with the total." /> : (
          <Stack gap={1} className="dash-rows">
            {retainers.slice(0, 5).map(l => (
              <div key={l._id} className="dash-row">
                <button type="button" className="dash-row-main" onClick={() => open(l)}>
                  <span className="dash-row-title lay-truncate">{l.business}</span>
                  <span className="dash-row-sub">{money(l.retainer?.amount)} a month{l.retainer?.status === 'ending' ? ', ending' : ''}</span>
                </button>
              </div>
            ))}
          </Stack>
        )}
      </Dash>

      <Dash title="Recent activity" data-card="activity" className="dash-activity">
        {!activity.length ? <EmptyState size="sm" icon="ClockRewind" title="Nothing yet" description="Payments, finished tasks and approvals show here as they happen." /> : (
          <Stack gap={1} className="dash-rows">
            {activity.map((a, i) => (
              <div key={i} className="dash-row">
                <button type="button" className="dash-row-main" onClick={() => open(a.lead)}>
                  <span className="dash-row-title lay-truncate">{a.lead.business} {a.text}</span>
                  <span className="dash-row-sub">{relativeTime(a.at, now)}, {fmtWeekdayDateTime(a.at)}</span>
                </button>
              </div>
            ))}
          </Stack>
        )}
      </Dash>
    </Stagger>
  );

  return (
    <PageShell className="aa-main aa-main--wide dash-shell">
      <ScrollArea wide className="dash-page">{body}</ScrollArea>
      <style>{dashStyles}</style>
    </PageShell>
  );
}
