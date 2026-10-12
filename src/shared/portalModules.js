/* The card order on the home (prompt 3), encoded as each module's order so later prompts do not argue about it:
 * needs_you 10, pay 20, plan 25, approvals 30, concepts 40 (an approved set 155, below the documents), planner 50,
 * progress 60, revisions 70, meetings 80, files 90, brand_kit 100, review 110, their_reviews 120, showcase 130,
 * retainer 140, documents 150, book 160, contact 170; home is always first. */
/* The client portal's module registry (client portal, prompt 1). One entry
 * per card; prompts 2 to 4 add cards here and nowhere else. Mirrored byte
 * for byte in api/_lib/portalModules.js below PORTAL_MODULE_IDS
 * (scripts/portal-test.mjs asserts it), so the CRM's controls, the public
 * route and the page read one contract. docs/PORTAL-DESIGN.md explains it.
 *
 *   { id, title, order, sensitive, defaultState, auto, fields, resolve(client, projects, settings) }
 *
 * resolve returns null (do not render) or the card's data; cardOf then keeps
 * only `fields`, so nothing a resolve did not mean to send can leave the
 * server. A module's state (off | on | auto): off never renders, on renders
 * only when resolve returns data, auto is the same as on. */
import { invoicesOf, invoiceStatus } from '../lib/invoices.js';
import { RETAINERS, retainerOf, money, extraRoundFee, EXTRA_ROUND, PRINT_PRODUCTS } from './pricing.js';

export const PORTAL_MODULE_IDS = ['home', 'contact', 'book', 'documents', 'showcase', 'pay', 'plan', 'retainer', 'progress', 'revisions', 'needs_you', 'files', 'brand_kit', 'planner', 'concepts', 'review', 'their_reviews', 'meetings', 'approvals', 'reorder', 'site_changes'];
export const PORTAL_STATE_IDS = ['off', 'on', 'auto'];
export const PORTAL_TEMPLATE_IDS = ['brand', 'website', 'retainer'];
export const DOCUMENT_KIND_IDS = ['doc', 'sheet', 'pdf', 'drive', 'link'];
export const PORTAL_URL_BASE = 'https://visualizestudio.org/c/';

const STAGE_LABELS = { kickoff: 'Kickoff', design: 'Design', revisions: 'Revisions', build: 'Build', delivery: 'Delivery', delivered: 'Delivered' };
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const hexOf = (v) => { const raw = v && typeof v === 'object' ? v.hex : v; const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(raw ?? '').trim()); return m ? `#${(m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]).toLowerCase()}` : ''; };
/** The first brand colour on the record, as a hex or ''. The same reading as src/shared/color.js brandHexOf. */
export const portalBrandHex = (client) => { const b = client?.brand || {}; for (const c of [b.primary, ...(Array.isArray(b.colors) ? b.colors : [])]) { const h = hexOf(c); if (h) return h; } return ''; };
export const portalLogo = (client) => { const sh = client?.showcase || {}; return str(sh.brand?.logo?.dark || sh.brand?.logo?.light || sh.logoUrl, 600); };
export const portalFirstName = (client) => str(client?.askFor, 80).split(/[\s,]+/)[0] || '';
export const portalBusiness = (client) => str(client?.showcase?.displayName || client?.business, 120);
/** The newest active project: not archived, not a retainer, not delivered; newest first by createdAt. */
export const newestActiveProject = (client, projects) => (Array.isArray(projects) ? projects : [])
  .filter(p => p && String(p.leadId) === String(client?._id) && !p.archived && p.kind !== 'retainer' && p.stage !== 'delivered')
  .sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0))[0] || null;

/* Money (prompt 2). The lines a project carries are invoicesOf (invoices[], else the old schedule[]); paid is invoiceStatus paid
 * (status paid or a ledgerId the Stripe webhook wrote). Anything else is unpaid. */
export const clientProjects = (client, projects) => (Array.isArray(projects) ? projects : []).filter(p => p && String(p.leadId) === String(client?._id) && !p.archived);
const isPaid = (line, now) => invoiceStatus(line, now) === 'paid';
const openLines = (p, now) => invoicesOf(p).filter(l => !isPaid(l, now));
/** Paid in full: every line paid (and there is at least one), or delivered with no open line. No lines and not delivered is unpaid. */
export const paidInFull = (p, now = Date.now()) => { const lines = invoicesOf(p); if (lines.some(l => !isPaid(l, now))) return false; return lines.length > 0 || !!p?.deliveredAt; };
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const dateOf = (v) => (DATE_ONLY.test(String(v || '').slice(0, 10)) ? String(v).slice(0, 10) : '');
/** The oldest open, sent line across the client's projects (never a retainer's: those bill through Stripe), with its project. */
export function oldestOpenInvoice(client, projects, now = Date.now()) {
  const found = [];
  for (const p of clientProjects(client, projects)) {
    if (p.kind === 'retainer') continue;
    for (const l of openLines(p, now)) if (l.sentAt) found.push({ line: l, project: p });
  }
  found.sort((a, b) => (dateOf(a.line.dueAt) || '9999').localeCompare(dateOf(b.line.dueAt) || '9999') || String(a.line.sentAt).localeCompare(String(b.line.sentAt)));
  return found[0] || null;
}
/** A payment plan's installments: the project's non extra lines in due order. */
export const planLines = (p) => (p?.plan?.months ? invoicesOf(p).filter(l => !l.extra).sort((a, b) => (dateOf(a.dueAt) || '9999').localeCompare(dateOf(b.dueAt) || '9999')) : []);
const cashtag = (v) => String(v || '').trim().replace(/^\$/, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
const handle = (v) => String(v || '').trim().replace(/^@/, '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 30);
/** The ways to pay one line, in order: card (the Stripe link from Settings), Cash App, Venmo, Zelle. A method with no identifier is left out. */
export function payMethods(profile, amount, label, payUrl = '') {
  const pm = profile?.payMethods || {};
  const out = [];
  const amt = Math.round(Number(amount) * 100) / 100;
  /* The invoice's own Stripe link carries its amount; the studio link from Settings is the fallback and the client types the amount shown above. */
  if (/^https:\/\//i.test(String(payUrl || ''))) out.push({ id: 'card', name: 'Card or Apple Pay', line: 'Through Stripe, the amount filled in', url: String(payUrl).slice(0, 400) });
  else if (/^https:\/\//i.test(String(pm.stripe || ''))) out.push({ id: 'card', name: 'Card or Apple Pay', line: `Through Stripe: enter ${money(amt)} when it asks`, url: String(pm.stripe).slice(0, 400) });
  if (cashtag(pm.cashapp)) out.push({ id: 'cashapp', name: 'Cash App', line: `$${cashtag(pm.cashapp)}, the amount filled in`, url: `https://cash.app/$${cashtag(pm.cashapp)}/${amt}` });
  if (handle(pm.venmo)) out.push({ id: 'venmo', name: 'Venmo', line: `@${handle(pm.venmo)}, the amount filled in`, url: `https://venmo.com/u/${handle(pm.venmo)}?txn=pay&amount=${amt}&note=${encodeURIComponent(String(label || '').slice(0, 80))}` });
  if (str(pm.zelle, 120)) out.push({ id: 'zelle', name: 'Zelle', line: "Send it here and I'll confirm", copy: str(pm.zelle, 120), kind: pm.zelleKind === 'phone' ? 'phone' : 'email' });
  return out;
}
/** The client's active retainer (lead.retainer, status active, a known plan). */
export const activeRetainer = (client) => { const r = client?.retainer; if (!r || r.status !== 'active') return null; const plan = retainerOf(r.planId); return plan ? { plan, r } : null; };
/** The one retainer to offer after delivery: Site Care for web, Content Kit for brand, Growth when both kinds were delivered. */
export function retainerToOffer(client, projects) {
  const done = clientProjects(client, projects).filter(p => p.kind !== 'retainer' && (p.deliveredAt || p.stage === 'delivered'));
  if (!done.length) return null;
  const web = done.some(p => p.kind === 'website' || p.kind === 'web' || p.kind === 'combined');
  const brand = done.some(p => p.kind === 'brand' || p.kind === 'combined');
  return retainerOf(web && brand ? 'growth' : web ? 'site-care' : 'content-kit');
}
/** The newest payment the client has not been thanked for yet, as its paidAt, or ''. Only payments after the link existed count. */
export function unseenPayment(client, projects) {
  const since = String(client?.portal?.lastPaidSeenAt || client?.portal?.createdAt || '');
  let latest = '';
  for (const p of clientProjects(client, projects)) for (const l of invoicesOf(p)) if (isPaid(l) && l.paidAt && String(l.paidAt) > latest) latest = String(l.paidAt);
  return latest && latest > since ? latest : '';
}
/* Project (prompt 2). The stages a project walks, the same list src/lib/projects.js stagesFor draws. */
export const stagesFor = (kind) => (kind === 'retainer' ? ['kickoff', 'delivered'] : (kind === 'web' || kind === 'website' || kind === 'combined') ? ['kickoff', 'design', 'revisions', 'build', 'delivery', 'delivered'] : ['kickoff', 'design', 'revisions', 'delivery', 'delivered']);
export const revisionsUsed = (p) => Math.max(Number(p?.revisions?.used) || 0, (Array.isArray(p?.revisions?.log) ? p.revisions.log : []).filter(r => !r.extra).length);
export const revisionsMax = (p) => Number(p?.revisions?.max) || 0;
const stageLine = (p, kind) => {
  switch (p?.stage) {
    case 'kickoff': return "I'm getting set up";
    case 'design': return "I'm building your first concepts";
    case 'revisions': return `Round ${revisionsUsed(p)} of ${revisionsMax(p)}`;
    case 'build': return "I'm building it out";
    case 'delivery': return 'Final files are coming';
    case 'delivered': return `Delivered on ${dateOf(p.deliveredAt) || 'schedule'}`;
    default: return kind === 'retainer' ? 'Running' : 'In progress';
  }
};
/** The open items the client has to do, on the client and its active projects, in list order. */
export function clientItems(client, projects) {
  const out = [];
  const take = (record, owner) => (Array.isArray(record?.checklists) ? record.checklists : []).forEach(l => (Array.isArray(l?.items) ? l.items : []).forEach(it => { if (it && it.client && !it.done) out.push({ id: str(it.id, 24), text: str(it.text, 300), url: /^https:\/\/[^\s]+$/i.test(String(it.url || '')) ? String(it.url).slice(0, 400) : '', owner }); }));
  take(client, '');
  for (const p of clientProjects(client, projects).filter(p => p.stage !== 'delivered')) take(p, str(p.name, 80));
  return out;
}
/* Files and brand kit (prompt 2). */
const isBrandKind = (k) => k === 'brand' || k === 'combined';
const newestFirst = (a, b) => (Date.parse(b.deliveredAt || b.createdAt || '') || 0) - (Date.parse(a.deliveredAt || a.createdAt || '') || 0);
/** The project whose files the client sees: the newest active one with deliverables, else the newest delivered one with deliverables. */
export function filesProject(client, projects) {
  const mine = clientProjects(client, projects).filter(p => p.kind !== 'retainer' && Array.isArray(p.deliverables) && p.deliverables.some(d => d && str(d.label, 120)));
  const active = mine.filter(p => p.stage !== 'delivered' && !p.deliveredAt).sort(newestFirst)[0];
  return active || mine.filter(p => p.stage === 'delivered' || p.deliveredAt).sort(newestFirst)[0] || null;
}
export const deliveredBrandProject = (client, projects) => clientProjects(client, projects).filter(p => isBrandKind(p.kind) && (p.deliveredAt || p.stage === 'delivered')).sort(newestFirst)[0] || null;
/* The token pages as cards (prompt 3). Each links to the page with its own token, never a new one, and ?from=portal only: the
 * page asks its own door for the way back, and the door resolves it from the lead that owns the token (portalPath). The portal
 * token never rides in another page's URL. ctx is the fourth argument the route hands resolve: { posts, sets, todayKey, ... }. */
const fromPortal = () => '?from=portal';
/** The portal's path for a client, or '' without a token of the right shape. The planner, concepts and review doors answer it as `back`. */
export const portalPath = (client) => (/^[A-Za-z0-9_-]{16,64}$/.test(String(client?.portal?.token || '')) ? `/c/${client.portal.token}` : '');
const weekOf = (todayKey) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(todayKey || '')); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); const dow = (d.getUTCDay() + 6) % 7; const start = new Date(d.getTime() - dow * 864e5); const end = new Date(start.getTime() + 6 * 864e5); const k = (x) => x.toISOString().slice(0, 10); return { start: k(start), end: k(end) }; };
export const plannerLink = (client) => (client?.planner?.enabled && client?.planner?.token ? `/planner/${client.planner.token}${fromPortal()}` : '');
/** This week's posts for the client: how many, how many wait on them (in review), and the ads live. */
export function plannerCounts(client, posts, todayKey) {
  const wk = weekOf(todayKey);
  const mine = (Array.isArray(posts) ? posts : []).filter(p => p && String(p.leadId) === String(client?._id) && !p.deleted && !p.archived);
  const week = wk ? mine.filter(p => String(p.date || '').slice(0, 10) >= wk.start && String(p.date || '').slice(0, 10) <= wk.end) : [];
  return { posts: week.filter(p => p.kind !== 'ad').length, needYou: week.filter(p => p.status === 'review').length, adsLive: mine.filter(p => p.kind === 'ad' && p.status === 'live').length };
}
/** The newest shared concept set: not archived, not a draft, with its token. */
export const sharedConceptSet = (client, sets) => (Array.isArray(sets) ? sets : [])
  .filter(s => s && String(s.leadId) === String(client?._id) && !s.deleted && !s.archived && s.token && s.status && s.status !== 'draft')
  .sort((a, b) => (Number(b.round) || 0) - (Number(a.round) || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null;
export const conceptState = (set) => (set?.approvedDirectionId || set?.status === 'approved' ? 'approved' : set?.status === 'changes' ? 'changes' : 'waiting');
const CONCEPT_STATE_LABEL = { approved: 'Approved', changes: 'Changes requested', waiting: 'Waiting on you' };
/* Reviews (prompt 3): the Visualize review link as one ask after delivery, and the client's own Google reviews on their card. */
const hasTestimonial = (client) => (Array.isArray(client?.reviews?.testimonials) ? client.reviews.testimonials : []).some(t => t && (t.status === 'pending' || t.status === 'approved' || (!t.status && t.published === true)));
const newestProject = (client, projects) => clientProjects(client, projects).filter(p => p.kind !== 'retainer').sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0))[0] || null;
export const reviewLink = (client) => (client?.reviews?.visualize?.token ? `/r/${client.reviews.visualize.token}${fromPortal()}` : '');
/** "<latest> reviews, up <diff> since we started" when both counts are numbers and the diff is positive, else the count alone. */
export function theirReviewsLine(reviews) {
  const latest = Number(reviews?.latest?.count); const base = Number(reviews?.baseline?.count);
  if (!Number.isFinite(latest)) return '';
  const diff = Number.isFinite(base) ? latest - base : 0;
  return `${latest} review${latest === 1 ? '' : 's'}${diff > 0 ? `, up ${diff} since we started` : ''}`;
}
/* Approvals (prompt 3): what Rob asked the client to sign off on. Pending always; an answer stays for seven days. */
export const APPROVAL_DAYS = 7;
export function approvalsOf(client, now = Date.now()) {
  const list = Array.isArray(client?.portal?.approvals) ? client.portal.approvals : [];
  return list.filter(a => a && str(a.label, 120)).filter(a => a.status === 'pending' || ((a.status === 'approved' || a.status === 'changes') && Date.parse(a.respondedAt || '') > now - APPROVAL_DAYS * 864e5))
    .map(a => ({ id: str(a.id, 40), label: str(a.label, 120), url: /^https?:\/\//i.test(String(a.url || '')) ? str(a.url, 600) : '', status: a.status, note: str(a.note, 400), requestedAt: str(a.requestedAt, 40), respondedAt: str(a.respondedAt, 40) }));
}
/* Reorder (prompt 4): what they have had printed before, from delivered print orders and from delivered packages that
 * include stickers or cards, as quick picks priced from pricing.js. Never had print: nothing to show. */
export const PRINT_PACKAGES = { 'brand-complete': ['cards-250'], 'web-complete': ['cards-250'], 'launch-plan': ['nfc-card', 'stickers-50'], 'build-plan': ['nfc-card', 'cards-250', 'stickers-50'] };
export const REORDER_PICK_IDS = ['stickers-50', 'cards-250', 'cards-500', 'nfc-card', 'vinyl'];
export const REORDER_MAX_QTY = 500;
const pickOf = (id) => { const p = PRINT_PRODUCTS.find(x => x.id === id); if (!p) return null; const price = Array.isArray(p.sizes) && p.sizes.length ? p.sizes[0].price : p.price; return { id: p.id, label: str(p.label, 80), price: Number(price) || 0, priceText: money(price) }; };
/** The quick picks for this client: their past products first, then what their delivered packages included; [] without any print. */
export function reorderPicks(client, projects, orders) {
  const had = new Set();
  for (const o of (Array.isArray(orders) ? orders : [])) if (o && String(o.leadId) === String(client?._id) && o.status === 'delivered') for (const it of (Array.isArray(o.items) ? o.items : [])) if (it?.productId) had.add(String(it.productId));
  for (const p of clientProjects(client, projects)) if ((p.deliveredAt || p.stage === 'delivered') && PRINT_PACKAGES[p.packageId]) PRINT_PACKAGES[p.packageId].forEach(id => had.add(id));
  if (!had.size) return [];
  const ids = [...REORDER_PICK_IDS.filter(id => had.has(id)), ...REORDER_PICK_IDS.filter(id => !had.has(id))];
  return ids.map(pickOf).filter(Boolean);
}
/* Site changes (prompt 4): a client on Site Care or Growth with a website project can ask for a change; each ask is a task on
 * their Portal list ("Site change: <first 60 characters>", the whole text in the note, the image as the link) and a line in
 * portal.siteChanges (the last ten, written only by the public door). The card shows the last three with the task's state. */
export const SITE_CHANGE_MAX = 600;
export const SITE_CHANGE_PLANS = ['site-care', 'growth'];
export const SITE_CHANGES_KEPT = 10;
export const isWebProject = (p) => p?.kind === 'website' || p?.kind === 'web' || p?.kind === 'combined';
export function siteChangesOf(client) {
  const log = Array.isArray(client?.portal?.siteChanges) ? client.portal.siteChanges : [];
  const tasks = (Array.isArray(client?.checklists) ? client.checklists : []).flatMap(l => (Array.isArray(l?.items) ? l.items : []));
  return log.slice(-3).reverse().map(e => { const t = tasks.find(x => x?.id === e?.taskId); return { id: str(e?.id, 24), text: str(e?.text, 80), at: str(e?.at, 40), image: !!e?.image, done: !t || !!t.done }; }).filter(e => e.id && e.text);
}
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };

export const PORTAL_MODULES = [
  {
    id: 'home', title: 'Home', order: 0, sensitive: false, defaultState: 'on', fixed: true,
    auto: 'Always on: their logo, a hello by first name, and where the newest project is.',
    fields: ['status'],
    resolve(client, projects) {
      const p = newestActiveProject(client, projects);
      return { status: p ? `${str(p.name, 80) || 'Your project'}: ${STAGE_LABELS[p.stage] || 'In progress'}` : 'All set' };
    },
  },
  {
    id: 'contact', title: 'Message Rob', order: 170, sensitive: false, defaultState: 'auto',
    auto: 'Shows when my phone or email is set under Settings, Profile.',
    fields: ['sms', 'mailto', 'instagram', 'hours'],
    resolve(client, projects, settings) {
      /* Ready hrefs, never the raw values: a card payload carries no phone or email field (portal-test's forbidden keys). */
      const pr = settings?.profile || {};
      const digits = str(pr.phone, 32).replace(/[^\d+]/g, ''); const email = str(pr.email, 120);
      if (!digits && !email) return null;
      return { sms: digits ? `sms:${digits}` : '', mailto: email ? `mailto:${email}` : '', instagram: 'visualizetm', hours: str(client?.portal?.hours, 120) || str(pr.hours, 120) };
    },
  },
  {
    id: 'book', title: 'Book a call', order: 160, sensitive: false, defaultState: 'auto',
    auto: 'Shows when a Calendly link is set under Settings, Profile, else the studio link from the config; off hides it.',
    fields: ['url'],
    resolve(client, projects, settings) {
      const url = str(settings?.profile?.calendlyLink, 400) || str(settings?.meetingLink, 400);
      return /^https:\/\//i.test(url) ? { url } : null;
    },
  },
  {
    id: 'documents', title: 'Your documents', order: 150, sensitive: false, defaultState: 'auto',
    auto: 'Shows when at least one document link is on the list.',
    fields: ['items'],
    resolve(client) {
      const items = (Array.isArray(client?.portal?.documents) ? client.portal.documents : [])
        .filter(d => d && /^https?:\/\//i.test(String(d.url || '')) && str(d.label, 120))
        .map(d => ({ id: str(d.id, 40), label: str(d.label, 120), url: str(d.url, 600), kind: DOCUMENT_KIND_IDS.includes(d.kind) ? d.kind : 'link' }));
      return items.length ? { items } : null;
    },
  },
  {
    id: 'showcase', title: 'Your showcase', order: 130, sensitive: false, defaultState: 'auto',
    auto: 'Shows when their showcase is published.',
    fields: ['url', 'slug', 'message'],
    resolve(client) {
      const sh = client?.showcase || {};
      if (!sh.published || !str(sh.slug, 80)) return null;
      const url = `https://visualizestudio.org/clients/${str(sh.slug, 80)}`;
      return { url, slug: str(sh.slug, 80), message: `New look for ${portalBusiness(client)}, made with Visualize: ${url}` };
    },
  },
  {
    id: 'pay', title: 'Pay', order: 20, sensitive: true, defaultState: 'auto',
    auto: 'Shows the oldest open invoice I have sent (a payment plan shows its next installment); gone once it is paid.',
    fields: ['label', 'amountText', 'amount', 'due', 'pastDue', 'plan', 'methods', 'hint'],
    resolve(client, projects, settings) {
      const hit = oldestOpenInvoice(client, projects);
      if (!hit) return null;
      let { line, project } = hit;
      if (project.plan?.months) { const next = planLines(project).find(l => !isPaid(l)); if (next) line = next; }
      const methods = payMethods(settings?.profile, line.amount, line.label, line.payUrl);
      return {
        label: str(line.label, 120) || 'Invoice', amountText: money(line.amount), amount: Number(line.amount) || 0, due: dateOf(line.dueAt),
        pastDue: invoiceStatus(line) === 'past-due', plan: !!project.plan?.months, methods,
        hint: methods.some(m => m.id !== 'card') ? "Sent one of these? It'll show as paid once I see it, usually the same day." : '',
      };
    },
  },
  {
    id: 'plan', title: 'Payment plan', order: 25, sensitive: true, defaultState: 'auto',
    auto: 'Shows on a payment plan with installments still to pay: which one is next and the dots so far.',
    fields: ['n', 'of', 'nextAmountText', 'nextDue', 'dots', 'line'],
    resolve(client, projects) {
      for (const p of clientProjects(client, projects)) {
        const lines = planLines(p); if (!lines.length) continue;
        const paid = lines.filter(l => isPaid(l)).length; const next = lines.find(l => !isPaid(l)); if (!next) continue;
        return { n: paid + 1, of: lines.length, nextAmountText: money(next.amount), nextDue: dateOf(next.dueAt), dots: lines.map(l => (isPaid(l) ? 'paid' : 'open')), line: 'Your files unlock after the last payment.' };
      }
      return null;
    },
  },
  {
    id: 'retainer', title: 'Retainer', order: 140, sensitive: true, defaultState: 'auto',
    auto: 'Shows the active retainer (plan, price, renewal, the cancel notice). With none and a delivered project, offers the one plan that fits when its Stripe link is set in Settings.',
    fields: ['mode', 'name', 'priceText', 'renews', 'notice', 'sms', 'mailto', 'url', 'pitch'],
    resolve(client, projects, settings) {
      const pr = settings?.profile || {};
      const digits = str(pr.phone, 32).replace(/[^\d+]/g, ''); const email = str(pr.email, 120);
      const active = activeRetainer(client);
      if (active) {
        const { plan, r } = active;
        const next = dateOf(r.nextBillAt);
        return { mode: 'active', name: plan.label, priceText: `${money(r.amount || plan.price)} a month`, renews: next ? `Renews ${next}` : `Renews on the ${ordinal(Number(r.billDay) || 1)} each month`, notice: '30 day cancel notice', sms: digits ? `sms:${digits}` : '', mailto: email ? `mailto:${email}` : '' };
      }
      const offer = retainerToOffer(client, projects);
      if (!offer) return null;
      const url = str(pr.retainerLinks?.[offer.id], 400);
      if (!/^https:\/\//i.test(url)) return null;
      return { mode: 'offer', name: offer.label, priceText: `${money(offer.price)} a month`, url, pitch: `Keep it running: ${offer.included.slice(0, 3).join(', ').toLowerCase()}. Cancel any time with 30 days notice.` };
    },
  },
  {
    id: 'progress', title: 'Your project', order: 60, sensitive: false, defaultState: 'auto',
    auto: 'Shows the newest active project: its stages as a track and where it is, in one line.',
    fields: ['name', 'pkg', 'stages', 'stage', 'line'],
    resolve(client, projects) {
      const p = newestActiveProject(client, projects) || clientProjects(client, projects).filter(x => x.kind !== 'retainer').sort((a, b) => (Date.parse(b.deliveredAt || b.createdAt || '') || 0) - (Date.parse(a.deliveredAt || a.createdAt || '') || 0))[0];
      if (!p) return null;
      const stages = (Array.isArray(p.stages) && p.stages.length ? p.stages : stagesFor(p.kind)).map(id => ({ id: str(id, 20), label: STAGE_LABELS[id] || str(id, 20) }));
      return { name: str(p.name, 80) || 'Your project', pkg: str(p.packageId, 40).replace(/-/g, ' '), stages, stage: str(p.stage, 20), line: stageLine(p, p.kind) };
    },
  },
  {
    id: 'revisions', title: 'Revisions', order: 70, sensitive: false, defaultState: 'auto',
    auto: 'Shows during the revisions stage: the round in use of the rounds included, and the extra round price on the last included one.',
    fields: ['used', 'max', 'line', 'last'],
    resolve(client, projects) {
      const p = newestActiveProject(client, projects);
      if (!p || p.stage !== 'revisions') return null;
      const used = revisionsUsed(p); const max = revisionsMax(p); const last = max > 0 && used === max - 1;
      const kind = (p.kind === 'web' || p.kind === 'website' || p.kind === 'combined') ? 'web' : 'design';
      return { used, max, last, line: last ? `This is your last included round. Extra rounds are ${money(EXTRA_ROUND.design)} for design and ${money(EXTRA_ROUND.web)} for web.` : `Round ${used} of ${max} used.${used >= max ? ` Extra rounds are ${money(extraRoundFee(kind))} each.` : ''}` };
    },
  },
  {
    id: 'needs_you', title: 'Needs you', order: 10, sensitive: false, defaultState: 'auto',
    auto: 'Shows what is waiting on them: open checklist items marked Needs the client, on the client and the active project. Sits right after home.',
    fields: ['items'],
    resolve(client, projects) { const items = clientItems(client, projects); return items.length ? { items } : null; },
  },
  {
    id: 'files', title: 'Your files', order: 90, sensitive: true, defaultState: 'auto',
    auto: 'Shows the project\'s deliverables: names only until the project is paid in full, then every link, with the Drive folder first. The gate runs on the server.',
    fields: ['unlocked', 'line', 'drive', 'groups'],
    resolve(client, projects) {
      const p = filesProject(client, projects);
      if (!p) return null;
      const unlocked = paidInFull(p);
      const groups = [];
      for (const d of p.deliverables) {
        if (!d || !str(d.label, 120)) continue;
        const g = str(d.group, 8) || 'files';
        let row = groups.find(x => x.group === g); if (!row) { row = { group: g, items: [] }; groups.push(row); }
        /* The gate: before full payment a row is its label and nothing else; the link never leaves the server. */
        row.items.push(unlocked ? { label: str(d.label, 120), url: /^https?:\/\//i.test(String(d.link || '')) ? str(d.link, 400) : '' } : { label: str(d.label, 120) });
      }
      if (!groups.length) return null;
      const drive = unlocked && /^https?:\/\//i.test(String(p.links?.drive || '')) ? str(p.links.drive, 400) : '';
      return { unlocked, line: unlocked ? 'Everything is yours. Keep a copy somewhere safe.' : 'Unlocks when the project is paid in full.', drive, groups };
    },
  },
  {
    id: 'brand_kit', title: 'Brand kit', order: 100, sensitive: false, defaultState: 'auto',
    auto: 'Shows after a brand project is delivered and the record has brand colours: the mark, the colours to copy, the fonts.',
    fields: ['logoUrl', 'colors', 'fonts'],
    resolve(client, projects) {
      if (!deliveredBrandProject(client, projects)) return null;
      const b = client?.brand || {};
      const colors = [];
      for (const c of [b.primary, ...(Array.isArray(b.colors) ? b.colors : [])]) { const hex = hexOf(c); if (hex && !colors.some(x => x.hex === hex)) colors.push({ hex, name: c && typeof c === 'object' ? str(c.name, 60) : '' }); }
      if (!colors.length) return null;
      const fonts = [str(b.fontDisplay, 120), str(b.fontBody, 120)].filter(Boolean).filter((f, i, a) => a.indexOf(f) === i);
      return { logoUrl: portalLogo(client), colors, fonts };
    },
  },
  {
    id: 'planner', title: 'Content planner', order: 50, sensitive: false, defaultState: 'auto',
    auto: 'Shows when the planner is on and has its link: this week\'s posts, how many need them, the ads live. Opens the planner with a way back.',
    fields: ['url', 'posts', 'needYou', 'adsLive', 'line'],
    resolve(client, projects, settings, ctx = {}) {
      const url = plannerLink(client);
      if (!url) return null;
      const c = plannerCounts(client, ctx.posts, ctx.todayKey);
      const line = `This week: ${c.posts} post${c.posts === 1 ? '' : 's'}, ${c.needYou} need${c.needYou === 1 ? 's' : ''} you${c.adsLive ? `. ${c.adsLive} ad${c.adsLive === 1 ? '' : 's'} live` : ''}`;
      return { url, posts: c.posts, needYou: c.needYou, adsLive: c.adsLive, line };
    },
  },
  {
    id: 'concepts', title: 'Concepts', order: 40, sensitive: false, defaultState: 'auto',
    auto: 'Shows the newest shared concept set (sent, not archived) with where it stands; an approved set sinks to the bottom. Opens the presentation with a way back.',
    fields: ['url', 'name', 'state', 'stateLabel', 'cover'],
    resolve(client, projects, settings, ctx = {}) {
      const set = sharedConceptSet(client, ctx.sets);
      if (!set) return null;
      const state = conceptState(set);
      const first = (Array.isArray(set.directions) ? set.directions : []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))[0];
      const cover = (Array.isArray(first?.items) ? first.items : []).map(it => str(it?.image, 600)).find(u => /^https?:\/\//i.test(u)) || '';
      return { url: `/concepts/${set.token}${fromPortal()}`, name: str(set.title, 120) || 'Concepts', state, stateLabel: CONCEPT_STATE_LABEL[state], cover, _order: state === 'approved' ? 155 : undefined };
    },
  },
  {
    id: 'review', title: 'How did I do?', order: 110, sensitive: false, defaultState: 'auto',
    auto: 'Shows once the newest project is delivered and the review link exists, until a review comes in.',
    fields: ['url', 'line'],
    resolve(client, projects) {
      const p = newestProject(client, projects);
      if (!p || !p.deliveredAt) return null;
      const url = reviewLink(client);
      if (!url || hasTestimonial(client)) return null;
      return { url, line: 'A minute of your time, and it helps more than you know.' };
    },
  },
  {
    id: 'their_reviews', title: 'Your reviews', order: 120, sensitive: false, defaultState: 'auto',
    auto: 'Shows when they have a review card or a Google review link: the link with Copy, its QR, and their count since we started. Never the Visualize review.',
    fields: ['googleLink', 'count', 'diff', 'line', 'nfcCard'],
    resolve(client) {
      const r = client?.reviews || {};
      const googleLink = /^https:\/\//i.test(String(r.googleLink || '')) ? str(r.googleLink, 400) : '';
      if (!r.nfcCard && !googleLink) return null;
      const latest = Number(r.latest?.count); const base = Number(r.baseline?.count);
      const diff = Number.isFinite(latest) && Number.isFinite(base) && latest - base > 0 ? latest - base : 0;
      return { googleLink, count: Number.isFinite(latest) ? latest : null, diff, line: theirReviewsLine(r), nfcCard: !!r.nfcCard };
    },
  },
  {
    id: 'meetings', title: 'Your next call', order: 80, sensitive: false, defaultState: 'auto',
    auto: 'Shows the next call booked with me on Calendly under their email (looked up at most every fifteen minutes); nothing booked, nothing shown.',
    fields: ['at', 'end', 'name', 'join'],
    resolve(client, projects, settings, ctx = {}) {
      const m = ctx.meeting;
      if (!m || !m.at || Date.parse(m.at) < Date.now() - 60 * 60e3) return null;
      return { at: str(m.at, 40), end: str(m.end, 40), name: str(m.title, 120) || 'Call with Rob', join: /^https:\/\//i.test(String(m.join || '')) ? str(m.join, 400) : '' };
    },
  },
  {
    id: 'approvals', title: 'Approvals', order: 30, sensitive: false, defaultState: 'auto',
    auto: 'Shows when something waits on their sign off; an answer stays on the card for seven days.',
    fields: ['items'],
    resolve(client) { const items = approvalsOf(client); return items.some(a => a.status === 'pending') ? { items } : null; },
  },
  {
    id: 'site_changes', title: 'Need a change on your site?', order: 85, sensitive: false, defaultState: 'auto',
    auto: 'Renders on an active Site Care or Growth retainer with a website project; the last three asks with their state.',
    fields: ['max', 'recent', 'line'],
    resolve(client, projects) {
      const ret = activeRetainer(client);
      if (!ret || !SITE_CHANGE_PLANS.includes(ret.plan.id)) return null;
      if (!clientProjects(client, projects).some(isWebProject)) return null;
      return { max: SITE_CHANGE_MAX, recent: siteChangesOf(client), line: 'Tell me what to change. A picture helps.' };
    },
  },
  {
    id: 'reorder', title: 'Need more printed?', order: 95, sensitive: false, defaultState: 'auto',
    auto: 'Shows once they have had print from me (a delivered print order, or a delivered package with stickers or cards): quick picks priced from pricing.js, a note, and I invoice as today.',
    fields: ['picks', 'maxQty', 'line'],
    resolve(client, projects, settings, ctx = {}) {
      const picks = reorderPicks(client, projects, ctx.orders);
      if (!picks.length) return null;
      return { picks, maxQty: REORDER_MAX_QTY, line: "Pick what you need and I'll send you a payment link." };
    },
  },
];
export const PORTAL_TEMPLATES = {
  brand: { contact: 'auto', book: 'auto', documents: 'auto', showcase: 'auto', pay: 'auto', plan: 'auto', retainer: 'auto', progress: 'auto', revisions: 'auto', needs_you: 'auto', files: 'auto', brand_kit: 'auto', concepts: 'auto', review: 'auto', approvals: 'auto', reorder: 'auto' },
  website: { contact: 'auto', book: 'auto', documents: 'auto', showcase: 'auto', pay: 'auto', plan: 'auto', retainer: 'auto', progress: 'auto', revisions: 'auto', needs_you: 'auto', files: 'auto', concepts: 'auto', review: 'auto', meetings: 'auto', approvals: 'auto', reorder: 'auto', site_changes: 'auto' },
  retainer: { contact: 'auto', book: 'auto', documents: 'auto', showcase: 'auto', pay: 'auto', retainer: 'auto', needs_you: 'auto', planner: 'auto', their_reviews: 'auto', meetings: 'auto', approvals: 'auto', reorder: 'auto', site_changes: 'auto' },
};
export const RETAINER_IDS = RETAINERS.map(r => r.id);
export const portalModuleOf = (id) => PORTAL_MODULES.find(m => m.id === id) || null;
/** The state a module is in for this client: the stored one, else its default; home is always on. */
export const portalStateOf = (client, id, mod = null) => { const m = mod || portalModuleOf(id); if (!m) return 'off'; if (m.fixed) return 'on'; const s = client?.portal?.modules?.[id]; return PORTAL_STATE_IDS.includes(s) ? s : m.defaultState; };
/** Only the whitelisted fields of a resolve's answer. */
export const cardOf = (m, data) => { const out = { id: m.id, title: m.title, sensitive: !!m.sensitive }; for (const k of m.fields) if (data && data[k] !== undefined) out[k] = data[k]; return out; };
/** Every card the page gets, in order: off never renders, on and auto render when resolve has data; a sensitive card is locked until the device unlocked it. */
export function portalCards(client, projects, settings, { unlocked = false, modules = PORTAL_MODULES, ctx = {} } = {}) {
  const rows = [];
  for (const m of modules) {
    if (portalStateOf(client, m.id, m) === 'off') continue;
    let data = null;
    try { data = m.resolve(client, projects, settings, ctx); } catch { data = null; }
    if (!data) continue;
    /* A resolve may move its own card (_order) for one state, an approved concept set for one; the key never leaves. */
    const order = Number.isFinite(Number(data._order)) ? Number(data._order) : m.order;
    rows.push({ order, card: m.sensitive && !unlocked ? { id: m.id, title: m.title, sensitive: true, locked: true } : cardOf(m, data) });
  }
  return rows.sort((a, b) => a.order - b.order).map(r => r.card);
}
/** What the page may know about the client, and nothing else. */
export const portalClient = (client) => ({ firstName: portalFirstName(client), business: portalBusiness(client), logoUrl: portalLogo(client), brandHex: portalBrandHex(client) });
export const portalUrl = (client) => (client?.portal?.token ? `${PORTAL_URL_BASE}${client.portal.token}` : '');
