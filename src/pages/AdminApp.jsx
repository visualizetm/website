import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Wordmark from '../components/Wordmark';
import AdminCalls from './AdminCalls';
import AdminBooked from './AdminBooked';
import AdminLeads from './AdminLeads';
import AdminClients from './AdminClients';
import AdminDesign from './AdminDesign';
import AdminDashboard from './AdminDashboard';
import AdminCalendar from './AdminCalendar';
import AdminOrders from './AdminOrders';
import AdminConcepts from './AdminConcepts';
import AdminReviews from './AdminReviews';
import AdminSettings from './AdminSettings';
import AdminSubmissions from './AdminSubmissions';
import { uiStyles, ToastProvider, Card, Stack, Input, Button, Reveal } from '../ui';
import AppShell, { shellStyles } from '../shell/AppShell';
import { navForPath, navById, sectionOf } from '../shell/nav';
import '../shell/install';
import BootFrame from '../shell/BootFrame';
import { applyAppearance, setBootHint } from '../shell/appearance';
import { effectiveStage } from '../lib/booked';
import { reviewAsksDue } from '../lib/reviews';
import { IS_ADMIN_HOST } from '../lib/adminPaths';

/* ── Config ────────────────────────────────────────────────────── */

const BASE = IS_ADMIN_HOST ? '' : '/admin';

/* ── Login (kit build, Prompt 13) ─────────────────────────────── */

function Login({ onAuthed }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(false);
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      if (!res.ok) throw new Error();
      onAuthed();
    } catch { setErr(true); }
    finally { setBusy(false); }
  };
  return (
    <div className="lay-root aa-loginpage">
      <Reveal as="form" onSubmit={submit} className={`aa-login${err ? ' is-shaking' : ''}`}>
        <Card className="aa-login-card">
          <Stack gap={2} align="center">
            <Wordmark size={22} />
            <h1 className="aa-login-title">Admin</h1>
            <p className="aa-login-sub">Owner access only</p>
          </Stack>
          <Input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(false); }} placeholder="Password" autoFocus autoComplete="current-password" aria-label="Password" error={err ? 'Incorrect password' : undefined} className="aa-login-input" />
          <Button type="submit" size="lg" full loading={busy} disabled={!pw}>Sign in</Button>
        </Card>
      </Reveal>
      <style>{uiStyles + aaStyles}</style>
    </div>
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
    try {
      const res = await fetch('/api/admin/call-leads');
      if (!res.ok) return;
      const d = await res.json();
      setCallLeads(d.items || []);
    } catch { /* keep last */ }
    finally { setCallLeadsLoading(false); }
  }, []);

  // Optimistic patch for booked-workspace edits, with rollback on failure.
  const patchCallLead = useCallback(async (id, set) => {
    let prev;
    setCallLeads(ls => ls.map(l => { if (l._id === id) { prev = l; return { ...l, ...set }; } return l; }));
    try {
      const res = await fetch('/api/admin/call-leads', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, set }),
      });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      if (prev) setCallLeads(ls => ls.map(l => l._id === id ? prev : l));
      return false;
    }
  }, []);

  // Projects (Prompt 10): loaded at the shell level like call leads so the
  // Calendar, the drawer, and the Clients list all read one array.
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/projects');
      if (!res.ok) return;
      const d = await res.json();
      setProjects(d.items || []);
    } catch { /* keep last */ }
    finally { setProjectsLoading(false); }
  }, []);
  const createProject = useCallback(async (doc) => {
    const res = await fetch('/api/admin/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.item) setProjects(ps => [d.item, ...ps]);
    return d.item || null;
  }, []);
  const patchProject = useCallback(async (id, set) => {
    let prev;
    setProjects(ps => ps.map(p => { if (String(p._id) === String(id)) { prev = p; return { ...p, ...set }; } return p; }));
    try {
      const res = await fetch('/api/admin/projects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, set }) });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      if (prev) setProjects(ps => ps.map(p => String(p._id) === String(id) ? prev : p));
      return false;
    }
  }, []);

  // Print orders and concept packs (Prompt 11), loaded at the shell level like projects.
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [unimported, setUnimported] = useState(0);
  const loadOrders = useCallback(async () => {
    try { const res = await fetch('/api/admin/orders'); if (!res.ok) return; const d = await res.json(); setOrders(d.items || []); setUnimported(d.unimported || 0); } catch { /* keep last */ }
    finally { setOrdersLoading(false); }
  }, []);
  const createOrder = useCallback(async (doc) => {
    const res = await fetch('/api/admin/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.item) setOrders(os => [d.item, ...os]);
    return d.item || null;
  }, []);
  const patchOrder = useCallback(async (id, set) => {
    let prev;
    setOrders(os => os.map(o => { if (String(o._id) === String(id)) { prev = o; return { ...o, ...set }; } return o; }));
    try { const res = await fetch('/api/admin/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, set }) }); if (!res.ok) throw new Error(); return true; }
    catch { if (prev) setOrders(os => os.map(o => String(o._id) === String(id) ? prev : o)); return false; }
  }, []);
  const importSubmissionOrders = useCallback(async () => {
    const res = await fetch('/api/admin/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'import-submissions' }) });
    if (!res.ok) return null;
    const d = await res.json();
    await loadOrders();
    return d.created || 0;
  }, [loadOrders]);
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const loadPacks = useCallback(async () => {
    try { const res = await fetch('/api/admin/concept-packs'); if (!res.ok) return; const d = await res.json(); setPacks(d.items || []); } catch { /* keep last */ }
    finally { setPacksLoading(false); }
  }, []);
  const createPack = useCallback(async (doc) => {
    const res = await fetch('/api/admin/concept-packs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.item) setPacks(ps => [d.item, ...ps]);
    return d.item || null;
  }, []);
  const patchPack = useCallback(async (id, set) => {
    let prev;
    setPacks(ps => ps.map(x => { if (String(x._id) === String(id)) { prev = x; return { ...x, ...set }; } return x; }));
    try { const res = await fetch('/api/admin/concept-packs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, set }) }); if (!res.ok) throw new Error(); return true; }
    catch { if (prev) setPacks(ps => ps.map(x => String(x._id) === String(id) ? prev : x)); return false; }
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
  const forceLoading = new URLSearchParams(location.search).get('loading') === '1'; // layout audit: skeleton state
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
    fetch('/api/admin/session').then(r => r.json())
      .then(d => { setAuthed(!!d.authed); setBootHint(!!d.authed); })
      .catch(() => setAuthed(false));
  }, []);
  // ?open=<id> deep links a record on the current screen (push links and the feel audit use it).
  useEffect(() => {
    if (!authed) return;
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setOpenReq({ section, id, n: Date.now() });
  }, [authed]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/submissions');
      if (res.status === 401) { setAuthed(false); setBootHint(false); return; }
      const d = await res.json();
      setItems(d.items || []);
      setUnread(d.unread || 0);
    } catch { /* keep last */ }
    finally { setLoading(false); }
  }, []);
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
    const res = await fetch('/api/admin/call-leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    if (res.ok) await loadCallLeads();
    return res.ok;
  }, [loadCallLeads]);
  const deleteCallLead = useCallback(async (id) => {
    await fetch(`/api/admin/call-leads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setCallLeads(prev => prev.filter(l => l._id !== id));
  }, []);
  const restoreCallLeads = useCallback(async (ids) => {
    const res = await fetch('/api/admin/call-leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore', ids }) });
    if (res.ok) await loadCallLeads();
    return res.ok;
  }, [loadCallLeads]);
  const bulkDeleteCallLeads = useCallback(async (ids) => {
    const idSet = new Set(ids);
    const prev = [];
    setCallLeads(cur => cur.filter(l => { if (idSet.has(l._id)) { prev.push(l); return false; } return true; }));
    try {
      const res = await fetch(`/api/admin/call-leads?ids=${ids.map(encodeURIComponent).join(',')}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      setCallLeads(cur => [...cur, ...prev]);
      return false;
    }
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
    fetch(`/api/admin/submissions?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => {
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
    try {
      const res = await fetch('/api/admin/submissions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, set }),
      });
      if (!res.ok) throw new Error();
      return true;
    } catch { setItems(prev); load(); return false; }
  };

  // Optimistic soft delete with rollback.
  const softDelete = async (ids) => {
    const prev = items;
    const idSet = new Set(ids);
    setItems(cur => cur.filter(it => !idSet.has(it._id)));
    try {
      const res = await fetch(`/api/admin/submissions?ids=${ids.join(',')}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch { setItems(prev); }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
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
    <AppShell activeNavId={activeNav.id} counts={counts} countsLoading={callLeadsLoading} leads={callLeads} leadsLoading={callLeadsLoading} onRefetchLeads={loadCallLeads}
      hasDetail={!!hasDetail} onGo={goNav} onOpenLead={openLead} onNewLead={newLead} onNewClient={newClient} onNewOrder={newOrder} onLogout={logout} onPatchLead={patchCallLead} projects={projects} packs={packs} styles={uiStyles + shellStyles + aaStyles}>
      {/* Section content */}
      {section === 'dashboard' && (
        <AdminDashboard leads={callLeads} projects={projects} loading={callLeadsLoading || forceLoading} subs={subs} orders={orders} onOpenSubmission={(it) => go('submissions', it._id)} onOpenOrder={openOrder} />
      )}
      {section === 'leads' && (
        <AdminLeads
          leads={callLeads} submissions={items} loading={callLeadsLoading || forceLoading}
          onPatch={patchCallLead} onCreate={createCallLead} onDelete={deleteCallLead}
          onBulkDelete={bulkDeleteCallLeads} onRestore={restoreCallLeads}
          onRefresh={loadCallLeads} onLinkSubmission={linkSubmission}
          onMobileOpen={() => setLeadsOpen(true)} onMobileClose={() => setLeadsOpen(false)} onGo={go}
          openId={reqFor('leads')} createPreset={createFor('leads')} filterPreset={presetFor('leads')}
        />
      )}
      {section === 'clients' && (
        <AdminClients
          leads={callLeads} submissions={items} loading={callLeadsLoading || projectsLoading || forceLoading}
          projects={projects} onCreateProject={createProject} onPatchProject={patchProject} onRefreshProjects={loadProjects}
          onPatch={patchCallLead} onCreate={createCallLead} onDelete={deleteCallLead}
          onRefresh={loadCallLeads} onLinkSubmission={linkSubmission}
          onMobileOpen={() => setClientsOpen(true)} onMobileClose={() => setClientsOpen(false)} onGo={go}
          openId={reqFor('clients')} createPreset={createFor('clients')}
        />
      )}
      {section === 'submissions' && (
        <AdminSubmissions items={items} loading={loading || forceLoading} leads={callLeads} onPatch={patch} onDelete={softDelete} onLinkLead={linkSubmission} onPatchLead={patchCallLead} onCreateLead={createCallLead} onRefresh={load} openId={reqFor('submissions')} />
      )}
      {section === 'orders' && (
        <AdminOrders orders={orders} loading={ordersLoading || callLeadsLoading || forceLoading} unimported={unimported} leads={callLeads} projects={projects}
          onCreate={createOrder} onPatch={patchOrder} onRefresh={loadOrders} onImportSubmissions={importSubmissionOrders} onPatchLead={patchCallLead} onCreateProject={createProject}
          openId={reqFor('orders')} createPreset={createFor('orders')} />
      )}
      {section === 'concepts' && (
        <AdminConcepts packs={packs} loading={packsLoading || callLeadsLoading || forceLoading} leads={callLeads} onCreate={createPack} onPatch={patchPack} onPatchLead={patchCallLead} onRefresh={loadPacks} openId={reqFor('concepts')} />
      )}
      {section === 'reviews' && (
        <AdminReviews leads={callLeads} projects={projects} submissions={items} loading={callLeadsLoading || projectsLoading || forceLoading} onPatch={patchCallLead} onPatchSubmission={patch} openId={reqFor('reviews')} />
      )}
      {section === 'calls' && (
        <div className="aa-embed"><AdminCalls embedded onDataChanged={loadCallLeads} builderPreset={presetFor('calls')} forceLoading={forceLoading} /></div>
      )}
      {section === 'booked' && (
        <AdminBooked
          leads={callLeads}
          submissions={items}
          loading={callLeadsLoading || forceLoading}
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
        <AdminCalendar leads={callLeads} loading={callLeadsLoading || forceLoading} onPatch={patchCallLead} onCreate={createCallLead} onRefresh={loadCallLeads} openId={reqFor('calendar')} />
      )}
      {section === 'design' && (
        <AdminDesign onBack={() => go('settings')} />
      )}
      {section === 'settings' && (
        <AdminSettings leads={callLeads} projects={projects} orders={orders} submissions={items} initialTab={relPath.startsWith('/settings/deleted') ? 'data' : undefined} onCreateOrder={createOrder} onLeadsImported={loadCallLeads} onDataChanged={load} onRestoreLeads={loadCallLeads} onLogout={logout} loading={forceLoading} />
      )}

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
  .aa-login-card { gap: var(--v-space-4); padding: var(--v-space-6) var(--v-space-5); box-shadow: var(--v-shadow-lg, 0 24px 80px rgba(0,0,0,0.7)); }
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
