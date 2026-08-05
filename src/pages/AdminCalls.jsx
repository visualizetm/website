import { useState, useEffect, useCallback, useMemo } from 'react';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import AlertCircle from '@untitled-ui/icons-react/build/esm/AlertCircle';
import Save01 from '@untitled-ui/icons-react/build/esm/Save01';
import Wordmark from '../components/Wordmark';
import IMPORT_LEADS from '../data/call-leads-import.json';
import { ADMIN_HOME } from '../lib/adminPaths';

const CALL_STATUSES = [
  { id: 'not-called', label: 'Not called', color: '#8a8a8a' },
  { id: 'callback',   label: 'Callback',   color: '#60a5fa' },
  { id: 'booked',     label: 'Booked',     color: '#22c55e' },
  { id: 'no',         label: 'No',         color: '#ef4444' },
  { id: 'no-answer',  label: 'No answer',  color: '#f59e0b' },
];
const statusOf = (id) => CALL_STATUSES.find(s => s.id === id) || CALL_STATUSES[0];

// Standard script skeleton for manually added leads — same bones as the
// notepad docs, personalized from the business fields.
function defaultLead(f) {
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
  };
}

function PriorityPill({ p }) {
  return <span className={`cc-prio cc-prio--${p}`}>{p === 'hot' ? 'HOT' : 'WARM'}</span>;
}

function StatusChip({ id }) {
  const s = statusOf(id);
  return (
    <span className="cc-status" style={{ '--sc': s.color }}>
      <span className="cc-status-dot" />{s.label}
    </span>
  );
}

/* ── New lead form ─────────────────────────────────────────────── */

function NewLeadForm({ onCreate, onClose }) {
  const [f, setF] = useState({
    business: '', industry: '', descriptor: '', phone: '', phoneNote: '',
    askFor: '', bestWindow: 'Before 8am or after 5pm.', priority: 'warm', angle: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

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
          </select>
        </label>
        <label className="cc-field cc-field--wide">
          <span>The angle (why this lead, in one paragraph)</span>
          <textarea className="cc-input" rows={3} value={f.angle} onChange={set('angle')} placeholder="What you noticed, and the gap you'd pitch." />
        </label>
      </div>
      <p className="cc-new-note">A standard call script is generated automatically — the angle and details personalize it.</p>
      <button type="submit" className="cc-btn cc-btn--primary" disabled={busy || !f.business.trim()}>
        {busy ? 'Saving…' : 'Add lead'}
      </button>
    </form>
  );
}

/* ── The Call Notepad ──────────────────────────────────────────── */

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

function Notepad({ lead, onPatch, onDelete, onBack }) {
  const [checks, setChecks] = useState({});
  const [after, setAfter] = useState(lead.afterCall || {});
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    setChecks({});
    setAfter(lead.afterCall || { meeting: '', email: '', whatTheySaid: '', nextAction: '' });
    setEditing(false);
    setSaved(false);
  }, [lead._id]);

  const setA = (k) => (e) => setAfter(p => ({ ...p, [k]: e.target.value }));
  const saveAfter = async () => {
    await onPatch(lead._id, { afterCall: after });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const startEdit = () => {
    setDraft({
      business: lead.business, industry: lead.industry, descriptor: lead.descriptor,
      phone: lead.phone, phoneNote: lead.phoneNote, askFor: lead.askFor,
      bestWindow: lead.bestWindow, angle: lead.angle,
    });
    setEditing(true);
  };
  const setD = (k) => (e) => setDraft(p => ({ ...p, [k]: e.target.value }));
  const saveEdit = async () => {
    await onPatch(lead._id, draft);
    setEditing(false);
  };

  const s = lead.script || {};
  const telHref = lead.phone ? `tel:${lead.phone.replace(/[^0-9+]/g, '')}` : null;

  const steps = [
    { n: '1', t: 'CONFIRM', body: s.confirm },
    { n: '2', t: 'INTRO + BUY TIME', body: s.intro },
    { n: '3', t: 'HOMEWORK LINE', body: s.homework },
    { n: '4', t: 'THE QUESTION (then stop talking)', body: s.question, qa: s.likelyAnswers, qaLabel: 'Their likely answers' },
    { n: '5', t: 'THE HOOK', body: s.hook },
    { n: '6', t: 'THE ASK (two options, always)', body: s.ask },
  ];

  return (
    <article className="cc-notepad">
      <button type="button" className="cc-back" onClick={onBack}>
        <ArrowLeft width={15} height={15} /> All leads
      </button>

      {/* 1 · Header block */}
      <header className="cc-head">
        <div className="cc-head-toprow">
          <div className="cc-head-meta">
            <PriorityPill p={lead.priority} />
            <StatusChip id={lead.callStatus} />
            {lead.industry && <span className="cc-industry">{lead.industry}</span>}
          </div>
          <div className="cc-head-actions">
            {!editing && (
              <button type="button" className="cc-iconbtn" onClick={startEdit} title="Edit lead">
                <Edit02 width={15} height={15} />
              </button>
            )}
            <button
              type="button"
              className="cc-iconbtn cc-iconbtn--danger"
              title="Delete lead"
              onClick={() => { if (window.confirm(`Delete ${lead.business}? This can't be undone.`)) onDelete(lead._id); }}
            >
              <Trash01 width={15} height={15} />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="cc-edit">
            {[['business', 'Business'], ['descriptor', 'Descriptor'], ['industry', 'Industry'],
              ['phone', 'Phone'], ['phoneNote', 'Phone note'], ['askFor', 'Ask for'], ['bestWindow', 'Best window']]
              .map(([k, label]) => (
              <label key={k} className="cc-field">
                <span>{label}</span>
                <input className="cc-input" value={draft[k] || ''} onChange={setD(k)} />
              </label>
            ))}
            <label className="cc-field cc-field--wide">
              <span>The angle</span>
              <textarea className="cc-input" rows={3} value={draft.angle || ''} onChange={setD('angle')} />
            </label>
            <div className="cc-edit-actions">
              <button type="button" className="cc-btn cc-btn--primary" onClick={saveEdit}>Save</button>
              <button type="button" className="cc-btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="cc-biz display">{lead.business}</h1>
            {lead.descriptor && <p className="cc-descriptor">{lead.descriptor}</p>}

            {telHref ? (
              <a href={telHref} className="cc-phone">
                <PhoneCall01 width={26} height={26} />
                <span className="cc-phone-num">{lead.phone}</span>
                <span className="cc-phone-tap">tap to call</span>
              </a>
            ) : (
              <div className="cc-phone cc-phone--missing">
                <AlertCircle width={20} height={20} />
                <span>{lead.phoneNote || 'No phone on file — verify before calling'}</span>
              </div>
            )}

            <div className="cc-head-facts">
              {lead.askFor && <p><strong>Ask for:</strong> {lead.askFor.replace(/^Ask for /i, '')}</p>}
              {lead.bestWindow && <p><strong>Best window:</strong> {lead.bestWindow}</p>}
              {lead.phone && lead.phoneNote && <p><strong>Note:</strong> {lead.phoneNote}</p>}
            </div>
          </>
        )}
      </header>

      {/* 2 · The angle */}
      {lead.angle && (
        <section className="cc-sec cc-angle">
          <h2 className="cc-sec-title">The Angle</h2>
          <p className="cc-angle-text">{lead.angle}</p>
        </section>
      )}

      {/* 3 · Before you dial */}
      {lead.beforeYouDial?.length > 0 && (
        <section className="cc-sec">
          <h2 className="cc-sec-title">Before You Dial <span className="cc-sec-note">30 seconds</span></h2>
          <ul className="cc-checklist">
            {lead.beforeYouDial.map((item, i) => (
              <li key={i}>
                <label className={`cc-checkitem${checks[i] ? ' is-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!checks[i]}
                    onChange={() => setChecks(p => ({ ...p, [i]: !p[i] }))}
                  />
                  <span className="cc-checkbox">{checks[i] && <Check width={11} height={11} />}</span>
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4 · The call */}
      <section className="cc-sec">
        <h2 className="cc-sec-title">The Call</h2>
        <ol className="cc-steps">
          {steps.filter(st => st.body).map(st => (
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
      </section>

      {/* 5 · Objections */}
      {lead.objections?.length > 0 && (
        <section className="cc-sec">
          <h2 className="cc-sec-title">Objections <span className="cc-sec-note">after every one, return to the ask</span></h2>
          <QaTable rows={lead.objections} />
        </section>
      )}

      {/* 6 · The close */}
      {(lead.close?.lockIt || lead.close?.ifNo || lead.close?.noAnswer) && (
        <section className="cc-sec">
          <h2 className="cc-sec-title">The Close</h2>
          <div className="cc-close-grid">
            {lead.close.lockIt && (
              <div className="cc-close-card cc-close-card--lock">
                <h3>Lock it</h3><p>{lead.close.lockIt}</p>
              </div>
            )}
            {lead.close.ifNo && (
              <div className="cc-close-card">
                <h3>If it&rsquo;s a no</h3><p>{lead.close.ifNo}</p>
              </div>
            )}
            {lead.close.noAnswer && (
              <div className="cc-close-card">
                <h3>No answer</h3><p>{lead.close.noAnswer}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 7 · After the call */}
      <section className="cc-sec cc-after">
        <h2 className="cc-sec-title">After The Call</h2>
        <div className="cc-result-row">
          <span className="cc-result-label">Result</span>
          <div className="cc-result-opts">
            {CALL_STATUSES.map(st => (
              <button
                key={st.id}
                type="button"
                className={`cc-result-opt${lead.callStatus === st.id ? ' is-on' : ''}`}
                style={{ '--sc': st.color }}
                onClick={() => onPatch(lead._id, { callStatus: st.id })}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
        <div className="cc-after-grid">
          <label className="cc-field">
            <span>Meeting day + time</span>
            <input className="cc-input" value={after.meeting || ''} onChange={setA('meeting')} placeholder="Thursday 7am" />
          </label>
          <label className="cc-field">
            <span>Their email</span>
            <input className="cc-input" value={after.email || ''} onChange={setA('email')} placeholder="owner@business.com" />
          </label>
          <label className="cc-field cc-field--wide">
            <span>What they said</span>
            <textarea className="cc-input" rows={3} value={after.whatTheySaid || ''} onChange={setA('whatTheySaid')} placeholder="Notes from the call…" />
          </label>
          <label className="cc-field cc-field--wide">
            <span>Next action</span>
            <input className="cc-input" value={after.nextAction || ''} onChange={setA('nextAction')} placeholder="Send invite / follow up in 30 days / …" />
          </label>
        </div>
        <button type="button" className="cc-btn cc-btn--primary" onClick={saveAfter}>
          {saved ? <><Check width={14} height={14} /> Saved</> : <><Save01 width={14} height={14} /> Save call notes</>}
        </button>
      </section>

      {/* 8 · Brand intel */}
      {(lead.intel?.accomplishments?.length > 0 || lead.intel?.gaps?.length > 0 || lead.intel?.dropLines?.length > 0) && (
        <section className="cc-sec">
          <h2 className="cc-sec-title">Brand Intel <span className="cc-sec-note">what you can see from the outside</span></h2>
          <div className="cc-intel-grid">
            {lead.intel.accomplishments?.length > 0 && (
              <div className="cc-intel-col">
                <h3 className="cc-intel-h cc-intel-h--plus">Accomplishments</h3>
                <ul>{lead.intel.accomplishments.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
            {lead.intel.gaps?.length > 0 && (
              <div className="cc-intel-col">
                <h3 className="cc-intel-h cc-intel-h--minus">Visible struggles / gaps</h3>
                <ul>{lead.intel.gaps.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
          </div>
          {lead.intel.dropLines?.length > 0 && (
            <div className="cc-droplines">
              <h3 className="cc-intel-h">Drop these on the call</h3>
              {lead.intel.dropLines.map((x, i) => (
                <blockquote key={i} className="cc-dropline">&ldquo;{x}&rdquo;</blockquote>
              ))}
            </div>
          )}
        </section>
      )}
    </article>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */

export default function AdminCalls({ embedded = false }) {
  const [authed, setAuthed] = useState(null);
  const [leads, setLeads] = useState([]);
  const [selId, setSelId] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [industry, setIndustry] = useState('all');
  const [priority, setPriority] = useState('all');
  const [hasPhone, setHasPhone] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [importing, setImporting] = useState(false);

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
    } catch { /* keep last */ }
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  const patch = async (id, set) => {
    await fetch('/api/admin/call-leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, set }),
    });
    setLeads(prev => prev.map(l => l._id === id ? { ...l, ...set } : l));
  };

  const createLead = async (lead) => {
    const res = await fetch('/api/admin/call-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    if (res.ok) { setNewOpen(false); await load(); }
  };

  const deleteLead = async (id) => {
    await fetch(`/api/admin/call-leads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setSelId(null);
    setLeads(prev => prev.filter(l => l._id !== id));
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
    } finally { setImporting(false); }
  };

  const industries = useMemo(
    () => [...new Set(leads.map(l => l.industry).filter(Boolean))].sort(),
    [leads]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const order = { 'not-called': 0, 'callback': 1, 'no-answer': 2, 'booked': 3, 'no': 4 };
    return leads
      .filter(l =>
        (!needle || `${l.business} ${l.industry} ${l.descriptor}`.toLowerCase().includes(needle)) &&
        (status === 'all' || l.callStatus === status) &&
        (industry === 'all' || l.industry === industry) &&
        (priority === 'all' || l.priority === priority) &&
        (!hasPhone || !!l.phone)
      )
      .sort((a, b) =>
        (a.priority === 'hot' ? 0 : 1) - (b.priority === 'hot' ? 0 : 1) ||
        (order[a.callStatus] ?? 9) - (order[b.callStatus] ?? 9) ||
        new Date(b.createdAt) - new Date(a.createdAt)
      );
  }, [leads, q, status, industry, priority, hasPhone]);

  const sel = leads.find(l => l._id === selId) || null;
  const toCall = leads.filter(l => l.callStatus === 'not-called').length;

  if (authed === null) return <div className="cc-page"><style>{ccStyles}</style></div>;

  return (
    <div className={`cc-page${sel || newOpen ? ' has-pad' : ''}${embedded ? ' cc-page--embedded' : ''}`}>
      {!embedded && (
      <header className="cc-topbar">
        <div className="cc-topbar-left">
          <Wordmark size={16} />
          <span className="cc-topbar-title">Call Console</span>
          {toCall > 0 && <span className="cc-tocall">{toCall} to call</span>}
        </div>
        <div className="cc-topbar-right">
          <a href={ADMIN_HOME} className="cc-btn"><ArrowLeft width={14} height={14} /> Admin</a>
          <button type="button" className="cc-btn" onClick={load} title="Refresh"><RefreshCw01 width={14} height={14} /></button>
          <button type="button" className="cc-btn cc-btn--primary" onClick={() => { setNewOpen(true); setSelId(null); }}>
            <Plus width={14} height={14} /> New lead
          </button>
        </div>
      </header>
      )}

      <div className="cc-body">
        {/* LEFT — lead list */}
        <aside className="cc-list" aria-label="Lead list">
          <div className="cc-filters">
            {embedded && (
              <div className="cc-embedbar">
                <span className="cc-topbar-title">Call Console</span>
                {toCall > 0 && <span className="cc-tocall">{toCall} to call</span>}
                <span className="cc-embedbar-spacer" />
                <button type="button" className="cc-iconbtn" onClick={load} title="Refresh"><RefreshCw01 width={14} height={14} /></button>
                <button type="button" className="cc-btn cc-btn--primary" onClick={() => { setNewOpen(true); setSelId(null); }}>
                  <Plus width={14} height={14} /> New
                </button>
              </div>
            )}
            <div className="cc-search-wrap">
              <SearchMd width={14} height={14} />
              <input className="cc-input cc-search" placeholder="Search leads…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="cc-filter-row">
              <select className="cc-input cc-select" value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by call status">
                <option value="all">All statuses</option>
                {CALL_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select className="cc-input cc-select" value={industry} onChange={e => setIndustry(e.target.value)} aria-label="Filter by industry">
                <option value="all">All industries</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="cc-filter-row">
              <select className="cc-input cc-select" value={priority} onChange={e => setPriority(e.target.value)} aria-label="Filter by priority">
                <option value="all">All priorities</option>
                <option value="hot">HOT</option>
                <option value="warm">WARM</option>
              </select>
              <button
                type="button"
                className={`cc-toggle${hasPhone ? ' is-on' : ''}`}
                onClick={() => setHasPhone(v => !v)}
                aria-pressed={hasPhone}
              >
                <Phone width={13} height={13} /> Has phone
              </button>
            </div>
          </div>

          <div className="cc-rows">
            {leads.length === 0 && (
              <div className="cc-empty">
                <p className="cc-empty-title">No leads yet.</p>
                <button type="button" className="cc-btn cc-btn--primary" onClick={importNotepads} disabled={importing}>
                  <Download01 width={14} height={14} />
                  {importing ? 'Importing…' : `Import ${IMPORT_LEADS.length} notepads`}
                </button>
                <p className="cc-empty-note">Loads the cold-call notepads from your Drive docs.</p>
              </div>
            )}
            {leads.length > 0 && filtered.length === 0 && (
              <p className="cc-empty-note" style={{ padding: '18px 16px' }}>No leads match the filters.</p>
            )}
            {filtered.map(l => (
              <button
                key={l._id}
                type="button"
                className={`cc-row${selId === l._id ? ' is-sel' : ''}`}
                onClick={() => { setSelId(l._id); setNewOpen(false); }}
              >
                <div className="cc-row-main">
                  <span className="cc-row-name">{l.business}</span>
                  <span className="cc-row-sub">{l.industry || l.descriptor}</span>
                </div>
                <div className="cc-row-side">
                  <span className="cc-row-pills">
                    <PriorityPill p={l.priority} />
                    {l.phone && <span className="cc-hasphone" title="Phone on file"><Phone width={12} height={12} /></span>}
                  </span>
                  <StatusChip id={l.callStatus} />
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* RIGHT — notepad / new-lead / empty */}
        <main className="cc-pad">
          {newOpen ? (
            <NewLeadForm onCreate={createLead} onClose={() => setNewOpen(false)} />
          ) : sel ? (
            <Notepad lead={sel} onPatch={patch} onDelete={deleteLead} onBack={() => setSelId(null)} />
          ) : (
            <div className="cc-pad-empty">
              <PhoneCall01 width={36} height={36} />
              <p>Pick a lead to open its call notepad.</p>
            </div>
          )}
        </main>
      </div>
      <style>{ccStyles}</style>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────────── */

const ccStyles = `
  .cc-page--embedded { height: 100%; }
  .cc-embedbar { display: flex; align-items: center; gap: 8px; }
  .cc-embedbar-spacer { flex: 1; }
  .cc-page {
    height: 100vh; height: 100dvh; display: flex; flex-direction: column;
    background: #0a0a0a; color: #fafafa;
    font-family: 'Inter', -apple-system, sans-serif;
    --c-border: rgba(255,255,255,0.09);
    --c-card: #121212;
    --c-muted: #8a8a8a;
    --c-sec: #cccccc;
    --c-brand: #d44c43;
  }

  /* Inputs + buttons */
  .cc-input {
    padding: 9px 12px; border-radius: 9px; width: 100%;
    border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04);
    color: #fafafa; font-size: 0.875rem; font-family: inherit; outline: none;
    transition: border-color 0.2s;
  }
  .cc-input:focus { border-color: var(--c-brand); }
  .cc-select { cursor: pointer; }
  .cc-select option { background: #1a1a1a; }
  .cc-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 13px; border-radius: 9px; cursor: pointer;
    border: 1px solid var(--c-border); background: rgba(255,255,255,0.05);
    color: var(--c-sec); font-size: 0.8125rem; font-weight: 600; font-family: inherit;
    text-decoration: none; white-space: nowrap; transition: background 0.15s, color 0.15s;
  }
  .cc-btn:hover { background: rgba(255,255,255,0.1); color: #fafafa; }
  .cc-btn--primary { background: var(--c-brand); border-color: var(--c-brand); color: #fff; }
  .cc-btn--primary:hover { background: #c2413a; color: #fff; }
  .cc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cc-iconbtn {
    width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--c-border); background: rgba(255,255,255,0.05);
    color: var(--c-muted); transition: color 0.15s, background 0.15s;
  }
  .cc-iconbtn:hover { color: #fafafa; background: rgba(255,255,255,0.1); }
  .cc-iconbtn--danger:hover { color: #f87171; background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); }

  .cc-field { display: flex; flex-direction: column; gap: 5px; }
  .cc-field > span {
    font-size: 0.66rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--c-muted);
  }
  .cc-field--wide { grid-column: 1 / -1; }

  /* Topbar */
  .cc-topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px clamp(14px, 3vw, 24px); flex-shrink: 0;
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

  /* Two panes */
  .cc-body { flex: 1; display: flex; min-height: 0; }
  .cc-list {
    width: 348px; flex-shrink: 0; display: flex; flex-direction: column;
    border-right: 1px solid var(--c-border); min-height: 0;
  }
  .cc-filters {
    padding: 12px; display: flex; flex-direction: column; gap: 8px;
    border-bottom: 1px solid var(--c-border); flex-shrink: 0;
  }
  .cc-search-wrap { position: relative; display: flex; align-items: center; color: var(--c-muted); }
  .cc-search-wrap > svg { position: absolute; left: 11px; pointer-events: none; }
  .cc-search { padding-left: 32px; }
  .cc-filter-row { display: flex; gap: 8px; }
  .cc-filter-row > * { flex: 1; min-width: 0; }
  .cc-toggle {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 8px 10px; border-radius: 9px; cursor: pointer;
    border: 1px solid var(--c-border); background: rgba(255,255,255,0.04);
    color: var(--c-muted); font-size: 0.78rem; font-weight: 700; font-family: inherit;
    transition: all 0.15s;
  }
  .cc-toggle.is-on { color: var(--c-brand); border-color: rgba(212,76,67,0.5); background: rgba(212,76,67,0.1); }

  .cc-rows { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .cc-row {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 11px 12px; border-radius: 11px; cursor: pointer; width: 100%;
    background: var(--c-card); border: 1px solid var(--c-border);
    text-align: left; font-family: inherit; transition: border-color 0.15s;
  }
  .cc-row:hover { border-color: rgba(212,76,67,0.45); }
  .cc-row.is-sel { border-color: var(--c-brand); background: rgba(212,76,67,0.07); }
  .cc-row-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .cc-row-name { font-size: 0.875rem; font-weight: 700; color: #fafafa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cc-row-sub { font-size: 0.72rem; color: var(--c-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cc-row-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .cc-row-pills { display: inline-flex; align-items: center; gap: 6px; }
  .cc-hasphone { color: #22c55e; display: inline-flex; }

  .cc-prio {
    font-size: 0.6rem; font-weight: 900; letter-spacing: 0.1em;
    padding: 2px 7px; border-radius: 999px;
  }
  .cc-prio--hot { background: rgba(212,76,67,0.18); color: #e66b63; border: 1px solid rgba(212,76,67,0.4); }
  .cc-prio--warm { background: rgba(245,158,11,0.14); color: #f59e0b; border: 1px solid rgba(245,158,11,0.35); }

  .cc-status {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.66rem; font-weight: 700; padding: 2px 8px; border-radius: 999px;
    color: var(--sc); background: color-mix(in srgb, var(--sc) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent); white-space: nowrap;
  }
  .cc-status-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sc); }

  .cc-empty { padding: 32px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
  .cc-empty-title { font-weight: 700; }
  .cc-empty-note { font-size: 0.8rem; color: var(--c-muted); }

  /* Notepad pane */
  .cc-pad { flex: 1; overflow-y: auto; min-width: 0; }
  .cc-pad-empty {
    height: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 12px; color: var(--c-muted); font-size: 0.9rem;
  }
  .cc-notepad { max-width: 780px; margin: 0 auto; padding: clamp(16px, 3vw, 32px); display: flex; flex-direction: column; gap: 26px; }
  .cc-back {
    display: none; align-items: center; gap: 7px; align-self: flex-start;
    background: none; border: none; color: var(--c-muted); cursor: pointer;
    font-size: 0.85rem; font-weight: 600; font-family: inherit; padding: 0;
  }

  /* Header block */
  .cc-head { display: flex; flex-direction: column; gap: 12px; }
  .cc-head-toprow { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .cc-head-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .cc-head-actions { display: flex; gap: 6px; }
  .cc-industry { font-size: 0.72rem; font-weight: 600; color: var(--c-muted); }
  .cc-biz {
    font-family: 'Barlow Condensed', 'Inter', sans-serif; text-transform: uppercase;
    font-size: clamp(2rem, 6vw, 3.2rem); line-height: 0.95; letter-spacing: 0.005em;
    font-weight: 700; color: #fafafa;
  }
  .cc-descriptor { font-size: 0.9rem; color: var(--c-sec); line-height: 1.55; }
  .cc-phone {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 20px; border-radius: 14px;
    background: rgba(212,76,67,0.1); border: 1px solid rgba(212,76,67,0.4);
    color: #fff; text-decoration: none; transition: background 0.15s;
  }
  .cc-phone:hover { background: rgba(212,76,67,0.18); }
  .cc-phone svg { color: var(--c-brand); flex-shrink: 0; }
  .cc-phone-num {
    font-family: 'Barlow Condensed', 'Inter', sans-serif;
    font-size: clamp(1.7rem, 5vw, 2.4rem); font-weight: 700; letter-spacing: 0.02em;
    line-height: 1;
  }
  .cc-phone-tap { margin-left: auto; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-muted); }
  .cc-phone--missing {
    background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.35);
    color: #f5c98b; font-size: 0.875rem; line-height: 1.5;
  }
  .cc-phone--missing svg { color: #f59e0b; }
  .cc-head-facts { display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem; color: var(--c-sec); }
  .cc-head-facts strong { color: #fafafa; font-weight: 700; }

  .cc-edit { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cc-edit-actions { grid-column: 1 / -1; display: flex; gap: 8px; }

  /* Sections */
  .cc-sec { display: flex; flex-direction: column; gap: 12px; }
  .cc-sec-title {
    font-family: 'Barlow Condensed', 'Inter', sans-serif; text-transform: uppercase;
    font-size: 1.3rem; font-weight: 700; letter-spacing: 0.03em; color: #fafafa;
    display: flex; align-items: baseline; gap: 10px;
    padding-bottom: 8px; border-bottom: 1px solid var(--c-border);
  }
  .cc-sec-note { font-family: 'Inter', sans-serif; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; text-transform: none; color: var(--c-muted); }

  .cc-angle { }
  .cc-angle-text {
    font-size: 1rem; line-height: 1.7; color: #eaeaea;
    background: rgba(212,76,67,0.07); border-left: 3px solid var(--c-brand);
    padding: 14px 18px; border-radius: 0 12px 12px 0;
  }

  /* Checklist */
  .cc-checklist { list-style: none; display: flex; flex-direction: column; gap: 8px; padding: 0; margin: 0; }
  .cc-checkitem {
    display: flex; align-items: flex-start; gap: 11px; cursor: pointer;
    padding: 10px 13px; border-radius: 10px;
    background: var(--c-card); border: 1px solid var(--c-border);
    font-size: 0.9rem; line-height: 1.5; color: var(--c-sec);
    transition: opacity 0.15s;
  }
  .cc-checkitem input { position: absolute; opacity: 0; pointer-events: none; }
  .cc-checkitem.is-done { opacity: 0.5; }
  .cc-checkitem.is-done > span:last-child { text-decoration: line-through; }
  .cc-checkbox {
    width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0; margin-top: 2px;
    border: 2px solid rgba(255,255,255,0.25);
    display: inline-flex; align-items: center; justify-content: center; color: #fff;
  }
  .cc-checkitem.is-done .cc-checkbox { background: #22c55e; border-color: #22c55e; }

  /* Script steps */
  .cc-steps { list-style: none; display: flex; flex-direction: column; gap: 18px; padding: 0; margin: 0; }
  .cc-step-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .cc-step-num {
    width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(212,76,67,0.15); border: 1px solid rgba(212,76,67,0.4);
    color: #e66b63; font-size: 0.78rem; font-weight: 800;
  }
  .cc-step-title { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-muted); }
  .cc-say {
    font-size: 1.05rem; line-height: 1.65; color: #f2f2f2;
    background: var(--c-card); border: 1px solid var(--c-border);
    padding: 13px 17px; border-radius: 12px;
  }
  .cc-qa-label { font-size: 0.75rem; font-weight: 700; color: var(--c-muted); margin: 10px 0 6px; }

  .cc-qa { display: flex; flex-direction: column; gap: 7px; }
  .cc-qa-row {
    display: grid; grid-template-columns: minmax(120px, 0.8fr) 1.6fr; gap: 0;
    border: 1px solid var(--c-border); border-radius: 11px; overflow: hidden;
  }
  .cc-qa-say {
    padding: 11px 13px; font-size: 0.85rem; font-weight: 700; color: #f5c98b;
    background: rgba(255,255,255,0.03); border-right: 1px solid var(--c-border);
    display: flex; align-items: center;
  }
  .cc-qa-respond { padding: 11px 14px; font-size: 0.9rem; line-height: 1.6; color: var(--c-sec); background: var(--c-card); }
  @media (max-width: 560px) {
    .cc-qa-row { grid-template-columns: 1fr; }
    .cc-qa-say { border-right: none; border-bottom: 1px solid var(--c-border); }
  }

  /* Close */
  .cc-close-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 680px) { .cc-close-grid { grid-template-columns: 1fr; } }
  .cc-close-card {
    background: var(--c-card); border: 1px solid var(--c-border);
    border-radius: 12px; padding: 14px 16px;
    display: flex; flex-direction: column; gap: 7px;
  }
  .cc-close-card--lock { grid-column: 1 / -1; border-color: rgba(34,197,94,0.35); background: rgba(34,197,94,0.05); }
  .cc-close-card h3 { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-muted); }
  .cc-close-card--lock h3 { color: #22c55e; }
  .cc-close-card p { font-size: 0.9rem; line-height: 1.6; color: var(--c-sec); }

  /* After the call */
  .cc-after { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 16px; padding: 18px; }
  .cc-after .cc-sec-title { border-bottom: none; padding-bottom: 0; }
  .cc-result-row { display: flex; flex-direction: column; gap: 8px; }
  .cc-result-label { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--c-muted); }
  .cc-result-opts { display: flex; gap: 7px; flex-wrap: wrap; }
  .cc-result-opt {
    font-size: 0.8rem; font-weight: 700; padding: 7px 15px; border-radius: 999px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
    color: var(--c-muted); cursor: pointer; font-family: inherit; transition: all 0.15s;
  }
  .cc-result-opt:hover { color: #fafafa; }
  .cc-result-opt.is-on {
    color: var(--sc);
    background: color-mix(in srgb, var(--sc) 15%, transparent);
    border-color: color-mix(in srgb, var(--sc) 50%, transparent);
  }
  .cc-after-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
  @media (max-width: 640px) { .cc-after-grid { grid-template-columns: 1fr; } }
  .cc-after .cc-btn { align-self: flex-start; }

  /* Intel */
  .cc-intel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 680px) { .cc-intel-grid { grid-template-columns: 1fr; } }
  .cc-intel-col { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 12px; padding: 14px 16px; }
  .cc-intel-h { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-muted); margin-bottom: 10px; }
  .cc-intel-h--plus { color: #22c55e; }
  .cc-intel-h--minus { color: #f59e0b; }
  .cc-intel-col ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .cc-intel-col li {
    font-size: 0.875rem; line-height: 1.55; color: var(--c-sec);
    padding-left: 14px; position: relative;
  }
  .cc-intel-col li::before {
    content: ''; position: absolute; left: 0; top: 0.55em;
    width: 6px; height: 2px; border-radius: 2px; background: var(--c-muted);
  }
  .cc-droplines { display: flex; flex-direction: column; gap: 9px; margin-top: 14px; }
  .cc-dropline {
    margin: 0; padding: 13px 17px; border-radius: 12px;
    background: rgba(212,76,67,0.08); border: 1px solid rgba(212,76,67,0.3);
    font-size: 0.95rem; font-weight: 600; line-height: 1.55; color: #f0d9d7;
  }

  /* New-lead form */
  .cc-new { max-width: 640px; margin: 0 auto; padding: clamp(16px, 3vw, 32px); display: flex; flex-direction: column; gap: 16px; }
  .cc-new-head { display: flex; align-items: center; justify-content: space-between; }
  .cc-new-title { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; }
  .cc-new-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .cc-new-grid { grid-template-columns: 1fr; } }
  .cc-new-note { font-size: 0.78rem; color: var(--c-muted); }
  .cc-new .cc-btn { align-self: flex-start; }

  /* ── Mobile: list-first drill-down ── */
  @media (max-width: 900px) {
    .cc-list { width: 100%; border-right: none; }
    .cc-pad { display: none; }
    .cc-page.has-pad .cc-list { display: none; }
    .cc-page.has-pad .cc-pad { display: block; }
    .cc-back { display: inline-flex; }
    .cc-topbar { flex-wrap: wrap; }
  }
`;
