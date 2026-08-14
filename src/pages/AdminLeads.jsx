import { useState, useMemo } from 'react';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import PhoneOutgoing01 from '@untitled-ui/icons-react/build/esm/PhoneOutgoing01';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import Upload01 from '@untitled-ui/icons-react/build/esm/Upload01';
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import { ScrollArea } from '../components/AdminLayout';
import { SocialButtons, SocialFields } from '../components/SocialLinks';
import Checklists from '../components/Checklists';
import LinkedSubmissions from '../components/LinkedSubmissions';
import LeadImport from '../components/LeadImport';
import { normalizeSocials } from '../lib/socials';
import { formatPhone } from '../lib/phone';
import { effectiveStage, checklistProgress } from '../lib/booked';
import { defaultLead } from './AdminCalls';

const CALL_STATUSES = [
  { id: 'not-called', label: 'Not called', color: '#8a8a8a' },
  { id: 'callback',   label: 'Callback',   color: '#60a5fa' },
  { id: 'no',         label: 'No',         color: '#ef4444' },
  { id: 'no-answer',  label: 'No answer',  color: '#f59e0b' },
];
const PRIORITIES = [
  { id: 'hot', label: 'Hot' }, { id: 'warm', label: 'Warm' }, { id: 'cold', label: 'Cold' },
];
const PRIO_RANK = { hot: 0, warm: 1, cold: 2 };
const STATUS_RANK = { 'not-called': 0, callback: 1, 'no-answer': 2, no: 3, booked: 4 };
const statusOf = (id) => CALL_STATUSES.find(s => s.id === id) || CALL_STATUSES[0];
const telOf = (lead) => lead?.phone ? `tel:${lead.phone.replace(/[^0-9+]/g, '')}` : null;
const fmtLogTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const OUTCOME_META = {
  booked: ['Booked', '#22c55e'], callback: ['Callback', '#60a5fa'], no: ['No', '#ef4444'],
  'no-answer': ['No answer', '#f59e0b'], 'not-called': ['Not called', '#8a8a8a'],
};

function Pill({ p }) {
  return <span className={`ld-prio ld-prio--${p}`}>{(p || 'warm').toUpperCase()}</span>;
}

/* Compact create/edit form — aa- input system, socials included. */
function LeadForm({ lead, onSave, onCancel, creating }) {
  const [f, setF] = useState({
    business: lead?.business || '', industry: lead?.industry || '', area: lead?.area || '',
    phone: lead?.phone || '', phoneNote: lead?.phoneNote || '', email: lead?.email || '',
    askFor: lead?.askFor || '', bestWindow: lead?.bestWindow || 'Before 8am or after 5pm.',
    priority: lead?.priority || 'warm', angle: lead?.angle || '', descriptor: lead?.descriptor || '',
    socials: { ...(lead?.socials || {}) },
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.business.trim()) return;
    setBusy(true);
    await onSave({ ...f, socials: normalizeSocials(f.socials) });
    setBusy(false);
  };
  return (
    <form className="ld-form" onSubmit={submit}>
      <div className="ld-form-grid">
        {[['business', 'Business', true], ['industry', 'Industry'], ['area', 'Area'],
          ['phone', 'Phone'], ['phoneNote', 'Phone note'], ['email', 'Email'],
          ['askFor', 'Ask for'], ['bestWindow', 'Best window'], ['descriptor', 'Descriptor']]
          .map(([k, label, req]) => (
            <label key={k} className="aa-field">
              <span>{label}</span>
              <input className="aa-input" value={f[k]} onChange={set(k)} required={!!req} />
            </label>
          ))}
        <label className="aa-field">
          <span>Priority</span>
          <select className="aa-input" value={f.priority} onChange={set('priority')}>
            {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label.toUpperCase()}</option>)}
          </select>
        </label>
      </div>
      <label className="aa-field">
        <span>The angle</span>
        <textarea className="aa-input" rows={3} value={f.angle} onChange={set('angle')} placeholder="Why this lead — the gap you'd pitch." />
      </label>
      <div className="aa-field">
        <span>Social links &amp; website</span>
        <SocialFields values={f.socials} onChange={(k, v) => setF(p => ({ ...p, socials: { ...p.socials, [k]: v } }))} />
      </div>
      <div className="ld-form-actions">
        <button type="submit" className="aa-btn aa-btn--primary" disabled={busy || !f.business.trim()}>
          <Check width={14} height={14} /> {busy ? 'Saving…' : creating ? 'Add lead' : 'Save changes'}
        </button>
        <button type="button" className="aa-btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Block({ title, children, action }) {
  return (
    <section className="ld-block">
      <div className="ld-block-head"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}

function LeadDetail({ lead, submissions, onPatch, onDelete, onLinkSubmission, onClose, onGo }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(lead.notes || '');
  const [notesState, setNotesState] = useState('idle');
  const log = [...(lead.callLog || [])].reverse();

  const saveNotes = async () => {
    setNotesState('saving');
    const ok = await onPatch(lead._id, { notes });
    setNotesState(ok ? 'idle' : 'dirty');
  };

  return (
    <ScrollArea bare className="ld-scroll" key={lead._id}>
      <div className="ld-detail lay-content lay-content--wide">
        <div className="ld-top">
          <button type="button" className="ld-back" onClick={onClose}><ArrowLeft width={15} height={15} /> Leads</button>
          <span className="ld-top-spacer" />
          <button type="button" className="aa-btn" onClick={() => onGo('calls')}>
            <PhoneOutgoing01 width={14} height={14} /> Dial in Call Console
          </button>
          <button type="button" className="aa-iconbtn" onClick={() => setEditing(v => !v)} title="Edit lead"><Edit02 width={15} height={15} /></button>
          <button
            type="button" className="aa-iconbtn" title="Delete lead"
            onClick={() => { if (window.confirm(`Delete ${lead.business}? It won't come back on re-import.`)) onDelete(lead._id); }}
          ><Trash01 width={15} height={15} /></button>
        </div>

        <header className="ld-head">
          <div className="ld-head-meta">
            <Pill p={lead.priority} />
            <span className="ld-status" style={{ '--sc': statusOf(lead.callStatus).color }}>
              <span className="ld-status-dot" />{statusOf(lead.callStatus).label}
            </span>
            {lead.industry && <span className="ld-meta-txt">{lead.industry}</span>}
            {lead.area && <span className="ld-meta-txt">{lead.area}</span>}
          </div>
          <h1 className="ld-biz display">{lead.business}</h1>
          {lead.askFor && <p className="ld-askfor">Ask for {lead.askFor.replace(/^Ask for /i, '')}</p>}
        </header>

        {editing ? (
          <Block title="Edit lead">
            <LeadForm
              lead={lead}
              onSave={async (f) => { await onPatch(lead._id, f); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          </Block>
        ) : (
          <>
            {telOf(lead) && (
              <a href={telOf(lead)} className="ld-phone">
                <PhoneCall01 width={19} height={19} />
                <span>{formatPhone(lead.phone)}</span>
                {lead.phoneNote && <em>{lead.phoneNote}</em>}
              </a>
            )}
            <SocialButtons socials={lead.socials} onAdd={() => setEditing(true)} />

            <div className="ld-cols">
              <div className="ld-col">
                {lead.angle && <Block title="The angle"><p className="ld-angle">{lead.angle}</p></Block>}
                <Block title="Notes">
                  <textarea
                    className="aa-input ld-notes" rows={4} value={notes}
                    onChange={e => { setNotes(e.target.value); setNotesState('dirty'); }}
                    placeholder="Everything you know about them…"
                  />
                  {notesState !== 'idle' && (
                    <button type="button" className="aa-btn aa-btn--primary" onClick={saveNotes} disabled={notesState === 'saving'}>
                      {notesState === 'saving' ? 'Saving…' : 'Save notes'}
                    </button>
                  )}
                </Block>
                <Block title={`Call history${log.length ? ` · ${log.length}` : ''}`}>
                  {!log.length && <p className="ld-muted">No calls logged yet — dial them from the Call Console.</p>}
                  {log.map((e, i) => {
                    const [label, color] = OUTCOME_META[e.outcome] || OUTCOME_META['not-called'];
                    return (
                      <div key={i} className="ld-log" style={{ '--sc': color }}>
                        <span className="ld-log-dot" />
                        <div>
                          <p className="ld-log-top"><strong>{label}</strong><span>{fmtLogTime(e.at)}</span></p>
                          {e.note && <p className="ld-log-note">{e.note}</p>}
                        </div>
                      </div>
                    );
                  })}
                </Block>
              </div>
              <div className="ld-col">
                <Block title="Checklists"><Checklists lead={lead} onPatch={onPatch} /></Block>
                <Block title="Their site submissions">
                  <LinkedSubmissions lead={lead} submissions={submissions} onLinkSubmission={onLinkSubmission} />
                </Block>
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}

/* ── Page: full-width lead management (pre-booked pipeline) ────── */

export default function AdminLeads({
  leads, submissions, loading, onPatch, onCreate, onDelete, onRefresh,
  onLinkSubmission, onMobileOpen, onMobileClose, onGo,
}) {
  const [q, setQ] = useState('');
  const [prio, setPrio] = useState(() => new Set());
  const [status, setStatus] = useState(() => new Set());
  const [industry, setIndustry] = useState('all');
  const [selId, setSelId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const pool = useMemo(() => leads.filter(l => effectiveStage(l) === 'lead'), [leads]);
  const industries = useMemo(() => [...new Set(pool.map(l => l.industry).filter(Boolean))].sort(), [pool]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pool
      .filter(l =>
        (!needle || `${l.business} ${l.industry} ${l.area} ${l.descriptor} ${l.notes}`.toLowerCase().includes(needle)) &&
        (!prio.size || prio.has(l.priority)) &&
        (!status.size || status.has(l.callStatus)) &&
        (industry === 'all' || l.industry === industry))
      .sort((a, b) =>
        (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1) ||
        (STATUS_RANK[a.callStatus] ?? 9) - (STATUS_RANK[b.callStatus] ?? 9) ||
        new Date(b.createdAt) - new Date(a.createdAt));
  }, [pool, q, prio, status, industry]);

  const sel = selId ? pool.find(l => l._id === selId) : null;
  const pick = (id) => { setSelId(id); setCreating(false); onMobileOpen?.(); };
  const back = () => { setSelId(null); setCreating(false); onMobileClose?.(); };
  const toggleSet = (setter) => (id) => setter(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <>
      <aside className="aa-panel">
        <div className="aa-panel-head">
          <h2 className="aa-panel-title">Leads</h2>
          <div className="aa-panel-headbtns">
            <button type="button" className="aa-iconbtn" onClick={() => setImportOpen(true)} title="Upload spreadsheet"><Upload01 width={15} height={15} /></button>
            <button type="button" className="aa-iconbtn" onClick={onRefresh} title="Refresh"><RefreshCw01 width={14} height={14} /></button>
            <button type="button" className="aa-btn aa-btn--primary" onClick={() => { setCreating(true); setSelId(null); onMobileOpen?.(); }}>
              <Plus width={14} height={14} /> New
            </button>
          </div>
        </div>

        <div className="aa-search-wrap">
          <SearchMd width={14} height={14} />
          <input className="aa-input aa-search" placeholder="Search leads…" value={q} onChange={e => setQ(e.target.value)} />
          {q && <button type="button" className="aa-search-clear" onClick={() => setQ('')} aria-label="Clear search"><XClose width={12} height={12} /></button>}
        </div>

        <div className="ld-chips">
          {PRIORITIES.map(p => (
            <button key={p.id} type="button" className={`ld-chip${prio.has(p.id) ? ' is-on' : ''}`} aria-pressed={prio.has(p.id)} onClick={() => toggleSet(setPrio)(p.id)}>{p.label}</button>
          ))}
          {CALL_STATUSES.map(s => (
            <button key={s.id} type="button" className={`ld-chip${status.has(s.id) ? ' is-on' : ''}`} aria-pressed={status.has(s.id)} onClick={() => toggleSet(setStatus)(s.id)}>{s.label}</button>
          ))}
          <select className="ld-chip ld-chip--select" value={industry} onChange={e => setIndustry(e.target.value)} aria-label="Filter by industry">
            <option value="all">Industry</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <p className="ld-count">{filtered.length} of {pool.length} lead{pool.length === 1 ? '' : 's'}</p>

        <ScrollArea bare className="ld-list">
          {loading && !leads.length && <p className="ld-muted" style={{ padding: 12 }}>Loading…</p>}
          {!loading && !pool.length && (
            <div className="ld-empty">
              <p className="ld-empty-title">No open leads.</p>
              <p className="ld-muted">Add one, upload a spreadsheet, or check Booked and Clients — everyone might just be further down the pipeline.</p>
            </div>
          )}
          {pool.length > 0 && !filtered.length && <p className="ld-muted" style={{ padding: 12 }}>Nothing matches these filters.</p>}
          {filtered.map(l => {
            const ck = checklistProgress(l);
            return (
              <button key={l._id} type="button" className={`ld-card lay-card${sel?._id === l._id ? ' is-sel' : ''}`} onClick={() => pick(l._id)}>
                <span className="ld-dot" style={{ '--sc': statusOf(l.callStatus).color }} />
                <span className="ld-card-main">
                  <span className="ld-card-name lay-truncate">{l.business}</span>
                  <span className="ld-card-sub lay-truncate">
                    {[l.area, l.industry].filter(Boolean).join(' · ') || l.descriptor}
                    {ck.total ? ` · tasks ${ck.done}/${ck.total}` : ''}
                  </span>
                </span>
                <span className="ld-card-side">
                  <Pill p={l.priority} />
                  {l.phone && <Phone width={13} height={13} className="ld-hasphone" />}
                </span>
              </button>
            );
          })}
        </ScrollArea>
      </aside>

      <main className="aa-main ld-main">
        {creating ? (
          <ScrollArea bare className="ld-scroll">
            <div className="ld-detail lay-content lay-content--wide">
              <div className="ld-top">
                <button type="button" className="ld-back" onClick={back}><ArrowLeft width={15} height={15} /> Leads</button>
              </div>
              <Block title="New lead">
                <LeadForm creating onSave={async (f) => { await onCreate(defaultLead(f)); back(); }} onCancel={back} />
              </Block>
            </div>
          </ScrollArea>
        ) : sel ? (
          <LeadDetail
            lead={sel} submissions={submissions}
            onPatch={onPatch} onDelete={async (id) => { await onDelete(id); back(); }}
            onLinkSubmission={onLinkSubmission} onClose={back} onGo={onGo}
          />
        ) : (
          <div className="aa-main-empty">
            <Users01Empty />
            <p>Pick a lead to see everything about them — notes, calls, checklists, and what they sent through the site.</p>
          </div>
        )}
      </main>

      {importOpen && (
        <LeadImport existingLeads={leads} onClose={() => setImportOpen(false)} onImported={onRefresh} />
      )}

      <style>{ldStyles}</style>
    </>
  );
}

function Users01Empty() {
  return <PhoneOutgoing01 width={34} height={34} />;
}

const ldStyles = `
  .ld-muted { color: var(--a-muted); font-size: 0.82rem; line-height: 1.55; }
  .ld-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .ld-chip {
    padding: 6px 12px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--a-border); background: rgba(255,255,255,0.04);
    color: var(--a-muted); font-size: 0.72rem; font-weight: 700; font-family: inherit;
    transition: color 0.15s, border-color 0.15s; white-space: nowrap;
    touch-action: manipulation;
  }
  .ld-chip:hover { color: #fafafa; }
  .ld-chip.is-on { color: var(--a-brand); border-color: rgba(212,76,67,0.5); background: rgba(212,76,67,0.1); }
  .ld-chip--select { appearance: none; -webkit-appearance: none; }
  .ld-chip--select option { background: #1a1a1a; color: #fafafa; }
  .ld-count { font-size: 0.66rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--a-muted); }

  .ld-list.lay-scroll { padding: 0 0 12px; display: flex; flex-direction: column; gap: 6px; }
  .ld-card {
    display: flex; align-items: center; gap: 11px; width: 100%;
    padding: 11px 13px; border-radius: 12px; cursor: pointer; text-align: left;
    background: var(--a-card); border: 1px solid var(--a-border);
    font-family: inherit; color: inherit; transition: border-color 0.15s;
  }
  .ld-card:hover { border-color: rgba(212,76,67,0.4); }
  .ld-card.is-sel { border-color: var(--a-brand); }
  .ld-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sc); flex-shrink: 0; }
  .ld-card-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ld-card-name { font-size: 0.88rem; font-weight: 800; letter-spacing: -0.01em; }
  .ld-card-sub { font-size: 0.7rem; color: var(--a-muted); }
  .ld-card-side { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
  .ld-hasphone { color: #22c55e; }
  .ld-prio {
    font-size: 0.58rem; font-weight: 900; letter-spacing: 0.1em;
    padding: 2px 8px; border-radius: 999px; flex-shrink: 0;
  }
  .ld-prio--hot { background: rgba(212,76,67,0.18); color: #e66b63; border: 1px solid rgba(212,76,67,0.4); }
  .ld-prio--warm { background: rgba(245,158,11,0.14); color: #f59e0b; border: 1px solid rgba(245,158,11,0.35); }
  .ld-prio--cold { background: rgba(96,165,250,0.14); color: #60a5fa; border: 1px solid rgba(96,165,250,0.35); }
  .ld-empty { padding: 26px 12px; display: flex; flex-direction: column; gap: 8px; }
  .ld-empty-title { font-weight: 800; }

  /* Detail — full width beside the rail, two columns on desktop */
  .ld-main { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  @media (max-width: 760px) {
    .aa-app.has-detail .aa-main.ld-main { display: flex; flex-direction: column; }
  }
  .ld-scroll { display: flex; flex-direction: column; }
  .ld-detail { --lay-stack-gap: 16px; }
  @media (min-width: 1200px) { .ld-detail.lay-content--wide { max-width: 1320px; } }
  .ld-cols { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .ld-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  @media (min-width: 1200px) {
    .ld-cols { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 20px; align-items: start; }
  }

  .ld-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ld-top-spacer { flex: 1; }
  .ld-back {
    display: inline-flex; align-items: center; gap: 7px;
    background: none; border: none; color: var(--a-muted); cursor: pointer;
    font-size: 0.85rem; font-weight: 600; font-family: inherit; padding: 0;
  }
  .ld-back:hover { color: #fafafa; }
  .ld-head { display: flex; flex-direction: column; gap: 6px; }
  .ld-head-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ld-meta-txt { font-size: 0.72rem; font-weight: 600; color: var(--a-muted); }
  .ld-status {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.64rem; font-weight: 700; padding: 2px 9px; border-radius: 999px;
    color: var(--sc); background: color-mix(in srgb, var(--sc) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent);
  }
  .ld-status-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sc); }
  .ld-biz {
    font-family: 'Barlow Condensed', 'Inter', sans-serif; text-transform: uppercase;
    font-size: clamp(1.9rem, 6vw, 2.8rem); line-height: 0.95; font-weight: 700;
  }
  .ld-askfor { font-size: 0.92rem; font-weight: 600; color: var(--a-sec); }
  .ld-phone {
    display: inline-flex; align-items: center; gap: 11px; align-self: flex-start; max-width: 100%;
    padding: 12px 17px; border-radius: 13px; text-decoration: none;
    background: var(--a-brand); border: 1px solid var(--a-brand); color: #fff;
    font-size: 1.05rem; font-weight: 800;
    box-shadow: 0 6px 24px rgba(212,76,67,0.28); transition: background 0.15s;
  }
  .ld-phone:hover { background: #c2413a; }
  .ld-phone em { font-style: normal; font-size: 0.7rem; font-weight: 600; opacity: 0.8; min-width: 0; overflow-wrap: anywhere; }

  .ld-block {
    display: flex; flex-direction: column; gap: 12px; min-width: 0;
    background: var(--a-card); border: 1px solid var(--a-border);
    border-radius: 14px; padding: 15px 16px;
  }
  .ld-block > * { min-width: 0; }
  .ld-block-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .ld-block-head h2 { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--a-sec); }
  .ld-angle { font-size: 0.94rem; line-height: 1.65; color: #eaeaea; white-space: pre-wrap; overflow-wrap: anywhere; }
  .ld-notes { resize: vertical; min-height: 90px; line-height: 1.55; }
  .ld-block .aa-btn { align-self: flex-start; }

  .ld-log { display: flex; gap: 10px; min-width: 0; }
  .ld-log-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sc); flex-shrink: 0; margin-top: 5px; }
  .ld-log-top { display: flex; gap: 8px; align-items: baseline; font-size: 0.8rem; }
  .ld-log-top strong { color: var(--sc); font-weight: 800; }
  .ld-log-top span { font-size: 0.68rem; color: var(--a-muted); }
  .ld-log-note { font-size: 0.8rem; color: var(--a-sec); line-height: 1.5; overflow-wrap: anywhere; }

  .ld-form { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .ld-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 640px) { .ld-form-grid { grid-template-columns: 1fr; } }
  .ld-form-actions { display: flex; gap: 8px; }
`;
