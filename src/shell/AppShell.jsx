import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '../ui';
import { ShellCtx } from './ShellContext';
import Sidebar, { sidebarStyles } from './Sidebar';
import TopBar, { topBarStyles } from './TopBar';
import { useBack, navHistoryStyles } from './nav-history';
import { useLocation } from 'react-router-dom';
import { chromeOf, CHROME } from './chrome';
import { useEdgeBack, edgeBackStyles } from './useEdgeBack';
import TabBar, { tabBarStyles } from './TabBar';
import ShortcutsSheet, { shortcutsSheetStyles } from './ShortcutsSheet';
import CommandBar, { commandBarStyles } from './CommandBar';
import NotificationsDrawer, { notificationsStyles } from './NotificationsDrawer';
import { quickAddStyles } from './QuickAdd';
import { navById } from './nav';
import { buildNotifications } from './notifications';
import { KEYS, readJSON, writeJSON } from './storage';
import { apiFetch } from '../shared/api';
import { buildEvents } from '../lib/events';
import { useAppearance, setThemeMode, setReduceMotion, THEME_MODES } from './appearance';
import { useToast, useOnline, Icon } from '../ui';
import { COPY } from '../shared/copy';

/**
 * AppShell: sidebar (desktop), top bar, content, tab bar (mobile), plus the
 * command bar, notifications drawer, More sheet, and quick add.
 *
 * Props
 *  activeNavId     nav.js id for the current path
 *  counts          { leads, calls, booked, orders, submissions } for badges
 *  countsLoading   true while the counts' source is loading (skeleton badges)
 *  leads           call_leads list (command bar + notifications)
 *  leadsLoading    true while it loads
 *  onRefetchLeads  async refetch used by the command bar when memory has no match
 *  hasDetail       a detail view is open (mobile shows main instead of panel)
 *  onGo(navId, preset)  navigate to a nav entry; preset is an optional filter/builder preset the screen applies
 *  onOpenLead(lead) open a record in the right screen
 *  onNewLead(preset), onNewClient(), onLogout()
 *  styles          the stylesheet string to inject once
 */
export default function AppShell({
  activeNavId, counts, countsLoading, funnel, leads, leadsLoading, leadsError, onRetryLeads, onRefetchLeads, hasDetail,
  onGo, onOpenLead, onOpenShowcase, onOpenPlanner, onOpenTasks, onOpenProjectNew, onOpenListFill, onNewLead, onNewClient, onNewOrder, onCapture, onLogout, projectOps = null, leadOps = null, onPatchLead, projects = [], posts = [], sets = [], lists = [], onOpenConcepts, onOpenListPicker, listOps = null, docsApi = null, styles, children,
}) {
  const [keysOpen, setKeysOpen] = useState(false);
  const [collapsedPref, setCollapsed] = useState(() => readJSON(KEYS.collapsed, false));
  // 768 to 1023px: the rail only. A 240px sidebar next to the 324px list panel
  // leaves no room for a detail view, so the toggle is hidden and the
  // preference resumes at 1024px and up.
  const narrowDesktop = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const collapsed = collapsedPref || narrowDesktop;
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [topBar, setTopBarState] = useState(null);
  /* Back (done once): the top bar's Back comes from the history entry; a screen's own back (a draft's leave guard) takes precedence. */
  const navBack = useBack();
  // Read state, snoozes and Calendly events (Prompt 9). Server first, localStorage as the offline fallback.
  const [notifDoc, setNotifDoc] = useState(() => ({ readIds: readJSON(KEYS.notifRead, []), lastSeenAt: null, snoozedUntil: {}, reminders: { meetings: true, callbacks: true } }));
  const [calendly, setCalendly] = useState({ configured: null, events: [] });
  const [health, setHealth] = useState(null);
  const [emails, setEmails] = useState(null); // CRM revamp, step 6: which email hooks are connected (booleans from the settings GET)
  const [profile, setProfile] = useState(null);
  const appearance = useAppearance();
  const toast = useToast();
  // The profile document is the source of truth for the theme and the motion
  // switch; localStorage mirrors it for the pre-paint script. Saving writes both.
  const saveAppearance = useCallback(async (patch) => {
    const before = { theme: appearance.mode, reduceMotion: appearance.reduce };
    if (patch.theme) setThemeMode(patch.theme);
    if ('reduceMotion' in patch) setReduceMotion(!!patch.reduceMotion);
    setProfile(p => ({ ...(p || {}), ...patch }));
    const r = await apiFetch('/api/admin/settings', { method: 'PATCH', body: { set: { profile: patch } } });
    if (!r.ok) { if (patch.theme) setThemeMode(before.theme); if ('reduceMotion' in patch) setReduceMotion(before.reduceMotion); setProfile(p => ({ ...(p || {}), ...before })); toast.error(COPY.error.save); }
    return r.ok;
  }, [toast, appearance.mode, appearance.reduce]);
  // The first settings read compares the document with whatever the appearance is by the time it answers, so it reads a ref, not the render's value.
  const appearanceRef = useRef(appearance); appearanceRef.current = appearance;
  useEffect(() => {
    apiFetch('/api/admin/settings').then(r => {
      if (r.ok && r.data?.notifications) setNotifDoc(r.data.notifications);
      if (r.ok && r.data) {
        setHealth(r.data.health || null); setProfile(r.data.profile || null); setEmails(r.data.emails || null);
        // Another device may have changed the appearance; the document wins over the local mirror.
        const p = r.data.profile || {};
        const cur = appearanceRef.current;
        if (p.theme && p.theme !== cur.mode) setThemeMode(p.theme);
        if (typeof p.reduceMotion === 'boolean' && p.reduceMotion !== cur.reduce) setReduceMotion(p.reduceMotion);
      }
    });
    const from = new Date(Date.now() - 7 * 864e5).toISOString(); const to = new Date(Date.now() + 30 * 864e5).toISOString();
    apiFetch(`/api/admin/calendly/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then(r => { if (r.ok && r.data) setCalendly({ configured: !!r.data.configured, events: r.data.events || [] }); });
  }, []);
  const readIds = useMemo(() => new Set(notifDoc.readIds || []), [notifDoc.readIds]);
  const saveNotif = useCallback(async (patch) => {
    let prev; setNotifDoc(d => { prev = d; return { ...d, ...patch }; });
    if (patch.readIds) writeJSON(KEYS.notifRead, patch.readIds);
    const r = await apiFetch('/api/admin/settings', { method: 'PATCH', body: { set: { notifications: patch } } });
    if (!r.ok) { if (prev) { setNotifDoc(prev); if (patch.readIds) writeJSON(KEYS.notifRead, prev.readIds || []); } toast.error(COPY.error.save); }
    return r.ok;
  }, [toast]);
  // Offline (Prompt 14): one banner under the top bar, one toast per refused write.
  const online = useOnline();
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) { wasOffline.current = false; toast.info(COPY.offline.back); }
  }, [online, toast]);
  useEffect(() => {
    let last = 0;
    const onRefused = () => { const now = Date.now(); if (now - last > 2500) { last = now; toast.error(COPY.offline.toast); } };
    window.addEventListener('vz:offline-write', onRefused);
    return () => window.removeEventListener('vz:offline-write', onRefused);
  }, [toast]);

  const toggleCollapsed = () => setCollapsed(c => { writeJSON(KEYS.collapsed, !c); return !c; });
  const setTopBar = useCallback((v) => setTopBarState(v), []);

  const notifications = useMemo(() => buildNotifications(leads || [], { calendly: calendly.events, projects, posts, sets, health, lastSeenAt: notifDoc.lastSeenAt, snoozedUntil: notifDoc.snoozedUntil }), [leads, calendly.events, projects, posts, sets, health, notifDoc.lastSeenAt, notifDoc.snoozedUntil]);
  const events = useMemo(() => buildEvents(leads || [], calendly.events, Date.now(), projects), [leads, calendly.events, projects]);
  const todayUnread = notifications.filter(n => (n.group === 'today' || n.group === 'overdue') && !readIds.has(n.id)).length;
  const markRead = (ids) => { const next = [...new Set([...(notifDoc.readIds || []), ...ids])].slice(-500); saveNotif({ readIds: next, lastSeenAt: new Date().toISOString() }); };
  const snoozeUntil = (kind) => { const d = new Date(); if (kind === '1h') d.setTime(d.getTime() + 3600e3); else if (kind === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); } else { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); } return d; };
  const snooze = (item, kind) => {
    const until = snoozeUntil(kind);
    if (item.kind === 'callback' && item.lead && onPatchLead) { onPatchLead(item.lead._id, { callbackAt: until.toISOString() }); }
    else saveNotif({ snoozedUntil: { ...(notifDoc.snoozedUntil || {}), [item.id]: until.toISOString() } });
  };

  // "/" or Cmd/Ctrl+K opens the command bar unless focus is in a field.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const inField = t && (t.closest?.('input, textarea, select, [contenteditable="true"]'));
      if (inField) return;
      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = useCallback((navId, preset) => { setNotifOpen(false); onGo(navId, preset); }, [onGo]);
  const openLead = useCallback((lead, intent) => { setNotifOpen(false); onOpenLead(lead, intent); }, [onOpenLead]);

  const ctx = useMemo(() => ({
    go, openRecord: openLead, openShowcase: onOpenShowcase, openPlanner: onOpenPlanner, openTasks: onOpenTasks, openCommand: () => setCmdOpen(true), openNotifications: () => setNotifOpen(true),
    newLead: onNewLead, newClient: onNewClient, newOrder: onNewOrder, capture: onCapture, projectOps, leadOps, emails, refreshLeads: leadOps?.reload || onRefetchLeads, setTopBar, events, calendly, projects, posts, sets, health, profile, setProfile, appearance, saveAppearance,
    openConcepts: onOpenConcepts, openProjectNew: onOpenProjectNew, openListFill: onOpenListFill,
    lists, openListPicker: onOpenListPicker, listOps, docsApi,
  }), [docsApi, go, openLead, onOpenShowcase, onOpenPlanner, onOpenTasks, onOpenConcepts, onOpenProjectNew, onOpenListFill, onOpenListPicker, listOps, lists, onNewLead, onNewClient, onNewOrder, onCapture, projectOps, leadOps, emails, onRefetchLeads, setTopBar, events, calendly, projects, posts, sets, health, profile, appearance, saveAppearance]);

  /* Chrome mode (src/shell/chrome.js): tabs on a section root, focused on a record, an editor, a setup page or the call room. */
  const location = useLocation();
  const chrome = chromeOf(location);
  const focused = chrome === CHROME.FOCUSED;
  const backFn = topBar?.back || navBack?.back || null;
  useEdgeBack({ enabled: !!backFn, onBack: backFn, idx: location.state?.idx || 0, locKey: location.key });
  const nav = navById(activeNavId) || navById('dashboard');
  const title = topBar?.title ?? nav.label;
  // Theme in the account menu: one item that steps Dark, Light, System (the full picker is in Settings Profile).
  const nextMode = { dark: 'light', light: 'system', system: 'dark' }[appearance.mode] || 'dark';
  const modeLabel = (m) => THEME_MODES.find(x => x.id === m)?.label || m;
  const menuItems = [
    { id: 'settings', label: 'Settings', icon: 'Settings01', onSelect: () => go('settings') },
    { id: 'design', label: 'Design system', icon: 'Palette', onSelect: () => go('design') },
    { id: 'keys', label: 'Keyboard shortcuts', icon: 'Keyboard01', onSelect: () => setKeysOpen(true) },
    { id: 'theme', label: `Theme: ${modeLabel(appearance.mode)}, switch to ${modeLabel(nextMode).toLowerCase()}`, icon: appearance.theme === 'light' ? 'Sun' : appearance.mode === 'system' ? 'Monitor01' : 'Moon01', onSelect: () => saveAppearance({ theme: nextMode }) },
    'divider',
    { id: 'logout', label: 'Sign out', icon: 'LogOut01', danger: true, onSelect: onLogout },
  ];
  const quickAdd = [
    { id: 'lead', label: 'New lead', icon: 'Users01', onSelect: () => onNewLead({}) },
    ...(onCapture ? [{ id: 'capture', label: 'Capture a lead', icon: 'Zap', onSelect: () => onCapture() }] : []),
    { id: 'call', label: 'Log a call', icon: 'PhoneCall01', onSelect: () => go('calls') },
    { id: 'client', label: 'New client', icon: 'Briefcase01', onSelect: () => onNewClient() },
    { id: 'order', label: 'New order', icon: 'Package', onSelect: () => onNewOrder?.() },
    ...(docsApi?.pickClient ? [{ id: 'doc', label: 'New doc', icon: 'File02', onSelect: () => docsApi.pickClient() }] : []),
  ];

  return (
    <ShellCtx.Provider value={ctx}>
      <div className={`sh-root lay-root${collapsed ? ' is-collapsed' : ''}${focused ? ' is-focused' : ''}`} data-chrome={chrome} data-v-theme={appearance.theme} data-v-motion={appearance.reduce || appearance.reduceOS ? 'reduce' : undefined}>
        <Sidebar collapsed={collapsed} canToggle={!narrowDesktop} onToggle={toggleCollapsed} activeId={activeNavId} counts={counts} countsLoading={countsLoading} funnel={funnel} onGo={go} menuItems={menuItems} />
        <div className="sh-col">
          <TopBar title={title} onBack={topBar?.back || navBack?.back || null} focused={focused} actions={topBar?.actions || null}
            commandBar={<CommandBar open={cmdOpen} onOpenChange={setCmdOpen} leads={leads || []} leadsLoading={leadsLoading} onRefetch={onRefetchLeads} onOpenLead={openLead} onOpenShowcase={onOpenShowcase} onOpenPlanner={onOpenPlanner} onJump={(n) => go(n.id)} onNewLead={onNewLead}  onAddToList={onOpenListPicker ? (lead) => onOpenListPicker([lead]) : undefined} docs={docsApi?.docs} onOpenDoc={docsApi?.openDoc} />}
            onOpenCommand={() => setCmdOpen(true)} notifCount={todayUnread} notifLoading={countsLoading} onOpenNotifications={() => setNotifOpen(true)} quickAdd={quickAdd} menuItems={menuItems} />
          {/* One polite region for the connection state; it stays in the tree so the change is announced (Prompt 15). */}
          <div className={`sh-offline${online ? ' is-hidden' : ''}`} role="status" aria-live="polite">{!online && <><Icon icon="WifiOff" size="var(--v-icon-sm)" /><span>{COPY.offline.banner}</span></>}</div>
          <main key={activeNavId} className={`aa-app sh-content lay-view${hasDetail ? ' has-detail' : ''}`} aria-label={title || undefined}>{children}</main>
          <TabBar activeId={activeNavId} counts={counts} countsLoading={countsLoading} onGo={go} onMore={() => go('more')} hidden={focused} />
        </div>
        <ShortcutsSheet open={keysOpen} onClose={() => setKeysOpen(false)} />
        <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} items={notifications} loading={leadsLoading} error={leadsError} onRetry={onRetryLeads} readIds={readIds}
          /* A planner item wants the client's planner editor, which arrives in
             prompt 2. Until onOpenPlanner is passed in, it opens the client
             record, which is where that editor will live. */
          onOpenItem={(item) => { markRead([item.id]); if (item.openNext && item.lead) openLead(item.lead, item.intent); else if (item.openConcepts && item.lead && onOpenConcepts) onOpenConcepts(item.lead, item.setId); else if (item.openPlanner && item.lead && onOpenPlanner) onOpenPlanner(item.lead); else if (item.lead) openLead(item.lead); else if (item.event?.link) window.open(item.event.link, '_blank', 'noopener'); else go('calendar'); }}
          onMarkAllRead={() => markRead(notifications.map(n => n.id))} onSnooze={snooze} onDone={(item) => markRead([item.id])} onGoCalls={() => go('calls')} />
        <style>{styles}</style>
      </div>
    </ShellCtx.Provider>
  );
}

export const shellStyles = `
  .sh-root { height: 100vh; height: 100dvh; display: flex; background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); overflow: hidden; }
  /* The tab bar's current height: what a bar pinned above it (SaveBar) adds, 0 while a focused screen hides the bar. */
  .sh-root { --v-tabbar-now: var(--v-tabbar-h); }
  .sh-root.is-focused { --v-tabbar-now: 0px; }
  @media (max-width: 767px) { .sh-root.is-focused .sh-content { padding-bottom: var(--v-inset-bottom); } }
  .sh-col { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  @media (min-width: 768px) { .sh-col { --v-gutter-l: var(--v-gutter); --lay-gutter-l: var(--v-gutter); } }
  .sh-content { flex: 1; min-height: 0; min-width: 0; display: flex; }
  .sh-offline.is-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); border: 0; min-height: 0; }
  .sh-offline { display: flex; align-items: center; justify-content: center; gap: var(--v-space-2); flex-shrink: 0; min-height: var(--v-space-9); padding: var(--v-space-1) var(--v-gutter-r) var(--v-space-1) var(--v-gutter-l); background: var(--v-status-new-soft); color: var(--v-status-new-text); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); border-bottom: 1px solid color-mix(in srgb, var(--v-status-new-text) 30%, transparent); animation: lay-view-in var(--v-dur-base) var(--v-ease-out) both; }
${navHistoryStyles}${edgeBackStyles}${sidebarStyles}${topBarStyles}${tabBarStyles}${shortcutsSheetStyles}${commandBarStyles}${notificationsStyles}${quickAddStyles}
`;
