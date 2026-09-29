import { useState } from 'react';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import { Button, ProgressBar, InlineEdit, Checkbox, Collapsible } from '../../ui';
import InvoicesCard from '../Invoices';
import { money } from '../../shared/format';
import { fmtDate } from '../../shared/dates';
import { COPY } from '../../shared/copy';
import { invoicesOf, invoiceStatus, invoicesTotal, invoicesPaid, markPaid, replaceInvoice } from '../../lib/invoices';
import { isTicked } from '../../lib/deal';
import { markPaidConversion, purchasesWithProject, undoConversionSet, dealPackageLabel, dealPlanLine, dealTotal, firstInvoiceDefaults } from '../../lib/dealConvert';
import { planMonth, planRemaining, planReminderDue, nextUnpaid, owedTotal, paidTotal, scheduleTotal } from '../../lib/projects';
import { fmtDay } from '../ClientWorkspace';
import EmptyLine from './EmptyLine';
import ProjectPicker from './ProjectPicker';

/* Money (law 1): "$150 paid of $350" renders here and nowhere else. The
 * figure, one bar, the plan line when there is one, the invoice table in
 * one card (Add invoice in its header, one button per row), then the
 * ledger behind a disclosure and the release rule. A deal shows its own
 * invoices the same way; the first Mark paid on a deal runs the conversion. */
export function moneyFigures(rec) {
  const { clientMode, cw, deal } = rec;
  if (clientMode) {
    const p = cw.current;
    if (!p) return null;
    return { paid: paidTotal(p), total: scheduleTotal(p), owed: owedTotal(p), name: p.name, invoices: invoicesOf(p), project: p };
  }
  const invoices = deal.invoices || [];
  const total = invoicesTotal(invoices) || dealTotal(deal) || 0;
  const paid = invoicesPaid(invoices);
  return { paid, total, owed: Math.max(0, total - paid), name: dealPackageLabel(deal) || 'No package', invoices, project: null };
}

export const moneySummary = (rec) => { const m = moneyFigures(rec); return m ? `${money(m.paid)} paid of ${money(m.total)} · ${money(m.owed)} owed` : 'No project to bill'; };

export default function MoneySection({ rec }) {
  const { lead, clientMode, readOnly, cw, deal, patch, onPatch, email, shell, confirm, toast, wonClose, invoiceReq } = rec;
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const m = moneyFigures(rec);
  const E = COPY.empty;
  if (!m) return <EmptyLine text={E['clients.payments'].title} action={!readOnly ? { label: E['clients.payments'].action, onClick: cw.openNew } : null} />;
  const p = m.project;
  const pct = m.total ? Math.round((m.paid / m.total) * 100) : 0;

  /* The deal's money (CRM revamp, step 5): the invoices live on deal.invoices; the first Mark paid runs the conversion. */
  const anyPaid = !clientMode && (m.invoices.some(i => invoiceStatus(i) === 'paid') || isTicked(deal, 'paid'));
  const writeDealInvoices = (invoices) => patch({ deal: { ...deal, invoices } });
  const markDealPaid = async (inv, form) => {
    if (anyPaid || !shell?.projectOps?.create) return patch({ deal: { ...deal, invoices: replaceInvoice(m.invoices, markPaid(inv, { paidAt: form.paidAt ? new Date(`${form.paidAt}T12:00:00`).toISOString() : '', note: form.note })) } });
    const conv = markPaidConversion(lead, inv.id, form);
    if (!conv) return false;
    const yes = await confirm({ title: 'Mark paid and start the project?', body: `${dealPackageLabel(deal) || 'No package'}, ${money(dealTotal(deal) || inv.amount)}, ${dealPlanLine(deal).toLowerCase()}. ${lead.business} becomes a client and the project starts with this invoice paid.`, confirmLabel: 'Mark paid', icon: 'CurrencyDollar' });
    if (!yes) return false;
    const before = lead;
    const ok = await patch(conv.leadSet);
    if (!ok) return false;
    const item = await shell.projectOps.create(conv.projectDoc);
    if (item) patch({ purchases: purchasesWithProject(conv.leadSet.purchases, conv.purchaseId, item._id) });
    toast.undo(`${lead.business} is a client. ${conv.projectDoc.name} started.`, async () => { await onPatch(before._id, undoConversionSet(before)); if (item) shell.projectOps.patch?.(item._id, { archived: true }); }, { seconds: 6 });
    wonClose();
    return true;
  };

  const planLine = clientMode
    ? (p.plan ? `Payment plan: month ${planMonth(p) || 1} of ${p.plan.months}, ${money(p.plan.monthly)} a month, ${nextUnpaid(p) ? `next due ${fmtDay(nextUnpaid(p).dueAt)}` : 'paid in full'}, ${money(planRemaining(p))} remaining.` : '')
    : (deal.plan ? dealPlanLine(deal) : '');
  const remind = clientMode && p.plan && (planReminderDue(p) || p.plan.stripeCancelled);
  const ledger = clientMode ? cw.ledger : (lead.purchases || []);
  return (
    <div className="rc-money">
      {clientMode && <ProjectPicker cw={cw} />}
      <div className="rc-money-head">
        <span className="rc-money-n">{money(m.paid)} paid of {money(m.total)}</span>
        <span className="rc-money-side">{money(m.owed)} owed · {m.name}</span>
      </div>
      <ProgressBar value={pct} tone="booked" size="sm" className="rc-money-bar" />
      {planLine && <p className="rc-line">{planLine}</p>}
      {clientMode && p.plan && (
        <div className="rc-fact"><span className="rc-fact-label">Stripe sub</span>{readOnly ? <span className="rc-fact-ro">{p.plan.stripeSubscriptionId || 'None'}</span> : <InlineEdit value={p.plan.stripeSubscriptionId || ''} onSave={(v) => cw.ppRaw(p, { plan: { ...p.plan, stripeSubscriptionId: v.trim() } })} placeholder="sub_... (so a cancellation reconciles)" label="Stripe subscription id" className="cw-sub-id" />}</div>
      )}
      {clientMode && p.plan && (p.plan.stripeCancelledAt
        ? <p className="rc-line">Stripe reports this subscription cancelled ({fmtDate(p.plan.stripeCancelledAt)}).</p>
        : remind && <Checkbox label="Stripe subscription cancelled (cancel it after the final payment; Stripe does not stop it for you)" checked={!!p.plan.stripeCancelled} onChange={(v) => cw.pp(p, { plan: { ...p.plan, stripeCancelled: v } })} disabled={readOnly} className="cw-stripe-check" />)}
      {clientMode
        ? <InvoicesCard invoices={m.invoices} onChange={cw.writeInvoices(p)} onMarkPaid={(inv, form) => cw.payInvoice(p, inv, form)} onSendEmail={(inv) => cw.email.open('invoice', { invoice: inv, project: p })} emailConnected={cw.email.connected('invoice')} defaults={p.plan ? { label: `Month ${planMonth(p) || 1} of ${p.plan.months}`, amount: p.plan.monthly } : { label: p.name, amount: owedTotal(p) }} readOnly={readOnly} pulseId={cw.paidPulse} emptyKey="clients.schedule" request={invoiceReq} />
        : <InvoicesCard invoices={m.invoices} onChange={writeDealInvoices} onMarkPaid={markDealPaid} onSendEmail={(inv) => email.open('invoice', { invoice: inv })} emailConnected={email.connected('invoice')} defaults={firstInvoiceDefaults(deal)} readOnly={readOnly} emptyKey="deals.invoices" request={invoiceReq} />}
      {!clientMode && !anyPaid && m.invoices.length > 0 && <p className="rc-line">Mark paid on the first one makes the client and the project.</p>}
      <div className="rc-money-foot">
        <button type="button" className={`rc-disclose${ledgerOpen ? ' is-open' : ''}`} aria-expanded={ledgerOpen} aria-controls="rc-ledger" onClick={() => setLedgerOpen(o => !o)}><ChevronDown width={16} height={16} className="rc-disclose-chev" aria-hidden="true" />Ledger, {ledger.length} payment{ledger.length === 1 ? '' : 's'}</button>
        <span className="rc-muted">Files release at full payment</span>
      </div>
      <Collapsible open={ledgerOpen}>
        <div id="rc-ledger" className="rc-ledger">
          {ledger.length ? <ul className="rc-ledger-list">{ledger.map((x, i) => { const proj = x.projectId ? cw.mine.find(q => String(q._id) === String(x.projectId)) : null; return (
            <li key={x.id || i} id={x.id ? `ledger-${x.id}` : undefined} className="rc-ledger-row"><span className="rc-ledger-what"><span>{x.label || 'Payment'}</span><span className="rc-muted">{[fmtDay(x.at) || fmtDate(x.at), proj?.name, x.notes].filter(Boolean).join(', ')}</span></span><span className="rc-ledger-amt">{money(x.amount)}</span></li>
          ); })}</ul> : <p className="rc-line">{E['clients.ledger'].title}. {E['clients.ledger'].description}</p>}
          {clientMode && !readOnly && <Button variant="ghost" size="md" icon="Plus" onClick={cw.openManual} className="cw-add-manual">Add manual payment</Button>}
        </div>
      </Collapsible>
    </div>
  );
}
