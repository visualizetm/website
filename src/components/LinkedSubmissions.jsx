import { useMemo, useState } from 'react';
import Link01 from '@untitled-ui/icons-react/build/esm/Link01';
import LinkBroken01 from '@untitled-ui/icons-react/build/esm/LinkBroken01';
import { Stack, ListRow, Pill, Button, Collapsible, EmptyState } from '../ui';
import { SUBMISSION_TYPES } from '../shared/semantics';
import { fmtDate } from '../shared/dates';
import { last10 } from '../shared/phone';

/* The submissions story for one lead or client (kit build, Prompt 13): what
 * they sent through the site, linked explicitly (additive linkedLeadId on the
 * submission) with one tap suggestions matched on email, phone, or business. */
const lower = (v) => String(v ?? '').trim().toLowerCase();
const DASH = '\u2014'; // the old form stored this placeholder for a missing phone

/** Suggested matches for a lead: same email, same phone (normalized), or same business name, not linked to anyone else. */
export function suggestFor(lead, submissions) {
  const email = lower(lead.email || lead.afterCall?.email);
  const phone = last10(lead.phone);
  const biz = lower(lead.business);
  return submissions.filter(s => !s.linkedLeadId && ((email && lower(s.email) === email) || (phone && last10(s.phone) === phone) || (biz && lower(s.business) === biz)));
}

function SubRow({ sub, linked, onLink, onUnlink }) {
  const [open, setOpen] = useState(false);
  const fields = Object.entries(sub.fields || {});
  return (
    <div className={`ls-row${linked ? '' : ' ls-row--suggest'}`}>
      <ListRow leading={<Pill id={sub.type} list={SUBMISSION_TYPES} size="sm" variant="outline" />} title={sub.business || sub.name} subtitle={fmtDate(sub.createdAt)} onClick={() => setOpen(v => !v)} aria-expanded={open}
        trailing={linked ? <Button variant="ghost" size="md" icon={LinkBroken01} onClick={(e) => { e.stopPropagation(); onUnlink(); }}>Unlink</Button> : <Button variant="secondary" size="md" icon={Link01} onClick={(e) => { e.stopPropagation(); onLink(); }}>Link</Button>} chevron={false} className="ls-main" />
      <Collapsible open={open}>
        <Stack gap={1} className="ls-detail">
          {sub.email && <p><strong>Email</strong>{sub.email}</p>}
          {sub.phone && sub.phone !== DASH && <p><strong>Phone</strong>{sub.phone}</p>}
          {fields.map(([k, v]) => <p key={k}><strong>{k}</strong>{String(v)}</p>)}
          {sub.notes && <p><strong>Your notes</strong>{sub.notes}</p>}
        </Stack>
      </Collapsible>
    </div>
  );
}

export default function LinkedSubmissions({ lead, submissions, onLinkSubmission }) {
  const linked = useMemo(() => submissions.filter(s => s.linkedLeadId === lead._id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [submissions, lead._id]);
  const suggested = useMemo(() => suggestFor(lead, submissions), [lead, submissions]);
  if (!linked.length && !suggested.length) return <EmptyState size="sm" icon="Inbox01" title="No site submissions from them yet" description="When one matches their email, phone, or business name it shows up here to link." />;
  return (
    <Stack gap={2} className="ls-wrap">
      {linked.map(s => <SubRow key={s._id} sub={s} linked onUnlink={() => onLinkSubmission(s._id, '')} />)}
      {suggested.length > 0 && <><p className="ls-label">Looks like theirs. Link it?</p>{suggested.map(s => <SubRow key={s._id} sub={s} linked={false} onLink={() => onLinkSubmission(s._id, lead._id)} />)}</>}
      <style>{lsStyles}</style>
    </Stack>
  );
}

const lsStyles = `
  .ls-wrap { min-width: 0; }
  .ls-row { display: flex; flex-direction: column; min-width: 0; }
  .ls-row--suggest .ls-main { border-style: dashed; }
  .ls-main .v-lrow-side { flex-shrink: 0; }
  .ls-detail { padding: var(--v-space-2) var(--v-space-3) var(--v-space-3); }
  .ls-detail p { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  .ls-detail strong { display: block; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .ls-label { margin: var(--v-space-1) 0 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
`;
