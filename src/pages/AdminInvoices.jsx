import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageShell, ScrollArea, Section, Stack, Row, Card, Button, Chip, Pill, ListRow, EmptyState, ErrorState, SwipeRow, Stagger, useToast, useMediaQuery } from '../ui';
import { COPY } from '../shared/copy';
import { apiFetch } from '../shared/api';
import { fmtDate } from '../shared/dates';
import { useShell, useTopBar } from '../shell/ShellContext';
import { money } from '../lib/projects';
import { INVOICE_STATUS_LABELS, nextUnpaidInvoice, replaceInvoice, invoicesOf } from '../lib/invoices';
import { INVOICE_CHIPS, CHIP_IDS, invoiceRows, invoiceSections, chipRows, chipCount, owedTotal, paidByHand } from '../lib/invoiceList';

/* Invoices (prompt 3 of 3, milestone 1), /invoices: every invoice across projects, deals, plans and retainers in one list, a view over
 * what exists (no collection of its own). Sections: Past due (longest late first, days late, reminded N times), Due soon, Plans (month N
 * of M, ends, stops after month M), Retainers, Paid last 30 days. Chips: Unpaid, Past due, Paid 30 days, Plans; the Home numbers open
 * it on the right one (?chip=). Row actions: Mark paid (a swipe right or the button; the same fields the Stripe webhook writes,
 * src/lib/invoiceList.js paidByHand; a deal's first payment is the conversion, so a deal row opens the deal instead), Draft a reminder
 * (the invoice reminder email into Drafts through the send sheet, never sent from here), Open (the record's Money section). */
const TONE = { 'past-due': 'danger', due: 'progress', sent: 'neutral', paid: 'booked' };

export default function AdminInvoices({ leads = [], projects = [], loading = false, error = false, onRetry, onPatchLead, onPatchProject }) {
  const shell = useShell(); const toast = useToast();
  const phone = useMediaQuery('(max-width: 767px)');
  const [params, setParams] = useSearchParams();
  const chip = CHIP_IDS.includes(params.get('chip')) ? params.get('chip') : 'unpaid';
  const setChip = (id) => setParams(id === 'unpaid' ? {} : { chip: id }, { replace: true });
  const [busy, setBusy] = useState('');
  useTopBar(null);
  const now = Date.now();
  const all = useMemo(() => invoiceRows(leads, projects, now), [leads, projects]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => chipRows(all, chip, now), [all, chip]); // eslint-disable-line react-hooks/exhaustive-deps
  const sections = useMemo(() => invoiceSections(rows, now).filter(s => s.rows.length), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const owed = owedTotal(all);
  const leadOf = (id) => leads.find(l => String(l._id) === String(id)) || null;
  const projectOf = (id) => projects.find(p => String(p._id) === String(id)) || null;
  const open = (r) => { const l = leadOf(r.leadId); if (l) shell?.openLead?.(l, 'payments'); };

  const markPaid = async (r) => {
    const lead = leadOf(r.leadId); const project = projectOf(r.projectId);
    if (!lead || !project) { open(r); return false; }
    const w = paidByHand(lead, project, r.inv, {}, Date.now());
    if (!w) return false;
    setBusy(r.key);
    try {
      const prevInvoices = invoicesOf(project); const prevPurchases = lead.purchases || []; const prevRetainer = lead.retainer;
      const leadSet = { ...w.leadSet };
      if (project.kind === 'retainer' && lead.retainer) { const nx = nextUnpaidInvoice(replaceInvoice(prevInvoices, w.line)); leadSet.retainer = { ...lead.retainer, nextBillAt: nx?.dueAt || '' }; }
      const ok1 = await onPatchLead(lead._id, leadSet);
      if (!ok1) { toast.error(COPY.error.save); return false; }
      const ok2 = await onPatchProject(project._id, w.projectSet);
      if (!ok2) { await onPatchLead(lead._id, { purchases: prevPurchases, ...(prevRetainer ? { retainer: prevRetainer } : {}) }); toast.error(COPY.error.save); return false; }
      toast.undo(`${money(w.entry.amount)} from ${r.business} marked paid.`, async () => { await onPatchProject(project._id, { invoices: prevInvoices }); await onPatchLead(lead._id, { purchases: prevPurchases, ...(prevRetainer ? { retainer: prevRetainer } : {}) }); }, { seconds: 6 });
      return true;
    } finally { setBusy(''); }
  };
  const draftReminder = async (r) => {
    setBusy('d:' + r.key);
    try {
      const res = await apiFetch('/api/admin/email/send', { method: 'POST', body: { templateId: r.st === 'past-due' ? 'invoice_past_due' : 'invoice_reminder', recordId: r.leadId, ...(r.projectId ? { projectId: r.projectId } : {}), invoiceId: r.inv.id, reason: 'Reminder from Invoices' } });
      if (!res.ok) { toast.error(res.data?.error || COPY.error.save); return; }
      window.dispatchEvent(new CustomEvent('vz:drafts-changed'));
      if (res.data?.logId && shell?.openSendSheet) shell.openSendSheet({ _id: res.data.logId }); else toast.success('The reminder is in Drafts.');
    } finally { setBusy(''); }
  };

  const lineOf = (r) => {
    const bits = [];
    if (r.st === 'past-due') bits.push(`${r.late} ${r.late === 1 ? 'day' : 'days'} late`);
    else if (r.st === 'paid') bits.push(`Paid ${fmtDate(r.inv.paidAt)}${r.byHand ? ', logged by hand' : ''}`);
    else bits.push(`Due ${fmtDate(r.inv.dueAt)}`);
    if (r.st !== 'paid' && r.inv.reminders) bits.push(`reminded ${r.inv.reminders} ${r.inv.reminders === 1 ? 'time' : 'times'}`);
    if (r.plan) bits.push(`month ${r.plan.n} of ${r.plan.of}, ends ${fmtDate(r.plan.endsAt)}, stops after month ${r.plan.stopsAfter}${r.plan.cancelled ? ', Stripe cancelled' : ''}`);
    return bits.join(' · ');
  };
  let body;
  if (error && !leads.length) body = <Card><ErrorState title="Invoices did not load" description="Nothing was lost. Try again." onRetry={onRetry} /></Card>;
  else if (loading && !leads.length) body = <Stack gap={2} aria-busy="true">{[1, 2, 3].map(i => <ListRow.Skeleton key={i} />)}</Stack>;
  else if (!all.length) { const E = COPY.empty.invoices; body = <EmptyState icon="CurrencyDollarCircle" title={E.title} description={E.description} action={{ label: E.action, onClick: () => shell?.go?.('deals') }} />; }
  else if (!sections.length) { const E = COPY.empty['invoices.none']; body = <EmptyState icon="CurrencyDollarCircle" title={E.title} description={E.description} action={{ label: E.action, onClick: () => setChip('unpaid') }} />; }
  else body = (
    <Stack gap={5}>
      {sections.map(sec => (
        <Stack key={sec.id} gap={2} className={`iv-sec iv-sec--${sec.id}`} data-section={sec.id}>
          <h2 className="iv-h">{sec.label}<span className="iv-n">{sec.rows.length}</span></h2>
          <Stagger className="iv-rows" cap={6}>
            {sec.rows.map(r => {
              const canPay = r.st !== 'paid' && r.src === 'project';
              return (
                <SwipeRow key={r.key} enabled={phone && canPay} right={canPay ? { label: 'Mark paid', icon: 'Check', tone: 'primary', onCommit: () => markPaid(r) } : undefined}>
                  <Card as="div" padding={3} interactive data-row-id={r.key} className={`iv-row lay-card is-${r.st}`}>
                    <button type="button" className="v-stretch" onClick={() => open(r)} aria-label={`Open ${r.business}, ${r.inv.label || 'invoice'}, ${money(r.inv.amount)}`}>{r.business}</button>
                    <Row gap={3} align="start" wrap={false} style={{ minWidth: 0 }}>
                      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                        <span className="iv-who lay-truncate">{r.business}</span>
                        <span className="iv-label lay-truncate">{r.inv.label || 'Invoice'}{r.name && r.src === 'project' ? ` · ${r.name}` : r.src === 'deal' ? ' · deal' : ''}</span>
                        <span className="iv-line">{lineOf(r)}</span>
                      </Stack>
                      <Stack gap={1} align="end">
                        <span className="iv-amt">{money(r.inv.amount)}</span>
                        <Pill tone={TONE[r.st] || 'neutral'} label={INVOICE_STATUS_LABELS[r.st] || r.st} size="sm" icon={false} />
                      </Stack>
                    </Row>
                    {r.st !== 'paid' && (
                      <Row gap={2} wrap className="v-above iv-actions">
                        {canPay && <Button size="md" icon="Check" loading={busy === r.key} disabled={!!busy} onClick={() => markPaid(r)} className="iv-pay">Mark paid</Button>}
                        <Button variant="secondary" size="md" icon="Mail01" loading={busy === 'd:' + r.key} disabled={!!busy} onClick={() => draftReminder(r)} className="iv-remind">Draft a reminder</Button>
                        <Button variant="ghost" size="md" icon="ChevronRight" onClick={() => open(r)} className="iv-open">{r.src === 'deal' ? 'Open the deal' : 'Open'}</Button>
                      </Row>
                    )}
                  </Card>
                </SwipeRow>
              );
            })}
          </Stagger>
        </Stack>
      ))}
    </Stack>
  );
  return (
    <PageShell className="aa-main aa-main--wide iv-shell">
      <ScrollArea wide className="iv-page">
        {!phone && <Section description={loading && !leads.length ? undefined : `${money(owed)} owed across ${chipCount(all, 'unpaid', now)} ${chipCount(all, 'unpaid', now) === 1 ? 'invoice' : 'invoices'}`} loading={loading && !leads.length} />}
        {phone && <p className="iv-count" aria-live="polite">{loading && !leads.length ? ' ' : `${money(owed)} owed across ${chipCount(all, 'unpaid', now)} ${chipCount(all, 'unpaid', now) === 1 ? 'invoice' : 'invoices'}`}</p>}
        <Row gap={2} wrap className="iv-chips" role="group" aria-label="Show">
          {INVOICE_CHIPS.map(c => <Chip key={c.id} label={`${c.label} ${chipCount(all, c.id, now)}`} selected={chip === c.id} onClick={() => setChip(c.id)} className={`iv-chip iv-chip--${c.id}`} />)}
        </Row>
        {body}
      </ScrollArea>
      <style>{ivStyles}</style>
    </PageShell>
  );
}
const ivStyles = `
  .iv-page { display: flex; flex-direction: column; gap: var(--v-space-4); }
  .iv-count { margin: 0; min-height: var(--v-lh-sm); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .iv-h { margin: 0; display: flex; align-items: center; gap: var(--v-space-2); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; color: var(--v-text-3); font-weight: var(--v-weight-semibold); }
  .iv-n { font-variant-numeric: tabular-nums; }
  .iv-rows { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .iv-row { display: flex; flex-direction: column; gap: var(--v-space-3); position: relative; }
  .iv-who { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .iv-label { font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .iv-line { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .iv-amt { font-family: var(--v-font-display); font-size: var(--v-text-xl); line-height: 1; font-variant-numeric: tabular-nums; }
  .iv-actions { position: relative; }
`;
