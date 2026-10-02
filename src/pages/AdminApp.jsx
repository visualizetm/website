import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { normalizeLeads, pipelineFunnel } from '../lib/leads';
import { useLocation, useNavigate } from 'react-router-dom';
import Wordmark from '../components/Wordmark';
import AdminDashboard from './AdminDashboard';
import AdminMore from './AdminMore';
import { uiStyles, ToastProvider, Card, Stack, Input, Button, Reveal, ErrorBoundary } from '../ui';
import { wireClientLog } from '../shared/log';

import AppShell, { shellStyles } from '../shell/AppShell';
import { navForPath, navById, sectionOf } from '../shell/nav';
import { setNavBase, useNavHistory, usePush, useBack } from '../shell/nav-history';
import '../shell/install';
import BootFrame from '../shell/BootFrame';
import { applyAppearance, setBootHint } from '../shell/appearance';
import { effectiveStage } from '../lib/booked';
import { reviewAsksDue } from '../lib/reviews';
import { conceptsBadge } from '../lib/concepts';
import { withNextAction, nextUpBadge } from '../lib/nextAction';
import { callbacksDueIds, sameIds, systemList, openLists, withLeads, withoutLead, listsBadge } from '../lib/lists';
import ListPicker from '../components/ListPicker';
import CaptureSheet from '../components/CaptureSheet';
import { overdueProjects } from './AdminProjects';
import { withScore, topClientIndustries, briefedLeadIds } from '../lib/score';
import { withDeal, dealAutoPatch, tickPatch, dealOf, isTicked, isStalled } from '../lib/deal';
import { postsInReview } from '../lib/posts';
import { IS_ADMIN_HOST } from '../lib/adminPaths';
import { apiFetch } from '../shared/api';

/* Code split by screen (Prompt 15): the entry chunk is the shell plus the
 * Dashboard; every other screen is its own chunk, loaded on first visit.
 * Leads and the Call Console are prefetched after first paint since they are
 * the next taps. The xlsx chunk stays behind its own dynamic import. */
const loaders = {
  leads: () => import('./AdminLeads'), calls: () => import('./AdminCalls'), deals: () => import('./AdminDeals'), clients: () => import('./AdminClients'),
  calendar: () => import('./AdminCalendar'), orders: () => import('./AdminOrders'), concepts: () => import('./AdminConcepts'), reviews: () => import('./AdminReviews'),
  submissions: () => import('./AdminSubmissions'), settings: () => import('./AdminSettings'), design: () => import('./AdminDesign'), landing: () => import('./AdminLanding'),
  showcase: () => import('./AdminShowcase'),
  planner: () => import('./AdminPlanner'),
  conceptsEditor: () => import('./AdminConceptsEditor'),
  lists: () => import('./AdminLists'),
  triage: () => import('./AdminTriage'),
  projects: () => import('./AdminProjects'),
  projectNew: () => import('./AdminProjectNew'), listFill: () => import('./AdminListFill'),
};
const AdminLeads = lazy(loaders.leads);
const AdminCalls = lazy(loaders.calls);
const AdminDeals = lazy(loaders.deals);
const AdminClients = lazy(loaders.clients);
const AdminCalendar = lazy(loaders.calendar);
const AdminOrders = lazy(loaders.orders);
const AdminConcepts = lazy(loaders.concepts);
const AdminReviews = lazy(loaders.reviews);
const AdminSubmissions = lazy(loaders.submissions);
const AdminSettings = lazy(loaders.settings);
const AdminDesign = lazy(loaders.design);
const AdminLanding = lazy(loaders.landing);
const AdminShowcase = lazy(loaders.showcase);
const AdminPlanner = lazy(loaders.planner);
const AdminConceptsEditor = lazy(loaders.conceptsEditor);
const AdminLists = lazy(loaders.lists);
const AdminTriage = lazy(loaders.triage);
const AdminProjects = lazy(loaders.projects);
const AdminProjectNew = lazy(loaders.projectNew);
const AdminListFill = lazy(loaders.listFill);

/* ── Config ────────────────────────────────────────────────────── */

const BASE = IS_ADMIN_HOST ? '' : '/admin';
setNavBase(BASE);

/* ── Login (kit build, Prompt 13) ─────────────────────────────── */

/* Auth rebuild: a plain JSON POST to /api/admin/login. 200 reloads the shell
 * (the boot session check then sees the cookie), 401 is the wrong password,
 * anything else shows its status. */
function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    let status = 0; let message = '';
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      status = res.status;
      try { message = (await res.json())?.error || ''; } catch { /* no body */ }
    } catch { status = 0; }
    if (status === 200) { window.location.reload(); return; }
    setBusy(false);
    // 429 is the login limiter (ten wrong passwords in fifteen minutes) and
    // 500 with a message is a deployment missing SESSION_SECRET: both say
    // what happened, in the server's words.
    setErr(status === 401 ? 'Wrong password' : (status === 429 || status === 500) && message ? message : `Server error ${status || '(network)'}`);
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
  /* Navigation (Back, done once): the open, create and preset requests ride on the history entry's state (src/shell/nav-history.js), never in memory. */
  useNavHistory();
  const push = usePush();
  const navBack = useBack();
  const openReq = location.state?.open || null;
  const createReq = location.state?.create || null;
  const presetReq = location.state?.preset || null;
  const deepLinked = useRef(false);

  // Call leads, loaded at the shell level so the Booked tab badge is live
  // and the Booked workspace has data. The Call Console keeps its own copy;
  // it pings us (onDataChanged) whenever stages/statuses move.
  const [callLeads, setCallLeads] = useState([]);
  const [callLeadsLoading, setCallLeadsLoading] = useState(true);
  const loadCallLeads = useCallback(async (opts = {}) => {
    const r = await apiFetch('/api/admin/call-leads', { fresh: opts?.fresh === true });
    if (r.ok) { setCallLeads(normalizeLeads(r.data?.items)); setErr('leads', false); } else setErr('leads', true);
    setCallLeadsLoading(false);
  }, [setErr]);

  // Optimistic patch for booked-workspace edits, with rollback on failure.
  const patchCallLead = useCallback(async (id, rawSet) => {
    /* explicit: true is the pipeline guard's flag (a client or won record
       leaving its stage, a decline): it travels on the body, never into the
       record. Whatever screen asks for it puts it in the set and it is
       lifted out here. */
    const { explicit, ...set0 } = rawSet || {};
    /* CRM revamp, step 2: a write that touches stage, the call status, the
       callback, the meeting or the outcome carries the recomputed next
       action on the same PATCH (src/lib/nextAction.js), so the record and
       the Next up queue never disagree. A manual action is kept. */
    const cur = callLeadsRef.current.find(l => l._id === id);
    /* CRM revamp, step 5: a write that touches the stage, the meeting or the deal carries what moves on its own (src/lib/deal.js), then the next action. */
    const setD = cur ? withDeal(cur, set0, { sets: setsRef.current }) : set0;
    const set1 = cur ? withNextAction(cur, setD, { projects: projectsRef.current, sets: setsRef.current }) : setD;
    /* CRM revamp, step 4: a write that touches the phone, the socials, the intel or the industry carries the recomputed score (src/lib/score.js). */
    const set = cur ? withScore(cur, set1, { topIndustries: topClientIndustries(callLeadsRef.current), briefed: briefedLeadIds(itemsRef.current) }) : set1;
    let prev;
    setCallLeads(ls => ls.map(l => { if (l._id === id) { prev = l; return { ...l, ...set }; } return l; }));
    const r = await apiFetch('/api/admin/call-leads', { method: 'PATCH', body: { id, set, ...(explicit === true ? { explicit: true } : {}) } });
    if (r.ok) { if (cur) reconcileRef.current?.(id, { ...cur, ...set }, callLeadsRef.current.map(l => (l._id === id ? { ...l, ...set } : l)), set); return true; }
    if (prev) setCallLeads(ls => ls.map(l => l._id === id ? prev : l));
    return false;
  }, []);

  /* Content Planner posts (planner prompt 1): loaded at the shell level for
   * the same reason projects are. With no leadId the endpoint answers this
   * month and next, which is the window the notifications drawer and the
   * nav badge read; a client's own months are fetched by the planner screen
   * itself in prompt 2. */
  const [posts, setPosts] = useState([]);
  const loadPosts = useCallback(async () => {
    const r = await apiFetch('/api/admin/posts');
    if (r.ok) { setPosts(r.data?.items || []); setErr('posts', false); } else setErr('posts', true);
  }, [setErr]);
  /* Adding and deleting a post are immediate (planner prompt 2, part 4);
   * every other edit is drafted in the editor and saved through patchPost. */
  const createPost = useCallback(async (doc) => {
    const r = await apiFetch('/api/admin/posts', { method: 'POST', body: doc });
    if (!r.ok) return null;
    if (r.data?.item) setPosts(ps => [...ps, r.data.item]);
    return r.data?.item || null;
  }, []);
  const patchPost = useCallback(async (id, set) => {
    let prev;
    setPosts(ps => ps.map(p => { if (String(p._id) === String(id)) { prev = p; return { ...p, ...set }; } return p; }));
    const r = await apiFetch('/api/admin/posts', { method: 'PATCH', body: { id, set } });
    if (r.ok) return true;
    if (prev) setPosts(ps => ps.map(p => String(p._id) === String(id) ? prev : p));
    return false;
  }, []);
  const deletePost = useCallback(async (id) => {
    let prev;
    setPosts(ps => ps.filter(p => { if (String(p._id) === String(id)) { prev = p; return false; } return true; }));
    const r = await apiFetch('/api/admin/posts', { method: 'DELETE', body: { id } });
    if (r.ok) return true;
    if (prev) setPosts(ps => [...ps, prev]);
    return false;
  }, []);

  // Projects (Prompt 10): loaded at the shell level like call leads so the
  // Calendar, the drawer, and the Clients list all read one array.
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const loadProjects = useCallback(async (opts = {}) => {
    const r = await apiFetch('/api/admin/projects', { fresh: opts?.fresh === true });
    if (r.ok) { setProjects(r.data?.items || []); setErr('projects', false); } else setErr('projects', true);
    setProjectsLoading(false);
  }, [setErr]);
  const createProject = useCallback(async (doc) => {
    const r = await apiFetch('/api/admin/projects', { method: 'POST', body: doc });
    if (!r.ok) return null;
    if (r.data?.item) setProjects(ps => [r.data.item, ...ps]);
    return r.data?.item || null;
  }, []);
  const patchProject = useCallback(async (id, set0) => {
    const curP = projectsRef.current.find(p => String(p._id) === String(id));
    const set = curP ? withNextAction(curP, set0, { projects: projectsRef.current, sets: setsRef.current }) : set0;
    let prev;
    setProjects(ps => ps.map(p => { if (String(p._id) === String(id)) { prev = p; return { ...p, ...set }; } return p; }));
    const r = await apiFetch('/api/admin/projects', { method: 'PATCH', body: { id, set } });
    if (r.ok) return true;
    if (prev) setProjects(ps => ps.map(p => String(p._id) === String(id) ? prev : p));
    return false;
  }, []);

  /* Concept sets (Concepts rebuild), loaded at the shell level like posts:
   * the record's pill, the meeting card, the Studio list and the badge all
   * read the one list. Creating is immediate; every other edit is drafted
   * in the editor and saved through patchSet. */
  const [sets, setSets] = useState([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const loadSets = useCallback(async () => {
    const r = await apiFetch('/api/admin/concept-sets');
    if (r.ok) { setSets(r.data?.items || []); setErr('sets', false); } else setErr('sets', true);
    setSetsLoading(false);
  }, [setErr]);
  const createSet = useCallback(async (doc) => {
    const r = await apiFetch('/api/admin/concept-sets', { method: 'POST', body: doc });
    if (!r.ok) return null;
    if (r.data?.item) setSets(ss => [r.data.item, ...ss]);
    /* CRM revamp, step 5: a concept set for a booked or deal record ticks its Concepts checkpoint. */
    const lead = r.data?.item ? callLeadsRef.current.find(l => String(l._id) === String(r.data.item.leadId)) : null;
    if (lead && ['booked', 'deal'].includes(effectiveStage(lead)) && !isTicked(dealOf(lead), 'concepts')) patchCallLeadRef.current?.(lead._id, tickPatch(lead, 'concepts', 'auto'));
    return r.data?.item || null;
  }, []);
  /* The server answers with the stored document (a send stamps sentAt, a
   * regenerate mints the token), so the local copy takes that answer. */
  const patchSet = useCallback(async (id, set) => {
    const r = await apiFetch('/api/admin/concept-sets', { method: 'PATCH', body: { id, set } });
    if (!r.ok) return false;
    if (r.data?.item) setSets(ss => ss.map(s => (String(s._id) === String(id) ? r.data.item : s)));
    else setSets(ss => ss.map(s => (String(s._id) === String(id) ? { ...s, ...set } : s)));
    return true;
  }, []);
  useEffect(() => { if (authed) loadSets(); }, [authed, loadSets]);
  /* Dial lists (CRM revamp, step 3), loaded at the shell level like the
     other collections. The ops below are the one place a list is written
     from a screen: the picker, the Lists screen and the Call Console all
     go through them, so the list's members and each lead's listId move
     together, and the system list Callbacks due is kept in step on every
     write that touches a callback (reconcileLists, below). */
  const [lists, setLists] = useState([]);
  const [listsLoading, setListsLoading] = useState(true);
  const listsRef = useRef([]); listsRef.current = lists;
  const loadLists = useCallback(async () => {
    const r = await apiFetch('/api/admin/lists');
    if (r.ok) { setLists(r.data?.items || []); setErr('lists', false); } else setErr('lists', true);
    setListsLoading(false);
  }, [setErr]);
  useEffect(() => { if (authed) loadLists(); }, [authed, loadLists]);
  const createList = useCallback(async (doc) => {
    const r = await apiFetch('/api/admin/lists', { method: 'POST', body: doc });
    if (!r.ok) return null;
    if (r.data?.item) setLists(ls => [r.data.item, ...ls]);
    return r.data?.item || null;
  }, []);
  const patchList = useCallback(async (id, set, opts = {}) => {
    let prev;
    setLists(ls => ls.map(l => { if (String(l._id) === String(id)) { prev = l; return { ...l, ...set }; } return l; }));
    const r = await apiFetch('/api/admin/lists', { method: 'PATCH', body: { id, set, ...(opts.sync ? { sync: true } : {}) } });
    if (r.ok) { if (r.data?.item) setLists(ls => ls.map(l => (String(l._id) === String(id) ? r.data.item : l))); return true; }
    if (prev) setLists(ls => ls.map(l => (String(l._id) === String(id) ? prev : l)));
    return false;
  }, []);
  /* After a lead write: a lead that left stage lead or had its listId
     cleared leaves any open hand list; the system list follows the
     callbacks. Best effort, never blocks the write that caused it. */
  const reconcileLists = useCallback((id, merged, allLeads, set) => {
    const touched = ['stage', 'callStatus', 'callbackAt', 'listId', 'deleted'].some(k => k in set);
    if (!touched) return;
    const left = effectiveStage(merged) !== 'lead' || set.listId === '' || merged.deleted;
    if (left) for (const l of openLists(listsRef.current)) if (!l.system && (l.leadIds || []).map(String).includes(String(id))) patchList(l._id, { leadIds: withoutLead(l.leadIds, id) });
    const sys = systemList(listsRef.current);
    if (sys) { const ids = callbacksDueIds(allLeads); if (!sameIds(ids, sys.leadIds || [])) patchList(sys._id, { leadIds: ids }, { sync: true }); }
  }, [patchList]);
  const syncCallbacksDue = useCallback((leadsOverride) => {
    const sys = systemList(listsRef.current); if (!sys) return;
    const ids = callbacksDueIds(leadsOverride || callLeadsRef.current);
    if (!sameIds(ids, sys.leadIds || [])) patchList(sys._id, { leadIds: ids }, { sync: true });
  }, [patchList]);
  const listOps = useMemo(() => ({
    createList, patchList, loadLists, syncCallbacksDue,
    /* Add leads to one list: the list gains them (unique, capped), every other open hand list loses them, each lead's listId points at it. */
    addToList: async (ids, listId) => {
      const target = listsRef.current.find(l => String(l._id) === String(listId)); if (!target || target.system) return null;
      const ok = await patchList(target._id, { leadIds: withLeads(target.leadIds, ids) }); if (!ok) return null;
      for (const l of openLists(listsRef.current)) if (!l.system && String(l._id) !== String(listId) && (l.leadIds || []).some(x => ids.map(String).includes(String(x)))) patchList(l._id, { leadIds: (l.leadIds || []).filter(x => !ids.map(String).includes(String(x))) });
      for (const id of ids) { const lead = callLeadsRef.current.find(l => l._id === id); if (lead && lead.listId !== String(listId)) patchCallLead(id, { listId: String(listId) }); }
      return { count: withLeads(target.leadIds, ids).length };
    },
    removeFromList: async (id, listId) => {
      const l = listsRef.current.find(x => String(x._id) === String(listId)); if (!l) return false;
      const ok = await patchList(l._id, { leadIds: withoutLead(l.leadIds, id) });
      const lead = callLeadsRef.current.find(x => x._id === id);
      if (ok && lead && String(lead.listId) === String(listId)) patchCallLead(id, { listId: '' });
      return ok;
    },
    /* Done or deleted: the list closes and its leads are free again. */
    finishList: async (listId, remove = false) => {
      const l = listsRef.current.find(x => String(x._id) === String(listId)); if (!l || l.system) return false;
      let ok;
      if (remove) { const r = await apiFetch(`/api/admin/lists?id=${encodeURIComponent(listId)}`, { method: 'DELETE' }); ok = r.ok; if (ok) setLists(ls => ls.map(x => (String(x._id) === String(listId) ? { ...x, status: 'done' } : x))); }
      else ok = await patchList(l._id, { status: 'done' });
      if (ok) for (const id of (l.leadIds || [])) { const lead = callLeadsRef.current.find(x => x._id === String(id)); if (lead && String(lead.listId) === String(listId)) patchCallLead(String(id), { listId: '' }); }
      return ok;
    },
    /* An outcome from the Call Console: the list rule on the same beat. */
    applyOutcome: async (listId, leadId, nextIds, removes) => {
      const l = listsRef.current.find(x => String(x._id) === String(listId)); if (!l || !nextIds) return false;
      const ok = await patchList(l._id, { leadIds: nextIds }, l.system ? { sync: true } : {});
      if (ok && removes) { const lead = callLeadsRef.current.find(x => x._id === String(leadId)); if (lead && String(lead.listId) === String(listId)) patchCallLead(String(leadId), { listId: '' }); }
      return ok;
    },
  }), [createList, patchList, loadLists, syncCallbacksDue, patchCallLead]);
  const reconcileRef = useRef(null); reconcileRef.current = reconcileLists;
  const patchCallLeadRef = useRef(null); patchCallLeadRef.current = patchCallLead;
  /* CRM revamp, step 7: a send's result lands on the local record at once (the server already wrote it), then the lists refetch past every cache. */
  const applyLeadLocal = useCallback((id, set) => { setCallLeads(ls => ls.map(l => (l._id === id ? { ...l, ...set } : l))); }, []);
  const applyProjectLocal = useCallback((id, set) => { setProjects(ps => ps.map(p => (String(p._id) === String(id) ? { ...p, ...set } : p))); }, []);
  const projectOps = useMemo(() => ({ create: createProject, patch: patchProject, reload: () => loadProjects({ fresh: true }), applyLocal: applyProjectLocal }), [createProject, patchProject, loadProjects, applyProjectLocal]);
  const leadOps = useMemo(() => ({ applyLocal: applyLeadLocal, reload: () => loadCallLeads({ fresh: true }) }), [applyLeadLocal, loadCallLeads]);
  const [pickerLeads, setPickerLeads] = useState(null);
  // Capture a lead (CRM revamp, step 4): the Quick add sheet and Triage's empty state open it.
  const [captureOpen, setCaptureOpen] = useState(false);
  const openCapture = useCallback(() => setCaptureOpen(true), []);
  const openListPicker = useCallback((leads) => { const ls = (Array.isArray(leads) ? leads : [leads]).filter(Boolean); if (ls.length) setPickerLeads(ls); }, []);
  // The latest lists for the write helpers above, which are memoised once.
  const callLeadsRef = useRef([]); callLeadsRef.current = callLeads;
  const itemsRef = useRef([]); itemsRef.current = items;
  const projectsRef = useRef([]); projectsRef.current = projects;
  const setsRef = useRef([]); setsRef.current = sets;

  // Print orders (Prompt 11), loaded at the shell level like projects.
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

  const section = useMemo(() => {
    const p = location.pathname.slice(BASE.length) || '/';
    if (p.startsWith('/more')) return 'more';
    if (p.startsWith('/submissions')) return 'submissions';
    if (p.startsWith('/orders')) return 'orders';
    if (p.startsWith('/calls')) return 'calls';
    if (/^\/leads\/[^/]+\/concepts$/.test(p)) return 'conceptsEditor';
    if (/^\/clients\/[^/]+\/projects\/new$/.test(p) || p === '/projects/new') return 'projectNew';
    if (/^\/lists\/[^/]+\/fill$/.test(p)) return 'listFill';
    if (p.startsWith('/leads')) return 'leads';
    if (p.startsWith('/deals') || p.startsWith('/booked')) return 'deals';
    if (p.startsWith('/lists')) return 'lists';
    if (p.startsWith('/triage')) return 'triage';
    if (p.startsWith('/projects')) return 'projects';
    if (p.startsWith('/calendar')) return 'calendar';
    if (/^\/clients\/[^/]+\/showcase$/.test(p)) return 'showcase';
    if (/^\/clients\/[^/]+\/planner$/.test(p)) return 'planner';
    if (p.startsWith('/clients')) return 'clients';
    if (p.startsWith('/concepts')) return 'concepts';
    if (p.startsWith('/reviews')) return 'reviews';
    if (p.startsWith('/landing')) return 'landing';
    if (p.startsWith('/settings')) return 'settings';
    if (p.startsWith('/design')) return 'design';
    return 'dashboard';
  }, [location.pathname]);

  const relPath = location.pathname.slice(BASE.length) || '/';
  // /booked became /deals (CRM revamp, step 5); the old link still lands.
  useEffect(() => { if (relPath.startsWith('/booked')) navigate(`${BASE}/deals${relPath.slice(7)}${location.search || ''}`, { replace: true }); }, [relPath]); // eslint-disable-line react-hooks/exhaustive-deps
  // /clients?filter=active became /projects (CRM revamp, step 7); the old link still lands.
  useEffect(() => { if (relPath === '/clients' && new URLSearchParams(location.search).get('filter') === 'active') navigate(`${BASE}/projects`, { replace: true }); }, [relPath, location.search]); // eslint-disable-line react-hooks/exhaustive-deps
  // /clients/:id/showcase (Site Prompt 7, Part 3): not a nav entry, so the
  // id comes off the path rather than out of an openReq.
  const showcaseId = (relPath.match(/^\/clients\/([^/]+)\/showcase$/) || [])[1] || '';
  // /clients/:id/planner (planner prompt 2), the same shape.
  const plannerId = (relPath.match(/^\/clients\/([^/]+)\/planner$/) || [])[1] || '';
  // /clients/:id/projects/new and /projects/new (nothing computer only): the new project page; /lists/:id/fill: fill from filters.
  const projectNewLeadId = (relPath.match(/^\/clients\/([^/]+)\/projects\/new$/) || [])[1] || '';
  const listFillId = (relPath.match(/^\/lists\/([^/]+)\/fill$/) || [])[1] || '';
  // /leads/:id/concepts (Concepts rebuild), any stage; ?set= picks the round.
  const conceptsLeadId = (relPath.match(/^\/leads\/([^/]+)\/concepts$/) || [])[1] || '';
  const forceLoading = new URLSearchParams(location.search).get('loading') === '1'; // the audits' forced loading state: nothing has loaded yet
  const V = forceLoading ? { leads: [], items: [], projects: [], orders: [], posts: [], sets: [], lists: [] } : { leads: callLeads, items, projects, orders, posts, sets, lists };
  const activeNav = useMemo(() => navForPath(relPath, location.search), [relPath, location.search]);

  const rootOf = (sec) => `${BASE}/${sec === 'dashboard' ? '' : sec}`;
  /* A section root: a plain navigation with no origin, so the root has no Back. An item on it (a submission) is a push. */
  const go = useCallback((sec, itemId) => {
    if (itemId && sec === 'submissions') { push(rootOf('submissions'), { open: { section: 'submissions', id: String(itemId), n: Date.now() }, selectedId: itemId }); return; }
    navigate(rootOf(sec));
  }, [navigate, push]);

  // Shell navigation by nav.js id ('deleted' is a Settings sub-view).
  const goNav = useCallback((navId, preset) => {
    const entry = navById(navId);
    if (!entry || entry.soon) return;
    if (entry.id === 'deleted') { push(`${BASE}/settings/deleted`); return; }
    if (entry.href) { navigate(`${BASE}${entry.href}`); return; }
    const sec = sectionOf(entry);
    navigate(rootOf(sec), preset ? { state: { preset: { section: sec, preset, n: Date.now() } } } : undefined);
  }, [navigate, push]);
  // The editors and the setup pages: each a push from the screen it leaves.
  const openShowcase = useCallback((lead) => { push(`${BASE}/clients/${lead._id}/showcase`, { selectedId: lead._id }); }, [push]);
  const openPlanner = useCallback((lead, month) => { push(`${BASE}/clients/${lead._id}/planner${month ? `?month=${month}` : ''}`, { selectedId: lead._id }); }, [push]);
  const openConcepts = useCallback((lead, setId) => { push(`${BASE}/leads/${lead._id}/concepts${setId ? `?set=${setId}` : ''}`, { selectedId: lead._id }); }, [push]);
  const openProjectNew = useCallback((lead, mode) => { push(lead ? `${BASE}/clients/${lead._id}/projects/new${mode ? `?mode=${mode}` : ''}` : `${BASE}/projects/new`, { selectedId: lead?._id }); }, [push]);
  const openListFill = useCallback((list) => { push(`${BASE}/lists/${list._id}/fill`, { selectedId: list._id }); }, [push]);
  // Open a lead in whichever screen owns its stage: a push carrying the record on its state.
  const openLead = useCallback((lead, intent, opts = {}) => {
    const stage = effectiveStage(lead);
    const sec = (stage === 'booked' || stage === 'deal') ? 'deals' : (stage === 'won' || stage === 'client') ? 'clients' : 'leads';
    // intent (CRM revamp, step 2): which fold the record opens on ('outcome', 'payments').
    push(rootOf(sec), { open: { section: sec, id: String(lead._id), n: Date.now(), intent: intent ? { kind: intent, n: Date.now() } : null }, selectedId: lead._id, replace: !!opts.replace });
  }, [push]);
  const newLead = useCallback((preset) => { push(rootOf('leads'), { create: { section: 'leads', preset: preset || {}, n: Date.now() } }); }, [push]);
  const newClient = useCallback(() => { push(rootOf('clients'), { create: { section: 'clients', preset: {}, n: Date.now() } }); }, [push]);
  const newOrder = useCallback((preset) => { push(rootOf('orders'), { create: { section: 'orders', preset: preset || {}, n: Date.now() } }); }, [push]);

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
  // ?open=<id> deep links a record on the current screen (push links and the feel audit use it): no origin, so Back goes to the section root.
  // On Next up (a task push lands on /?open=) the lead opens in the screen that owns its stage once the leads are in.
  const deepOpened = useRef(false);
  useEffect(() => {
    if (!authed || deepOpened.current) return;
    const id = new URLSearchParams(window.location.search).get('open');
    if (!id) return;
    if (section === 'dashboard') {
      if (callLeadsLoading) return;
      deepOpened.current = true;
      const lead = callLeads.find(l => String(l._id) === String(id));
      if (lead) openLead(lead, null, { replace: true });
      return;
    }
    deepOpened.current = true;
    navigate(location.pathname + location.search, { replace: true, state: { open: { section, id, n: Date.now() }, idx: 0 } });
  }, [authed, callLeadsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const r = await apiFetch('/api/admin/submissions');
    if (r.status === 401) { setAuthed(false); setBootHint(false); return; }
    if (r.ok) { setItems(r.data?.items || []); setUnread(r.data?.unread || 0); setErr('submissions', false); } else setErr('submissions', true);
    setLoading(false);
  }, [setErr]);
  useEffect(() => { if (authed) load(); }, [authed, load]);
  useEffect(() => { if (authed) loadCallLeads(); }, [authed, loadCallLeads]);
  useEffect(() => { if (authed) loadProjects(); }, [authed, loadProjects]);
  useEffect(() => { if (authed) loadPosts(); }, [authed, loadPosts]);
  useEffect(() => { if (authed) loadOrders(); }, [authed, loadOrders]);

  /* The deal sweep (CRM revamp, step 5): on load, a booked record past its
     meeting becomes a deal, concepts and a past Calendly call tick, and a
     stall is set or cleared, the same rules the cron runs (src/lib/deal.js).
     Each record is swept once per shape so a failed write does not loop. */
  const sweptRef = useRef(new Set());
  useEffect(() => {
    if (!authed || callLeadsLoading || setsLoading) return;
    for (const l of callLeads) {
      if (!['booked', 'deal'].includes(effectiveStage(l))) continue;
      const auto = dealAutoPatch(l, { sets });
      if (!auto) continue;
      const key = `${l._id}:${JSON.stringify(auto)}`;
      if (sweptRef.current.has(key)) continue;
      sweptRef.current.add(key);
      patchCallLead(l._id, auto);
    }
  }, [authed, callLeads, sets, callLeadsLoading, setsLoading, patchCallLead]);

  const stageCounts = useMemo(() => {
    const c = { triage: 0, lead: 0, booked: 0, deal: 0, won: 0, client: 0, nurture: 0, declined: 0, toCall: 0 };
    for (const l of callLeads) {
      const s = effectiveStage(l);
      if (s in c) c[s]++;
      if (s === 'lead' && l.callStatus === 'not-called') c.toCall++;
    }
    return c;
  }, [callLeads]);
  const bookedCount = stageCounts.booked;
  // Deals (CRM revamp, step 5): the badge counts stalled deals.
  const stalledDeals = useMemo(() => callLeads.filter(l => ['booked', 'deal'].includes(effectiveStage(l)) && isStalled(l)).length, [callLeads]);
  const funnel = useMemo(() => pipelineFunnel(callLeads), [callLeads]);
  // Projects (CRM revamp, step 7): the badge counts projects whose next action is overdue.
  const openProjects = useMemo(() => overdueProjects(projects, { projects, sets }), [projects, sets]);
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
  // Posts sitting with clients right now, across every client: the Planner
  // badge, so Rob can see at a glance how many are waiting on somebody else.
  const postsWithClients = useMemo(() => postsInReview(posts), [posts]);

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
        if (d.submission.type === 'shop-order') navigate(`${BASE}/orders`, { replace: true, state: { open: { section: 'orders', submissionId: String(d.submission._id), n: Date.now() }, idx: 0 } });
        else if (d.submission.type === 'review') navigate(`${BASE}/reviews`, { replace: true });
        else navigate(`${BASE}/submissions`, { replace: true, state: { open: { section: 'submissions', id: String(d.submission._id), n: Date.now() }, idx: 0 } });
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
  if (!authed) return <Login />;

  // A phone shows the record instead of the list while the entry opens one (the three split screens).
  const hasDetail = ['deals', 'leads', 'clients', 'triage'].includes(section) && !!(openReq?.section === section || createReq?.section === section);
  /* Link a submission: a start brief linked to a deal ticks Form received (CRM revamp, step 5). */
  const linkSubmission = async (subId, leadId) => {
    const ok = await patch(subId, { linkedLeadId: leadId });
    const sub = items.find(s => s._id === subId); const lead = leadId ? callLeads.find(l => l._id === leadId) : null;
    if (ok && sub?.type === 'start' && lead && ['booked', 'deal'].includes(effectiveStage(lead)) && !isTicked(dealOf(lead), 'formReceived')) patchCallLead(leadId, tickPatch(lead, 'formReceived', 'auto'));
    return ok;
  };
  /* Part 2: the Clients badge counts clients (stage client or won; the list
     already excludes deleted). It used to carry the planner's posts-in-review
     count, which is why it read 40 with six clients. Planner and Projects
     are their own entries now. */
  const counts = { triage: stageCounts.triage, leads: stageCounts.lead, booked: bookedCount, deals: stalledDeals, calls: callbacksDue, orders: newOrders, submissions: unreadSubs, calendar: calendarToday, reviews: reviewsDue, clients: stageCounts.client + stageCounts.won, projects: openProjects, planner: postsWithClients, concepts: conceptsBadge(sets), dashboard: nextUpBadge(callLeads, projects, sets), lists: listsBadge(lists) };
  const createFor = (sec) => (createReq?.section === sec ? createReq : null);
  const presetFor = (sec) => (presetReq?.section === sec ? presetReq : null);

  return (
    <ToastProvider>
    <AppShell activeNavId={activeNav.id} counts={counts} funnel={funnel} countsLoading={callLeadsLoading || forceLoading} leads={V.leads} leadsLoading={callLeadsLoading || forceLoading} onRefetchLeads={loadCallLeads}
      leadsError={errors.leads} onRetryLeads={loadCallLeads} posts={V.posts} hasDetail={!!hasDetail} onGo={goNav} onOpenLead={openLead} onOpenShowcase={openShowcase} onOpenPlanner={openPlanner} onOpenConcepts={openConcepts} onOpenProjectNew={openProjectNew} onOpenListFill={openListFill} sets={V.sets} lists={V.lists} onOpenListPicker={openListPicker} listOps={listOps} onNewLead={newLead} onNewClient={newClient} onNewOrder={newOrder} onCapture={openCapture} onLogout={logout} projectOps={projectOps} leadOps={leadOps} onPatchLead={patchCallLead} projects={projects} styles={uiStyles + shellStyles + aaStyles}>
      {/* Section content: one boundary and one Suspense per screen, keyed so a new screen starts clean. */}
      <ErrorBoundary key={section} label={`the ${activeNav.label} screen`} reload>
      <Suspense fallback={null}>
      {section === 'dashboard' && (
        <AdminDashboard leads={V.leads} projects={V.projects} sets={V.sets} loading={callLeadsLoading || forceLoading} error={errors.leads} onRetry={loadCallLeads} subs={subs} orders={orders} onPatchLead={patchCallLead} onPatchProject={patchProject} onCreateProject={createProject} onOpenLead={openLead} submissions={V.items} onLinkSubmission={linkSubmission} />
      )}
      {section === 'more' && <AdminMore counts={counts} countsLoading={callLeadsLoading || forceLoading} onGo={goNav} onLogout={logout} />}
      {section === 'leads' && (
        <AdminLeads
          leads={V.leads} submissions={V.items} loading={callLeadsLoading || forceLoading} error={errors.leads} onRetry={loadCallLeads}
          onPatch={patchCallLead} onCreate={createCallLead} onDelete={deleteCallLead}
          onBulkDelete={bulkDeleteCallLeads} onRestore={restoreCallLeads}
          onRefresh={loadCallLeads} onLinkSubmission={linkSubmission}
          onGo={go} createPreset={createFor('leads')} filterPreset={presetFor('leads')}
        />
      )}
      {section === 'clients' && (
        <AdminClients
          leads={V.leads} submissions={V.items} loading={callLeadsLoading || projectsLoading || forceLoading} error={errors.leads || errors.projects} onRetry={async () => { await Promise.all([loadCallLeads(), loadProjects()]); }}
          projects={V.projects} posts={V.posts} onCreateProject={createProject} onPatchProject={patchProject} onRefreshProjects={loadProjects}
          onPatch={patchCallLead} onCreate={createCallLead} onDelete={deleteCallLead}
          onRefresh={loadCallLeads} onLinkSubmission={linkSubmission}
          onGo={go} createPreset={createFor('clients')}
        />
      )}
      {section === 'projects' && (
        <AdminProjects projects={V.projects} leads={V.leads} loading={projectsLoading || callLeadsLoading || forceLoading} error={errors.projects} onRetry={loadProjects} onOpen={openLead} onNew={() => openProjectNew(null)} onPatch={patchProject} />
      )}
      {section === 'projectNew' && (
        <AdminProjectNew key={projectNewLeadId || 'pick'} lead={V.leads.find(l => String(l._id) === projectNewLeadId) || null} leads={V.leads} loading={callLeadsLoading || projectsLoading || forceLoading} error={errors.leads} onRetry={loadCallLeads}
          onCreateProject={createProject} onPatchLead={patchCallLead} mode={new URLSearchParams(location.search).get('mode') || 'package'}
          onPick={(l) => openProjectNew(l)} onCancel={() => { if (navBack) navBack.back(); else go('projects'); }} onDone={(l, item, intent) => openLead(l, intent, { replace: true })} />
      )}
      {section === 'listFill' && (
        <AdminListFill list={V.lists.find(l => String(l._id) === listFillId) || null} leads={V.leads} lists={V.lists} loading={listsLoading || callLeadsLoading || forceLoading} error={errors.lists || errors.leads} onRetry={loadLists} ops={listOps}
          onDone={(l) => push(`${BASE}/lists`, { open: { section: 'lists', id: String(l._id), n: Date.now() }, replace: true })} onCancel={() => { if (navBack) navBack.back(); else go('lists'); }} />
      )}
      {section === 'planner' && (
        <AdminPlanner
          lead={V.leads.find(l => String(l._id) === plannerId) || null}
          posts={V.posts}
          month={new URLSearchParams(location.search).get('month') || ''}
          loading={callLeadsLoading || forceLoading}
          error={errors.posts}
          onRetry={loadPosts}
          onPatch={patchCallLead}
          onRefetchLead={loadCallLeads}
          onCreatePost={createPost}
          onPatchPost={patchPost}
          onDeletePost={deletePost}
          onBack={navBack ? navBack.back : () => go('clients')}
        />
      )}
      {section === 'conceptsEditor' && (
        <AdminConceptsEditor
          lead={V.leads.find(l => String(l._id) === conceptsLeadId) || null}
          sets={V.sets} projects={V.projects}
          loading={callLeadsLoading || setsLoading || forceLoading}
          error={errors.sets} onRetry={loadSets}
          onCreate={createSet} onPatch={patchSet} onPatchProject={patchProject}
          setId={new URLSearchParams(location.search).get('set') || ''}
          onBack={navBack ? navBack.back : () => go('concepts')}
        />
      )}
      {section === 'showcase' && (
        <AdminShowcase
          lead={V.leads.find(l => String(l._id) === showcaseId) || null}
          loading={callLeadsLoading || forceLoading}
          submissions={V.items}
          onPatch={patchCallLead}
          onBack={navBack ? navBack.back : () => go('clients')}
        />
      )}
      {section === 'submissions' && (
        <AdminSubmissions items={V.items} loading={loading || forceLoading} error={errors.submissions} onRetry={load} leads={V.leads} onPatch={patch} onDelete={softDelete} onLinkLead={linkSubmission} onPatchLead={patchCallLead} onCreateLead={createCallLead} onRefresh={load} />
      )}
      {section === 'orders' && (
        <AdminOrders orders={V.orders} loading={ordersLoading || callLeadsLoading || forceLoading} error={errors.orders} onRetry={loadOrders} unimported={unimported} leads={V.leads} projects={V.projects}
          onCreate={createOrder} onPatch={patchOrder} onRefresh={loadOrders} onImportSubmissions={importSubmissionOrders} onPatchLead={patchCallLead} onCreateProject={createProject}
          createPreset={createFor('orders')} />
      )}
      {section === 'concepts' && (
        <AdminConcepts sets={V.sets} leads={V.leads} loading={setsLoading || callLeadsLoading || forceLoading} error={errors.sets} onRetry={loadSets} />
      )}
      {section === 'reviews' && (
        <AdminReviews leads={V.leads} projects={V.projects} submissions={V.items} loading={callLeadsLoading || projectsLoading || forceLoading} error={errors.leads || errors.projects} onRetry={async () => { await Promise.all([loadCallLeads(), loadProjects()]); }} onPatch={patchCallLead} onPatchSubmission={patch} />
      )}
      {section === 'landing' && (
        <AdminLanding leads={V.leads} projects={V.projects} loading={callLeadsLoading || projectsLoading || forceLoading} error={errors.leads || errors.projects} onRetry={async () => { await Promise.all([loadCallLeads(), loadProjects()]); }} onPatchLead={patchCallLead} onOpenLead={openLead} />
      )}
      {section === 'calls' && (
        <div className="aa-embed"><AdminCalls embedded onDataChanged={loadCallLeads} builderPreset={presetFor('calls')} forceLoading={forceLoading} lists={V.lists} listsLoading={listsLoading} listsError={errors.lists} onRetryLists={loadLists} listOps={listOps} /></div>
      )}
      {section === 'lists' && (
        <AdminLists lists={V.lists} leads={V.leads} loading={listsLoading || callLeadsLoading || forceLoading} error={errors.lists} onRetry={loadLists} ops={listOps} onPatchLead={patchCallLead} onOpenLead={openLead}
          onStart={(list) => navigate(`${BASE}/calls`, { state: { preset: { section: 'calls', preset: { listId: String(list._id) }, n: Date.now() } } })} />
      )}
      {section === 'triage' && (
        <AdminTriage leads={V.leads} submissions={V.items} loading={callLeadsLoading || forceLoading} error={errors.leads} onRetry={loadCallLeads}
          onPatch={patchCallLead} onDelete={deleteCallLead} onRestore={restoreCallLeads} onCapture={openCapture} />
      )}
      {pickerLeads && <ListPicker leads={pickerLeads} lists={V.lists} ops={listOps} onClose={() => setPickerLeads(null)} />}
      {captureOpen && <CaptureSheet onClose={() => setCaptureOpen(false)} onCreate={createCallLead} />}
      {section === 'deals' && (
        <AdminDeals
          leads={V.leads}
          submissions={V.items}
          loading={callLeadsLoading || forceLoading}
          error={errors.leads} onRetry={loadCallLeads}
          onPatch={patchCallLead}
          onRefresh={loadCallLeads}
          onLinkSubmission={linkSubmission}
          onGo={go}
        />
      )}
      {section === 'calendar' && (
        <AdminCalendar leads={V.leads} loading={callLeadsLoading || forceLoading} error={errors.leads} onRetry={loadCallLeads} onPatch={patchCallLead} onCreate={createCallLead} onRefresh={loadCallLeads} />
      )}
      {section === 'design' && (
        <AdminDesign onBack={navBack ? navBack.back : null} loading={forceLoading} />
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
  .aa-loginpage { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); padding: var(--v-space-4); }
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
    /* display: flex with min-height: 0, not display: block (the mobile
       scroll fix). These two rules used to turn the screen's shell into a
       block box on a phone, which takes its ScrollArea out of the flex
       column: flex: 1 1 auto then means nothing, the scroller sizes itself
       to its content, and there is nothing left to scroll. The shell has
       to stay a flex column that is allowed to shrink, exactly as it is
       on a desktop, or the whole layout contract in LAYOUT.md stops
       holding at the one width where it matters most. */
    .aa-main--wide { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .aa-app.has-detail .aa-panel { display: none; }
    .aa-app.has-detail .aa-main { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .aa-embed { flex: 1; min-height: 0; }
  }
`;
