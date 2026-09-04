import { useState, useMemo } from 'react';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import CurrencyDollarCircle from '@untitled-ui/icons-react/build/esm/CurrencyDollarCircle';
import Briefcase01 from '@untitled-ui/icons-react/build/esm/Briefcase01';
import Trophy01 from '@untitled-ui/icons-react/build/esm/Trophy01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import FlipBackward from '@untitled-ui/icons-react/build/esm/FlipBackward';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import Calendar from '@untitled-ui/icons-react/build/esm/Calendar';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import MessageCircle01 from '@untitled-ui/icons-react/build/esm/MessageCircle01';
import { ScrollArea, StickyFooterBar, useConfirm } from '../ui';
import { SocialButtons, SocialFields } from '../components/SocialLinks';
import Checklists from '../components/Checklists';
import LinkedSubmissions from '../components/LinkedSubmissions';
import { normalizeSocials } from '../lib/socials';
import { formatPhone, telHref } from '../shared/phone';
import { fmtDate, todayInput } from '../shared/dates';
import { money } from '../shared/format';
import { CALL_STATUSES, CONTACT_TYPES as SEM_CONTACT_TYPES, contactTypeLabel } from '../shared/semantics';
import {
  effectiveStage, serviceLabel, planLabel, monthlyOf, checklistProgress,
  lastContact, totalPaid,
} from '../lib/booked';

const telOf = (lead) => telHref(lead?.phone);
const CONTACT_ICONS = { Phone, Calendar, Mail01, MessageCircle01 };
// Contact types + outcome labels: src/shared/semantics.js (one source of truth).
const CONTACT_TYPES = SEM_CONTACT_TYPES.filter(t => t.id !== 'other').map(t => ({ ...t, Icon: CONTACT_ICONS[t.icon] }));
const OUTCOME_LABELS = Object.fromEntries(CALL_STATUSES.map(x => [x.id, x.label]));

/** Chip text for recency — the number carries the meaning, color assists. */
function ContactChip({ lead }) {
  const lc = lastContact(lead);
  if (!lc) return <span className="cl-touch cl-touch--never">Never contacted</span>;
  const stale = lc.days > 14;
  const label = lc.days === 0 ? 'Today' : `${lc.days}d ago`;
  return (
    <span className={`cl-touch${stale ? ' cl-touch--stale' : ''}`}>
      {label}{stale ? ' — reach out' : ''}
    </span>
  );
}

function Block({ title, children, action }) {
  return (
    <section className="cl-block">
      <div className="cl-block-head"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}

/* Create/edit form — same fields both ways, socials included. */
function ClientForm({ lead, creating, onSave, onCancel, onDelete }) {
  const [confirm, confirmDialog] = useConfirm();
  const [f, setF] = useState({
    business: lead?.business || '', askFor: lead?.askFor || '', phone: lead?.phone || '',
    email: lead?.email || '', area: lead?.area || '', industry: lead?.industry || '',
    notes: lead?.notes || '', socials: { ...(lead?.socials || {}) },
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
    <form className="cl-form" onSubmit={submit}>
      <div className="cl-form-grid">
        {[['business', 'Business', true], ['askFor', 'Contact name'], ['phone', 'Phone'],
          ['email', 'Email'], ['area', 'Area'], ['industry', 'Industry']].map(([k, label, req]) => (
          <label key={k} className="aa-field">
            <span>{label}</span>
            <input className="aa-input" value={f[k]} onChange={set(k)} required={!!req} />
          </label>
        ))}
      </div>
      {creating && (
        <label className="aa-field">
          <span>Notes</span>
          <textarea className="aa-input" rows={3} value={f.notes} onChange={set('notes')} placeholder="How they became a client, preferences…" />
        </label>
      )}
      <div className="aa-field">
        <span>Social links &amp; website</span>
        <SocialFields values={f.socials} onChange={(k, v) => setF(p => ({ ...p, socials: { ...p.socials, [k]: v } }))} />
      </div>
      <div className="cl-form-actions">
        {confirmDialog}
        <button type="submit" className="aa-btn aa-btn--primary" disabled={busy || !f.business.trim()}>
          <Check width={14} height={14} /> {busy ? 'Saving…' : creating ? 'Add client' : 'Save changes'}
        </button>
        <button type="button" className="aa-btn" onClick={onCancel}>Cancel</button>
        {!creating && onDelete && (
          <>
            <span style={{ flex: 1 }} />
            <button type="button" className="aa-btn aa-btn--dangerghost"
              onClick={async () => { if (await confirm({ title: `Delete ${lead.business}?`, body: 'This removes them from the CRM.', danger: true, confirmLabel: 'Delete' })) onDelete(lead._id); }}>
              <Trash01 width={14} height={14} /> Delete
            </button>
          </>
        )}
      </div>
    </form>
  );
}

/* What they paid for — ledger with running total. */
function Purchases({ lead, onPatch }) {
  const [confirm, confirmDialog] = useConfirm();
  const rows = lead.purchases || [];
  const [adding, setAdding] = useState(false);
  const [d, setD] = useState({ label: '', amount: '', at: todayInput(), notes: '' });
  const total = totalPaid(lead);

  const save = (next) => onPatch(lead._id, { purchases: next });
  const add = async () => {
    if (!d.label.trim() || !(Number(d.amount) >= 0)) return;
    await save([...rows, { label: d.label.trim(), amount: Number(d.amount) || 0, at: d.at || todayInput(), notes: d.notes.trim() }]);
    setD({ label: '', amount: '', at: todayInput(), notes: '' });
    setAdding(false);
  };
  const remove = async (i) => {
    if (!(await confirm({ title: `Remove "${rows[i].label}"?`, body: `${money(rows[i].amount)} comes off the ledger total.`, danger: true, confirmLabel: 'Remove' }))) return;
    save(rows.filter((_, j) => j !== i));
  };
  const sorted = rows.map((p, i) => ({ ...p, _i: i })).sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="cl-pay">
      {confirmDialog}
      <div className="cl-pay-total">
        <span className="cl-pay-num">{money(total)}</span>
        <span className="cl-pay-lbl">total paid · {rows.length} purchase{rows.length === 1 ? '' : 's'}</span>
      </div>
      {sorted.map(p => (
        <div key={p._i} className="cl-pay-row">
          <div className="cl-pay-main">
            <p className="cl-pay-top"><strong>{p.label}</strong><span>{money(p.amount)}</span></p>
            <p className="cl-pay-sub">{fmtDate(p.at)}{p.notes ? ` · ${p.notes}` : ''}</p>
          </div>
          <button type="button" className="cl-pay-del" onClick={() => remove(p._i)} aria-label={`Remove ${p.label}`}>
            <XClose width={14} height={14} />
          </button>
        </div>
      ))}
      {adding ? (
        <form className="cl-pay-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <div className="cl-pay-form-grid">
            <label className="aa-field cl-span2"><span>What they paid for</span>
              <input className="aa-input" value={d.label} onChange={e => setD(p => ({ ...p, label: e.target.value }))} placeholder="Full brand + website package" autoFocus />
            </label>
            <label className="aa-field"><span>Amount</span>
              <div className="cl-amt"><span>$</span><input className="aa-input" type="number" min="0" inputMode="decimal" value={d.amount} onChange={e => setD(p => ({ ...p, amount: e.target.value }))} placeholder="0" /></div>
            </label>
            <label className="aa-field"><span>Date</span>
              <input className="aa-input" type="date" value={d.at} onChange={e => setD(p => ({ ...p, at: e.target.value }))} />
            </label>
            <label className="aa-field cl-span2"><span>Note <em>(optional)</em></span>
              <input className="aa-input" value={d.notes} onChange={e => setD(p => ({ ...p, notes: e.target.value }))} placeholder="Invoice #2, monthly retainer, sticker rerun…" />
            </label>
          </div>
          <div className="cl-form-actions">
            <button type="submit" className="aa-btn aa-btn--primary" disabled={!d.label.trim()}><Check width={14} height={14} /> Save purchase</button>
            <button type="button" className="aa-btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="aa-btn" onClick={() => setAdding(true)}><Plus width={14} height={14} /> Add purchase</button>
      )}
    </div>
  );
}

/* Manual contact log + read-only console history, one timeline. */
function ContactHistory({ lead, onPatch }) {
  const [type, setType] = useState('call');
  const [at, setAt] = useState(todayInput());
  const [note, setNote] = useState('');
  const manual = lead.contactLog || [];

  const log = async () => {
    await onPatch(lead._id, {
      contactLog: [...manual, { type, at: at || todayInput(), note: note.trim() }],
    });
    setNote('');
    setAt(todayInput());
  };
  const removeManual = (i) => onPatch(lead._id, { contactLog: manual.filter((_, j) => j !== i) });

  const timeline = [
    ...manual.map((e, i) => ({ ...e, kind: 'manual', _i: i })),
    ...(lead.callLog || []).map(e => ({ ...e, kind: 'console' })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 25);

  const lc = lastContact(lead);

  return (
    <div className="cl-contact">
      <form className="cl-contact-form" onSubmit={(e) => { e.preventDefault(); log(); }}>
        <div className="cl-contact-types" role="group" aria-label="Contact type">
          {CONTACT_TYPES.map(t => (
            <button key={t.id} type="button" className={`cl-ctype${type === t.id ? ' is-on' : ''}`} aria-pressed={type === t.id} onClick={() => setType(t.id)}>
              <t.Icon width={14} height={14} /> {t.label}
            </button>
          ))}
        </div>
        <div className="cl-contact-row">
          <input className="aa-input cl-contact-date" type="date" value={at} onChange={e => setAt(e.target.value)} aria-label="Contact date" />
          <input className="aa-input" value={note} onChange={e => setNote(e.target.value)} placeholder="What happened — quick note…" />
          <button type="submit" className="aa-btn aa-btn--primary"><Check width={14} height={14} /> Log it</button>
        </div>
      </form>

      {lc
        ? <p className="cl-contact-last">Last contacted <strong>{lc.days === 0 ? 'today' : `${lc.days} day${lc.days === 1 ? '' : 's'} ago`}</strong> · {fmtDate(lc.date)}</p>
        : <p className="cl-muted">No contact logged yet — record the calls and meetings you have with them.</p>}

      {timeline.map((e, i) => (
        <div key={i} className="cl-tl">
          <span className={`cl-tl-type${e.kind === 'console' ? ' cl-tl-type--console' : ''}`}>
            {e.kind === 'console' ? (OUTCOME_LABELS[e.outcome] || 'Call') : contactTypeLabel(e.type)}
          </span>
          <div className="cl-tl-main">
            <p className="cl-tl-top">{fmtDate(e.at)}{e.kind === 'console' ? ' · from Call Console' : ''}</p>
            {e.note && <p className="cl-tl-note">{e.note}</p>}
            {e.meeting && <p className="cl-tl-note">Meeting: {e.meeting}</p>}
          </div>
          {e.kind === 'manual' && (
            <button type="button" className="cl-pay-del" onClick={() => removeManual(e._i)} aria-label="Remove entry"><XClose width={13} height={13} /></button>
          )}
        </div>
      ))}
    </div>
  );
}

function ClientDetail({ lead, submissions, onPatch, onDelete, onLinkSubmission, onClose }) {
  const [confirm, confirmDialog] = useConfirm();
  const stage = effectiveStage(lead);
  const isClient = stage === 'client';
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(lead.notes || '');
  const [notesState, setNotesState] = useState('idle');

  const firstInvoicePaid = () => onPatch(lead._id, { stage: 'client', clientSince: new Date().toISOString() });
  const backToBooked = async () => {
    if (await confirm({ title: `Move ${lead.business} back to Booked?`, body: 'They leave the Clients list and return to the Booked workspace.', confirmLabel: 'Move back' })) onPatch(lead._id, { stage: 'booked' });
  };
  const saveNotes = async () => {
    setNotesState('saving');
    const ok = await onPatch(lead._id, { notes });
    setNotesState(ok ? 'idle' : 'dirty');
  };

  return (
    <>
      {confirmDialog}
      <ScrollArea bare className="cl-scroll" key={lead._id}>
        <div className="cl-detail lay-content lay-content--wide">
          <div className="cl-top">
            <button type="button" className="cl-back" onClick={onClose}><ArrowLeft width={15} height={15} /> Clients</button>
            <span className="cl-top-spacer" />
            {isClient
              ? <span className="cl-tag cl-tag--client"><Briefcase01 width={13} height={13} /> Client since {fmtDate(lead.clientSince) || '—'}</span>
              : <span className="cl-tag cl-tag--won"><Trophy01 width={13} height={13} /> Won — awaiting first invoice</span>}
            <button type="button" className="aa-iconbtn" onClick={() => setEditing(v => !v)} title="Edit client"><Edit02 width={15} height={15} /></button>
          </div>

          <header className="cl-head">
            <div className="cl-head-meta">
              <ContactChip lead={lead} />
              {lead.industry && <span className="cl-meta-txt">{lead.industry}</span>}
              {lead.area && <span className="cl-meta-txt">{lead.area}</span>}
            </div>
            <h1 className="cl-biz display">{lead.business}</h1>
            {lead.askFor && <p className="cl-askfor">{lead.askFor.replace(/^Ask for /i, '')}</p>}
          </header>

          {editing ? (
            <Block title="Edit client">
              <ClientForm
                lead={lead}
                onSave={async (f) => { await onPatch(lead._id, f); setEditing(false); }}
                onCancel={() => setEditing(false)}
                onDelete={async (id) => { await onDelete(id); onClose(); }}
              />
            </Block>
          ) : (
            <>
              {telOf(lead) && (
                <a href={telOf(lead)} className="cl-phone">
                  <PhoneCall01 width={18} height={18} />
                  <span>{formatPhone(lead.phone)}</span>
                </a>
              )}
              <SocialButtons socials={lead.socials} onAdd={() => setEditing(true)} />

              <div className="cl-cols">
                <div className="cl-col">
                  <Block title="What they paid for"><Purchases lead={lead} onPatch={onPatch} /></Block>
                  <Block title="Contact history"><ContactHistory lead={lead} onPatch={onPatch} /></Block>
                  <Block title="Notes">
                    <textarea
                      className="aa-input cl-notes" rows={4} value={notes}
                      onChange={e => { setNotes(e.target.value); setNotesState('dirty'); }}
                      placeholder="Project notes, preferences, what they said…"
                    />
                    {notesState !== 'idle' && (
                      <button type="button" className="aa-btn aa-btn--primary" onClick={saveNotes} disabled={notesState === 'saving'}>
                        {notesState === 'saving' ? 'Saving…' : 'Save notes'}
                      </button>
                    )}
                  </Block>
                  <button type="button" className="cl-demote" onClick={backToBooked}>
                    <FlipBackward width={13} height={13} /> Move back to Booked
                  </button>
                </div>
                <div className="cl-col">
                  <Block title="Project checklists"><Checklists lead={lead} onPatch={onPatch} /></Block>
                  {lead.servicesPlanned?.length > 0 && (
                    <Block title="Services sold">
                      <div className="cl-svcs">
                        {lead.servicesPlanned.map(s => <span key={s} className="cl-svc">{serviceLabel(s)}</span>)}
                      </div>
                    </Block>
                  )}
                  {lead.pricingOptions?.length > 0 && (
                    <Block title="Pricing presented">
                      {lead.pricingOptions.map((o, i) => (
                        <div key={i} className="cl-price">
                          <p className="cl-price-top">
                            <strong>{o.label || `Option ${i + 1}`}</strong>
                            <span>{money(o.price)}{o.plan !== 'full' && monthlyOf(o.price, o.plan) ? ` · $${monthlyOf(o.price, o.plan)}/mo` : ''}</span>
                          </p>
                          <p className="cl-price-sub">{planLabel(o.plan)}{o.retainer ? ` · Retainer: ${o.retainer}` : ''}</p>
                        </div>
                      ))}
                    </Block>
                  )}
                  <Block title="Their site submissions">
                    <LinkedSubmissions lead={lead} submissions={submissions} onLinkSubmission={onLinkSubmission} />
                  </Block>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {!isClient && !editing && (
        <StickyFooterBar className="cl-outbar">
          <button type="button" className="cl-invoice" onClick={firstInvoicePaid}>
            <CurrencyDollarCircle width={19} height={19} /> First invoice paid — make them a client
          </button>
        </StickyFooterBar>
      )}
    </>
  );
}

/* ── Page: manage every current client ─────────────────────────── */

export default function AdminClients({
  leads, submissions, loading, onPatch, onCreate, onDelete, onRefresh,
  onLinkSubmission, onMobileOpen, onMobileClose, onGo,
}) {
  const [selId, setSelId] = useState(null);
  const [creating, setCreating] = useState(false);

  const won = useMemo(
    () => leads.filter(l => effectiveStage(l) === 'won')
      .sort((a, b) => new Date(b.bookedOutcome?.at || b.updatedAt || 0) - new Date(a.bookedOutcome?.at || a.updatedAt || 0)),
    [leads]
  );
  const clients = useMemo(
    () => leads.filter(l => effectiveStage(l) === 'client')
      .sort((a, b) => new Date(b.clientSince || 0) - new Date(a.clientSince || 0)),
    [leads]
  );

  const sel = selId ? leads.find(l => l._id === selId) : null;
  const selVisible = sel && ['won', 'client'].includes(effectiveStage(sel));
  const pick = (id) => { setSelId(id); setCreating(false); onMobileOpen?.(); };
  const back = () => { setSelId(null); setCreating(false); onMobileClose?.(); };

  const Card = ({ l, won: isWon }) => {
    const ck = checklistProgress(l);
    const paid = totalPaid(l);
    return (
      <button type="button" className={`cl-card lay-card${sel?._id === l._id ? ' is-sel' : ''}`} onClick={() => pick(l._id)}>
        <div className="cl-card-top">
          <span className="cl-card-name lay-truncate">{l.business}</span>
          {isWon
            ? <span className="cl-tag cl-tag--won">Awaiting invoice</span>
            : <span className="cl-tag cl-tag--client">Client</span>}
        </div>
        <div className="cl-card-mid">
          {paid > 0 && <span className="cl-card-paid">{money(paid)} paid</span>}
          <ContactChip lead={l} />
        </div>
        <div className="cl-card-sub lay-truncate">
          {isWon ? `Won ${fmtDate(l.bookedOutcome?.at) || 'recently'}` : `Since ${fmtDate(l.clientSince) || '—'}`}
          {l.servicesPlanned?.length ? ` · ${l.servicesPlanned.slice(0, 2).map(serviceLabel).join(', ')}${l.servicesPlanned.length > 2 ? ` +${l.servicesPlanned.length - 2}` : ''}` : ''}
          {ck.total ? ` · tasks ${ck.done}/${ck.total}` : ''}
        </div>
      </button>
    );
  };

  return (
    <>
      <aside className="aa-panel">
        <div className="aa-panel-head">
          <h2 className="aa-panel-title">Clients</h2>
          <div className="aa-panel-headbtns">
            <button type="button" className="aa-iconbtn" onClick={onRefresh} title="Refresh"><RefreshCw01 width={14} height={14} /></button>
            <button type="button" className="aa-btn aa-btn--primary" onClick={() => { setCreating(true); setSelId(null); onMobileOpen?.(); }}>
              <Plus width={14} height={14} /> Add client
            </button>
          </div>
        </div>

        <ScrollArea bare className="cl-list">
          {loading && !leads.length && <p className="cl-muted" style={{ padding: 12 }}>Loading…</p>}
          {!loading && !won.length && !clients.length && (
            <div className="cl-empty">
              <Trophy01 width={26} height={26} />
              <p className="cl-empty-title">No clients yet.</p>
              <p className="cl-muted">Win a booked meeting, or add an existing client directly with the button above.</p>
              {onGo && <button type="button" className="aa-btn" onClick={() => onGo('booked')}>Open Booked</button>}
            </div>
          )}
          {won.length > 0 && (
            <>
              <p className="cl-group">Awaiting first invoice · {won.length}</p>
              {won.map(l => <Card key={l._id} l={l} won />)}
            </>
          )}
          {clients.length > 0 && (
            <>
              <p className="cl-group">Clients · {clients.length}</p>
              {clients.map(l => <Card key={l._id} l={l} />)}
            </>
          )}
        </ScrollArea>
      </aside>

      <main className="aa-main cl-main">
        {creating ? (
          <ScrollArea bare className="cl-scroll">
            <div className="cl-detail lay-content lay-content--wide">
              <div className="cl-top">
                <button type="button" className="cl-back" onClick={back}><ArrowLeft width={15} height={15} /> Clients</button>
              </div>
              <Block title="Add client">
                <p className="cl-muted">For clients you already have — they skip the pipeline and land straight in this list.</p>
                <ClientForm
                  creating
                  onSave={async (f) => {
                    await onCreate({
                      ...f,
                      priority: 'warm',
                      stage: 'client',
                      clientSince: new Date().toISOString(),
                    });
                    back();
                  }}
                  onCancel={back}
                />
              </Block>
            </div>
          </ScrollArea>
        ) : selVisible ? (
          <ClientDetail
            lead={sel} submissions={submissions}
            onPatch={onPatch} onDelete={onDelete} onLinkSubmission={onLinkSubmission} onClose={back}
          />
        ) : (
          <div className="aa-main-empty">
            <Briefcase01 width={34} height={34} />
            <p>Pick a client — what they paid for, contact history, checklists, and their submissions all live here.</p>
          </div>
        )}
      </main>

      <style>{clStyles}</style>
    </>
  );
}

/* ── Styles ────────────────────────────────────────────────────── */

const clStyles = `
  .cl-muted { color: var(--a-muted); font-size: 0.82rem; line-height: 1.55; }
  .cl-group { font-size: 0.64rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--a-muted); margin: 6px 2px 0; }
  .cl-list.lay-scroll { padding: 0 0 12px; display: flex; flex-direction: column; gap: 7px; }
  .cl-card {
    display: flex; flex-direction: column; gap: 6px; text-align: left;
    padding: 12px 14px; border-radius: 12px; cursor: pointer;
    background: var(--a-card); border: 1px solid var(--a-border);
    font-family: inherit; color: inherit; transition: border-color 0.15s;
  }
  .cl-card:hover { border-color: rgba(212,76,67,0.4); }
  .cl-card.is-sel { border-color: var(--a-brand); }
  .cl-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .cl-card-name { font-size: 0.9rem; font-weight: 800; letter-spacing: -0.01em; min-width: 0; }
  .cl-card-mid { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .cl-card-paid { font-size: 0.74rem; font-weight: 800; color: #22c55e; }
  .cl-card-sub { font-size: 0.7rem; color: var(--a-muted); }
  .cl-tag {
    display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
    font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  }
  .cl-tag--won { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.35); }
  .cl-tag--client { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.35); }
  .cl-touch {
    font-size: 0.64rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;
    padding: 3px 9px; border-radius: 999px; white-space: nowrap;
    background: rgba(255,255,255,0.06); color: var(--a-sec); border: 1px solid var(--a-border);
  }
  .cl-touch--stale { background: rgba(245,158,11,0.12); color: #fbbf24; border-color: rgba(245,158,11,0.4); }
  .cl-touch--never { color: var(--a-muted); }
  .cl-empty { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 32px 14px; text-align: center; color: var(--a-muted); }
  .cl-empty-title { font-weight: 800; color: #fafafa; }

  .cl-main { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  @media (max-width: 760px) {
    .aa-app.has-detail .aa-main.cl-main { display: flex; flex-direction: column; }
  }
  .cl-scroll { display: flex; flex-direction: column; }
  .cl-detail { --v-stack-gap: 16px; }
  @media (min-width: 1200px) { .cl-detail.lay-content--wide { max-width: 1320px; } }
  .cl-cols, .cl-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  @media (min-width: 1200px) {
    .cl-cols { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 20px; align-items: start; }
  }

  .cl-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .cl-top-spacer { flex: 1; }
  .cl-back {
    display: inline-flex; align-items: center; gap: 7px;
    background: none; border: none; color: var(--a-muted); cursor: pointer;
    font-size: 0.85rem; font-weight: 600; font-family: inherit; padding: 0;
  }
  .cl-back:hover { color: #fafafa; }
  .cl-head { display: flex; flex-direction: column; gap: 6px; }
  .cl-head-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .cl-meta-txt { font-size: 0.72rem; font-weight: 600; color: var(--a-muted); }
  .cl-biz {
    font-family: 'Barlow Condensed', 'Inter', sans-serif; text-transform: uppercase;
    font-size: clamp(1.9rem, 6vw, 2.8rem); line-height: 0.95; font-weight: 700;
  }
  .cl-askfor { font-size: 0.92rem; font-weight: 600; color: var(--a-sec); }
  .cl-phone {
    display: inline-flex; align-items: center; gap: 10px; align-self: flex-start; max-width: 100%;
    padding: 11px 16px; border-radius: 12px; text-decoration: none;
    background: var(--a-brand); border: 1px solid var(--a-brand); color: #fff;
    font-size: 1rem; font-weight: 800; transition: background 0.15s;
  }
  .cl-phone:hover { background: #c2413a; }

  .cl-block {
    display: flex; flex-direction: column; gap: 12px; min-width: 0;
    background: var(--a-card); border: 1px solid var(--a-border);
    border-radius: 14px; padding: 15px 16px;
  }
  .cl-block > * { min-width: 0; }
  .cl-block-head h2 { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--a-sec); }
  .cl-svcs { display: flex; flex-wrap: wrap; gap: 7px; }
  .cl-svc {
    padding: 6px 12px; border-radius: 999px; font-size: 0.76rem; font-weight: 600;
    background: rgba(255,255,255,0.05); border: 1px solid var(--a-border); color: var(--a-sec);
  }
  .cl-price { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 10px; background: var(--a-raised); border: 1px solid var(--a-border); }
  .cl-price-top { display: flex; justify-content: space-between; gap: 10px; font-size: 0.86rem; }
  .cl-price-top strong { font-weight: 800; min-width: 0; overflow-wrap: anywhere; }
  .cl-price-top span { font-weight: 800; color: #fafafa; white-space: nowrap; }
  .cl-price-sub { font-size: 0.74rem; color: var(--a-muted); line-height: 1.5; overflow-wrap: anywhere; }
  .cl-notes { resize: vertical; min-height: 90px; line-height: 1.55; }
  .cl-block .aa-btn { align-self: flex-start; }
  .cl-demote {
    display: inline-flex; align-items: center; gap: 7px; align-self: flex-start;
    background: none; border: none; cursor: pointer; padding: 6px 2px;
    color: var(--a-muted); font-size: 0.74rem; font-weight: 700; font-family: inherit;
  }
  .cl-demote:hover { color: #fafafa; }

  /* Purchases ledger */
  .cl-pay { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .cl-pay-total { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .cl-pay-num {
    font-family: 'Barlow Condensed', 'Inter', sans-serif;
    font-size: 2.4rem; font-weight: 700; line-height: 1; color: #22c55e;
  }
  .cl-pay-lbl { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a-muted); }
  .cl-pay-row {
    display: flex; align-items: flex-start; gap: 10px; min-width: 0;
    padding: 10px 12px; border-radius: 11px;
    background: var(--a-raised); border: 1px solid var(--a-border);
  }
  .cl-pay-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .cl-pay-top { display: flex; justify-content: space-between; gap: 10px; font-size: 0.88rem; }
  .cl-pay-top strong { font-weight: 800; min-width: 0; overflow-wrap: anywhere; }
  .cl-pay-top span { font-weight: 800; color: #22c55e; white-space: nowrap; }
  .cl-pay-sub { font-size: 0.72rem; color: var(--a-muted); line-height: 1.5; overflow-wrap: anywhere; }
  .cl-pay-del {
    background: none; border: none; cursor: pointer; color: var(--a-muted);
    display: flex; padding: 6px; border-radius: 8px; flex-shrink: 0; margin-top: 2px;
  }
  .cl-pay-del:hover { color: #f87171; }
  .cl-pay-form { display: flex; flex-direction: column; gap: 12px; padding: 12px; border-radius: 12px; background: var(--a-raised); border: 1px dashed var(--a-border); }
  .cl-pay-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 560px) { .cl-pay-form-grid { grid-template-columns: 1fr; } .cl-span2 { grid-column: auto; } }
  .cl-span2 { grid-column: 1 / -1; }
  .cl-amt { display: flex; align-items: center; gap: 6px; font-weight: 800; color: var(--a-muted); }
  .cl-amt .aa-input { min-width: 0; }
  .cl-form-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

  /* Contact log */
  .cl-contact { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .cl-contact-form { display: flex; flex-direction: column; gap: 9px; }
  .cl-contact-types { display: flex; flex-wrap: wrap; gap: 7px; }
  .cl-ctype {
    display: inline-flex; align-items: center; gap: 7px; min-height: 40px;
    padding: 8px 14px; border-radius: 999px; cursor: pointer;
    background: rgba(255,255,255,0.04); border: 1px solid var(--a-border);
    color: var(--a-sec); font-size: 0.76rem; font-weight: 700; font-family: inherit;
    transition: color 0.15s, border-color 0.15s; touch-action: manipulation;
  }
  .cl-ctype:hover { color: #fafafa; }
  .cl-ctype.is-on { color: var(--a-brand); border-color: rgba(212,76,67,0.5); background: rgba(212,76,67,0.1); }
  .cl-contact-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .cl-contact-row .aa-input { flex: 1; min-width: 140px; }
  .cl-contact-date { flex: 0 1 150px; }
  .cl-contact-last { font-size: 0.84rem; color: var(--a-sec); }
  .cl-contact-last strong { color: #fafafa; }
  .cl-tl { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
  .cl-tl-type {
    flex-shrink: 0; min-width: 68px; text-align: center;
    font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 4px 9px; border-radius: 999px; margin-top: 1px;
    background: rgba(212,76,67,0.1); color: #e66b63; border: 1px solid rgba(212,76,67,0.35);
  }
  .cl-tl-type--console { background: rgba(255,255,255,0.05); color: var(--a-muted); border-color: var(--a-border); }
  .cl-tl-main { flex: 1; min-width: 0; }
  .cl-tl-top { font-size: 0.72rem; color: var(--a-muted); }
  .cl-tl-note { font-size: 0.84rem; color: #eaeaea; line-height: 1.5; overflow-wrap: anywhere; }

  .cl-form { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .cl-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 640px) { .cl-form-grid { grid-template-columns: 1fr; } }

  /* The scoring moment — first invoice paid */
  .cl-outbar.lay-footbar { flex-direction: row; }
  .cl-invoice {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; max-width: 520px; min-height: 52px;
    padding: 13px 20px; border-radius: 13px; cursor: pointer;
    background: var(--a-brand); border: 1px solid var(--a-brand); color: #fff;
    font-size: 0.95rem; font-weight: 800; font-family: inherit;
    box-shadow: 0 8px 28px rgba(212,76,67,0.32);
    transition: background 0.15s, transform 0.12s;
    touch-action: manipulation;
  }
  .cl-invoice:hover { background: #c2413a; }
  .cl-invoice:active { transform: scale(0.98); }
`;
