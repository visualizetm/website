import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { uiStyles, ToastProvider, PageHeader, IconButton, Icon, useToast, useOnline } from '../ui';
import TabBar, { tabBarStyles } from '../shell/TabBar';
import { topBarStyles } from '../shell/TopBar';
import { shellFrameStyles } from '../shell/frame.styles';
import { useEdgeBack, edgeBackStyles } from '../shell/useEdgeBack';
import BootFrame from '../shell/BootFrame';
import { useAppearance, applyAppearance } from '../shell/appearance';
import { roomParentOf, roomChromeOf, roomTabOf, ROOM_SECTIONS } from '../shell/backTree';
import { ROOM_BASE } from '../lib/adminPaths';
import { COPY } from '../shared/copy';
import { callStepperStyles } from '../components/calls/CallStepper';
import { objectionStyles } from '../components/calls/ObjectionSheet';
import { outcomeSheetStyles } from '../components/OutcomeSheet';
import { declineStyles } from '../components/DeclineSheet';
import { roomApi, roomStore } from './roomApi';
import { callbacksCount, triagePile, newSession, sessionNext, startQueue } from './roomLib';
import { roomStyles } from './room.styles';
import SignIn from './SignIn';
import Hub from './Hub';
import LeadCard from './LeadCard';
import CallRoom from './CallRoom';
import Booking, { Booked } from './Booking';
import Callbacks from './Callbacks';
import Summary from './Summary';
import Me from './Me';

/* Billy's Call Room (part 1 of 2): its own app at /room on the admin host, its own lazy chunk, its own cookie (vz_caller).
 *
 * The frame is the admin shell's (src/shell/frame.styles.js, the same top bar and glass tab bar classes), so the audits read
 * one contract, but nothing of the admin mounts here and nothing here asks an admin endpoint. Chrome modes follow
 * docs/MOBILE-UI-GUIDE.md through the room's own small tree (src/shell/backTree.js): Calls, Callbacks and Me are section
 * roots with the tab bar; the lead card, the booking and the summary are focused; the call room hides the tab bar.
 * The top bar is Back, the title and only the actions a screen declares (useRoomBar).
 *
 * One read feeds every screen (GET /api/caller/home: leads through the server's whitelist, lists, the booked words, today's
 * counts). A write answers the changed lead or list and the room patches what it holds, then reads home again quietly.
 * Sign out clears the cookie and everything the room keeps in memory and on the device. Part 2 adds a Quotes tab between
 * Callbacks and Me (ROOM_TABS) and an Earned segment on Me. */
export const ROOM_TABS = [
  { id: 'calls', label: 'Calls', icon: 'PhoneCall01' },
  { id: 'callbacks', label: 'Callbacks', icon: 'ClockRewind', badge: 'callbacks' },
  { id: 'me', label: 'Me', icon: 'User01' },
];
const TAB_PATH = { calls: '/', callbacks: '/callbacks', me: '/me' };

const RoomCtx = createContext(null);
export const useRoom = () => useContext(RoomCtx);
/** A screen names its title and the actions its top bar shows: useRoomBar('Kims Cafe', [{ id, label, icon, onClick }]). */
export function useRoomBar(title, actions = null) {
  const room = useRoom();
  const key = `${title || ''}|${(actions || []).map(a => `${a.id}:${a.disabled ? 0 : 1}`).join(',')}`;
  const ref = useRef(actions); ref.current = actions;
  useEffect(() => { room?.setBar({ title: title || '', actions: ref.current }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function RoomApp() {
  const [authed, setAuthed] = useState(null); // null while the session answers
  useEffect(() => { applyAppearance(); let alive = true; roomApi.session().then(r => { if (alive) setAuthed(r.ok === true); }); return () => { alive = false; }; }, []);
  if (authed === null) return <BootFrame />;
  if (!authed) return <SignIn onSignedIn={() => setAuthed(true)} />;
  return <ToastProvider><Room onSignedOut={() => setAuthed(false)} /></ToastProvider>;
}

function Room({ onSignedOut }) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const appearance = useAppearance();
  const rel = location.pathname.slice(ROOM_BASE.length) || '/';
  const chrome = roomChromeOf(rel);
  const focused = chrome === 'focused';
  const tab = roomTabOf(rel);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bar, setBar] = useState({ title: '', actions: null });
  const [session, setSessionState] = useState(() => roomStore.get('session'));
  const setSession = useCallback((next) => { setSessionState(prev => { const v = typeof next === 'function' ? next(prev) : next; roomStore.set('session', v); return v; }); }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setError(false); }
    const r = await roomApi.home();
    if (r.status === 401) { roomStore.clear(); onSignedOut(); return false; }
    if (!r.ok) { if (!quiet) { setError(true); setLoading(false); } return false; }
    setData(r.data); setError(false); setLoading(false);
    return true;
  }, [onSignedOut]);
  useEffect(() => { load(); }, [load]);

  const go = useCallback((to, { replace = false } = {}) => navigate(`${ROOM_BASE}${to === '/' ? '' : to.startsWith('/?') ? to.slice(1) : to}`, { replace, state: replace ? null : { rm: true } }), [navigate]);
  /* Back goes up one level in the room's tree: the entry it came from when the room pushed it, else its parent (a deep link, a reload). */
  const parent = roomParentOf(rel, location.search);
  const back = useCallback(() => { if (location.state?.rm && window.history.length > 1) navigate(-1); else navigate(`${ROOM_BASE}${parent === '/' || !parent ? '' : parent}`, { replace: true }); }, [location.state, navigate, parent]);

  /* The phone's edge swipe is the same Back, on a focused screen only (a root has none). The room keeps no copy of the screen beneath, so the ground shows. */
  useEdgeBack({ enabled: focused, onBack: back, idx: 0, locKey: location.key });

  /* What a write hands back is patched in place, then home is read again without a skeleton. */
  const applyLead = useCallback((id, lead) => setData(d => (d ? { ...d, leads: lead ? (d.leads.some(l => l.id === id) ? d.leads.map(l => (l.id === id ? lead : l)) : [lead, ...d.leads]) : d.leads.filter(l => l.id !== id) } : d)), []);
  const applyList = useCallback((list) => { if (list) setData(d => (d ? { ...d, lists: d.lists.some(l => l.id === list.id) ? d.lists.map(l => (l.id === list.id ? { ...l, ...list, leadIds: list.leadIds } : l)) : [list, ...d.lists] } : d)); }, []);
  const write = useCallback(async (fn, body) => {
    const r = await fn(body);
    if (r.status === 401) { roomStore.clear(); onSignedOut(); return r; }
    if (!r.ok && r.status !== 409 && r.status !== 403 && r.status !== 404 && r.status !== 400) toast.error(r.offline ? COPY.error.saveOffline : COPY.room.saveFailed);
    if (r.ok) load(true);
    return r;
  }, [load, onSignedOut, toast]);

  const signOut = useCallback(async () => { await roomApi.logout(); roomStore.clear(); setData(null); setSessionState(null); onSignedOut(); }, [onSignedOut]);

  /* Start calling: the callbacks due now first, then the list. */
  const startCalling = useCallback((list) => {
    const ids = startQueue(list, data?.leads || []);
    if (!ids.length) { toast.info('Nobody to call on that list yet.'); return; }
    const s = newSession({ list, ids });
    setSession(s);
    go(`/lead/${encodeURIComponent(sessionNext(s))}`);
  }, [data, go, setSession, toast]);

  /* The audits' forced loading state (?loading=1), as in the admin: nothing has loaded yet. */
  const forced = new URLSearchParams(location.search).get('loading') === '1';
  const caller = useMemo(() => ({ name: data?.me?.name || 'Billy', owner: false }), [data]);
  const ctx = useMemo(() => ({
    me: data?.me || { name: 'Billy', moveOffRobLists: true }, caller, leads: data?.leads || [], lists: data?.lists || [], booked: data?.booked || [], today: data?.today || { calls: 0, talked: 0, booked: 0 },
    loading: loading || forced, error, reload: load, go, back, rel, search: location.search, session, setSession, applyLead, applyList, write, signOut, startCalling, setBar,
  }), [data, caller, loading, forced, error, load, go, back, rel, location.search, session, setSession, applyLead, applyList, write, signOut, startCalling]);

  const counts = { callbacks: callbacksCount(ctx.leads), triage: triagePile(ctx.leads).length };
  const screen = (() => {
    let m;
    if ((m = rel.match(/^\/lead\/([^/]+)$/))) return <LeadCard key={m[1]} id={decodeURIComponent(m[1])} />;
    if ((m = rel.match(/^\/call\/([^/]+)$/))) return <CallRoom key={m[1]} id={decodeURIComponent(m[1])} />;
    if ((m = rel.match(/^\/book\/([^/]+)$/))) return <Booking key={m[1]} id={decodeURIComponent(m[1])} />;
    if (rel === '/booked') return <Booked />;
    if (rel === '/summary') return <Summary />;
    if (rel === '/callbacks') return <Callbacks />;
    if (rel === '/me') return <Me />;
    const q = new URLSearchParams(location.search).get('section');
    return <Hub section={ROOM_SECTIONS.includes(q) ? q : 'today'} />;
  })();
  const fallbackTitle = { calls: 'Calls', callbacks: 'Callbacks', me: 'Me' }[tab];

  return (
    <RoomCtx.Provider value={ctx}>
      <div className={`sh-root lay-root rm-root${focused ? ' is-focused' : ''}`} data-chrome={chrome} data-room={rel.split('/')[1] || 'calls'} data-v-theme={appearance.theme} data-v-motion={appearance.reduce || appearance.reduceOS ? 'reduce' : undefined}>
        <div className="sh-col">
          <header className={`sh-top${focused ? ' is-focused' : ''}`}>
            <div className="sh-top-left" key={focused ? 'left-f' : 'left-t'}><PageHeader title={bar.title || fallbackTitle} onBack={focused ? back : undefined} /></div>
            <div className="sh-top-right" key={focused ? 'right-f' : 'right-t'}>
              {(bar.actions || []).map(a => <IconButton key={a.id} icon={a.icon} label={a.label} onClick={a.onClick} disabled={a.disabled} tooltip={false} className="sh-top-action" />)}
            </div>
          </header>
          <div className={`sh-offline${online ? ' is-hidden' : ''}`} role="status" aria-live="polite">{!online && <><Icon icon="WifiOff" size="var(--v-icon-sm)" /><span>{COPY.offline.banner}</span></>}</div>
          <main key={rel} className="sh-content lay-view rm-content" aria-label={bar.title || fallbackTitle}>{screen}</main>
          <TabBar tabs={ROOM_TABS} more={false} activeId={tab} counts={counts} countsLoading={(loading && !data) || forced} onGo={(id) => go(TAB_PATH[id] || '/')} hidden={focused} />
        </div>
        <style>{uiStyles + shellFrameStyles + edgeBackStyles + topBarStyles + tabBarStyles + callStepperStyles + objectionStyles + outcomeSheetStyles + declineStyles + roomStyles}</style>
      </div>
    </RoomCtx.Provider>
  );
}
