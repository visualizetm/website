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
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import AlertTriangle from '@untitled-ui/icons-react/build/esm/AlertTriangle';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import PhoneOutgoing01 from '@untitled-ui/icons-react/build/esm/PhoneOutgoing01';
import { ScrollArea, StickyFooterBar } from '../ui';
import { useTopBar } from '../shell/ShellContext';
import { SocialButtons } from '../components/SocialLinks';
import Checklists from '../components/Checklists';
import LinkedSubmissions from '../components/LinkedSubmissions';
import { checklistProgress } from '../lib/booked';
import {
  effectiveStage, SERVICES, serviceLabel, MEETING_TYPES, PLANS,
  monthlyOf, PROJECT_CAP, meetingDate, meetingCountdown, prepStatus, PREP_META,
  calendarUrl,
} from '../lib/booked';
import { formatPhone, telHref } from '../shared/phone';
import { fmtDateTime, fmtWeekdayDateTime } from '../shared/dates';
import { CALL_STATUSES } from '../shared/semantics';

const telOf = (lead) => telHref(lead?.phone);
const fmtLogTime = fmtDateTime;
const fmtMeeting = (lead) => { const d = meetingDate(lead); return d ? fmtWeekdayDateTime(d) : null; };

// Outcome colors/labels: src/shared/semantics.js (one source of truth).
const OUTCOME_COLORS = Object.fromEntries(CALL_STATUSES.map(x => [x.id, x.color]));
const OUTCOME_LABELS = Object.fromEntries(CALL_STATUSES.map(x => [x.id, x.label]));

const BOOKED_PREFS = 'vz_booked_prefs';
// Call mode: prep collapses to one-liners, the read-off-screen blocks open.
const CALL_MODE_MAP = {
  meeting: false, services: false, angle: false, notes: false, log: false,
  tasks: false, subs: false,
  pricing: true, concepts: true, prep: true,
};

// "What's included" reads as a list — one line per item. Legacy single-line
// notes still render in full (as one row), so nothing is ever hidden.
const bulletsOf = (text) => String(text || '')
  .split(/\r?\n/).map(s => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);

const planMonths = (id) => PLANS.find(p => p.id === id)?.months;

/* One pricing option. Rests as a readable briefing card (big price, bulleted
 * inclusions, retainer on its own line); the pencil swaps it to fields. */
function PriceCard({ opt, index, editing, onEdit, onDone, onChange, onRemove }) {
  const monthly = monthlyOf(opt.price, opt.plan);
  const overCap = opt.price > PROJECT_CAP && opt.plan === 'full';
  const rec = /recommend/i.test(opt.label || '');
  const bullets = bulletsOf(opt.notes);

  if (editing) {
    return (
      <div className={`bk-price is-editing${rec ? ' is-rec' : ''}`}>
        <div className="bk-price-row">
          <input className="aa-input bk-price-label" value={opt.label} onChange={e => onChange('label', e.target.value)} placeholder="Option name — e.g. Social Rebrand" />
          <div className="bk-price-amt">
            <span>$</span>
            <input className="aa-input" type="number" min="0" inputMode="numeric" value={opt.price || ''} onChange={e => onChange('price', Number(e.target.value))} placeholder="0" />
          </div>
        </div>
        <div className="bk-price-row bk-price-row--plan">
          <select className="aa-input" value={opt.plan} onChange={e => onChange('plan', e.target.value)}>
            {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {monthly && <span className="bk-price-monthly">${monthly}/mo × {planMonths(opt.plan)}</span>}
        </div>
        <label className="bk-field">
          <span>What&rsquo;s included <em>— one per line</em></span>
          <GrowInput value={opt.notes} onChange={e => onChange('notes', e.target.value)} placeholder={'Logo refresh\nOne-page website\nSticker run'} />
        </label>
        <label className="bk-field">
          <span>Retainer to pitch</span>
          <GrowInput value={opt.retainer} onChange={e => onChange('retainer', e.target.value)} placeholder="Content Kit $250/mo — I make the posts" />
        </label>
        {overCap && <p className="bk-price-warn"><AlertTriangle width={13} height={13} /> Over ${PROJECT_CAP} — offer it as a 6 or 12-month plan.</p>}
        <div className="bk-price-editrow">
          <button type="button" className="aa-btn" onClick={onDone}><Check width={14} height={14} /> Done</button>
          <button type="button" className="bk-price-del" onClick={onRemove} aria-label="Remove option"><Trash01 width={15} height={15} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bk-price${rec ? ' is-rec' : ''}`}>
      <div className="bk-price-head">
        <span className="bk-price-name">{opt.label || `Option ${index + 1}`}</span>
        {rec && <span className="bk-rec-tag">Lead with this</span>}
        <button type="button" className="bk-price-edit" onClick={onEdit} aria-label={`Edit ${opt.label || 'option'}`}>
          <Edit02 width={15} height={15} />
        </button>
      </div>
      <div className="bk-price-figure">
        <span className="bk-price-num">${Number(opt.price || 0).toLocaleString()}</span>
        <span className="bk-price-plan">
          {opt.plan === 'full' ? 'Paid in full' : `$${monthly}/mo × ${planMonths(opt.plan)}`}
        </span>
      </div>
      {bullets.length > 0 && (
        <>
          <p className="bk-price-sub">What&rsquo;s included</p>
          <ul className="bk-price-list">{bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
        </>
      )}
      {opt.retainer && <p className="bk-price-retainer"><span>Then:</span> {opt.retainer}</p>}
      {overCap && <p className="bk-price-warn"><AlertTriangle width={13} height={13} /> Over ${PROJECT_CAP} — offer a 6 or 12-month plan.</p>}
      {!opt.retainer && <p className="bk-price-hint">No retainer yet — every option carries one.</p>}
    </div>
  );
}

function PrepPill({ lead }) {
  const s = PREP_META[prepStatus(lead)];
  return (
    <span className="bk-prep" style={{ '--sc': s.color }}>
      <span className="bk-prep-dot" />{s.label}
    </span>
  );
}

/* A text field that never truncates: a textarea that auto-grows to fit its
 * content (CSS grid-stack trick — the hidden ::after mirror sets the height),
 * so long retainer pitches and package notes read in full at rest. */
function GrowInput({ value, onChange, placeholder, className = '' }) {
  return (
    <div className={`bk-grow ${className}`.trim()} data-value={value || placeholder || ''}>
      <textarea rows={1} className="aa-input" value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

/* Collapsible section — one reliable tap target, body always mounted.
 *
 * The body animates via grid-template-rows 0fr→1fr rather than height:auto
 * (which can't animate) or a conditional mount (which can't either, and
 * reads as a no-op on touch). Because the body is always in the DOM, a tap
 * can never "fail to open" — and on open we scroll it into view so content
 * below the fold isn't mistaken for a broken toggle.
 */
function Section({ id, title, icon, summary, note, tone = '', open, onToggle, children }) {
  const ref = useRef(null);
  const toggle = () => {
    const next = !open;
    onToggle(id, next);
    if (next) {
      requestAnimationFrame(() => {
        setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 210);
      });
    }
  };
  return (
    <section ref={ref} className={`bk-sec${tone ? ` bk-sec--${tone}` : ''}${open ? ' is-open' : ''}`}>
      <button type="button" className="bk-sec-head" onClick={toggle} aria-expanded={open} aria-controls={`sec-${id}`}>
        <span className="bk-sec-title">{icon}{title}</span>
        {note != null && <span className="bk-sec-note">{note}</span>}
        <ChevronDown width={17} height={17} className="bk-sec-chev" />
      </button>
      {!open && summary && <div className="bk-sec-summary">{summary}</div>}
      <div className="bk-sec-body" id={`sec-${id}`} aria-hidden={!open}>
        {/* clip layer carries no padding — a padded grid item can't collapse
            below its own min-content height, which leaves content bleeding */}
        <div className="bk-sec-clip">
          <div className="bk-sec-inner">{children}</div>
        </div>
      </div>
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

function BookedDetail({ lead, submissions, onPatch, onLinkSubmission, onClose, onClosedOut }) {
  const [pricing, setPricing] = useState(lead.pricingOptions || []);
  const [pricingDirty, setPricingDirty] = useState(false);
  const [urls, setUrls] = useState({ demoUrl: lead.conceptsTracker?.demoUrl || '', driveUrl: lead.conceptsTracker?.driveUrl || '' });
  const [urlsDirty, setUrlsDirty] = useState(false);
  const [prep, setPrep] = useState(lead.prepNotes || '');
  const [prepState, setPrepState] = useState('idle');
  const [newConcept, setNewConcept] = useState('');
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [editIdx, setEditIdx] = useState(null);
  const [linksEdit, setLinksEdit] = useState(false);
  const [openMap, setOpenMap] = useState({});
  const [callMode, setCallMode] = useState(false);

  useEffect(() => {
    setPricing(lead.pricingOptions || []);
    setPricingDirty(false);
    setUrls({ demoUrl: lead.conceptsTracker?.demoUrl || '', driveUrl: lead.conceptsTracker?.driveUrl || '' });
    setUrlsDirty(false);
    setPrep(lead.prepNotes || '');
    setPrepState('idle');
    setLostOpen(false);
    setLostReason('');
    setEditIdx(null);
    setLinksEdit(false);

    // Prep sections collapse to a summary once they're filled in; anything
    // still empty opens so it's obvious there's work left. Whatever you
    // toggled last is remembered on top of that.
    let saved = {}; let savedCall = false;
    try {
      const raw = JSON.parse(localStorage.getItem(BOOKED_PREFS) || '{}');
      saved = raw.sections || {}; savedCall = !!raw.callMode;
    } catch { /* first run */ }
    const defaults = {
      meeting: !lead.meeting?.date,
      services: !(lead.servicesPlanned?.length),
      pricing: true, concepts: true, prep: true,
      angle: false, notes: false, log: false, tasks: false, subs: false,
    };
    setCallMode(savedCall);
    setOpenMap(savedCall ? { ...defaults, ...CALL_MODE_MAP } : { ...defaults, ...saved });
  }, [lead._id]);

  const persistPrefs = (sections, mode) => {
    try { localStorage.setItem(BOOKED_PREFS, JSON.stringify({ sections, callMode: mode })); } catch { /* fine */ }
  };
  const toggleSection = (id, next) => setOpenMap(m => {
    const v = { ...m, [id]: next };
    persistPrefs(v, callMode);
    return v;
  });
  const setCall = (on) => {
    const v = on ? { ...openMap, ...CALL_MODE_MAP } : { ...openMap, meeting: true, services: true };
    setCallMode(on); setOpenMap(v); persistPrefs(v, on);
  };

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
    setEditIdx(pricing.length);
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
    // Clearing the date is only half of it — open the editor so the new one
    // can be set straight away (and leave call mode, this is prep).
    setCall(false);
    toggleSection('meeting', true);
  };

  return (
    <>
      <ScrollArea bare className="bk-scroll">
        <div className="bk-detail lay-content">
          <div className="bk-top">
            <button type="button" className="bk-back" onClick={onClose}>
              <ArrowLeft width={15} height={15} /> Booked
            </button>
            <span className="bk-top-spacer" />
            {countdown && <span className="bk-countdown">{countdown}</span>}
            <button
              type="button"
              className={`bk-callmode${callMode ? ' is-on' : ''}`}
              onClick={() => setCall(!callMode)}
              aria-pressed={callMode}
              title="Collapse the prep sections and open pricing + concepts"
            >
              <PhoneCall01 width={15} height={15} />
              {callMode ? 'Call mode on' : 'Call mode'}
            </button>
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

          {/* Two columns on desktop; single stack below. In call mode the
              call-critical column jumps above the prep column. */}
          <div className={`bk-grid${callMode ? ' is-call' : ''}`}>
          <div className="bk-col bk-col--prep">

          {/* Meeting — prep, collapses to a one-liner */}
          <Section
            id="meeting"
            icon={<Calendar width={16} height={16} />}
            title="Meeting"
            summary={fmtMeeting(lead)
              ? `${fmtMeeting(lead)} · ${MEETING_TYPES.find(t => t.id === (meeting.type || 'call'))?.label}${countdown ? ` · ${countdown}` : ''}`
              : 'No meeting time set yet'}
            open={!!openMap.meeting}
            onToggle={toggleSection}
          >
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
          </Section>

          {/* Services planner — prep, collapses to what you checked */}
          <Section
            id="services"
            icon={<ClipboardCheck width={16} height={16} />}
            title="Services game plan"
            note={services.length || undefined}
            summary={services.length ? services.map(serviceLabel).join(', ') : 'Nothing picked yet'}
            open={!!openMap.services}
            onToggle={toggleSection}
          >
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
          </Section>

          </div>{/* /bk-col prep */}
          <div className="bk-col bk-col--call">

          {/* Pricing — the block read off during the close */}
          <Section
            id="pricing" tone="hero"
            icon={<CurrencyDollar width={16} height={16} />}
            title="Pricing to present"
            note={pricing.length || undefined}
            open={!!openMap.pricing}
            onToggle={toggleSection}
          >
            {pricing.length === 0 && (
              <p className="bk-muted">Prep 1–3 options — a starter and a recommended package. Over ${PROJECT_CAP} goes on a 6 or 12-month plan, and always pitch the retainer. Name one &ldquo;Recommended&rdquo; to give it the red accent.</p>
            )}
            <div className="bk-pricelist">
              {pricing.map((o, i) => (
                <PriceCard
                  key={i}
                  opt={o}
                  index={i}
                  editing={editIdx === i}
                  onEdit={() => setEditIdx(i)}
                  onDone={() => { setEditIdx(null); if (pricingDirty) savePricing(); }}
                  onChange={(k, v) => setOpt(i, k, v)}
                  onRemove={() => { removeOpt(i); setEditIdx(null); }}
                />
              ))}
            </div>
            <div className="bk-price-actions">
              {pricing.length < 3 && (
                <button type="button" className="aa-btn" onClick={addPricing}><Plus width={14} height={14} /> Add option</button>
              )}
              {pricingDirty && (
                <button type="button" className="aa-btn aa-btn--primary" onClick={savePricing}>
                  <Check width={14} height={14} /> Save pricing
                </button>
              )}
            </div>
          </Section>

          {/* Concepts tracker */}
          <Section
            id="concepts" tone="hero"
            icon={<ClipboardCheck width={16} height={16} />}
            title="Concepts for the meeting"
            note={(tracker.items || []).length ? `${tracker.items.filter(i => i.done).length}/${tracker.items.length}` : undefined}
            open={!!openMap.concepts}
            onToggle={toggleSection}
          >
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
              {!(tracker.items || []).length && (
                <p className="bk-muted">Nothing tracked yet — add the concepts you&rsquo;re building for this meeting.</p>
              )}
              <form className="bk-concept-add" onSubmit={(e) => { e.preventDefault(); addConcept(); }}>
                <input className="aa-input" value={newConcept} onChange={e => setNewConcept(e.target.value)} placeholder="Add a concept — logo, storefront mockup, demo site…" />
                <button type="submit" className="aa-iconbtn" disabled={!newConcept.trim()} aria-label="Add concept"><Plus width={15} height={15} /></button>
              </form>
            </div>

            {/* Links as real buttons — one tap mid-call, not buried in a field */}
            {(tracker.demoUrl || tracker.driveUrl) && (
              <div className="bk-links">
                {tracker.demoUrl && (
                  <a className="bk-link" href={tracker.demoUrl} target="_blank" rel="noopener noreferrer">
                    <LinkExternal01 width={17} height={17} />
                    <span><strong>Open demo site</strong><em>{tracker.demoUrl.replace(/^https?:\/\//, '')}</em></span>
                  </a>
                )}
                {tracker.driveUrl && (
                  <a className="bk-link" href={tracker.driveUrl} target="_blank" rel="noopener noreferrer">
                    <LinkExternal01 width={17} height={17} />
                    <span><strong>Open Drive folder</strong><em>{tracker.driveUrl.replace(/^https?:\/\//, '')}</em></span>
                  </a>
                )}
              </div>
            )}
            <button type="button" className="aa-minibtn bk-linkedit" onClick={() => setLinksEdit(v => !v)}>
              {linksEdit ? 'Hide link fields' : (tracker.demoUrl || tracker.driveUrl) ? 'Edit links' : 'Add demo / Drive links'}
            </button>
            {linksEdit && (
              <>
                <div className="bk-url-grid">
                  <label className="bk-field">
                    <span>Demo site URL</span>
                    <input className="aa-input" value={urls.demoUrl} onChange={e => { setUrls(u => ({ ...u, demoUrl: e.target.value })); setUrlsDirty(true); }} placeholder="https://demo…" inputMode="url" autoCapitalize="none" />
                  </label>
                  <label className="bk-field">
                    <span>Drive folder</span>
                    <input className="aa-input" value={urls.driveUrl} onChange={e => { setUrls(u => ({ ...u, driveUrl: e.target.value })); setUrlsDirty(true); }} placeholder="https://drive.google.com/…" inputMode="url" autoCapitalize="none" />
                  </label>
                </div>
                {urlsDirty && (
                  <button type="button" className="aa-btn aa-btn--primary" onClick={async () => { const ok = await saveTracker(urls); if (ok) { setUrlsDirty(false); setLinksEdit(false); } }}>
                    <Check width={14} height={14} /> Save links
                  </button>
                )}
              </>
            )}
          </Section>

          {/* Prep notes */}
          <Section
            id="prep"
            title="Prep notes"
            summary={prep ? prep.slice(0, 90) + (prep.length > 90 ? '…' : '') : 'No prep notes yet'}
            open={!!openMap.prep}
            onToggle={toggleSection}
          >
            <GrowInput
              className="bk-grow--tall"
              value={prep}
              onChange={e => { setPrep(e.target.value); setPrepState('dirty'); }}
              placeholder="Talking points, objections to expect, the hook to open with…"
            />
            {prepState !== 'idle' && (
              <button type="button" className="aa-btn aa-btn--primary" onClick={savePrep} disabled={prepState === 'saving'}>
                {prepState === 'saving' ? 'Saving…' : prepState === 'saved' ? 'Saved' : 'Save notes'}
              </button>
            )}
          </Section>

          {/* Checklists + their site submissions */}
          <Section
            id="tasks"
            title="Checklists"
            note={checklistProgress(lead).total ? `${checklistProgress(lead).done}/${checklistProgress(lead).total}` : undefined}
            summary={checklistProgress(lead).lists ? undefined : 'No checklists yet'}
            open={!!openMap.tasks}
            onToggle={toggleSection}
          >
            <Checklists lead={lead} onPatch={onPatch} />
          </Section>
          <Section
            id="subs"
            title="Their site submissions"
            note={(submissions || []).filter(s => s.linkedLeadId === lead._id).length || undefined}
            open={!!openMap.subs}
            onToggle={toggleSection}
          >
            <LinkedSubmissions lead={lead} submissions={submissions || []} onLinkSubmission={onLinkSubmission} />
          </Section>

          {/* Carried-over context from the Call Console */}
          {lead.angle && (
            <Section id="angle" title="The angle" open={!!openMap.angle} onToggle={toggleSection}>
              <p className="bk-angle">{lead.angle}</p>
            </Section>
          )}
          {lead.notes && (
            <Section id="notes" title="Lead notes" open={!!openMap.notes} onToggle={toggleSection}>
              <p className="bk-angle">{lead.notes}</p>
            </Section>
          )}
          <Section id="log" title="Call log" note={(lead.callLog || []).length || undefined} open={!!openMap.log} onToggle={toggleSection}>
            <LogList lead={lead} />
          </Section>

          </div>{/* /bk-col call */}
          </div>{/* /bk-grid */}
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

export default function AdminBooked({ leads, submissions = [], loading, onPatch, onRefresh, onLinkSubmission, onMobileOpen, onMobileClose, onGo, openId }) {
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
  useEffect(() => { if (openId?.id) { setSelId(openId.id); onMobileOpen?.(); } }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  useTopBar(sel ? { title: sel.business, back } : null);

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
          <BookedDetail lead={sel} submissions={submissions} onPatch={onPatch} onLinkSubmission={onLinkSubmission} onClose={back} onClosedOut={closedOut} />
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
    /* Beat .aa-app.has-detail .aa-main{display:block} — without the flex
       column the pinned Won/Lost bar drops out of the layout entirely. */
    .aa-app.has-detail .aa-main.bk-main { display: flex; flex-direction: column; }
  }
  .bk-detail { --v-stack-gap: 18px; padding-bottom: 8px; }

  /* Desktop workspace: two columns filling the space beside the rail.
     Below 1200px (and on mobile) the columns stack in the original order. */
  .bk-grid, .bk-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  /* Call mode on a phone: pricing + concepts jump above the prep stack */
  .bk-grid.is-call .bk-col--call { order: 1; }
  .bk-grid.is-call .bk-col--prep { order: 2; }
  @media (min-width: 1200px) {
    .bk-detail.lay-content { max-width: 1320px; }
    .bk-grid {
      display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
      gap: 20px; align-items: start;
    }
    /* Call-critical column always leads on desktop, regardless of DOM order */
    .bk-col--call { order: 1; }
    .bk-col--prep { order: 2; }
  }

  /* ── Collapsible section ──
     Body is always mounted and animated with grid-template-rows (height:auto
     can't animate and a conditional mount reads as a dead tap on touch). */
  .bk-sec { border: 1px solid var(--a-border); border-radius: 14px; background: var(--a-card); }
  .bk-sec-head {
    display: flex; align-items: center; gap: 10px; width: 100%;
    min-height: 52px; padding: 12px 15px;
    cursor: pointer; background: none; border: none;
    font-family: inherit; color: var(--a-sec); text-align: left;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  }
  .bk-sec-head:hover { color: #fafafa; }
  .bk-sec-title {
    display: inline-flex; align-items: center; gap: 9px; min-width: 0;
    font-size: 0.76rem; font-weight: 800; letter-spacing: 0.11em; text-transform: uppercase;
  }
  .bk-sec-title svg { color: var(--a-muted); flex-shrink: 0; }
  .bk-sec-note {
    font-size: 0.68rem; font-weight: 800; color: var(--a-muted);
    background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 999px;
  }
  .bk-sec-chev { margin-left: auto; flex-shrink: 0; color: var(--a-muted); transition: transform 0.2s var(--ease, ease); }
  .bk-sec.is-open .bk-sec-chev { transform: rotate(180deg); }
  .bk-sec-summary {
    padding: 0 15px 13px; margin-top: -4px;
    font-size: 0.85rem; line-height: 1.5; color: var(--a-sec);
    overflow-wrap: anywhere;
  }
  .bk-sec-body {
    display: grid; grid-template-rows: 0fr; min-width: 0;
    transition: grid-template-rows 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .bk-sec.is-open .bk-sec-body { grid-template-rows: 1fr; }
  /* min-width:0 — a grid item defaults to min-width:auto and would refuse to
     shrink below its longest word, pushing content past the screen edge */
  .bk-sec-clip { overflow: hidden; min-height: 0; min-width: 0; }
  .bk-sec.is-open .bk-sec-clip { overflow: visible; }
  .bk-sec-inner {
    display: flex; flex-direction: column; gap: 12px; min-width: 0;
    padding: 2px 15px 16px;
  }
  .bk-sec-inner > * { min-width: 0; max-width: 100%; }

  /* Hero sections — pricing + concepts carry more weight than collapsed prep */
  .bk-sec--hero { border-color: rgba(255,255,255,0.14); background: #131313; }
  .bk-sec--hero .bk-sec-head { min-height: 58px; }
  .bk-sec--hero .bk-sec-title { font-size: 0.84rem; color: #fafafa; letter-spacing: 0.09em; }
  .bk-sec--hero .bk-sec-title svg { color: var(--a-brand); }

  /* Call mode toggle */
  .bk-callmode {
    display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0;
    min-height: 40px; padding: 8px 15px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--a-border); background: rgba(255,255,255,0.05);
    color: var(--a-sec); font-size: 0.78rem; font-weight: 800; font-family: inherit;
    touch-action: manipulation; transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .bk-callmode:hover { color: #fafafa; }
  .bk-callmode.is-on { background: var(--a-brand); border-color: var(--a-brand); color: #fff; }
  .bk-top-spacer { flex: 1; }

  /* Auto-growing text field — full content visible at rest, no clipping.
     The hidden mirror (::after) sizes the grid cell; the textarea fills it. */
  .bk-grow { display: grid; width: 100%; min-width: 0; }
  .bk-grow::after {
    content: attr(data-value) ' ';
    visibility: hidden; pointer-events: none;
    white-space: pre-wrap; overflow-wrap: anywhere;
    grid-area: 1 / 1 / 2 / 2;
    padding: 9px 12px; border: 1px solid transparent;
    font-family: inherit; font-size: 0.875rem; line-height: 1.55;
  }
  .bk-grow > textarea {
    grid-area: 1 / 1 / 2 / 2;
    resize: none; overflow: hidden;
    line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere;
  }
  @media (max-width: 768px) {
    /* mirror the global 16px iOS input floor so heights stay in sync */
    .bk-grow::after { font-size: 16px; }
  }
  .bk-grow--tall::after { min-height: 96px; }
  .bk-grow--tall > textarea { min-height: 96px; }
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

  /* ── Pricing: the block read off during the close ── */
  .bk-pricelist { display: flex; flex-direction: column; gap: 12px; }
  .bk-price {
    display: flex; flex-direction: column; gap: 9px;
    background: var(--a-raised); border: 1px solid var(--a-border);
    border-radius: 13px; padding: 16px 18px;
  }
  .bk-price.is-rec { border-color: rgba(212,76,67,0.5); background: rgba(212,76,67,0.06); }
  .bk-price-head { display: flex; align-items: center; gap: 10px; }
  .bk-price-name {
    font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; color: #fafafa;
    min-width: 0; overflow-wrap: anywhere;
  }
  .bk-rec-tag {
    font-size: 0.58rem; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase;
    padding: 3px 9px; border-radius: 999px; flex-shrink: 0;
    background: var(--a-brand); color: #fff;
  }
  .bk-price-edit {
    margin-left: auto; flex-shrink: 0; display: flex; padding: 8px; border-radius: 9px;
    background: none; border: 1px solid transparent; cursor: pointer; color: var(--a-muted);
    touch-action: manipulation;
  }
  .bk-price-edit:hover { color: #fafafa; border-color: var(--a-border); }
  .bk-price-figure { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .bk-price-num {
    font-family: 'Barlow Condensed', 'Inter', sans-serif;
    font-size: 2.4rem; font-weight: 700; line-height: 1; letter-spacing: 0.01em; color: #fafafa;
  }
  .bk-price.is-rec .bk-price-num { color: #f0a09a; }
  .bk-price-plan { font-size: 0.86rem; font-weight: 700; color: var(--a-sec); }
  .bk-price-sub {
    font-size: 0.62rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase;
    color: var(--a-muted); margin-top: 2px;
  }
  .bk-price-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
  .bk-price-list li {
    position: relative; padding-left: 16px;
    font-size: 0.92rem; line-height: 1.5; color: #eaeaea; overflow-wrap: anywhere;
  }
  .bk-price-list li::before {
    content: ''; position: absolute; left: 0; top: 0.62em;
    width: 5px; height: 5px; border-radius: 50%; background: var(--a-brand);
  }
  .bk-price-retainer {
    font-size: 0.9rem; line-height: 1.55; color: #eaeaea; overflow-wrap: anywhere;
    padding-top: 9px; border-top: 1px solid var(--a-border);
  }
  .bk-price-retainer span {
    font-size: 0.62rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase;
    color: var(--a-muted); margin-right: 7px;
  }
  .bk-price-editrow { display: flex; align-items: center; gap: 10px; }
  .bk-price-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .bk-price-row { display: flex; gap: 8px; align-items: center; }
  .bk-price-row > * { min-width: 0; }
  .bk-price-label { flex: 1; font-weight: 700; }
  .bk-price-amt { display: flex; align-items: center; gap: 6px; width: 138px; flex-shrink: 0; font-weight: 800; color: var(--a-muted); }
  .bk-price-amt .aa-input { font-size: 1.1rem; font-weight: 800; }
  .bk-price-row--plan .aa-input { flex: 0 1 auto; width: auto; }
  .bk-price-monthly { font-size: 0.85rem; font-weight: 800; color: #fafafa; white-space: nowrap; }
  .bk-price-del {
    background: none; border: none; cursor: pointer; color: var(--a-muted); flex-shrink: 0;
    display: flex; padding: 8px; border-radius: 8px; margin-left: auto;
  }
  .bk-price-del:hover { color: #f87171; }
  .bk-price-hint { font-size: 0.72rem; color: var(--a-muted); }
  .bk-price-warn { display: inline-flex; align-items: center; gap: 6px; font-size: 0.74rem; font-weight: 700; color: #fbbf24; }

  /* ── Concept links as real buttons ── */
  .bk-links { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .bk-link {
    display: flex; align-items: center; gap: 12px; min-height: 54px;
    padding: 12px 16px; border-radius: 12px; text-decoration: none;
    background: rgba(212,76,67,0.08); border: 1px solid rgba(212,76,67,0.35);
    color: #fafafa; transition: background 0.15s, border-color 0.15s;
    touch-action: manipulation;
  }
  .bk-link:hover { background: rgba(212,76,67,0.16); border-color: rgba(212,76,67,0.6); }
  .bk-link svg { color: var(--a-brand); flex-shrink: 0; }
  .bk-link span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .bk-link strong { font-size: 0.9rem; font-weight: 800; min-width: 0; }
  /* the URL itself may be absurdly long — it truncates, the label never does */
  .bk-link em {
    font-style: normal; font-size: 0.72rem; color: var(--a-muted);
    min-width: 0; max-width: 100%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .bk-linkedit { align-self: flex-start; }

  .bk-concepts { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
  .bk-concept { display: flex; align-items: center; gap: 10px; min-width: 0; }
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
  .bk-concept-add { display: flex; gap: 8px; margin-top: 2px; min-width: 0; }
  .bk-concept-add .aa-input { flex: 1; min-width: 0; width: 100%; }

  .bk-url-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 640px) { .bk-url-grid { grid-template-columns: 1fr; } }
  .bk-url-row { display: flex; gap: 7px; align-items: center; }
  .bk-url-row .aa-input { flex: 1; min-width: 0; }

  .bk-sec-inner .aa-btn { align-self: flex-start; }

  .bk-angle { font-size: 0.92rem; line-height: 1.65; color: #eaeaea; white-space: pre-wrap; overflow-wrap: anywhere; }

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
