import { useCallback, useEffect, useMemo, useState } from 'react';
import Key01 from '@untitled-ui/icons-react/build/esm/Key01';
import Bell01 from '@untitled-ui/icons-react/build/esm/Bell01';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import Upload01 from '@untitled-ui/icons-react/build/esm/Upload01';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import FlipBackward from '@untitled-ui/icons-react/build/esm/FlipBackward';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import LogOut01 from '@untitled-ui/icons-react/build/esm/LogOut01';
import {
  PageShell, ScrollArea, Section, Stack, Row, Grid, Card, Tabs, Pill, Avatar, Input, Button, IconButton, InlineEdit, Toggle, SegmentedControl, Table, Sheet, ListRow, EmptyState, ErrorState, IconTile, Stagger, SkeletonBlock, SkeletonText, useDelayedLoading, useMediaQuery, useToast, useConfirm, useRetry,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar, useShell } from '../shell/ShellContext';
import { SHORTCUT_GROUPS } from '../shell/shortcuts';
import { canPrompt, isStandalone, isIOS, promptInstall, onInstallChange } from '../shell/install';
import { THEME_MODES } from '../shell/appearance';
import LeadImport from '../components/LeadImport';
import OrdersImport from '../components/OrdersImport';
import LeadPicker from '../components/LeadPicker';
import { SUBMISSION_TYPES, PRINT_ORDER_STATUSES } from '../shared/semantics';
import { apiFetch } from '../shared/api';
import { money } from '../shared/format';
import { fmtDate, fmtDateTime, relativeTime } from '../shared/dates';
import { EXPORTS, downloadText } from '../lib/exports';
import { readLocalOrders, planImport, itemSummary, orderSubtotal } from '../lib/orders';

/* Settings (Prompt 12): every setting on the kit under a Tabs sub nav.
 * Profile, Notifications, Integrations, Data, Automation, Shortcuts, Danger zone. */

export const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile', icon: 'User01' }, { id: 'notifications', label: 'Notifications', icon: 'Bell01' }, { id: 'integrations', label: 'Integrations', icon: 'Link01' },
  { id: 'data', label: 'Data', icon: 'Database01' }, { id: 'automation', label: 'Automation', icon: 'RefreshCw01' }, { id: 'shortcuts', label: 'Shortcuts', icon: 'Keyboard01' }, { id: 'danger', label: 'Danger zone', icon: 'AlertTriangle' },
];
const post = (body) => apiFetch('/api/admin/settings', { method: 'POST', body });
const patch = (set) => apiFetch('/api/admin/settings', { method: 'PATCH', body: { set } });
const nextRun = (lastRunAt, minutes) => { const base = lastRunAt ? new Date(lastRunAt).getTime() : Date.now(); return new Date(base + minutes * 60e3); };
const statusPill = (ok, okLabel, badLabel, warn) => <Pill tone={ok ? 'booked' : warn ? 'new' : 'neutral'} label={ok ? okLabel : badLabel} size="sm" icon={ok ? 'CheckCircle' : warn ? 'AlertTriangle' : false} />;

function usePush() {
  const [state, setState] = useState('idle');
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setState('unsupported'); return; }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => { if (sub) setState('subscribed'); }).catch(() => {});
  }, []);
  const enable = useCallback(async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('denied'); return; }
      const key = (await apiFetch('/api/push-key')).data?.key;
      if (!key) { setState('error'); return; }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const res = await apiFetch('/api/admin/push-subscribe', { method: 'POST', body: { subscription: subscription.toJSON() } });
      setState(res.ok ? 'subscribed' : 'error');
    } catch { setState('error'); }
  }, []);
  return { state, enable };
}

/* Client error log (Prompt 15): the last 20 entries the admin posted to
 * /api/admin/log (render errors, refused writes, failed calls), newest first. */
function ClientLogCard() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await apiFetch('/api/admin/log?limit=20'); setItems(r.ok ? r.data?.items || [] : []); }, []);
  useEffect(() => { load(); }, [load]);
  const clear = async () => {
    setBusy(true);
    const r = await apiFetch('/api/admin/log', { method: 'DELETE' });
    setBusy(false);
    if (r.ok) { setItems([]); toast.success('Error log cleared.'); } else toast.error('Could not clear the log.');
  };
  const KIND = { error: 'danger', boundary: 'danger', rejection: 'danger', refused: 'new', api: 'callback' };
  return (
    <Card className="st-card st-log">
      <Row gap={2} justify="between" align="center" wrap>
        <p className="pb-card-h" style={{ margin: 0 }}>Errors on this app</p>
        <Button variant="secondary" size="md" icon={Trash01} onClick={clear} loading={busy} disabled={!items?.length} className="st-log-clear">Clear</Button>
      </Row>
      <p className="dt-muted">The last 20 of up to 500 entries the admin saved on its own: a screen that broke, a write refused offline, or a call that failed. Nothing leaves this database.</p>
      {items === null ? <Stack gap={2}>{[1, 2, 3].map(i => <ListRow.Skeleton key={i} leading={false} />)}</Stack>
        : items.length ? <Stack gap={1}>{items.map((it, i) => <div key={i} className="st-log-row"><Row gap={2} align="center" wrap><Pill tone={KIND[it.kind] || 'neutral'} label={it.kind} size="sm" icon={false} /><span className="dt-muted">{fmtDateTime(it.at)}</span>{it.url && <span className="dt-muted lay-truncate">{it.url}</span>}</Row><p className="st-log-msg">{it.message}</p></div>)}</Stack>
        : <p className="dt-muted">No errors saved. That is the goal.</p>}
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.next !== f.confirm) { toast.error('New passwords do not match.'); return; }
    setBusy(true);
    const r = await post({ action: 'password', current: f.current, next: f.next });
    setBusy(false);
    if (r.ok) { setF({ current: '', next: '', confirm: '' }); toast.success('Password changed. It takes effect on your next sign in.'); } else toast.error(r.data?.error || 'Could not change the password.');
  };
  return (
    <Card className="st-card">
      <p className="pb-card-h">Password</p>
      <p className="dt-muted">One password for the whole admin. Current sessions stay valid.</p>
      <form onSubmit={submit} className="st-form">
        <Stack gap={2}>
          <Input label="Current password" type="password" value={f.current} onChange={(e) => setF(p => ({ ...p, current: e.target.value }))} autoComplete="current-password" required />
          <Grid minColumnWidth={160} gap={2}><Input label="New password (8 or more)" type="password" value={f.next} onChange={(e) => setF(p => ({ ...p, next: e.target.value }))} autoComplete="new-password" required minLength={8} /><Input label="Confirm" type="password" value={f.confirm} onChange={(e) => setF(p => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" required /></Grid>
          <Row gap={2}><Button type="submit" icon={Key01} loading={busy} disabled={!f.current || f.next.length < 8}>Change password</Button></Row>
        </Stack>
      </form>
    </Card>
  );
}

export default function AdminSettings({ leads = [], projects = [], orders = [], submissions = [], initialTab, onCreateOrder, onLeadsImported, onDataChanged, onRestoreLeads, onLogout, loading }) {
  const shell = useShell();
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [tab, setTab] = useState(initialTab || 'profile');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  useTopBar(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(() => apiFetch('/api/admin/settings').then(r => { if (r.ok && r.data) { setData(r.data); setLoadError(false); shell?.setProfile?.(r.data.profile || null); } else setLoadError(true); }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const [retry, retrying] = useRetry(load);
  const fetching = !data && !loadError;
  const showSkel = useDelayedLoading(fetching || loading);
  const pending = (fetching || loading) && !showSkel;
  const { state: pushState, enable: enablePush } = usePush();
  const [installTick, setInstallTick] = useState(0);
  useEffect(() => onInstallChange(() => setInstallTick(t => t + 1)), []);

  /* Profile */
  const profile = data?.profile || { name: 'Rob', businessHours: { start: '09:00', end: '17:00' } };
  // Every settings write is optimistic with rollback (Prompt 14); InlineEdit and the toggles show the failure toast, success is the value itself.
  const saveProfile = async (next) => { const before = profile; const merged = { ...profile, ...next, businessHours: { ...profile.businessHours, ...(next.businessHours || {}) } }; setData(d => ({ ...d, profile: merged })); const r = await patch({ profile: next }); if (r.ok) shell?.setProfile?.(merged); else { setData(d => ({ ...d, profile: before })); toast.error(COPY.error.save); } return r.ok; };
  const saveTarget = async (v) => { const n = Math.max(1, Math.min(500, Math.round(Number(v)) || 0)); if (!n) return false; const before = data?.dashboard?.dailyCallTarget; setData(d => ({ ...d, dashboard: { ...(d?.dashboard || {}), dailyCallTarget: n } })); const r = await patch({ dailyCallTarget: n }); if (!r.ok) setData(d => ({ ...d, dashboard: { ...(d?.dashboard || {}), dailyCallTarget: before } })); return r.ok; };

  /* Notifications */
  const prefs = data?.prefs || { pushEnabled: true, emailEnabled: true };
  const savePrefs = async (next) => { const before = prefs; setData(d => ({ ...d, prefs: next })); const r = await post({ action: 'prefs', ...next }); if (!r.ok) { setData(d => ({ ...d, prefs: before })); toast.error(COPY.error.save); } };
  const reminders = data?.notifications?.reminders || { meetings: true, callbacks: true, bills: true, reviews: true };
  const saveReminders = async (next) => { const before = reminders; setData(d => ({ ...d, notifications: { ...(d?.notifications || {}), reminders: next } })); const r = await patch({ notifications: { reminders: next } }); if (!r.ok) { setData(d => ({ ...d, notifications: { ...(d?.notifications || {}), reminders: before } })); toast.error(COPY.error.save); } };
  const testPush = async () => { const r = await post({ action: 'test-push' }); if (r.ok) toast.success('Test notification sent to every subscribed device.'); else toast.error('Could not send the test.'); };
  const install = async () => { const r = await promptInstall(); if (r === 'accepted') toast.success('Installed. Open it from your home screen.'); else if (r === 'unavailable') toast.info('Use your browser menu to install.'); };

  /* Integrations */
  const health = data?.health || null;
  const stripe = data?.stripe || { configured: false, webhookConfigured: false, lastWebhookAt: null, unmatched: 0 };
  const [reconcile, setReconcile] = useState(null); // rows
  const [linkEv, setLinkEv] = useState(null);
  const openReconcile = async () => { const r = await apiFetch('/api/admin/stripe/events?stored=1&unmatched=1'); setReconcile(r.ok ? (r.data?.items || []) : []); };
  const linkEvent = async (lead) => { const ev = linkEv; setLinkEv(null); const r = await apiFetch('/api/admin/stripe/reconcile', { method: 'POST', body: { eventId: ev.id, leadId: String(lead._id) } }); if (r.ok) { toast.success(`${money(ev.amount)} added to ${lead.business}.`); setReconcile(rows => rows.filter(x => x.id !== ev.id)); setData(d => ({ ...d, stripe: { ...(d?.stripe || {}), unmatched: Math.max(0, (d?.stripe?.unmatched || 1) - 1) } })); onLeadsImported?.(); } else toast.error(r.data?.error || 'Could not link the payment.'); };

  /* Data */
  const [deleted, setDeleted] = useState(null);
  const loadDeleted = useCallback(async () => {
    const [s, l] = await Promise.all([apiFetch('/api/admin/submissions?deleted=1'), apiFetch('/api/admin/call-leads?deleted=1')]);
    setDeleted([...(s.data?.items || []).map(x => ({ ...x, _kind: 'submission' })), ...(l.data?.items || []).map(x => ({ ...x, _kind: 'lead' }))].sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0)));
  }, []);
  useEffect(() => { if (tab === 'data' || tab === 'danger') loadDeleted(); }, [tab, loadDeleted]);
  const restore = async (row) => {
    const r = row._kind === 'lead' ? await apiFetch('/api/admin/call-leads', { method: 'PATCH', body: { action: 'restore', ids: [row._id] } }) : await apiFetch('/api/admin/submissions', { method: 'PATCH', body: { action: 'restore', ids: [row._id] } });
    if (r.ok) { toast.success(`${row.business || row.name} restored.`); loadDeleted(); if (row._kind === 'lead') onRestoreLeads?.(); else onDataChanged?.(); } else toast.error(COPY.error.restore);
  };
  const purge = async () => {
    const n = (deleted || []).length;
    if (!(await confirm({ title: `Permanently purge ${n} deleted record${n === 1 ? '' : 's'}?`, body: 'This empties Recently deleted immediately. There is no undo after a purge.', danger: true, confirmLabel: 'Purge all' }))) return;
    const [a, b] = await Promise.all([post({ action: 'purge' }), apiFetch('/api/admin/call-leads?purgeDeleted=1', { method: 'DELETE' })]);
    if (a.ok && b.ok) toast.success('Recently deleted is empty.'); else toast.error('Purge did not finish. Some records are still in the bin.');
    loadDeleted();
  };
  const [leadImport, setLeadImport] = useState(false);
  const [orderImport, setOrderImport] = useState(false);
  const [devicePlan, setDevicePlan] = useState(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const runDevice = async () => { setDeviceBusy(true); let created = 0; for (const row of devicePlan) { if (row.skip) continue; if (await onCreateOrder?.(row.doc)) created++; } setDeviceBusy(false); toast.success(`${created} imported, ${devicePlan.filter(r => r.skip).length} skipped.`); setDevicePlan(null); };
  const exportOne = (ex) => { try { downloadText(ex.file(), ex.build({ leads, projects, orders })); toast.success(`${ex.label} exported.`); } catch { toast.error('Could not build the file.'); } };
  const backup = async () => { const a = document.createElement('a'); a.href = '/api/admin/backup'; a.download = ''; a.click(); setTimeout(load, 1500); };

  const tabs = SETTINGS_TABS.map(t => ({ ...t, count: t.id === 'integrations' && stripe.unmatched ? stripe.unmatched : undefined }));
  const crons = [
    { id: 'reminders', label: 'Reminders', every: 'Once a day, 13:00 UTC (9am Eastern)', what: 'One morning digest push: every callback due today or overdue, every meeting today, retainer bills due today, and review asks due, with a deep link to the Dashboard.', last: health?.crons?.reminders?.lastRunAt, next: nextRun(health?.crons?.reminders?.lastRunAt, 24 * 60), extra: health?.crons?.reminders ? `${health.crons.reminders.sent || 0} sent last run` : '' },
    { id: 'daily', label: 'Daily', every: 'Once a day, 06:00 UTC', what: 'Rolls retainer bill dates forward, extends retainer schedules, cancels retainers past their notice, and writes task health.', last: health?.crons?.daily?.lastRunAt, next: nextRun(health?.crons?.daily?.lastRunAt, 24 * 60), extra: health?.crons?.daily ? `${health.crons.daily.rolled || 0} rolled, ${health.crons.daily.cancelled || 0} cancelled` : '' },
  ];
  const cronArmed = !!(data?.cron?.configured ?? data?.reminders?.configured);
  const stale = (at) => !at || Date.now() - new Date(at).getTime() > 36 * 3600e3;

  // One skeleton per tab, shaped like that tab's cards (Prompt 14).
  const TAB_CARDS = { profile: 5, notifications: 4, integrations: 4, data: 4, automation: 3, shortcuts: SHORTCUT_GROUPS.length, danger: 3 };
  const line = (w, h = 14) => <SkeletonBlock width={w} height={h} />;
  const narrow = !desktop && !useMediaQuery('(min-width: 768px)'); // descriptions wrap to two lines under 768
  const desc = (w) => line(w, narrow ? 36 : 18);
  const PROFILE_CARDS = [
    <Card key="name" className="st-card"><Row gap={3} align="center"><SkeletonBlock width={72} height={72} radius="var(--v-radius-pill)" /><Stack gap={1} style={{ flex: 1 }}>{line(40, 16)}{line('30%', 44)}{desc('60%')}</Stack></Row></Card>,
    <Card key="target" className="st-card">{line(150, 16)}<Row gap={2} align="baseline" style={{ minHeight: narrow ? 63 : 54 }}>{line(70, 44)}{line('55%', 14)}</Row></Card>,
    <Card key="appearance" className="st-card">{line(110, 16)}{desc('90%')}<Stack gap={1}>{line(48, 16)}<SkeletonBlock height={44} radius="var(--v-radius-md)" /></Stack><Row gap={3} align="center" style={{ minHeight: narrow ? 92 : 58 }}><Stack gap={1} style={{ flex: 1 }}>{line(120, 22)}{desc('90%')}</Stack><SkeletonBlock width={46} height={26} radius="var(--v-radius-pill)" /></Row></Card>,
    <Card key="hours" className="st-card">{line(130, 16)}{desc('95%')}<Grid minColumnWidth={140} gap={2}><Stack gap={1}>{line(40, 16)}<SkeletonBlock height={56} radius="var(--v-radius-md)" /></Stack><Stack gap={1}>{line(40, 16)}<SkeletonBlock height={56} radius="var(--v-radius-md)" /></Stack></Grid></Card>,
    <Card key="password" className="st-card">{line(90, 12)}{line('80%', 14)}<Stack gap={2}>{line(120, 10)}<SkeletonBlock height={44} radius="var(--v-radius-md)" /><Grid minColumnWidth={160} gap={2}><Stack gap={1}>{line(140, 10)}<SkeletonBlock height={44} radius="var(--v-radius-md)" /></Stack><Stack gap={1}>{line(60, 10)}<SkeletonBlock height={44} radius="var(--v-radius-md)" /></Stack></Grid><Row gap={2}><SkeletonBlock width={180} height={44} radius="var(--v-radius-md)" /></Row></Stack></Card>,
  ];
  // Card heights per tab, measured against the loaded tabs at 390 (n) and 1280 (d), so the skeleton lines up.
  const TAB_HEIGHTS = {
    notifications: { n: [190, 318, 114, 150], d: [158, 302, 114, 74] },
    integrations: { n: [96, 222, 144, 276], d: [78, 126, 126, 102] },
    data: { n: [396, 272, 260, 150], d: [378, 272, 260, 150] },
    automation: { n: [260, 260, 142], d: [124, 124, 106] },
    shortcuts: { n: [218, 218, 634, 220], d: [114, 114, 270, 166] },
    danger: { n: [162, 216, 180], d: [144, 162, 162] },
  };
  const heightFor = (i) => TAB_HEIGHTS[tab]?.[narrow ? 'n' : 'd']?.[i];
  const skeletonCard = (i) => (tab === 'profile' && PROFILE_CARDS[i] ? PROFILE_CARDS[i]
    : <Card key={i} className="st-card" style={heightFor(i) ? { minHeight: heightFor(i) } : undefined}>{line(160, 12)}<SkeletonText lines={2} /><SkeletonBlock height={44} radius="var(--v-radius-md)" /></Card>);
  const body = pending ? null : showSkel ? (
    <Stack gap={3} className="st-stack" aria-busy="true">{Array.from({ length: TAB_CARDS[tab] || 3 }, (_, i) => skeletonCard(i))}</Stack>
  ) : loadError && !data ? (
    <Card><ErrorState title={COPY.error.settings.title} description={COPY.error.settings.description} onRetry={retry} retrying={retrying} /></Card>
  ) : tab === 'profile' ? (
    <Stagger className="v-stack st-stack">
      <Card className="st-card">
        <Row gap={3} align="center"><Avatar name={profile.name} size="xl" /><Stack gap={1} style={{ flex: 1, minWidth: 0 }}><span className="dt-fact-label">Name</span><InlineEdit value={profile.name} onSave={(v) => saveProfile({ name: v.trim() || 'Rob' })} label="Your name" className="st-name" /><span className="dt-muted">The greeting and the initials avatar use this.</span></Stack></Row>
      </Card>
      <Card className="st-card">
        <p className="pb-card-h">Daily call target</p>
        <Row gap={2} align="baseline"><InlineEdit value={String(data?.dashboard?.dailyCallTarget || 25)} onSave={saveTarget} type="number" inputMode="numeric" label="Daily call target" format={(v) => `${v} calls`} className="st-target" /><span className="dt-muted">The same number the Dashboard ring counts against.</span></Row>
      </Card>
      <Card className="st-card st-appearance">
        <p className="pb-card-h">Appearance</p>
        <p className="dt-muted">Saved on your profile, so every device follows. Dark is the studio look; Light is the same system on cream.</p>
        <div className="v-field"><span className="v-field-label">Theme</span><SegmentedControl label="Theme" options={THEME_MODES.map(m => ({ id: m.id, label: m.label, icon: m.id === 'light' ? 'Sun' : m.id === 'dark' ? 'Moon01' : 'Monitor01' }))} value={shell?.appearance?.mode || 'dark'} onChange={(m) => shell?.saveAppearance?.({ theme: m })} className="st-theme" /></div>
        <Toggle label="Reduce motion" description={shell?.appearance?.reduceOS ? 'Your device already asks for less motion. This keeps it off here too.' : 'Skips entrances, slides, and the skeleton shimmer. Everything still happens, just without the movement.'} checked={!!shell?.appearance?.reduce} onChange={(v) => shell?.saveAppearance?.({ reduceMotion: v })} className="st-motion" />
      </Card>
      <Card className="st-card">
        <p className="pb-card-h">Business hours</p>
        <p className="dt-muted">The Dashboard says when you are outside them and the best window reads against them.</p>
        <Grid minColumnWidth={140} gap={2}><Input label="Start" type="time" value={profile.businessHours?.start || '09:00'} onChange={(e) => saveProfile({ businessHours: { start: e.target.value } })} /><Input label="End" type="time" value={profile.businessHours?.end || '17:00'} onChange={(e) => saveProfile({ businessHours: { end: e.target.value } })} /></Grid>
      </Card>
      <PasswordCard />
    </Stagger>
  ) : tab === 'notifications' ? (
    <Stagger className="v-stack st-stack">
      <Card className="st-card"><p className="pb-card-h">Alerts</p><Stack gap={0}><Toggle label="Push notifications" description="New submissions and orders, to every device you enabled." checked={prefs.pushEnabled !== false} onChange={(v) => savePrefs({ ...prefs, pushEnabled: v })} /><Toggle label="Email backup" description="contact@visualizeclients.com on every submission." checked={prefs.emailEnabled !== false} onChange={(v) => savePrefs({ ...prefs, emailEnabled: v })} /></Stack></Card>
      <Card className="st-card">
        <p className="pb-card-h">Reminders (one push, every morning)</p>
        <p className="dt-muted">One digest at 9am Eastern with today's callbacks, meetings, bills, and review asks. The Hobby plan only allows a once-a-day cron; move to Pro and flip FIFTEEN_MINUTE_MODE in api/cron/reminders.js plus the schedule in vercel.json to go back to a push the moment each one is due.</p>
        <Stack gap={0}>
          <Toggle label="Meeting reminders" description="Include today's booked meetings in the morning digest." checked={reminders.meetings !== false} onChange={(v) => saveReminders({ ...reminders, meetings: v })} />
          <Toggle label="Callback reminders" description="Include callbacks due today or overdue in the morning digest." checked={reminders.callbacks !== false} onChange={(v) => saveReminders({ ...reminders, callbacks: v })} />
          <Toggle label="Bill reminders" description="Include retainer bills due today in the morning digest." checked={reminders.bills !== false} onChange={(v) => saveReminders({ ...reminders, bills: v })} className="st-rem-bills" />
          <Toggle label="Review ask reminders" description="Include clients due for a review ask (three days after a release, none logged yet) in the morning digest." checked={reminders.reviews !== false} onChange={(v) => saveReminders({ ...reminders, reviews: v })} className="st-rem-reviews" />
        </Stack>
        {!cronArmed && <p className="dt-muted">Cron is not armed yet: add CRON_SECRET in Vercel so the reminders job can run.</p>}
        <Row gap={2}><Button variant="secondary" icon={Bell01} onClick={testPush}>Send test notification</Button></Row>
      </Card>
      <Card className="st-card">
        <p className="pb-card-h">This device</p>
        {pushState === 'subscribed' ? <Row gap={2} align="center"><Pill tone="booked" label="Push is on for this device" size="sm" icon="CheckCircle" /></Row>
          : pushState === 'unsupported' ? <p className="dt-muted">This browser cannot receive push. On iPhone, install the app to your Home Screen first.</p>
          : <Row gap={2}><Button icon={Bell01} onClick={enablePush} disabled={pushState === 'denied'}>{pushState === 'denied' ? 'Notifications blocked in browser settings' : 'Enable push on this device'}</Button></Row>}
      </Card>
      <Card className="st-card st-install" key={installTick}>
        <Row gap={3} align="start"><IconTile icon="Download04" tone="won" size="md" /><Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
          <p className="pb-card-h" style={{ margin: 0 }}>Install the app</p>
          {isStandalone() ? <p className="dt-muted">Installed. You are running the home screen app.</p>
            : canPrompt() ? <><p className="dt-muted">Add Visualize to your home screen or dock for full screen and push.</p><Row gap={2}><Button icon="Download04" onClick={install}>Install</Button></Row></>
            : isIOS() ? <p className="dt-muted">On iPhone: tap Share, then Add to Home Screen. Push works once it is installed.</p>
            : <p className="dt-muted">Use your browser menu: Install app (Chrome and Edge) or Add to Dock (Safari).</p>}
        </Stack></Row>
      </Card>
    </Stagger>
  ) : tab === 'integrations' ? (
    <Stagger className="v-stack st-stack">
      <Card className="st-card st-integration">
        <Row gap={3} align="start"><IconTile icon="Calendar" tone={data?.calendly?.configured ? 'booked' : 'neutral'} size="md" /><Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
          <Row gap={2} align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>Calendly</p>{statusPill(!!data?.calendly?.configured, 'Connected', 'Not connected')}</Row>
          <p className="dt-muted">{data?.calendly?.configured ? 'Scheduled events show on the Calendar and in notifications, refreshed every five minutes.' : 'Add CALENDLY_TOKEN (a personal access token) in Vercel environment variables and redeploy. Nothing else is needed.'}</p>
        </Stack></Row>
      </Card>
      <Card className="st-card st-integration">
        <Row gap={3} align="start"><IconTile icon="CreditCard01" tone={stripe.configured ? 'booked' : 'neutral'} size="md" /><Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
          <Row gap={2} align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>Stripe</p>{statusPill(stripe.configured, 'Connected', 'Not connected')}{stripe.configured && statusPill(stripe.webhookConfigured, 'Webhook armed', 'Webhook secret missing', true)}{stripe.unmatched > 0 && <Pill tone="new" label={`${stripe.unmatched} unmatched`} size="sm" icon="AlertTriangle" />}</Row>
          <p className="dt-muted">{stripe.configured ? `Read only. Last webhook ${stripe.lastWebhookAt ? relativeTime(stripe.lastWebhookAt) : 'never'}. Payments that match a client by email, phone, or name land on their ledger on their own.` : 'Add STRIPE_SECRET_KEY for read access and STRIPE_WEBHOOK_SECRET for the webhook (endpoint /api/stripe/webhook, events charge.succeeded, invoice.paid, checkout.session.completed, customer.subscription.created, updated, deleted). Missing keys only hide this card.'}</p>
          <Row gap={2} wrap><Button variant="secondary" size="md" onClick={openReconcile} className="st-reconcile">Reconcile{stripe.unmatched ? ` (${stripe.unmatched})` : ''}</Button></Row>
        </Stack></Row>
      </Card>
      <Card className="st-card st-integration">
        <Row gap={3} align="start"><IconTile icon="RefreshCw01" tone={cronArmed ? 'booked' : 'neutral'} size="md" /><Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
          <Row gap={2} align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>Scheduled tasks</p>{statusPill(cronArmed, 'Armed', 'CRON_SECRET missing')}</Row>
          <p className="dt-muted">Reminders ran {health?.crons?.reminders?.lastRunAt ? relativeTime(health.crons.reminders.lastRunAt) : 'never'}; the daily job ran {health?.crons?.daily?.lastRunAt ? relativeTime(health.crons.daily.lastRunAt) : 'never'}. {cronArmed ? 'Both are on the Vercel cron schedule.' : 'Add CRON_SECRET in Vercel and both jobs start on their own.'}</p>
          <Row gap={2}><Button variant="ghost" size="md" onClick={() => setTab('automation')}>Open Automation</Button></Row>
        </Stack></Row>
      </Card>
      <Card className="st-card st-integration">
        <Row gap={3} align="start"><IconTile icon="Zap" tone={health?.enrichment && !stale(health.enrichment.lastScanAt) ? 'booked' : 'new'} size="md" /><Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
          <Row gap={2} align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>Nightly enrichment and scraper</p>{health ? statusPill(!stale(health.enrichment?.lastScanAt) && !stale(health.scraper?.lastInsertAt), 'Running', 'Quiet for 36 hours', true) : <Pill tone="neutral" label="No health yet" size="sm" icon={false} />}</Row>
          {health ? <Grid minColumnWidth={160} gap={2}>
            <div className="cw-kv"><span className="dt-fact-label">Last scan</span><span>{health.enrichment?.lastScanAt ? relativeTime(health.enrichment.lastScanAt) : 'Never'}</span></div>
            <div className="cw-kv"><span className="dt-fact-label">Scanned, 24h</span><span>{health.enrichment?.leadsScannedLast24h || 0} leads, {health.enrichment?.fieldsFilledLast24h || 0} fields</span></div>
            <div className="cw-kv"><span className="dt-fact-label">Last scraper insert</span><span>{health.scraper?.lastInsertAt ? relativeTime(health.scraper.lastInsertAt) : 'Never'}</span></div>
            <div className="cw-kv"><span className="dt-fact-label">Inserted</span><span>{health.scraper?.insertedLast24h || 0} in 24h, {health.scraper?.insertedLast7d || 0} in 7d</span></div>
          </Grid> : <p className="dt-muted">The daily job writes task health after its first run.</p>}
        </Stack></Row>
      </Card>
    </Stagger>
  ) : tab === 'data' ? (
    <Stagger className="v-stack st-stack">
      <Card className="st-card">
        <Row gap={2} justify="between" align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>Recently deleted{deleted ? `, ${deleted.length}` : ''}</p><Row gap={1}><IconButton icon={RefreshCw01} label="Refresh" variant="ghost" onClick={loadDeleted} />{deleted?.length > 0 && <Button variant="danger" size="md" icon={Trash01} onClick={purge} className="st-purge">Purge all</Button>}</Row></Row>
        <p className="dt-muted">Deleted records sit here for 30 days, then purge on their own. Restore puts them right back.</p>
        {deleted === null ? <Table.Skeleton rows={3} cols={4} selectable={false} /> : deleted.length ? (
          <Table aria-label="Recently deleted" density="sm" columnChooser={false} rows={deleted} rowKey={(r) => `${r._kind}:${r._id}`} className="st-deleted"
            columns={[
              { id: 'name', label: 'Record', always: true, render: (r) => r.business || r.name || 'Untitled' },
              { id: 'type', label: 'Type', render: (r) => (r._kind === 'lead' ? <Pill tone="neutral" label={r.industry || 'Lead'} size="sm" icon={false} variant="outline" /> : <Pill id={r.type} list={SUBMISSION_TYPES} size="sm" variant="outline" />) },
              { id: 'deleted', label: 'Deleted', render: (r) => fmtDateTime(r.deletedAt) },
            ]} rowActions={(r) => <Button variant="secondary" size="md" icon={FlipBackward} onClick={() => restore(r)} className="st-restore">Restore</Button>} />
        ) : <EmptyState size="sm" icon="Trash01" title={COPY.empty['settings.deleted'].title} description={COPY.empty['settings.deleted'].description} />}
      </Card>
      <Card className="st-card">
        <p className="pb-card-h">Import</p>
        <Stack gap={2}>
          <ListRow leading={<IconTile icon="Upload01" tone="progress" size="sm" glow={false} />} title="Leads from a spreadsheet" subtitle="CSV or XLSX with a preview and duplicate matching. Also on the Leads screen." trailing={<Button variant="secondary" size="md" onClick={() => setLeadImport(true)} className="st-import-leads">Import</Button>} chevron={false} />
          <ListRow leading={<IconTile icon="Package" tone="progress" size="sm" glow={false} />} title="Print orders from CSV" subtitle="Map the columns, preview, and skip duplicates by email, day, and subtotal." trailing={<Button variant="secondary" size="md" onClick={() => setOrderImport(true)} className="st-import-orders">Import</Button>} chevron={false} />
          <ListRow leading={<IconTile icon="Printer" tone="neutral" size="sm" glow={false} />} title="Print orders saved on this device" subtitle="From the old print dashboard in this browser. Nothing is deleted from the browser." trailing={<Button variant="secondary" size="md" onClick={() => setDevicePlan(planImport(readLocalOrders(), orders))} className="st-import-device">Preview</Button>} chevron={false} />
        </Stack>
      </Card>
      <Card className="st-card">
        <p className="pb-card-h">Export</p>
        <p className="dt-muted">CSV files built here from what is loaded, plus the server export of submissions.</p>
        <Grid minColumnWidth={200} gap={2}>
          {EXPORTS.map(ex => <Card key={ex.id} level={2} padding={3} className="st-export"><Stack gap={1}><span className="st-export-h">{ex.label}</span><span className="dt-muted">{ex.description}</span></Stack><Row gap={2}><Button variant="secondary" size="md" icon={Download01} onClick={() => exportOne(ex)} className="st-export-btn">CSV</Button></Row></Card>)}
          <Card level={2} padding={3} className="st-export"><Stack gap={1}><span className="st-export-h">Submissions</span><span className="dt-muted">Every form submission with each answer in its own column.</span></Stack><Row gap={2}><Button variant="secondary" size="md" icon={Download01} href="/api/admin/export?type=submissions&format=csv" download>CSV</Button><Button variant="ghost" size="md" href="/api/admin/export?type=submissions&format=json" download>JSON</Button></Row></Card>
        </Grid>
      </Card>
      <Card className="st-card">
        <Row gap={2} justify="between" align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>Backup</p><Button icon="Download04" onClick={backup} className="st-backup">Download backup</Button></Row>
        <p className="dt-muted">One JSON file of every collection (leads, submissions, projects, orders, concept packs, settings, Stripe events without raw payloads). Last backup {health?.lastBackupAt ? fmtDateTime(health.lastBackupAt) : 'never'}. Restore is out of scope: keep the file safe, and ask for a restore by hand if it is ever needed.</p>
      </Card>
    </Stagger>
  ) : tab === 'automation' ? (
    <Stagger className="v-stack st-stack">
      {crons.map(c => (
        <Card key={c.id} className="st-card st-cron">
          <Row gap={3} align="start"><IconTile icon="RefreshCw01" tone={cronArmed ? (c.last ? 'booked' : 'new') : 'neutral'} size="md" /><Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
            <Row gap={2} align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>{c.label}</p><Pill tone="neutral" label={c.every} size="sm" icon="Clock" variant="outline" />{!cronArmed && <Pill tone="new" label="Not armed" size="sm" icon="AlertTriangle" />}</Row>
            <p className="dt-muted">{c.what}</p>
            <Grid minColumnWidth={140} gap={2}>
              <div className="cw-kv"><span className="dt-fact-label">Last run</span><span>{c.last ? fmtDateTime(c.last) : 'Never'}</span></div>
              <div className="cw-kv"><span className="dt-fact-label">Next run</span><span>{cronArmed ? fmtDateTime(c.next) : 'Needs CRON_SECRET'}</span></div>
              {c.extra && <div className="cw-kv"><span className="dt-fact-label">Last result</span><span>{c.extra}</span></div>}
            </Grid>
          </Stack></Row>
        </Card>
      ))}
      <Card className="st-card"><p className="pb-card-h">Nightly jobs outside this app</p><p className="dt-muted">The enrichment scan and the scraper write straight into call_leads from their own schedule. Their last run shows under Integrations, and the drawer warns when either is quiet for 36 hours.</p></Card>
      <ClientLogCard />
    </Stagger>
  ) : tab === 'shortcuts' ? (
    <Stagger className="v-stack st-stack">
      {SHORTCUT_GROUPS.map(g => (
        <Card key={g.id} className="st-card">
          <p className="pb-card-h">{g.label}</p>
          <div className="st-keys">{g.keys.map(([k, what]) => <div key={k + what} className="st-key"><kbd className="st-kbd">{k}</kbd><span>{what}</span></div>)}</div>
        </Card>
      ))}
    </Stagger>
  ) : (
    <Stagger className="v-stack st-stack">
      <Card className="st-card" glow="danger">
        <p className="pb-card-h">Purge deleted now</p>
        <p className="dt-muted">Empties Recently deleted ({deleted ? deleted.length : 0} record{deleted?.length === 1 ? '' : 's'}) immediately. There is no undo after a purge.</p>
        <Row gap={2}><Button variant="danger" icon={Trash01} onClick={purge} disabled={!deleted?.length}>Purge all now</Button></Row>
      </Card>
      <Card className="st-card">
        <p className="pb-card-h">Sign out</p>
        <p className="dt-muted">Signs this device out. Sign out everywhere is not available yet: sessions are signed with SESSION_SECRET and carry no generation number, so the only way to end every session at once is to rotate SESSION_SECRET in Vercel and redeploy.</p>
        <Row gap={2}><Button variant="secondary" icon={LogOut01} onClick={onLogout}>Sign out this device</Button></Row>
      </Card>
      <Card className="st-card">
        <p className="pb-card-h">Design system</p>
        <p className="dt-muted">Every token, color, and status pill rendered live. The old print dashboard was retired; its orders live in Print Orders and its saved orders import from the Data tab.</p>
        <Row gap={2} wrap><Button variant="ghost" icon="Palette" onClick={() => shell?.go('design')}>Open design system</Button></Row>
      </Card>
    </Stagger>
  );

  return (
    <PageShell className="aa-main aa-main--wide cl-shell st-shell">
      <ScrollArea wide className="cl-page">
        <Section title="Settings" loading={fetching || loading} description={fetching || loading ? undefined : `${profile.name}, ${data?.passwordOverridden ? 'custom password' : 'env password'}, ${leads.length} leads loaded`} />
        <div className="st-tabs"><Tabs label="Settings sections" tabs={tabs} value={tab} onChange={setTab} /></div>
        <div className="lay-tabbody" key={showSkel ? 'skeleton' : tab}>{body}</div>
      </ScrollArea>
      {confirmDialog}
      {leadImport && <LeadImport existingLeads={leads} onClose={() => setLeadImport(false)} onImported={() => { setLeadImport(false); onLeadsImported?.(); }} />}
      {orderImport && <OrdersImport existing={orders} onClose={() => setOrderImport(false)} onCreate={onCreateOrder} />}
      {devicePlan && (
        <Sheet open onClose={() => setDevicePlan(null)} title="Import print orders" description={devicePlan.length ? `${devicePlan.filter(r => !r.skip).length} to create, ${devicePlan.filter(r => r.skip).length} skipped as duplicates.` : 'Nothing saved on this device.'} tall width={720}
          footer={<><Button variant="ghost" onClick={() => setDevicePlan(null)} disabled={deviceBusy}>Cancel</Button><Button loading={deviceBusy} disabled={!devicePlan.some(r => !r.skip)} icon={Download01} onClick={runDevice}>Create {devicePlan.filter(r => !r.skip).length}</Button></>}>
          <Table aria-label="Orders to import" density="sm" columnChooser={false} rows={devicePlan} rowKey={(r) => r.key + r.doc.localId}
            columns={[
              { id: 'customer', label: 'Customer', always: true, render: (r) => r.doc.customer.name || r.doc.customer.email || 'Unknown' },
              { id: 'date', label: 'Date', render: (r) => fmtDate(r.doc.createdAt) },
              { id: 'items', label: 'Items', render: (r) => itemSummary(r.doc) },
              { id: 'subtotal', label: 'Subtotal', align: 'end', render: (r) => money(orderSubtotal(r.doc)) },
              { id: 'status', label: 'Status', render: (r) => <Pill id={r.doc.status} list={PRINT_ORDER_STATUSES} size="sm" /> },
              { id: 'result', label: 'Result', render: (r) => (r.skip ? <Pill tone="neutral" label="Skip" size="sm" icon={false} /> : <Pill tone="booked" label="Create" size="sm" icon={false} />) },
            ]} empty={<EmptyState size="sm" icon="Printer" title={COPY.empty['orders.import.device'].title} description={COPY.empty['orders.import.device'].description} />} />
        </Sheet>
      )}
      {reconcile && (
        <Sheet open onClose={() => setReconcile(null)} title="Reconcile Stripe" description={reconcile.length ? `${reconcile.length} payment${reconcile.length === 1 ? '' : 's'} with no matching client.` : 'Every stored payment is matched.'} tall width={640} className="st-reconcile-sheet">
          <Stack gap={2}>
            {reconcile.length ? reconcile.map(ev => <ListRow key={ev.id} leading={<IconTile icon="CreditCard01" tone="new" size="sm" glow={false} />} title={`${money(ev.amount)} ${ev.description ? `for ${ev.description}` : ev.type}`} subtitle={[ev.customerName, ev.customerEmail, fmtDateTime(ev.at)].filter(Boolean).join(', ')} trailing={<Button variant="secondary" size="md" onClick={() => setLinkEv(ev)} className="st-link-event">Link to client</Button>} chevron={false} className="st-ev-row" />)
              : <EmptyState size="sm" icon="CheckCircle" title={COPY.empty['settings.reconcile'].title} description={COPY.empty['settings.reconcile'].description} />}
          </Stack>
        </Sheet>
      )}
      {linkEv && <LeadPicker leads={leads} title="Link this payment" description={`${money(linkEv.amount)} goes on the client's ledger.`} onClose={() => setLinkEv(null)} onPick={linkEvent} />}
      <style>{stStyles}</style>
    </PageShell>
  );
}

const stStyles = `
  .st-log-row { display: flex; flex-direction: column; gap: 2px; padding: var(--v-space-2) 0; border-bottom: 1px solid var(--v-border); min-width: 0; }
  .st-log-row:last-child { border-bottom: 0; }
  .st-log-msg { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text); overflow-wrap: anywhere; }
  .st-tabs { position: sticky; top: calc(-1 * var(--v-space-4)); z-index: var(--v-z-sticky); background: var(--v-ground); padding-top: var(--v-space-1); }
  .st-stack { gap: var(--v-space-3); }
  .st-card { gap: var(--v-space-3); }
  .st-form { max-width: 520px; }
  .st-name { font-size: var(--v-text-xl); font-weight: var(--v-weight-bold); }
  .st-target { font-size: var(--v-text-lg); font-weight: var(--v-weight-bold); }
  .st-export { gap: var(--v-space-2); justify-content: space-between; }
  .st-export-h { font-weight: var(--v-weight-bold); color: var(--v-text); }
  .st-keys { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--v-space-2); }
  .st-key { display: flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
  .st-kbd { display: inline-flex; align-items: center; min-height: 26px; padding: 0 var(--v-space-2); border-radius: var(--v-radius-sm); background: var(--v-surface-3); border: 1px solid var(--v-border-strong); font-family: var(--v-font-mono, monospace); font-size: var(--v-text-xs); color: var(--v-text); white-space: nowrap; flex-shrink: 0; }
  .st-ev-row .v-lrow-sub { white-space: normal; overflow-wrap: anywhere; }
  .st-deleted .v-td { max-width: 240px; }
`;
