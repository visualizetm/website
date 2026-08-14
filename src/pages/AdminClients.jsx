import { useState, useMemo } from 'react';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import CurrencyDollarCircle from '@untitled-ui/icons-react/build/esm/CurrencyDollarCircle';
import Briefcase01 from '@untitled-ui/icons-react/build/esm/Briefcase01';
import Trophy01 from '@untitled-ui/icons-react/build/esm/Trophy01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import FlipBackward from '@untitled-ui/icons-react/build/esm/FlipBackward';
import { ScrollArea, StickyFooterBar } from '../components/AdminLayout';
import { SocialButtons } from '../components/SocialLinks';
import Checklists from '../components/Checklists';
import LinkedSubmissions from '../components/LinkedSubmissions';
import { formatPhone } from '../lib/phone';
import { effectiveStage, serviceLabel, planLabel, monthlyOf, checklistProgress } from '../lib/booked';

const telOf = (lead) => lead?.phone ? `tel:${lead.phone.replace(/[^0-9+]/g, '')}` : null;
const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

function Block({ title, children, action }) {
  return (
    <section className="cl-block">
      <div className="cl-block-head"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}

function ClientDetail({ lead, submissions, onPatch, onLinkSubmission, onClose }) {
  const stage = effectiveStage(lead);
  const isClient = stage === 'client';
  const [notes, setNotes] = useState(lead.notes || '');
  const [notesState, setNotesState] = useState('idle');

  const firstInvoicePaid = () => onPatch(lead._id, {
    stage: 'client',
    clientSince: new Date().toISOString(),
  });
  const backToBooked = () => {
    if (window.confirm(`Move ${lead.business} back to Booked?`)) onPatch(lead._id, { stage: 'booked' });
  };
  const saveNotes = async () => {
    setNotesState('saving');
    const ok = await onPatch(lead._id, { notes });
    setNotesState(ok ? 'idle' : 'dirty');
  };

  return (
    <>
      <ScrollArea bare className="cl-scroll" key={lead._id}>
        <div className="cl-detail lay-content lay-content--wide">
          <div className="cl-top">
            <button type="button" className="cl-back" onClick={onClose}><ArrowLeft width={15} height={15} /> Clients</button>
            <span className="cl-top-spacer" />
            {isClient
              ? <span className="cl-tag cl-tag--client"><Briefcase01 width={13} height={13} /> Client since {fmtDate(lead.clientSince) || '—'}</span>
              : <span className="cl-tag cl-tag--won"><Trophy01 width={13} height={13} /> Won — awaiting first invoice</span>}
          </div>

          <header className="cl-head">
            <div className="cl-head-meta">
              {lead.industry && <span className="cl-meta-txt">{lead.industry}</span>}
              {lead.area && <span className="cl-meta-txt">{lead.area}</span>}
            </div>
            <h1 className="cl-biz display">{lead.business}</h1>
            {lead.askFor && <p className="cl-askfor">{lead.askFor.replace(/^Ask for /i, '')}</p>}
          </header>

          {telOf(lead) && (
            <a href={telOf(lead)} className="cl-phone">
              <PhoneCall01 width={18} height={18} />
              <span>{formatPhone(lead.phone)}</span>
            </a>
          )}
          <SocialButtons socials={lead.socials} />

          <div className="cl-cols">
            <div className="cl-col">
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
                        <span>${Number(o.price || 0).toLocaleString()}{o.plan !== 'full' && monthlyOf(o.price, o.plan) ? ` · $${monthlyOf(o.price, o.plan)}/mo` : ''}</span>
                      </p>
                      <p className="cl-price-sub">{planLabel(o.plan)}{o.retainer ? ` · Retainer: ${o.retainer}` : ''}</p>
                    </div>
                  ))}
                </Block>
              )}
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
              <Block title="Their site submissions">
                <LinkedSubmissions lead={lead} submissions={submissions} onLinkSubmission={onLinkSubmission} />
              </Block>
            </div>
          </div>
        </div>
      </ScrollArea>

      {!isClient && (
        <StickyFooterBar className="cl-outbar">
          <button type="button" className="cl-invoice" onClick={firstInvoicePaid}>
            <CurrencyDollarCircle width={19} height={19} /> First invoice paid — make them a client
          </button>
        </StickyFooterBar>
      )}
    </>
  );
}

/* ── Page: won (awaiting first invoice) + paying clients ───────── */

export default function AdminClients({
  leads, submissions, loading, onPatch, onRefresh, onLinkSubmission,
  onMobileOpen, onMobileClose, onGo,
}) {
  const [selId, setSelId] = useState(null);

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
  const pick = (id) => { setSelId(id); onMobileOpen?.(); };
  const back = () => { setSelId(null); onMobileClose?.(); };

  const Card = ({ l, won: isWon }) => {
    const ck = checklistProgress(l);
    return (
      <button type="button" className={`cl-card lay-card${sel?._id === l._id ? ' is-sel' : ''}`} onClick={() => pick(l._id)}>
        <div className="cl-card-top">
          <span className="cl-card-name lay-truncate">{l.business}</span>
          {isWon
            ? <span className="cl-tag cl-tag--won">Awaiting invoice</span>
            : <span className="cl-tag cl-tag--client">Client</span>}
        </div>
        <div className="cl-card-sub lay-truncate">
          {isWon
            ? `Won ${fmtDate(l.bookedOutcome?.at) || 'recently'}`
            : `Since ${fmtDate(l.clientSince) || '—'}`}
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
          <button type="button" className="aa-iconbtn" onClick={onRefresh} title="Refresh"><RefreshCw01 width={14} height={14} /></button>
        </div>

        <ScrollArea bare className="cl-list">
          {loading && !leads.length && <p className="cl-muted" style={{ padding: 12 }}>Loading…</p>}
          {!loading && !won.length && !clients.length && (
            <div className="cl-empty">
              <Trophy01 width={26} height={26} />
              <p className="cl-empty-title">No clients yet.</p>
              <p className="cl-muted">Win a booked meeting and they land here — then one tap on &ldquo;First invoice paid&rdquo; makes it official.</p>
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
        {selVisible ? (
          <ClientDetail
            lead={sel} submissions={submissions}
            onPatch={onPatch} onLinkSubmission={onLinkSubmission} onClose={back}
          />
        ) : (
          <div className="aa-main-empty">
            <Briefcase01 width={34} height={34} />
            <p>Pick a client — services sold, project checklists, their submissions, and notes all live here.</p>
          </div>
        )}
      </main>

      <style>{clStyles}</style>
    </>
  );
}

const clStyles = `
  .cl-muted { color: var(--a-muted); font-size: 0.82rem; line-height: 1.55; }
  .cl-group { font-size: 0.64rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--a-muted); margin: 6px 2px 0; }
  .cl-list.lay-scroll { padding: 0 0 12px; display: flex; flex-direction: column; gap: 7px; }
  .cl-card {
    display: flex; flex-direction: column; gap: 5px; text-align: left;
    padding: 12px 14px; border-radius: 12px; cursor: pointer;
    background: var(--a-card); border: 1px solid var(--a-border);
    font-family: inherit; color: inherit; transition: border-color 0.15s;
  }
  .cl-card:hover { border-color: rgba(212,76,67,0.4); }
  .cl-card.is-sel { border-color: var(--a-brand); }
  .cl-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .cl-card-name { font-size: 0.9rem; font-weight: 800; letter-spacing: -0.01em; min-width: 0; }
  .cl-card-sub { font-size: 0.7rem; color: var(--a-muted); }
  .cl-tag {
    display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
    font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  }
  .cl-tag--won { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.35); }
  .cl-tag--client { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.35); }
  .cl-empty { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 32px 14px; text-align: center; color: var(--a-muted); }
  .cl-empty-title { font-weight: 800; color: #fafafa; }

  .cl-main { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  @media (max-width: 760px) {
    .aa-app.has-detail .aa-main.cl-main { display: flex; flex-direction: column; }
  }
  .cl-scroll { display: flex; flex-direction: column; }
  .cl-detail { --lay-stack-gap: 16px; }
  @media (min-width: 1200px) { .cl-detail.lay-content--wide { max-width: 1320px; } }
  .cl-cols, .cl-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  @media (min-width: 1200px) {
    .cl-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
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
  .cl-head-meta { display: flex; gap: 10px; flex-wrap: wrap; }
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
