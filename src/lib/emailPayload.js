/* The send modal's preview (CRM revamp, step 6): the same fields the
 * server builds in api/_lib/email.js, from the same rules, so what Rob
 * sees in the modal is what the hook receives. The server is the source
 * of truth; this only previews. */
import { packageOf, addonOf, planFor, planLine, money } from '../shared/pricing';
import { CALENDLY_URL } from '../marketing/links';

export const EMAIL_KIND_IDS = ['intro', 'onboarding', 'invoice', 'delivery'];
export function variantOf(packageId) {
  const p = packageOf(packageId);
  if (!p) return 'general';
  if (p.kind === 'web') return ['launch-plan', 'build-plan'].includes(p.id) ? 'combined' : 'web';
  return 'brand';
}
const iso = (t) => new Date(t).toISOString();
const str = (v, max) => String(v ?? '').trim().slice(0, max);
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
    calendlyLink: CALENDLY_URL,
    sentAt: iso(now),
  };
  if (kind === 'onboarding') payload.variant = variantOf(packageId);
  if (kind === 'invoice') payload.invoice = invoice ? { label: str(invoice.label, 120), amount: Number(invoice.amount) || 0, dueAt: str(invoice.dueAt, 10) } : null;
  if (kind === 'delivery') payload.driveLink = str(project?.links?.drive || lead?.links?.drive, 400);
  // Review links: the delivery email names the client's Visualize review link once it exists (the Reviews card mints it).
  if (kind === 'delivery') payload.reviewLink = lead?.reviews?.visualize?.token ? `https://visualizestudio.org/r/${str(lead.reviews.visualize.token, 64)}` : '';
  return payload;
}
