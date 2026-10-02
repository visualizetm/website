import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { normalizeLeads } from '../lib/leads';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import Play from '@untitled-ui/icons-react/build/esm/Play';
import Keyboard01 from '@untitled-ui/icons-react/build/esm/Keyboard01';
import SkipForward from '@untitled-ui/icons-react/build/esm/SkipForward';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import AlertTriangle from '@untitled-ui/icons-react/build/esm/AlertTriangle';
import {
  PageShell, ScrollArea, StickyFooterBar, Section, Stack, Row, Grid, Card, Button, IconButton, Chip, ChipGroup, Select, Input, SegmentedControl, Tabs, Pill, Avatar, Badge, Menu, Popover, Checkbox, Sheet, Modal, EmptyState, ErrorState, ListRow, ProgressBar, ProgressRing, Stagger, SkeletonBlock, SkeletonCircle, SkeletonText, useDelayedLoading, useMediaQuery, useToast, useRetry, Tooltip, uiStyles,
} from '../ui';
import { COPY } from '../shared/copy';
import { apiFetch } from '../shared/api';
import { useShell, useTopBar } from '../shell/ShellContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelection, useBack } from '../shell/nav-history';
import { useDecline } from '../components/DeclineSheet';
import { withNextAction } from '../lib/nextAction';
import { openLists, listCount, applyOutcome, outcomeRemoves, tomorrowKey, restoreLead } from '../lib/lists';
import ListCard, { listCardStyles } from '../components/ListCard';
import LeadCard from '../components/LeadCard';
import LeadForm from '../components/LeadForm';
import LeadHistory from '../components/LeadHistory';
import LeadNotes from '../components/LeadNotes';
import { ScriptSteps, Objections, CloseCards, IntelCards } from '../components/LeadPlaybook';
import { effectiveStage } from '../lib/booked';
import { saidNoPatch } from '../lib/nurture';
import { defaultLead } from '../lib/defaultLead';
import { emptyDeal } from '../lib/deal';
import { dealFromOptions } from '../lib/dealConvert';
import { industryFacets } from '../lib/leads';
import { windowsOf, currentWindow, matchesWindow, orderQueue, ORDERS, SIZES, sizeLabel, EMPTY_STATS, STAT_KEY, connectsOf, winLine, quickCallbacks, toLocalInput } from '../lib/calls';
import { OUTCOMES, PRIORITIES, CALL_STATUSES, WINDOWS, MEETING_TYPES, industryKey, displayIndustry } from '../shared/semantics';
import { formatPhone, telHref } from '../shared/phone';
import { fmtMins, fmtDate } from '../shared/dates';
import { ADMIN_HOME } from '../lib/adminPaths';
import { durationMs } from '../ui/motion';
import IMPORT_LEADS from '../data/call-leads-import.json';

/* Call Console 3.0 (Prompt 7). Mobile first: builder, queue, call room, summary.
 * Desktop from 1024px: queue | room | history and notes. */

const SESSION_KEY = 'vz_call_session';
const SIZE_KEY = 'vz_call_size';
const TAB_KEY = 'vz_call_tab';
const WARN_RX = /(DO NOT|DISQUALIF|WARNING|never dial)/i;
const BOARD = CALL_STATUSES.filter(s => s.id !== 'booked');
const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fine */ } };

/** The stored shape of a new lead from the form (default script content included). */
export { defaultLead } from '../lib/defaultLead';

const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ── Outcome sheet: one component, five outcomes ─────────────── */
function OutcomeSheet({ outcome, lead, onLog, onClose }) {
  const o = OUTCOMES.find(x => x.id === outcome);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(lead.email || lead.afterCall?.email || '');
  const [date, setDate] = useState(() => (outcome === 'callback' ? toLocalInput(new Date(Date.now() + 3600e3)).date : ''));
  const [time, setTime] = useState(() => (outcome === 'callback' ? toLocalInput(new Date(Date.now() + 3600e3)).time : ''));
  const [type, setType] = useState('call');
  const [busy, setBusy] = useState(false);
  const quick = useMemo(() => quickCallbacks(), []);
  const submit = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    try {
      if (outcome === 'booked') await onLog('booked', { note, email, meeting: date ? { date, time: time || '09:00', type } : null });
      else if (outcome === 'callback') await onLog('callback', { note, callbackAt: date ? new Date(`${date}T${time || '09:00'}`).toISOString() : null });
      else await onLog(outcome, { note });
    } finally { setBusy(false); }
  };
  const title = { booked: 'Booked a meeting', callback: 'Call them back', 'no-answer': 'No answer', no: 'Said no', 'wrong-number': 'Wrong number' }[outcome];
  return (
    <Sheet open onClose={onClose} title={title} description={lead.business} className={`cc-osheet cc-osheet--${outcome}`}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant={outcome === 'booked' ? 'primary' : outcome === 'callback' ? 'secondary' : 'secondary'} icon={o?.icon} loading={busy} onClick={submit} data-autofocus={outcome !== 'booked' && outcome !== 'callback'}>{outcome === 'booked' ? 'Book it' : outcome === 'callback' ? 'Set callback' : 'Log'}</Button></>}>
      <form onSubmit={submit} className="cc-osheet-form">
        {outcome === 'booked' && (
          <Stack gap={3}>
            <Grid minColumnWidth={140} gap={2}>
              <Input label="Meeting date" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-autofocus />
              <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Grid>
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} options={MEETING_TYPES.map(t => ({ id: t.id, label: t.label }))} />
            <Input label="Their email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@business.com" />
          </Stack>
        )}
        {outcome === 'callback' && (
          <Stack gap={3}>
            <Row gap={2} wrap>{quick.map(q => { const v = toLocalInput(q.at); const on = v.date === date && v.time === time; return <Chip key={q.id} label={q.label} selected={on} onClick={() => { setDate(v.date); setTime(v.time); }} />; })}</Row>
            <Grid minColumnWidth={140} gap={2}>
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Grid>
          </Stack>
        )}
        <Input label={outcome === 'booked' ? 'What they said' : 'Note'} value={note} onChange={(e) => setNote(e.target.value)} placeholder={outcome === 'callback' ? 'Ask for the owner after 5' : 'Optional, one line'} autoComplete="off" data-autofocus={outcome !== 'booked' && outcome !== 'callback'} />
        {outcome === 'wrong-number' && <p className="cc-hint">The phone note gets stamped "Wrong number ({fmtDate(new Date().toISOString())})". Nothing else changes.</p>}
        {outcome === 'no' && <p className="cc-hint">A no parks them in Nurture for 90 days, then they come back through Triage. Undo for six seconds.</p>}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Sheet>
  );
}

const KEYS = [['1', 'Booked'], ['2', 'Callback'], ['3', 'No answer'], ['4', 'Said no'], ['5', 'Wrong number'], ['N', 'Next lead'], ['S', 'Skip'], ['Right or Space', 'Next'], ['Left', 'Previous'], ['Esc', 'Back to the queue'], ['?', 'This list']];
function ShortcutsModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard" size="sm">
      <div className="cc-keys">{KEYS.map(([k, v]) => <div key={k} className="cc-keys-row"><kbd className="sh-kbd">{k}</kbd><span>{v}</span></div>)}</div>
    </Modal>
  );
}

/* ── Room pieces ─────────────────────────────────────────────── */
function RoomHeader({ lead, pulse, onEdit, onDecline, timerMs, onCallTap, desktop, onCopy, onAbout }) {
  const win = currentWindow();
  const winsOf = windowsOf(lead.bestWindow);
  const scan = lead.enrichment?.lastScanAt ? (Date.now() - new Date(lead.enrichment.lastScanAt).getTime()) / 864e5 : null;
  const socials = [['website', 'Globe01', 'Website'], ['instagram', 'Image01', 'Instagram'], ['facebook', 'Users01', 'Facebook'], ['google', 'MarkerPin01', 'Maps']].filter(([k]) => lead.socials?.[k]);
  const warned = WARN_RX.test(`${lead.notes || ''} ${lead.phoneNote || ''}`);
  /* A phone (milestone 4): the name (two lines at most), what decides the call (priority, the best window), who to ask for and the Call
     button, all above the outcome bar at first paint. Everything else about the lead is one sheet away (About this lead). */
  if (!desktop) {
    return (
      <Card className={`cc-head cc-head--phone${pulse ? ` is-pulse cc-head--${pulse}` : ''}`} glow={lead.priority === 'hot' ? 'won' : undefined}>
        {warned && <div className="cc-warn" role="alert"><AlertTriangle width={16} height={16} /> Check the notes before dialing.</div>}
        <Row gap={3} align="start">
          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
            <h2 className="cc-biz lay-title">{lead.business}</h2>
            <Row gap={1} wrap>
              <Pill id={lead.priority || 'warm'} size="sm" />
              {lead.bestWindow && <Pill tone={winsOf.has(win) ? 'booked' : 'neutral'} label={lead.bestWindow} icon={winsOf.has(win) ? 'Check' : false} size="sm" variant={winsOf.has(win) ? 'soft' : 'outline'} />}
            </Row>
          </Stack>
          <Menu label="Lead actions" items={[{ id: 'about', label: 'About this lead', icon: 'Users01', onSelect: onAbout }, { id: 'edit', label: 'Edit lead', icon: 'Edit02', onSelect: onEdit }, 'divider', { id: 'decline', label: 'Decline this lead', icon: 'SlashCircle01', danger: true, onSelect: onDecline }]} />
        </Row>
        {lead.askFor && <p className="cc-askfor">Ask for <strong>{lead.askFor.replace(/^Ask for /i, '')}</strong></p>}
        <div className="cc-phone">
          {lead.phone ? (
            <Button size="lg" full icon={PhoneCall01} href={telHref(lead.phone)} onClick={onCallTap} className="cc-phone-btn">{formatPhone(lead.phone)}{timerMs != null && <span className="cc-phone-timer">{fmtClock(timerMs)}</span>}</Button>
          ) : (
            <div className="cc-phone-none"><AlertTriangle width={18} height={18} /> No phone on file. Find the number first.</div>
          )}
        </div>
        <Button variant="ghost" size="md" icon="Users01" onClick={onAbout} className="cc-about-btn">About this lead</Button>
      </Card>
    );
  }
  return (
    <Card className={`cc-head${pulse ? ` is-pulse cc-head--${pulse}` : ''}`} glow={lead.priority === 'hot' ? 'won' : undefined}>
      {warned && <div className="cc-warn" role="alert"><AlertTriangle width={16} height={16} /> Check the notes before dialing.</div>}
      <Row gap={3} align="start">
        <Avatar name={lead.business} size="lg" />
        <Stack gap={1} style={{ flex: 1 }}>
          <h2 className="cc-biz">{lead.business}</h2>
          <Row gap={1} wrap>
            {lead.industry && <Pill tone="neutral" label={displayIndustry(lead.industry)} icon={false} size="sm" variant="outline" />}
            <Pill id={lead.priority || 'warm'} size="sm" />
            <Pill id={lead.callStatus || 'not-called'} list={CALL_STATUSES} size="sm" />
            {lead.bestWindow && <Pill tone={winsOf.has(win) ? 'booked' : 'neutral'} label={lead.bestWindow} icon={winsOf.has(win) ? 'Check' : false} size="sm" variant={winsOf.has(win) ? 'soft' : 'outline'} />}
          </Row>
        </Stack>
        <IconButton icon={Edit02} label="Edit lead" variant="secondary" onClick={onEdit} className="cc-edit-btn" />
        <Menu label="Lead actions" items={[{ id: 'edit', label: 'Edit lead', icon: 'Edit02', onSelect: onEdit }, 'divider', { id: 'decline', label: 'Decline this lead', icon: 'SlashCircle01', danger: true, onSelect: onDecline }]} />
      </Row>
      {lead.descriptor && <p className="cc-desc">{lead.descriptor}</p>}
      {lead.askFor && <p className="cc-askfor">Ask for <strong>{lead.askFor.replace(/^Ask for /i, '')}</strong></p>}
      {(socials.length > 0 || scan != null) && (
        <Row gap={2} wrap className="cc-head-links">
          {socials.map(([k, icon, label]) => <Button key={k} variant="ghost" size="md" icon={icon} href={lead.socials[k]} target="_blank" rel="noopener noreferrer">{label}</Button>)}
          <span style={{ flex: 1 }} />
          {scan != null && <Tooltip label={`Scanned ${fmtDate(lead.enrichment.lastScanAt)}, ${lead.enrichment.scanCount || 1} scans`}><span className={`lc-scan ${scan <= 7 ? 'is-fresh' : 'is-stale'}`} tabIndex={0} aria-label="Enrichment status" /></Tooltip>}
        </Row>
      )}
      <div className="cc-phone">
        {lead.phone ? (
          <Row gap={2}>
            <Button size="lg" full icon={PhoneCall01} href={telHref(lead.phone)} onClick={onCallTap} className="cc-phone-btn">{formatPhone(lead.phone)}{timerMs != null && <span className="cc-phone-timer">{fmtClock(timerMs)}</span>}</Button>
            {desktop && <IconButton icon={Copy01} label="Copy number" variant="secondary" size="lg" onClick={onCopy} />}
          </Row>
        ) : (
          <div className="cc-phone-none"><AlertTriangle width={18} height={18} /> No phone on file. Find the number first.</div>
        )}
        {lead.phoneNote && <p className="cc-phone-note">{lead.phoneNote}</p>}
      </div>
    </Card>
  );
}

function BeforeYouDial({ lead, done, onToggle }) {
  const items = lead.beforeYouDial || [];
  if (!items.length) return null;
  return (
    <Card level={1} padding={3} className="cc-predial">
      <p className="pb-card-h">Before you dial</p>
      <Stack gap={0}>{items.map((t, i) => <Checkbox key={i} label={t} checked={!!done[i]} onChange={() => onToggle(i)} />)}</Stack>
    </Card>
  );
}

const ROOM_TABS = [{ id: 'script', label: 'Script' }, { id: 'objections', label: 'Objections' }, { id: 'close', label: 'Close' }, { id: 'intel', label: 'Intel' }];
/* A phone keeps the three playbook tabs; Intel, Notes and History are in the About this lead sheet. */
const MOBILE_TABS = ROOM_TABS.slice(0, 3);

function RoomBody({ lead, tab, onTab, desktop, onSaveNotes }) {
  const tabs = desktop ? ROOM_TABS : MOBILE_TABS;
  const t = tabs.some(x => x.id === tab) ? tab : 'script';
  return (
    <Stack gap={3}>
      <Tabs label="Playbook" tabs={tabs.map(x => x.id === 'objections' ? { ...x, count: (lead.objections || []).length || undefined } : x.id === 'history' ? { ...x, count: ((lead.callLog || []).length + (lead.contactLog || []).length) || undefined } : x)} value={t} onChange={onTab} />
      <div className="lay-tabbody" key={`${lead._id}-${t}`}>
        {t === 'script' && <ScriptSteps lead={lead} />}
        {t === 'objections' && <Objections lead={lead} />}
        {t === 'close' && <CloseCards lead={lead} />}
        {t === 'intel' && <IntelCards lead={lead} />}
        {t === 'notes' && <LeadNotes lead={lead} onSave={onSaveNotes} />}
        {t === 'history' && <LeadHistory lead={lead} />}
      </div>
    </Stack>
  );
}

function OutcomeBar({ current, position, total, onOutcome, onSkip, desktop, onKeys, disabled }) {
  return (
    <StickyFooterBar className="cc-outbar">
      <div className="cc-outs" role="group" aria-label="Outcome">
        {OUTCOMES.map(o => (
          <Button key={o.id} variant={o.id === 'booked' ? 'primary' : 'secondary'} icon={o.icon} className={`cc-out cc-out--${o.id}`} style={o.id === 'booked' ? undefined : { color: o.text }} onClick={() => onOutcome(o.id)} disabled={disabled || !current} aria-keyshortcuts={o.key}>
            <span className="cc-out-label">{o.label}</span>{desktop && <kbd className="sh-kbd cc-kbd">{o.key}</kbd>}
          </Button>
        ))}
      </div>
      <Row gap={2} className="cc-outbar-row2">
        <Button variant="ghost" icon={SkipForward} onClick={onSkip} disabled={!current}>Skip{desktop && <kbd className="sh-kbd cc-kbd">S</kbd>}</Button>
        <span className="cc-pos">{total ? `${position} of ${total}` : ''}</span>
        {desktop && <IconButton icon={Keyboard01} label="Keyboard shortcuts" onClick={onKeys} className="cc-keys-btn" />}
      </Row>
    </StickyFooterBar>
  );
}

/* ── Summary ─────────────────────────────────────────────────── */
function Summary({ session, leadsById, onNew, onDashboard, onOpenLead, list = null, onRoll, onDone }) {
  const toast = useToast();
  const s = session.stats;
  const connects = connectsOf(s);
  const booked = session.ids.filter(id => session.logged[id] === 'booked').map(id => leadsById.get(id)).filter(Boolean);
  const copy = async () => { try { await navigator.clipboard.writeText(winLine(s)); toast.success('Copied the win line.'); } catch { toast.error(COPY.error.copy); } };
  return (
    <ScrollArea className="cc-summary">
      <Stagger className="v-stack" style={{ gap: 'var(--v-space-4)' }}>
        <Card>
          <Section title="Session complete" description={fmtMins(Date.now() - session.startedAt) + ' on the phones'}>
            <Row gap={5} align="center" wrap className="cc-sumrow">
              <ProgressRing value={connects ? Math.round((s.booked / connects) * 100) : 0} size={96} thickness={9} tone="booked" label="Booked of connects"><Stack gap={0} align="center"><span style={{ fontSize: 'var(--v-text-2xl)' }}>{s.booked}</span><span className="cc-ring-sub">of {connects}</span></Stack></ProgressRing>
              <Grid minColumnWidth={110} gap={2} style={{ flex: '1 1 240px' }} className="cc-statgrid">
                {[['Calls', s.calls], ['Connects', connects], ['Booked', s.booked], ['Callbacks', s.callbacks], ['Said no', s.no], ['Wrong number', s.wrongNumber]].map(([l, n]) => <Card key={l} level={2} padding={3}><span className="cc-stat-n">{n}</span><span className="cc-stat-l">{l}</span></Card>)}
              </Grid>
            </Row>
            <Card level={2} padding={3} className="cc-winline"><p>{winLine(s)}</p><Button variant="secondary" icon={Copy01} onClick={copy}>Copy win line</Button></Card>
          </Section>
        </Card>
        {booked.length > 0 && (
          <Card><Section title="Booked this session"><Stack gap={2}>{booked.map(l => <ListRow key={l._id} leading={<Avatar name={l.business} size="sm" status="booked" />} title={l.business} subtitle={l.meeting?.date ? `${l.meeting.date} ${l.meeting.time || ''}` : 'Meeting set'} onClick={() => onOpenLead(l)} />)}</Stack></Section></Card>
        )}
        {list && (
          <Card><Section title={list.name} description={`${listCount(list)} left on the list`}>
            <Row gap={2} wrap>
              {!list.system && <Button icon="Calendar" onClick={() => onRoll(list)} disabled={!listCount(list)}>Roll into tomorrow</Button>}
              {!list.system && <Button variant="secondary" icon="Check" onClick={() => onDone(list)}>Mark done</Button>}
              {list.system && <span className="cc-hint">Callbacks due fills itself; what is left comes back tomorrow.</span>}
            </Row>
          </Section></Card>
        )}
        <Row gap={2} wrap><Button icon={Play} onClick={onNew}>New session</Button><Button variant="secondary" onClick={onDashboard}>Back to Next up</Button></Row>
      </Stagger>
    </ScrollArea>
  );
}

/* ── Main ────────────────────────────────────────────────────── */
export default function AdminCalls({ embedded = false, onDataChanged, builderPreset, forceLoading = false, lists = [], listsLoading = false, listsError = false, onRetryLists, listOps = null }) {
  const shell = useShell();
  const toast = useToast();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [authed, setAuthed] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const fetching = !loaded && !loadError;
  const showSkel = useDelayedLoading(fetching || forceLoading);
  const pending = (fetching || forceLoading) && !showSkel; // the first 150ms of a load: the frame only

  // Builder
  const [selPrio, setSelPrio] = useState(() => new Set());
  const [selStatus, setSelStatus] = useState(() => new Set());
  const [selInd, setSelInd] = useState(() => new Set());
  const [selWin, setSelWin] = useState(() => new Set());
  const [rightNow, setRightNow] = useState(false);
  const [order, setOrder] = useState('priority');
  const [size, setSize] = useState(() => readLS(SIZE_KEY, 25));
  const [includePhoneless, setIncludePhoneless] = useState(false);
  const [presetIds, setPresetIds] = useState(null);
  const [autostart, setAutostart] = useState(null); // ids to start with as soon as leads load (lead detail 'Start call')
  const [indMore, setIndMore] = useState(false);
  const indMoreRef = useRef(null);

  // Flow
  /* Back (done once): queue, room and summary are history entries; builder is the root. The entry's mode wins on a popstate. */
  const [mode, setModeState] = useState('builder'); // builder | queue | room | summary
  const { entry: modeEntry, open: pushMode } = useSelection('calls');
  const navigate = useNavigate();
  const navBack = useBack(); const navBackRef = useRef(navBack); navBackRef.current = navBack;
  const modeRef = useRef(mode); modeRef.current = mode;
  const location = useLocation(); const idxRef = useRef(0); idxRef.current = location.state?.idx || 0;
  const idxOf = useRef({}); // the history depth each mode's entry sits at, so a move down the modes pops to it
  const ORDER = { builder: 0, queue: 1, room: 2, summary: 3 };
  useEffect(() => { const m = modeEntry?.mode; if (m && m !== modeRef.current) setModeState(m); if (!m && modeRef.current !== 'builder') setModeState('builder'); }, [modeEntry]);
  const setMode = useCallback((m) => {
    const cur = modeRef.current; if (m === cur) return;
    if (ORDER[m] < ORDER[cur]) {
      const at = m === 'builder' ? idxOf.current.builder : idxOf.current[m];
      if (at != null && at < idxRef.current) { navigate(at - idxRef.current); return; }
      if (navBackRef.current && m === 'builder') { navBackRef.current.back(); return; }
      setModeState(m); return;
    }
    if (cur === 'builder') idxOf.current.builder = idxRef.current;
    idxOf.current[m] = idxRef.current + 1;
    setModeState(m); pushMode(m, { mode: m });
  }, [pushMode, navigate]); // eslint-disable-line react-hooks/exhaustive-deps
  const [quick, setQuick] = useState(false); // builder mode shows the lists first; Quick session is the old builder (CRM revamp, step 3)
  const [session, setSession] = useState(null);
  const sessionRef = useRef(session); sessionRef.current = session;
  const [sheet, setSheet] = useState(null);
  const [tab, setTab] = useState(() => readLS(TAB_KEY, 'script'));
  const [predial, setPredial] = useState({});
  const [timer, setTimer] = useState(null); // { start } while a call runs
  const [, setTick] = useState(0);
  const [pulse, setPulse] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const lastTap = useRef(null);
  const touch = useRef(null);
  const qTouch = useRef(null);

  useEffect(() => {
    if (!builderPreset) return;
    const p = builderPreset.preset || {};
    setSelStatus(new Set(p.status || [])); setSelPrio(new Set(p.prio || [])); setSelInd(new Set()); setSelWin(new Set()); setRightNow(false);
    setPresetIds(Array.isArray(p.ids) && p.ids.length ? p.ids : null);
    setMode('builder'); setQuick(!p.listId && (!!p.status || !!p.prio || !!p.ids));
    if (p.autostart && Array.isArray(p.ids) && p.ids.length) setAutostart(p.ids);
    if (p.listId) setStartList(p.listId);
  }, [builderPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (embedded) { setAuthed(true); return; }
    apiFetch('/api/admin/session').then(r => { if (r.ok && r.data?.authed) setAuthed(true); else window.location.replace(ADMIN_HOME); });
  }, [embedded]);
  const load = useCallback(async () => {
    const r = await apiFetch('/api/admin/call-leads');
    if (r.status === 401) { window.location.replace(ADMIN_HOME); return; }
    if (r.ok) { setLeads(normalizeLeads(r.data?.items)); setLoaded(true); setLoadError(false); } else setLoadError(true);
  }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);
  const [retry, retrying] = useRetry(load);
  const [listsRetry, listsRetrying] = useRetry(onRetryLists || (() => {})); // the lists view's Try again (CRM revamp, step 3), a hook, so above the early return
  const loadFailed = loadError && !loaded && <Card><ErrorState title={COPY.error.calls.title} description={COPY.error.calls.description} onRetry={retry} retrying={retrying} /></Card>;

  // Persisted session survives a phone call or a reload (a Start from Lists supersedes it).
  useEffect(() => {
    if (builderPreset) return;
    const s = readLS(SESSION_KEY, null);
    if (Array.isArray(s?.ids) && s.ids.length) {
      setSession({ ids: s.ids, idx: Math.min(Math.max(0, s.idx || 0), s.ids.length - 1), stats: { ...EMPTY_STATS, ...(s.stats || {}) }, logged: s.logged || {}, startedAt: s.startedAt || Date.now(), size: s.size || s.ids.length, listId: s.listId || '' });
      setMode(s.mode === 'summary' ? 'summary' : s.mode === 'room' ? 'room' : 'queue');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (session) writeLS(SESSION_KEY, { ...session, mode }); else { try { localStorage.removeItem(SESSION_KEY); } catch { /* fine */ } } }, [session, mode]);
  useEffect(() => { writeLS(TAB_KEY, tab); }, [tab]);
  useEffect(() => { if (!timer) return undefined; const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, [timer]);

  /* ── Data ops ── */
  // explicit: true (a decline) rides on the body, never into the record; see AdminApp.patchCallLead.
  const patch = useCallback(async (id, rawSet) => { const { explicit, ...set } = rawSet || {}; return (await apiFetch('/api/admin/call-leads', { method: 'PATCH', body: { id, set, ...(explicit === true ? { explicit: true } : {}) } })).ok; }, []);
  const patchLead = useCallback(async (id, set0) => {
    // CRM revamp, step 2: the same recompute the shell's helper does, so a callback logged here carries its next action.
    const cur = leads.find(l => l._id === id);
    const set = cur ? withNextAction(cur, set0, { projects: shell?.projects || [], sets: shell?.sets || [] }) : set0;
    let prev; setLeads(ls => ls.map(l => { if (l._id === id) { prev = l; return { ...l, ...set }; } return l; }));
    const ok = await patch(id, set);
    if (!ok && prev) { setLeads(ls => ls.map(l => (l._id === id ? prev : l))); toast.error(COPY.error.save); }
    else onDataChanged?.();
    return ok;
  }, [patch, onDataChanged, toast, leads, shell?.projects, shell?.sets]);
  const saveNotes = useCallback((id, notes) => patchLead(id, { notes }), [patchLead]);
  /* Decline from the room (CRM revamp, step 1): the lead leaves the queue and the
     room moves on; the undo puts it back through a reload. */
  const decline = useDecline({
    onPatch: async (id, set) => { const ok = await patchLead(id, set); if (ok && set.declined === null) await load(); return ok; },
    onDeclined: (l) => { removeFromLists(l._id); if (mode === 'room' && !desktop) setMode('queue'); },
  });
  const createLead = async (values) => {
    const r = await apiFetch('/api/admin/call-leads', { method: 'POST', body: defaultLead(values) });
    if (r.ok) { setNewOpen(false); await load(); onDataChanged?.(); toast.success(`Added ${values.business}.`); } else toast.error(COPY.error.create);
  };
  const removeFromLists = useCallback((id) => {
    setLeads(prev => prev.filter(l => l._id !== id));
    setSession(s => { if (!s) return s; const ids = s.ids.filter(x => x !== id); return { ...s, ids, idx: Math.min(s.idx, Math.max(0, ids.length - 1)) }; });
  }, []);
  const deleteLead = async (id) => {
    setEditOpen(false);
    const prevLeads = leads; const prevSession = session;
    removeFromLists(id);
    const r = await apiFetch(`/api/admin/call-leads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) { setLeads(prevLeads); setSession(prevSession); toast.error(COPY.error.del); return; }
    onDataChanged?.(); if (mode === 'room' && !desktop) setMode('queue');
  };
  const importNotepads = async () => { setImporting(true); try { const r = await apiFetch('/api/admin/call-leads', { method: 'POST', body: { leads: IMPORT_LEADS } }); if (!r.ok) toast.error('Import failed. Nothing was added.'); await load(); onDataChanged?.(); } finally { setImporting(false); } };

  /* ── Builder ── */
  const pool = useMemo(() => leads.filter(l => effectiveStage(l) === 'lead'), [leads]);
  const win = currentWindow();
  const winSel = useMemo(() => (rightNow ? new Set([win]) : selWin), [rightNow, selWin, win]);
  const pass = (l, except) => (
    (except === 'prio' || !selPrio.size || selPrio.has(l.priority || 'warm')) &&
    (except === 'status' || !selStatus.size || selStatus.has(l.callStatus || 'not-called')) &&
    (except === 'ind' || !selInd.size || selInd.has(industryKey(l.industry))) &&
    (except === 'win' || !winSel.size || [...winSel].some(w => matchesWindow(l, w)))
  );
  const count = (except, fn) => pool.filter(l => pass(l, except) && fn(l)).length;
  const facets = useMemo(() => industryFacets(pool.filter(l => pass(l, 'ind'))), [pool, selPrio, selStatus, winSel]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => {
    if (presetIds) { const o = new Map(presetIds.map((id, i) => [id, i])); return leads.filter(l => o.has(l._id)).sort((a, b) => o.get(a._id) - o.get(b._id)); }
    return orderQueue(pool.filter(l => pass(l)), rightNow && order === 'priority' ? 'window' : order);
  }, [leads, pool, presetIds, selPrio, selStatus, selInd, winSel, order, rightNow]); // eslint-disable-line react-hooks/exhaustive-deps
  const callable = useMemo(() => (includePhoneless ? filtered : filtered.filter(l => l.phone)), [filtered, includePhoneless]);
  const sized = useMemo(() => (size ? callable.slice(0, size) : callable), [callable, size]);
  const toggle = (setter) => (id) => setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* ── Session ── */
  const leadsById = useMemo(() => new Map(leads.map(l => [l._id, l])), [leads]);
  const sessionIds = useMemo(() => (session && loaded ? session.ids.filter(id => leadsById.has(id)) : session?.ids || []), [session, leadsById, loaded]);
  const curIdx = session ? Math.min(session.idx, Math.max(0, sessionIds.length - 1)) : 0;
  const current = session ? leadsById.get(sessionIds[curIdx]) : null;
  const done = session ? sessionIds.filter(id => session.logged[id]).length : 0;
  const nextIdx = session ? sessionIds.findIndex((id, i) => i >= curIdx && !session.logged[id]) : -1;

  useEffect(() => {
    if (!autostart || !loaded) return;
    const ids = autostart.filter(id => leadsById.has(id));
    setAutostart(null);
    if (!ids.length) return;
    setSession({ ids, idx: 0, stats: { ...EMPTY_STATS }, logged: {}, startedAt: Date.now(), size: ids.length });
    setPredial({}); setTimer(null); setSheet(null); setMode('room');
  }, [autostart, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  /* A list session (CRM revamp, step 3): the list's leads in its order, the
     list remembered on the session so every outcome updates it. */
  const [startList, setStartList] = useState(null);
  useEffect(() => {
    if (!startList || !loaded) return;
    const list = lists.find(l => String(l._id) === String(startList));
    setStartList(null);
    if (!list) return;
    const ids = (list.leadIds || []).map(String).filter(id => leadsById.has(id));
    if (!ids.length) { toast.info(`${list.name} has nobody to call.`); return; }
    setSession({ ids, idx: 0, stats: { ...EMPTY_STATS }, logged: {}, startedAt: Date.now(), size: ids.length, listId: String(list._id) });
    setPredial({}); setTimer(null); setSheet(null); setMode(desktop ? 'room' : 'queue');
  }, [startList, loaded, lists]); // eslint-disable-line react-hooks/exhaustive-deps
  const startSession = (startId) => {
    let ids = sized.map(l => l._id);
    if (startId && !ids.includes(startId)) ids = callable.map(l => l._id);
    if (!ids.length) return;
    setSession({ ids, idx: startId ? Math.max(0, ids.indexOf(startId)) : 0, stats: { ...EMPTY_STATS }, logged: {}, startedAt: Date.now(), size: ids.length });
    setPredial({}); setTimer(null); setSheet(null);
    setMode(startId || desktop ? 'room' : 'queue');
  };
  const endSession = () => { setSheet(null); setTimer(null); setMode('summary'); };
  const newSession = () => { setSession(null); setSheet(null); setTimer(null); setMode('builder'); setQuick(false); };
  const goTo = (i) => { setSession(s => (s ? { ...s, idx: i } : s)); setPredial({}); setTimer(null); setMode('room'); };
  const advance = useCallback((d = 1) => {
    setSheet(null); setPredial({}); setTimer(null);
    const s = sessionRef.current; if (!s) return;
    const ni = s.idx + d;
    if (ni >= s.ids.length) { setMode('summary'); return; }
    setSession({ ...s, idx: Math.max(0, ni) });
  }, [setMode]);
  const skipToEnd = (id) => setSession(s => { if (!s) return s; const ids = s.ids.filter(x => x !== id); ids.push(id); return { ...s, ids, idx: Math.min(s.idx, ids.length - 1) }; });

  useTopBar(useMemo(() => {
    if (!embedded) return null;
    if (mode === 'room' && current && !desktop) return { title: timer ? `${current.business}  ${fmtClock(Date.now() - timer.start)}` : current.business, back: () => setMode('queue') };
    if (mode === 'room' && current && desktop) return { title: timer ? `Call Console  ${fmtClock(Date.now() - timer.start)}` : 'Call Console', back: null };
    if (mode === 'queue') return { title: 'Session', back: () => setMode('builder') };
    if (mode === 'summary') return { title: 'Session summary', back: () => shell?.go?.('dashboard') };
    return null;
  }, [embedded, mode, current?._id, current?.business, desktop, timer && Math.floor((Date.now() - timer.start) / 1000)])); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Logging: optimistic, rollback, undo ── */
  const applyLog = async (outcome, extra = {}) => {
    const lead = current; if (!lead) return false;
    const at = new Date().toISOString();
    const entry = { at, outcome, note: (extra.note || '').trim(), meeting: outcome === 'booked' && extra.meeting ? `${extra.meeting.date} ${extra.meeting.time}` : '', email: outcome === 'booked' ? (extra.email || '').trim() : '' };
    const prev = { _id: lead._id, callStatus: lead.callStatus || 'not-called', callLog: lead.callLog || [], stage: lead.stage, callbackAt: lead.callbackAt || '', phoneNote: lead.phoneNote || '', meeting: lead.meeting, afterCall: lead.afterCall, nurture: lead.nurture || null, listId: lead.listId || '' };
    // CRM revamp, step 4: where the lead sat on the list it came from, so an undo puts it back there.
    const prevList = session?.listId ? lists.find(l => String(l._id) === String(session.listId)) : null;
    const prevIndex = prevList ? (prevList.leadIds || []).map(String).indexOf(String(lead._id)) : -1;
    const set = { callStatus: outcome, callLog: [...(lead.callLog || []), entry] };
    // CRM revamp, step 5: a booking starts the deal, the package from the recommended pricing option.
    if (outcome === 'booked') { set.stage = 'booked'; if (!lead.deal) set.deal = { ...emptyDeal(), ...dealFromOptions(lead.pricingOptions) }; if (extra.meeting) set.meeting = extra.meeting; if (entry.email || entry.meeting) set.afterCall = { ...(lead.afterCall || {}), meeting: entry.meeting || lead.afterCall?.meeting || '', email: entry.email || lead.afterCall?.email || '' }; }
    if (outcome === 'callback') set.callbackAt = extra.callbackAt || '';
    if (outcome === 'wrong-number') set.phoneNote = `Wrong number (${fmtDate(at)})`;
    // CRM revamp, step 4: a no parks the lead in nurture for 90 days instead of deleting it.
    if (outcome === 'no') Object.assign(set, saidNoPatch());
    setLeads(ls => ls.map(l => (l._id === lead._id ? { ...l, ...set } : l)));
    setSession(s => (s ? { ...s, stats: { ...s.stats, calls: s.stats.calls + 1, [STAT_KEY[outcome]]: (s.stats[STAT_KEY[outcome]] || 0) + 1 }, logged: { ...s.logged, [lead._id]: outcome } } : s));
    setSheet(null); setTimer(null);
    const ok = await patch(lead._id, set);
    if (!ok) {
      setLeads(ls => ls.map(l => (l._id === lead._id ? { ...l, ...prev } : l)));
      setSession(s => (s ? { ...s, stats: { ...s.stats, calls: s.stats.calls - 1, [STAT_KEY[outcome]]: Math.max(0, (s.stats[STAT_KEY[outcome]] || 1) - 1) }, logged: { ...s.logged, [lead._id]: undefined } } : s));
      toast.error(COPY.error.save);
      return false;
    }
    onDataChanged?.();
    /* The list rule on the same beat (CRM revamp, step 3): booked, no,
       wrong-number and callback take the lead off the list and clear its
       listId; no-answer moves it to the bottom for next time. A callback
       lands on Callbacks due through the sync. */
    if (session?.listId && listOps) {
      const list = lists.find(l => String(l._id) === String(session.listId));
      const next = list ? applyOutcome(list.leadIds, lead._id, outcome) : null;
      if (next) listOps.applyOutcome(session.listId, lead._id, next, outcomeRemoves(outcome));
      if (outcome === 'callback') listOps.syncCallbacksDue(leads.map(l => (l._id === lead._id ? { ...l, ...set } : l)));
    }
    setPulse(outcome); setTimeout(() => setPulse(null), durationMs('--v-dur-slow') + 80);
    if (outcome === 'no') removeFromLists(lead._id);
    const label = OUTCOMES.find(o => o.id === outcome)?.label || outcome;
    toast.undo(`${label}: ${lead.business}`, async () => {
      const back = await patch(lead._id, { callStatus: prev.callStatus, callLog: prev.callLog, stage: prev.stage, callbackAt: prev.callbackAt, phoneNote: prev.phoneNote, nurture: prev.nurture, listId: prev.listId, ...(prev.meeting ? { meeting: prev.meeting } : {}), ...(prev.afterCall ? { afterCall: prev.afterCall } : {}) });
      if (!back) { toast.error('Undo failed. Fix it on the lead.'); return; }
      /* CRM revamp, step 4: back on the list it came from, in its old place, and the callbacks list follows. */
      if (prevList && prevIndex >= 0 && listOps) { const cur = lists.find(l => String(l._id) === String(prevList._id)) || prevList; await listOps.patchList(prevList._id, { leadIds: restoreLead(cur.leadIds, lead._id, prevIndex) }); }
      if (listOps) listOps.syncCallbacksDue(leads.map(l => (l._id === lead._id ? { ...l, ...prev } : l)));
      await load(); onDataChanged?.();
      setSession(s => (s ? { ...s, ids: s.ids.includes(lead._id) ? s.ids : [...s.ids.slice(0, s.idx), lead._id, ...s.ids.slice(s.idx)], stats: { ...s.stats, calls: Math.max(0, s.stats.calls - 1), [STAT_KEY[outcome]]: Math.max(0, (s.stats[STAT_KEY[outcome]] || 1) - 1) }, logged: { ...s.logged, [lead._id]: undefined } } : s));
      toast.success(`Undid ${label.toLowerCase()} for ${lead.business}.`);
    }, { seconds: 6 });
    setTimeout(() => advance(1), durationMs('--v-dur-slow') + 200); // a beat to read the outcome, then the next lead
    return true;
  };
  const onOutcome = (id) => {
    const now = Date.now();
    if (['no-answer', 'no', 'wrong-number'].includes(id) && lastTap.current?.id === id && now - lastTap.current.t < 2000) { lastTap.current = null; applyLog(id, {}); return; }
    lastTap.current = { id, t: now };
    setSheet({ outcome: id });
  };
  const copyNumber = async () => { try { await navigator.clipboard.writeText(formatPhone(current.phone)); toast.success('Number copied.'); } catch { toast.error('Could not copy.'); } };

  /* ── Keyboard ── */
  useEffect(() => {
    if (mode !== 'room' || !current) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (keysOpen) { if (e.key === 'Escape' || e.key === '?') setKeysOpen(false); return; }
      if (sheet || editOpen) return;
      const o = OUTCOMES.find(x => x.key === e.key);
      if (o) { e.preventDefault(); onOutcome(o.id); return; }
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'n': case 'N': e.preventDefault(); advance(1); break;
        case 's': case 'S': e.preventDefault(); skipToEnd(current._id); break;
        case 'ArrowLeft': advance(-1); break;
        case 'Escape': if (!desktop) setMode('queue'); break;
        case '?': setKeysOpen(true); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, current, sheet, keysOpen, editOpen, advance, desktop]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Swipe ── */
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => { const t = touch.current; touch.current = null; if (!t || sheet) return; const dx = e.changedTouches[0].clientX - t.x; const dy = e.changedTouches[0].clientY - t.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) advance(dx < 0 ? 1 : -1); };
  const qSwipe = (id, i) => ({
    onTouchStart: (e) => { qTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e) => { const t = qTouch.current; qTouch.current = null; if (!t) return; const dx = e.changedTouches[0].clientX - t.x; const dy = e.changedTouches[0].clientY - t.y; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx > 0) goTo(i); else skipToEnd(id); } },
  });

  if (authed === null) return <div className="cc-page lay-root"><style>{uiStyles + ccStyles}</style></div>;

  /* ── Views ── */
  /* The Call tab opens on the lists (CRM revamp, step 3): every open list as
     a card with Start, and Quick session for the old builder. */
  const openListsNow = openLists(lists);
  const listsView = (
    <PageShell className="cc-shell">
      <ScrollArea className="cc-builder">
        {pending ? null : loadFailed ? loadFailed : showSkel || listsLoading ? (
          <Stack gap={5} aria-busy="true">
            <Stack gap={1}><SkeletonBlock width={140} height={16} /><SkeletonText lines={desktop ? 1 : 2} lineHeight={desktop ? 38 : 30} gap={1} width="70%" /><SkeletonText lines={1} lineHeight={18} width="60%" /></Stack>
            <div className="ls-grid">{[1, 2, 3].map(i => <Card key={i} as="div" padding={4}><Stack gap={3}><Row gap={2} justify="between"><SkeletonBlock width={140} height={18} /><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row><Stack gap={1}><SkeletonBlock width={60} height={14} /><SkeletonBlock height={6} radius="var(--v-radius-pill)" /></Stack><SkeletonBlock height={44} radius="var(--v-radius-md)" /></Stack></Card>)}</div>
          </Stack>
        ) : listsError && !lists.length ? (
          <Card><ErrorState title={COPY.error.lists.title} description={COPY.error.lists.description} onRetry={listsRetry} retrying={listsRetrying} /></Card>
        ) : (
          <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>
            <Stack gap={1}><p className="cc-kicker">Pick a list</p><h2 className="cc-title">What are we running?</h2><p className="cc-sub">Start a list you built, or run a quick session from the filters.</p></Stack>
            {openListsNow.length ? (
              <div className="ls-grid">{openListsNow.map(l => <ListCard key={l._id} list={l} onOpen={() => setStartList(l._id)} onStart={(x) => setStartList(x._id)} onMenu={(x) => [{ id: 'start', label: 'Start', icon: 'Play', onSelect: () => setStartList(x._id), disabled: !listCount(x) }, { id: 'open', label: 'Open on Lists', icon: 'Rows01', onSelect: () => shell?.go('lists') }]} />)}</div>
            ) : (
              <Card><EmptyState icon="Rows01" title={COPY.empty['calls.lists'].title} description={COPY.empty['calls.lists'].description} action={{ label: COPY.empty['calls.lists'].action, icon: Play, onClick: () => setQuick(true) }} secondary={{ label: 'Open Lists', onClick: () => shell?.go('lists') }} /></Card>
            )}
            {openListsNow.length > 0 && <Row gap={2} wrap><Button variant="secondary" icon={Play} onClick={() => setQuick(true)} className="cc-quick">Quick session</Button><Button variant="ghost" icon="Rows01" onClick={() => shell?.go('lists')}>Open Lists</Button></Row>}
          </Stagger>
        )}
      </ScrollArea>
      <style>{listCardStyles}</style>
    </PageShell>
  );
  const builderView = (
    <PageShell className="cc-shell">
      <ScrollArea className="cc-builder">
        {pending ? null : loadFailed ? loadFailed : showSkel ? (
          <Stack gap={5} aria-busy="true">
            {/* The section titles and descriptions are real (static copy); only the chips and controls are skeleton, sized like the usual set. */}
            <Stack gap={1}><SkeletonBlock width={140} height={16} /><SkeletonText lines={desktop ? 1 : 2} lineHeight={desktop ? 38 : 30} gap={1} width="70%" /><SkeletonText lines={desktop ? 1 : 2} lineHeight={18} gap={1} width="90%" /></Stack>
            {[['Priority', [100, 112, 108]], ['Call status', [148, 139, 151, 132, 178]], ['Industry', [154]]].map(([t, ws]) => <Section key={t} title={t}><Row gap={2} wrap>{ws.map((w, j) => <SkeletonBlock key={j} width={w} height={44} radius="var(--v-radius-pill)" />)}</Row></Section>)}
            <Section title="Best window" description="From each lead's best window. Right now picks the window for this hour."><Row gap={2} wrap>{[148, 136, 129, 147, 135, 140].map((w, j) => <SkeletonBlock key={j} width={w} height={44} radius="var(--v-radius-pill)" />)}</Row></Section>
            <Section title="Options"><Row gap={2} wrap><SkeletonBlock width={255} height={44} radius="var(--v-radius-pill)" /></Row><Grid minColumnWidth={200} gap={3}><SkeletonBlock height={68} radius="var(--v-radius-md)" /><SkeletonBlock height={68} radius="var(--v-radius-md)" /></Grid></Section>
            <Card level={2} padding={3} className="cc-preview" style={{ minHeight: 91 }}><SkeletonBlock width={40} height={32} /><SkeletonBlock width={180} height={14} /></Card>
          </Stack>
        ) : !pool.length && loaded ? (
          <Card><EmptyState icon="PhoneCall01" title={COPY.empty['calls.builder'].title} description={COPY.empty['calls.builder'].description} action={{ label: importing ? 'Importing' : `${COPY.empty['calls.builder'].action} (${IMPORT_LEADS.length})`, icon: Download01, onClick: importNotepads }} secondary={{ label: COPY.empty['calls.builder'].secondary, onClick: () => setNewOpen(true) }} /></Card>
        ) : (
          <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>
            <Stack gap={1}><p className="cc-kicker">Build your session</p><h2 className="cc-title">Who are we dialing?</h2><p className="cc-sub">Pick the kind of leads for this block of calls. Nothing selected in a group means all of them.</p></Stack>
            {openListsNow.length > 0 && <Row gap={2}><Button variant="ghost" icon="ArrowLeft" onClick={() => setQuick(false)}>Back to the lists</Button></Row>}
            {presetIds && <Section title="Picked from Leads"><Row gap={2} wrap><Chip label={`${presetIds.length} selected lead${presetIds.length === 1 ? '' : 's'}`} count={presetIds.length} selected onClick={() => setPresetIds(null)} /><span className="cc-hint">Tap to clear and build from filters instead.</span></Row></Section>}
            <Section title="Priority"><ChipGroup label="Priority" value={selPrio} onChange={setSelPrio} options={PRIORITIES.map(p => ({ id: p.id, label: p.label, icon: p.icon, count: count('prio', l => (l.priority || 'warm') === p.id) }))} /></Section>
            <Section title="Call status"><ChipGroup label="Call status" value={selStatus} onChange={setSelStatus} options={BOARD.map(s => ({ id: s.id, label: s.label, icon: s.icon, count: count('status', l => (l.callStatus || 'not-called') === s.id) }))} /></Section>
            {facets.length > 0 && (
              <Section title="Industry">
                <Row gap={2} wrap>
                  <ChipGroup label="Industry" value={selInd} onChange={setSelInd} allWhenEmpty={false} options={facets.slice(0, 8).map(f => ({ id: f.key, label: f.label, count: f.count }))} />
                  {facets.length > 8 && <span ref={indMoreRef}><Chip label={`More (${facets.length - 8})`} onClick={() => setIndMore(o => !o)} aria-expanded={indMore} /><Popover open={indMore} onClose={() => setIndMore(false)} anchorRef={indMoreRef} width={280} trap label="More industries"><div className="cc-more">{facets.slice(8).map(f => <Checkbox key={f.key} label={`${f.label} (${f.count})`} checked={selInd.has(f.key)} onChange={() => toggle(setSelInd)(f.key)} />)}</div></Popover></span>}
                  {!selInd.size && <span className="v-chipgroup-all">All</span>}
                </Row>
              </Section>
            )}
            <Section title="Best window" description="From each lead's best window. Right now picks the window for this hour.">
              <Row gap={2} wrap>
                <Chip label="Right now" icon="Clock" selected={rightNow} onClick={() => { setRightNow(v => !v); setSelWin(new Set()); }} count={count('win', l => matchesWindow(l, win))} />
                {WINDOWS.map(w => <Chip key={w.id} label={w.label} icon={w.icon} selected={winSel.has(w.id)} onClick={() => { setRightNow(false); toggle(setSelWin)(w.id); }} count={count('win', l => matchesWindow(l, w.id))} />)}
              </Row>
            </Section>
            <Section title="Options">
              <Row gap={2} wrap>
                <Chip label="Include leads without a phone" selected={includePhoneless} count={count(null, l => !l.phone)} onClick={() => setIncludePhoneless(v => !v)} />
              </Row>
              <Grid minColumnWidth={200} gap={3}>
                <Select label="Order" value={rightNow && order === 'priority' ? 'window' : order} onChange={(e) => setOrder(e.target.value)} options={ORDERS.map(o => ({ id: o.id, label: o.label }))} />
                <div className="v-field"><span className="v-field-label">Session size</span><SegmentedControl label="Session size" full options={SIZES.map(n => ({ id: String(n), label: sizeLabel(n) }))} value={String(size)} onChange={(v) => { setSize(Number(v)); writeLS(SIZE_KEY, Number(v)); }} /></div>
              </Grid>
            </Section>
            <Card level={2} padding={3} className="cc-preview" role="status">
              <span className="cc-preview-n">{sized.length}</span>
              <span className="cc-preview-txt">lead{sized.length === 1 ? '' : 's'} in this session{callable.length > sized.length ? ` of ${callable.length} matching` : ''}{filtered.length !== callable.length && !includePhoneless ? `, ${filtered.length - callable.length} skipped for no phone` : ''}</span>
            </Card>
          </Stagger>
        )}
      </ScrollArea>
      {sized.length > 0 && !showSkel && (
        <StickyFooterBar>
          <Button size="lg" full icon={Play} onClick={() => startSession()} className="cc-start">Start call session <Badge count={sized.length} inline tone="neutral" max={999} /></Button>
        </StickyFooterBar>
      )}
    </PageShell>
  );

  /* Skeletons for a persisted session while the leads load (Prompt 14). */
  const queueSkeleton = (
    <div className="cc-queue" aria-busy="true">
      <Section title="Session" loading action={<SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" />}><SkeletonBlock height={4} radius="var(--v-radius-pill)" /></Section>
      {/* One skeleton row per lead in the session, which the saved session already knows. */}
      <div className="cc-qlist">{(session?.ids?.length ? session.ids : [1, 2, 3, 4, 5]).map((id, i) => <LeadCard.Skeleton key={id || i} menu={false} />)}</div>
    </div>
  );
  const roomSkeleton = (
    <ScrollArea bare className="cc-room" aria-busy="true">
      <div className="cc-room-inner lay-content">
        {/* The header at its real minimum (Prompt 15): one line of name, the pills wrapping like the real four, the descriptor and ask-for lines, two social buttons, the phone button. */}
        {!desktop ? (
          <Card className="cc-head cc-head--phone" aria-hidden="true">
            <Row gap={3} align="start"><Stack gap={1} style={{ flex: 1, minWidth: 0 }}><SkeletonBlock width="80%" height={56} /><Row gap={1} wrap>{[56, 150].map((w, i) => <SkeletonBlock key={i} width={w} height={22} radius="var(--v-radius-pill)" />)}</Row></Stack><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row>
            <SkeletonBlock width="40%" height={24} />
            <SkeletonBlock height={56} radius="var(--v-radius-lg)" />
            <SkeletonBlock width={140} height={44} radius="var(--v-radius-md)" />
          </Card>
        ) : (
        <Card className="cc-head" aria-hidden="true">
          <Row gap={3} align="start"><SkeletonCircle size={56} /><Stack gap={1} style={{ flex: 1 }}><SkeletonBlock width="60%" height={34} /><Row gap={1} wrap>{[110, 52, 84, 190].map((w, i) => <SkeletonBlock key={i} width={w} height={22} radius="var(--v-radius-pill)" />)}</Row></Stack><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row>
          <SkeletonBlock width="90%" height={22} />
          <SkeletonBlock width="40%" height={24} />
          <Row gap={2} wrap>{[96, 104].map((w, i) => <SkeletonBlock key={i} width={w} height={44} radius="var(--v-radius-md)" />)}</Row>
          <SkeletonBlock height={56} radius="var(--v-radius-lg)" />
        </Card>
        )}
        <Card level={1} padding={3} className="cc-predial"><SkeletonBlock width={110} height={12} /><Stack gap={0}>{[1, 2, 3].map(i => <Row key={i} gap={3} align="center" style={{ minHeight: 'var(--v-tap)' }}><SkeletonBlock width={22} height={22} /><SkeletonBlock width={`${50 + i * 12}%`} height={14} /></Row>)}</Stack></Card>
        <Stack gap={3}><Row gap={2} style={{ borderBottom: '1px solid var(--v-border)', paddingBottom: 12 }}>{[1, 2, 3, ...(desktop ? [4] : [])].map(i => <SkeletonBlock key={i} width={64} height={16} />)}</Row><Card><SkeletonText lines={4} /></Card><Card><SkeletonText lines={3} /></Card></Stack>
      </div>
    </ScrollArea>
  );
  const summarySkeleton = (
    <ScrollArea className="cc-summary" aria-busy="true">
      <Stack gap={4}><Card><SkeletonBlock width={140} height={12} /><Row gap={5} align="center"><SkeletonCircle size={96} /><Grid minColumnWidth={110} gap={2} style={{ flex: '1 1 240px' }}>{[1, 2, 3, 4, 5, 6].map(i => <Card key={i} level={2} padding={3}><SkeletonBlock width={40} height={30} /><SkeletonBlock width={60} height={12} /></Card>)}</Grid></Row><SkeletonBlock height={56} radius="var(--v-radius-lg)" /></Card><Row gap={2}><SkeletonBlock width={140} height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={160} height={44} radius="var(--v-radius-md)" /></Row></Stack>
    </ScrollArea>
  );

  const queuePanel = session && (pending ? <div className="cc-queue" /> : loadFailed ? <div className="cc-queue">{loadFailed}</div> : showSkel ? queueSkeleton : (
    <div className="cc-queue">
      <Section title="Session" description={`${Math.max(0, sessionIds.length - done)} left of ${sessionIds.length}`}
        action={<Menu label="Session" items={[{ id: 'pause', label: 'Pause and come back later', icon: 'ClockRewind', onSelect: () => shell?.go('dashboard') }, { id: 'end', label: 'End session', icon: 'Check', onSelect: endSession }, 'divider', { id: 'new', label: 'Discard and start over', icon: 'Trash01', danger: true, onSelect: newSession }]} />}>
        <ProgressBar value={sessionIds.length ? Math.round((done / sessionIds.length) * 100) : 0} tone="booked" size="sm" />
      </Section>
      <Stagger className="cc-qlist">
        {sessionIds.map((id, i) => { const l = leadsById.get(id); if (!l) return null; const logged = session.logged[id]; return (
          <div key={id} className={`cc-qcard${i === curIdx ? ' is-cur' : ''}${i === nextIdx ? ' is-next' : ''}${logged ? ' is-done' : ''}`} {...qSwipe(id, i)}>
            <LeadCard lead={l} onOpen={() => goTo(i)} selected={i === curIdx} />
            {logged && <Pill id={logged} list={CALL_STATUSES} size="sm" variant="solid" className="cc-qmark" />}
            {i === nextIdx && !logged && <span className="cc-qnext">Next</span>}
          </div>); })}
      </Stagger>
    </div>
  ));

  const roomCenter = pending ? <div className="cc-room" /> : loadFailed ? <div className="cc-room cc-room--empty">{loadFailed}</div> : showSkel ? roomSkeleton : current ? (
    <ScrollArea bare className="cc-room" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} key={current._id}>
      <Stagger className="cc-room-inner lay-content" cap={3}>
        <RoomHeader lead={current} pulse={pulse} onEdit={() => setEditOpen(true)} onDecline={() => decline.open(current)} timerMs={timer ? Date.now() - timer.start : null} onCallTap={() => setTimer({ start: Date.now() })} desktop={desktop} onCopy={copyNumber} onAbout={() => setAboutOpen(true)} />
        {(current.beforeYouDial || []).length > 0 && <BeforeYouDial lead={current} done={predial} onToggle={(i) => setPredial(p => ({ ...p, [i]: !p[i] }))} />}
        <RoomBody lead={current} tab={tab} onTab={setTab} desktop={desktop} onSaveNotes={saveNotes} />
      </Stagger>
    </ScrollArea>
  ) : (
    <div className="cc-room cc-room--empty"><EmptyState icon="PhoneCall01" title={COPY.empty['calls.room'].title} description={COPY.empty['calls.room'].description} action={{ label: COPY.empty['calls.room'].action, onClick: endSession }} /></div>
  );
  const bar = <OutcomeBar current={current} position={curIdx + 1} total={sessionIds.length} onOutcome={onOutcome} onSkip={() => current && skipToEnd(current._id)} desktop={desktop} onKeys={() => setKeysOpen(true)} disabled={!!sheet} />;

  const overlays = (
    <>
      {sheet && current && <OutcomeSheet key={`${current._id}-${sheet.outcome}`} outcome={sheet.outcome} lead={current} onLog={applyLog} onClose={() => setSheet(null)} />}
      <ShortcutsModal open={keysOpen} onClose={() => setKeysOpen(false)} />
      {decline.sheet}
      {aboutOpen && current && (
        <Sheet open onClose={() => setAboutOpen(false)} title="About this lead" description={current.business} tall label="About this lead">
          <Stack gap={4}>
            <Row gap={1} wrap>
              {current.industry && <Pill tone="neutral" label={displayIndustry(current.industry)} icon={false} size="sm" variant="outline" />}
              <Pill id={current.callStatus || 'not-called'} list={CALL_STATUSES} size="sm" />
            </Row>
            {current.descriptor && <p className="cc-desc">{current.descriptor}</p>}
            <Row gap={2} wrap>{['website', 'instagram', 'facebook', 'google'].filter(k => current.socials?.[k]).map(k => <Button key={k} variant="secondary" size="md" href={current.socials[k]} target="_blank" rel="noopener noreferrer">{{ website: 'Website', instagram: 'Instagram', facebook: 'Facebook', google: 'Maps' }[k]}</Button>)}</Row>
            <Section title="Intel"><IntelCards lead={current} /></Section>
            <Section title="Notes"><LeadNotes lead={current} onSave={saveNotes} /></Section>
            <Section title="History"><LeadHistory lead={current} /></Section>
          </Stack>
        </Sheet>
      )}
      {editOpen && current && <Sheet open onClose={() => setEditOpen(false)} title="Edit lead" description={current.business} tall width={640}><LeadForm lead={current} onSave={async (v) => { const ok = await patchLead(current._id, v); if (ok) setEditOpen(false); }} onCancel={() => setEditOpen(false)} onDelete={deleteLead} /></Sheet>}
      {newOpen && <Sheet open onClose={() => setNewOpen(false)} title="New lead" tall width={640}><LeadForm creating lead={typeof newOpen === 'object' ? newOpen : undefined} onSave={createLead} onCancel={() => setNewOpen(false)} /></Sheet>}
    </>
  );

  return (
    <div className={`cc-page lay-root${embedded ? ' cc-page--embedded' : ''}`}>
      {mode === 'builder' && (quick ? builderView : listsView)}
      {mode === 'summary' && session && (pending ? <div className="cc-summary" /> : showSkel ? summarySkeleton : <Summary session={session} leadsById={leadsById} onNew={newSession} onDashboard={() => { newSession(); shell?.go('dashboard'); }} onOpenLead={(l) => shell?.openRecord(l)} list={session.listId ? lists.find(l => String(l._id) === String(session.listId)) : null} onRoll={async (l) => { const ok = await listOps?.patchList(l._id, { scheduledFor: tomorrowKey() }); if (ok) { toast.success(`${l.name} rolls into tomorrow, ${listCount(l)} left.`); newSession(); } else toast.error(COPY.error.save); }} onDone={async (l) => { const ok = await listOps?.finishList(l._id); if (ok) { toast.success(`${l.name} done.`); newSession(); } else toast.error(COPY.error.save); }} />)}
      {(mode === 'queue' || mode === 'room') && session && (desktop ? (
        <div className="cc-desk">
          <aside className="cc-desk-left" aria-label="Queue"><ScrollArea bare className="cc-desk-scroll">{queuePanel}</ScrollArea></aside>
          <PageShell className="cc-desk-center">{roomCenter}{bar}</PageShell>
          <aside className="cc-desk-right" aria-label="Notes and history">
            {current && <ScrollArea bare className="cc-desk-scroll"><Stack gap={4}><Section title="Notes"><LeadNotes lead={current} onSave={saveNotes} /></Section><Section title="History"><LeadHistory lead={current} /></Section></Stack></ScrollArea>}
          </aside>
        </div>
      ) : mode === 'queue' ? (
        <PageShell className="cc-shell"><ScrollArea className="cc-queue-scroll">{queuePanel}</ScrollArea>{current && <StickyFooterBar><Button size="lg" full icon={PhoneCall01} onClick={() => goTo(nextIdx >= 0 ? nextIdx : curIdx)} className="cc-resume">{done ? 'Next lead' : 'Open the first lead'}</Button></StickyFooterBar>}</PageShell>
      ) : (
        <PageShell className="cc-shell">{roomCenter}{bar}</PageShell>
      ))}
      {overlays}
      <style>{uiStyles + ccStyles}</style>
    </div>
  );
}

const ccStyles = `
  .cc-page { display: flex; flex: 1; min-width: 0; min-height: 0; width: 100%; color: var(--v-text); }
  .cc-page--embedded { height: 100%; }
  .cc-shell { flex: 1; min-height: 0; }
  .cc-builder { --v-stack-gap: var(--v-space-5); }
  .cc-builder .lay-content { max-width: var(--v-content-w-wide); }
  .cc-kicker { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-red-highlight); }
  .cc-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-display-md); line-height: var(--v-lh-display-md); letter-spacing: var(--v-ls-display-md); text-transform: uppercase; font-weight: var(--v-weight-bold); }
  @media (max-width: 767px) { .cc-title { font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); } }
  .cc-sub, .cc-hint { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .cc-more { display: flex; flex-direction: column; padding: var(--v-space-1) var(--v-space-3); max-height: 320px; overflow-y: auto; }
  .cc-preview { flex-direction: row; align-items: baseline; gap: var(--v-space-3); }
  .cc-preview-n { font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: 1; font-weight: var(--v-weight-bold); }
  .cc-preview-txt { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .cc-start .v-badge { margin-left: var(--v-space-2); background: var(--v-text-on-red); color: var(--v-red-hover); }
  /* Queue */
  .cc-queue { display: flex; flex-direction: column; gap: var(--v-space-3); min-width: 0; }
  .cc-queue-scroll { --v-stack-gap: var(--v-space-3); }
  .cc-qlist { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .cc-qlist > .v-stagger-item { display: contents; }
  .cc-qcard { position: relative; min-width: 0; }
  .cc-qcard.is-done .lc { opacity: 0.55; }
  .cc-qcard.is-next .lc { border-color: var(--v-red); box-shadow: var(--v-glow-red); }
  .cc-qmark { position: absolute; right: var(--v-space-3); bottom: var(--v-space-3); }
  .cc-qnext { position: absolute; top: -8px; left: var(--v-space-3); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-on-red); background: var(--v-red); padding: 2px 8px; border-radius: var(--v-radius-pill); }
  /* Room */
  .cc-room { flex: 1; min-height: 0; padding: var(--v-space-4) var(--v-gutter-r) var(--v-space-4) var(--v-gutter-l); }
  .cc-room-inner { gap: var(--v-space-3); }
  .cc-room-inner > .v-stagger-item { display: contents; }
  .cc-room--empty { display: flex; align-items: center; justify-content: center; padding: var(--v-space-6); }
  .cc-head { gap: var(--v-space-3); transition: box-shadow var(--v-dur-slow) var(--v-ease-out), border-color var(--v-dur-slow) var(--v-ease-out); }
  .cc-head.is-pulse { animation: cc-pulse var(--v-dur-slow) var(--v-ease-out); }
  .cc-head--booked { border-color: var(--v-status-booked-solid); box-shadow: 0 0 0 4px var(--v-status-booked-soft); }
  @keyframes cc-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.015); } 100% { transform: scale(1); } }
  .cc-warn { display: flex; align-items: center; gap: var(--v-space-2); padding: var(--v-space-2) var(--v-space-3); border-radius: var(--v-radius-md); background: var(--v-status-danger-soft); color: var(--v-status-danger-text); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); }
  .cc-head--phone .cc-biz { font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); }
  .cc-head--phone { --v-stack-gap: var(--v-space-2); }
  .cc-about-btn { align-self: flex-start; }
  /* A phone: the session numbers are lines with a divider (label, then the number), not six cards in two columns inside a card. */
  @media (max-width: 767px) { .cc-statgrid { display: flex; flex-direction: column; gap: 0; } .cc-statgrid > .v-card { flex-direction: row-reverse; justify-content: space-between; align-items: baseline; background: transparent; border-width: 0 0 1px; border-radius: 0; padding: var(--v-space-2) 0; box-shadow: none; } }
  .cc-biz { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-3xl); line-height: var(--v-lh-3xl); letter-spacing: var(--v-ls-3xl); text-transform: uppercase; font-weight: var(--v-weight-bold); overflow-wrap: break-word; }
  @media (max-width: 479px) { .cc-biz { font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); } }
  .cc-queue .v-section-text { flex-basis: 120px; }
  .cc-desc { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .cc-askfor { margin: 0; font-size: var(--v-text-md); color: var(--v-text-2); }
  .cc-askfor strong { color: var(--v-text); }
  .cc-head-links .v-btn { padding: 0 var(--v-space-2); }
  .cc-phone { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .cc-phone .v-row > .v-btn--full { flex: 1 1 auto; width: auto; min-width: 0; }
  .cc-phone .v-row > .v-ibtn { flex-shrink: 0; }
  .cc-phone-btn { font-family: var(--v-font-display); font-size: var(--v-text-2xl); letter-spacing: 0.02em; }
  .cc-phone-timer { margin-left: var(--v-space-3); font-family: var(--v-font-body); font-size: var(--v-text-sm); font-variant-numeric: tabular-nums; opacity: 0.85; }
  .cc-phone-none { display: flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap-lg); padding: 0 var(--v-space-4); border-radius: var(--v-radius-lg); background: var(--v-status-danger-soft); color: var(--v-status-danger-text); font-weight: var(--v-weight-semibold); }
  .cc-phone-note { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-3); text-align: center; }
  .cc-predial { gap: var(--v-space-1); }
  /* Outcome bar */
  .cc-outbar { gap: var(--v-space-2); }
  .cc-outs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--v-space-1); width: 100%; max-width: 760px; }
  .cc-out { padding: 0 var(--v-space-1); min-height: var(--v-tap-lg); flex-direction: column; }
  .cc-out .v-btn-inner { flex-direction: column; gap: 2px; }
  .cc-out-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); white-space: normal; text-align: center; }
  .cc-kbd { position: absolute; top: 4px; right: 4px; min-width: 16px; height: 16px; font-size: 10px; padding: 0 3px; }
  .cc-outbar-row2 { width: 100%; max-width: 760px; justify-content: space-between; }
  .cc-pos { font-size: var(--v-text-sm); color: var(--v-text-3); font-variant-numeric: tabular-nums; }
  .cc-keys { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .cc-keys-row { display: flex; align-items: center; gap: var(--v-space-3); font-size: var(--v-text-sm); color: var(--v-text-2); }
  .cc-keys-row kbd { min-width: 32px; }
  /* Summary */
  .cc-summary { --v-stack-gap: var(--v-space-4); flex: 1; }
  .cc-stat-n { display: block; font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: 1; font-weight: var(--v-weight-bold); }
  .cc-stat-l { font-size: var(--v-text-xs); color: var(--v-text-3); font-weight: var(--v-weight-semibold); }
  .cc-ring-sub { font-family: var(--v-font-body); font-size: var(--v-text-xs); color: var(--v-text-3); }
  .cc-winline { flex-direction: row; align-items: center; justify-content: space-between; gap: var(--v-space-3); flex-wrap: wrap; }
  .cc-winline p { margin: 0; font-size: var(--v-text-md); }
  /* Desktop three columns */
  .cc-desk { display: grid; grid-template-columns: 264px minmax(0, 1fr) 280px; flex: 1; min-height: 0; min-width: 0; width: 100%; }
  @media (min-width: 1440px) { .cc-desk { grid-template-columns: var(--v-panel-w) minmax(0, 1fr) 320px; } }
  .cc-desk-left, .cc-desk-right { min-height: 0; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--v-border); background: var(--v-bar); }
  .cc-desk-right { border-right: 0; border-left: 1px solid var(--v-border); }
  .cc-desk-center { min-width: 0; min-height: 0; }
  .cc-desk-scroll { padding: var(--v-space-4); }
  .cc-osheet-form { display: flex; flex-direction: column; gap: var(--v-space-3); }
`;
