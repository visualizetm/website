import { ObjectId } from 'mongodb';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getDb } from '../_lib/mongo.js';
import { stripeHealth } from '../_lib/stripe.js';
import { STAGE_IDS, clientEvidence, earliestClientSince } from '../_lib/pipeline.js';
import { nextActionFor, resolveNextAction, sameAction } from '../_lib/nextAction.js';
import { syncCallbacksDue } from '../_lib/lists.js';
import { scoreFor, topClientIndustries, briefedLeadIds } from '../_lib/score.js';
import { dealAutoPatch } from '../_lib/deal.js';
import { LEAD_RULES, PROJECT_RULES, dueRules, RULE_IDS } from '../_lib/rules.js';
import { zoneDayKey, keyAddMonths } from '../_lib/zone.js';
import { invoicesOf, newInvoice, hasMonthLine, monthLineLabel, addMonthsKey } from '../_lib/invoices.js';

/* Vercel cron, once a day at 06:00 UTC (vercel.json). CRON_SECRET guarded.
 *  1. Retainers: roll retainer.nextBillAt forward once a bill date passes,
 *     extend the retainer project's schedule so six future months exist
 *     (the same rule Mark paid applies), and move ending retainers whose
 *     cancelAt has passed to cancelled.
 *  1b. Stage heal: a live record whose stage was wiped by a background job and
 *     that carries client evidence goes back to client (api/_lib/pipeline.js).
 *  1c. clientSince backfill for any client or won record missing it.
 *  1d. nextAction recompute (CRM revamp, step 2) on every live lead and
 *     project, so a write that skipped the shared helper is repaired.
 *  1e. The Callbacks due dial list resynced (CRM revamp, step 3).
 *  1f. Nurture resurface (CRM revamp, step 4): parked records past their
 *     day go back to triage with a note.
 *  1g. Score recompute (CRM revamp, step 4) on every live lead.
 *  1d2 (CRM revamp, step 7): the follow up rules in api/_lib/rules.js, once
 *     per record per condition, counted in health.crons.daily.rules.
 *  1d0 and 1d1 (CRM revamp, step 5): the deal moves (booked to deal an hour
 *     past the meeting, Concepts and Call done tick, stalledSince) and the
 *     next plan month drafted on its bill day; a retainer's next month is
 *     drafted on its bill day in step 1.
 *  2. Task health: write the settings 'health' document (enrichment, scraper,
 *     crons, stripe) the Integrations cards and the drawer read. */
// Closeout: today and every bill day read America/New_York (api/_lib/zone.js), whatever zone the function runs in.
const addMonths = (dateStr, n, dayOfMonth) => keyAddMonths(String(dateStr).slice(0, 10), n, dayOfMonth);

export async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-cron-secret'] || '');
  const sha = (s) => createHash('sha256').update(String(s)).digest();
  if (!secret || !timingSafeEqual(sha(given), sha(secret))) return res.status(401).json({ error: 'unauthorized' });
  const db = await getDb();
  const leads = db.collection('call_leads');
  const projects = db.collection('projects');
  const settings = db.collection('settings');
  const today = zoneDayKey(Date.now());
  const nowIso = new Date().toISOString();
  let rolled = 0; let cancelled = 0; let extended = 0;

  // 1. Retainers.
  const clients = await leads.find({ deleted: { $ne: true }, 'retainer.status': { $in: ['active', 'ending', 'paused'] } }).toArray();
  for (const l of clients) {
    const r = l.retainer;
    if (r.status === 'ending' && r.cancelAt && new Date(r.cancelAt).getTime() <= Date.now()) {
      await leads.updateOne({ _id: l._id }, { $set: { 'retainer.status': 'cancelled', 'retainer.nextBillAt': '', updatedAt: new Date() } }); cancelled++; continue;
    }
    if (r.status === 'paused') continue;
    const pid = r.projectId && ObjectId.isValid(r.projectId) ? new ObjectId(r.projectId) : null;
    const p = pid ? await projects.findOne({ _id: pid }) : null;
    if (p) {
      /* CRM revamp, step 5: the lines are invoices. On the bill day the next month is drafted when no line exists for it. */
      let invoices = invoicesOf(p);
      const last = invoices[invoices.length - 1];
      const billDay = Number(r.billDay) || Number(String(last?.dueAt || '').slice(8, 10)) || 1;
      if (invoices.length && addMonthsKey(last.dueAt, 1, billDay) === today && !hasMonthLine(invoices, invoices.length + 1)) {
        const amount = Number(r.amount) || Number(last.amount) || 0;
        invoices = [...invoices, { ...newInvoice({ label: monthLineLabel(invoices.length + 1), amount, dueAt: today, status: 'draft' }), ledgerId: '' }];
        await projects.updateOne({ _id: p._id }, { $set: { invoices, updatedAt: new Date() } }); extended++;
      }
      const next = invoices.filter(s => s.status !== 'paid' && !s.ledgerId && String(s.dueAt) >= today).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0];
      const target = next?.dueAt || '';
      if (target && target !== r.nextBillAt && (!r.nextBillAt || String(r.nextBillAt) < today)) { await leads.updateOne({ _id: l._id }, { $set: { 'retainer.nextBillAt': target, updatedAt: new Date() } }); rolled++; }
    } else if (r.nextBillAt && String(r.nextBillAt) < today) {
      await leads.updateOne({ _id: l._id }, { $set: { 'retainer.nextBillAt': addMonths(String(r.nextBillAt).slice(0, 10), 1, r.billDay), updatedAt: new Date() } }); rolled++;
    }
  }

  /* 1b. The pipeline guard's backstop (stage regression fix). The nightly
     enricher writes straight into call_leads and has been seen to leave
     stage as '' on records it touches; a client with no stage reads as a
     lead. Any live record whose stage is not a stage and that carries any
     client evidence (api/_lib/pipeline.js: clientSince, a won outcome, a
     published showcase, a project, a purchase, a planner switched on, a
     testimonial) is a client and is put back before the day starts. Each
     heal is counted on the record (stageHeals, additive) and listed in the
     health document so the notifications drawer can name it; a record
     healed more than twice means something upstream is still wiping it. */
  const wiped = await leads.find({ deleted: { $ne: true }, stage: { $nin: STAGE_IDS } })
    .project({ business: 1, stage: 1, clientSince: 1, bookedOutcome: 1, showcase: 1, purchases: 1, planner: 1, reviews: 1, stageHeals: 1, updatedAt: 1 }).toArray();
  const projectCounts = new Map();
  if (wiped.length) {
    const rows = await projects.find({ leadId: { $in: wiped.map(l => String(l._id)) } }).project({ leadId: 1 }).toArray();
    for (const p of rows) projectCounts.set(String(p.leadId), (projectCounts.get(String(p.leadId)) || 0) + 1);
  }
  const healedRecords = [];
  for (const l of wiped) {
    const rules = clientEvidence(l, projectCounts.get(String(l._id)) || 0);
    if (!rules.length) continue;
    const count = (Number(l.stageHeals?.count) || 0) + 1;
    const set = { stage: 'client', stageHeals: { count, lastAt: nowIso, lastRules: rules }, updatedAt: new Date() };
    if (!(typeof l.clientSince === 'string' && l.clientSince.trim())) {
      const own = await projects.find({ leadId: String(l._id) }).project({ createdAt: 1 }).toArray();
      set.clientSince = earliestClientSince(l, own) || nowIso;
    }
    await leads.updateOne({ _id: l._id }, { $set: set });
    healedRecords.push({ id: String(l._id), business: String(l.business || ''), at: nowIso, count, rules });
  }
  const healedCount = healedRecords.length;

  /* 1c. A client without clientSince should not exist (every path that makes
     a client stamps it now); records from before that rule get the earliest
     of their first purchase, first project, or updatedAt. */
  const unstamped = await leads.find({ deleted: { $ne: true }, stage: { $in: ['client', 'won'] }, $or: [{ clientSince: { $exists: false } }, { clientSince: '' }, { clientSince: null }] })
    .project({ purchases: 1, updatedAt: 1 }).toArray();
  let stamped = 0;
  for (const l of unstamped) {
    const own = await projects.find({ leadId: String(l._id) }).project({ createdAt: 1 }).toArray();
    const since = earliestClientSince(l, own) || nowIso;
    await leads.updateOne({ _id: l._id }, { $set: { clientSince: since, updatedAt: new Date() } }); stamped++;
  }

  /* 1d. The next action, recomputed for every live lead and project with
     the server mirror of the rules (api/_lib/nextAction.js). A manual
     action (auto false) and a done one for the same due are kept. */
  let nextActions = 0;
  const liveSets = await db.collection('concept_sets').find({ deleted: { $ne: true }, archived: { $ne: true } }).project({ leadId: 1 }).toArray();

  /* 1d0. The deal (CRM revamp, step 5), before the next action reads it: a
     booked record an hour past its meeting becomes a deal, Concepts ticks
     when a set exists, Call done when a linked Calendly call is past, and
     stalledSince is set after seven quiet days or cleared by a move. */
  let dealsMoved = 0;
  const inPlay = await leads.find({ deleted: { $ne: true }, $or: [{ stage: 'booked' }, { stage: 'deal' }] }).project({ stage: 1, callStatus: 1, meeting: 1, deal: 1, calendlyEventUri: 1, updatedAt: 1 }).toArray();
  for (const l of inPlay) {
    const auto = dealAutoPatch(l, { sets: liveSets }, Date.now());
    if (!auto) continue;
    await leads.updateOne({ _id: l._id }, { $set: { ...auto, updatedAt: new Date() } }); dealsMoved++;
  }
  /* 1d1. Plan invoices: on a plan project's bill day the next month is drafted as "Month N of M" when no line exists for it. */
  let drafted = 0;
  const planProjects = await projects.find({ archived: { $ne: true }, 'plan.months': { $gte: 1 } }).project({ plan: 1, invoices: 1, schedule: 1, createdAt: 1 }).toArray();
  for (const p of planProjects) {
    const lines = invoicesOf(p); const months = lines.filter(s => !s.extra);
    const first = months[0]; if (!first?.dueAt) continue;
    const n = months.length + 1; const M = Number(p.plan.months) || 0;
    if (n > M) continue;
    const billDay = Number(String(first.dueAt).slice(8, 10)) || 1;
    const dueAt = addMonthsKey(first.dueAt, n - 1, billDay);
    if (dueAt !== today || hasMonthLine(lines, n, M)) continue;
    await projects.updateOne({ _id: p._id }, { $set: { invoices: [...lines, { ...newInvoice({ label: monthLineLabel(n, M), amount: Number(p.plan.monthly) || 0, dueAt, status: 'draft' }), ledgerId: '' }], updatedAt: new Date() } }); drafted++;
  }

  /* 1d2. The follow up rules (CRM revamp, step 7, api/_lib/rules.js): each
     fires once per record per condition (the key lands in cronRules) and
     is counted in health.crons.daily.rules. They run before the next
     action recompute so a rule that moved a record is read by it. */
  const ruleCounts = Object.fromEntries(RULE_IDS.map(id => [id, 0]));
  const ruleLeads = await leads.find({ deleted: { $ne: true }, $or: [{ stage: { $in: ['lead', 'booked', 'deal'] } }, { stage: { $exists: false } }, { stage: '' }] }).toArray();
  const listsCol = db.collection('lists');
  for (const l of ruleLeads) {
    const fired = dueRules(LEAD_RULES, l, {}, Date.now());
    if (!fired.length) continue;
    const set = { updatedAt: new Date() }; const keys = { ...(l.cronRules || {}) };
    for (const f of fired) { Object.assign(set, f.set); keys[f.id] = f.key; ruleCounts[f.id]++; if (f.lists === 'remove') await listsCol.updateMany({ status: { $ne: 'done' }, leadIds: String(l._id) }, { $pull: { leadIds: String(l._id) } }); }
    set.cronRules = keys;
    await leads.updateOne({ _id: l._id }, { $set: set });
  }
  const ruleProjects = await projects.find({ archived: { $ne: true } }).toArray();
  const ruleLeadIds = [...new Set(ruleProjects.map(p => String(p.leadId)))];
  const ruleOwners = ruleLeadIds.length ? await leads.find({ _id: { $in: ruleLeadIds.filter(ObjectId.isValid).map(id => new ObjectId(id)) } }).project({ retainer: 1, planner: 1 }).toArray() : [];
  const ownerOf = (p) => ruleOwners.find(o => String(o._id) === String(p.leadId)) || null;
  const rulePosts = ruleProjects.some(p => p.kind === 'retainer') ? await db.collection('posts').find({ deleted: { $ne: true }, archived: { $ne: true }, status: { $in: ['approved', 'posted'] } }).project({ leadId: 1, month: 1, status: 1 }).toArray() : [];
  for (const p of ruleProjects) {
    const fired = dueRules(PROJECT_RULES, p, { lead: ownerOf(p), posts: rulePosts }, Date.now());
    if (!fired.length) continue;
    const set = { updatedAt: new Date() }; const keys = { ...(p.cronRules || {}) };
    for (const f of fired) { Object.assign(set, f.set); keys[f.id] = f.key; ruleCounts[f.id]++; }
    set.cronRules = keys;
    await projects.updateOne({ _id: p._id }, { $set: set });
  }
  const rules = RULE_IDS.map(id => ({ name: id, count: ruleCounts[id] }));

  const liveLeads = await leads.find({ deleted: { $ne: true } }).project({ business: 1, stage: 1, callStatus: 1, callbackAt: 1, meeting: 1, bookedOutcome: 1, reviews: 1, nextAction: 1, deal: 1, calendlyEventUri: 1, checklists: 1 }).toArray();
  const liveProjects = await projects.find({ archived: { $ne: true } }).project({ leadId: 1, stage: 1, schedule: 1, invoices: 1, delivery: 1, releasedAt: 1, deliveredAt: 1, revisions: 1, addonIds: 1, updatedAt: 1, archived: 1, nextAction: 1, checklists: 1 }).toArray();
  const ctx = { projects: liveProjects, sets: liveSets };
  for (const l of liveLeads) {
    const next = resolveNextAction(l, nextActionFor(l, ctx, Date.now()));
    if (sameAction(next, l.nextAction || null)) continue;
    await leads.updateOne({ _id: l._id }, { $set: { nextAction: next, updatedAt: new Date() } }); nextActions++;
  }
  for (const p of liveProjects) {
    const next = resolveNextAction(p, nextActionFor(p, ctx, Date.now()));
    if (sameAction(next, p.nextAction || null)) continue;
    await projects.updateOne({ _id: p._id }, { $set: { nextAction: next, updatedAt: new Date() } }); nextActions++;
  }

  /* 1e. The Callbacks due dial list (CRM revamp, step 3): its members are
     recomputed from every callback due today or earlier. */
  const callbacksDue = await syncCallbacksDue(db);

  /* 1f. Nurture (CRM revamp, step 4): a parked record whose day has come
     goes back to triage to be sorted again, the parking is cleared, and
     the notes say where it came from. */
  let resurfaced = 0;
  const parked = await leads.find({ deleted: { $ne: true }, stage: 'nurture', 'nurture.until': { $lte: today } }).project({ nurture: 1, notes: 1 }).toArray();
  for (const l of parked) {
    const reason = String(l.nurture?.reason || '').trim();
    const line = `Back from nurture${reason ? ` (${reason})` : ''}`;
    const notes = [line, String(l.notes || '').trim()].filter(Boolean).join('\n');
    await leads.updateOne({ _id: l._id }, { $set: { stage: 'triage', nurture: null, notes, nextAction: null, updatedAt: new Date() } }); resurfaced++;
  }

  /* 1g. The score (CRM revamp, step 4), recomputed for every live lead from
     the one set of rules in api/_lib/score.js, so the pile in Triage sorts
     on what the scan found overnight. */
  let scored = 0;
  const scoreRows = await leads.find({ deleted: { $ne: true } }).project({ phone: 1, socials: 1, intel: 1, industry: 1, stage: 1, score: 1 }).toArray();
  const briefs = await db.collection('submissions').find({ deleted: { $ne: true }, type: { $in: ['start', 'contact'] }, linkedLeadId: { $exists: true, $ne: '' } }).project({ type: 1, linkedLeadId: 1 }).toArray();
  const scoreCtx = { topIndustries: topClientIndustries(scoreRows), briefed: briefedLeadIds(briefs) };
  for (const l of scoreRows) {
    const score = scoreFor(l, scoreCtx);
    if (score === Number(l.score)) continue;
    await leads.updateOne({ _id: l._id }, { $set: { score, updatedAt: new Date() } }); scored++;
  }

  // 2. Health.
  const since24 = new Date(Date.now() - 24 * 3600e3); const since7 = new Date(Date.now() - 7 * 864e5);
  const scanned = await leads.find({ deleted: { $ne: true }, 'enrichment.lastScanAt': { $exists: true, $ne: '' } }).project({ enrichment: 1, descriptor: 1, industry: 1, phone: 1, email: 1, socials: 1, intel: 1 }).toArray();
  const lastScan = scanned.reduce((m, l) => { const t = new Date(l.enrichment.lastScanAt).getTime(); return t > m ? t : m; }, 0);
  const scanned24 = scanned.filter(l => new Date(l.enrichment.lastScanAt) >= since24);
  const fields24 = scanned24.reduce((n, l) => n + ['descriptor', 'industry', 'phone', 'email', 'socials', 'intel'].filter(k => l[k] && (typeof l[k] !== 'object' || Object.values(l[k]).some(Boolean))).length, 0);
  const [lastInsert, inserted24, inserted7] = await Promise.all([
    leads.find({ sourceId: { $exists: true, $ne: '' } }).sort({ createdAt: -1 }).limit(1).project({ createdAt: 1 }).toArray(),
    leads.countDocuments({ sourceId: { $exists: true, $ne: '' }, createdAt: { $gte: since24 } }),
    leads.countDocuments({ sourceId: { $exists: true, $ne: '' }, createdAt: { $gte: since7 } }),
  ]);
  const prev = (await settings.findOne({ _id: 'health' })) || {};
  const stripe = await stripeHealth(db);
  const health = {
    enrichment: { lastScanAt: lastScan ? new Date(lastScan).toISOString() : null, leadsScannedLast24h: scanned24.length, fieldsFilledLast24h: fields24 },
    scraper: { lastInsertAt: lastInsert[0]?.createdAt ? new Date(lastInsert[0].createdAt).toISOString() : null, insertedLast24h: inserted24, insertedLast7d: inserted7 },
    crons: { ...(prev.crons || {}), daily: { lastRunAt: nowIso, rolled, cancelled, extended, healed: healedCount, stamped, nextActions, callbacksDue: (callbacksDue.leadIds || []).length, resurfaced, scored, dealsMoved, drafted, rules,
      // The last 50 heals across runs, newest first, kept for the drawer's System items (seven days shown).
      healedRecords: [...healedRecords, ...((prev.crons?.daily?.healedRecords) || [])].filter(h => h && h.at && Date.now() - new Date(h.at).getTime() < 30 * 864e5).slice(0, 50) } },
    stripe: { lastWebhookAt: stripe.lastWebhookAt || prev.stripe?.lastWebhookAt || null, unmatched: stripe.unmatched },
    updatedAt: new Date(),
  };
  await settings.updateOne({ _id: 'health' }, { $set: health, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return res.status(200).json({ ok: true, rolled, cancelled, extended, healed: healedRecords, stamped, nextActions, callbacksDue: (callbacksDue.leadIds || []).length, resurfaced, scored, dealsMoved, drafted, rules, health });
}