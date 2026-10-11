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
import { RETAINERS, retainerOf, money, extraRoundFee, EXTRA_ROUND } from './pricing.js';

export const PORTAL_MODULE_IDS = ['home', 'contact', 'book', 'documents', 'showcase', 'pay', 'plan', 'retainer', 'progress', 'revisions', 'needs_you'];
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
export function payMethods(profile, amount, label) {
  const pm = profile?.payMethods || {};
  const out = [];
  const amt = Math.round(Number(amount) * 100) / 100;
  if (/^https:\/\//i.test(String(pm.stripe || ''))) out.push({ id: 'card', name: 'Card or Apple Pay', line: 'Pay securely through Stripe', url: String(pm.stripe).slice(0, 400) });
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
    id: 'contact', title: 'Message Rob', order: 10, sensitive: false, defaultState: 'auto',
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
    id: 'book', title: 'Book a call', order: 20, sensitive: false, defaultState: 'auto',
    auto: 'Shows when a Calendly link is set under Settings, Profile, else the studio link from the config; off hides it.',
    fields: ['url'],
    resolve(client, projects, settings) {
      const url = str(settings?.profile?.calendlyLink, 400) || str(settings?.meetingLink, 400);
      return /^https:\/\//i.test(url) ? { url } : null;
    },
  },
  {
    id: 'documents', title: 'Your documents', order: 30, sensitive: false, defaultState: 'auto',
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
    id: 'showcase', title: 'Your showcase', order: 40, sensitive: false, defaultState: 'auto',
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
    id: 'pay', title: 'Pay', order: 50, sensitive: true, defaultState: 'auto',
    auto: 'Shows the oldest open invoice I have sent (a payment plan shows its next installment); gone once it is paid.',
    fields: ['label', 'amountText', 'amount', 'due', 'pastDue', 'plan', 'methods', 'hint'],
    resolve(client, projects, settings) {
      const hit = oldestOpenInvoice(client, projects);
      if (!hit) return null;
      let { line, project } = hit;
      if (project.plan?.months) { const next = planLines(project).find(l => !isPaid(l)); if (next) line = next; }
      const methods = payMethods(settings?.profile, line.amount, line.label);
      return {
        label: str(line.label, 120) || 'Invoice', amountText: money(line.amount), amount: Number(line.amount) || 0, due: dateOf(line.dueAt),
        pastDue: invoiceStatus(line) === 'past-due', plan: !!project.plan?.months, methods,
        hint: methods.some(m => m.id !== 'card') ? "Sent one of these? It'll show as paid once I see it, usually the same day." : '',
      };
    },
  },
  {
    id: 'plan', title: 'Payment plan', order: 55, sensitive: true, defaultState: 'auto',
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
    id: 'retainer', title: 'Retainer', order: 60, sensitive: true, defaultState: 'auto',
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
    id: 'progress', title: 'Your project', order: 15, sensitive: false, defaultState: 'auto',
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
    id: 'revisions', title: 'Revisions', order: 16, sensitive: false, defaultState: 'auto',
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
    id: 'needs_you', title: 'Needs you', order: 5, sensitive: false, defaultState: 'auto',
    auto: 'Shows what is waiting on them: open checklist items marked Needs the client, on the client and the active project. Sits right after home.',
    fields: ['items'],
    resolve(client, projects) { const items = clientItems(client, projects); return items.length ? { items } : null; },
  },
];
export const PORTAL_TEMPLATES = {
  brand: { contact: 'auto', book: 'auto', documents: 'auto', showcase: 'auto', pay: 'auto', plan: 'auto', retainer: 'auto', progress: 'auto', revisions: 'auto', needs_you: 'auto' },
  website: { contact: 'auto', book: 'auto', documents: 'auto', showcase: 'auto', pay: 'auto', plan: 'auto', retainer: 'auto', progress: 'auto', revisions: 'auto', needs_you: 'auto' },
  retainer: { contact: 'auto', book: 'auto', documents: 'auto', showcase: 'auto', pay: 'auto', retainer: 'auto', needs_you: 'auto' },
};
export const RETAINER_IDS = RETAINERS.map(r => r.id);
export const portalModuleOf = (id) => PORTAL_MODULES.find(m => m.id === id) || null;
/** The state a module is in for this client: the stored one, else its default; home is always on. */
export const portalStateOf = (client, id, mod = null) => { const m = mod || portalModuleOf(id); if (!m) return 'off'; if (m.fixed) return 'on'; const s = client?.portal?.modules?.[id]; return PORTAL_STATE_IDS.includes(s) ? s : m.defaultState; };
/** Only the whitelisted fields of a resolve's answer. */
export const cardOf = (m, data) => { const out = { id: m.id, title: m.title, sensitive: !!m.sensitive }; for (const k of m.fields) if (data && data[k] !== undefined) out[k] = data[k]; return out; };
/** Every card the page gets, in order: off never renders, on and auto render when resolve has data; a sensitive card is locked until the device unlocked it. */
export function portalCards(client, projects, settings, { unlocked = false, modules = PORTAL_MODULES } = {}) {
  const cards = [];
  for (const m of [...modules].sort((a, b) => a.order - b.order)) {
    if (portalStateOf(client, m.id, m) === 'off') continue;
    let data = null;
    try { data = m.resolve(client, projects, settings); } catch { data = null; }
    if (!data) continue;
    if (m.sensitive && !unlocked) { cards.push({ id: m.id, title: m.title, sensitive: true, locked: true }); continue; }
    cards.push(cardOf(m, data));
  }
  return cards;
}
/** What the page may know about the client, and nothing else. */
export const portalClient = (client) => ({ firstName: portalFirstName(client), business: portalBusiness(client), logoUrl: portalLogo(client), brandHex: portalBrandHex(client) });
export const portalUrl = (client) => (client?.portal?.token ? `${PORTAL_URL_BASE}${client.portal.token}` : '');
