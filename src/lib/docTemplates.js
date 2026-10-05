import { EXTRA_ROUND, REVISION_ROUNDS, DEPOSIT_PCT, packageOf, money, planFor } from '../shared/pricing';
import { dealOf } from './deal';
import { dealPackageLabel, dealTotal, dealPlanLine } from './dealConvert';
import { invoicesOf, invoicesOwed } from './invoices';
import { blockId } from '../shared/docBlocks';
import { fmtDate, fmtDateTime } from '../shared/dates';

/* Doc templates (docs job, milestone 4). A template is a title, a type and blocks whose text may carry [tokens]. Creating a doc from one
 * fills the tokens this client can answer as plain text, a snapshot (the doc never changes when the client does), and leaves every other
 * token as a visible placeholder such as [deposit date], so a blank is something Rob can see and type over, never a guess.
 *
 *   BUILTIN_TEMPLATES   Blank, Project brief, Call notes, Contract, Delivery notes, Brand notes
 *   clientFields(lead, projects, now)   the tokens this client can answer, from the lead, its deal and its project
 *   fillBlocks(blocks, fields)          replace known tokens in every text run; unknown ones stay
 *   buildDoc(template, ctx)             { title, type, blocks, projectId } for a new doc
 *
 * The house rules the contract states (rounds, extra round prices, the deposit, files at full payment) come from src/shared/pricing.js and
 * are always filled: a price that changes there changes here. There was no contract wording anywhere in the app before this, so the
 * contract is headings and the stated rules, with [placeholders] for the rest; nothing about ownership or usage is invented. */
const T = (t) => ({ t });
const mk = (type, text, extra = {}) => ({ id: blockId(), type, ...(type === 'divider' ? {} : { runs: text ? [T(text)] : [] }), ...extra });
const h2 = (t) => mk('h2', t); const p = (t) => mk('p', t); const ul = (t) => mk('ul', t); const check = (t) => mk('check', t, { checked: false });

export const BUILTIN_TEMPLATES = [
  { id: 'blank', label: 'Blank', type: 'general', blurb: 'Start from nothing.', title: 'Untitled', build: () => [] },
  { id: 'brief', label: 'Project brief', type: 'brief', blurb: 'What they need, who it is for, the look, the dates.', title: 'Project brief, [client name]', build: () => [
    p('Client: [client name]. Contact: [contact person].'),
    h2('What they need'), p('[what they need]'),
    h2('Package and price'), p('[package], [price].'),
    h2('Who it is for'), p('[audience]'),
    h2('Look and feel'), p('[style, colors, examples they like]'),
    h2('Must haves'), ul('[must have]'),
    h2('Dates'), p('Start: [project start date]. Deliver by: [delivery date].'),
    h2('Open questions'), check('[question to ask them]'),
  ] },
  { id: 'call-notes', label: 'Call notes', type: 'call-notes', blurb: 'Date, who was on, what they need, budget, next step, follow up.', title: 'Call notes, [client name]', build: () => [
    h2('Call'), p('Date and time: [date and time]'), p('On the call: [my name] and [contact person]'),
    h2('What they need'), p('[what they need]'),
    h2('Budget'), p('[budget]'),
    h2('Next step'), p('[next step]'),
    h2('Follow up'), check('Follow up on [follow up date]'),
  ] },
  { id: 'contract', label: 'Contract', type: 'contract', blurb: 'Scope, price and payments, revisions, timeline, files, agreement.', title: 'Agreement, [client name]', build: () => [
    p('This agreement is between [my name] of Visualize and [client name]. It covers the work below.'),
    h2('Scope'), p('Package: [package].'), ul('[what is included]'),
    h2('Price and payment plan'),
    p('Total price: [price]. Payment plan: [payment plan].'),
    p('A [deposit percent] deposit of [deposit] is due before work starts, on [deposit date]. The balance is due [balance date].'),
    p('Files are released only at full payment.'),
    h2('Revisions'),
    p('The price includes [revision rounds] revision rounds. A round is one set of changes sent together.'),
    p('Extra rounds are [extra round design] for design work and [extra round web] for web work.'),
    h2('Timeline'), p('Work starts on [project start date], once the deposit is paid. Delivery by [delivery date].'),
    h2('Files and ownership'), p('Files are released only at full payment.'), p('[ownership and usage terms]'),
    h2('Agreement'), p('By signing, [client name] agrees to the scope, price and terms above.'),
    p('Signed for [client name]: [client signature], [date signed]'), p('Signed for Visualize: [my name], [date signed]'),
  ] },
  { id: 'delivery', label: 'Delivery notes', type: 'delivery', blurb: 'What goes out, the balance, the handover steps.', title: 'Delivery notes, [client name]', build: () => [
    h2('What is being delivered'), p('Package: [package].'), ul('[file or deliverable]'),
    h2('Before the files go out'), p('Files are released only at full payment. Balance owed: [balance owed].'),
    h2('Handover'), check('Share the Drive folder'), check('Send the delivery email'), check('Ask for a review'),
    h2('Notes'), p('[notes]'),
  ] },
  { id: 'brand-notes', label: 'Brand notes', type: 'brand-notes', blurb: 'Voice, colors, fonts, logo, links.', title: 'Brand notes, [client name]', build: () => [
    h2('What they do'), p('[what they do]'),
    h2('Voice and tone'), p('[voice and tone]'),
    h2('Colors'), p('[colors]'), h2('Fonts'), p('[fonts]'), h2('Logo'), p('[logo notes]'),
    h2('Links'), p('Website: [website]'), p('Instagram: [instagram]'),
  ] },
];
export const builtinOf = (id) => BUILTIN_TEMPLATES.find(t => t.id === id) || null;

/** The project a new doc is about: the client's only live project, else none. */
export const defaultProject = (projects, leadId) => { const mine = (projects || []).filter(x => String(x.leadId) === String(leadId) && !x.archived); return mine.length === 1 ? mine[0] : null; };

/** Every token this client can answer, as { token: text }. A token with no answer is absent, so it stays a placeholder. */
export function clientFields(lead, projects = [], now = Date.now()) {
  const f = {};
  const set = (k, v) => { const s = String(v ?? '').trim(); if (s) f[k] = s; };
  const proj = defaultProject(projects, lead?._id) || (projects || []).find(x => String(x.leadId) === String(lead?._id) && !x.archived) || null;
  const deal = dealOf(lead);
  set('client name', lead?.business);
  set('contact person', lead?.askFor);
  set('my name', 'Rob');
  set('date', fmtDate(now)); set('date and time', fmtDateTime(now));
  /* The package, the price and the plan: the project once there is one, else the deal that is still being agreed. */
  const pkgId = proj?.packageId || deal.packageId;
  const pkg = pkgId ? packageOf(pkgId) : null;
  set('package', proj ? (proj.name || pkg?.label) : (dealPackageLabel(deal) || pkg?.label));
  const total = proj ? Number(proj.total) || 0 : dealTotal(deal);
  if (total) {
    set('price', money(total));
    set('deposit', money(Math.round((total * DEPOSIT_PCT) / 100)));
    const plan = proj?.plan?.months ? `${money(proj.plan.monthly)} a month for ${proj.plan.months} months` : (!proj && deal.plan?.months ? dealPlanLine(deal) : (planFor(total, pkgId) ? '' : 'One payment'));
    set('payment plan', plan);
  }
  if (pkg?.included?.length) set('what is included', pkg.included.join(', '));
  const start = proj ? invoicesOf(proj).map(i => i.dueAt).filter(Boolean).sort()[0] : '';
  set('project start date', start ? fmtDate(start) : '');
  set('revision rounds', proj?.revisions?.max ?? REVISION_ROUNDS);
  set('extra round design', money(EXTRA_ROUND.design)); set('extra round web', money(EXTRA_ROUND.web));
  set('deposit percent', `${DEPOSIT_PCT} percent`);
  if (proj) { const owed = invoicesOwed(invoicesOf(proj), now); set('balance owed', money(owed)); }
  set('website', lead?.links?.website || lead?.socials?.website);
  set('instagram', lead?.links?.instagram || lead?.socials?.instagram);
  return f;
}

/** Replace the [tokens] a field answers, in every run of every text block; anything else stays as typed. */
export function fillText(text, fields) { return String(text).replace(/\[([^\]\n]{1,60})\]/g, (m, k) => (fields[k.trim().toLowerCase()] !== undefined ? fields[k.trim().toLowerCase()] : m)); }
export function fillBlocks(blocks, fields) {
  return (blocks || []).map(b => (Array.isArray(b.runs) ? { ...b, id: blockId(), runs: b.runs.map(r => ({ ...r, t: fillText(r.t, fields) })) } : { ...b, id: blockId() }));
}
/** The tokens left in a doc: what still needs typing. */
export const placeholdersIn = (blocks) => [...new Set((blocks || []).flatMap(b => (b.runs || []).flatMap(r => [...String(r.t).matchAll(/\[([^\]\n]{1,60})\]/g)].map(m => m[0]))))];

/** A new doc from a template (a built in one or a saved one): { title, type, blocks, projectId }. */
export function buildDoc(template, { lead, projects = [], now = Date.now() } = {}) {
  const fields = clientFields(lead, projects, now);
  const raw = typeof template.build === 'function' ? template.build() : (template.blocks || []);
  const proj = defaultProject(projects, lead?._id);
  return { title: fillText(template.title || 'Untitled', fields).slice(0, 160), type: template.type || 'general', blocks: fillBlocks(raw, fields), projectId: proj ? String(proj._id) : '' };
}

/** The templates the New doc sheet offers: built in (hidden ones out, Blank never) and saved, in the saved order. prefs = { hidden, order } of ids. */
export function offered(saved, prefs = {}) {
  const hidden = new Set(prefs.hidden || []);
  const all = [...BUILTIN_TEMPLATES.map(t => ({ ...t, key: t.id, builtin: true })), ...(saved || []).map(t => ({ ...t, key: String(t._id), builtin: false, label: t.title }))];
  const order = prefs.order || [];
  const rank = (t) => { const i = order.indexOf(t.key); return i < 0 ? 1e6 + all.indexOf(t) : i; };
  return all.filter(t => !(t.builtin && t.id !== 'blank' && hidden.has(t.key))).sort((a, b) => rank(a) - rank(b));
}
/** Everything Settings manages, hidden built in ones included. */
export function managed(saved, prefs = {}) {
  const hidden = new Set(prefs.hidden || []);
  const all = [...BUILTIN_TEMPLATES.filter(t => t.id !== 'blank').map(t => ({ ...t, key: t.id, builtin: true, hidden: hidden.has(t.id) })), ...(saved || []).map(t => ({ ...t, key: String(t._id), builtin: false, hidden: false, label: t.title }))];
  const order = prefs.order || [];
  const rank = (t) => { const i = order.indexOf(t.key); return i < 0 ? 1e6 + all.indexOf(t) : i; };
  return all.sort((a, b) => rank(a) - rank(b));
}
