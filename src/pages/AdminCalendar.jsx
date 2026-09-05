import { useEffect, useMemo, useRef, useState } from 'react';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Button, IconButton, Chip, Pill, ListRow, IconTile, Menu, Popover, Sheet, Input, Avatar, SegmentedControl, EmptyState, ErrorState, Stagger, SkeletonBlock, useDelayedLoading, useMediaQuery, useToast, useRetry,
} from '../ui';
import { COPY } from '../shared/copy';
import { useShell, useTopBar } from '../shell/ShellContext';
import CallbackPicker from '../components/CallbackPicker';
import LeadForm from '../components/LeadForm';
import { buildEvents, eventsOn, sameDay, KIND_LABEL } from '../lib/events';
import { normalizeStage } from '../shared/semantics';
import { matchesSearch } from '../lib/leads';
import { defaultLead } from '../lib/defaultLead';
import { formatPhone } from '../shared/phone';
import { toLocalInput } from '../lib/calls';

/* Calendar (Prompt 9): Day (mobile first), Week (desktop first), Month.
 * One event source: buildEvents in src/lib/events.js. */
const VIEW_KEY = 'vz_cal_view';
const HOUR_PX = 56;
const START_H = 7;
const END_H = 21;
const KINDS = ['meeting', 'callback', 'calendly', 'scraper', 'bill'];
const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function EventRow({ e, onOpen, onReschedule, onDone, onLink }) {
  const items = [
    e.leadId ? { id: 'open', label: 'Open lead', icon: 'ArrowRight', onSelect: () => onOpen(e) } : { id: 'link', label: 'Link to lead', icon: 'Users01', onSelect: () => onLink(e) },
    ...(e.kind === 'meeting' || e.kind === 'callback' ? [{ id: 're', label: 'Reschedule', icon: 'Calendar', onSelect: () => onReschedule(e) }] : []),
    ...(e.kind === 'callback' ? [{ id: 'done', label: 'Mark done (log no answer)', icon: 'Check', onSelect: () => onDone(e) }] : []),
    ...(e.link ? [{ id: 'join', label: 'Join link', icon: 'ArrowRight', onSelect: () => window.open(e.link, '_blank', 'noopener') }] : []),
  ];
  return (
    <ListRow className={`cal-row cal-row--${e.tone}`} leading={<IconTile icon={e.kind === 'callback' ? 'PhoneIncoming01' : e.kind === 'scraper' ? 'Users01' : e.kind === 'bill' ? 'CurrencyDollar' : e.kind === 'planfinal' ? 'CreditCard01' : 'CalendarCheck01'} tone={e.tone} size="sm" glow={e.overdue} />}
      title={e.title} subtitle={e.subtitle} meta={e.allDay ? 'All day' : fmtTime(e.at)} onClick={() => (e.leadId ? onOpen(e) : e.kind === 'calendly' ? onLink(e) : undefined)} chevron={false}
      trailing={<Menu label="Event actions" items={items} />} />
  );
}

export default function AdminCalendar({ leads, loading, error, onRetry, onPatch, onCreate, onRefresh, openId }) {
  const shell = useShell();
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const E = (k) => COPY.empty[k];
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [view, setView] = useState(() => readLS(VIEW_KEY, null));
  const mode = view || (desktop ? 'week' : 'day');
  const setMode = (m) => { setView(m); try { localStorage.setItem(VIEW_KEY, JSON.stringify(m)); } catch { /* fine */ } };
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [kinds, setKinds] = useState(() => new Set());
  const [pop, setPop] = useState(null); // { e, anchor }
  const [addSlot, setAddSlot] = useState(null); // Date
  const [addLead, setAddLead] = useState(null);
  const [q, setQ] = useState('');
  const [linkEv, setLinkEv] = useState(null);
  const [createEv, setCreateEv] = useState(null);
  const [now, setNow] = useState(Date.now());
  const showSkel = useDelayedLoading(loading);
  const pending = loading && !showSkel;
  const touch = useRef(null);
  useTopBar(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60e3); return () => clearInterval(t); }, []);

  const calendly = shell?.calendly || { configured: null, events: [] };
  const projects = shell?.projects || [];
  const all = useMemo(() => buildEvents(leads, calendly.events, now, projects), [leads, calendly.events, now, projects]);
  const events = useMemo(() => all.filter(e => !kinds.size || kinds.has(e.kind) || (e.kind === 'planfinal' && kinds.has('bill'))), [all, kinds]);
  const dayEvents = useMemo(() => { const list = eventsOn(events, cursor); return [...list.filter(e => e.overdue), ...list.filter(e => !e.overdue)]; }, [events, cursor]);
  const overdueAll = useMemo(() => events.filter(e => e.kind === 'callback' && e.overdue && !sameDay(e.at, cursor)), [events, cursor]);
  const week = useMemo(() => { const s = startOfWeek(cursor); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }, [cursor]);
  const monthDays = useMemo(() => { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const s = startOfWeek(first); return Array.from({ length: 42 }, (_, i) => addDays(s, i)); }, [cursor]);
  const title = mode === 'day' ? cursor.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const step = (d) => setCursor(c => addDays(c, mode === 'day' ? d : mode === 'week' ? 7 * d : 0));
  const stepMonth = (d) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + d, 1));
  const prev = () => (mode === 'month' ? stepMonth(-1) : step(-1));
  const next = () => (mode === 'month' ? stepMonth(1) : step(1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]') || pop || addSlot || linkEv || createEv) return;
      if (e.key === 'ArrowLeft') prev(); else if (e.key === 'ArrowRight') next();
      else if (e.key === 't' || e.key === 'T') setCursor(startOfDay(new Date()));
      else if (e.key === 'd' || e.key === 'D') setMode('day'); else if (e.key === 'w' || e.key === 'W') setMode('week'); else if (e.key === 'm' || e.key === 'M') setMode('month');
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const openLead = (e) => { if (e.lead) shell?.openRecord(e.lead); };
  const reschedule = (e) => { if (e.kind === 'callback') { setAddSlot(new Date(e.at)); setAddLead(e.lead); } else if (e.lead) shell?.openRecord(e.lead); };
  const markDone = async (e) => {
    const l = e.lead; if (!l) return;
    const entry = { at: new Date().toISOString(), outcome: 'no-answer', note: 'Marked done from the calendar', meeting: '', email: '' };
    const ok = await onPatch(l._id, { callStatus: 'no-answer', callLog: [...(l.callLog || []), entry], callbackAt: '' });
    if (ok) toast.success(`Logged no answer for ${l.business}.`); else toast.error(COPY.error.save);
  };
  const saveCallback = async (iso) => {
    const l = addLead; if (!l) return;
    const ok = await onPatch(l._id, { callbackAt: iso || '', ...(iso ? { callStatus: 'callback' } : {}) });
    if (ok) { toast.success(iso ? `Callback set for ${l.business}.` : 'Callback cleared.'); setAddSlot(null); setAddLead(null); } else toast.error(COPY.error.save);
  };
  const linkTo = async (lead) => {
    const ev = linkEv?.calendly; if (!ev || !lead) return;
    const set = { calendlyEventUri: ev.uri };
    if (!lead.meeting?.date) { const li = toLocalInput(new Date(ev.at)); set.meeting = { date: li.date, time: li.time, type: 'call', location: ev.join || '' }; }
    const ok = await onPatch(lead._id, set);
    if (ok) { toast.success(`Linked to ${lead.business}.`); setLinkEv(null); setQ(''); } else toast.error(COPY.error.save);
  };
  const createFromEv = async (values) => { const ok = await onCreate(defaultLead(values)); if (ok) { toast.success(`Added ${values.business}.`); setCreateEv(null); onRefresh?.(); } else toast.error(COPY.error.create); };
  const searchLeads = (query) => leads.filter(l => normalizeStage(l) !== 'lost' && matchesSearch(l, query)).slice(0, 12);

  /* Views */
  const dayStrip = (
    <div className="cal-strip v-reveal" role="group" aria-label="Week" onTouchStart={(e) => { touch.current = e.touches[0].clientX; }} onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX); touch.current = null; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); }}>
      {week.map(d => { const has = eventsOn(events, d); const on = sameDay(d, cursor); const isToday = sameDay(d, now); return (
        <button key={+d} type="button" className={`cal-strip-day${on ? ' is-on' : ''}${isToday ? ' is-today' : ''}`} onClick={() => setCursor(d)} aria-pressed={on} aria-label={d.toDateString()}>
          <span className="cal-strip-dow">{DOW[(d.getDay() + 6) % 7]}</span><span className="cal-strip-n">{d.getDate()}</span>
          <span className="cal-strip-dots">{[...new Set(has.map(e => e.tone))].slice(0, 3).map(t => <span key={t} className="cal-dot" style={{ background: `var(--v-status-${t}-solid)` }} />)}</span>
        </button>); })}
    </div>
  );
  const dayView = (
    <Stack gap={3} onTouchStart={(e) => { touch.current = e.touches[0].clientX; }} onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX); touch.current = null; if (Math.abs(dx) > 80) step(dx < 0 ? 1 : -1); }}>
      {dayStrip}
      {overdueAll.length > 0 && <Card level={2} padding={3} glow="danger"><p className="pb-card-h">Overdue callbacks</p><Stack gap={2}>{overdueAll.slice(0, 5).map(e => <EventRow key={e.id} e={e} onOpen={openLead} onReschedule={reschedule} onDone={markDone} onLink={setLinkEv} />)}</Stack></Card>}
      {dayEvents.length ? <Stagger className="v-stack" style={{ gap: 'var(--v-space-2)' }}>{dayEvents.map(e => <EventRow key={e.id} e={e} onOpen={openLead} onReschedule={reschedule} onDone={markDone} onLink={setLinkEv} />)}</Stagger>
        : <Card><EmptyState icon="Calendar" title={E('calendar.day').title} description={E('calendar.day').description} action={{ label: E('calendar.day').action, icon: PhoneCall01, onClick: () => shell?.go('calls') }} secondary={{ label: E('calendar.day').secondary, onClick: () => { setAddSlot(new Date(cursor.getTime() + 9 * 3600e3)); setAddLead(null); } }} /></Card>}
    </Stack>
  );
  const hours = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i);
  const posOf = (t) => { const d = new Date(t); return ((d.getHours() + d.getMinutes() / 60) - START_H) * HOUR_PX; };
  const weekView = (
    <div className="cal-week" role="grid" aria-label={`Week of ${week[0].toLocaleDateString([], { month: 'long', day: 'numeric' })}`}>
      <div className="cal-week-head" role="row">
        <div className="cal-gutter" role="columnheader"><span className="v-sr-only">Time</span></div>
        {week.map(d => <div key={+d} role="columnheader" className={`cal-week-day${sameDay(d, now) ? ' is-today' : ''}`}><button type="button" className="cal-week-daybtn" onClick={() => { setCursor(d); setMode('day'); }} aria-label={d.toDateString()}>{DOW[(d.getDay() + 6) % 7]} <strong>{d.getDate()}</strong></button><div className="cal-allday">{eventsOn(events, d).filter(e => e.allDay).map(e => <Pill key={e.id} tone={e.tone} label={e.title} size="sm" icon={false} className="cal-allday-pill" />)}</div></div>)}
      </div>
      <ScrollArea bare className="cal-week-scroll">
        <div className="cal-grid" style={{ height: hours.length * HOUR_PX }} role="row">
          <div className="cal-gutter" role="rowheader" aria-label="Hours">{hours.map(h => <div key={h} className="cal-hour" style={{ top: (h - START_H) * HOUR_PX }}>{new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })}</div>)}</div>
          {week.map(d => (
            <div key={+d} role="gridcell" aria-label={d.toDateString()} className={`cal-col${sameDay(d, now) ? ' is-today' : ''}`} onClick={(ev) => { if (ev.target !== ev.currentTarget) return; const rect = ev.currentTarget.getBoundingClientRect(); const h = START_H + Math.floor((ev.clientY - rect.top) / HOUR_PX); const slot = new Date(d); slot.setHours(h, 0, 0, 0); setAddSlot(slot); setAddLead(null); }}>
              {hours.map(h => <div key={h} className="cal-line" style={{ top: (h - START_H) * HOUR_PX }} />)}
              {sameDay(d, now) && <div className="cal-now" style={{ top: posOf(now) }} />}
              {eventsOn(events, d).filter(e => !e.allDay).map((e, bi) => (
                <button key={e.id} type="button" className={`cal-block cal-block--${e.tone} v-reveal`} style={{ top: Math.max(0, posOf(e.at)), height: Math.max(28, posOf(e.end) - posOf(e.at)), animationDelay: `calc(${Math.min(bi, 8)} * var(--v-stagger))` }} onClick={(ev) => { ev.stopPropagation(); setPop({ e, anchor: ev.currentTarget }); }} aria-label={`${e.title}, ${fmtTime(e.at)}`}>
                  <span className="cal-block-t">{fmtTime(e.at)}</span><span className="cal-block-title lay-truncate">{e.title.replace(/^(Meeting|Callback|Overdue callback|Calendly): /, '')}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
  /* The month is a grid (Prompt 15): weekday column headers, one row per week, each day a gridcell holding its button. */
  const monthView = (
    <div className="cal-month" role="grid" aria-label={`${cursor.toLocaleDateString([], { month: 'long', year: 'numeric' })}, by week`}>
      <div role="row" className="cal-month-row">{DOW.map(d => <div key={d} role="columnheader" className="cal-month-dow">{d}</div>)}</div>
      {Array.from({ length: 6 }, (_, w) => (
        <div key={w} role="row" className="cal-month-row">
          {monthDays.slice(w * 7, w * 7 + 7).map((d, di) => { const i = w * 7 + di; const list = eventsOn(events, d); const other = d.getMonth() !== cursor.getMonth(); return (
            <div key={+d} role="gridcell" className="cal-month-cell">
              <button type="button" className={`cal-month-day v-reveal${other ? ' is-other' : ''}${sameDay(d, now) ? ' is-today' : ''}`} style={{ animationDelay: `calc(${Math.floor(i / 7)} * var(--v-stagger))` }} onClick={() => { setCursor(d); setMode('day'); }} aria-label={`${d.toDateString()}, ${list.length} event${list.length === 1 ? '' : 's'}`} aria-current={sameDay(d, now) ? 'date' : undefined}>
                <span className="cal-month-n">{d.getDate()}</span>
                {list.slice(0, 3).map(e => <span key={e.id} className={`cal-month-pill cal-block--${e.tone}`}>{e.allDay ? e.title : `${fmtTime(e.at)} ${e.title.replace(/^(Meeting|Callback|Overdue callback|Calendly): /, '')}`}</span>)}
                {list.length > 3 && <span className="cal-month-more">+{list.length - 3}</span>}
              </button>
            </div>); })}
        </div>
      ))}
    </div>
  );

  /* Skeletons shaped like each view (Prompt 14). */
  const daySkeleton = <Stack gap={2} aria-busy="true">{dayStrip}{[1, 2, 3].map(i => <ListRow.Skeleton key={i} />)}</Stack>;
  const weekSkeleton = (
    <div className="cal-week" aria-busy="true">
      <div className="cal-week-head"><div className="cal-gutter" />{week.map(d => <div key={+d} className="cal-week-day"><SkeletonBlock width={48} height={20} style={{ margin: '6px auto' }} /></div>)}</div>
      <div className="cal-week-scroll lay-scroll" style={{ padding: 0 }}>
        <div className="cal-grid" style={{ height: hours.length * HOUR_PX }}>
          <div className="cal-gutter">{hours.map(h => <div key={h} className="cal-hour" style={{ top: (h - START_H) * HOUR_PX }}><SkeletonBlock width={28} height={10} /></div>)}</div>
          {week.map((d, i) => <div key={+d} className="cal-col" style={{ cursor: 'default' }}>{hours.map(h => <div key={h} className="cal-line" style={{ top: (h - START_H) * HOUR_PX }} />)}{[0, 1].map(j => <SkeletonBlock key={j} width="auto" height={44} style={{ position: 'absolute', left: 2, right: 2, top: (((i * 3 + j * 6) % 11) + 1) * HOUR_PX + 4 }} />)}</div>)}
        </div>
      </div>
    </div>
  );
  const monthSkeleton = (
    <div className="cal-month" aria-busy="true" aria-hidden="true">
      <div className="cal-month-row">{DOW.map(d => <div key={d} className="cal-month-dow">{d}</div>)}</div>
      {Array.from({ length: 6 }, (_, w) => <div key={w} className="cal-month-row">{monthDays.slice(w * 7, w * 7 + 7).map((d, di) => <div key={+d} className="cal-month-cell"><div className="cal-month-day" style={{ cursor: 'default' }}><SkeletonBlock width={16} height={12} />{(w * 7 + di) % 3 === 0 && <SkeletonBlock height={14} radius={3} />}</div></div>)}</div>)}
    </div>
  );
  const nothingAtAll = !loading && !all.length && (
    <Card><EmptyState size="sm" icon="Calendar" title={E('calendar.range').title} description={E('calendar.range').description} action={{ label: E('calendar.range').action, icon: PhoneCall01, onClick: () => shell?.go('calls') }} /></Card>
  );

  const popRef = useRef(null);
  useEffect(() => { popRef.current = pop?.anchor || null; }, [pop]);

  return (
    <PageShell className="aa-main aa-main--wide cal-shell">
      <ScrollArea wide className="cal-page">
        <Section title={title} loading={loading} description={loading ? undefined : mode === 'day' ? `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : undefined}
          action={<Row gap={2} wrap>
            <Row gap={1}><IconButton icon={ChevronLeft} label="Previous" variant="secondary" onClick={prev} /><Button variant="secondary" onClick={() => setCursor(startOfDay(new Date()))}>Today</Button><IconButton icon={ChevronRight} label="Next" variant="secondary" onClick={next} /></Row>
            <SegmentedControl size="sm" label="View" options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} value={mode} onChange={setMode} />
            <Button icon={Plus} onClick={() => { setAddSlot(new Date(cursor.getTime() + 9 * 3600e3)); setAddLead(null); }} className="cal-add">Callback</Button>
          </Row>}>
          <Row gap={2} wrap className="cal-filters">{KINDS.map(k => <Chip key={k} label={KIND_LABEL[k]} count={all.filter(e => e.kind === k).length} selected={kinds.has(k)} onClick={() => setKinds(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })} disabled={k === 'calendly' && calendly.configured === false} />)}{calendly.configured === false && <span className="cal-hint">Calendly is not connected (Settings).</span>}</Row>
        </Section>
        {pending ? null : showSkel ? (mode === 'day' ? daySkeleton : mode === 'week' ? weekSkeleton : monthSkeleton) : error && !leads.length ? <Card><ErrorState title={COPY.error.calendar.title} description={COPY.error.calendar.description} onRetry={retry} retrying={retrying} /></Card> : mode === 'day' ? dayView : <>{nothingAtAll}{mode === 'week' ? weekView : monthView}</>}
      </ScrollArea>
      <Popover open={!!pop} onClose={() => setPop(null)} anchorRef={popRef} width={300} trap label="Event">
        {pop && <div className="cal-pop"><Stack gap={2}><Row gap={2}><IconTile icon={pop.e.kind === 'callback' ? 'PhoneIncoming01' : 'CalendarCheck01'} tone={pop.e.tone} size="sm" /><Stack gap={0}><strong>{pop.e.title}</strong><span className="cal-hint">{fmtTime(pop.e.at)} to {fmtTime(pop.e.end)}{pop.e.subtitle ? `, ${pop.e.subtitle}` : ''}</span></Stack></Row>
          <Row gap={1} wrap>{pop.e.leadId ? <Button size="md" onClick={() => { setPop(null); openLead(pop.e); }}>Open lead</Button> : <Button size="md" onClick={() => { setPop(null); setLinkEv(pop.e); }}>Link to lead</Button>}{(pop.e.kind === 'meeting' || pop.e.kind === 'callback') && <Button variant="secondary" size="md" onClick={() => { setPop(null); reschedule(pop.e); }}>Reschedule</Button>}{pop.e.kind === 'callback' && <Button variant="ghost" size="md" onClick={() => { setPop(null); markDone(pop.e); }}>Done</Button>}</Row></Stack></div>}
      </Popover>
      {addSlot && (addLead ? <CallbackPicker open onClose={() => { setAddSlot(null); setAddLead(null); }} value={addSlot.toISOString()} business={addLead.business} onSave={saveCallback} />
        : <Sheet open onClose={() => setAddSlot(null)} title="Add a callback" description={addSlot.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}>
          <Input placeholder="Search leads" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" data-autofocus className="cal-search" />
          <Stack gap={1}>{searchLeads(q).map(l => <ListRow key={l._id} leading={<Avatar name={l.business} size="sm" />} title={l.business} subtitle={formatPhone(l.phone) || 'No phone'} onClick={() => setAddLead(l)} />)}</Stack>
        </Sheet>)}
      {linkEv && (
        <Sheet open onClose={() => { setLinkEv(null); setQ(''); }} title="Link to lead" description={linkEv.calendly?.name ? `${linkEv.calendly.name}${linkEv.calendly.email ? `, ${linkEv.calendly.email}` : ''}` : 'Calendly booking'}
          footer={<Button variant="secondary" icon={Plus} onClick={() => { setCreateEv(linkEv); setLinkEv(null); }}>Create lead</Button>}>
          <Input placeholder="Search leads" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" data-autofocus className="cal-search" />
          <Stack gap={1}>{searchLeads(q).map(l => <ListRow key={l._id} leading={<Avatar name={l.business} size="sm" />} title={l.business} subtitle={formatPhone(l.phone) || l.email || ''} onClick={() => linkTo(l)} />)}</Stack>
        </Sheet>
      )}
      {createEv && <Sheet open onClose={() => setCreateEv(null)} title="New lead from Calendly" tall width={640}><LeadForm creating lead={{ business: createEv.calendly?.name || '', askFor: createEv.calendly?.name || '', email: createEv.calendly?.email || '', phone: createEv.calendly?.phone || '' }} onSave={createFromEv} onCancel={() => setCreateEv(null)} /></Sheet>}
      <style>{calStyles}</style>
    </PageShell>
  );
}

const calStyles = `
  .cal-shell.aa-main { display: flex; flex-direction: column; }
  .cal-page { --v-stack-gap: var(--v-space-4); --v-content-w-wide: 1400px; }
  .cal-page .lay-content--wide { max-width: var(--v-content-w-wide); }
  .cal-page .v-section-title { font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); color: var(--v-text); }
  .cal-hint { font-size: var(--v-text-sm); color: var(--v-text-3); }
  .cal-strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--v-space-1); }
  .cal-strip-day { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: var(--v-tap-lg); padding: var(--v-space-1) 0; border: 1px solid var(--v-border); border-radius: var(--v-radius-md); background: var(--v-surface-1); color: var(--v-text-2); cursor: pointer; font-family: var(--v-font-body); }
  .cal-strip-day.is-on { border-color: var(--v-red); background: var(--v-red-soft); color: var(--v-text); }
  .cal-strip-day.is-today .cal-strip-n { color: var(--v-red-highlight); }
  .cal-strip-day:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .cal-strip-dow { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: var(--v-weight-bold); }
  .cal-strip-n { font-size: var(--v-text-lg); font-weight: var(--v-weight-bold); }
  .cal-strip-dots { display: flex; gap: 3px; min-height: 6px; }
  .cal-dot { width: 6px; height: 6px; border-radius: 50%; }
  .cal-row--danger { border-color: color-mix(in srgb, var(--v-status-danger-text) 40%, transparent); }
  /* Week */
  .cal-week { display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--v-border); border-radius: var(--v-radius-lg); background: var(--v-surface-1); overflow: hidden; }
  .cal-week-head { display: grid; grid-template-columns: 56px repeat(7, minmax(0, 1fr)); border-bottom: 1px solid var(--v-border); }
  .cal-week-day { display: flex; flex-direction: column; gap: 2px; padding: var(--v-space-1); min-width: 0; border-left: 1px solid var(--v-border); }
  .cal-week-day.is-today .cal-week-daybtn { color: var(--v-red-highlight); }
  .cal-week-daybtn { border: 0; background: transparent; color: var(--v-text-2); cursor: pointer; font-family: var(--v-font-body); font-size: var(--v-text-xs); text-transform: uppercase; letter-spacing: var(--v-ls-xs); min-height: var(--v-tap); border-radius: var(--v-radius-sm); }
  .cal-week-daybtn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .cal-week-daybtn strong { color: var(--v-text); font-size: var(--v-text-md); }
  .cal-allday { display: flex; flex-direction: column; gap: 2px; min-height: 4px; }
  .cal-allday-pill { max-width: 100%; }
  .cal-week-scroll { max-height: 70vh; }
  .cal-grid { display: grid; grid-template-columns: 56px repeat(7, minmax(0, 1fr)); position: relative; }
  .cal-gutter { position: relative; }
  .cal-hour { position: absolute; right: var(--v-space-2); transform: translateY(-50%); font-size: 10px; color: var(--v-text-3); }
  .cal-col { position: relative; border-left: 1px solid var(--v-border); min-width: 0; cursor: cell; }
  .cal-col.is-today { background: color-mix(in srgb, var(--v-red) 4%, transparent); }
  .cal-line { position: absolute; left: 0; right: 0; height: 1px; background: var(--v-border); pointer-events: none; }
  .cal-now { position: absolute; left: 0; right: 0; height: 2px; background: var(--v-red); z-index: 2; pointer-events: none; box-shadow: var(--v-glow-red); }
  .cal-block { position: absolute; left: 2px; right: 2px; display: flex; flex-direction: column; gap: 1px; padding: 2px 6px; border-radius: var(--v-radius-sm); border: 0; border-left: 3px solid var(--v-status-neutral-solid); background: var(--v-status-neutral-soft); color: var(--v-status-neutral-text); text-align: left; cursor: pointer; overflow: hidden; font-family: var(--v-font-body); z-index: 1; }
  .cal-block:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 1px; }
  .cal-block--booked { border-left-color: var(--v-status-booked-solid); background: var(--v-status-booked-soft); color: var(--v-status-booked-text); }
  .cal-block--callback { border-left-color: var(--v-status-callback-solid); background: var(--v-status-callback-soft); color: var(--v-status-callback-text); }
  .cal-block--danger { border-left-color: var(--v-status-danger-solid); background: var(--v-status-danger-soft); color: var(--v-status-danger-text); }
  .cal-block--new { border-left-color: var(--v-status-new-solid); background: var(--v-status-new-soft); color: var(--v-status-new-text); }
  .cal-block-t { font-size: 10px; font-weight: var(--v-weight-bold); }
  .cal-block-title { font-size: var(--v-text-xs); font-weight: var(--v-weight-semibold); }
  /* Month */
  .cal-month { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
  .cal-month-row, .cal-month-cell { display: contents; }
  .cal-month-dow { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); text-align: center; padding: var(--v-space-1) 0; }
  .cal-month-day { display: flex; flex-direction: column; align-items: stretch; gap: 2px; min-height: 84px; width: 100%; padding: var(--v-space-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-sm); background: var(--v-surface-1); color: var(--v-text); cursor: pointer; font-family: var(--v-font-body); text-align: left; min-width: 0; overflow: hidden; }
  .cal-month-day.is-other { opacity: 0.45; }
  .cal-month-day.is-today .cal-month-n { color: var(--v-red-highlight); }
  .cal-month-day:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 1px; }
  .cal-month-n { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); }
  .cal-month-pill { font-size: 10px; line-height: 14px; padding: 0 4px; border-radius: 3px; border-left: 2px solid; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cal-month-more { font-size: 10px; color: var(--v-text-3); }
  @media (max-width: 767px) { .cal-month-day { min-height: 56px; flex-direction: row; flex-wrap: wrap; align-content: flex-start; gap: 3px; } .cal-month-n { width: 100%; } .cal-month-pill { width: 7px; height: 7px; padding: 0; border-radius: 50%; border-left-width: 0; font-size: 0; color: transparent; background: currentColor; } .cal-month-pill.cal-block--booked { background: var(--v-status-booked-solid); } .cal-month-pill.cal-block--callback { background: var(--v-status-callback-solid); } .cal-month-pill.cal-block--danger { background: var(--v-status-danger-solid); } .cal-month-pill.cal-block--new { background: var(--v-status-new-solid); } }
  .cal-pop { padding: var(--v-space-3); }
  .cal-search { margin-bottom: var(--v-space-2); }
`;
