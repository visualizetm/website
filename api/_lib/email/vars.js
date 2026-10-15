/* The email variables (the email system, milestone 2): one resolver map from
 * the records to the values a template may read. Every value is a string
 * (dates like "Oct 22, 2026" in America/New_York, money like "$300") or a
 * list a `from` block expands; an empty value is a missing field the
 * renderer reports and the send route refuses on. Server only: the
 * records never leave the server, only what the template printed. */
import { packageOf, addonOf, money, retainerOf, defaultRetainer, EXTRA_ROUND, REVISION_ROUNDS, gifts } from '../pricing.js';
import { meetingLink } from '../config.js';
import { invoicesOf, invoiceStatus, invoicesTotal, invoicesPaid } from '../invoices.js';
import { dealOf } from '../deal.js';
import { ZONE, zoneDayMs, DAY_KEY } from '../zone.js';
import { serviceOf } from './templates.js';
import { portalUrl, retainerToOffer, clientProjects, planLines } from '../portalModules.js';

export const SITE = 'https://visualizestudio.org';
export const START_FORM_LINK = `${SITE}/start`;
const GROUP_NAMES = { '01': 'Brand Files', '02': 'Web Files', '03': 'Print Files', '04': 'Source Files' };
const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const ms = (v) => { if (!v) return NaN; const s = String(v); return DAY_KEY.test(s.slice(0, 10)) && s.length <= 10 ? zoneDayMs(s) : Date.parse(s); };
/** "Oct 22, 2026" in the studio's zone, from a day key or an instant. */
export function fmtDay(v) {
  const t = ms(v); if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: ZONE, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(t));
}
/** "Wed, Oct 22 at 2:00 PM" for a meeting's date and HH:MM. */
export function fmtMeeting(date, time) {
  if (!DAY_KEY.test(String(date || ''))) return '';
  const [h, m] = String(time || '09:00').split(':').map(Number);
  const t = zoneDayMs(date) + ((h || 0) * 60 + (m || 0)) * 60e3;
  const day = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(t));
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' }).format(new Date(t));
  return `${day} at ${clock}`;
}
export const firstNameOf = (lead) => str(lead?.askFor, 80).split(/[\s,]+/)[0] || '';
const https = (u) => (/^https?:\/\/[^\s]+$/i.test(String(u || '').trim()) ? String(u).trim().slice(0, 600) : '');

/** The deal's package, add-ons and the plan line's numbers: what onboarding and the invoice recap read. */
function packageVars(lead, project) {
  const deal = dealOf(lead);
  const packageId = deal.packageId || project?.packageId || '';
  const pkg = packageOf(packageId);
  const addonIds = (deal.addonIds?.length ? deal.addonIds : project?.addonIds) || [];
  const addons = addonIds.map(addonOf).filter(Boolean);
  const free = gifts(packageId).map(a => a.id);
  const paid = addons.filter(a => !free.includes(a.id));
  const total = (pkg?.price || 0) + paid.reduce((n, a) => n + a.price, 0);
  const includes = [...(pkg?.included || []), ...addons.map(a => a.label)];
  return { packageId, pkg, addons, total, includes, name: pkg?.label || addons.map(a => a.label).join(', ') || (project?.name && !project?.packageId ? str(project.name, 160) : '') };
}

/** The deliverables grouped the way the Drive folder is: { name, note, count } per group that holds anything. */
export function deliverableGroups(project) {
  const out = [];
  for (const d of (Array.isArray(project?.deliverables) ? project.deliverables : [])) {
    if (!d || !str(d.label, 120)) continue;
    const id = str(d.group, 8) || '04';
    let g = out.find(x => x.id === id); if (!g) { g = { id, name: GROUP_NAMES[id] || `${id} Files`, labels: [] }; out.push(g); }
    g.labels.push(str(d.label, 120));
  }
  return out.sort((a, b) => a.id.localeCompare(b.id)).map(g => ({ name: g.name, note: g.labels.join(', '), count: g.labels.length }));
}

/** The one retainer to pitch: what the client had delivered says (Site Care for web, Content Kit for brand, Growth for both), else the package's default. */
export function retainerPick(lead, project, projects) {
  const offer = retainerToOffer(lead, projects) || retainerOf(defaultRetainer(dealOf(lead).packageId || project?.packageId || ''));
  return offer || null;
}

/**
 * resolveVars({ lead, project, invoice, projects, sets, settings, profile, now }) -> the flat map, dotted keys.
 * settings is the emails document (api/_lib/email/settings.js emailSettingsOf), profile the profile document.
 */
export function resolveVars({ lead, project = null, invoice = null, projects = [], sets = [], settings = {}, profile = {}, now = Date.now() } = {}) {
  const v = {};
  const deal = dealOf(lead);
  const pk = packageVars(lead, project);
  v.firstName = firstNameOf(lead);
  v.fullName = str(lead?.askFor, 120);
  v.business = str(lead?.showcase?.displayName || lead?.business, 160);
  v.email = str(lead?.email, 200);
  v.rob = str(settings?.signatureName, 80) || 'Rob';
  v.calendlyLink = https(settings?.calendlyLink) || https(profile?.calendlyLink) || https(meetingLink());
  v.startFormLink = START_FORM_LINK;
  v.siteLink = SITE;
  v.instagramLink = 'https://instagram.com/visualizetm';
  /* Concepts: the newest live set with a token (sent or later), never a draft. */
  const live = (Array.isArray(sets) ? sets : []).filter(s => s && String(s.leadId) === String(lead?._id) && !s.deleted && !s.archived && s.token && s.status && s.status !== 'draft').sort((a, b) => (Number(b.round) || 0) - (Number(a.round) || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const set = live[0] || null;
  v.conceptLink = set ? `${SITE}/concepts/${str(set.token, 64)}` : '';
  v.conceptCount = set ? String((Array.isArray(set.directions) ? set.directions : []).length || '') : '';
  const first = set ? [...(Array.isArray(set.directions) ? set.directions : [])].sort((a, b) => (a.order || 0) - (b.order || 0))[0] : null;
  v.conceptCover = first ? (Array.isArray(first.items) ? first.items : []).map(it => https(it?.image)).find(Boolean) || '' : '';
  v['meeting.time'] = fmtMeeting(lead?.meeting?.date, lead?.meeting?.time);
  v.portalLink = https(portalUrl(lead));
  v.plannerLink = lead?.planner?.enabled && lead?.planner?.token ? `${SITE}/planner/${str(lead.planner.token, 64)}` : '';
  v.showcaseLink = lead?.showcase?.published && lead?.showcase?.slug ? `${SITE}/projects/${str(lead.showcase.slug, 80)}` : '';
  v.reviewLink = lead?.reviews?.visualize?.token ? `${SITE}/r/${str(lead.reviews.visualize.token, 64)}` : '';
  v.contractLink = https(deal.contractLink) || https(project?.links?.contract);
  v.driveLink = https(project?.links?.drive) || https(lead?.links?.drive);
  v['package.name'] = pk.name;
  v['package.price'] = pk.total ? money(pk.total) : '';
  v['package.includes'] = pk.includes;
  v.service = serviceOf(pk.packageId);
  v['project.name'] = str(project?.name, 160);
  v['revisions.used'] = project ? String(Math.max(Number(project.revisions?.used) || 0, (Array.isArray(project.revisions?.log) ? project.revisions.log : []).filter(r => !r?.extra).length)) : '';
  v['revisions.max'] = project ? String(Number(project.revisions?.max) || REVISION_ROUNDS) : String(REVISION_ROUNDS);
  v['rounds.max'] = String(REVISION_ROUNDS);
  v['fees.extraDesign'] = money(EXTRA_ROUND.design);
  v['fees.extraWeb'] = money(EXTRA_ROUND.web);
  /* The invoice: the line Rob picked, with its totals against the lines it sits among (the project's, else the deal's). */
  const lines = project ? invoicesOf(project) : invoicesOf(deal);
  if (invoice) {
    /* The package total is the project's own price (the deal's package and add ons), never the sum of the lines drafted so far: a plan drafts a month at a time. */
    const total = Number(project?.total) || pk.total || invoicesTotal(lines) || 0;
    const paid = invoicesPaid(lines, now);
    const amount = Number(invoice.amount) || 0;
    const left = Math.max(0, total - paid - (invoiceStatus(invoice, now) === 'paid' ? 0 : amount));
    v['invoice.number'] = str(invoice.number, 20);
    v['invoice.kind'] = str(invoice.kind, 20) || (project?.plan?.months || deal.plan?.months ? 'plan' : paid > 0 && left === 0 ? 'final' : 'deposit');
    v['invoice.items'] = Array.isArray(invoice.items) && invoice.items.length ? invoice.items.map(it => ({ label: str(it?.label, 120), value: typeof it?.amount === 'number' ? money(it.amount) : str(it?.amount, 40) || 'Included' })) : [{ label: str(invoice.label, 120) || 'Invoice', value: money(amount) }];
    v['invoice.total'] = money(total);
    v['invoice.paidSoFar'] = money(paid);
    v['invoice.dueNow'] = money(amount);
    v['invoice.dueDate'] = fmtDay(invoice.dueAt);
    v['invoice.leftAfter'] = money(left);
    v['invoice.leftLine'] = left > 0 ? `After this one, ${money(left)} is left.` : 'This one settles it.';
    v['invoice.covers'] = str(invoice.label, 120) ? `This one covers ${str(invoice.label, 120).replace(/\.$/, '').replace(/^(the|a) /i, '').toLowerCase()}.` : '';
    v['invoice.stripeLink'] = https(invoice.payUrl);
    v['invoice.otherPayLink'] = v.portalLink;
    const kindTerms = settings?.invoiceTerms && Array.isArray(settings.invoiceTerms[v['invoice.kind']]) ? settings.invoiceTerms[v['invoice.kind']] : null;
    v['invoice.terms'] = kindTerms && kindTerms.length ? kindTerms.map(t => str(t, 300)) : [];
  }
  /* The plan: the project's installments. */
  const pl = project ? planLines(project) : [];
  if (pl.length) {
    const count = Number(project.plan?.months) || pl.length;
    const paidN = pl.filter(l => invoiceStatus(l, now) === 'paid').length;
    v['plan.count'] = String(count); v['plan.paid'] = String(paidN); v['plan.next'] = String(Math.min(count, paidN + 1));
  }
  /* The retainer to pitch, with its Stripe link from Settings. */
  const ret = retainerPick(lead, project, projects);
  if (ret) {
    v['retainer.name'] = ret.label; v['retainer.price'] = money(ret.price); v['retainer.line'] = ret.included.slice(0, 3).join(', ').toLowerCase();
    v['retainer.link'] = https(profile?.retainerLinks?.[ret.id]);
  }
  v['deliverables.groups'] = deliverableGroups(project);
  /* Delivery extras: a sticker sample pack with every package, an NFC card with Launch and Build. */
  if (pk.packageId) v.extrasLine = ['launch-plan', 'build-plan'].includes(pk.packageId) ? 'Your sticker sample pack and your NFC card are on their way.' : 'Your sticker sample pack is on its way.';
  else v.extrasLine = '';
  /* The active projects, for the rules. */
  v['projects.count'] = String(clientProjects(lead, projects).length);
  return v;
}
/** The variables a Compose chip shows: every key with a printable value, lists as a count. */
export const varRows = (vars) => Object.entries(vars).map(([key, value]) => ({ key, value: Array.isArray(value) ? `${value.length} item${value.length === 1 ? '' : 's'}` : String(value ?? '') }));
