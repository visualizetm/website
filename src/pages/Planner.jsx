import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useHead } from '../marketing/useHead';
import { COPY } from '../shared/copy';
import { tokenStyles } from '../ui/tokens';
import { portalBackHref } from '../components/ClientPageChrome';
import { TopBar, TabBar, TABS, Toast, Skeleton, ErrorBox } from '../components/planner/parts';
import { plannerStyles } from '../components/planner/styles';
import { thisMonth, shiftMonth, monthName, reviewQueue, todayKey } from '../lib/plannerView';
import HomeScreen from '../components/planner/Home';
import PlanScreen from '../components/planner/Plan';
import AdsScreen from '../components/planner/Ads';
import IdeasScreen from '../components/planner/Ideas';
import ReviewScreen, { reviewStyles } from '../components/planner/Review';
import PostPage from '../components/planner/PostPage';
import { screenStyles } from '../components/planner/screenStyles';

/* The client's planner (Planner v2), at /planner/:token. It looks and works
 * like Rob's CRM, tailored to content: the --v-* token set (dark only), the
 * CRM's cards and pills, a top bar and the floating glass tab bar.
 *
 * This file keeps the routing, the data and the shell; the screens are in
 * src/components/planner/ and their pure logic in src/lib/plannerView.js.
 *
 *   ?tab=home|plan|ads|ideas   the four tab roots (an old ?tab=posts link opens Plan)
 *   ?review=1                  Review mode, focused: one post at a time
 *   ?post=<id>                 a post page, focused
 *   ?day=YYYY-MM-DD            Plan's calendar on that day (Home's week)
 *
 * A focused screen is pushed as a real history entry, so the phone's Back
 * and the top bar's Back are the same step; a cold open of one (a link, a
 * reload) backs to its tab root instead of leaving the page.
 *
 * The token is the whole credential and api/planner.js cannot tell an
 * unknown one from a revoked one from a switched off planner: all three are
 * the same 404, so this page has one dead end and never implies a link was
 * ever good. Everything here is a read plus four writes: approve, ask for a
 * change, I posted it, and an idea. The copy speaks as Rob. */

export default function Planner() {
  const { token = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const C = COPY.planner;

  const rawTab = params.get('tab');
  const tab = rawTab === 'posts' ? 'plan' : TABS.includes(rawTab) ? rawTab : 'home';
  const postId = params.get('post') || '';
  const reviewing = params.get('review') === '1';
  const focused = reviewing || !!postId;

  const [month, setMonth] = useState(() => {
    const d = params.get('day');
    return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.slice(0, 7) : thisMonth();
  });
  const [data, setData] = useState(null); // { client, month, posts, suggestions, back }
  const [state, setState] = useState('loading'); // loading | ready | dead | error
  const [toast, setToast] = useState('');
  const [pos, setPos] = useState(null); // Review mode's "2 of 3", reported by the screen
  const portal = portalBackHref(params.toString(), data?.back);

  useHead({ title: 'Your planner | Visualize.', description: 'Your posts, ads and ideas for the month.', noindex: true });

  const load = useCallback(async (m) => {
    setState(s => (s === 'ready' ? s : 'loading'));
    try {
      const res = await fetch(`/api/planner?token=${encodeURIComponent(token)}&month=${encodeURIComponent(m)}`);
      if (res.status === 404) { setState('dead'); return; }
      if (!res.ok) { setState(s => (s === 'ready' ? s : 'error')); return; }
      setData(await res.json());
      setState('ready');
    } catch {
      setState(s => (s === 'ready' ? s : 'error'));
    }
  }, [token]);
  useEffect(() => { load(month); }, [month, load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const items = useMemo(() => data?.posts || [], [data]);
  const queue = useMemo(() => reviewQueue(items), [items]);

  /* Navigation. A tab is a replace (tabs are siblings); a focused screen is a push, carrying state.pl so Back knows it can step back. */
  const pickTab = useCallback((t) => {
    setParams(t === 'home' ? {} : { tab: t }, { replace: true });
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { /* old browsers */ }
  }, [setParams]);
  const rootParams = useCallback(() => {
    const p = {};
    if (tab !== 'home') p.tab = tab;
    if (params.get('from')) p.from = params.get('from');
    return p;
  }, [tab, params]);
  const push = useCallback((extra) => {
    setParams({ ...rootParams(), ...extra }, { state: { pl: true } });
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { /* old browsers */ }
  }, [setParams, rootParams]);
  const openPost = useCallback((item) => push({ post: item.id }), [push]);
  const openReview = useCallback(() => push({ review: '1' }), [push]);
  const back = useCallback(() => {
    if (location.state?.pl) navigate(-1);
    else setParams(rootParams(), { replace: true });
  }, [location.state, navigate, setParams, rootParams]);
  const openDay = useCallback((key) => {
    if (key.slice(0, 7) !== month) setMonth(key.slice(0, 7));
    setParams({ tab: 'plan', day: key }, { replace: true });
  }, [month, setParams]);

  /* Escape on a computer is Back on a focused screen (a sheet takes Escape first and stops it). */
  useEffect(() => {
    if (!focused) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) back(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focused, back]);

  /* The one door for writes. A 404 means the link was revoked while they read, so the page becomes the dead end. */
  const send = useCallback(async (body) => {
    try {
      const res = await fetch(`/api/planner?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      let json = null; try { json = await res.json(); } catch { json = null; }
      return { status: res.status, ok: res.ok, json };
    } catch {
      return { status: 0, ok: false };
    }
  }, [token]);
  const patchItem = useCallback((id, set) => setData(d => (d ? { ...d, posts: d.posts.map(p => (p.id === id ? { ...p, ...set } : p)) } : d)), []);
  /** Runs one decision on a post. Resolves 'ok', or the reason it did not land: 'stale' (not waiting any more), 'limit', 'invalid', 'failed'. */
  const decide = useCallback(async (item, action, extra = {}) => {
    const r = await send({ postId: item.id, action, ...extra });
    if (r.ok) {
      if (action === 'approve') patchItem(item.id, { status: 'approved' });
      if (action === 'request-change') patchItem(item.id, { status: 'making', clientNote: extra.note || '', changeReason: extra.reason || '' });
      if (action === 'posted') patchItem(item.id, { status: 'posted', postedBy: 'client', postedAt: new Date().toISOString() });
      return 'ok';
    }
    if (r.status === 404 && action !== 'posted') { setState('dead'); return 'failed'; }
    if (r.status === 409 || r.status === 404) { load(month); return 'stale'; }
    if (r.status === 429) return 'limit';
    if (r.status === 400) return 'invalid';
    return 'failed';
  }, [send, patchItem, load, month]);
  const suggest = useCallback(async (fields) => {
    const r = await send({ action: 'suggest', ...fields });
    if (r.ok) {
      const s = r.json?.suggestion || { id: `tmp${Date.now()}`, kind: fields.kind, subject: fields.subject, goal: fields.goal, status: 'new', note: '', createdAt: new Date().toISOString(), seen: false, made: false };
      setData(d => (d ? { ...d, suggestions: [s, ...(d.suggestions || [])] } : d));
      setToast(C.toast.ideaSent);
      return true;
    }
    if (r.status === 404) { setState('dead'); return 404; }
    return r.status || 500;
  }, [send, C]);

  const client = data?.client || null;
  const monthLabel = monthName(month);
  const openItem = postId ? items.find(p => p.id === postId) : null;
  const today = todayKey();
  const shift = useCallback((by) => setMonth(m => shiftMonth(m, by)), []);

  if (state === 'dead') {
    return (
      <div className="pl lay-root" data-chrome="focused">
        <main className="pl-main">
          <div className="pl-dead pl-screen">
            <h1 className="pl-h1">{C.dead.title}</h1>
            <p className="pl-lead">{C.dead.body} <a href={`mailto:${C.dead.email}`}>{C.dead.email}</a></p>
          </div>
        </main>
        <style>{tokenStyles + plannerStyles + screenStyles}</style>
      </div>
    );
  }

  /* What the top bar says on a focused screen. */
  const focusTitle = reviewing ? C.review.title : openItem ? (openItem.kind === 'ad' ? (openItem.ad?.name || C.kinds.ad) : C.kinds.post) : C.heading;
  const ready = state === 'ready' && data;

  return (
    <div className="pl lay-root" data-chrome={focused ? 'focused' : 'tabs'} data-bar={focused && ready ? '1' : undefined}>
      <TopBar client={client} month={monthLabel} focused={focused} title={focusTitle} onBack={back} portal={portal}
        right={reviewing && ready && pos ? <span className="pl-top-count" aria-live="polite">{C.review.of(pos.i, pos.n)}</span> : null} />
      <main className="pl-main" id="pl-main">
        {state === 'loading' && <Skeleton kind={reviewing ? 'review' : tab === 'home' ? 'home' : tab === 'plan' ? 'grid' : 'list'} />}
        {state === 'error' && <ErrorBox onRetry={() => load(month)} />}
        {ready && reviewing && <ReviewScreen key="review" items={items} client={client} decide={decide} onDone={back} onPos={setPos} />}
        {ready && !reviewing && postId && (
          openItem
            ? <PostPage key={postId} item={openItem} client={client} today={today} decide={decide} toast={setToast} />
            : <div className="pl-screen"><ErrorBox title={C.toast.stale} body={C.empty.planMonth.body} onRetry={back} /></div>
        )}
        {ready && !focused && (
          <div className="pl-screen" key={tab}>
            {tab === 'home' && <HomeScreen data={data} items={items} month={month} today={today} onReview={openReview} onOpen={openPost} onDay={openDay} onTab={pickTab} />}
            {tab === 'plan' && <PlanScreen items={items} month={month} today={today} day={params.get('day') || ''} onShift={shift} onOpen={openPost} />}
            {tab === 'ads' && <AdsScreen items={items} month={month} onShift={shift} onOpen={openPost} />}
            {tab === 'ideas' && <IdeasScreen suggestions={data.suggestions || []} onSend={suggest} />}
          </div>
        )}
      </main>
      <TabBar tab={tab} onPick={pickTab} needs={queue.length} hidden={focused || !ready} />
      <Toast text={toast} />
      <style>{tokenStyles + plannerStyles + screenStyles + reviewStyles}</style>
    </div>
  );
}
