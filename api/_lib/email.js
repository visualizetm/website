/* The four branded emails (CRM revamp, step 6): what goes out, built from
 * the record, and which Zapier catch hooks exist. Each kind has one hook
 * URL in an environment variable (ZAPIER_HOOK_INTRO, _ONBOARDING,
 * _INVOICE, _DELIVERY); the URL never leaves this process (not in a
 * response, a log or the settings document). The payload shapes are in
 * docs/RUNBOOK.md, "Emails". Pure except hookFor(), which reads env. */
import { packageOf, addonOf, planFor, planLine, money } from './pricing.js';
import { EMAIL_KIND_IDS } from '../_semantics.js';
import { meetingLink } from './config.js';

export const HOOK_ENV = { intro: 'ZAPIER_HOOK_INTRO', onboarding: 'ZAPIER_HOOK_ONBOARDING', invoice: 'ZAPIER_HOOK_INVOICE', delivery: 'ZAPIER_HOOK_DELIVERY' };
export const hookFor = (kind) => String(process.env[HOOK_ENV[kind]] || '').trim();
/** Which kinds have a hook set. Booleans only. */
export const emailsConfigured = () => Object.fromEntries(EMAIL_KIND_IDS.map(k => [k, !!hookFor(k)]));
/** The note the contact log carries. */
export const EMAIL_NOTE = { intro: 'Sent the intro email', onboarding: 'Sent the onboarding email', invoice: 'Sent the invoice email', delivery: 'Sent the delivery email' };
/** The deal checkpoint a send ticks. */
export const EMAIL_CHECKPOINT = { intro: 'introSent', onboarding: 'onboardingSent', invoice: 'invoiceSent' };
/** The onboarding variant from the package kind: brand, web, combined (the plans), or general with no package. */
export function variantOf(packageId) {
  const p = packageOf(packageId);
  if (!p) return 'general';
  if (p.kind === 'web') return ['launch-plan', 'build-plan'].includes(p.id) ? 'combined' : 'web';
  return 'brand';
}
const iso = (t) => new Date(t).toISOString();
const str = (v, max) => String(v ?? '').trim().slice(0, max);

/** The JSON a hook receives. lead is the record; project and invoice when the kind needs them; test marks a sample. */
export function buildEmailPayload(kind, { lead, project = null, invoice = null, test = false, now = Date.now() } = {}) {
  const deal = lead?.deal && typeof lead.deal === 'object' ? lead.deal : {};
  const packageId = deal.packageId || project?.packageId || '';
  const pkg = packageOf(packageId);
  const addons = (deal.addonIds || []).map(addonOf).filter(Boolean);
  const total = (pkg?.price || 0) + addons.reduce((n, a) => n + a.price, 0);
  const planSrc = deal.plan?.months ? deal.plan : project?.plan?.months ? project.plan : null;
  const plan = planSrc ? { months: planSrc.months, monthly: planSrc.monthly, total: total || (Number(planSrc.monthly) || 0) * planSrc.months, alt: null } : planFor(total, packageId);
  const payload = {
    kind, test: !!test,
    name: str(lead?.askFor, 200) || str(lead?.business, 200),
    business: str(lead?.business, 200),
    email: str(lead?.email, 200),
    packageLabel: pkg?.label || addons.map(a => a.label).join(', ') || (project?.name && !project?.packageId ? str(project.name, 160) : ''),
    packageIncluded: pkg?.included ? [...pkg.included, ...addons.map(a => a.label)] : addons.map(a => a.label),
    planLine: plan ? planLine(plan) : total ? `${money(total)}, one payment` : '',
    calendlyLink: meetingLink(),
    sentAt: iso(now),
  };
  if (kind === 'onboarding') payload.variant = variantOf(packageId);
  if (kind === 'invoice') payload.invoice = invoice ? { label: str(invoice.label, 120), amount: Number(invoice.amount) || 0, dueAt: str(invoice.dueAt, 10) } : null;
  if (kind === 'delivery') payload.driveLink = str(project?.links?.drive || lead?.links?.drive, 400);
  // Review links: the delivery email names the client's Visualize review link once it exists (the Reviews card mints it).
  if (kind === 'delivery') payload.reviewLink = lead?.reviews?.visualize?.token ? `https://visualizestudio.org/r/${str(lead.reviews.visualize.token, 64)}` : '';
  return payload;
}

/** The fixed sample a Send test posts, flagged test: true so the zap can skip it. */
export function samplePayload(kind, now = Date.now()) {
  const lead = { business: 'Bay Ridge Bakery', askFor: 'Sam', email: 'sam@bayridgebakery.example', deal: { packageId: 'launch-plan', addonIds: [], plan: { months: 6, monthly: 200 } }, links: { drive: 'https://drive.google.com/drive/folders/sample' } };
  const project = { name: 'Launch Plan', packageId: 'launch-plan', plan: { months: 6, monthly: 200 }, links: { drive: 'https://drive.google.com/drive/folders/sample' } };
  const invoice = { label: 'Month 1 of 6', amount: 200, dueAt: iso(now).slice(0, 10) };
  return buildEmailPayload(kind, { lead, project, invoice, test: true, now });
}
