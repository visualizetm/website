import { useState, useEffect, useMemo, useRef } from 'react';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import CalendarCheck01 from '@untitled-ui/icons-react/build/esm/CalendarCheck01';
import CalendarPlus01 from '@untitled-ui/icons-react/build/esm/CalendarPlus01';
import Calendar from '@untitled-ui/icons-react/build/esm/Calendar';
import CurrencyDollar from '@untitled-ui/icons-react/build/esm/CurrencyDollar';
import ClipboardCheck from '@untitled-ui/icons-react/build/esm/ClipboardCheck';
import LinkExternal01 from '@untitled-ui/icons-react/build/esm/LinkExternal01';
import Trophy01 from '@untitled-ui/icons-react/build/esm/Trophy01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import AlertTriangle from '@untitled-ui/icons-react/build/esm/AlertTriangle';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import PhoneOutgoing01 from '@untitled-ui/icons-react/build/esm/PhoneOutgoing01';
import { ScrollArea, StickyFooterBar } from '../components/AdminLayout';
import { SocialButtons } from '../components/SocialLinks';
import {
  effectiveStage, SERVICES, serviceLabel, MEETING_TYPES, PLANS, planLabel,
  monthlyOf, PROJECT_CAP, meetingDate, meetingCountdown, prepStatus, PREP_META,
  calendarUrl,
} from '../lib/booked';
import { formatPhone } from '../lib/phone';

const telOf = (lead) => lead?.phone ? `tel:${lead.phone.replace(/[^0-9+]/g, '')}` : null;
const fmtLogTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const fmtMeeting = (lead) => {
  const d = meetingDate(lead);
  if (!d) return null;
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const OUTCOME_COLORS = { booked: '#22c55e', callback: '#60a5fa', no: '#ef4444', 'no-answer': '#f59e0b', 'not-called': '#8a8a8a' };
const OUTCOME_LABELS = { booked: 'Booked', callback: 'Callback', no: 'No', 'no-answer': 'No answer', 'not-called': 'Not called' };

function PrepPill({ lead }) {
  const s = PREP_META[prepStatus(lead)];
  return (
    <span className="bk-prep" style={{ '--sc': s.color }}>
      <span className="bk-prep-dot" />{s.label}
    </span>
  );
}

function Fold({ title, note, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`bk-fold${open ? ' is-open' : ''}`}>
      <button type="button" className="bk-fold-head" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="bk-fold-title">{title}</span>
        {note != null && <span className="bk-fold-note">{note}</span>}
        <ChevronDown width={15} height={15} className="bk-fold-chev" />
      </button>
      {open && <div className="bk-fold-body">{children}</div>}
    </section>
  );
}

function LogList({ lead }) {
  const log = [...(lead.callLog || [])].reverse();
  if (!log.length) return <p className="bk-muted">No calls logged.</p>;
  return (
    <ul className="bk-log">
      {log.map((e, i) => (
        <li key={i} className="bk-log-row" style={{ '--sc': OUTCOME_COLORS[e.outcome] || '#8a8a8a' }}>
          <span className="bk-log-dot" />
          <div className="bk-log-main">
            <div className="bk-log-top">
              <span className="bk-log-outcome">{OUTCOME_LABELS[e.outcome] || e.outcome}</span>
              <span className="bk-log-time">{fmtLogTime(e.at)}</span>
            </div>
            {e.meeting && <p className="bk-log-note"><strong>Meeting:</strong> {e.meeting}</p>}
            {e.note && <p className="bk-log-note">{e.note}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Detail workspace for one booked lead ──────────────────────── */

function BookedDetail({ lead, onPatch, onClose, onClosedOut }) {
  const [pricing, setPricing] = useState(lead.pricingOptions || []);
  const [pricingDirty, setPricingDirty] = useState(false);
  const [urls, setUrls] = useState({ demoUrl: lead.conceptsTracker?.demoUrl || '', driveUrl: lead.conceptsTracker?.driveUrl || '' });
  const [urlsDirty, setUrlsDirty] = useState(false);
  const [prep, setPrep] = useState(lead.prepNotes || '');
  const [prepState, setPrepState] = useState('idle');
  const [newConcept, setNewConcept] = useState('');
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const meetingRef = useRef(null);

  useEffect(() => {
    setPricing(lead.pricingOptions || []);
    setPricingDirty(false);
    setUrls({ demoUrl: lead.conceptsTracker?.demoUrl || '', driveUrl: lead.conceptsTracker?.driveUrl || '' });
    setUrlsDirty(false);
    setPrep(lead.prepNotes || '');
    setPrepState('idle');
    setLostOpen(false);
    setLostReason('');
  }, [lead._id]);

  const meeting = lead.meeting || { date: '', time: '', type: 'call' };
  const tracker = lead.conceptsTracker || { items: [], demoUrl: '', driveUrl: '' };
  const services = lead.servicesPlanned || [];
  const countdown = meetingCountdown(lead);
  const gcal = calendarUrl(lead);

  const setMeeting = (k, v) => onPatch(lead._id, { meeting: { ...meeting, [k]: v } });

  const toggleService = (id) => onPatch(lead._id, {
    servicesPlanned: services.includes(id) ? services.filter(s => s !== id) : [...services, id],
  });

  const saveTracker = (next) => onPatch(lead._id, { conceptsTracker: { ...tracker, ...next } });
  const toggleConcept = (i) => saveTracker({
    items: tracker.items.map((it, j) => j === i ? { ...it, done: !it.done } : it),
  });
  const addConcept = () => {
    const label = newConcept.trim();
    if (!label) return;
    setNewConcept('');
    saveTracker({ items: [...(tracker.items || []), { label, done: false }] });
  };
  const removeConcept = (i) => saveTracker({ items: tracker.items.filter((_, j) => j !== i) });

  const addPricing = () => {
    if (pricing.length >= 3) return;
    const presets = ['Starter', 'Recommended', 'Premium'];
    setPricing(p => [...p, { label: presets[p.length] || 'Option', price: 0, plan: 'full', retainer: '', notes: '' }]);
    setPricingDirty(true);
  };
  const setOpt = (i, k, v) => { setPricing(p => p.map((o, j) => j === i ? { ...o, [k]: v } : o)); setPricingDirty(true); };
  const removeOpt = (i) => { setPricing(p => p.filter((_, j) => j !== i)); setPricingDirty(true); };
  const savePricing = async () => {
    const ok = await onPatch(lead._id, { pricingOptions: pricing });
    if (ok) setPricingDirty(false);
  };

  const savePrep = async () => {
    setPrepState('saving');
    const ok = await onPatch(lead._id, { prepNotes: prep });
    setPrepState(ok ? 'saved' : 'dirty');
    if (ok) setTimeout(() => setPrepState(s => s === 'saved' ? 'idle' : s), 1500);
  };

  const markWon = async () => {
    const ok = await onPatch(lead._id, {
      stage: 'won',
      bookedOutcome: { result: 'won', reason: '', at: new Date().toISOString() },
    });
    if (ok) onClosedOut('won');
  };
  const markLost = async () => {
    const ok = await onPatch(lead._id, {
      stage: 'lost',
      bookedOutcome: { result: 'lost', reason: lostReason.trim(), at: new Date().toISOString() },
    });
    if (ok) { setLostOpen(false); onClosedOut('lost'); }
  };
  const reschedule = () => {
    onPatch(lead._id, { meeting: { ...meeting, date: '', time: '' } });
    meetingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      <ScrollArea bare className="bk-scroll">
        <div className="bk-detail lay-content">
          <div className="bk-top">
            <button type="button" className="bk-back" onClick={onClose}>
              <ArrowLeft width={15} height={15} /> Booked
            </button>
            {countdown && <span className="bk-countdown">{countdown}</span>}
          </div>

          <header className="bk-head">
            <div className="bk-head-meta">
              <PrepPill lead={lead} />
              {lead.industry && <span className="bk-industry">{lead.industry}</span>}
            </div>
            <h1 className="bk-biz display">{lead.business}</h1>
            {lead.askFor && <p className="bk-askfor">Ask for {lead.askFor.replace(/^Ask for /i, '')}</p>}
          </header>

          {telOf(lead) && (
            <a href={telOf(lead)} className="bk-phone">
              <PhoneCall01 width={20} height={20} />
              <span>{formatPhone(lead.phone)}</span>
              <span className="bk-phone-tap">Tap to call</span>
            </a>
          )}

          <SocialButtons socials={lead.socials} />

          {/* Meeting */}
          <section className="bk-block" ref={meetingRef}>
            <h2 className="bk-block-h"><Calendar width={15} height={15} /> Meeting</h2>
            <div className="bk-meeting-grid">
              <label className="bk-field">
                <span>Date</span>
                <input type="date" className="aa-input" value={meeting.date || ''} onChange={e => setMeeting('date', e.target.value)} />
              </label>
              <label className="bk-field">
                <span>Time</span>
                <input type="time" className="aa-input" value={meeting.time || ''} onChange={e => setMeeting('time', e.target.value)} />
              </label>
              <label className="bk-field">
                <span>Type</span>
                <select className="aa-input" value={meeting.type || 'call'} onChange={e => setMeeting('type', e.target.value)}>
                  {MEETING_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
            </div>
            <div className="bk-meeting-foot">
              {fmtMeeting(lead)
                ? <span className="bk-meeting-when"><CalendarCheck01 width={14} height={14} /> {fmtMeeting(lead)}{countdown ? ` · ${countdown}` : ''}</span>
                : <span className="bk-muted">No meeting time set yet.</span>}
              {gcal && (
                <a className="aa-btn" href={gcal} target="_blank" rel="noopener noreferrer">
                  <CalendarPlus01 width={14} height={14} /> Add to calendar
                </a>
              )}
            </div>
          </section>

          {/* Services planner */}
          <section className="bk-block">
            <h2 className="bk-block-h"><ClipboardCheck width={15} height={15} /> Services game plan</h2>
            <p className="bk-muted">Check what fits their business — this is what you walk in ready to pitch.</p>
            {['Brand', 'Web', 'Print'].map(group => (
              <div key={group} className="bk-svc-group">
                <p className="bk-svc-label">{group}</p>
                <div className="bk-svc-row">
                  {SERVICES.filter(s => s.group === group).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className={`bk-svc${services.includes(s.id) ? ' is-on' : ''}`}
                      aria-pressed={services.includes(s.id)}
                      onClick={() => toggleService(s.id)}
                    >
                      {services.includes(s.id) && <Check width={13} height={13} />}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* Pricing options */}
          <section className="bk-block">
            <div className="bk-block-headrow">
              <h2 className="bk-block-h"><CurrencyDollar width={15} height={15} /> Pricing to present</h2>
              {pricing.length < 3 && (
                <button type="button" className="aa-minibtn" onClick={addPricing}><Plus width={12} height={12} /> Add option</button>
              )}
            </div>
            {pricing.length === 0 && (
              <p className="bk-muted">Prep 1–3 options — a starter and a recommended package. Over ${PROJECT_CAP} goes on a 6 or 12-month plan, and always pitch the retainer.</p>
            )}
            {pricing.map((o, i) => {
              const monthly = monthlyOf(o.price, o.plan);
              const overCap = o.price > PROJECT_CAP && o.plan === 'full';
              return (
                <div key={i} className="bk-price lay-card">
                  <div className="bk-price-row">
                    <input className="aa-input bk-price-label" value={o.label} onChange={e => setOpt(i, 'label', e.target.value)} placeholder="Option name" />
                    <div className="bk-price-amt">
                      <span>$</span>
                      <input className="aa-input" type="number" min="0" inputMode="numeric" value={o.price || ''} onChange={e => setOpt(i, 'price', Number(e.target.value))} placeholder="0" />
                    </div>
                    <button type="button" className="bk-price-del" onClick={() => removeOpt(i)} aria-label="Remove option"><Trash01 width={14} height={14} /></button>
                  </div>
                  <div className="bk-price-row">
                    <select className="aa-input" value={o.plan} onChange={e => setOpt(i, 'plan', e.target.value)}>
                      {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <input className="aa-input" value={o.retainer} onChange={e => setOpt(i, 'retainer', e.target.value)} placeholder="Retainer pitch — e.g. $95/mo upkeep" />
                  </div>
                  <input className="aa-input" value={o.notes} onChange={e => setOpt(i, 'notes', e.target.value)} placeholder="What's included / talking point" />
                  {monthly && <p className="bk-price-hint">{planLabel(o.plan)}: about ${monthly}/mo</p>}
                  {overCap && (
                    <p className="bk-price-warn"><AlertTriangle width={13} height={13} /> Over ${PROJECT_CAP} — offer it as a 6 or 12-month plan.</p>
                  )}
                  {!o.retainer && <p className="bk-price-hint">Add the retainer pitch — every option carries one.</p>}
                </div>
              );
            })}
            {pricingDirty && (
              <button type="button" className="aa-btn aa-btn--primary" onClick={savePricing}>
                <Check width={14} height={14} /> Save pricing
              </button>
            )}
          </section>

          {/* Concepts tracker */}
          <section className="bk-block">
            <h2 className="bk-block-h"><ClipboardCheck width={15} height={15} /> Concepts for the meeting</h2>
            <div className="bk-concepts">
              {(tracker.items || []).map((it, i) => (
                <div key={i} className="bk-concept">
                  <button type="button" className={`bk-concept-check${it.done ? ' is-done' : ''}`} onClick={() => toggleConcept(i)} aria-pressed={it.done}>
                    {it.done && <Check width={13} height={13} />}
                  </button>
                  <span className={`bk-concept-label${it.done ? ' is-done' : ''}`}>{it.label}</span>
                  <button type="button" className="bk-concept-del" onClick={() => removeConcept(i)} aria-label="Remove"><XClose width={13} height={13} /></button>
                </div>
              ))}
              <form className="bk-concept-add" onSubmit={(e) => { e.preventDefault(); addConcept(); }}>
                <input className="aa-input" value={newConcept} onChange={e => setNewConcept(e.target.value)} placeholder="Add a concept — logo, storefront mockup, demo site…" />
                <button type="submit" className="aa-iconbtn" disabled={!newConcept.trim()} aria-label="Add concept"><Plus width={15} height={15} /></button>
              </form>
            </div>
            <div className="bk-url-grid">
              <label className="bk-field">
                <span>Demo site URL</span>
                <div className="bk-url-row">
                  <input className="aa-input" value={urls.demoUrl} onChange={e => { setUrls(u => ({ ...u, demoUrl: e.target.value })); setUrlsDirty(true); }} placeholder="https://demo…" inputMode="url" autoCapitalize="none" />
                  {tracker.demoUrl && <a className="aa-iconbtn" href={tracker.demoUrl} target="_blank" rel="noopener noreferrer" aria-label="Open demo"><LinkExternal01 width={14} height={14} /></a>}
                </div>
              </label>
              <label className="bk-field">
                <span>Drive folder</span>
                <div className="bk-url-row">
                  <input className="aa-input" value={urls.driveUrl} onChange={e => { setUrls(u => ({ ...u, driveUrl: e.target.value })); setUrlsDirty(true); }} placeholder="https://drive.google.com/…" inputMode="url" autoCapitalize="none" />
                  {tracker.driveUrl && <a className="aa-iconbtn" href={tracker.driveUrl} target="_blank" rel="noopener noreferrer" aria-label="Open Drive"><LinkExternal01 width={14} height={14} /></a>}
                </div>
              </label>
            </div>
            {urlsDirty && (
              <button type="button" className="aa-btn aa-btn--primary" onClick={async () => { const ok = await saveTracker(urls); if (ok) setUrlsDirty(false); }}>
                <Check width={14} height={14} /> Save links
              </button>
            )}
          </section>

          {/* Prep notes */}
          <section className="bk-block">
            <h2 className="bk-block-h">Prep notes</h2>
            <textarea
              className="aa-input bk-prep-ta"
              rows={4}
              value={prep}
              onChange={e => { setPrep(e.target.value); setPrepState('dirty'); }}
              placeholder="Talking points, objections to expect, the hook to open with…"
            />
            {prepState !== 'idle' && (
              <button type="button" className="aa-btn aa-btn--primary" onClick={savePrep} disabled={prepState === 'saving'}>
                {prepState === 'saving' ? 'Saving…' : prepState === 'saved' ? 'Saved' : 'Save notes'}
              </button>
            )}
          </section>

          {/* Carried-over context */}
          <div className="bk-folds">
            {lead.angle && <Fold title="The angle">{<p className="bk-angle">{lead.angle}</p>}</Fold>}
            {lead.notes && <Fold title="Lead notes">{<p className="bk-angle">{lead.notes}</p>}</Fold>}
            <Fold title="Call log" note={(lead.callLog || []).length || undefined}><LogList lead={lead} /></Fold>
          </div>
        </div>
      </ScrollArea>

      {/* Outcome actions — pinned, in flow */}
      <StickyFooterBar className="bk-outbar">
        <button type="button" className="bk-out bk-out--won" onClick={markWon}>
          <Trophy01 width={17} height={17} /> Mark as Won
        </button>
        <button type="button" className="bk-out" onClick={() => setLostOpen(true)}>
          <XClose width={16} height={16} /> Lost
        </button>
        <button type="button" className="bk-out" onClick={reschedule}>
          <RefreshCw01 width={15} height={15} /> Reschedule
        </button>
      </StickyFooterBar>

      {lostOpen && (
        <div className="bk-sheet-back" onClick={() => setLostOpen(false)}>
          <form className="bk-sheet" onClick={e => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); markLost(); }}>
            <div className="bk-sheet-head">
              <span className="bk-sheet-title">Mark {lead.business} as lost</span>
              <button type="button" className="aa-iconbtn" onClick={() => setLostOpen(false)} aria-label="Cancel"><XClose width={15} height={15} /></button>
            </div>
            <label className="bk-field">
              <span>Why didn&rsquo;t it close? <em>(optional, future-you will thank you)</em></span>
              <input className="aa-input" value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Price, timing, went with someone else…" autoFocus />
            </label>
            <button type="submit" className="aa-btn aa-btn--danger">Mark as Lost</button>
          </form>
        </div>
      )}
    </>
  );
}

/* ── Section: list rail + detail ───────────────────────────────── */

export default function AdminBooked({ leads, loading, onPatch, onRefresh, onMobileOpen, onMobileClose, onGo }) {
  const [selId, setSelId] = useState(null);
  const [chip, setChip] = useState('all'); // all | needs-prep | ready | week
  const [showClosed, setShowClosed] = useState(false);
  const [toast, setToast] = useState(null);

  const booked = useMemo(() => {
    const b = leads.filter(l => effectiveStage(l) === 'booked');
    return b.sort((a, x) => {
      const da = meetingDate(a); const dx = meetingDate(x);
      if (da && dx) return da - dx;
      if (da) return -1;
      if (dx) return 1;
      return new Date(x.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
  }, [leads]);

  const closed = useMemo(
    () => leads.filter(l => ['won', 'lost'].includes(effectiveStage(l))),
    [leads]
  );

  const filtered = useMemo(() => booked.filter(l => {
    if (chip === 'needs-prep') return prepStatus(l) === 'needs-prep';
    if (chip === 'ready') return prepStatus(l) === 'ready';
    if (chip === 'week') {
      const d = meetingDate(l);
      return d && d.getTime() - Date.now() < 7 * 864e5 && d.getTime() - Date.now() > -864e5;
    }
    return true;
  }), [booked, chip]);

  const sel = selId ? leads.find(l => l._id === selId) : null;
  // A lead that just moved to won/lost stays visible until deselected.
  const selVisible = sel && (effectiveStage(sel) === 'booked' || ['won', 'lost'].includes(effectiveStage(sel)));

  const pick = (id) => { setSelId(id); onMobileOpen?.(); };
  const back = () => { setSelId(null); onMobileClose?.(); };

  const closedOut = (result) => {
    setToast(result === 'won'
      ? { won: true, msg: `${sel?.business} marked as WON.` }
      : { won: false, msg: `${sel?.business} marked as lost.` });
    setTimeout(() => setToast(null), 2600);
    back();
  };

  const CHIPS = [
    ['all', `All · ${booked.length}`],
    ['needs-prep', 'Needs prep'],
    ['ready', 'Concepts ready'],
    ['week', 'This week'],
  ];

  return (
    <>
      <aside className="aa-panel">
        <div className="aa-panel-head">
          <h2 className="aa-panel-title">Booked</h2>
          <button type="button" className="aa-iconbtn" onClick={onRefresh} title="Refresh"><RefreshCw01 width={14} height={14} /></button>
        </div>

        <div className="bk-chips">
          {CHIPS.map(([id, label]) => (
            <button key={id} type="button" className={`bk-chip${chip === id ? ' is-on' : ''}`} onClick={() => setChip(id)}>
              {label}
            </button>
          ))}
        </div>

        <ScrollArea bare className="bk-list">
          {loading && !leads.length && <p className="bk-muted" style={{ padding: 12 }}>Loading…</p>}
          {!loading && booked.length === 0 && (
            <div className="bk-empty">
              <CalendarCheck01 width={28} height={28} />
              <p className="bk-empty-title">No booked leads yet.</p>
              <p className="bk-muted">Book one from the Call Console — a BOOKED outcome lands it here for meeting prep.</p>
              {onGo && <button type="button" className="aa-btn" onClick={() => onGo('calls')}><PhoneOutgoing01 width={14} height={14} /> Open Call Console</button>}
            </div>
          )}
          {booked.length > 0 && filtered.length === 0 && (
            <p className="bk-muted" style={{ padding: 12 }}>Nothing matches this filter.</p>
          )}
          {filtered.map(l => (
            <button key={l._id} type="button" className={`bk-card lay-card${sel?._id === l._id ? ' is-sel' : ''}`} onClick={() => pick(l._id)}>
              <div className="bk-card-top">
                <span className="bk-card-name lay-truncate">{l.business}</span>
                <PrepPill lead={l} />
              </div>
              <div className="bk-card-sub">
                <span className="bk-card-when">
                  <Calendar width={12} height={12} />
                  {fmtMeeting(l) || 'No meeting set'}
                  {meetingCountdown(l) ? ` · ${meetingCountdown(l)}` : ''}
                </span>
              </div>
              {(l.servicesPlanned?.length > 0 || l.serviceInterest) && (
                <div className="bk-card-svcs lay-truncate">
                  {l.servicesPlanned?.length > 0
                    ? l.servicesPlanned.slice(0, 3).map(serviceLabel).join(' · ') + (l.servicesPlanned.length > 3 ? ' +' + (l.servicesPlanned.length - 3) : '')
                    : l.serviceInterest}
                </div>
              )}
            </button>
          ))}

          {closed.length > 0 && (
            <div className="bk-closed">
              <button type="button" className="bk-closed-toggle" onClick={() => setShowClosed(v => !v)}>
                {showClosed ? 'Hide' : 'Show'} closed · {closed.length}
              </button>
              {showClosed && closed.map(l => (
                <button key={l._id} type="button" className={`bk-card bk-card--closed lay-card${sel?._id === l._id ? ' is-sel' : ''}`} onClick={() => pick(l._id)}>
                  <div className="bk-card-top">
                    <span className="bk-card-name lay-truncate">{l.business}</span>
                    <span className={`bk-closedtag${effectiveStage(l) === 'won' ? ' is-won' : ''}`}>
                      {effectiveStage(l) === 'won' ? 'WON' : 'LOST'}
                    </span>
                  </div>
                  {l.bookedOutcome?.reason && <div className="bk-card-svcs lay-truncate">{l.bookedOutcome.reason}</div>}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </aside>

      <main className="aa-main bk-main">
        {selVisible ? (
          <BookedDetail lead={sel} onPatch={onPatch} onClose={back} onClosedOut={closedOut} />
        ) : (
          <div className="aa-main-empty">
            <CalendarCheck01 width={34} height={34} />
            <p>Pick a booked lead to prep the meeting — services, pricing, concepts.</p>
          </div>
        )}
      </main>

      {toast && (
        <div className={`bk-toast${toast.won ? ' is-won' : ''}`} role="status">
          {toast.won ? <Trophy01 width={16} height={16} /> : <XClose width={16} height={16} />}
          {toast.msg}
        </div>
      )}

      <style>{bkStyles}</style>
    </>
  );
}

/* ── Styles ────────────────────────────────────────────────────── */

const bkStyles = `
  .bk-muted { color: var(--a-muted); font-size: 0.82rem; line-height: 1.55; }

  /* List rail */
  .bk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .bk-chip {
    padding: 6px 12px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--a-border); background: rgba(255,255,255,0.04);
    color: var(--a-muted); font-size: 0.74rem; font-weight: 700; font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }
  .bk-chip:hover { color: #fafafa; }
  .bk-chip.is-on { color: var(--a-brand); border-color: rgba(212,76,67,0.5); background: rgba(212,76,67,0.1); }

  .bk-list.lay-scroll { padding: 0 0 12px; display: flex; flex-direction: column; gap: 7px; }
  .bk-card {
    display: flex; flex-direction: column; gap: 6px; text-align: left;
    padding: 12px 14px; border-radius: 13px; cursor: pointer;
    background: var(--a-card); border: 1px solid var(--a-border);
    font-family: inherit; color: inherit;
    transition: border-color 0.15s;
  }
  .bk-card:hover { border-color: rgba(212,76,67,0.4); }
  .bk-card.is-sel { border-color: var(--a-brand); }
  .bk-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .bk-card-name { font-size: 0.9rem; font-weight: 800; letter-spacing: -0.01em; }
  .bk-card-sub { display: flex; align-items: center; gap: 8px; }
  .bk-card-when { display: inline-flex; align-items: center; gap: 6px; font-size: 0.72rem; color: var(--a-sec); }
  .bk-card-when svg { color: var(--a-muted); flex-shrink: 0; }
  .bk-card-svcs { font-size: 0.7rem; color: var(--a-muted); }
  .bk-card--closed { opacity: 0.75; }

  .bk-prep {
    display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
    font-size: 0.62rem; font-weight: 700; padding: 2px 8px; border-radius: 999px;
    color: var(--sc); background: color-mix(in srgb, var(--sc) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent); white-space: nowrap;
  }
  .bk-prep-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--sc); }
  .bk-closedtag {
    font-size: 0.6rem; font-weight: 900; letter-spacing: 0.1em; padding: 2px 8px; border-radius: 999px;
    background: rgba(239,68,68,0.14); color: #f87171; border: 1px solid rgba(239,68,68,0.3);
  }
  .bk-closedtag.is-won { background: rgba(212,76,67,0.16); color: #e66b63; border-color: rgba(212,76,67,0.4); }
  .bk-closed { margin-top: 10px; display: flex; flex-direction: column; gap: 7px; }
  .bk-closed-toggle {
    align-self: flex-start; background: none; border: none; cursor: pointer;
    color: var(--a-muted); font-size: 0.72rem; font-weight: 700; font-family: inherit; padding: 4px 2px;
  }
  .bk-closed-toggle:hover { color: #fafafa; }

  .bk-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 34px 14px; text-align: center; color: var(--a-muted); }
  .bk-empty-title { font-weight: 800; color: #fafafa; font-size: 0.95rem; }

  /* Detail workspace */
  .bk-main { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  @media (max-width: 760px) {
    .aa-app.has-detail .bk-main { display: flex; }
  }
  .bk-detail { --lay-stack-gap: 18px; padding-bottom: 8px; }
  .bk-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .bk-back {
    display: inline-flex; align-items: center; gap: 7px;
    background: none; border: none; color: var(--a-muted); cursor: pointer;
    font-size: 0.85rem; font-weight: 600; font-family: inherit; padding: 0;
  }
  .bk-back:hover { color: #fafafa; }
  .bk-countdown {
    font-size: 0.7rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 4px 11px; border-radius: 999px;
    background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.35);
  }
  .bk-head { display: flex; flex-direction: column; gap: 6px; }
  .bk-head-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .bk-industry { font-size: 0.72rem; font-weight: 600; color: var(--a-muted); }
  .bk-biz {
    font-family: 'Barlow Condensed', 'Inter', sans-serif; text-transform: uppercase;
    font-size: clamp(1.9rem, 6vw, 2.7rem); line-height: 0.95; font-weight: 700;
  }
  .bk-askfor { font-size: 0.92rem; font-weight: 600; color: var(--a-sec); }

  .bk-phone {
    display: flex; align-items: center; gap: 12px; align-self: flex-start;
    padding: 13px 18px; border-radius: 13px; max-width: 100%;
    background: var(--a-brand); border: 1px solid var(--a-brand); color: #fff;
    font-size: 1.15rem; font-weight: 800; letter-spacing: 0.01em; text-decoration: none;
    box-shadow: 0 6px 24px rgba(212,76,67,0.28);
    transition: background 0.15s, transform 0.15s;
  }
  .bk-phone:hover { background: #c2413a; }
  .bk-phone:active { transform: scale(0.99); }
  .bk-phone-tap { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; opacity: 0.75; }

  .bk-block {
    display: flex; flex-direction: column; gap: 12px;
    background: var(--a-card); border: 1px solid var(--a-border);
    border-radius: 15px; padding: 16px;
  }
  .bk-block-h {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 0.74rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--a-sec);
  }
  .bk-block-h svg { color: var(--a-muted); }
  .bk-block-headrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .bk-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .bk-field > span { font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--a-muted); }
  .bk-field > span em { font-style: normal; font-weight: 600; text-transform: none; letter-spacing: 0; opacity: 0.75; }

  .bk-meeting-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  @media (max-width: 560px) { .bk-meeting-grid { grid-template-columns: 1fr 1fr; } }
  .bk-meeting-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .bk-meeting-when { display: inline-flex; align-items: center; gap: 7px; font-size: 0.84rem; font-weight: 700; color: #fafafa; }
  .bk-meeting-when svg { color: #22c55e; }

  .bk-svc-group { display: flex; flex-direction: column; gap: 6px; }
  .bk-svc-label { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--a-muted); }
  .bk-svc-row { display: flex; flex-wrap: wrap; gap: 7px; }
  .bk-svc {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 13px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--a-border); background: rgba(255,255,255,0.04);
    color: var(--a-sec); font-size: 0.78rem; font-weight: 600; font-family: inherit;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .bk-svc:hover { color: #fafafa; }
  .bk-svc.is-on { color: #fafafa; border-color: rgba(212,76,67,0.55); background: rgba(212,76,67,0.13); }
  .bk-svc.is-on svg { color: var(--a-brand); }

  .bk-price { display: flex; flex-direction: column; gap: 8px; background: var(--a-raised); border: 1px solid var(--a-border); border-radius: 12px; padding: 12px; }
  .bk-price-row { display: flex; gap: 8px; align-items: center; }
  .bk-price-row > * { min-width: 0; }
  .bk-price-label { flex: 1; font-weight: 700; }
  .bk-price-amt { display: flex; align-items: center; gap: 6px; width: 130px; flex-shrink: 0; font-weight: 800; color: var(--a-muted); }
  .bk-price-del {
    background: none; border: none; cursor: pointer; color: var(--a-muted); flex-shrink: 0;
    display: flex; padding: 6px; border-radius: 8px;
  }
  .bk-price-del:hover { color: #f87171; }
  .bk-price-hint { font-size: 0.72rem; color: var(--a-muted); }
  .bk-price-warn { display: inline-flex; align-items: center; gap: 6px; font-size: 0.74rem; font-weight: 700; color: #fbbf24; }

  .bk-concepts { display: flex; flex-direction: column; gap: 7px; }
  .bk-concept { display: flex; align-items: center; gap: 10px; }
  .bk-concept-check {
    width: 24px; height: 24px; border-radius: 7px; cursor: pointer; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.16); color: #fff;
    transition: background 0.15s, border-color 0.15s;
  }
  .bk-concept-check.is-done { background: #22c55e; border-color: #22c55e; color: #08130a; }
  .bk-concept-label { flex: 1; min-width: 0; font-size: 0.88rem; overflow-wrap: anywhere; }
  .bk-concept-label.is-done { color: var(--a-muted); text-decoration: line-through; }
  .bk-concept-del { background: none; border: none; cursor: pointer; color: transparent; display: flex; padding: 4px; }
  .bk-concept:hover .bk-concept-del { color: var(--a-muted); }
  .bk-concept-del:hover { color: #f87171 !important; }
  .bk-concept-add { display: flex; gap: 8px; margin-top: 2px; }
  .bk-concept-add .aa-input { flex: 1; min-width: 0; }

  .bk-url-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 640px) { .bk-url-grid { grid-template-columns: 1fr; } }
  .bk-url-row { display: flex; gap: 7px; align-items: center; }
  .bk-url-row .aa-input { flex: 1; min-width: 0; }

  .bk-prep-ta { resize: vertical; min-height: 96px; line-height: 1.55; }
  .bk-block .aa-btn { align-self: flex-start; }

  .bk-folds { display: flex; flex-direction: column; gap: 8px; }
  .bk-fold { border: 1px solid var(--a-border); border-radius: 12px; background: var(--a-card); overflow: hidden; }
  .bk-fold-head {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 12px 15px; cursor: pointer; background: none; border: none;
    font-family: inherit; color: var(--a-sec); text-align: left;
  }
  .bk-fold-title { font-size: 0.74rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .bk-fold-note { font-size: 0.7rem; color: var(--a-muted); }
  .bk-fold-chev { margin-left: auto; transition: transform 0.2s; color: var(--a-muted); flex-shrink: 0; }
  .bk-fold.is-open .bk-fold-chev { transform: rotate(180deg); }
  .bk-fold-body { padding: 2px 15px 15px; }
  .bk-angle { font-size: 0.9rem; line-height: 1.6; color: #eaeaea; white-space: pre-wrap; }

  .bk-log { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
  .bk-log-row { display: flex; gap: 10px; }
  .bk-log-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sc); flex-shrink: 0; margin-top: 5px; }
  .bk-log-main { min-width: 0; flex: 1; }
  .bk-log-top { display: flex; align-items: baseline; gap: 8px; }
  .bk-log-outcome { font-size: 0.78rem; font-weight: 800; color: var(--sc); }
  .bk-log-time { font-size: 0.68rem; color: var(--a-muted); }
  .bk-log-note { font-size: 0.8rem; line-height: 1.5; color: var(--a-sec); margin-top: 2px; overflow-wrap: anywhere; }
  .bk-log-note strong { color: #fafafa; }

  /* Outcome bar */
  .bk-outbar.lay-footbar { flex-direction: row; gap: 8px; }
  .bk-out {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px 16px; border-radius: 12px; cursor: pointer; min-width: 0;
    border: 1px solid var(--a-border); background: rgba(255,255,255,0.05);
    color: var(--a-sec); font-size: 0.82rem; font-weight: 800; font-family: inherit;
    transition: background 0.15s, color 0.15s, transform 0.12s;
    white-space: nowrap;
  }
  .bk-out:hover { color: #fafafa; background: rgba(255,255,255,0.1); }
  .bk-out:active { transform: scale(0.97); }
  .bk-out--won { flex: 1; max-width: 300px; background: var(--a-brand); border-color: var(--a-brand); color: #fff; }
  .bk-out--won:hover { background: #c2413a; color: #fff; }
  @media (max-width: 480px) { .bk-out { padding: 13px 12px; font-size: 0.76rem; } }

  /* Lost sheet */
  .bk-sheet-back {
    position: fixed; inset: 0; z-index: 80;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);
    display: flex; align-items: flex-end; justify-content: center;
  }
  .bk-sheet {
    width: 100%; max-width: 520px;
    background: #161616; border: 1px solid rgba(255,255,255,0.12); border-bottom: none;
    border-radius: 18px 18px 0 0;
    padding: 16px 18px calc(18px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 14px;
  }
  .bk-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .bk-sheet-title { font-size: 0.95rem; font-weight: 800; }
  .bk-sheet .aa-btn { align-self: flex-start; }
  @media (min-width: 700px) {
    .bk-sheet-back { align-items: center; }
    .bk-sheet { border-radius: 18px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 18px; }
  }

  /* Toast */
  .bk-toast {
    position: fixed; top: max(14px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 90;
    display: flex; align-items: center; gap: 9px;
    max-width: min(94vw, 480px);
    padding: 11px 16px; border-radius: 13px;
    background: #1a1a1a; border: 1px solid var(--a-border);
    color: #fafafa; font-size: 0.85rem; font-weight: 700;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  }
  .bk-toast.is-won { border-color: rgba(212,76,67,0.55); background: rgba(212,76,67,0.14); }
  .bk-toast.is-won svg { color: var(--a-brand); }
`;
