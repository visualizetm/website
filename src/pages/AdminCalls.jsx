import { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import PhoneIncoming01 from '@untitled-ui/icons-react/build/esm/PhoneIncoming01';
import PhoneHangUp from '@untitled-ui/icons-react/build/esm/PhoneHangUp';
import Voicemail from '@untitled-ui/icons-react/build/esm/Voicemail';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import AlertCircle from '@untitled-ui/icons-react/build/esm/AlertCircle';
import AlertTriangle from '@untitled-ui/icons-react/build/esm/AlertTriangle';
import Play from '@untitled-ui/icons-react/build/esm/Play';
import SkipForward from '@untitled-ui/icons-react/build/esm/SkipForward';
import Keyboard01 from '@untitled-ui/icons-react/build/esm/Keyboard01';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import Wordmark from '../components/Wordmark';
import IMPORT_LEADS from '../data/call-leads-import.json';
import UserPlus01 from '@untitled-ui/icons-react/build/esm/UserPlus01';
import UserX01 from '@untitled-ui/icons-react/build/esm/UserX01';
import { ADMIN_HOME } from '../lib/adminPaths';
import { ScrollArea, StickyFooterBar, adminLayoutStyles } from '../components/AdminLayout';
import { SocialButtons, SocialFields } from '../components/SocialLinks';
import { normalizeSocials } from '../lib/socials';
import { digitsOf, matchRank, formatPhone } from '../lib/phone';
import { effectiveStage, deleteBlockReason } from '../lib/booked';

const CALL_STATUSES = [
  { id: 'not-called', label: 'Not called', color: '#8a8a8a' },
  { id: 'callback',   label: 'Callback',   color: '#60a5fa' },
  { id: 'booked',     label: 'Booked',     color: '#22c55e' },
  { id: 'no',         label: 'No',         color: '#ef4444' },
  { id: 'no-answer',  label: 'No answer',  color: '#f59e0b' },
];
const statusOf = (id) => CALL_STATUSES.find(s => s.id === id) || CALL_STATUSES[0];

// The four outcomes you can log from the bar, in bar order.
const OUTCOMES = [
  { id: 'booked',    label: 'Booked',    key: '1', color: '#22c55e', Icon: Check },
  { id: 'callback',  label: 'Callback',  key: '2', color: '#60a5fa', Icon: PhoneIncoming01 },
  { id: 'no',        label: 'No',        key: '3', color: '#ef4444', Icon: PhoneHangUp },
  { id: 'no-answer', label: 'No answer', key: '4', color: '#f59e0b', Icon: Voicemail },
];
const outcomeOf = (id) => OUTCOMES.find(o => o.id === id);

const WARN_RX = /(DO NOT|DISQUALIF|WARNING|never dial)/i;
const PRIO_RANK = { hot: 0, warm: 1, cold: 2 };
const STATUS_RANK = { 'not-called': 0, 'callback': 1, 'no-answer': 2, 'booked': 3, 'no': 4 };
const SESSION_KEY = 'vz_call_session';

const telOf = (lead) => lead?.phone ? `tel:${lead.phone.replace(/[^0-9+]/g, '')}` : null;
const fmtMins = (ms) => {
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
const fmtLogTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// Standard script skeleton for manually added leads — same bones as the
// notepad docs, personalized from the business fields.
export function defaultLead(f) {
  const who = f.askFor?.trim() || 'the owner';
  return {
    ...f,
    callStatus: 'not-called',
    angle: f.angle || '',
    beforeYouDial: [
      'Open their socials / site on your phone',
      'Know cold: what they do, where, and one specific detail to mention',
      'Listening for: what they care about growing — that becomes the pitch',
    ],
    script: {
      confirm: `Hey, is this ${who.replace(/^ask for /i, '')}?`,
      intro: "Hey, I'm Rob. I do branding and websites for local businesses here in Delaware. I know you're probably busy so I'll be quick.",
      homework: `I came across ${f.business} and did my homework before calling. That's actually why I'm reaching out.`,
      question: 'Quick question before I take up more of your time. Who’s handling your website and branding right now?',
      likelyAnswers: [
        { say: 'We just use social media', respond: 'Right, and it works for regulars. But when someone new hears about you and Googles you, a site is what catches them.' },
        { say: 'Somebody set it up a while ago', respond: 'Nice, it got you this far. I’d be bringing it up to where the business actually is now.' },
        { say: 'Nobody, word of mouth', respond: 'Word of mouth is your best asset. A site just catches the people who hear about you but need to see you before they call.' },
      ],
      hook: `So here's how I work. I build concepts before I ever talk numbers. I'd mock up what ${f.business} could look like, a logo, a simple site, and just show you. Free, no strings.`,
      ask: '15 minutes this week? Morning before 8, or evening after 5?',
    },
    objections: [
      { say: 'How much is this?', respond: 'Depends what you actually need. Let me show you the concepts first, then we talk about what makes sense.' },
      { say: "We're doing fine", respond: "Then it's not about more customers, it's about better ones. A real brand wins the higher-ticket work." },
      { say: 'How old are you?', respond: "20. Which means you're talking to the person actually doing the work, and you're not paying agency overhead." },
      { say: 'Not spending right now', respond: "Not asking you to. The call's free and the concepts are free. You'd just know what's possible when the timing is right." },
    ],
    close: {
      lockIt: "Cool, [day] at [time]. What's the best email to send the calendar invite to? — Confirm the day and time back before hanging up.",
      ifNo: "All good, appreciate you taking the call. Mind if I send the concepts over anyway? Costs you nothing, and if it's ever the right time you'll already know exactly what I'd do. — Get the email even on a no. Follow up in 30 days.",
      noAnswer: 'No voicemail on attempt 1. Call back at a different time of day.',
    },
    afterCall: { meeting: '', email: '', whatTheySaid: '', nextAction: '' },
    intel: { accomplishments: [], gaps: [], dropLines: [] },
    socials: normalizeSocials(f.socials),
  };
}

function PriorityPill({ p }) {
  return <span className={`cc-prio cc-prio--${p}`}>{p === 'hot' ? 'HOT' : p === 'cold' ? 'COLD' : 'WARM'}</span>;
}

function StatusChip({ id }) {
  const s = statusOf(id);
  return (
    <span className="cc-status" style={{ '--sc': s.color }}>
      <span className="cc-status-dot" />{s.label}
    </span>
  );
}

function QaTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="cc-qa">
      {rows.map((r, i) => (
        <div key={i} className="cc-qa-row">
          <span className="cc-qa-say">{r.say}</span>
          <span className="cc-qa-respond">{r.respond}</span>
        </div>
      ))}
    </div>
  );
}

/* ── New lead form (overlay) ───────────────────────────────────── */

function NewLeadForm({ onCreate, onClose, initial }) {
  const [f, setF] = useState({
    business: '', industry: '', descriptor: '', phone: '', phoneNote: '',
    askFor: '', bestWindow: 'Before 8am or after 5pm.', priority: 'warm', angle: '',
    socials: {},
    ...(initial || {}),
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const setSocial = (k, v) => setF(p => ({ ...p, socials: { ...p.socials, [k]: v } }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.business.trim()) return;
    setBusy(true);
    await onCreate(defaultLead(f));
    setBusy(false);
  };

  return (
    <form className="cc-new" onSubmit={submit}>
      <div className="cc-new-head">
        <h2 className="cc-new-title">New lead</h2>
        <button type="button" className="cc-iconbtn" onClick={onClose} aria-label="Close">
          <XClose width={16} height={16} />
        </button>
      </div>
      <div className="cc-new-grid">
        <label className="cc-field cc-field--wide">
          <span>Business name</span>
          <input className="cc-input" value={f.business} onChange={set('business')} required autoFocus placeholder="Garcia's Landscaping" />
        </label>
        <label className="cc-field">
          <span>Industry</span>
          <input className="cc-input" value={f.industry} onChange={set('industry')} placeholder="Landscaping" />
        </label>
        <label className="cc-field">
          <span>Phone</span>
          <input className="cc-input" value={f.phone} onChange={set('phone')} placeholder="(302) 555-0123" />
        </label>
        <label className="cc-field cc-field--wide">
          <span>One-line descriptor</span>
          <input className="cc-input" value={f.descriptor} onChange={set('descriptor')} placeholder="What they do · where · one proof point" />
        </label>
        <label className="cc-field">
          <span>Ask for</span>
          <input className="cc-input" value={f.askFor} onChange={set('askFor')} placeholder="Ask for the owner" />
        </label>
        <label className="cc-field">
          <span>Best window</span>
          <input className="cc-input" value={f.bestWindow} onChange={set('bestWindow')} />
        </label>
        <label className="cc-field">
          <span>Priority</span>
          <select className="cc-input" value={f.priority} onChange={set('priority')}>
            <option value="hot">HOT</option>
            <option value="warm">WARM</option>
            <option value="cold">COLD</option>
          </select>
        </label>
        <label className="cc-field cc-field--wide">
          <span>The angle (why this lead, in one paragraph)</span>
          <textarea className="cc-input" rows={3} value={f.angle} onChange={set('angle')} placeholder="What you noticed, and the gap you'd pitch." />
        </label>
        <div className="cc-field cc-field--wide">
          <span>Social links &amp; website</span>
          <SocialFields values={f.socials} onChange={setSocial} />
        </div>
      </div>
      <p className="cc-new-note">A standard call script is generated automatically — the angle and details personalize it.</p>
      <button type="submit" className="cc-btn cc-btn--primary" disabled={busy || !f.business.trim()}>
        {busy ? 'Saving…' : 'Add lead'}
      </button>
    </form>
  );
}

/* ── Edit lead (overlay) ───────────────────────────────────────── */

function EditLead({ lead, onPatch, onDelete, onClose }) {
  const [d, setD] = useState({
    business: lead.business || '', descriptor: lead.descriptor || '', industry: lead.industry || '',
    phone: lead.phone || '', phoneNote: lead.phoneNote || '', askFor: lead.askFor || '',
    bestWindow: lead.bestWindow || '', area: lead.area || '', email: lead.email || '',
    priority: lead.priority || 'warm', angle: lead.angle || '',
    socials: { ...(lead.socials || {}) },
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setD(p => ({ ...p, [k]: e.target.value }));
  const setSocial = (k, v) => setD(p => ({ ...p, socials: { ...(p.socials || {}), [k]: v } }));

  const save = async () => {
    setBusy(true);
    await onPatch(lead._id, { ...d, socials: normalizeSocials(d.socials) });
    setBusy(false);
    onClose();
  };

  return (
    <form className="cc-new" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="cc-new-head">
        <h2 className="cc-new-title">Edit lead</h2>
        <button type="button" className="cc-iconbtn" onClick={onClose} aria-label="Close">
          <XClose width={16} height={16} />
        </button>
      </div>
      <div className="cc-new-grid">
        {[['business', 'Business'], ['descriptor', 'Descriptor'], ['industry', 'Industry'],
          ['phone', 'Phone'], ['phoneNote', 'Phone note'], ['askFor', 'Ask for'],
          ['area', 'Area'], ['email', 'Email'], ['bestWindow', 'Best window']]
          .map(([k, label]) => (
          <label key={k} className={`cc-field${k === 'business' || k === 'descriptor' ? ' cc-field--wide' : ''}`}>
            <span>{label}</span>
            <input className="cc-input" value={d[k]} onChange={set(k)} />
          </label>
        ))}
        <label className="cc-field">
          <span>Priority</span>
          <select className="cc-input" value={d.priority} onChange={set('priority')}>
            <option value="hot">HOT</option>
            <option value="warm">WARM</option>
            <option value="cold">COLD</option>
          </select>
        </label>
        <label className="cc-field cc-field--wide">
          <span>The angle</span>
          <textarea className="cc-input" rows={3} value={d.angle} onChange={set('angle')} />
        </label>
        <div className="cc-field cc-field--wide">
          <span>Social links &amp; website</span>
          <SocialFields values={d.socials} onChange={setSocial} />
        </div>
      </div>
      <div className="cc-edit-actions">
        <button type="submit" className="cc-btn cc-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="cc-btn" onClick={onClose}>Cancel</button>
        <span style={{ flex: 1 }} />
        {deleteBlockReason(lead) ? (
          <span className="cc-del-blocked">{deleteBlockReason(lead)}</span>
        ) : (
          <button
            type="button"
            className="cc-btn cc-btn--danger"
            onClick={() => { if (window.confirm(`Delete ${lead.business}? It moves to Recently deleted in Settings (30-day restore).`)) onDelete(lead._id); }}
          >
            <Trash01 width={14} height={14} /> Delete
          </button>
        )}
      </div>
    </form>
  );
}

/* ── Collapsible section ───────────────────────────────────────── */

function Collapse({ title, note, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`cc-fold${open ? ' is-open' : ''}`}>
      <button type="button" className="cc-fold-head" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="cc-fold-title">{title}</span>
        {note != null && <span className="cc-fold-note">{note}</span>}
        <ChevronDown width={16} height={16} className="cc-fold-chev" />
      </button>
      {open && <div className="cc-fold-body">{children}</div>}
    </section>
  );
}

/* ── Full script body (inside a Collapse) ──────────────────────── */

function ScriptBody({ lead }) {
  const s = lead.script || {};
  const steps = [
    { n: '1', t: 'CONFIRM', body: s.confirm },
    { n: '2', t: 'INTRO + BUY TIME', body: s.intro },
    { n: '3', t: 'HOMEWORK LINE', body: s.homework },
    { n: '4', t: 'THE QUESTION (then stop talking)', body: s.question, qa: s.likelyAnswers, qaLabel: 'Their likely answers' },
    { n: '5', t: 'THE HOOK', body: s.hook },
    { n: '6', t: 'THE ASK (two options, always)', body: s.ask },
  ].filter(st => st.body);
  return (
    <div className="cc-script">
      {lead.beforeYouDial?.length > 0 && (
        <ul className="cc-predial">
          {lead.beforeYouDial.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      )}
      <ol className="cc-steps">
        {steps.map(st => (
          <li key={st.n} className="cc-step">
            <div className="cc-step-head">
              <span className="cc-step-num">{st.n}</span>
              <span className="cc-step-title">{st.t}</span>
            </div>
            <p className="cc-say">&ldquo;{st.body}&rdquo;</p>
            {st.qa?.length > 0 && (
              <>
                <p className="cc-qa-label">{st.qaLabel}:</p>
                <QaTable rows={st.qa} />
              </>
            )}
          </li>
        ))}
      </ol>
      {lead.objections?.length > 0 && (
        <>
          <h3 className="cc-sub-h">Objections <span>return to the ask after every one</span></h3>
          <QaTable rows={lead.objections} />
        </>
      )}
      {(lead.close?.lockIt || lead.close?.ifNo || lead.close?.noAnswer) && (
        <div className="cc-close-grid">
          {lead.close.lockIt && <div className="cc-close-card cc-close-card--lock"><h3>Lock it</h3><p>{lead.close.lockIt}</p></div>}
          {lead.close.ifNo && <div className="cc-close-card"><h3>If it&rsquo;s a no</h3><p>{lead.close.ifNo}</p></div>}
          {lead.close.noAnswer && <div className="cc-close-card"><h3>No answer</h3><p>{lead.close.noAnswer}</p></div>}
        </div>
      )}
      {(lead.intel?.accomplishments?.length > 0 || lead.intel?.gaps?.length > 0 || lead.intel?.dropLines?.length > 0) && (
        <div className="cc-intel">
          {lead.intel.accomplishments?.length > 0 && (
            <div><h3 className="cc-sub-h cc-sub-h--plus">Accomplishments</h3><ul className="cc-predial">{lead.intel.accomplishments.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
          {lead.intel.gaps?.length > 0 && (
            <div><h3 className="cc-sub-h cc-sub-h--minus">Gaps</h3><ul className="cc-predial">{lead.intel.gaps.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
          {lead.intel.dropLines?.length > 0 && (
            <div>
              <h3 className="cc-sub-h">Drop these on the call</h3>
              {lead.intel.dropLines.map((x, i) => <blockquote key={i} className="cc-dropline">&ldquo;{x}&rdquo;</blockquote>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Call log list ─────────────────────────────────────────────── */

function CallLogList({ lead }) {
  const log = [...(lead.callLog || [])].reverse();
  if (!log.length) return <p className="cc-log-empty">No calls logged yet.</p>;
  return (
    <ul className="cc-log">
      {log.map((e, i) => {
        const o = outcomeOf(e.outcome) || outcomeOf('no-answer');
        return (
          <li key={i} className="cc-log-row" style={{ '--sc': o.color }}>
            <span className="cc-log-dot" />
            <div className="cc-log-main">
              <div className="cc-log-top">
                <span className="cc-log-outcome">{o.label}</span>
                <span className="cc-log-time">{fmtLogTime(e.at)}</span>
              </div>
              {e.meeting && <p className="cc-log-note"><strong>Meeting:</strong> {e.meeting}</p>}
              {e.email && <p className="cc-log-note"><strong>Email:</strong> {e.email}</p>}
              {e.note && <p className="cc-log-note">{e.note}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Session notes panel (desktop right zone + mobile fold) ────── */

function NotesPanel({ lead, onSaveNotes, noteRef }) {
  const [draft, setDraft] = useState(lead.notes || '');
  const [state, setState] = useState('idle'); // idle | dirty | saving | saved
  useEffect(() => { setDraft(lead.notes || ''); setState('idle'); }, [lead._id]);

  const save = async () => {
    setState('saving');
    const ok = await onSaveNotes(lead._id, draft);
    setState(ok ? 'saved' : 'dirty');
    if (ok) setTimeout(() => setState(s => s === 'saved' ? 'idle' : s), 1500);
  };

  return (
    <div className="cc-notespanel">
      <textarea
        ref={noteRef}
        className="cc-input cc-notes-ta"
        rows={5}
        value={draft}
        placeholder="Notes on this lead…"
        onChange={(e) => { setDraft(e.target.value); setState('dirty'); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } }}
      />
      {state !== 'idle' && (
        <button type="button" className="cc-btn cc-btn--primary cc-notes-save" onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save notes'}
        </button>
      )}
    </div>
  );
}

/* ── Outcome sheet ─────────────────────────────────────────────── */

function OutcomeSheet({ outcome, lead, onLog, onCancel }) {
  const o = outcomeOf(outcome);
  const [note, setNote] = useState('');
  const [meeting, setMeeting] = useState('');
  const [email, setEmail] = useState(lead.email || lead.afterCall?.email || '');
  const noteInput = useRef(null);
  const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  useEffect(() => {
    // Desktop: type a note immediately, Enter logs. Mobile: don't pop the keyboard.
    if (!isTouch) noteInput.current?.focus();
  }, []);

  return (
    <div className="cc-sheet-back" onClick={onCancel}>
      <form
        className="cc-sheet"
        style={{ '--sc': o.color }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onLog(outcome, { note, meeting, email }); }}
      >
        <div className="cc-sheet-head">
          <span className="cc-sheet-badge"><o.Icon width={16} height={16} /> {o.label}</span>
          <span className="cc-sheet-biz">{lead.business}</span>
          <button type="button" className="cc-iconbtn" onClick={onCancel} aria-label="Cancel">
            <XClose width={16} height={16} />
          </button>
        </div>
        {outcome === 'booked' && (
          <div className="cc-sheet-grid">
            <label className="cc-field">
              <span>Meeting day + time</span>
              <input className="cc-input" value={meeting} onChange={(e) => setMeeting(e.target.value)} placeholder="Thursday 7am" autoFocus={false} />
            </label>
            <label className="cc-field">
              <span>Their email</span>
              <input className="cc-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@business.com" inputMode="email" />
            </label>
          </div>
        )}
        <label className="cc-field">
          <span>Quick note <em>(optional)</em></span>
          <input
            ref={noteInput}
            className="cc-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={outcome === 'callback' ? 'When to call back, what they said…' : 'What they said…'}
          />
        </label>
        <div className="cc-sheet-actions">
          <button type="submit" className="cc-btn cc-btn--log">Log &amp; next</button>
          <span className="cc-sheet-hint">Enter logs it</span>
        </div>
      </form>
    </div>
  );
}

/* ── "Who's calling?" reverse phone lookup ─────────────────────── */

function LookupSheet({ leads, recentIds, onPick, onAddNew, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const qd = digitsOf(q);
  const matches = useMemo(() => {
    if (!qd) return [];
    return leads
      .map(l => ({ l, rank: matchRank(l.phone, qd) }))
      .filter(x => x.rank >= 0)
      .sort((a, b) => a.rank - b.rank || String(a.l.business).localeCompare(String(b.l.business)))
      .slice(0, 8);
  }, [leads, qd]);

  const recents = useMemo(
    () => recentIds.map(id => leads.find(l => l._id === id)).filter(Boolean).slice(0, 6),
    [recentIds, leads]
  );

  const lastCallLine = (l) => {
    const e = l.callLog?.[l.callLog.length - 1];
    if (!e) return null;
    const o = outcomeOf(e.outcome);
    return `${o ? o.label : e.outcome} · ${fmtLogTime(e.at)}`;
  };

  const Row = ({ l, exact }) => (
    <button type="button" className={`lk-row lay-card${exact ? ' is-exact' : ''}`} onClick={() => onPick(l)}>
      <span className="cq-dot" style={{ '--sc': statusOf(l.callStatus).color }} />
      <span className="lk-row-main">
        <span className="lk-row-name lay-truncate">{l.business}</span>
        <span className="lk-row-sub lay-truncate">
          {formatPhone(l.phone)}
          {lastCallLine(l) ? ` · ${lastCallLine(l)}` : ''}
        </span>
      </span>
      <PriorityPill p={l.priority} />
    </button>
  );

  return (
    <div className="cc-sheet-back" onClick={onClose}>
      <div
        className="cc-sheet lk-sheet"
        style={{ '--sc': '#d44c43' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      >
        <div className="cc-sheet-head">
          <span className="cc-sheet-badge"><PhoneIncoming01 width={16} height={16} /> Who&rsquo;s calling?</span>
          <button type="button" className="cc-iconbtn" onClick={onClose} aria-label="Close">
            <XClose width={16} height={16} />
          </button>
        </div>
        <input
          ref={inputRef}
          className="cc-input lk-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type or paste the number…"
          inputMode="tel"
          autoComplete="off"
          aria-label="Phone number to look up"
        />
        {!qd && (
          <div className="lk-empty">
            <p className="lk-hint">
              Paste the number that&rsquo;s calling — any format works, even just the last 4 digits.
              <span className="lk-kbd-hint"> Press <kbd>/</kbd> to open this anywhere.</span>
            </p>
            {recents.length > 0 && (
              <>
                <p className="lk-label">Recent lookups</p>
                <div className="lk-list">{recents.map(l => <Row key={l._id} l={l} />)}</div>
              </>
            )}
          </div>
        )}
        {qd && matches.length > 0 && (
          <div className="lk-list">
            {matches.map(({ l, rank }) => <Row key={l._id} l={l} exact={rank === 0} />)}
          </div>
        )}
        {qd.length >= 3 && matches.length === 0 && (
          <div className="lk-nomatch">
            <p>No lead matches <strong>{formatPhone(qd) || qd}</strong>.</p>
            <button type="button" className="cc-btn cc-btn--primary" onClick={() => onAddNew(qd)}>
              <UserPlus01 width={15} height={15} /> Add as new lead
            </button>
            <p className="lk-hint">A callback from an unknown number is often a warm lead worth capturing.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Keyboard shortcuts overlay ────────────────────────────────── */

function ShortcutsOverlay({ onClose }) {
  const rows = [
    ['→ or Space', 'Next lead (skip, no log)'],
    ['←', 'Previous lead'],
    ['1', 'Booked'],
    ['2', 'Callback'],
    ['3', 'No'],
    ['4', 'No answer'],
    ['Enter', 'Save outcome + advance'],
    ['N', 'Focus the note field'],
    ['Esc', 'Close sheet / overlay'],
    ['?', 'Toggle this list'],
  ];
  return (
    <div className="cc-sheet-back" onClick={onClose}>
      <div className="cc-keys" onClick={(e) => e.stopPropagation()}>
        <div className="cc-sheet-head">
          <span className="cc-sheet-badge" style={{ '--sc': '#8a8a8a' }}><Keyboard01 width={16} height={16} /> Keyboard</span>
          <button type="button" className="cc-iconbtn" onClick={onClose} aria-label="Close"><XClose width={16} height={16} /></button>
        </div>
        <div className="cc-keys-grid">
          {rows.map(([k, v]) => (
            <div key={k} className="cc-keys-row"><kbd>{k}</kbd><span>{v}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */

const EMPTY_STATS = { calls: 0, booked: 0, callbacks: 0, no: 0, noAnswer: 0 };
const STAT_KEY = { booked: 'booked', callback: 'callbacks', no: 'no', 'no-answer': 'noAnswer' };

export default function AdminCalls({ embedded = false, onDataChanged }) {
  const [authed, setAuthed] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Queue filters
  // Session builder — the queue screen is about choosing WHO to dial,
  // not browsing leads (that's the Leads page). Empty set = "all".
  const [selPrio, setSelPrio] = useState(() => new Set());
  const [selStatus, setSelStatus] = useState(() => new Set());
  const [selInd, setSelInd] = useState(() => new Set());
  const [includePhoneless, setIncludePhoneless] = useState(false);

  // Overlays
  const [newOpen, setNewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // Session
  const [mode, setMode] = useState('queue'); // queue | session | summary

  // Reverse phone lookup ("Who's calling?"). peek = a lead opened from the
  // lookup, viewed as a session card WITHOUT disturbing any active session.
  const [lookupOpen, setLookupOpen] = useState(false);
  const [peek, setPeek] = useState(null);
  const [recentLookups, setRecentLookups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vz_lookup_recent')) || []; } catch { return []; }
  });
  const pushRecentLookup = (id) => setRecentLookups(prev => {
    const next = [id, ...prev.filter(x => x !== id)].slice(0, 8);
    try { localStorage.setItem('vz_lookup_recent', JSON.stringify(next)); } catch { /* fine */ }
    return next;
  });
  const [session, setSession] = useState(null);
  const [sheet, setSheet] = useState(null); // { outcome }
  const [dir, setDir] = useState(1);
  const [flash, setFlash] = useState(null);
  const [err, setErr] = useState(null); // { msg, retry }
  const noteRef = useRef(null);
  const touch = useRef(null);
  const [, tick] = useReducer(x => x + 1, 0);

  useEffect(() => {
    if (!embedded) document.title = 'Call Console — Visualize';
  }, [embedded]);

  useEffect(() => {
    if (embedded) { setAuthed(true); return; }  // shell already verified the session
    fetch('/api/admin/session').then(r => r.json())
      .then(d => { if (d.authed) setAuthed(true); else window.location.replace(ADMIN_HOME); })
      .catch(() => window.location.replace(ADMIN_HOME));
  }, [embedded]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/call-leads');
      if (res.status === 401) { window.location.replace(ADMIN_HOME); return; }
      const d = await res.json();
      setLeads(d.items || []);
      setLoaded(true);
    } catch { /* keep last */ }
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  // A dashboard stat card can pre-fill the session builder ("Not yet
  // called" → status not-called). One-shot handoff via localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vz_builder_preset');
      if (!raw) return;
      localStorage.removeItem('vz_builder_preset');
      const p = JSON.parse(raw);
      if (Array.isArray(p?.status)) setSelStatus(new Set(p.status));
      if (Array.isArray(p?.priority)) setSelPrio(new Set(p.priority));
    } catch { /* stale/corrupt preset — ignore */ }
  }, []);

  // Restore a persisted session — returning from a phone call or a tab
  // reload never loses your place mid-dialing.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Array.isArray(s?.ids) && s.ids.length) {
        setSession({
          ids: s.ids,
          idx: Math.min(Math.max(0, s.idx || 0), s.ids.length - 1),
          stats: { ...EMPTY_STATS, ...(s.stats || {}) },
          logged: s.logged || {},
          startedAt: s.startedAt || Date.now(),
        });
        setMode(s.mode === 'summary' ? 'summary' : 'session');
      }
    } catch { /* corrupt state — start fresh */ }
  }, []);

  useEffect(() => {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, mode }));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* storage full/blocked — session just won't survive reload */ }
  }, [session, mode]);

  // Session clock (stat strip shows elapsed minutes).
  useEffect(() => {
    if (mode !== 'session') return;
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [mode]);

  /* ── Data ops ── */

  const patch = useCallback(async (id, set, { rollback } = {}) => {
    try {
      const res = await fetch('/api/admin/call-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, set }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      return true;
    } catch {
      if (rollback) rollback();
      setErr({
        msg: 'Save failed — that outcome is NOT stored.',
        retry: () => { setErr(null); patch(id, set, { rollback }); },
      });
      return false;
    }
  }, []);

  const patchLead = useCallback(async (id, set) => {
    const prev = leads.find(l => l._id === id);
    setLeads(ls => ls.map(l => l._id === id ? { ...l, ...set } : l));
    return patch(id, set, { rollback: () => setLeads(ls => ls.map(l => l._id === id ? prev : l)) });
  }, [leads, patch]);

  const saveNotes = useCallback((id, notes) => patchLead(id, { notes }), [patchLead]);

  const createLead = async (lead) => {
    const res = await fetch('/api/admin/call-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    if (res.ok) { setNewOpen(false); await load(); onDataChanged?.(); }
  };

  // Soft-delete a lead and prune it from the console + any active session.
  // Removing the current lead makes the next one take its place, so the
  // session flows on without an explicit advance.
  const removeFromLists = useCallback((id, { endTo = 'summary' } = {}) => {
    setPeek(p => p === id ? null : p);
    setLeads(prev => prev.filter(l => l._id !== id));
    setSession(s => {
      if (!s) return s;
      const ids = s.ids.filter(x => x !== id);
      if (!ids.length) { setMode(endTo); return endTo === 'queue' ? null : { ...s, ids, idx: 0 }; }
      return { ...s, ids, idx: Math.min(s.idx, ids.length - 1) };
    });
    fetch(`/api/admin/call-leads?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(() => onDataChanged?.())
      .catch(() => {});
  }, [onDataChanged]);

  const deleteLead = async (id) => {
    setEditOpen(false);
    removeFromLists(id, { endTo: 'queue' });
  };

  const importNotepads = async () => {
    setImporting(true);
    try {
      await fetch('/api/admin/call-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: IMPORT_LEADS }),
      });
      await load();
      onDataChanged?.();
    } finally { setImporting(false); }
  };

  /* ── Queue ── */

  const industries = useMemo(
    () => [...new Set(leads.map(l => l.industry).filter(Boolean))].sort(),
    [leads]
  );

  const filtered = useMemo(() => {
    return leads
      .filter(l =>
        // Only open pipeline leads are dialable — booked/won/client/lost
        // live in their own workspaces. (Lookup still searches ALL leads.)
        effectiveStage(l) === 'lead' &&
        (!selPrio.size || selPrio.has(l.priority)) &&
        (!selStatus.size || selStatus.has(l.callStatus)) &&
        (!selInd.size || selInd.has(l.industry))
      )
      .sort((a, b) =>
        (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1) ||
        (STATUS_RANK[a.callStatus] ?? 9) - (STATUS_RANK[b.callStatus] ?? 9) ||
        new Date(b.createdAt) - new Date(a.createdAt)
      );
  }, [leads, selPrio, selStatus, selInd]);

  const callable = useMemo(
    () => includePhoneless ? filtered : filtered.filter(l => l.phone),
    [filtered, includePhoneless]
  );

  /* ── Session mechanics ── */

  const leadsById = useMemo(() => {
    const m = new Map();
    for (const l of leads) m.set(l._id, l);
    return m;
  }, [leads]);

  const sessionIds = useMemo(
    () => session && loaded ? session.ids.filter(id => leadsById.has(id)) : (session?.ids || []),
    [session, leadsById, loaded]
  );
  const curIdx = session ? Math.min(session.idx, Math.max(0, sessionIds.length - 1)) : 0;
  const peekLead = peek ? leadsById.get(peek) : null;
  const current = peekLead || (session ? leadsById.get(sessionIds[curIdx]) : null);
  const isPeek = !!peekLead;

  const startSession = (startId) => {
    // Tapping a phoneless lead still opens it — the full filtered list is used
    // whenever the tapped lead isn't in the callable queue.
    let ids = callable.map(l => l._id);
    if (startId && !ids.includes(startId)) ids = filtered.map(l => l._id);
    if (!ids.length) return;
    const idx = startId ? Math.max(0, ids.indexOf(startId)) : 0;
    setDir(1);
    setSession({ ids, idx, stats: { ...EMPTY_STATS }, logged: {}, startedAt: Date.now() });
    setMode('session');
    setSheet(null);
  };

  const endSession = () => {
    setSession(null);
    setSheet(null);
    setMode('queue');
  };

  const advance = useCallback((d = 1) => {
    setSheet(null);
    // From a lookup peek, any navigation returns to wherever you were.
    if (peek) { setPeek(null); return; }
    setDir(d);
    setSession(s => {
      if (!s) return s;
      const ni = s.idx + d;
      if (ni >= s.ids.length) { setMode('summary'); return s; }
      return { ...s, idx: Math.max(0, ni) };
    });
  }, [peek]);

  const logOutcome = useCallback((outcome, { note = '', meeting = '', email = '' } = {}) => {
    const lead = current;
    if (!lead) return;
    const entry = {
      at: new Date().toISOString(),
      outcome,
      note: note.trim(),
      meeting: outcome === 'booked' ? meeting.trim() : '',
      email: outcome === 'booked' ? email.trim() : '',
    };
    const prev = lead;
    const nextLog = [...(lead.callLog || []), entry];
    const set = { callStatus: outcome, callLog: nextLog };
    // Booking moves the lead out of the calling pipeline into the Booked
    // workspace — a stage change, the record itself is untouched.
    if (outcome === 'booked') set.stage = 'booked';
    if (outcome === 'booked' && (entry.meeting || entry.email)) {
      set.afterCall = {
        ...(lead.afterCall || {}),
        meeting: entry.meeting || lead.afterCall?.meeting || '',
        email: entry.email || lead.afterCall?.email || '',
      };
    }
    // Optimistic — the queue keeps moving; a failed save rolls back loudly.
    setLeads(ls => ls.map(l => l._id === lead._id ? { ...l, ...set } : l));
    if (isPeek) {
      // A lookup call isn't part of the session run: no stats bump, but the
      // rail marker updates if the lead happens to be in the session queue.
      setSession(s => s && s.ids.includes(lead._id)
        ? { ...s, logged: { ...s.logged, [lead._id]: outcome } }
        : s);
    } else {
      setSession(s => s ? {
        ...s,
        stats: { ...s.stats, calls: s.stats.calls + 1, [STAT_KEY[outcome]]: (s.stats[STAT_KEY[outcome]] || 0) + 1 },
        logged: { ...s.logged, [lead._id]: outcome },
      } : s);
    }
    setSheet(null);
    setFlash(outcome);
    setTimeout(() => setFlash(null), 400);
    if (outcome === 'no') {
      // A NO removes them from the console and the lead list entirely.
      // The outcome still persists on the tombstone (so a restore brings
      // the call history back); 30-day undo lives in Settings → Recently
      // deleted. PATCH and DELETE touch different fields, so order-safe.
      patch(lead._id, set);
      removeFromLists(lead._id);
      if (isPeek) setPeek(null);
      return;
    }
    patch(lead._id, set, { rollback: () => setLeads(ls => ls.map(l => l._id === lead._id ? prev : l)) });
    onDataChanged?.();
    if (isPeek) setPeek(null);
    else advance(1);
  }, [current, patch, advance, isPeek, onDataChanged, removeFromLists]);

  const runItBack = () => {
    if (!session) return endSession();
    const ids = session.ids.filter(id => session.logged[id] === 'no-answer' && leadsById.has(id));
    if (!ids.length) return endSession();
    setDir(1);
    setSession({ ids, idx: 0, stats: { ...EMPTY_STATS }, logged: {}, startedAt: Date.now() });
    setMode('session');
  };

  /* ── Keyboard (session + queue) ── */

  useEffect(() => {
    const inSessionView = (mode === 'session' && session) || isPeek;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) {
        if (e.key === 'Escape') { e.target.blur(); setSheet(null); }
        return;
      }
      if (lookupOpen) {
        if (e.key === 'Escape') setLookupOpen(false);
        return;
      }
      // "/" opens the reverse lookup from anywhere in the console.
      if (e.key === '/') { e.preventDefault(); setLookupOpen(true); return; }
      if (!inSessionView) return;
      if (showKeys) {
        if (e.key === 'Escape' || e.key === '?') setShowKeys(false);
        return;
      }
      if (sheet) {
        if (e.key === 'Escape') setSheet(null);
        return;
      }
      switch (e.key) {
        case 'ArrowRight': case ' ': e.preventDefault(); advance(1); break;
        case 'ArrowLeft': advance(-1); break;
        case 'Escape': if (isPeek) setPeek(null); break;
        case '1': e.preventDefault(); setSheet({ outcome: 'booked' }); break;
        case '2': e.preventDefault(); setSheet({ outcome: 'callback' }); break;
        case '3': e.preventDefault(); setSheet({ outcome: 'no' }); break;
        case '4': e.preventDefault(); setSheet({ outcome: 'no-answer' }); break;
        case 'n': case 'N': e.preventDefault(); noteRef.current?.focus(); break;
        case '?': setShowKeys(true); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, session, sheet, showKeys, advance, lookupOpen, isPeek]);

  /* ── Swipe (session card) ── */

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const t = touch.current;
    touch.current = null;
    if (!t || sheet || showKeys) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) advance(dx < 0 ? 1 : -1);
  };

  /* ── Render ── */

  const toCall = leads.filter(l => effectiveStage(l) === 'lead' && l.callStatus === 'not-called').length;

  if (authed === null) return <div className="cc-page lay-root"><style>{adminLayoutStyles + ccStyles}</style></div>;

  const elapsed = session ? fmtMins(Date.now() - session.startedAt) : '0m';
  const warned = current && WARN_RX.test(`${current.notes || ''} ${current.phoneNote || ''}`);

  // Session-builder helpers: toggle a value in a Set-typed filter.
  const toggleIn = (setter) => (val) => setter(prev => {
    const next = new Set(prev);
    next.has(val) ? next.delete(val) : next.add(val);
    return next;
  });
  const builderChip = (on, key, label, count, onClick) => (
    <button key={key} type="button" className={`cb-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick}>
      {on && <Check width={14} height={14} />}
      <span>{label}</span>
      {count != null && <em>{count}</em>}
    </button>
  );
  const pool = filtered; // after stage + builder filters
  const poolHot = callable.filter(l => l.priority === 'hot').length;
  const poolNotCalled = callable.filter(l => l.callStatus === 'not-called').length;
  const countBy = (fn) => leads.filter(l => effectiveStage(l) === 'lead').filter(fn).length;

  return (
    <div className={`cc-page lay-root${embedded ? ' cc-page--embedded' : ''}`}>

      {/* ═══ QUEUE ═══ */}
      {mode === 'queue' && !isPeek && (
        <>
          {!embedded && (
            <header className="cc-topbar">
              <div className="cc-topbar-left">
                <Wordmark size={16} />
                <span className="cc-topbar-title">Call Console</span>
                {toCall > 0 && <span className="cc-tocall">{toCall} to call</span>}
              </div>
              <div className="cc-topbar-right">
                <a href={ADMIN_HOME} className="cc-btn"><ArrowLeft width={14} height={14} /> Admin</a>
                <button type="button" className="cc-iconbtn cc-lookupbtn" onClick={() => setLookupOpen(true)} title="Who's calling? ( / )">
                  <PhoneIncoming01 width={15} height={15} />
                </button>
                <button type="button" className="cc-iconbtn" onClick={load} title="Refresh"><RefreshCw01 width={15} height={15} /></button>
              </div>
            </header>
          )}

          <div className="cq-wrap grid-texture">
            <ScrollArea contentClassName="cq-inner">
              {embedded && (
                <div className="cq-embedbar">
                  <span className="cc-topbar-title">Call Console</span>
                  {toCall > 0 && <span className="cc-tocall">{toCall} to call</span>}
                  <span className="cq-embedbar-spacer" />
                  <button type="button" className="cc-iconbtn cc-lookupbtn" onClick={() => setLookupOpen(true)} title="Who's calling? ( / )">
                    <PhoneIncoming01 width={15} height={15} />
                  </button>
                  <button type="button" className="cc-iconbtn" onClick={load} title="Refresh"><RefreshCw01 width={15} height={15} /></button>
                </div>
              )}

              {leads.length === 0 && loaded ? (
                <div className="cc-empty">
                  <p className="cc-empty-title">No leads yet.</p>
                  <button type="button" className="cc-btn cc-btn--primary" onClick={importNotepads} disabled={importing}>
                    <Download01 width={14} height={14} />
                    {importing ? 'Importing…' : `Import ${IMPORT_LEADS.length} notepads`}
                  </button>
                  <p className="cc-empty-note">Add and manage leads on the Leads page — the console is just for dialing.</p>
                </div>
              ) : (
                <>
                  {/* ── Session builder: pick who you're dialing ── */}
                  <div className="cb-intro">
                    <p className="cb-kicker">Build your session</p>
                    <h1 className="cb-title display">Who are we dialing?</h1>
                    <p className="cb-sub">Pick the kind of leads for this block of calls. Nothing selected in a group means &ldquo;all of them.&rdquo;</p>
                  </div>

                  <div className="cb-group">
                    <p className="cb-group-h">Priority</p>
                    <div className="cb-row">
                      {['hot', 'warm', 'cold'].map(p =>
                        builderChip(selPrio.has(p), p, p.toUpperCase(), countBy(l => l.priority === p), () => toggleIn(setSelPrio)(p)))}
                    </div>
                  </div>

                  <div className="cb-group">
                    <p className="cb-group-h">Call status</p>
                    <div className="cb-row">
                      {[['not-called', 'Not called'], ['callback', 'Callbacks'], ['no-answer', 'No answer'], ['no', 'Said no']].map(([id, label]) =>
                        builderChip(selStatus.has(id), id, label, countBy(l => l.callStatus === id), () => toggleIn(setSelStatus)(id)))}
                    </div>
                  </div>

                  {industries.length > 0 && (
                    <div className="cb-group">
                      <p className="cb-group-h">Industry</p>
                      <div className="cb-row">
                        {industries.map(i =>
                          builderChip(selInd.has(i), i, i, countBy(l => l.industry === i), () => toggleIn(setSelInd)(i)))}
                      </div>
                    </div>
                  )}

                  <div className="cb-group">
                    <p className="cb-group-h">Options</p>
                    <div className="cb-row">
                      {builderChip(includePhoneless, 'nophone', 'Include leads without a phone',
                        countBy(l => !l.phone), () => setIncludePhoneless(v => !v))}
                    </div>
                  </div>

                  <div className="cb-preview" role="status">
                    <span className="cb-preview-n">{callable.length}</span>
                    <span className="cb-preview-txt">
                      lead{callable.length === 1 ? '' : 's'} in this queue
                      {callable.length > 0 && ` — ${poolHot} hot · ${poolNotCalled} never called`}
                      {pool.length !== callable.length && !includePhoneless && ` (${pool.length - callable.length} skipped for no phone)`}
                    </span>
                  </div>
                </>
              )}
            </ScrollArea>

            {callable.length > 0 && (
              <StickyFooterBar className="cq-startbar">
                <button type="button" className="cq-start" onClick={() => startSession()}>
                  <Play width={20} height={20} />
                  Start call session
                  <span className="cq-start-n">{callable.length}</span>
                </button>
              </StickyFooterBar>
            )}
          </div>
        </>
      )}

      {/* ═══ SESSION (also renders a lead peeked from the lookup) ═══ */}
      {((mode === 'session' && session) || isPeek) && (
        <div className={`cs-wrap${isPeek ? ' cs-wrap--peek' : ''}`}>
          {/* Desktop rail */}
          {!isPeek && session && (
          <aside className="cs-rail" aria-label="Session queue">
            <div className="cs-rail-head">Queue</div>
            <div className="cs-rail-list">
              {sessionIds.map((id, i) => {
                const l = leadsById.get(id);
                if (!l) return null;
                const logged = session.logged[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className={`cs-rail-row${i === curIdx ? ' is-cur' : ''}${logged ? ' is-done' : ''}`}
                    onClick={() => { setDir(i > curIdx ? 1 : -1); setSession(s => ({ ...s, idx: i })); }}
                    title={l.angle ? l.angle.slice(0, 140) : l.descriptor}
                  >
                    <span className="cs-rail-n">{i + 1}</span>
                    <span className="cs-rail-name">{l.business}</span>
                    {logged && <span className="cs-rail-mark" style={{ '--sc': outcomeOf(logged)?.color }} />}
                  </button>
                );
              })}
            </div>
          </aside>
          )}

          {/* Center */}
          <div className="cs-main">
            <header className="cs-top">
              {isPeek ? (
                <>
                  <button type="button" className="cc-iconbtn" onClick={() => setPeek(null)} title="Back">
                    <ArrowLeft width={16} height={16} />
                  </button>
                  <div className="cs-progress-wrap">
                    <span className="cs-progress-label">Who&rsquo;s calling — looked up</span>
                  </div>
                  <button type="button" className="cc-iconbtn" onClick={() => setLookupOpen(true)} title="Look up another number ( / )">
                    <PhoneIncoming01 width={15} height={15} />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="cc-iconbtn" onClick={() => setMode('summary')} title="End session">
                    <XClose width={16} height={16} />
                  </button>
                  <div className="cs-progress-wrap">
                    <span className="cs-progress-label">{sessionIds.length ? `${curIdx + 1} of ${sessionIds.length}` : '—'}</span>
                    <div className="cs-progress"><span style={{ width: sessionIds.length ? `${((curIdx + 1) / sessionIds.length) * 100}%` : 0 }} /></div>
                  </div>
                  <div className="cs-stats">
                    <span><strong>{session.stats.calls}</strong> calls</span>
                    <span className="cs-stat-booked"><strong>{session.stats.booked}</strong> booked</span>
                    <span><strong>{session.stats.callbacks}</strong> cb</span>
                    <span><strong>{elapsed}</strong></span>
                  </div>
                  <button type="button" className="cc-iconbtn" onClick={() => setLookupOpen(true)} title="Who's calling? ( / )">
                    <PhoneIncoming01 width={15} height={15} />
                  </button>
                  <button type="button" className="cc-iconbtn cs-keysbtn" onClick={() => setShowKeys(true)} title="Keyboard shortcuts">
                    <Keyboard01 width={15} height={15} />
                  </button>
                </>
              )}
            </header>

            <ScrollArea bare className="cs-cardarea" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              {!current && (
                <div className="cc-empty" style={{ margin: 'auto' }}>
                  <p className="cc-empty-note">{loaded ? 'This session has no leads left.' : 'Loading leads…'}</p>
                  {loaded && <button type="button" className="cc-btn" onClick={endSession}>Back to queue</button>}
                </div>
              )}
              {current && (
                <article
                  key={`${current._id}-${curIdx}`}
                  className={`cs-card lay-content ${dir >= 0 ? 'cs-card--fwd' : 'cs-card--back'}${flash ? ` cs-card--flash-${flash}` : ''}`}
                >
                  {warned && (
                    <div className="cs-warn" role="alert">
                      <AlertTriangle width={16} height={16} />
                      <span>Check the notes before dialing.</span>
                    </div>
                  )}

                  <div className="cs-meta">
                    <PriorityPill p={current.priority} />
                    <StatusChip id={current.callStatus} />
                    {current.industry && <span className="cs-industry">{current.industry}</span>}
                    <span className="cs-meta-spacer" />
                    <button type="button" className="cc-btn cs-rejectbtn" onClick={() => setRejectOpen(true)} title="Remove this lead without logging a call">
                      <UserX01 width={14} height={14} /> Reject lead
                    </button>
                    <button type="button" className="cc-iconbtn" onClick={() => setEditOpen(true)} title="Edit lead">
                      <Edit02 width={15} height={15} />
                    </button>
                  </div>

                  <h1 className="cs-biz display">{current.business}</h1>
                  {current.askFor && <p className="cs-askfor">Ask for {current.askFor.replace(/^Ask for /i, '')}</p>}

                  {telOf(current) ? (
                    <a href={telOf(current)} className="cs-phone">
                      <PhoneCall01 width={28} height={28} />
                      <span className="cs-phone-num">{current.phone}</span>
                      <span className="cs-phone-tap">Tap to call</span>
                    </a>
                  ) : (
                    <div className="cs-phone cs-phone--missing">
                      <AlertCircle width={20} height={20} />
                      <span>{current.phoneNote || 'No phone on file — find the number first'}</span>
                    </div>
                  )}

                  {current.angle && <p className="cs-angle">{current.angle}</p>}

                  <div className="cs-facts">
                    {current.area && <span>{current.area}</span>}
                    {current.industry && <span>{current.industry}</span>}
                    {current.bestWindow && <span>{current.bestWindow}</span>}
                    {current.phone && current.phoneNote && <span>{current.phoneNote}</span>}
                  </div>

                  <div className="cs-socials">
                    <SocialButtons socials={current.socials} onAdd={() => setEditOpen(true)} />
                  </div>

                  <div className="cs-folds">
                    {current.angle && (
                      <Collapse title="The angle, in detail">
                        <p className="cs-angle-full">{current.angle}</p>
                      </Collapse>
                    )}
                    <Collapse title="Full script" note="confirm → hook → ask">
                      <ScriptBody lead={current} />
                    </Collapse>
                    <Collapse title="Notes" note={current.notes ? undefined : 'empty'} defaultOpen={warned}>
                      <NotesPanel lead={current} onSaveNotes={saveNotes} noteRef={null} />
                    </Collapse>
                    <Collapse title="Call log" note={(current.callLog || []).length || undefined}>
                      <CallLogList lead={current} />
                    </Collapse>
                  </div>
                </article>
              )}
            </ScrollArea>

            {/* Outcome bar — in flow below the scroll area, never covers it */}
            <StickyFooterBar className="cs-outbar">
              <button type="button" className="cs-navbtn" onClick={() => advance(-1)} disabled={!isPeek && curIdx === 0} aria-label={isPeek ? 'Back' : 'Previous lead'}>
                <ArrowLeft width={18} height={18} />
              </button>
              {OUTCOMES.map(o => (
                <button
                  key={o.id}
                  type="button"
                  className={`cs-out cs-out--${o.id}`}
                  style={{ '--sc': o.color }}
                  onClick={() => setSheet({ outcome: o.id })}
                  disabled={!current}
                >
                  <o.Icon width={19} height={19} />
                  <span>{o.label}</span>
                </button>
              ))}
              <button type="button" className="cs-navbtn cs-navbtn--next" onClick={() => advance(1)} aria-label="Next lead (skip)">
                <SkipForward width={18} height={18} />
              </button>
            </StickyFooterBar>
          </div>

          {/* Desktop right panel */}
          {current && (
            <aside className="cs-side" aria-label="Notes and call log">
              <div className="cs-side-sec">
                <h3 className="cs-side-h">Notes</h3>
                <NotesPanel lead={current} onSaveNotes={saveNotes} noteRef={noteRef} />
              </div>
              <div className="cs-side-sec cs-side-sec--log">
                <h3 className="cs-side-h">Call log</h3>
                <CallLogList lead={current} />
              </div>
            </aside>
          )}

          {flash && <div className="cs-flash" style={{ '--sc': outcomeOf(flash)?.color }} aria-hidden="true" />}

          {sheet && current && (
            <OutcomeSheet
              outcome={sheet.outcome}
              lead={current}
              onLog={logOutcome}
              onCancel={() => setSheet(null)}
            />
          )}
          {showKeys && <ShortcutsOverlay onClose={() => setShowKeys(false)} />}
          {rejectOpen && current && (
            <div className="cc-sheet-back" onClick={() => setRejectOpen(false)}>
              <div className="cc-keys" onClick={e => e.stopPropagation()} role="dialog" aria-label="Reject lead">
                <div className="cc-sheet-head">
                  <span className="cc-sheet-badge" style={{ '--sc': '#ef4444' }}><UserX01 width={15} height={15} /> Reject lead</span>
                  <button type="button" className="cc-iconbtn" onClick={() => setRejectOpen(false)} aria-label="Cancel"><XClose width={16} height={16} /></button>
                </div>
                <p className="cs-reject-body">
                  Remove <strong>{current.business}</strong> from the console and lead list?
                  No call gets logged — this is you passing on them. 30-day restore in Settings.
                </p>
                <div className="cs-reject-actions">
                  <button
                    type="button" className="cc-btn cc-btn--danger"
                    onClick={() => { const id = current._id; setRejectOpen(false); removeFromLists(id); }}
                  >
                    <UserX01 width={14} height={14} /> Reject — no call logged
                  </button>
                  <button type="button" className="cc-btn" onClick={() => setRejectOpen(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {editOpen && current && (
            <div className="cc-overlay lay-overlay" onClick={() => setEditOpen(false)}>
              <div className="cc-panel lay-modal-box" onClick={e => e.stopPropagation()}>
                <EditLead lead={current} onPatch={patchLead} onDelete={deleteLead} onClose={() => setEditOpen(false)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SUMMARY ═══ */}
      {mode === 'summary' && session && !isPeek && (
        <ScrollArea bare className="cs-summary-wrap grid-texture">
          <div className="cs-summary">
            <p className="cs-summary-kicker">Session complete</p>
            <h1 className="cs-summary-title display">
              {session.stats.booked > 0 ? `${session.stats.booked} booked.` : 'Run logged.'}
            </h1>
            <div className="cs-summary-grid">
              <div className="cs-sumstat"><strong>{session.stats.calls}</strong><span>calls made</span></div>
              <div className="cs-sumstat cs-sumstat--booked"><strong>{session.stats.booked}</strong><span>booked</span></div>
              <div className="cs-sumstat"><strong>{session.stats.callbacks}</strong><span>callbacks</span></div>
              <div className="cs-sumstat"><strong>{session.stats.noAnswer}</strong><span>no answer</span></div>
              <div className="cs-sumstat"><strong>{session.stats.no}</strong><span>no</span></div>
              <div className="cs-sumstat"><strong>{fmtMins(Date.now() - session.startedAt)}</strong><span>on the phones</span></div>
            </div>
            <div className="cs-summary-actions">
              {session.stats.noAnswer > 0 && (
                <button type="button" className="cc-btn cc-btn--primary" onClick={runItBack}>
                  <RefreshCw01 width={15} height={15} /> Run it back · {session.stats.noAnswer} no-answer{session.stats.noAnswer === 1 ? '' : 's'}
                </button>
              )}
              <button type="button" className="cc-btn" onClick={() => setMode('session')}>
                <ArrowLeft width={14} height={14} /> Back into the session
              </button>
              <button type="button" className="cc-btn" onClick={endSession}>Back to queue</button>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Shared overlays */}
      {lookupOpen && (
        <LookupSheet
          leads={leads}
          recentIds={recentLookups}
          onPick={(l) => { pushRecentLookup(l._id); setLookupOpen(false); setPeek(l._id); }}
          onAddNew={(qd) => { setLookupOpen(false); setNewOpen({ phone: formatPhone(qd) || qd }); }}
          onClose={() => setLookupOpen(false)}
        />
      )}
      {newOpen && (
        <div className="cc-overlay lay-overlay" onClick={() => setNewOpen(false)}>
          <div className="cc-panel lay-modal-box" onClick={e => e.stopPropagation()}>
            <NewLeadForm
              onCreate={createLead}
              onClose={() => setNewOpen(false)}
              initial={typeof newOpen === 'object' ? newOpen : undefined}
            />
          </div>
        </div>
      )}
      {err && (
        <div className="cc-err" role="alert">
          <AlertTriangle width={16} height={16} />
          <span>{err.msg}</span>
          <button type="button" className="cc-btn cc-btn--errretry" onClick={err.retry}>Retry</button>
          <button type="button" className="cc-iconbtn" onClick={() => setErr(null)} aria-label="Dismiss"><XClose width={14} height={14} /></button>
        </div>
      )}

      <style>{adminLayoutStyles + ccStyles}</style>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────────── */

const ccStyles = `
  .cc-page {
    height: 100vh; height: 100dvh; display: flex; flex-direction: column;
    background: #080808; color: #fafafa;
    font-family: 'Inter', -apple-system, sans-serif;
    letter-spacing: -0.011em;
    overscroll-behavior: none;
    --c-border: rgba(255,255,255,0.09);
    --c-card: #121212;
    --c-card2: #1a1a1a;
    --c-muted: #8a8a8a;
    --c-sec: #cccccc;
    --c-brand: #d44c43;
    padding-top: var(--lay-safe-top);
  }
  /* Embedded inside the admin shell: the shell already carries the top inset */
  .cc-page--embedded { height: 100%; padding-top: 0; }

  /* Inputs + buttons (shared with the new-lead form + importer) */
  .cc-input {
    padding: 10px 12px; border-radius: 10px; width: 100%;
    border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04);
    color: #fafafa; font-size: 16px; font-family: inherit; outline: none;
    transition: border-color 0.18s;
  }
  @media (min-width: 700px) { .cc-input { font-size: 0.875rem; } }
  .cc-input:focus { border-color: var(--c-brand); }
  .cc-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 14px; border-radius: 10px; cursor: pointer;
    border: 1px solid var(--c-border); background: rgba(255,255,255,0.05);
    color: var(--c-sec); font-size: 0.8125rem; font-weight: 600; font-family: inherit;
    text-decoration: none; white-space: nowrap; transition: background 0.15s, color 0.15s;
  }
  .cc-btn:hover { background: rgba(255,255,255,0.1); color: #fafafa; }
  .cc-btn--primary { background: var(--c-brand); border-color: var(--c-brand); color: #fff; }
  .cc-btn--primary:hover { background: #c2413a; color: #fff; }
  .cc-btn--danger { color: #f87171; border-color: rgba(239,68,68,0.35); }
  .cc-btn--danger:hover { background: rgba(239,68,68,0.12); color: #fca5a5; }
  .cc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cc-iconbtn {
    width: 34px; height: 34px; border-radius: 9px; cursor: pointer; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--c-border); background: rgba(255,255,255,0.05);
    color: var(--c-muted); transition: color 0.15s, background 0.15s;
  }
  .cc-iconbtn:hover { color: #fafafa; background: rgba(255,255,255,0.1); }
  .cc-field { display: flex; flex-direction: column; gap: 5px; }
  .cc-field > span {
    font-size: 0.66rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--c-muted);
  }
  .cc-field > span em { font-style: normal; font-weight: 600; opacity: 0.7; text-transform: none; letter-spacing: 0; }
  .cc-field--wide { grid-column: 1 / -1; }

  .cc-prio {
    font-size: 0.6rem; font-weight: 900; letter-spacing: 0.1em;
    padding: 2px 8px; border-radius: 999px; flex-shrink: 0;
  }
  .cc-prio--hot { background: rgba(212,76,67,0.18); color: #e66b63; border: 1px solid rgba(212,76,67,0.4); }
  .cc-prio--warm { background: rgba(245,158,11,0.14); color: #f59e0b; border: 1px solid rgba(245,158,11,0.35); }
  .cc-prio--cold { background: rgba(96,165,250,0.14); color: #60a5fa; border: 1px solid rgba(96,165,250,0.35); }
  .cc-status {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.66rem; font-weight: 700; padding: 2px 9px; border-radius: 999px;
    color: var(--sc); background: color-mix(in srgb, var(--sc) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent); white-space: nowrap;
  }
  .cc-status-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sc); }

  /* Topbar (standalone route) */
  .cc-topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px var(--lay-gutter-r) 12px var(--lay-gutter-l); flex-shrink: 0; flex-wrap: wrap;
    background: rgba(8,8,8,0.97); border-bottom: 1px solid var(--c-border);
  }
  .cc-topbar-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .cc-topbar-title {
    font-size: 0.72rem; font-weight: 800; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--c-muted); white-space: nowrap;
  }
  .cc-tocall {
    font-size: 0.7rem; font-weight: 800; padding: 3px 10px; border-radius: 999px;
    background: var(--c-brand); color: #fff; white-space: nowrap;
  }
  .cc-topbar-right { display: flex; align-items: center; gap: 8px; }

  /* ═══ Queue ═══
     Structure comes from the primitives: the list is a ScrollArea with
     .cq-inner as its centered .lay-content; the start bar is an in-flow
     StickyFooterBar below it — no clearance padding, it cannot cover rows. */
  .cq-wrap { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
  .cq-inner { --lay-stack-gap: 12px; }
  .cq-embedbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; row-gap: 8px; }
  .cq-embedbar-spacer { flex: 1; }
  .cq-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .cc-search-wrap { position: relative; display: flex; align-items: center; color: var(--c-muted); flex: 1; min-width: 200px; }
  .cc-search-wrap > svg { position: absolute; left: 12px; pointer-events: none; }
  .cc-search { padding-left: 34px; }
  .cq-pills { display: flex; flex-wrap: wrap; gap: 7px; }
  .cc-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 13px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--c-border); background: rgba(255,255,255,0.04);
    color: var(--c-muted); font-size: 0.78rem; font-weight: 700; font-family: inherit;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .cc-pill:hover { color: #fafafa; }
  .cc-pill.is-on { color: var(--c-brand); border-color: rgba(212,76,67,0.5); background: rgba(212,76,67,0.1); }
  .cc-pill--select { appearance: none; -webkit-appearance: none; padding-right: 13px; }
  .cc-pill--select option { background: #1a1a1a; color: #fafafa; }
  .cq-filterbtn { display: none; }
  .cq-count { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-muted); }
  .cq-list { display: flex; flex-direction: column; gap: 8px; }
  .cq-card {
    display: flex; align-items: center; gap: 12px; width: 100%;
    padding: 13px 15px; border-radius: 13px; cursor: pointer;
    background: var(--c-card); border: 1px solid var(--c-border);
    text-align: left; font-family: inherit; color: inherit;
    transition: border-color 0.15s, transform 0.15s;
  }
  .cq-card:hover { border-color: rgba(212,76,67,0.45); }
  .cq-card:active { transform: scale(0.995); }
  .cq-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sc); flex-shrink: 0; }
  .cq-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .cq-name { font-size: 1rem; font-weight: 800; letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cq-sub { font-size: 0.74rem; color: var(--c-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cq-side { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .cq-hasphone { color: #22c55e; display: inline-flex; }

  /* ── Session builder ── */
  .cb-intro { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; }
  .cb-kicker { font-size: 0.66rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c-brand); }
  .cb-title {
    font-family: 'Barlow Condensed', 'Inter', sans-serif; text-transform: uppercase;
    font-size: clamp(2rem, 7vw, 3rem); line-height: 0.95; font-weight: 700;
  }
  .cb-sub { font-size: 0.88rem; color: var(--c-muted); line-height: 1.55; max-width: 480px; }
  .cb-group { display: flex; flex-direction: column; gap: 8px; }
  .cb-group-h { font-size: 0.64rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--c-muted); }
  .cb-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .cb-chip {
    display: inline-flex; align-items: center; gap: 8px; min-height: 44px;
    padding: 10px 16px; border-radius: 12px; cursor: pointer;
    background: var(--c-card); border: 1px solid var(--c-border);
    color: var(--c-sec); font-size: 0.85rem; font-weight: 700; font-family: inherit;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    touch-action: manipulation;
  }
  .cb-chip:hover { color: #fafafa; border-color: rgba(255,255,255,0.2); }
  .cb-chip.is-on { color: #fafafa; border-color: rgba(212,76,67,0.6); background: rgba(212,76,67,0.12); }
  .cb-chip.is-on svg { color: var(--c-brand); }
  .cb-chip em {
    font-style: normal; font-size: 0.68rem; font-weight: 800; color: var(--c-muted);
    background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 999px;
  }
  .cb-chip.is-on em { background: rgba(212,76,67,0.2); color: #f0a09a; }
  .cb-preview {
    display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
    padding: 16px 18px; border-radius: 15px;
    background: var(--c-card); border: 1px solid rgba(212,76,67,0.35);
  }
  .cb-preview-n {
    font-family: 'Barlow Condensed', 'Inter', sans-serif;
    font-size: 2.6rem; font-weight: 700; line-height: 1; color: #fafafa;
  }
  .cb-preview-txt { font-size: 0.85rem; font-weight: 600; color: var(--c-sec); min-width: 0; }

  .cq-nophone {
    display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
    font-size: 0.74rem; font-weight: 600; color: var(--c-muted);
  }
  .cq-nophone input { accent-color: var(--c-brand); }
  .cq-start {
    display: inline-flex; align-items: center; justify-content: center; gap: 11px;
    width: 100%; max-width: 460px; padding: 17px 22px; border-radius: 15px; cursor: pointer;
    background: var(--c-brand); border: 1px solid var(--c-brand); color: #fff;
    font-family: inherit; font-size: 1rem; font-weight: 800; letter-spacing: 0.02em;
    text-transform: uppercase;
    box-shadow: 0 8px 32px rgba(212,76,67,0.35);
    transition: background 0.15s, transform 0.15s;
  }
  .cq-start:hover { background: #c2413a; }
  .cq-start:active { transform: scale(0.985); }
  .cq-start-n {
    font-size: 0.8rem; font-weight: 800; padding: 3px 10px; border-radius: 999px;
    background: rgba(0,0,0,0.25);
  }
  .cq-filtersheet { gap: 14px; }
  .cq-sheet-pills { display: flex; flex-wrap: wrap; gap: 8px; }

  /* ═══ Session ═══ */
  .cs-wrap { flex: 1; min-height: 0; min-width: 0; display: grid; grid-template-columns: 1fr; position: relative; }
  .cs-rail, .cs-side { display: none; }
  .cs-main { display: flex; flex-direction: column; min-height: 0; min-width: 0; }

  .cs-top {
    display: flex; align-items: center; gap: 12px; flex-shrink: 0; min-width: 0;
    padding: 10px var(--lay-gutter-r) 10px var(--lay-gutter-l);
    border-bottom: 1px solid var(--c-border);
  }
  .cs-progress-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .cs-progress-label { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-muted); }
  .cs-progress { height: 3px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
  .cs-progress > span { display: block; height: 100%; background: var(--c-brand); border-radius: 999px; transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
  .cs-stats { display: flex; align-items: center; gap: 12px; font-size: 0.72rem; color: var(--c-muted); white-space: nowrap; flex-shrink: 0; }
  @media (max-width: 480px) { .cs-stats { gap: 8px; font-size: 0.66rem; } }
  .cs-stats strong { color: #fafafa; font-weight: 800; }
  .cs-stat-booked strong { color: #22c55e; }
  .cs-keysbtn { display: none; }

  .cs-cardarea {
    display: flex; flex-direction: column;
    -webkit-tap-highlight-color: transparent;
  }
  .cs-card {
    --lay-stack-gap: 14px;
    animation: cs-in-fwd 0.22s cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  .cs-card--back { animation-name: cs-in-back; }
  @keyframes cs-in-fwd { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
  @keyframes cs-in-back { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: none; } }

  /* The scoring flash — a quick colored pulse when an outcome lands */
  .cs-flash {
    position: absolute; inset: 0; z-index: 40; pointer-events: none;
    background: radial-gradient(ellipse at 50% 85%, color-mix(in srgb, var(--sc) 28%, transparent), transparent 65%);
    animation: cs-flash 0.4s ease-out forwards;
  }
  @keyframes cs-flash { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }

  .cs-warn {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 14px; border-radius: 11px;
    background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.45);
    color: #fbbf24; font-size: 0.85rem; font-weight: 700;
  }
  .cs-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .cs-meta-spacer { flex: 1; }
  .cs-industry { font-size: 0.72rem; font-weight: 600; color: var(--c-muted); }
  .cs-biz {
    font-family: 'Barlow Condensed', 'Inter', sans-serif; text-transform: uppercase;
    font-size: clamp(2.4rem, 8vw, 3.8rem); line-height: 0.92; letter-spacing: 0.004em;
    font-weight: 700; color: #fafafa;
  }
  .cs-askfor { font-size: 1rem; font-weight: 600; color: var(--c-sec); }

  .cs-phone {
    display: flex; align-items: center; gap: 16px;
    padding: 20px 22px; border-radius: 16px;
    background: var(--c-brand); border: 1px solid var(--c-brand);
    color: #fff; text-decoration: none;
    box-shadow: 0 10px 40px rgba(212,76,67,0.3);
    transition: background 0.15s, transform 0.15s;
  }
  .cs-phone:hover { background: #c2413a; }
  .cs-phone:active { transform: scale(0.99); }
  .cs-phone svg { flex-shrink: 0; }
  .cs-phone-num {
    font-family: 'Barlow Condensed', 'Inter', sans-serif;
    font-size: clamp(1.6rem, 8vw, 2.9rem); font-weight: 700; letter-spacing: 0.02em;
    line-height: 1; white-space: nowrap;
  }
  .cs-phone-tap { margin-left: auto; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.75; }
  .cs-phone--missing {
    background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.35);
    color: #f5c98b; font-size: 0.9rem; line-height: 1.5; box-shadow: none;
  }
  .cs-phone--missing svg { color: #f59e0b; }

  .cs-angle {
    font-size: 1rem; line-height: 1.55; color: #eaeaea;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    border-left: 3px solid var(--c-brand); padding-left: 13px;
  }
  .cs-facts { display: flex; flex-wrap: wrap; gap: 7px; }
  .cs-facts > span {
    font-size: 0.74rem; font-weight: 600; color: var(--c-sec);
    padding: 5px 11px; border-radius: 999px;
    background: var(--c-card); border: 1px solid var(--c-border);
  }
  .cs-socials { }

  .cs-folds { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
  .cc-fold { border: 1px solid var(--c-border); border-radius: 12px; background: var(--c-card); overflow: hidden; }
  .cc-fold-head {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 12px 15px; cursor: pointer; background: none; border: none;
    font-family: inherit; color: var(--c-sec); text-align: left;
  }
  .cc-fold-title { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .cc-fold-note { font-size: 0.7rem; color: var(--c-muted); }
  .cc-fold-chev { margin-left: auto; transition: transform 0.2s; color: var(--c-muted); flex-shrink: 0; }
  .cc-fold.is-open .cc-fold-chev { transform: rotate(180deg); }
  .cc-fold-body { padding: 2px 15px 16px; }
  .cs-angle-full { font-size: 0.95rem; line-height: 1.65; color: #eaeaea; }

  /* Script body */
  .cc-script { display: flex; flex-direction: column; gap: 16px; }
  .cc-predial { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .cc-predial li {
    font-size: 0.85rem; line-height: 1.5; color: var(--c-sec);
    padding-left: 14px; position: relative;
  }
  .cc-predial li::before {
    content: ''; position: absolute; left: 0; top: 0.6em;
    width: 6px; height: 2px; border-radius: 2px; background: var(--c-muted);
  }
  .cc-steps { list-style: none; display: flex; flex-direction: column; gap: 14px; padding: 0; margin: 0; }
  .cc-step-head { display: flex; align-items: center; gap: 9px; margin-bottom: 6px; }
  .cc-step-num {
    width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(212,76,67,0.15); border: 1px solid rgba(212,76,67,0.4);
    color: #e66b63; font-size: 0.72rem; font-weight: 800;
  }
  .cc-step-title { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-muted); }
  .cc-say {
    font-size: 0.95rem; line-height: 1.6; color: #f2f2f2;
    background: var(--c-card2); border: 1px solid var(--c-border);
    padding: 11px 14px; border-radius: 11px;
  }
  .cc-qa-label { font-size: 0.72rem; font-weight: 700; color: var(--c-muted); margin: 8px 0 5px; }
  .cc-qa { display: flex; flex-direction: column; gap: 6px; }
  .cc-qa-row {
    display: grid; grid-template-columns: minmax(110px, 0.8fr) 1.6fr;
    border: 1px solid var(--c-border); border-radius: 10px; overflow: hidden;
  }
  .cc-qa-say {
    padding: 10px 12px; font-size: 0.8rem; font-weight: 700; color: #f5c98b;
    background: rgba(255,255,255,0.03); border-right: 1px solid var(--c-border);
    display: flex; align-items: center;
  }
  .cc-qa-respond { padding: 10px 13px; font-size: 0.85rem; line-height: 1.55; color: var(--c-sec); background: var(--c-card2); }
  @media (max-width: 560px) {
    .cc-qa-row { grid-template-columns: 1fr; }
    .cc-qa-say { border-right: none; border-bottom: 1px solid var(--c-border); }
  }
  .cc-sub-h { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-muted); margin-bottom: 8px; }
  .cc-sub-h span { font-weight: 600; letter-spacing: 0.03em; text-transform: none; opacity: 0.8; margin-left: 6px; }
  .cc-sub-h--plus { color: #22c55e; }
  .cc-sub-h--minus { color: #f59e0b; }
  .cc-close-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 640px) { .cc-close-grid { grid-template-columns: 1fr; } }
  .cc-close-card {
    background: var(--c-card2); border: 1px solid var(--c-border);
    border-radius: 11px; padding: 12px 14px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .cc-close-card--lock { grid-column: 1 / -1; border-color: rgba(34,197,94,0.35); background: rgba(34,197,94,0.05); }
  .cc-close-card h3 { font-size: 0.66rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-muted); }
  .cc-close-card--lock h3 { color: #22c55e; }
  .cc-close-card p { font-size: 0.85rem; line-height: 1.55; color: var(--c-sec); }
  .cc-intel { display: flex; flex-direction: column; gap: 14px; }
  .cc-dropline {
    margin: 0 0 8px; padding: 11px 14px; border-radius: 11px;
    background: rgba(212,76,67,0.08); border: 1px solid rgba(212,76,67,0.3);
    font-size: 0.9rem; font-weight: 600; line-height: 1.5; color: #f0d9d7;
  }

  /* Notes + log */
  .cc-notespanel { display: flex; flex-direction: column; gap: 8px; }
  .cc-notes-ta { resize: vertical; min-height: 96px; line-height: 1.55; }
  .cc-notes-save { align-self: flex-start; }
  .cc-log { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
  .cc-log-row { display: flex; gap: 10px; }
  .cc-log-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sc); flex-shrink: 0; margin-top: 5px; }
  .cc-log-main { min-width: 0; flex: 1; }
  .cc-log-top { display: flex; align-items: baseline; gap: 8px; }
  .cc-log-outcome { font-size: 0.78rem; font-weight: 800; color: var(--sc); }
  .cc-log-time { font-size: 0.68rem; color: var(--c-muted); }
  .cc-log-note { font-size: 0.8rem; line-height: 1.5; color: var(--c-sec); margin-top: 2px; overflow-wrap: anywhere; }
  .cc-log-note strong { color: #fafafa; }
  .cc-log-empty { font-size: 0.8rem; color: var(--c-muted); }

  /* Outcome bar — a StickyFooterBar; structure/background/safe-area come
     from .lay-footbar, this only lays the buttons out in a row */
  .cs-outbar.lay-footbar { flex-direction: row; align-items: stretch; gap: 8px; }
  .cs-out {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    padding: 10px 6px; border-radius: 13px; cursor: pointer;
    background: var(--c-card); border: 1px solid var(--c-border);
    color: var(--sc); font-family: inherit; font-size: 0.68rem; font-weight: 800;
    letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap;
    transition: background 0.15s, border-color 0.15s, transform 0.12s;
    min-height: 60px;
  }
  .cs-out:hover { border-color: color-mix(in srgb, var(--sc) 55%, transparent); background: color-mix(in srgb, var(--sc) 10%, #121212); }
  .cs-out:active { transform: scale(0.96); }
  .cs-out:disabled { opacity: 0.4; cursor: not-allowed; }
  .cs-out--booked { border-color: rgba(34,197,94,0.4); }
  .cs-navbtn {
    display: flex; align-items: center; justify-content: center;
    width: 52px; border-radius: 13px; cursor: pointer; flex-shrink: 0;
    background: none; border: 1px solid var(--c-border);
    color: var(--c-muted); transition: color 0.15s, background 0.15s;
  }
  .cs-navbtn:hover { color: #fafafa; background: rgba(255,255,255,0.06); }
  .cs-navbtn:disabled { opacity: 0.35; cursor: not-allowed; }
  .cs-navbtn--next { color: var(--c-sec); }

  /* Outcome sheet + overlays */
  .cc-sheet-back {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: cc-fade 0.18s ease;
  }
  @keyframes cc-fade { from { opacity: 0; } to { opacity: 1; } }
  .cc-sheet {
    width: 100%; max-width: 560px;
    max-height: calc(100dvh - max(24px, env(safe-area-inset-top)));
    overflow-y: auto; overscroll-behavior: contain;
    background: #161616; border: 1px solid rgba(255,255,255,0.12); border-bottom: none;
    border-radius: 18px 18px 0 0;
    padding: 16px max(18px, env(safe-area-inset-right)) calc(18px + var(--lay-safe-bottom)) max(18px, env(safe-area-inset-left));
    display: flex; flex-direction: column; gap: 12px;
    animation: cc-rise 0.22s cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  @keyframes cc-rise { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  .cc-sheet-head { display: flex; align-items: center; gap: 10px; }
  .cc-sheet-head .cc-iconbtn { margin-left: auto; }
  .cc-sheet-badge {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 0.78rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sc); padding: 6px 12px; border-radius: 999px;
    background: color-mix(in srgb, var(--sc) 13%, transparent);
    border: 1px solid color-mix(in srgb, var(--sc) 40%, transparent);
    white-space: nowrap;
  }
  .cc-sheet-biz { flex: 1; min-width: 0; font-size: 0.85rem; font-weight: 700; color: var(--c-sec); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cc-sheet-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 520px) { .cc-sheet-grid { grid-template-columns: 1fr; } }
  .cc-sheet-actions { display: flex; align-items: center; gap: 12px; }
  .cc-btn--log {
    background: var(--sc); border-color: var(--sc); color: #08080a;
    font-weight: 800; padding: 12px 22px; font-size: 0.875rem; border-radius: 12px;
  }
  .cc-btn--log:hover { filter: brightness(1.08); color: #08080a; background: var(--sc); }
  .cc-sheet-hint { font-size: 0.7rem; color: var(--c-muted); }
  @media (min-width: 700px) {
    .cc-sheet-back { align-items: center; }
    .cc-sheet { border-radius: 18px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 18px; }
  }

  .cc-keys {
    width: 100%; max-width: 420px; margin: 0 16px;
    max-height: calc(100dvh - 48px); overflow-y: auto;
    background: #161616; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px;
    padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;
    align-self: center;
  }
  /* ── Reverse lookup sheet ── */
  .lk-sheet { gap: 12px; }
  .lk-input {
    font-size: 1.25rem; font-weight: 700; letter-spacing: 0.04em;
    padding: 14px 16px; text-align: center;
  }
  .lk-list { display: flex; flex-direction: column; gap: 6px; max-height: min(46vh, 340px); overflow-y: auto; overscroll-behavior: contain; }
  .lk-row {
    display: flex; align-items: center; gap: 11px;
    padding: 11px 13px; border-radius: 12px; cursor: pointer;
    background: var(--c-card); border: 1px solid var(--c-border);
    font-family: inherit; color: inherit; text-align: left;
    transition: border-color 0.15s;
  }
  .lk-row:hover { border-color: rgba(212,76,67,0.45); }
  .lk-row.is-exact { border-color: rgba(212,76,67,0.55); background: rgba(212,76,67,0.07); }
  .lk-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .lk-row-name { font-size: 0.9rem; font-weight: 700; }
  .lk-row-sub { font-size: 0.72rem; color: var(--c-muted); }
  .lk-empty { display: flex; flex-direction: column; gap: 12px; }
  .lk-hint { font-size: 0.78rem; color: var(--c-muted); line-height: 1.55; }
  .lk-kbd-hint { display: none; }
  .lk-kbd-hint kbd {
    padding: 1px 7px; border-radius: 6px; font-family: inherit; font-size: 0.72rem;
    background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.14); color: #fafafa;
  }
  @media (min-width: 700px) { .lk-kbd-hint { display: inline; } }
  .lk-label { font-size: 0.66rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--c-muted); }
  .lk-nomatch { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .lk-nomatch p { font-size: 0.88rem; color: var(--c-sec); }
  .lk-nomatch strong { color: #fafafa; }

  .cc-keys-grid { display: flex; flex-direction: column; gap: 8px; }
  .cc-keys-row { display: flex; align-items: center; gap: 12px; font-size: 0.82rem; color: var(--c-sec); }
  .cc-keys-row kbd {
    min-width: 84px; text-align: center; padding: 4px 9px; border-radius: 7px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
    font-family: inherit; font-size: 0.72rem; font-weight: 700; color: #fafafa;
  }

  .cc-overlay {
    z-index: 55;
    background: rgba(0,0,0,0.65); backdrop-filter: blur(3px);
    display: flex; align-items: flex-start; justify-content: center;
    overflow-y: auto; animation: cc-fade 0.18s ease;
    padding-top: max(4vh, env(safe-area-inset-top));
  }
  .cc-panel {
    width: 100%; max-width: 640px;
    background: #131313; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px;
    animation: cc-rise 0.22s cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  .cc-new { padding: clamp(16px, 3vw, 26px); display: flex; flex-direction: column; gap: 16px; }
  .cc-new-head { display: flex; align-items: center; justify-content: space-between; }
  .cc-new-title { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.02em; }
  .cc-new-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .cc-new-grid { grid-template-columns: 1fr; } }
  .cc-new-note { font-size: 0.78rem; color: var(--c-muted); }
  .cc-new .cc-btn[type="submit"] { align-self: flex-start; }
  .cc-edit-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .cc-del-blocked { font-size: 0.74rem; font-weight: 700; color: var(--c-muted); }
  .cs-rejectbtn { color: #f87171; border-color: rgba(239,68,68,0.35); }
  .cs-rejectbtn:hover { background: rgba(239,68,68,0.12); color: #fca5a5; }
  .cs-reject-body { font-size: 0.9rem; line-height: 1.6; color: var(--c-sec); overflow-wrap: anywhere; }
  .cs-reject-body strong { color: #fafafa; }
  .cs-reject-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  /* Error toast — a failed save is never silent */
  .cc-err {
    position: fixed; top: max(14px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 90;
    display: flex; align-items: center; gap: 10px;
    max-width: min(94vw, 520px);
    padding: 11px 14px; border-radius: 13px;
    background: #2a1212; border: 1px solid rgba(239,68,68,0.6);
    color: #fecaca; font-size: 0.85rem; font-weight: 700;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    animation: cc-rise 0.2s ease;
  }
  .cc-btn--errretry { border-color: rgba(239,68,68,0.5); color: #fecaca; }
  .cc-btn--errretry:hover { background: rgba(239,68,68,0.15); color: #fff; }

  /* ═══ Summary ═══
     margin:auto (not flex centering) so a card taller than the viewport
     scrolls from the top instead of clipping. */
  .cs-summary-wrap { display: flex; }
  .cs-summary {
    margin: auto;
    width: 100%; max-width: 520px;
    background: var(--c-card); border: 1px solid var(--c-border); border-radius: 20px;
    padding: clamp(22px, 4vw, 34px);
    display: flex; flex-direction: column; gap: 18px;
    animation: cc-rise 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  .cs-summary-kicker { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c-muted); }
  .cs-summary-title {
    font-family: 'Barlow Condensed', 'Inter', sans-serif; text-transform: uppercase;
    font-size: clamp(2.4rem, 8vw, 3.4rem); line-height: 0.95; font-weight: 700;
  }
  .cs-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 440px) { .cs-summary-grid { grid-template-columns: 1fr 1fr; } }
  .cs-sumstat {
    display: flex; flex-direction: column; gap: 3px;
    padding: 12px 14px; border-radius: 12px;
    background: var(--c-card2); border: 1px solid var(--c-border);
  }
  .cs-sumstat strong { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  .cs-sumstat span { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-muted); }
  .cs-sumstat--booked { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.07); }
  .cs-sumstat--booked strong { color: #22c55e; }
  .cs-summary-actions { display: flex; flex-wrap: wrap; gap: 8px; }

  /* Empty */
  .cc-empty { padding: 32px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
  .cc-empty-title { font-weight: 700; }
  .cc-empty-note { font-size: 0.8rem; color: var(--c-muted); }

  /* Notes panel folds on mobile hide desktop ref duplication */
  .cs-side-sec { display: flex; flex-direction: column; gap: 10px; }
  .cs-side-h { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-muted); }

  /* ── Mobile filter sheet trigger ── */
  @media (max-width: 700px) {
    .cq-pills { display: none; }
    .cq-filterbtn { display: inline-flex; }
    .cq-sheet-pills .cc-pill { padding: 10px 16px; font-size: 0.85rem; }
  }

  /* ── Small phones: tighter phone hero + outcome bar ── */
  @media (max-width: 480px) {
    .cs-phone { gap: 12px; padding: 18px 16px; }
    .cs-phone-tap { display: none; }
    .cs-out { font-size: 0.6rem; letter-spacing: 0.03em; padding: 10px 3px; }
    .cs-navbtn { width: 44px; }
  }

  /* ── Desktop three-zone session (≥1000px) ── */
  @media (min-width: 1000px) {
    .cs-wrap { grid-template-columns: 248px minmax(0, 1fr) 320px; }
    /* Peeked lookup lead: no session rail, just card + notes/log panel */
    .cs-wrap--peek { grid-template-columns: minmax(0, 1fr) 320px; }
    .cs-rail {
      display: flex; flex-direction: column; min-height: 0;
      border-right: 1px solid var(--c-border);
    }
    .cs-rail-head {
      padding: 14px 16px 10px; flex-shrink: 0;
      font-size: 0.68rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-muted);
    }
    .cs-rail-list { flex: 1; overflow-y: auto; padding: 0 8px 12px; display: flex; flex-direction: column; gap: 2px; }
    .cs-rail-row {
      display: flex; align-items: center; gap: 9px; width: 100%;
      padding: 8px 10px; border-radius: 9px; cursor: pointer;
      background: none; border: none; font-family: inherit; color: var(--c-sec);
      text-align: left; transition: background 0.13s, color 0.13s;
    }
    .cs-rail-row:hover { background: rgba(255,255,255,0.05); color: #fafafa; }
    .cs-rail-row.is-cur { background: rgba(212,76,67,0.12); color: #fafafa; }
    .cs-rail-row.is-done:not(.is-cur) { opacity: 0.55; }
    .cs-rail-n { font-size: 0.66rem; font-weight: 800; color: var(--c-muted); min-width: 18px; text-align: right; flex-shrink: 0; }
    .cs-rail-row.is-cur .cs-rail-n { color: var(--c-brand); }
    .cs-rail-name { flex: 1; min-width: 0; font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cs-rail-mark { width: 7px; height: 7px; border-radius: 50%; background: var(--sc); flex-shrink: 0; }
    .cs-side {
      display: flex; flex-direction: column; gap: 20px; min-height: 0;
      border-left: 1px solid var(--c-border);
      padding: 16px; overflow-y: auto;
    }
    .cs-keysbtn { display: inline-flex; }
    /* Desktop already shows notes + log in the right panel — hide the folds' duplicates */
    .cs-folds .cc-fold:nth-last-child(-n+2) { display: none; }
    .cs-outbar { justify-content: center; }
    .cs-out { flex: 0 1 170px; flex-direction: row; gap: 9px; font-size: 0.78rem; min-height: 54px; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .cc-page *, .cc-page { animation: none !important; transition: none !important; }
  }
`;
