import { useMemo, useState } from 'react';
import Link01 from '@untitled-ui/icons-react/build/esm/Link01';
import LinkBroken01 from '@untitled-ui/icons-react/build/esm/LinkBroken01';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import Inbox01 from '@untitled-ui/icons-react/build/esm/Inbox01';
import { last10 } from '../shared/phone';

const TYPE_LABELS = { start: 'Project brief', 'shop-order': 'Shop order', contact: 'Contact', other: 'Submission' };
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return String(iso); }
};
const lower = (v) => String(v ?? '').trim().toLowerCase();

/** Suggested matches for a lead: same email, same phone (normalized), or
 *  same business name — and not already linked to someone else. */
export function suggestFor(lead, submissions) {
  const email = lower(lead.email || lead.afterCall?.email);
  const phone = last10(lead.phone);
  const biz = lower(lead.business);
  return submissions.filter(s => {
    if (s.linkedLeadId) return false;
    return (email && lower(s.email) === email)
      || (phone && last10(s.phone) === phone)
      || (biz && lower(s.business) === biz);
  });
}

function SubRow({ sub, linked, onLink, onUnlink }) {
  const [open, setOpen] = useState(false);
  const fields = Object.entries(sub.fields || {});
  return (
    <div className={`ls-row${linked ? '' : ' ls-row--suggest'}`}>
      <button type="button" className="ls-main" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="ls-type">{TYPE_LABELS[sub.type] || sub.type}</span>
        <span className="ls-name">{sub.business || sub.name}</span>
        <span className="ls-date">{fmtDate(sub.createdAt)}</span>
        <ChevronDown width={14} height={14} className={`ls-chev${open ? ' is-open' : ''}`} />
      </button>
      {open && (
        <div className="ls-detail">
          {sub.email && <p><strong>Email</strong> {sub.email}</p>}
          {sub.phone && sub.phone !== '—' && <p><strong>Phone</strong> {sub.phone}</p>}
          {fields.map(([k, v]) => <p key={k}><strong>{k}</strong> {String(v)}</p>)}
          {sub.notes && <p><strong>Your notes</strong> {sub.notes}</p>}
        </div>
      )}
      {linked ? (
        <button type="button" className="ls-act" onClick={onUnlink} title="Unlink from this lead">
          <LinkBroken01 width={14} height={14} /> Unlink
        </button>
      ) : (
        <button type="button" className="ls-act ls-act--link" onClick={onLink} title="Link to this lead">
          <Link01 width={14} height={14} /> Link
        </button>
      )}
    </div>
  );
}

/* The submissions story for one lead/client: what they sent through the
 * site, linked explicitly (additive linkedLeadId on the submission) with
 * one-tap suggestions matched on email / normalized phone / business. */
export default function LinkedSubmissions({ lead, submissions, onLinkSubmission }) {
  const linked = useMemo(
    () => submissions.filter(s => s.linkedLeadId === lead._id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [submissions, lead._id]
  );
  const suggested = useMemo(() => suggestFor(lead, submissions), [lead, submissions]);

  if (!linked.length && !suggested.length) {
    return (
      <div className="ls-empty">
        <Inbox01 width={18} height={18} />
        <p>No site submissions from them yet. When one matches their email, phone, or business name it shows up here to link.</p>
        <style>{lsStyles}</style>
      </div>
    );
  }

  return (
    <div className="ls-wrap">
      {linked.map(s => (
        <SubRow key={s._id} sub={s} linked onUnlink={() => onLinkSubmission(s._id, '')} />
      ))}
      {suggested.length > 0 && (
        <>
          <p className="ls-label">Looks like theirs — link it?</p>
          {suggested.map(s => (
            <SubRow key={s._id} sub={s} linked={false} onLink={() => onLinkSubmission(s._id, lead._id)} />
          ))}
        </>
      )}
      <style>{lsStyles}</style>
    </div>
  );
}

const lsStyles = `
  .ls-wrap { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .ls-row {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 10px;
    background: var(--v-surface-2); border: 1px solid var(--v-border);
    border-radius: 11px; padding: 4px 10px 4px 4px; min-width: 0;
  }
  .ls-row--suggest { border-style: dashed; }
  .ls-main {
    display: flex; align-items: center; gap: 10px; min-width: 0; text-align: left;
    background: none; border: none; cursor: pointer; color: inherit; font-family: inherit;
    padding: 9px 6px; touch-action: manipulation;
  }
  .ls-type {
    flex-shrink: 0; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase;
    color: var(--v-text-3); background: rgba(255,255,255,0.06);
    padding: 3px 8px; border-radius: 999px;
  }
  .ls-name { flex: 1; min-width: 0; font-size: 0.84rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ls-date { flex-shrink: 0; font-size: 0.7rem; color: var(--v-text-3); }
  .ls-chev { flex-shrink: 0; color: var(--v-text-3); transition: transform 0.2s; }
  .ls-chev.is-open { transform: rotate(180deg); }
  .ls-act {
    display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
    padding: 7px 12px; border-radius: 9px; cursor: pointer;
    background: rgba(255,255,255,0.05); border: 1px solid var(--v-border);
    color: var(--v-text-2); font-size: 0.72rem; font-weight: 700; font-family: inherit;
    touch-action: manipulation; white-space: nowrap;
  }
  .ls-act:hover { color: var(--v-text); background: rgba(255,255,255,0.1); }
  .ls-act--link { border-color: rgba(212,76,67,0.4); color: var(--v-red-highlight); }
  .ls-act--link:hover { background: rgba(212,76,67,0.12); color: var(--v-red-highlight); }
  .ls-detail {
    grid-column: 1 / -1; min-width: 0;
    padding: 2px 6px 10px; display: flex; flex-direction: column; gap: 6px;
  }
  .ls-detail p { font-size: 0.82rem; line-height: 1.5; color: var(--v-text-2); overflow-wrap: anywhere; margin: 0; }
  .ls-detail strong {
    display: block; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--v-text-3);
  }
  .ls-label { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.11em; text-transform: uppercase; color: var(--v-text-3); margin: 4px 0 0; }
  .ls-empty { display: flex; flex-direction: column; gap: 8px; color: var(--v-text-3); font-size: 0.82rem; line-height: 1.55; }
  .ls-empty p { margin: 0; }
`;
