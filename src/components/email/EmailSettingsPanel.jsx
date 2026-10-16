import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Stack, Row, Button, Pill, IconTile, InlineEdit, Textarea, ListRow, Sheet, SegmentedControl, Toggle, EmptyState, ErrorState, SkeletonBlock, SkeletonText, Stagger, useConfirm, useToast } from '../../ui';
import EmailLogSheet from './EmailLogSheet';
import LeadPicker from '../LeadPicker';
import { apiFetch } from '../../shared/api';
import { COPY } from '../../shared/copy';
import { fmtDateTime } from '../../shared/dates';
import { useShell } from '../../shell/ShellContext';
import { EMAIL_TEMPLATES, TEMPLATE_GROUPS, AUTOMATION_OPTIONS } from '../../shared/emailTemplates';
import { statusOf, logTitle, templateName } from '../../lib/compose';

/* Settings, Emails (the email system, milestone 4): the connection (with the
 * Runbook steps while the key is missing), the sender, the invoice terms by
 * kind, the templates (a row opens its sheet: the Automation control for a
 * template with a rule, Edit in Compose's template mode on a record to
 * preview with, Send test to me, Reset to default) and Recent sends (the
 * last fifty, failures first, each opening the shared sent email sheet). */
const INVOICE_KINDS = [['deposit', 'Deposit'], ['final', 'Final'], ['plan', 'Plan'], ['retainer', 'Retainer'], ['custom', 'Custom']];
const hasRule = (t) => !!t.autoDefault && t.autoDefault !== 'off';

function TermsField({ kind, label, lines, onSave }) {
  const joined = lines.join('\n');
  const [text, setText] = useState(joined);
  useEffect(() => { setText(joined); }, [joined]);
  return <Textarea label={label} value={text} rows={3} onChange={(e) => setText(e.target.value.slice(0, 2400))} onBlur={() => { if (text !== joined) onSave(text); }} placeholder="One line per term" className={`es-terms es-terms--${kind}`} />;
}

export default function EmailSettingsPanel({ leads = [] }) {
  const shell = useShell();
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(false);
  const [tpl, setTpl] = useState(null);
  const [openLog, setOpenLog] = useState(null);
  const [picking, setPicking] = useState(false);
  const [previewLead, setPreviewLead] = useState(null);
  const [testing, setTesting] = useState('');
  const load = useCallback(async () => {
    const [s, st, r] = await Promise.all([apiFetch('/api/admin/email/settings'), apiFetch('/api/admin/email/status'), apiFetch('/api/admin/email/log?recent=1')]);
    if (!s.ok) { setError(true); return; }
    setError(false); setData(s.data); setStatus(st.ok ? st.data : null); setRecent(r.ok ? (r.data?.items || []) : []);
  }, []);
  useEffect(() => { load(); }, [load]);
  /* The record every template previews and tests with: the newest lead with an address, or the one picked here. */
  const sample = useMemo(() => previewLead || [...leads].filter(l => l && l.email && !l.deleted).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null, [leads, previewLead]);
  const put = async (body, okMsg) => {
    const r = await apiFetch('/api/admin/email/settings', { method: 'PUT', body });
    if (!r.ok) { toast.error(r.data?.error || COPY.error.save); return false; }
    setData(d => ({ ...d, settings: r.data.settings }));
    if (okMsg) toast.success(okMsg);
    return true;
  };
  const s = data?.settings || {};
  const sender = s.sender || {};
  const terms = s.invoiceTerms || {};
  const automation = s.automation || {};
  const edited = (id) => !!(s.templates && s.templates[id]);
  const autoOf = (t) => automation[t.id] || t.autoDefault || 'off';
  const reset = async (id) => {
    if (!(await confirm({ title: `Reset ${templateName(id).toLowerCase()} to the default?`, body: 'Your edits to this template go. Every record gets the default again.', confirmLabel: 'Reset', danger: true }))) return;
    if (await put({ templates: { [id]: null } }, 'Back to the default.')) setTpl(null);
  };
  const test = async (id) => {
    if (!sample) { toast.error('Pick a record with an email to preview with first.'); return; }
    setTesting(id);
    const r = await apiFetch('/api/admin/email/send', { method: 'POST', body: { templateId: id, recordId: String(sample._id), testToSelf: true } });
    setTesting('');
    if (!r.ok) { toast.error(r.data?.error || 'The test did not go out.'); return; }
    toast.success(r.data?.message || 'Test sent.');
  };
  const edit = (id) => { if (!sample) { toast.error('Pick a record with an email to preview with first.'); return; } setTpl(null); shell?.openCompose?.(sample, { templateId: id, mode: 'template' }); };
  const leadOf = (id) => leads.find(l => String(l._id) === String(id)) || null;
  const projectOf = (id) => (id ? (shell?.projects || []).find(p => String(p._id) === String(id)) || null : null);
  const E = COPY.empty['settings.emails.recent'];

  if (error && !data) return <Card><ErrorState title={COPY.error.settings.title} description={COPY.error.settings.description} onRetry={load} /></Card>;
  if (!data) {
    return (
      <Stack gap={3} className="st-stack" aria-busy="true">
        <Card className="st-card" style={{ minHeight: 96 }}><SkeletonBlock width={160} height={12} /><SkeletonText lines={2} /></Card>
        {[1, 2, 3, 4].map(i => <Card key={i} className="st-card"><SkeletonBlock width={160} height={12} /><SkeletonText lines={3} /><SkeletonBlock height={44} radius="var(--v-radius-md)" /></Card>)}
      </Stack>
    );
  }
  const connected = !!data.connected;
  const current = tpl ? EMAIL_TEMPLATES.find(t => t.id === tpl) : null;
  return (
    <Stagger className="v-stack st-stack es">
      <Card className="st-card st-integration" data-card="email-connection">
        <Row gap={3} align="start"><IconTile icon="Mail01" tone={connected ? 'booked' : 'neutral'} size="md" /><Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
          <Row gap={2} align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>Connection</p><Pill tone={connected ? 'booked' : 'new'} label={connected ? 'Connected' : 'Not connected yet'} size="sm" icon={connected ? 'CheckCircle' : 'AlertTriangle'} /></Row>
          <p className="dt-muted">{connected ? `Sending as ${status?.from || `${sender.name} <${sender.address}>`}. ${status?.sentLastHour || 0} of ${status?.limit || 30} sent this hour.` : 'Emails are test only: every send is logged and stamps the record, nothing leaves. To connect, add RESEND_API_KEY in Vercel, verify visualizeclients.com in Resend and redeploy. The Runbook has the steps under Email.'}</p>
        </Stack></Row>
      </Card>
      <Card className="st-card" data-card="email-sender">
        <p className="pb-card-h">Sender</p>
        <Stack gap={2}>
          <div className="v-field"><span className="v-field-label">From name</span><InlineEdit value={sender.name || ''} onSave={(v) => put({ sender: { name: v.trim() } })} label="From name" className="es-sender-name" /></div>
          <div className="v-field"><span className="v-field-label">From address</span><InlineEdit value={sender.address || ''} onSave={(v) => put({ sender: { address: v.trim() } })} label="From address" type="email" inputMode="email" className="es-sender-address" /></div>
          <div className="v-field"><span className="v-field-label">Reply to</span><InlineEdit value={sender.replyTo || ''} onSave={(v) => put({ sender: { replyTo: v.trim() } })} label="Reply to" type="email" inputMode="email" className="es-sender-reply" /></div>
          <div className="v-field"><span className="v-field-label">Signature name</span><InlineEdit value={s.signatureName || 'Rob'} onSave={(v) => put({ signatureName: v.trim() })} label="Signature name" className="es-signature" /></div>
          <div className="v-field"><span className="v-field-label">Calendly link</span><InlineEdit value={s.calendlyLink || ''} onSave={(v) => put({ calendlyLink: v.trim() })} placeholder="Falls back to the profile's link" label="Calendly link" type="url" className="es-calendly" /></div>
        </Stack>
      </Card>
      <Card className="st-card" data-card="email-terms">
        <p className="pb-card-h">Invoice terms</p>
        <p className="dt-muted">One line each, by the kind of invoice. They print in the box under the pay buttons.</p>
        <Stack gap={2}>{INVOICE_KINDS.map(([k, label]) => <TermsField key={k} kind={k} label={label} lines={Array.isArray(terms[k]) ? terms[k] : []} onSave={(text) => put({ invoiceTerms: { [k]: text.split('\n').map(x => x.trim()).filter(Boolean) } })} />)}</Stack>
      </Card>
      <Card className="st-card" data-card="email-templates">
        <p className="pb-card-h">Templates</p>
        <Row gap={2} align="center" wrap><p className="dt-muted" style={{ margin: 0 }}>{sample ? `Previewing and testing with ${sample.business}.` : 'No record with an email to preview with yet.'}</p><Button variant="ghost" size="md" onClick={() => setPicking(true)} className="es-pick">Change</Button></Row>
        <Stack gap={3}>
          {TEMPLATE_GROUPS.map(g => {
            const rows = EMAIL_TEMPLATES.filter(t => t.group === g.id);
            if (!rows.length) return null;
            return (
              <Stack key={g.id} gap={1} role="group" aria-label={g.label}>
                <span className="es-group-h">{g.label}</span>
                {rows.map(t => <ListRow key={t.id} className="es-tpl-row" title={t.name} subtitle={t.when} meta={[edited(t.id) ? 'Edited' : '', hasRule(t) && autoOf(t) !== 'off' ? AUTOMATION_OPTIONS.find(o => o.id === autoOf(t))?.label : ''].filter(Boolean).join(' · ')} onClick={() => setTpl(t.id)} aria-haspopup="dialog" />)}
              </Stack>
            );
          })}
        </Stack>
      </Card>
      <Card className="st-card" data-card="email-recent">
        <p className="pb-card-h">Recent sends</p>
        {recent === null ? <Stack gap={2} aria-busy="true">{[1, 2, 3].map(i => <ListRow.Skeleton key={i} />)}</Stack>
          : !recent.length ? <EmptyState icon="Mail01" title={E.title} description={E.description} action={{ label: E.action, onClick: () => shell?.go?.('leads') }} />
            : <Stack gap={1}>{recent.map(e => { const st = statusOf(e.status); const l = leadOf(e.recordId); return <ListRow key={e._id} className="es-log-row" title={logTitle(e)} subtitle={`${l?.business || 'A record'} · ${fmtDateTime(e.sentAt || e.createdAt)} · to ${(e.to || []).join(', ') || 'nobody yet'}`} meta={<Pill tone={st.tone} label={st.label} size="sm" icon={false} />} onClick={() => setOpenLog(e)} aria-label={`${logTitle(e)}, ${st.label}`} />; })}</Stack>}
      </Card>
      {current && (
        <Sheet open onClose={() => setTpl(null)} title={current.name} label={`${current.name} template`} description={current.when} width={480} className="es-tpl-sheet"
          footer={<><Button variant="ghost" onClick={() => setTpl(null)}>Close</Button><Button icon="Edit02" onClick={() => edit(current.id)} className="es-tpl-edit">Edit</Button></>}>
          <Stack gap={3}>
            <Row gap={2} align="center" wrap><Pill tone={current.class === 'marketing' ? 'new' : 'neutral'} label={current.class === 'marketing' ? 'Marketing' : 'Transactional'} size="sm" icon={false} variant="outline" />{edited(current.id) && <Pill tone="progress" label="Edited" size="sm" icon={false} />}</Row>
            {hasRule(current) ? (
              <div className="v-field"><span className="v-field-label">Automation</span><SegmentedControl label={`${current.name} automation`} options={AUTOMATION_OPTIONS} value={autoOf(current)} onChange={(v) => put({ automation: { [current.id]: v } })} full className="es-auto" /><p className="dt-muted">Draft for me saves the email and puts it in Next up. Send for me sends it after every guard.</p></div>
            ) : <p className="dt-muted">Sent by hand from a record. Nothing goes out on its own.</p>}
            {Array.isArray(current.options) && current.options.map(op => <Toggle key={op.id} label={op.label} checked={!!s.templates?.[current.id]?.options?.[op.id]} onChange={(v) => put({ templates: { [current.id]: { options: { [op.id]: v } } } })} className={`es-opt es-opt--${op.id}`} />)}
            <Row gap={2} wrap>
              <Button variant="secondary" size="md" icon="Send01" loading={testing === current.id} onClick={() => test(current.id)} className="es-tpl-test">Send test to me</Button>
              <Button variant="ghost" size="md" icon="ReverseLeft" disabled={!edited(current.id)} onClick={() => reset(current.id)} className="es-tpl-reset">Reset to default</Button>
            </Row>
          </Stack>
        </Sheet>
      )}
      {picking && <LeadPicker leads={leads.filter(l => l && l.email && !l.deleted)} onPick={(l) => { setPreviewLead(l); setPicking(false); }} onClose={() => setPicking(false)} title="Preview with" description="The record every template previews and tests with." />}
      {openLog && (
        <EmailLogSheet item={openLog} onClose={() => setOpenLog(null)}
          onSendAgain={(e) => { const l = leadOf(e.recordId); if (l) shell?.openCompose?.(l, { templateId: e.templateId, project: projectOf(e.projectId), invoice: e.invoiceId ? { id: e.invoiceId } : null }); }}
          onChanged={(next) => setRecent(list => (list || []).map(x => (String(x._id) === String(next._id) ? { ...x, ...next } : x)))} />
      )}
      {confirmDialog}
      <style>{esStyles}</style>
    </Stagger>
  );
}
const esStyles = `
  .es-group-h { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); padding: var(--v-space-1) 0; }
  .es-terms .v-field-control { min-height: 72px; }
`;
