import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Wordmark from '../components/Wordmark';
import AdminDashboard from './AdminDashboard';
import { uiStyles, ToastProvider, Card, Stack, Input, Button, Reveal, ErrorBoundary } from '../ui';
import { wireClientLog } from '../shared/log';

import AppShell, { shellStyles } from '../shell/AppShell';
import { navForPath, navById, sectionOf } from '../shell/nav';
import '../shell/install';
import BootFrame from '../shell/BootFrame';
import { applyAppearance, setBootHint } from '../shell/appearance';
import { effectiveStage } from '../lib/booked';
import { reviewAsksDue } from '../lib/reviews';
import { IS_ADMIN_HOST } from '../lib/adminPaths';
import { apiFetch } from '../shared/api';

/* Code split by screen (Prompt 15): the entry chunk is the shell plus the
 * Dashboard; every other screen is its own chunk, loaded on first visit.
 * Leads and the Call Console are prefetched after first paint since they are
 * the next taps. The xlsx chunk stays behind its own dynamic import. */
const loaders = {
  leads: () => import('./AdminLeads'), calls: () => import('./AdminCalls'), booked: () => import('./AdminBooked'), clients: () => import('./AdminClients'),
  calendar: () => import('./AdminCalendar'), orders: () => import('./AdminOrders'), concepts: () => import('./AdminConcepts'), reviews: () => import('./AdminReviews'),
  submissions: () => import('./AdminSubmissions'), settings: () => import('./AdminSettings'), design: () => import('./AdminDesign'),
};
const AdminLeads = lazy(loaders.leads);
const AdminCalls = lazy(loaders.calls);
const AdminBooked = lazy(loaders.booked);
const AdminClients = lazy(loaders.clients);
const AdminCalendar = lazy(loaders.calendar);
const AdminOrders = lazy(loaders.orders);
const AdminConcepts = lazy(loaders.concepts);
const AdminReviews = lazy(loaders.reviews);
const AdminSubmissions = lazy(loaders.submissions);
const AdminSettings = lazy(loaders.settings);
const AdminDesign = lazy(loaders.design);

/* ── Config ────────────────────────────────────────────────────── */

const BASE = IS_ADMIN_HOST ? '' : '/admin';

/* ── Login (kit build, Prompt 13) ─────────────────────────────── */

function loginErrorMessage(status) {
  if (status === 401) return 'Wrong password';
  if (status === 429) return 'Too many tries. Wait 15 minutes.';
  if (status === 403) return 'Session check failed. Refresh and try again.';
  if (status >= 500 || status === 0) return 'Server error, check Vercel logs.';
  return `Sign in failed (HTTP ${status}). Check Vercel logs.`;
}

function Login({ onAuthed }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(false);
    try {
      const r = await apiFetch('/api/admin/login', { method: 'POST', body: { password: pw } });
      if (!r.ok) { setErr(loginErrorMessage(r.status)); return; }
      onAuthed();
    } catch { setErr('Server error, check Vercel logs.'); }
    finally { setBusy(false); }
  };
  return (
    <main className="lay-root aa-loginpage" aria-label="Sign in">
      <Reveal as="form" onSubmit={submit} className={`aa-login${err ? ' is-shaking' : ''}`}>
        <Card className="aa-login-card">
          <Stack gap={2} align="center">
            <Wordmark size={22} />
            <h1 className="aa-login-title">Admin</h1>
            <p className="aa-login-sub">Owner access only</p>
          </Stack>
          <Input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(false); }} placeholder="Password" autoFocus autoComplete="current-password" aria-label="Password" error={err || undefined} className="aa-login-input" />
          <Button type="submit" size="lg" full loading={busy} disabled={!pw}>Sign in</Button>
        </Card>
      </Reveal>
      <style>{uiStyles + aaStyles}</style>
    </main>
  );
}

/* ── App shell ─────────────────────────────────────────────────── */

export default function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(null);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  // Per resource load failures (Prompt 14): each screen renders an ErrorState with Retry from these.
  const [errors, setErrors] = useState({});
  const setErr = useCallback((k, v) => setErrors(e => (e[k] === v ? e : { ...e, [k]: v })), []);
  const [bookedOpen, setBookedOpen] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [openReq, setOpenReq] = useState(null);     // { section, id, n } from the command bar / notifications
  const [createReq, setCreateReq] = useState(null); // { section, preset, n } from quick add
  const deepLinked = useRef(false);

  // Call leads, loaded at the shell level so the Booked tab badge is live
  // and the Booked workspace has data. The Call Console keeps its own copy;
  // it pings us (onDataChanged) whenever stages/statuses move.
  const [callLeads, setCallLeads] = useState([]);
  const [callLeadsLoading, setCallLeadsLoading] = useState(true);
  const loadCallLeads = useCallback(async () => {
    const r = await apiFetch('/api/admin/call-leads');
    if (r.ok) { setCallLeads(r.data?.items || []); setErr('leads', false); } else setErr('leads', true);
    setCallLeadsLoading(false);
  }, [setErr]);

  // Optimistic patch for booked-workspace edits, with rollback on failure.
  const patchCallLead = useCallback(async (id, set) => {
    let prev;
    setCallLeads(ls => ls.map(l => { if (l._id === id) { prev = l; return { ...l, ...set }; } return l; }));
    const r = await apiFetch('/api/admin/call-leads', { method: 'PATCH', body: { id, set } });
    if (r.ok) return true;
    if (prev) setCallLeads(ls => ls.map(l => l._id === id ? prev : l));
    return false;
  }, []);

  // Projects (Prompt 10): loaded at the shell level like call leads so the
  // Calendar, the drawer, and the Clients list all read one array.
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const loadProjects = useCallback(async () => {
    const r = await apiFetch('/api/admin/projects');
    if (r.ok) { setProjects(r.data?.items || []); setErr('projects', false); } else setErr('projects', true);
    setProjectsLoading(false);
  }, [setErr]);
  const createProject = useCallback(async (doc) => {
    const r = await apiFetch('/api/admin/projects', { method: 'POST', body: doc });
    if (!r.ok) return null;
    if (r.data?.item) setProjects(ps => [r.data.item, ...ps]);
    return r.data?.item || null;
  }, []);
  const patchProject = useCallback(async (id, set) => {
    let prev;
    setProjects(ps => ps.map(p => { if (String(p._id) === String(id)) { prev = p; return { ...p, ...set }; } return p; }));
    const r = await apiFetch('/api/admin/projects', { method: 'PATCH', body: { id, set } });
    if (r.ok) return true;
    if (prev) setProjects(ps => ps.map(p => String(p._id) === String(id) ? prev : p));
    return false;
  }, []);

  // Print orders and concept packs (Prompt 11), loaded at the shell level like projects.
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [unimported, setUnimported] = useState(0);
  const loadOrders = useCallback(async () => {
    const r = await apiFetch('/api/admin/orders');
    if (r.ok) { setOrders(r.data?.items || []); setUnimported(r.data?.unimported || 0); setErr('orders', false); } else setErr('orders', true);
    setOrdersLoading(false);
  }, [setErr]);
  const createOrder = useCallback(async (doc) => {
    const r = await apiFetch('/api/admin/orders', { method: 'POST', body: doc });
    if (!r.ok) return null;
    if (r.data?.item) setOrders(os => [r.data.item, ...os]);
    return r.data?.item || null;
  }, []);
  const patchOrder = useCallback(async (id, set) => {
    let prev;
    setOrders(os => os.map(o => { if (String(o._id) === String(id)) { prev = o; return { ...o, ...set }; } return o; }));
    const r = await apiFetch('/api/admin/orders', { method: 'PATCH', body: { id, set } });
    if (r.ok) return true;
    if (prev) setOrders(os => os.map(o => String(o._id) === String(id) ? prev : o));
    return false;
  }, []);
  const importSubmissionOrders = useCallback(async () => {
    const r = await apiFetch('/api/admin/orders', { method: 'POST', body: { action: 'import-submissions' } });
    if (!r.ok) return null;
    await loadOrders();
    return r.data?.created || 0;
  }, [loadOrders]);
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const loadPacks = useCallback(async () => {
    const r = await apiFetch('/api/admin/concept-packs');
    if (r.ok) { setPacks(r.data?.items || []); setErr('packs', false); } else setErr('packs', true);
    setPacksLoading(false);
  }, [setErr]);
  const createPack = useCallback(async (doc) => {
    const r = await apiFetch('/api/admin/concept-packs', { method: 'POST', body: doc });
    if (!r.ok) return null;
    if (r.data?.item) setPacks(ps => [r.data.item, ...ps]);
    return r.data?.item || null;
  }, []);
  const patchPack = useCallback(async (id, set) => {
    let prev;
    setPacks(ps => ps.map(x => { if (String(x._id) === String(id)) { prev = x; return { ...x, ...set }; } return x; }));
    const r = await apiFetch('/api/admin/concept-packs', { method: 'PATCH', body: { id, set } });
    if (r.ok) return true;
    if (prev) setPacks(ps => ps.map(x => String(x._id) === String(id) ? prev : x));
    return false;
  }, []);

  const section = useMemo(() => {
    const p = location.pathname.slice(BASE.length) || '/';
    if (p.startsWith('/submissions')) return 'submissions';
    if (p.startsWith('/orders')) return 'orders';
    if (p.startsWith('/calls')) return 'calls';
    if (p.startsWith('/leads')) return 'leads';
    if (p.startsWith('/booked')) return 'booked';
    if (p.startsWith('/calendar')) return 'calendar';
    if (p.startsWith('/clients')) return 'clients';
    if (p.startsWith('/concepts')) return 'concepts';
    if (p.startsWith('/reviews')) return 'reviews';
    if (p.startsWith('/settings')) return 'settings';
    if (p.startsWith('/design')) return 'design';
    return 'dashboard';
  }, [location.pathname]);

  const relPath = location.pathname.slice(BASE.length) || '/';
  const forceLoading = new URLSearchParams(location.search).get('loading') === '1'; // the audits' forced loading state: nothing has loaded yet
  const V = forceLoading ? { leads: [], items: [], projects: [], orders: [], packs: [] } : { leads: callLeads, items, projects, orders, packs };
  const activeNav = useMemo(() => navForPath(relPath), [relPath]);

  const go = useCallback((sec, itemId) => {
    navigate(`${BASE}/${sec === 'dashboard' ? '' : sec}` || '/');
    if (itemId && sec === 'submissions') setOpenReq({ section: 'submissions', id: itemId, n: Date.now() });
  }, [navigate, items]);

  // Shell navigation by nav.js id ('deleted' is a Settings sub-view).
  const [presetReq, setPresetReq] = useState(null); // { section, preset, n } from the dashboard or the shell
  const goNav = useCallback((navId, preset) => {
    const entry = navById(navId);
    if (!entry || entry.soon) return;
    if (entry.id === 'deleted') { navigate(`${BASE}/settings/deleted`); return; }
    const sec = sectionOf(entry);
    go(sec);
    setPresetReq(preset ? { section: sec, preset, n: Date.now() } : null);
  }, [go, navigate]);
  // Open a lead in whichever screen owns its stage.
  const openLead = useCallback((lead) => {
    const stage = effectiveStage(lead);
    const sec = stage === 'booked' ? 'booked' : (stage === 'won' || stage === 'client') ? 'clients' : 'leads';
    go(sec);
    setOpenReq({ section: sec, id: lead._id, n: Date.now() });
  }, [go]);
  const newLead = useCallback((preset) => { go('leads'); setCreateReq({ section: 'leads', preset: preset || {}, n: Date.now() }); }, [go]);
  const newClient = useCallback(() => { go('clients'); setCreateReq({ section: 'clients', preset: {}, n: Date.now() }); }, [go]);
  const newOrder = useCallback((preset) => { go('orders'); setCreateReq({ section: 'orders', preset: preset || {}, n: Date.now() }); }, [go]);
  const openOrder = useCallback((order) => { go('orders'); setOpenReq({ section: 'orders', id: order._id, n: Date.now() }); }, [go]);

  useEffect(() => {
    applyAppearance();
    wireClientLog();
    apiFetch('/api/admin/session', { silent: true })
      .then(r => { const on = !!(r.ok && r.data?.authed); setAuthed(on); setBootHint(on); });
  }, []);
  // Prefetch the next taps once the shell has painted (Prompt 15).
  useEffect(() => {
    if (!authed) return undefined;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const id = idle(() => { loaders.leads(); loaders.calls(); });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, [authed]);
  // ?open=<id> deep links a record on the current screen (push links and the feel audit use it).
  useEffect(() => {
    if (!authed) return;
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setOpenReq({ section, id, n: Date.now() });
  }, [authed]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const r = await apiFetch('/api/admin/submissions');
    if (r.status === 401) { setAuthed(false); setBootHint(false); return; }
    if (r.ok) { setItems(r.data?.items || []); setUnread(r.data?.unread || 0); setErr('submissions', false); } else setErr('submissions', true);
    setLoading(false);
  }, [setErr]);
  useEffect(() => { if (authed) load(); }, [authed, load]);
  useEffect(() => { if (authed) loadCallLeads(); }, [authed, loadCallLeads]);
  useEffect(() => { if (authed) loadProjects(); }, [authed, loadProjects]);
  useEffect(() => { if (authed) { loadOrders(); loadPacks(); } }, [authed, loadOrders, loadPacks]);

  const stageCounts = useMemo(() => {
    const c = { lead: 0, booked: 0, won: 0, client: 0, toCall: 0 };
    for (const l of callLeads) {
      const s = effectiveStage(l);
      if (s in c) c[s]++;
      if (s === 'lead' && l.callStatus === 'not-called') c.toCall++;
    }
    return c;
  }, [callLeads]);
  const bookedCount = stageCounts.booked;
  // Callbacks due: every open callback (the console stores no due date, so an
  // unfinished callback is due). Feeds the Call tab badge.
  const callbacksDue = useMemo(() => callLeads.filter(l => l.callStatus === 'callback' && effectiveStage(l) !== 'lost').length, [callLeads]);
  const calendarToday = useMemo(() => { const today = new Date(); const same = (d) => d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate(); return callLeads.filter(l => { const st = effectiveStage(l); if (st === 'lost') return false; if (l.callStatus === 'callback' && (!l.callbackAt || same(new Date(l.callbackAt)) || new Date(l.callbackAt) < today)) return true; if ((st === 'booked' || st === 'won' || st === 'client') && l.meeting?.date) return same(new Date(`${l.meeting.date}T${l.meeting.time || '09:00'}`)); return false; }).length; }, [callLeads]);

  // Lead create/delete for the Leads page (reuses the guarded endpoints).
  const createCallLead = useCallback(async (lead) => {
    const r = await apiFetch('/api/admin/call-leads', { method: 'POST', body: lead });
    if (r.ok) await loadCallLeads();
    return r.ok;
  }, [loadCallLeads]);
  // Optimistic delete with rollback; resolves false (and puts the lead back) on failure.
  const deleteCallLead = useCallback(async (id) => {
    let prev;
    setCallLeads(cur => cur.filter(l => { if (l._id === id) { prev = l; return false; } return true; }));
    const r = await apiFetch(`/api/admin/call-leads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (r.ok) return true;
    if (prev) setCallLeads(cur => [...cur, prev]);
    return false;
  }, []);
  const restoreCallLeads = useCallback(async (ids) => {
    const r = await apiFetch('/api/admin/call-leads', { method: 'PATCH', body: { action: 'restore', ids } });
    if (r.ok) await loadCallLeads();
    return r.ok;
  }, [loadCallLeads]);
  const bulkDeleteCallLeads = useCallback(async (ids) => {
    const idSet = new Set(ids);
    const prev = [];
    setCallLeads(cur => cur.filter(l => { if (idSet.has(l._id)) { prev.push(l); return false; } return true; }));
    const r = await apiFetch(`/api/admin/call-leads?ids=${ids.map(encodeURIComponent).join(',')}`, { method: 'DELETE' });
    if (r.ok) return true;
    setCallLeads(cur => [...cur, ...prev]);
    return false;
  }, []);

  // Shop orders live in the orders collection (Prompt 11); the Dashboard feed reads briefs and contacts only.
  const subs = useMemo(() => items.filter(it => it.type !== 'shop-order' && it.type !== 'review'), [items]);
  const unreadSubs = items.filter(s => !s.read && !s.deleted).length;
  const newOrders = useMemo(() => orders.filter(o => o.status === 'new' && !o.archived).length, [orders]);
  const reviewsDue = useMemo(() => reviewAsksDue(callLeads, projects), [callLeads, projects]);

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Visualize Admin` : 'Visualize Admin';
  }, [unread]);

  // Push-notification deep link: ?submission=<id>
  useEffect(() => {
    if (!authed || deepLinked.current) return;
    const id = new URLSearchParams(window.location.search).get('submission');
    if (!id) return;
    deepLinked.current = true;
    apiFetch(`/api/admin/submissions?id=${encodeURIComponent(id)}`)
      .then(r => {
        const d = r.data || {};
        if (!d.submission) return;
        if (d.submission.type === 'shop-order') { navigate(`${BASE}/orders`); setOpenReq({ section: 'orders', submissionId: String(d.submission._id), n: Date.now() }); }
        else if (d.submission.type === 'review') navigate(`${BASE}/reviews`);
        else { navigate(`${BASE}/submissions`); setOpenReq({ section: 'submissions', id: String(d.submission._id), n: Date.now() }); }
      })
      .catch(() => {});
  }, [authed, navigate]);

  // Optimistic patch with rollback.
  const patch = async (id, set) => {
    const prev = items;
    setItems(cur => cur.map(it => it._id === id ? { ...it, ...set } : it));
    if ('read' in set) setUnread(u => Math.max(0, u + (set.read ? -1 : 1)));
    const r = await apiFetch('/api/admin/submissions', { method: 'PATCH', body: { id, set } });
    if (r.ok) return true;
    setItems(prev); if ('read' in set) setUnread(u => Math.max(0, u + (set.read ? 1 : -1)));
    return false;
  };

  // Optimistic soft delete with rollback; resolves false on failure.
  const softDelete = async (ids) => {
    const prev = items;
    const idSet = new Set(ids);
    setItems(cur => cur.filter(it => !idSet.has(it._id)));
    const r = await apiFetch(`/api/admin/submissions?ids=${ids.join(',')}`, { method: 'DELETE' });
    if (r.ok) return true;
    setItems(prev);
    return false;
  };

  const logout = async () => {
    await apiFetch('/api/admin/logout', { method: 'POST' });
    setBootHint(false);
    setAuthed(false);
  };

  // While the session check is in flight the parser's boot frame stays up (index.html) and React renders the same frame over it.
  if (authed === null) return <BootFrame />;
  if (!authed) return <Login onAuthed={() => { setBootHint(true); setAuthed(true); }} />;

  const hasDetail = (section === 'booked' && bookedOpen) || (section === 'leads' && leadsOpen) || (section === 'clients' && clientsOpen);
  const linkSubmission = (subId, leadId) => patch(subId, { linkedLeadId: leadId });
  const counts = { leads: stageCounts.toCall, booked: bookedCount, calls: callbacksDue, orders: newOrders, submissions: unreadSubs, calendar: calendarToday, reviews: reviewsDue };
  const reqFor = (sec) => (openReq?.section === sec ? openReq : null);
  const createFor = (sec) => (createReq?.section === sec ? createReq : null);
  const presetFor = (sec) => (presetReq?.section === sec ? presetReq : null);

  return (
    <ToastProvider>
    <AppShell activeNavId={activeNav.id} counts={counts} countsLoading={callLeadsLoading || forceLoading} leads={V.leads} leadsLoading={callLeadsLoading || forceLoading} onRefetchLeads={loadCallLeads}
      leadsError={errors.leads} onRetryLeads={loadCallLeads} hasDetail={!!hasDetail} onGo={goNav} onOpenLead={openLead} onNewLead={newLead} onNewClient={newClient} onNewOrder={newOrder} onLogout={logout} onPatchLead={patchCallLead} projects={projects} packs={packs} styles={uiStyles + shellStyles + aaStyles}>
      {/* Section content: one boundary and one Suspense per screen, keyed so a new screen starts clean. */}
      <ErrorBoundary key={section} label={`the ${activeNav.label} screen`} reload>
      <Suspense fallback={null}>
      {section === 'dashboard' && (
        <AdminDashboard leads={V.leads} projects={V.projects} loading={callLeadsLoading || forceLoading} error={errors.leads} onRetry={loadCallLeads} subs={subs} orders={orders} onOpenSubmission={(it) => go('submissions', it._id)} onOpenOrder={openOrder} />
      )}
      {section === 'leads' && (
        <AdminLeads
          leads={V.leads} submissions={V.items} loading={callLeadsLoading || forceLoading} error={errors.leads} onRetry={loadCallLeads}
          onPatch={patchCallLead} onCreate={createCallLead} onDelete={deleteCallLead}
          onBulkDelete={bulkDeleteCallLeads} onRestore={restoreCallLeads}
          onRefresh={loadCallLeads} onLinkSubmission={linkSubmission}
          onMobileOpen={() => setLeadsOpen(true)} onMobileClose={() => setLeadsOpen(false)} onGo={go}
          openId={reqFor('leads')} createPreset={createFor('leads')} filterPreset={presetFor('leads')}
        />
      )}
      {section === 'clients' && (
        <AdminClients
          leads={V.leads} submissions={V.items} loading={callLeadsLoading || projectsLoading || forceLoading} error={errors.leads || errors.projects} onRetry={async () => { await Promise.all([loadCallLeads(), loadProjects()]); }}
          projects={V.projects} onCreateProject={createProject} onPatchProject={patchProject} onRefreshProjects={loadProjects}
          onPatch={patchCallLead} onCreate={createCallLead} onDelete={deleteCallLead}
          onRefresh={loadCallLeads} onLinkSubmission={linkSubmission}
          onMobileOpen={() => setClientsOpen(true)} onMobileClose={() => setClientsOpen(false)} onGo={go}
          openId={reqFor('clients')} createPreset={createFor('clients')}
        />
      )}
      {section === 'submissions' && (
        <AdminSubmissions items={V.items} loading={loading || forceLoading} error={errors.submissions} onRetry={load} leads={V.leads} onPatch={patch} onDelete={softDelete} onLinkLead={linkSubmission} onPatchLead={patchCallLead} onCreateLead={createCallLead} onRefresh={load} openId={reqFor('submissions')} />
      )}
      {section === 'orders' && (
        <AdminOrders orders={V.orders} loading={ordersLoading || callLeadsLoading || forceLoading} error={errors.orders} onRetry={loadOrders} unimported={unimported} leads={V.leads} projects={V.projects}
          onCreate={createOrder} onPatch={patchOrder} onRefresh={loadOrders} onImportSubmissions={importSubmissionOrders} onPatchLead={patchCallLead} onCreateProject={createProject}
          openId={reqFor('orders')} createPreset={createFor('orders')} />
      )}
      {section === 'concepts' && (
        <AdminConcepts packs={V.packs} loading={packsLoading || callLeadsLoading || forceLoading} error={errors.packs} onRetry={loadPacks} leads={V.leads} onCreate={createPack} onPatch={patchPack} onPatchLead={patchCallLead} onRefresh={loadPacks} openId={reqFor('concepts')} />
      )}
      {section === 'reviews' && (
        <AdminReviews leads={V.leads} projects={V.projects} submissions={V.items} loading={callLeadsLoading || projectsLoading || forceLoading} error={errors.leads || errors.projects} onRetry={async () => { await Promise.all([loadCallLeads(), loadProjects()]); }} onPatch={patchCallLead} onPatchSubmission={patch} openId={reqFor('reviews')} />
      )}
      {section === 'calls' && (
        <div className="aa-embed"><AdminCalls embedded onDataChanged={loadCallLeads} builderPreset={presetFor('calls')} forceLoading={forceLoading} /></div>
      )}
      {section === 'booked' && (
        <AdminBooked
          leads={V.leads}
          submissions={V.items}
          loading={callLeadsLoading || forceLoading}
          error={errors.leads} onRetry={loadCallLeads}
          onPatch={patchCallLead}
          onRefresh={loadCallLeads}
          onLinkSubmission={linkSubmission}
          onMobileOpen={() => setBookedOpen(true)}
          onMobileClose={() => setBookedOpen(false)}
          onGo={go}
          openId={reqFor('booked')}
        />
      )}
      {section === 'calendar' && (
        <AdminCalendar leads={V.leads} loading={callLeadsLoading || forceLoading} error={errors.leads} onRetry={loadCallLeads} onPatch={patchCallLead} onCreate={createCallLead} onRefresh={loadCallLeads} openId={reqFor('calendar')} />
      )}
      {section === 'design' && (
        <AdminDesign onBack={() => go('settings')} loading={forceLoading} />
      )}
      {section === 'settings' && (
        <AdminSettings leads={callLeads} projects={projects} orders={orders} submissions={items} initialTab={relPath.startsWith('/settings/deleted') ? 'data' : undefined} onCreateOrder={createOrder} onLeadsImported={loadCallLeads} onDataChanged={load} onRestoreLeads={loadCallLeads} onLogout={logout} loading={forceLoading} />
      )}
      </Suspense>
      </ErrorBoundary>
    </AppShell>
    </ToastProvider>
  );
}

/* ── Styles ────────────────────────────────────────────────────── */
const aaStyles = `
  /* .aa-app is the content row inside the shell (src/shell/AppShell.jsx);
     the shell owns height, background, font, and safe areas. What is left
     after Prompt 13: the content row, the list panel and main split the
     Leads, Booked, and Clients screens use, the embedded console, and the
     login page. Every rule reads tokens. */
  .aa-app { flex: 1; min-height: 0; min-width: 0; display: flex; }

  /* ── Login ── */
  .aa-loginpage { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: var(--v-ground); background-image: var(--v-grid-texture); background-size: var(--v-grid-texture-size); color: var(--v-text); font-family: var(--v-font-body); padding: var(--v-space-4); }
  .aa-login { width: min(360px, 100%); }
  .aa-login-card { gap: var(--v-space-4); padding: var(--v-space-6) var(--v-space-5); box-shadow: var(--v-shadow-3); }
  .aa-login-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); }
  .aa-login-sub { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-3); }
  .aa-login-input .v-field-control { text-align: center; }
  @keyframes aaShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-7px)} 40%,80%{transform:translateX(7px)} }
  .aa-login.is-shaking { animation: aaShake var(--v-dur-slow) var(--v-ease-out); }
  @media (prefers-reduced-motion: reduce) { .aa-login.is-shaking { animation: none; } }
  [data-v-motion='reduce'] .aa-login.is-shaking { animation: none; }

  /* ── Contextual panel (Leads, Booked, Clients list beside a detail) ── */
  .aa-panel {
    width: var(--lay-panel-w); flex-shrink: 0; display: flex; flex-direction: column;
    background: var(--v-bar); border-right: 1px solid var(--v-border); min-height: 0; min-width: 0;
    padding: 16px 12px 12px; gap: 12px; position: relative;
  }

  /* ── Embedded call console ── */
  .aa-embed { flex: 1; min-width: 0; display: flex; }
  .aa-embed .cc-page { height: 100%; flex: 1; }

  /* ── Mobile: panel-first, full-screen detail (the shell supplies the tab bar) ── */
  @media (max-width: 767px) {
    .aa-app { flex-direction: column; }
    .aa-panel { width: 100%; flex: 1; border-right: none; }
    .aa-main { display: none; }
    .aa-main--wide { display: block; flex: 1; }
    .aa-app.has-detail .aa-panel { display: none; }
    .aa-app.has-detail .aa-main { display: block; flex: 1; }
    .aa-embed { flex: 1; min-height: 0; }
  }
`;
