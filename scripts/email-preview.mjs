#!/usr/bin/env node
/* Email previews (the email system, milestone 8): every template rendered on a
 * fixture record (Mike's Tacos: a deal on the Launch Plan with a deposit, a
 * final, a plan month 3 of 6 and a retainer month to bill, a brand and a web
 * delivery, the last revision round), written to docs/email-previews/<id>.html
 * (a variant as <id>--<variant>.html), one overview page and its montage
 * (docs/email-previews/overview.png) at 600 and 375 wide. The lint fails the run
 * on an unfilled {{variable}}, a value the fixture lacks, "undefined", "null",
 * the word AI or an em dash in any subject, text or html; scripts/email-test.mjs
 * runs the same lint over the same fixtures. Nothing here needs a database or a
 * key: the api/ tree runs on the in-memory mongo the tests use.
 *   npm run email:preview            node scripts/email-preview.mjs [--no-shot]
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const here = path.dirname(new URL(import.meta.url).pathname);
export const repoRoot = path.resolve(here, '..');
export const OUT_DIR = path.join(repoRoot, 'docs', 'email-previews');
export const WIDTHS = [600, 375];

const LEAD = '507f1f77bcf86cd799439081'; const PROJ = '507f1f77bcf86cd799439082'; const BRAND = '507f1f77bcf86cd799439083'; const WEB = '507f1f77bcf86cd799439084'; const RET = '507f1f77bcf86cd799439085'; const SETID = '507f1f77bcf86cd799439086';
const DAY = 864e5;
const key = (t) => new Date(t).toISOString().slice(0, 10);
const line = (id, label, amount, due, status, extra = {}) => ({ id, label, amount, dueAt: due, status, sentAt: status === 'draft' ? '' : new Date(Date.parse(due) - 7 * DAY).toISOString(), paidAt: status === 'paid' ? new Date(Date.parse(due) - 2 * DAY).toISOString() : '', note: '', ...extra });

/** The fixture: one lead, four projects, a concept set, the studio profile. `now` keeps the dates real (a plan month due in three days, a month paid last month). */
export function seedPreviews(_stores, _reset, now = Date.now()) {
  _reset();
  const soon = key(now + 3 * DAY); const lastMonth = key(now - 30 * DAY); const twoBack = key(now - 60 * DAY); const yesterday = key(now - DAY);
  _stores.call_leads = [{
    _id: LEAD, business: "Mike's Tacos", askFor: 'Mike Ramirez', email: 'mike@mikestacos.example', phone: '(718) 555-0142', stage: 'deal', callStatus: 'booked', meeting: { date: key(now + 2 * DAY), time: '14:00', type: 'video' },
    links: { drive: '' }, contactLog: [], socials: {}, callLog: [], purchases: [], conceptsOffered: new Date(now - DAY).toISOString(), nurture: { until: yesterday, reason: 'Opening in spring' },
    deal: { checkpoints: { concepts: null, introSent: { at: new Date(now - 4 * DAY).toISOString() }, callDone: { at: new Date(now - 3 * DAY).toISOString() }, onboardingSent: null, formReceived: null, contractSent: null, contractAgreed: null, invoiceSent: null, paid: null },
      packageId: 'launch-plan', addonIds: ['stickers'], plan: { months: 6, monthly: 200 }, contractLink: 'https://docs.example/contract/mikes-tacos', metAt: '', stalledSince: '',
      invoices: [line('dvdep', 'Deposit', 300, soon, 'sent', { kind: 'deposit', items: [{ label: 'Launch Plan deposit', amount: 300 }, { label: 'Stickers', amount: 'Included' }] })] },
    reviews: { visualize: { token: 'rvwPREVIEWtoken012345678', createdAt: new Date(now - DAY).toISOString(), regeneratedAt: '', views: 0, lastViewedAt: '', sentAt: '' }, asks: [] },
    planner: { enabled: true, token: 'plnrPREVIEWtoken01234567' }, portal: { enabled: true, token: 'prtlPREVIEWtoken01234567', pin: '', modules: {}, documents: [] },
    showcase: { published: true, slug: 'mikes-tacos', displayName: "Mike's Tacos" },
    checklists: [{ id: 'ck1', name: 'Onboarding', templateId: '', items: [{ id: 't1', text: 'Send your logo files', done: false, client: true, order: 0 }, { id: 't2', text: 'Pick three photos of the truck', done: false, client: true, order: 1 }, { id: 't3', text: 'Internal note', done: false, client: false, order: 2 }] }],
  }];
  const deliverables = (g1, g2) => [...(g1 ? [{ id: 'd1', group: '01', label: 'Logo PNG', done: true, link: '' }, { id: 'd2', group: '01', label: 'Logo SVG', done: true, link: '' }, { id: 'd3', group: '01', label: 'Brand guide PDF', done: true, link: '' }] : []), ...(g2 ? [{ id: 'd4', group: '02', label: 'Site files', done: true, link: '' }, { id: 'd5', group: '02', label: 'Access and credentials', done: true, link: '' }] : [])];
  const delivery = { driveShared: true, emailSent: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '' };
  _stores.projects = [
    { _id: PROJ, leadId: LEAD, name: 'Launch Plan', kind: 'combined', packageId: 'launch-plan', addonIds: ['stickers'], total: 1240, stage: 'revisions', plan: { months: 6, monthly: 200 }, links: { drive: 'https://drive.google.com/drive/folders/mikes-tacos' },
      revisions: { max: 2, used: 1, log: [{ at: new Date(now - 2 * DAY).toISOString(), note: 'Round one', extra: false }] }, deliverables: deliverables(true, true), delivery, deliveredAt: new Date(now - 4 * DAY).toISOString(), releasedAt: new Date(now - 4 * DAY).toISOString(),
      invoices: [line('pm1', 'Month 1 of 6', 200, twoBack, 'paid', { kind: 'plan' }), line('pm2', 'Month 2 of 6', 200, lastMonth, 'paid', { kind: 'plan' }), line('pm3', 'Month 3 of 6', 200, soon, 'sent', { kind: 'plan', items: [{ label: 'Launch Plan, month 3 of 6', amount: 200 }] }), line('pfin', 'Final payment', 640, key(now + 14 * DAY), 'sent', { kind: 'final', items: [{ label: 'Website build', amount: 500 }, { label: 'Brand Starter', amount: 140 }] })],
      archived: false, createdAt: new Date(now - 70 * DAY) },
    { _id: BRAND, leadId: LEAD, name: 'Brand Complete', kind: 'brand', packageId: 'brand-complete', addonIds: [], total: 600, stage: 'delivery', links: { drive: 'https://drive.google.com/drive/folders/mikes-brand' }, revisions: { max: 2, used: 2, log: [] }, deliverables: deliverables(true, false), delivery, invoices: [line('b1', 'Brand Complete', 600, lastMonth, 'paid', { kind: 'final' })], archived: false, createdAt: new Date(now - 40 * DAY) },
    { _id: WEB, leadId: LEAD, name: 'Web Complete', kind: 'website', packageId: 'web-complete', addonIds: [], total: 750, stage: 'delivery', links: { drive: 'https://drive.google.com/drive/folders/mikes-web' }, revisions: { max: 2, used: 1, log: [] }, deliverables: deliverables(false, true), delivery, invoices: [line('w1', 'Web Complete', 750, lastMonth, 'paid', { kind: 'final' })], archived: false, createdAt: new Date(now - 40 * DAY) },
    { _id: RET, leadId: LEAD, name: 'Content Kit', kind: 'retainer', retainerId: 'content-kit', total: 250, stage: 'kickoff', links: {}, deliverables: [], delivery, invoices: [line('rm1', 'Content Kit, November', 250, soon, 'sent', { kind: 'retainer', items: [{ label: 'Content Kit, one month', amount: 250 }] })], archived: false, createdAt: new Date(now - 10 * DAY) },
  ];
  _stores.concept_sets = [{ _id: SETID, leadId: LEAD, title: 'Round one', round: 1, status: 'sent', token: 'cncpPREVIEWtoken01234567', directions: [{ id: 'a', name: 'Street classic', order: 0, items: [{ id: 'i1', image: 'https://res.cloudinary.com/visualize/image/upload/mikes-a.jpg' }] }, { id: 'b', name: 'Bold and bright', order: 1, items: [] }, { id: 'c', name: 'Night market', order: 2, items: [] }] }];
  _stores.settings = [
    { _id: 'profile', name: 'Rob', calendlyLink: 'https://calendly.com/visualize/intro', retainerLinks: { 'site-care': 'https://buy.stripe.com/sitecare', 'content-kit': 'https://buy.stripe.com/contentkit', growth: 'https://buy.stripe.com/growth' }, payMethods: { stripe: 'https://buy.stripe.com/visualize', cashapp: '$visualizestudio', venmo: '@visualize-studio', zelle: 'pay@visualizeclients.com', zelleKind: 'email' } },
    { _id: 'emails', sender: { name: 'Rob at Visualize', address: 'contact@visualizeclients.com', replyTo: 'rob@visualizeclients.com' }, invoiceCounter: 6 },
  ];
  _stores.email_log = [];
}

/** One file per template on its natural record, then the named variants. `prep` bends the fixture for that one render. */
export const PREVIEW_CASES = [
  { file: 'intro_call', templateId: 'intro_call', ctx: { recordId: LEAD } },
  { file: 'booking_nudge', templateId: 'booking_nudge', ctx: { recordId: LEAD }, prep: (s) => { s.call_leads[0].stage = 'lead'; s.call_leads[0].meeting = {}; } },
  { file: 'missed_call', templateId: 'missed_call', ctx: { recordId: LEAD }, prep: (s, now) => { s.call_leads[0].meeting = { date: key(now - DAY), time: '14:00', noShowAt: new Date(now - DAY + 15 * 60e3).toISOString() }; } },
  { file: 'nurture_checkin', templateId: 'nurture_checkin', ctx: { recordId: LEAD }, prep: (s) => { s.call_leads[0].stage = 'nurture'; } },
  { file: 'concepts_in_progress', templateId: 'concepts_in_progress', ctx: { recordId: LEAD } },
  { file: 'concepts_ready', templateId: 'concepts_ready', ctx: { recordId: LEAD } },
  { file: 'onboarding', templateId: 'onboarding', ctx: { recordId: LEAD }, label: 'the Launch Plan' },
  { file: 'onboarding--brand', templateId: 'onboarding', ctx: { recordId: LEAD }, label: 'a brand package', prep: (s) => { s.call_leads[0].deal.packageId = 'brand-complete'; s.call_leads[0].deal.plan = null; } },
  { file: 'onboarding--web', templateId: 'onboarding', ctx: { recordId: LEAD }, label: 'a web package', prep: (s) => { s.call_leads[0].deal.packageId = 'web-complete'; s.call_leads[0].deal.plan = null; } },
  { file: 'form_nudge', templateId: 'form_nudge', ctx: { recordId: LEAD } },
  { file: 'contract', templateId: 'contract', ctx: { recordId: LEAD } },
  { file: 'contract_nudge', templateId: 'contract_nudge', ctx: { recordId: LEAD } },
  { file: 'invoice', templateId: 'invoice', ctx: { recordId: LEAD, projectId: PROJ, invoiceId: 'pm3' }, label: 'plan month 3 of 6' },
  { file: 'invoice--deposit', templateId: 'invoice', ctx: { recordId: LEAD, invoiceId: 'dvdep' }, label: 'the deposit' },
  { file: 'invoice--final', templateId: 'invoice', ctx: { recordId: LEAD, projectId: PROJ, invoiceId: 'pfin' }, label: 'the final' },
  { file: 'invoice--retainer', templateId: 'invoice', ctx: { recordId: LEAD, projectId: RET, invoiceId: 'rm1' }, label: 'a retainer month' },
  { file: 'invoice_reminder', templateId: 'invoice_reminder', ctx: { recordId: LEAD, projectId: PROJ, invoiceId: 'pm3' } },
  { file: 'invoice_past_due', templateId: 'invoice_past_due', ctx: { recordId: LEAD, projectId: PROJ, invoiceId: 'pm3' }, prep: (s, now) => { const l = s.projects[0].invoices.find(i => i.id === 'pm3'); l.dueAt = key(now - 2 * DAY); } },
  { file: 'payment_received', templateId: 'payment_received', ctx: { recordId: LEAD, projectId: PROJ, invoiceId: 'pm2' }, label: 'a plan month' },
  { file: 'payment_received--deposit', templateId: 'payment_received', ctx: { recordId: LEAD, invoiceId: 'dvdep' }, label: 'the deposit', prep: (s, now) => { const l = s.call_leads[0].deal.invoices[0]; l.status = 'paid'; l.paidAt = new Date(now).toISOString(); } },
  { file: 'payment_received--final', templateId: 'payment_received', ctx: { recordId: LEAD, projectId: PROJ, invoiceId: 'pfin' }, label: 'the final', prep: (s, now) => { for (const l of s.projects[0].invoices) { l.status = 'paid'; l.paidAt = l.paidAt || new Date(now).toISOString(); } } },
  { file: 'delivery', templateId: 'delivery', ctx: { recordId: LEAD, projectId: PROJ }, label: 'brand and web together', prep: (s, now) => { for (const l of s.projects[0].invoices) { l.status = 'paid'; l.paidAt = l.paidAt || new Date(now).toISOString(); } } },
  { file: 'delivery--brand', templateId: 'delivery', ctx: { recordId: LEAD, projectId: BRAND }, label: 'a brand delivery' },
  { file: 'delivery--web', templateId: 'delivery', ctx: { recordId: LEAD, projectId: WEB }, label: 'a web delivery' },
  { file: 'kickoff', templateId: 'kickoff', ctx: { recordId: LEAD, projectId: PROJ } },
  { file: 'needs_you', templateId: 'needs_you', ctx: { recordId: LEAD, projectId: PROJ } },
  { file: 'review_ready', templateId: 'review_ready', ctx: { recordId: LEAD, projectId: PROJ } },
  { file: 'revision_ready', templateId: 'revision_ready', ctx: { recordId: LEAD, projectId: PROJ }, label: 'round 1 of 2' },
  { file: 'revision_ready--last', templateId: 'revision_ready', ctx: { recordId: LEAD, projectId: PROJ }, label: 'the last included round', prep: (s, now) => { s.projects[0].revisions = { max: 2, used: 2, log: [{ at: new Date(now - 9 * DAY).toISOString(), note: 'Round one', extra: false }, { at: new Date(now - DAY).toISOString(), note: 'Round two', extra: false }] }; } },
  { file: 'plan_complete', templateId: 'plan_complete', ctx: { recordId: LEAD, projectId: PROJ }, prep: (s, now) => { for (const l of s.projects[0].invoices) { l.status = 'paid'; l.paidAt = l.paidAt || new Date(now).toISOString(); } } },
  { file: 'retainer_followup', templateId: 'retainer_followup', ctx: { recordId: LEAD, projectId: PROJ } },
  { file: 'review_request', templateId: 'review_request', ctx: { recordId: LEAD, projectId: PROJ } },
  { file: 'retainer_month_ready', templateId: 'retainer_month_ready', ctx: { recordId: LEAD, projectId: RET } },
  { file: 'custom', templateId: 'custom', ctx: { recordId: LEAD } },
];

const LINT = [[/\{\{/, 'an unfilled {{variable}}'], [/\bundefined\b/, '"undefined"'], [/\bnull\b/, '"null"'], [/\bAI\b/, 'the word AI'], [/\u2014/, 'an em dash']];
/** The problems in one rendered email: the lint over the subject, the text and the html, plus every value the record lacked. */
export function lintPreview({ subject = '', text = '', html = '', missing = [] }) {
  const out = [];
  for (const [rx, what] of LINT) for (const [where, s] of [['subject', subject], ['text', text], ['html', html]]) if (rx.test(String(s || ''))) out.push(`${what} in the ${where}`);
  for (const k of missing) out.push(`missing ${k}`);
  return out;
}

/** renderPreviews({ load, db, _stores, _reset, now }) -> [{ file, templateId, name, label, subject, preheader, text, html, missing, problems }] */
export async function renderPreviews({ load, db, _stores, _reset, now = Date.now() }) {
  const { loadContext, composeEmail } = await load('_lib/email/send.js');
  const { templateOf, TEMPLATE_IDS } = await load('_lib/email/templates.js');
  const out = [];
  for (const c of PREVIEW_CASES) {
    seedPreviews(_stores, _reset, now);
    if (c.prep) c.prep(_stores, now);
    const base = templateOf(c.templateId);
    const ctx = await loadContext(db, c.ctx);
    if (ctx.error) { out.push({ file: c.file, templateId: c.templateId, name: base?.name || c.templateId, label: c.label || '', subject: '', preheader: '', text: '', html: '', missing: [], problems: [`the fixture: ${ctx.error}`] }); continue; }
    const composed = composeEmail(ctx, { templateId: c.templateId });
    if (composed.error) { out.push({ file: c.file, templateId: c.templateId, name: base?.name || c.templateId, label: c.label || '', subject: '', preheader: '', text: '', html: '', missing: [], problems: [composed.error] }); continue; }
    const { rendered, lacking } = composed;
    const missing = [...new Set([...rendered.missing, ...lacking])];
    out.push({ file: c.file, templateId: c.templateId, name: base.name, label: c.label || '', subject: rendered.subject, preheader: rendered.preheader, text: rendered.text, html: rendered.html, missing, problems: lintPreview({ subject: rendered.subject, text: rendered.text, html: rendered.html, missing }) });
  }
  const covered = new Set(out.map(p => p.templateId));
  for (const id of TEMPLATE_IDS) if (!covered.has(id)) out.push({ file: id, templateId: id, name: id, label: '', subject: '', preheader: '', text: '', html: '', missing: [], problems: ['no preview case for this template'] });
  return out;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** The overview page: every preview at 600 and 375, each in a same origin frame sized to its content, halved so the montage stays one image. */
export function overviewHtml(previews) {
  const card = (p) => `<section class="card"><h2>${esc(p.name)}${p.label ? ` <small>${esc(p.label)}</small>` : ''}</h2><p class="subject">${esc(p.subject)}</p><div class="frames">${WIDTHS.map(w => `<iframe title="${esc(p.name)} at ${w}" width="${w}" srcdoc="${esc(p.html)}"></iframe>`).join('')}</div></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Email previews</title><style>
  body { margin: 0; padding: 16px; background: #f1f1f1; font: 13px/1.4 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; }
  .grid { display: flex; flex-wrap: wrap; gap: 16px; zoom: 0.5; }
  .card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  h2 { margin: 0 0 4px; font-size: 26px; } h2 small { font-weight: normal; color: #666; } .subject { margin: 0 0 10px; font-size: 20px; color: #444; }
  .frames { display: flex; gap: 12px; align-items: flex-start; } iframe { border: 1px solid #ccc; background: #fff; display: block; height: 400px; }
  </style></head><body><div class="grid">${previews.map(card).join('')}</div>
  <script>for (const f of document.querySelectorAll('iframe')) { const fit = () => { try { f.style.height = Math.max(200, f.contentDocument.documentElement.scrollHeight + 8) + 'px'; } catch {} }; f.addEventListener('load', fit); fit(); }</script></body></html>`;
}

async function main() {
  const noShot = process.argv.includes('--no-shot');
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'email-preview-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-not-real'; delete process.env.RESEND_API_KEY;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  let previews;
  try {
    const { _stores, _reset, getDb } = await load('_lib/mongo.js');
    previews = await renderPreviews({ load, db: await getDb(), _stores, _reset });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) if (/\.html$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  for (const p of previews) fs.writeFileSync(path.join(OUT_DIR, `${p.file}.html`), p.html);
  fs.writeFileSync(path.join(OUT_DIR, 'overview.html'), overviewHtml(previews));
  const bad = previews.filter(p => p.problems.length);
  for (const p of previews) console.log(`${p.problems.length ? 'FAIL' : 'ok  '} ${p.file.padEnd(28)} ${p.subject}${p.problems.length ? `  <- ${p.problems.join('; ')}` : ''}`);
  if (!noShot) {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1660, height: 900 }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(path.join(OUT_DIR, 'overview.html')).href, { waitUntil: 'load' });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT_DIR, 'overview.png'), fullPage: true });
    } finally { await browser.close(); }
  }
  const size = fs.existsSync(path.join(OUT_DIR, 'overview.png')) ? Math.round(fs.statSync(path.join(OUT_DIR, 'overview.png')).size / 1024) : 0;
  console.log(`\n${previews.length} previews in docs/email-previews${size ? `, overview.png ${size} KB` : ''}. ${bad.length ? `${bad.length} with problems.` : 'Every one renders whole.'}`);
  process.exit(bad.length ? 1 : 0);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main().catch(e => { console.error(e); process.exit(1); });
