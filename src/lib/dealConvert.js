/* The deal's money (CRM revamp, step 5): what a deal is worth, the deal
 * object a booking starts with, and the one conversion that turns the first
 * paid invoice into a client and a project. Client side only (it builds
 * the project from the pricing catalog); the checkpoints themselves are in
 * src/lib/deal.js. Nothing here writes. */
import { buildProject, uid } from './projects.js';
import { markPaid, newInvoice, addMonthsKey, invDayKey, invoicesTotal, replaceInvoice } from './invoices.js';
import { dealOf, tickPatch } from './deal.js';
import { packageOf, addonOf, planFor } from '../shared/pricing.js';

const iso = (t) => new Date(t).toISOString();

/** The package, add-ons and plan a booking carries, from the recommended (else first) pricing option. */
export function dealFromOptions(options = []) {
  const o = (options || []).find(x => x.recommended) || (options || [])[0];
  if (!o?.packageId && !(o?.addonIds || []).length) return { packageId: '', addonIds: [], plan: null };
  const pkg = packageOf(o.packageId);
  const total = (pkg?.price || 0) + (o.addonIds || []).map(id => addonOf(id)?.price || 0).reduce((n, v) => n + v, 0);
  const wants = o.plan === '6mo' || o.plan === '12mo';
  const p = wants ? planFor(total, o.packageId) : null;
  const plan = p ? (o.plan === '12mo' && p.alt ? { months: p.alt.months, monthly: p.alt.monthly } : { months: p.months, monthly: p.monthly }) : null;
  return { packageId: pkg?.id || '', addonIds: (o.addonIds || []).filter(id => addonOf(id)), plan };
}
/** What the deal builds, for buildProject. */
export function dealPick(deal) {
  if (deal?.packageId && packageOf(deal.packageId)) return { packageId: deal.packageId };
  if ((deal?.addonIds || []).length) return { addonIds: deal.addonIds };
  return { custom: { name: 'Project', total: dealTotal(deal), kind: 'brand' } };
}
export const dealPackageLabel = (deal) => packageOf(deal?.packageId)?.label || ((deal?.addonIds || []).map(id => addonOf(id)?.label).filter(Boolean).join(', ')) || '';
/** The package price plus the add-ons; a plan is the same total spread out. */
export const dealTotal = (deal) => (packageOf(deal?.packageId)?.price || 0) + (deal?.addonIds || []).map(id => addonOf(id)?.price || 0).reduce((n, v) => n + v, 0);
export const dealPlanLine = (deal) => (deal?.plan?.months ? `$${Number(deal.plan.monthly || 0).toLocaleString()} a month for ${deal.plan.months} months` : 'One payment');
/** What the first invoice should say, from the package or the plan's first month. */
export const firstInvoiceDefaults = (deal) => (deal?.plan?.months ? { label: `Month 1 of ${deal.plan.months}`, amount: deal.plan.monthly } : { label: dealPackageLabel(deal) || 'Deposit', amount: dealTotal(deal) });

/** Mark paid on a deal's first invoice: the lead's write and the project to POST.
 *  leadSet ticks paid, writes the invoice paid, appends the purchases entry, sets stage client.
 *  projectDoc carries the deal invoices (the paid one first) and the remaining plan months as sent lines. */
export function markPaidConversion(lead, invoiceId, { paidAt = '', note = '' } = {}, now = Date.now()) {
  const deal = dealOf(lead);
  const inv = (deal.invoices || []).find(i => i.id === invoiceId);
  if (!inv) return null;
  const purchaseId = uid();
  const paidIso = paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : iso(now);
  const paidDay = paidAt || invDayKey(new Date(now));
  const paidLine = markPaid(inv, { paidAt: paidIso, note, ledgerId: purchaseId }, now);
  const invoices = replaceInvoice(deal.invoices, paidLine);
  const ticked = tickPatch({ ...lead, deal: { ...deal, invoices } }, 'paid', 'rob', now).deal;
  const leadSet = {
    deal: ticked, stage: 'client', clientSince: iso(now), clientStatus: 'active',
    bookedOutcome: { result: 'won', reason: note || '', at: iso(now) },
    purchases: [...(lead.purchases || []), { id: purchaseId, label: inv.label || 'First invoice', amount: Number(inv.amount) || 0, at: paidDay, notes: note || '', projectId: '' }],
  };
  const projectDoc = buildProject(lead._id, dealPick(deal), { startDate: paidDay, addonIds: deal.addonIds || [] });
  const moved = [paidLine, ...invoices.filter(i => i.id !== paidLine.id)];
  if (deal.plan?.months) {
    for (let i = moved.length; i < deal.plan.months; i++) moved.push({ ...newInvoice({ label: `Month ${i + 1} of ${deal.plan.months}`, amount: deal.plan.monthly, dueAt: addMonthsKey(paidDay, i), status: 'sent' }), ledgerId: '' });
    projectDoc.plan = { months: deal.plan.months, monthly: deal.plan.monthly, stripeCancelled: false };
  } else projectDoc.plan = null;
  projectDoc.invoices = moved;
  projectDoc.total = Math.max(dealTotal(deal), invoicesTotal(moved));
  if (deal.contractLink) projectDoc.links = { ...(projectDoc.links || {}), contract: deal.contractLink };
  return { leadSet, projectDoc, purchaseId };
}
/** The purchases list with the new project's id on the conversion's entry. */
export const purchasesWithProject = (purchases, purchaseId, projectId) => (purchases || []).map(p => (p.id === purchaseId ? { ...p, projectId: String(projectId) } : p));
/** The write that puts the lead back as it was before the conversion (the project is archived beside it). */
export const undoConversionSet = (before) => ({ stage: before.stage || 'deal', deal: before.deal || null, clientSince: before.clientSince || '', clientStatus: before.clientStatus || '', bookedOutcome: before.bookedOutcome || { result: '', reason: '', at: '' }, purchases: before.purchases || [], explicit: true });
/** Mark won without payment (pro bono): the same conversion with no invoice and no ledger entry. */
export function wonWithoutPayment(lead, now = Date.now()) {
  const deal = dealOf(lead);
  const leadSet = { deal, stage: 'client', clientSince: iso(now), clientStatus: 'active', bookedOutcome: { result: 'won', reason: 'Pro bono', at: iso(now) } };
  const projectDoc = buildProject(lead._id, dealPick(deal), { startDate: invDayKey(new Date(now)), addonIds: deal.addonIds || [] });
  projectDoc.invoices = []; projectDoc.plan = null;
  return { leadSet, projectDoc };
}
