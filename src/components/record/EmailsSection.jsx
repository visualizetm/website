import { useCallback, useEffect, useState } from 'react';
import { ListRow, IconTile, Pill, Button, ErrorState } from '../../ui';
import EmailLogSheet from '../email/EmailLogSheet';
import EmptyLine from './EmptyLine';
import { apiFetch } from '../../shared/api';
import { COPY } from '../../shared/copy';
import { fmtDate, fmtDateTime, toMs } from '../../shared/dates';
import { statusOf, logTitle } from '../../lib/compose';

/* Emails (the email system, milestone 4): the record's log newest first (the
 * template and the subject, the status, when, who to), a row opens the exact
 * HTML in the shared sheet with Send again and Cancel send for a queued one.
 * A project's emails sit here too, named by the project. The summary reads
 * the record itself (its contact log carries one line per send), so the tab
 * and the phone row need no request. */
export const emailsSummary = (rec) => {
  const sent = (rec.lead.contactLog || []).filter(e => e && e.type === 'email').sort((a, b) => toMs(b.at) - toMs(a.at));
  if (!sent.length) return 'Nothing sent yet';
  return `${sent.length} sent · last: ${sent[0].note || 'an email'}, ${fmtDate(sent[0].at)}`;
};

export default function EmailsSection({ rec }) {
  const { lead, shell, readOnly, cw } = rec;
  const recordId = String(lead._id);
  const [state, setState] = useState({ items: null, error: false });
  const [open, setOpen] = useState(null);
  const load = useCallback(async () => {
    const r = await apiFetch(`/api/admin/email/log?recordId=${encodeURIComponent(recordId)}`);
    setState(s => (r.ok ? { items: r.data?.items || [], error: false } : { items: s.items, error: true }));
  }, [recordId]);
  useEffect(() => { load(); }, [load, lead.updatedAt]);
  const projectOf = (id) => (id ? (shell?.projects || []).find(p => String(p._id) === String(id)) || null : null);
  const compose = (opts = {}) => shell?.openCompose?.(lead, { project: cw?.current || null, ...opts });
  const E = COPY.empty['record.emails'];
  if (state.error && !state.items) return <ErrorState title={COPY.error.emails.title} description={COPY.error.emails.description} onRetry={load} />;
  if (!state.items) return <div className="rc-emails" aria-busy="true">{[1, 2].map(i => <ListRow.Skeleton key={i} />)}</div>;
  if (!state.items.length) return <EmptyLine text={E.title} action={!readOnly && shell?.openCompose ? { label: E.action, icon: 'Mail01', onClick: () => compose() } : null} className="rc-emails-empty" />;
  return (
    <div className="rc-emails">
      {state.items.map(e => {
        const st = statusOf(e.status); const p = projectOf(e.projectId);
        const when = e.status === 'queued' && e.sendAt ? `Goes out ${fmtDateTime(e.sendAt)}` : fmtDateTime(e.sentAt || e.createdAt);
        return <ListRow key={e._id} className="rc-email-row" data-email-id={e._id} leading={<IconTile icon="Mail01" tone="neutral" size="sm" glow={false} />} title={logTitle(e)} subtitle={`${when}${p ? ` · ${p.name}` : ''} · to ${(e.to || []).join(', ') || 'nobody yet'}`} meta={<Pill tone={st.tone} label={st.label} size="sm" icon={false} />} onClick={() => setOpen(e)} aria-label={`${logTitle(e)}, ${st.label}`} />;
      })}
      {!readOnly && shell?.openCompose && <div className="rc-emails-foot"><Button variant="ghost" size="md" icon="Mail01" onClick={() => compose()} className="rc-emails-new">New email</Button></div>}
      {open && (
        <EmailLogSheet item={open} onClose={() => setOpen(null)}
          onSendAgain={!readOnly && shell?.openCompose ? (e) => compose({ templateId: e.templateId, project: projectOf(e.projectId), invoice: e.invoiceId ? { id: e.invoiceId } : null }) : null}
          onChanged={(next) => setState(s => ({ ...s, items: (s.items || []).map(x => (String(x._id) === String(next._id) ? { ...x, ...next } : x)) }))} />
      )}
    </div>
  );
}
