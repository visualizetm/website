import { useCallback, useEffect, useState } from 'react';
import { Stack, Row, Grid, Card, Button, Pill, Toggle, Input, Select, InlineEdit, Chip, SegmentedControl, Sheet, ListRow, Icon, Stagger, SkeletonBlock, ErrorState, useRetry, useToast, useConfirm } from '../../ui';
import { usePushRel } from '../../shell/nav-history';
import { ROOM_BASE } from '../../lib/adminPaths';
import { teamApi } from '../../lib/useTeam';
import { lastSeenLine, CALLER_NAME } from '../../lib/team';

/* Settings > Team > Billy (Billy's Call Room, part 1): the caller's access, from Rob's side.
 *   Billy            his name, when he was last seen, Active or Paused; Billy's day; Pause now
 *   Sign in          his email, Reset passcode (the new one is shown once, here, and never again), Can sign in,
 *                    Move leads off your lists
 *   Your open times  the Calendly event type Billy books from, or the weekly hours (days, start, end, 30 minute slots)
 *   Tell me when     Books a lead, Finishes a session
 * Every write is a PATCH or a POST to /api/admin/team (src/lib/useTeam.js); the answer never carries a hash, a salt or a
 * version, and the passcode lives in this component's memory only while its sheet is open. */
const DAYS = [{ id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, { id: 3, label: 'Wed' }, { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' }, { id: 0, label: 'Sun' }];
const SOURCES = [{ id: 'calendly', label: 'Calendly' }, { id: 'hours', label: 'Weekly hours' }];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const statusOf = (b) => (!b.exists || !b.email || !b.hasPasscode ? { label: 'Not set up', tone: 'neutral' } : b.canSignIn ? { label: 'Active', tone: 'booked' } : { label: 'Paused', tone: 'callback' });

function Skeleton() {
  return (
    <Stack gap={3} className="st-stack" aria-busy="true">
      {[132, 240, 220, 132].map((h, i) => <Card key={i} className="st-card" style={{ minHeight: h }}><SkeletonBlock width={160} height={12} /><SkeletonBlock width="70%" height={14} /></Card>)}
    </Stack>
  );
}

export default function TeamPanel() {
  const toast = useToast();
  const pushRel = usePushRel();
  const [confirm, confirmDialog] = useConfirm();
  const [billy, setBilly] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState('');
  const [shown, setShown] = useState(''); // the new passcode, while its sheet is open
  const [types, setTypes] = useState({ state: 'idle', configured: false, items: [] });

  const load = useCallback(async () => {
    setError(false);
    const r = await teamApi.get();
    if (!r.ok || !r.data?.billy) { setError(true); return false; }
    setBilly(r.data.billy);
    return true;
  }, []);
  useEffect(() => { load(); }, [load]);
  const [retry, retrying] = useRetry(load);

  const source = billy?.openTimes?.source;
  const loadTypes = useCallback(async () => {
    setTypes(t => ({ ...t, state: 'loading' }));
    const r = await teamApi.eventTypes();
    if (!r.ok) { setTypes({ state: 'error', configured: true, items: [] }); return false; }
    setTypes({ state: r.data?.error ? 'error' : 'ready', configured: !!r.data?.configured, items: Array.isArray(r.data?.items) ? r.data.items : [] });
    return true;
  }, []);
  useEffect(() => { if (source === 'calendly' && types.state === 'idle') loadTypes(); }, [source, types.state, loadTypes]);

  if (error && !billy) return <Card><ErrorState title="Billy's access did not load" description="Nothing was changed. Try again." onRetry={retry} retrying={retrying} /></Card>;
  if (!billy) return <Skeleton />;

  /* One write: what changed shows at once, the server's answer replaces it, a refusal puts the old value back and says why. */
  const save = async (set, okMessage = '') => {
    const before = billy;
    setBilly(b => ({ ...b, ...set, openTimes: set.openTimes ? { ...b.openTimes, ...set.openTimes, hours: { ...b.openTimes.hours, ...(set.openTimes.hours || {}) } } : b.openTimes, prefs: set.prefs ? { ...b.prefs, ...set.prefs } : b.prefs }));
    const r = await teamApi.set(set);
    if (!r.ok || !r.data?.billy) { setBilly(before); toast.error(r.data?.error || 'That did not save. Try again in a moment.'); return false; }
    setBilly(r.data.billy);
    if (okMessage) toast.success(okMessage);
    return true;
  };
  const ot = billy.openTimes;
  const st = statusOf(billy);
  const name = billy.name || CALLER_NAME;
  const roomUrl = `${window.location.origin}${ROOM_BASE}`;

  const reset = async () => {
    if (!(await confirm({ title: `Reset ${name}'s passcode?`, body: `${name} is signed out on every device and the old passcode stops working. The new one is shown once.`, confirmLabel: 'Reset passcode' }))) return;
    setBusy('reset');
    const r = await teamApi.resetPasscode();
    setBusy('');
    if (!r.ok || !r.data?.passcode) { toast.error(r.data?.error || 'The passcode was not reset. Try again.'); return; }
    setBilly(r.data.billy); setShown(r.data.passcode);
  };
  const pause = async () => {
    if (!(await confirm({ title: `Pause ${name} now?`, body: `${name} is signed out at once and cannot sign back in until you switch Can sign in on.`, danger: true, confirmLabel: 'Pause now' }))) return;
    setBusy('pause');
    const r = await teamApi.pause();
    setBusy('');
    if (!r.ok || !r.data?.billy) { toast.error(r.data?.error || 'That did not save. Try again in a moment.'); return; }
    setBilly(r.data.billy);
    toast.success(`${name} is signed out.`);
  };
  const copy = async (text, said) => { try { await navigator.clipboard.writeText(text); toast.success(said); } catch { toast.error('Copy it by hand: the clipboard is not available here.'); } };
  const setHours = (h) => {
    const next = { ...ot.hours, ...h };
    if (!HHMM.test(next.start) || !HHMM.test(next.end)) return;
    if (next.end <= next.start) { toast.error('The end has to be after the start.'); return; }
    if (!next.days.length) { toast.error('Pick at least one day.'); return; }
    save({ openTimes: { ...ot, hours: next } });
  };

  return (
    <Stagger className="v-stack st-stack tm-panel">
      <Card className="st-card" data-card="team-billy">
        <Row gap={3} align="start" justify="between" wrap>
          <Stack gap={1} style={{ minWidth: 0, flex: 1 }}>
            <p className="pb-card-h">Billy</p>
            <InlineEdit value={billy.name} onSave={(v) => save({ name: String(v || '').trim() })} placeholder="His name" label="His name" className="tm-name" />
            <p className="dt-muted tm-seen">{lastSeenLine(billy.lastSeenAt)}</p>
          </Stack>
          <Pill label={st.label} tone={st.tone} icon={false} size="sm" className="tm-status" />
        </Row>
        <p className="dt-muted">Your commission sales partner. He cold calls and books intro calls from his own Call Room; a lead is yours from the moment it is booked.</p>
        <ListRow leading={<Icon icon="ClockRewind" size="var(--v-icon-md)" />} title={`${name}'s day`} subtitle="What he did today, yesterday and this week" onClick={() => pushRel('/settings/team/day')} className="tm-day-row" />
        {billy.canSignIn && billy.exists && <Row gap={2} wrap><Button variant="danger" icon="PauseCircle" loading={busy === 'pause'} onClick={pause} className="tm-pause">Pause now</Button></Row>}
      </Card>

      <Card className="st-card" data-card="team-signin">
        <p className="pb-card-h">Sign in</p>
        <div className="tm-facts">
          <div className="tm-fact"><span className="tm-fact-k">Email</span><InlineEdit value={billy.email} onSave={(v) => save({ email: String(v || '').trim() })} placeholder="Set email" label="His email" type="email" inputMode="email" className="tm-email" /></div>
          <div className="tm-fact"><span className="tm-fact-k">Passcode</span><span className="tm-fact-v">{billy.hasPasscode ? `Set${billy.passcodeSetAt ? ` ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(billy.passcodeSetAt))}` : ''}. Only ${name} knows it.` : 'Not set yet'}</span></div>
          <div className="tm-fact"><span className="tm-fact-k">Call Room</span><span className="tm-fact-v tm-url">{roomUrl}</span></div>
        </div>
        <Row gap={2} wrap>
          <Button variant="secondary" icon="Key01" loading={busy === 'reset'} onClick={reset} className="tm-reset">{billy.hasPasscode ? 'Reset passcode' : 'Set a passcode'}</Button>
          <Button variant="ghost" icon="Link01" onClick={() => copy(roomUrl, 'Call Room link copied.')} className="tm-copy-link">Copy the link</Button>
        </Row>
        <Stack gap={0}>
          <Toggle label="Can sign in" description="Off signs him out at once and keeps him out." checked={billy.canSignIn} onChange={(v) => save({ canSignIn: v }, v ? `${name} can sign in again.` : `${name} is signed out.`)} className="tm-can" />
          <Toggle label="Move leads off your lists" description="On: he can take a lead off a list you call, after he confirms it. Off: your lists are locked to him." checked={billy.moveOffRobLists} onChange={(v) => save({ moveOffRobLists: v })} className="tm-move" />
        </Stack>
      </Card>

      <Card className="st-card" data-card="team-open">
        <p className="pb-card-h">Your open times</p>
        <p className="dt-muted">What {name} can book: the next 14 days, minus the meetings already in the CRM. A booking never writes to Calendly; the push tells you to add it.</p>
        <SegmentedControl full size="sm" label="Open times source" options={SOURCES} value={ot.source} onChange={(id) => save({ openTimes: { ...ot, source: id } })} className="tm-source" />
        {ot.source === 'calendly' && (
          types.state === 'loading' || types.state === 'idle' ? <SkeletonBlock height={52} radius="var(--v-radius-md)" />
            : types.state === 'error' ? <Row gap={3} align="center" justify="between" wrap role="alert"><p className="dt-muted">Calendly did not answer. {name} books from your weekly hours until it does.</p><Button variant="secondary" onClick={loadTypes} className="tm-types-retry">Try again</Button></Row>
              : !types.configured ? <p className="dt-muted tm-nocal">Calendly is not connected (Integrations). Until it is, {name} books from your weekly hours.</p>
                : <Select label="Event type" value={ot.eventType} placeholder="Pick an event type" options={[...types.items.map(t => ({ id: t.uri, label: `${t.name}${t.duration ? ` (${t.duration} min)` : ''}` })), ...(ot.eventType && !types.items.some(t => t.uri === ot.eventType) ? [{ id: ot.eventType, label: ot.eventTypeName || 'The event type picked before' }] : [])]} onChange={(e) => { const t = types.items.find(x => x.uri === e.target.value); if (t) save({ openTimes: { ...ot, eventType: t.uri, eventTypeName: t.name } }); }} hint={`If Calendly cannot answer, ${name} sees your weekly hours instead.`} className="tm-event" />
        )}
        <Stack gap={2} className="tm-hours" role="group" aria-label="Weekly hours">
          <p className="rc-label">{ot.source === 'calendly' ? 'Weekly hours (the fallback)' : 'Weekly hours'}</p>
          <div className="tm-days" role="group" aria-label="Days">
            {DAYS.map(d => <Chip key={d.id} label={d.label} selected={ot.hours.days.includes(d.id)} onClick={() => setHours({ days: ot.hours.days.includes(d.id) ? ot.hours.days.filter(x => x !== d.id) : [...ot.hours.days, d.id].sort() })} data-day={d.id} />)}
          </div>
          <Grid minColumnWidth={140} gap={2}>
            <Input label="Start" type="time" step={1800} value={ot.hours.start} onChange={(e) => setHours({ start: e.target.value })} className="tm-start" />
            <Input label="End" type="time" step={1800} value={ot.hours.end} onChange={(e) => setHours({ end: e.target.value })} className="tm-end" />
          </Grid>
          <p className="dt-muted">30 minute slots, New York time.</p>
        </Stack>
      </Card>

      <Card className="st-card" data-card="team-tell">
        <p className="pb-card-h">Tell me when {name}</p>
        <Stack gap={0}>
          <Toggle label="Books a lead" description="A push with the business and the time, under Meetings." checked={billy.prefs.booked} onChange={(v) => save({ prefs: { ...billy.prefs, booked: v } })} className="tm-tell-booked" />
          <Toggle label="Finishes a session" description="A push with his numbers for the list, under Team." checked={billy.prefs.session} onChange={(v) => save({ prefs: { ...billy.prefs, session: v } })} className="tm-tell-session" />
        </Stack>
      </Card>

      {shown && (
        <Sheet open onClose={() => setShown('')} title={`${name}'s new passcode`} description="Shown once. Hand it to him." label="New passcode" className="tm-pass-sheet"
          footer={<><Button variant="ghost" icon="Copy01" onClick={() => copy(shown, 'Passcode copied.')} className="tm-pass-copy">Copy</Button><Button onClick={() => setShown('')} className="tm-pass-done">Done</Button></>}>
          <Stack gap={3}>
            <p className="tm-passcode" data-passcode aria-label="Passcode">{shown}</p>
            <p className="dt-muted">It is stored as a hash, so nobody can read it again, not even here. If it gets lost, reset it.</p>
          </Stack>
        </Sheet>
      )}
      {confirmDialog}
      <style>{teamPanelStyles}</style>
    </Stagger>
  );
}

export const teamPanelStyles = `
  .tm-name { font-family: var(--v-font-display); font-size: var(--v-text-xl); line-height: var(--v-lh-xl); font-weight: var(--v-weight-bold); }
  .tm-status { flex-shrink: 0; }
  .tm-facts { display: grid; gap: var(--v-space-1); min-width: 0; }
  .tm-fact { display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: center; gap: var(--v-space-3); min-height: var(--v-tap); min-width: 0; }
  .tm-fact-k { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .tm-fact-v { font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text); overflow-wrap: anywhere; min-width: 0; }
  .tm-days { display: flex; flex-wrap: wrap; gap: var(--v-space-2); min-width: 0; }
  .tm-passcode { margin: 0; padding: var(--v-space-4); text-align: center; font-family: var(--v-font-display); font-variant-numeric: tabular-nums; font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); font-weight: var(--v-weight-bold); letter-spacing: 0.12em; color: var(--v-text); background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); user-select: all; overflow-wrap: anywhere; }
`;
