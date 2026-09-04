import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '../ui';
import { ShellCtx } from './ShellContext';
import Sidebar, { sidebarStyles } from './Sidebar';
import TopBar, { topBarStyles } from './TopBar';
import TabBar, { tabBarStyles } from './TabBar';
import MoreSheet, { moreSheetStyles } from './MoreSheet';
import CommandBar, { commandBarStyles } from './CommandBar';
import NotificationsDrawer, { notificationsStyles } from './NotificationsDrawer';
import { quickAddStyles } from './QuickAdd';
import { navById } from './nav';
import { buildNotifications } from './notifications';
import { KEYS, readJSON, writeJSON } from './storage';
import { apiFetch } from '../shared/api';
import { buildEvents } from '../lib/events';

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
  activeNavId, counts, countsLoading, leads, leadsLoading, onRefetchLeads, hasDetail,
  onGo, onOpenLead, onNewLead, onNewClient, onLogout, onPatchLead, projects = [], styles, children,
}) {
  const [collapsedPref, setCollapsed] = useState(() => readJSON(KEYS.collapsed, false));
  // 768 to 1023px: the rail only. A 240px sidebar next to the 324px list panel
  // leaves no room for a detail view, so the toggle is hidden and the
  // preference resumes at 1024px and up.
  const narrowDesktop = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const collapsed = collapsedPref || narrowDesktop;
  const [moreOpen, setMoreOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [topBar, setTopBarState] = useState(null);
  // Read state, snoozes and Calendly events (Prompt 9). Server first, localStorage as the offline fallback.
  const [notifDoc, setNotifDoc] = useState(() => ({ readIds: readJSON(KEYS.notifRead, []), lastSeenAt: null, snoozedUntil: {}, reminders: { meetings: true, callbacks: true } }));
  const [calendly, setCalendly] = useState({ configured: null, events: [] });
  useEffect(() => {
    apiFetch('/api/admin/settings').then(r => { if (r.ok && r.data?.notifications) setNotifDoc(r.data.notifications); });
    const from = new Date(Date.now() - 7 * 864e5).toISOString(); const to = new Date(Date.now() + 30 * 864e5).toISOString();
    apiFetch(`/api/admin/calendly/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then(r => { if (r.ok && r.data) setCalendly({ configured: !!r.data.configured, events: r.data.events || [] }); });
  }, []);
  const readIds = useMemo(() => new Set(notifDoc.readIds || []), [notifDoc.readIds]);
  const saveNotif = useCallback((patch) => { setNotifDoc(d => ({ ...d, ...patch })); if (patch.readIds) writeJSON(KEYS.notifRead, patch.readIds); apiFetch('/api/admin/settings', { method: 'PATCH', body: { set: { notifications: patch } } }); }, []);

  const toggleCollapsed = () => setCollapsed(c => { writeJSON(KEYS.collapsed, !c); return !c; });
  const setTopBar = useCallback((v) => setTopBarState(v), []);

  const notifications = useMemo(() => buildNotifications(leads || [], { calendly: calendly.events, projects, lastSeenAt: notifDoc.lastSeenAt, snoozedUntil: notifDoc.snoozedUntil }), [leads, calendly.events, projects, notifDoc.lastSeenAt, notifDoc.snoozedUntil]);
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

  const go = useCallback((navId, preset) => { setMoreOpen(false); setNotifOpen(false); onGo(navId, preset); }, [onGo]);
  const openLead = useCallback((lead) => { setNotifOpen(false); onOpenLead(lead); }, [onOpenLead]);

  const ctx = useMemo(() => ({
    go, openRecord: openLead, openCommand: () => setCmdOpen(true), openNotifications: () => setNotifOpen(true),
    newLead: onNewLead, newClient: onNewClient, setTopBar, events, calendly, projects,
  }), [go, openLead, onNewLead, onNewClient, setTopBar, events, calendly, projects]);

  const nav = navById(activeNavId) || navById('dashboard');
  const title = topBar?.title ?? nav.label;
  const menuItems = [
    { id: 'settings', label: 'Settings', icon: 'Settings01', onSelect: () => go('settings') },
    { id: 'design', label: 'Design system', icon: 'Palette', onSelect: () => go('design') },
    'divider',
    { id: 'logout', label: 'Sign out', icon: 'LogOut01', danger: true, onSelect: onLogout },
  ];
  const quickAdd = [
    { id: 'lead', label: 'New lead', icon: 'Users01', onSelect: () => onNewLead({}) },
    { id: 'call', label: 'Log a call', icon: 'PhoneCall01', onSelect: () => go('calls') },
    { id: 'client', label: 'New client', icon: 'Briefcase01', onSelect: () => onNewClient() },
  ];

  return (
    <ShellCtx.Provider value={ctx}>
      <div className={`sh-root lay-root${collapsed ? ' is-collapsed' : ''}`}>
        <Sidebar collapsed={collapsed} canToggle={!narrowDesktop} onToggle={toggleCollapsed} activeId={activeNavId} counts={counts} countsLoading={countsLoading} onGo={go} menuItems={menuItems} />
        <div className="sh-col">
          <TopBar title={title} onBack={topBar?.back || null}
            commandBar={<CommandBar open={cmdOpen} onOpenChange={setCmdOpen} leads={leads || []} leadsLoading={leadsLoading} onRefetch={onRefetchLeads} onOpenLead={openLead} onJump={(n) => go(n.id)} onNewLead={onNewLead} />}
            onOpenCommand={() => setCmdOpen(true)} notifCount={todayUnread} notifLoading={countsLoading} onOpenNotifications={() => setNotifOpen(true)} quickAdd={quickAdd} menuItems={menuItems} />
          <div className={`aa-app sh-content${hasDetail ? ' has-detail' : ''}`}>{children}</div>
          <TabBar activeId={activeNavId} counts={counts} countsLoading={countsLoading} onGo={go} onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
        </div>
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} activeId={activeNavId} counts={counts} onGo={go} onLogout={onLogout} />
        <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} items={notifications} loading={leadsLoading} readIds={readIds}
          onOpenItem={(item) => { markRead([item.id]); if (item.lead) openLead(item.lead); else if (item.event?.link) window.open(item.event.link, '_blank', 'noopener'); else go('calendar'); }}
          onMarkAllRead={() => markRead(notifications.map(n => n.id))} onSnooze={snooze} onDone={(item) => markRead([item.id])} onGoCalls={() => go('calls')} />
        <style>{styles}</style>
      </div>
    </ShellCtx.Provider>
  );
}

export const shellStyles = `
  .sh-root { height: 100vh; height: 100dvh; display: flex; background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); overflow: hidden; }
  .sh-col { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  @media (min-width: 768px) { .sh-col { --v-gutter-l: var(--v-gutter); --lay-gutter-l: var(--v-gutter); } }
  .sh-content { flex: 1; min-height: 0; min-width: 0; display: flex; }
${sidebarStyles}${topBarStyles}${tabBarStyles}${moreSheetStyles}${commandBarStyles}${notificationsStyles}${quickAddStyles}
`;
