import { createHash, timingSafeEqual } from 'node:crypto';
import { clientPushSweep } from '../_lib/clientPush.js';
import { getDb } from '../_lib/mongo.js';
import { sendPush } from '../_lib/notify.js';
import { zoneDayKey, zoneParts, zoneMeetingMs, ZONE } from '../_lib/zone.js';
import { callbackDue } from '../_lib/nextAction.js';
import { runOverdueInvoices, runLeadSweep, runCalendlyPoll, OVERDUE_AT } from '../_lib/coveragePush.js';
import { normalizeStage } from '../_semantics.js';
import { runQueuedSends, QUEUE_MAX_AGE_MS } from '../_lib/email/queue.js';
import { runEmailRules, emptyRun } from '../_lib/email/rules.js';

/* Vercel cron (vercel.json), minute mode: Pro plan crons can run once a
 * minute, so this fires every minute and pushes each thing (a task, a
 * callback, a meeting) the minute it becomes due, not the next morning. A
 * thing is due when its time is at or before now; each one pushes exactly
 * once, on a dedupe key that carries its time, so editing the time to a new
 * instant pushes again. Freshness: a reminder pushes only while its time is
 * within the last PUSH_WINDOW_MS (ten minutes). Anything older is stamped as
 * handled with the reason 'stale' (the notifications document's
 * reminderOutcomes keeps the reason) and never pushed, so a gap in the
 * schedule, a deploy, or the very first run of a cron that has been dead for
 * weeks never fires a pile of old pushes. Ten or more things due in one run
 * become one combined push instead of a flood (COMBINE_THRESHOLD).
 *
 * Running every minute means up to 1,440 runs a day, so everything that does
 * not need minute precision is gated by time, its own last-run stamp kept on
 * the 'notifications' settings document next to sentReminderKeys:
 *   - the morning digest (today's callbacks, meetings, bills, review asks
 *     and tasks) sends once, on the first run at or after 8:30am
 *     America/New_York, and the bills/reviews/today's-tasks queries that
 *     feed it only run when the digest is actually due, not every minute;
 *   - queued emails (Send tomorrow, the email system) go out by the instant
 *     rule (api/_lib/email/queue.js, byDay: false) at most every 15 minutes
 *     (QUEUE_GATE_MS), and never one already QUEUE_MAX_AGE_MS (a day) late:
 *     that stays queued for Rob;
 *   - the email rules (api/_lib/email/rules.js) run once a day, on the first
 *     run at or after 9:00am America/New_York;
 *   - the client push sweep (api/_lib/clientPush.js) keeps its own six hour
 *     spacing per client and runs every call; the per-client gate inside it
 *     already makes the query cheap.
 * Every clock reads api/_lib/zone.js, never server local time or process TZ.
 *
 * Tasks with a due date (a custom nextAction with auto false, or a
 * checklist item, set through the Set task sheet) push on remindAt, or on
 * their due time when remindAt is empty (the Remind me choice was Off): a
 * task is never silently due with no push. notifiedAt is stamped on the
 * item once pushed (or once stamped stale past PUSH_WINDOW_MS), so a rerun
 * never sends it twice.
 */
const SENT_KEYS_CAP = 2000; // raised from 500 (Decision: a busy day's dedupe keys, one callback or meeting key per due event plus the digest key, must not push the digest key out before it fires)
const PUSH_WINDOW_MS = 10 * 60e3; // a reminder is pushed only while its time is within the last ten minutes
const MEETING_HEADS_UP_MS = 15 * 60e3; // a meeting pushes once this long before it starts, and again when it starts
const OUTCOMES_KEPT = 200;
const MAX_TRIES = 3; // a thing no device took is tried again on the next run, this many times in all, then stamped failed
const COMBINE_THRESHOLD = 10;
const QUEUE_GATE_MS = 15 * 60e3;
const DIGEST_AT = { h: 8, min: 30 }; // America/New_York
const RULES_AT = { h: 9, min: 0 }; // America/New_York
const REVIEW_ASK_DELAY_MS = 3 * 864e5; // how long after a release with no ask logged before it is due

const list = (items, more = 5) => items.slice(0, more).join(', ') + (items.length > more ? `, +${items.length - more} more` : '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fmtZoneTime = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ZONE });
/** Is the zone's wall clock at or after h:min right now. */
const atOrAfter = (nowMs, h, min) => { const p = zoneParts(nowMs); return p.h > h || (p.h === h && p.min >= min); };

/** One line of the reminder outcomes log (the notifications document keeps the last OUTCOMES_KEPT). */
const outcome = (nowIso, key, kind, status, reason = '') => ({ key, kind, status, reason, at: nowIso });

/** The key of a task's reminder: the record, the task (or the record's own next action) and the instant it is due. */
const taskKey = (t, at) => `tk:${t.coll}:${t._id}:${t.taskId || 'next'}:${at}`;
/** When a lead's meeting starts, as { at, stamp } (stamp is the date and time the dedupe keys end with), or null. Every place a meeting
 * lives: the structured meeting (date and time), and the Log outcome sheet's afterCall.meeting text ("2026-11-03 15:00") when no
 * structured date was saved. Only on a meeting stage, read with normalizeStage (booked, deal, won, client), so a deal and a record
 * with no stage field whose callStatus is booked count; a declined, nurture or open lead with a leftover meeting does not. */
const MEETING_STAGES = ['booked', 'deal', 'won', 'client'];
const AFTER_CALL_MEETING = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/;
export function meetingOf(l) {
  if (!l || !MEETING_STAGES.includes(normalizeStage(l))) return null;
  let date = ''; let time = '';
  if (l.meeting?.date) { date = String(l.meeting.date); time = String(l.meeting.time || ''); }
  else { const m = AFTER_CALL_MEETING.exec(String(l.afterCall?.meeting || '').trim()); if (m) { date = m[1]; time = m[2].padStart(5, '0'); } }
  if (!date) return null;
  const at = zoneMeetingMs(date, time || '09:00');
  return Number.isFinite(at) ? { at, stamp: `${date}:${time}` } : null;
}

/** Why a push reached no device, as one short code (sendPush's counts, never an endpoint). */
const reasonOf = (res) => (res && Array.isArray(res.errors) && res.errors[0]) || (res && res.removed ? 'device-gone' : 'not-delivered');

/** Two indexes for the per-minute scans (call_leads on callback/meeting, on the task fields); created once per warm instance. */
async function ensureReminderIndexes(db) {
  if (globalThis._vzReminderIdx) return;
  const leads = db.collection('call_leads');
  const specs = [
    { deleted: 1, callbackAt: 1 },
    { deleted: 1, 'meeting.date': 1 },
    { deleted: 1, 'nextAction.kind': 1, 'nextAction.auto': 1 },
    { deleted: 1, 'checklists.items.remindAt': 1 },
  ];
  for (const spec of specs) { try { await leads.createIndex(spec); } catch { /* exists, or the database is down; the queries below still run, just unindexed */ } }
  globalThis._vzReminderIdx = true;
}

/** One combined push for ten or more due items at once, instead of a flood. */
function combinedPush(items, base) {
  const WORD = { callback: 'callback', meeting: 'meeting', 'meeting-soon': 'meeting starting soon', task: 'task' };
  const counts = {};
  for (const it of items) counts[it.kind] = (counts[it.kind] || 0) + 1;
  const kinds = Object.keys(counts);
  if (kinds.length === 1) return { title: `${plural(counts[kinds[0]], WORD[kinds[0]])} due now`, body: list(items.map(it => it.business)), url: `${base}/` };
  return { title: `${items.length} reminders due now`, body: `${kinds.map(k => plural(counts[k], WORD[k])).join(', ')} due now.`, url: `${base}/` };
}

/** The one minute's worth of work, as a pure function of (db, now): auth and the HTTP shell are handler()'s job, so a
 * test can drive this directly with a chosen instant, the same way runQueuedSends and runEmailRules take now. */
export async function runReminders(db, nowMs = Date.now()) {
  await ensureReminderIndexes(db);
  const settings = db.collection('settings');
  const doc = (await settings.findOne({ _id: 'notifications' })) || {};
  const prefs = { meetings: doc.reminders?.meetings !== false, callbacks: doc.reminders?.callbacks !== false, bills: doc.reminders?.bills !== false, reviews: doc.reminders?.reviews !== false, tasks: doc.reminders?.tasks !== false };
  const sent = new Set(doc.sentReminderKeys || []);
  const now = new Date(nowMs);
  const today = zoneDayKey(nowMs);
  const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';

  /* Every place a callback or a meeting lives: a callbackAt (whatever callStatus says: the record's own picker writes it alone), a
     manual next action of kind callback (a snoozed callback row), the structured meeting and the outcome sheet's afterCall text. */
  const leads = await db.collection('call_leads').find({ deleted: { $ne: true }, $or: [{ callbackAt: { $exists: true, $ne: '' } }, { 'nextAction.kind': 'callback', 'nextAction.auto': false }, { 'meeting.date': { $exists: true, $ne: '' } }, { 'afterCall.meeting': { $exists: true, $ne: '' } }] }).project({ business: 1, callbackAt: 1, callStatus: 1, callLog: 1, meeting: 1, afterCall: 1, stage: 1, phone: 1, nextAction: 1 }).toArray();

  /* Callbacks and meetings due this minute: each a push item, or stamped stale if more than PUSH_WINDOW_MS late. A meeting pushes
     twice, once MEETING_HEADS_UP_MS before it starts and once when it starts, each with its own key. */
  const dueItems = [];
  const staleKeys = [];
  const outcomes = []; // this run's reminderOutcomes lines
  const settleLate = (key, kind, at, item, reason = 'stale') => {
    if (nowMs - at > PUSH_WINDOW_MS || reason !== 'stale') { staleKeys.push(key); outcomes.push(outcome(now.toISOString(), key, kind, 'skipped', reason)); } else dueItems.push(item);
  };
  for (const l of leads) {
    const cb = prefs.callbacks ? callbackDue(l) : null;
    if (cb && cb.at <= nowMs) {
      const key = `cb:${l._id}:${cb.stamp}`;
      if (!sent.has(key)) settleLate(key, 'callback', cb.at, { key, kind: 'callback', business: l.business, title: `Call back: ${l.business}, ${fmtZoneTime(cb.at)}`, body: l.phone || '', url: `${base}/leads?open=${l._id}` });
    }
    const mt = prefs.meetings ? meetingOf(l) : null;
    if (mt) {
      const headsUpAt = mt.at - MEETING_HEADS_UP_MS;
      const hkey = `mh:${l._id}:${mt.stamp}`;
      if (headsUpAt <= nowMs && !sent.has(hkey)) {
        const mins = Math.max(1, Math.round((mt.at - nowMs) / 60e3));
        settleLate(hkey, 'meeting-soon', headsUpAt, { key: hkey, kind: 'meeting-soon', business: l.business, title: `Meeting in ${mins} min: ${l.business}, ${fmtZoneTime(mt.at)}`, body: l.meeting?.location || '', url: `${base}/booked?open=${l._id}` }, nowMs >= mt.at ? 'started' : 'stale');
      }
      const key = `mt:${l._id}:${mt.stamp}`;
      if (mt.at <= nowMs && !sent.has(key)) settleLate(key, 'meeting', mt.at, { key, kind: 'meeting', business: l.business, title: `Meeting now: ${l.business}, ${fmtZoneTime(mt.at)}`, body: l.meeting?.location || '', url: `${base}/booked?open=${l._id}` });
    }
  }

  /* Tasks with a due date: the checklists on every live lead and project (the task system), and a legacy next action set in
     TaskSheet before checklists carried tasks (auto false, no taskId). Due on remindAt, or on the due time itself when
     remindAt is empty (Remind me was Off): a task is never silently due with no push. */
  const taskRows = [];
  if (prefs.tasks) {
    const isLegacy = (a) => a && typeof a === 'object' && a.kind === 'custom' && a.auto === false && !a.doneAt && a.label && !a.taskId;
    const fromLists = (coll, rec, business) => { for (const l of (rec.checklists || [])) for (const it of (l?.items || [])) if (it && !it.done && it.text) taskRows.push({ coll, _id: rec._id, leadId: coll === 'projects' ? rec.leadId : rec._id, business, action: { label: it.text, dueAt: it.due || '', remindAt: it.remindAt || '', notifiedAt: it.notifiedAt || '' }, taskId: it.id, listId: l.id }); };
    const taskLeads = await db.collection('call_leads').find({ deleted: { $ne: true }, $or: [{ 'nextAction.kind': 'custom', 'nextAction.auto': false }, { 'checklists.items.remindAt': { $exists: true } }, { 'checklists.items.due': { $exists: true } }] }).project({ business: 1, nextAction: 1, checklists: 1 }).toArray();
    for (const l of taskLeads) { if (isLegacy(l.nextAction)) taskRows.push({ coll: 'call_leads', _id: l._id, leadId: l._id, business: l.business, action: l.nextAction }); fromLists('call_leads', l, l.business); }
    const taskProjects = await db.collection('projects').find({ archived: { $ne: true }, $or: [{ 'nextAction.kind': 'custom', 'nextAction.auto': false }, { 'checklists.items.due': { $exists: true } }] }).project({ leadId: 1, name: 1, nextAction: 1, checklists: 1 }).toArray();
    if (taskProjects.length) {
      const ids = [...new Set(taskProjects.map(p => String(p.leadId)))];
      const owners = await db.collection('call_leads').find({ deleted: { $ne: true } }).project({ business: 1 }).toArray();
      const nameOf = new Map(owners.filter(o => ids.includes(String(o._id))).map(o => [String(o._id), o.business]));
      for (const p of taskProjects) { const who = nameOf.get(String(p.leadId)) || p.name || 'Project'; if (isLegacy(p.nextAction)) taskRows.push({ coll: 'projects', _id: p._id, leadId: p.leadId, business: who, action: p.nextAction }); fromLists('projects', p, who); }
    }
  }
  const tasksToday = taskRows.filter(t => t.action.dueAt && zoneDayKey(new Date(t.action.dueAt).getTime()) === today).sort((a, b) => String(a.action.dueAt).localeCompare(String(b.action.dueAt)));
  const taskStale = [];
  const taskDue = [];
  for (const t of taskRows) {
    if (t.action.notifiedAt) continue;
    const at = t.action.remindAt ? Date.parse(t.action.remindAt) : (t.action.dueAt ? Date.parse(t.action.dueAt) : NaN);
    if (!Number.isFinite(at) || at > nowMs) continue;
    const key = taskKey(t, at);
    const item = { key, kind: 'task', business: t.business, title: `Task: ${t.action.label}, ${t.business}`, body: '', url: `${base}/tasks?open=${t.leadId}`, ref: t };
    if (nowMs - at > PUSH_WINDOW_MS) { taskStale.push(t); outcomes.push(outcome(now.toISOString(), key, 'task', 'skipped', 'stale')); } else taskDue.push(item);
  }

  /* Push, and settle each thing by what actually happened. sendPush answers { attempted, delivered, removed, errors }: a thing is
     stamped handled only when at least one device took it. Otherwise it is tried again on the next run, MAX_TRIES times in all
     (the window is ten minutes, so that is inside it), and then stamped failed with the reason. reminderTries keeps the count.
     Stale items (more than PUSH_WINDOW_MS late) were stamped above without ever pushing. */
  const nowIso = now.toISOString();
  const tries = { ...(doc.reminderTries && typeof doc.reminderTries === 'object' ? doc.reminderTries : {}) };
  const triesBefore = JSON.stringify(tries);
  const allDue = [...dueItems, ...taskDue];
  const delivered = []; // things a device took
  const failedNow = []; // things given up on this run
  let sentCount = 0; let retrying = 0; let lastError = ''; let lastDevices = null;
  const push = async (message, kind = 'reminder') => { try { return await sendPush(db, { ...message, kind }); } catch { return { attempted: 0, delivered: 0, removed: 0, errors: ['push-error'] }; } };
  const settle = (items, res) => {
    const took = !!res && Number(res.delivered) > 0;
    if (res && Number.isFinite(res.attempted)) lastDevices = res.attempted;
    if (took) sentCount++;
    for (const it of items) {
      if (took) { delivered.push(it); outcomes.push(outcome(nowIso, it.key, it.kind, 'sent')); delete tries[it.key]; continue; }
      lastError = reasonOf(res);
      const n = (Number(tries[it.key]) || 0) + 1;
      if (n >= MAX_TRIES) { failedNow.push(it); outcomes.push(outcome(nowIso, it.key, it.kind, 'failed', lastError)); delete tries[it.key]; } else { tries[it.key] = n; retrying++; }
    }
  };
  if (allDue.length >= COMBINE_THRESHOLD) settle(allDue, await push(combinedPush(allDue, base)));
  else for (const item of allDue) settle([item], await push({ title: item.title, body: item.body, url: item.url }));
  const handled = [...delivered, ...failedNow];
  /* Stamp every handled thing: the ones a device took, the ones given up on, the stale ones that never push. Tasks stamp on
     their own record (notifiedAt on the checklist item or the next action); callbacks and meetings stamp into sentReminderKeys. */
  for (const t of [...handled.filter(i => i.kind === 'task').map(i => i.ref), ...taskStale]) {
    if (t.taskId) {
      const rec = await db.collection(t.coll).findOne({ _id: t._id }, { projection: { checklists: 1 } });
      const lists = (rec?.checklists || []).map(l => ({ ...l, items: (l?.items || []).map(it => (it?.id === t.taskId ? { ...it, notifiedAt: nowIso } : it)) }));
      await db.collection(t.coll).updateOne({ _id: t._id }, { $set: { checklists: lists } });
    } else {
      await db.collection(t.coll).updateOne({ _id: t._id }, { $set: { 'nextAction.notifiedAt': nowIso } });
    }
  }
  const newKeys = [...handled.filter(i => i.kind !== 'task').map(i => i.key), ...staleKeys];

  /* The morning digest: once a day, on the first run at or after 8:30am America/New_York. Everything it needs (bills,
     review asks, today's tasks are already gathered above) only runs this query when the digest could actually fire. */
  const digestKey = `digest:${today}`;
  const digestReady = atOrAfter(nowMs, DIGEST_AT.h, DIGEST_AT.min) && !sent.has(digestKey);
  let digestSent = 0; let digestFailed = 0;
  if (digestReady) {
    const bills = []; // due today
    const reviews = []; // due, until asked
    if (prefs.bills || prefs.reviews) {
      const clients = await db.collection('call_leads').find({ deleted: { $ne: true }, stage: 'client' }).project({ business: 1, retainer: 1, reviews: 1 }).toArray();
      const released = prefs.reviews ? await db.collection('projects').find({ archived: { $ne: true }, releasedAt: { $exists: true, $ne: '' } }).project({ leadId: 1, name: 1, releasedAt: 1 }).toArray() : [];
      for (const l of clients) {
        const r = l.retainer;
        if (prefs.bills && r && ['active', 'ending'].includes(r.status) && String(r.nextBillAt || '').slice(0, 10) === today) bills.push({ _id: l._id, business: l.business, amount: r.amount });
        if (prefs.reviews && !(l.reviews?.asks || []).length) {
          const rel = released.filter(p => String(p.leadId) === String(l._id)).sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt))[0];
          if (rel && nowMs - new Date(rel.releasedAt).getTime() >= REVIEW_ASK_DELAY_MS) reviews.push({ _id: l._id, business: l.business, releasedAt: rel.releasedAt, project: rel.name });
        }
      }
    }
    const callbacks = []; // due today or overdue
    const meetings = []; // today only
    for (const l of leads) {
      const cb = prefs.callbacks ? callbackDue(l) : null;
      if (cb && zoneDayKey(cb.at) <= today) callbacks.push({ business: l.business, overdue: zoneDayKey(cb.at) < today });
      const mt = prefs.meetings ? meetingOf(l) : null;
      if (mt && zoneDayKey(mt.at) === today) meetings.push({ business: l.business, at: mt.at });
    }
    const total = callbacks.length + meetings.length + bills.length + reviews.length + tasksToday.length;
    if (total) {
      const title = `Today: ${plural(callbacks.length, 'callback')}, ${plural(meetings.length, 'meeting')}`;
      const parts = [];
      if (callbacks.length) parts.push(`${plural(callbacks.length, 'callback')}: ${list(callbacks.map(c => `${c.business}${c.overdue ? ' (overdue)' : ''}`))}`);
      if (meetings.length) parts.push(`${plural(meetings.length, 'meeting')}: ${list(meetings.map(m => `${m.business} at ${fmtZoneTime(m.at)}`))}`);
      if (bills.length) parts.push(`${plural(bills.length, 'bill')} due: ${list(bills.map(b => `${b.business} $${Number(b.amount || 0).toLocaleString()}`))}`);
      if (reviews.length) parts.push(`${plural(reviews.length, 'review ask')} due: ${list(reviews.map(r => r.business))}`);
      if (tasksToday.length) parts.push(`Tasks: ${list(tasksToday.map(t => `${t.action.label} (${t.business}, ${fmtZoneTime(new Date(t.action.dueAt).getTime())})`))}`);
      const dres = await push({ title, body: parts.join('. '), url: `${base}/` }, 'digest');
      if (Number.isFinite(dres.attempted)) lastDevices = dres.attempted;
      if (dres.delivered > 0) { digestSent = 1; newKeys.push(digestKey); delete tries[digestKey]; outcomes.push(outcome(nowIso, digestKey, 'digest', 'sent')); }
      else {
        lastError = reasonOf(dres);
        const n = (Number(tries[digestKey]) || 0) + 1;
        if (n >= MAX_TRIES) { digestFailed = 1; newKeys.push(digestKey); delete tries[digestKey]; outcomes.push(outcome(nowIso, digestKey, 'digest', 'failed', lastError)); } else { tries[digestKey] = n; retrying++; }
      }
    } else newKeys.push(digestKey); // nothing to say today: handled, so a quiet day never re-checks after 8:30
  }
  /* A retry count belongs only to a thing still due (or the digest still owed); the rest is dropped. */
  const live = new Set([...allDue.map(i => i.key), ...(digestReady && !newKeys.includes(digestKey) ? [digestKey] : [])]);
  for (const k of Object.keys(tries)) if (!live.has(k)) delete tries[k];
  if (newKeys.length || outcomes.length || JSON.stringify(tries) !== triesBefore) {
    const keys = [...sent, ...newKeys].slice(-SENT_KEYS_CAP);
    const log = [...(Array.isArray(doc.reminderOutcomes) ? doc.reminderOutcomes : []), ...outcomes].slice(-OUTCOMES_KEPT);
    await settings.updateOne({ _id: 'notifications' }, { $set: { sentReminderKeys: keys, reminderOutcomes: log, reminderTries: tries, lastReminderAt: nowIso }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  }

  /* Queued emails (Send tomorrow), by the instant rule, gated to once every QUEUE_GATE_MS. */
  let emails = { checked: 0, sent: 0, failed: 0, limited: false };
  const queueGate = db.collection('settings');
  const gateDoc = (await queueGate.findOne({ _id: 'cronGates' })) || {};
  const runQueue = !gateDoc.queueLastRunAt || nowMs - Date.parse(gateDoc.queueLastRunAt) >= QUEUE_GATE_MS;
  if (runQueue) {
    try { emails = await runQueuedSends(db, nowMs, { byDay: false, maxAgeMs: QUEUE_MAX_AGE_MS }); } catch { /* the next gate tries again */ }
  }
  /* The email rules, once a day, on the first run at or after 9:00am America/New_York. */
  let rules = emptyRun();
  const runRules = atOrAfter(nowMs, RULES_AT.h, RULES_AT.min) && zoneDayKey(Date.parse(gateDoc.rulesLastRunAt || 0)) !== today;
  if (runRules) {
    try { rules = await runEmailRules(db, nowMs); } catch { /* the digest still goes; the rules try again next run */ }
  }
  /* The pushes beyond a reminder at its due time (api/_lib/coveragePush.js): invoices past due once a day from 9:00 New York (the daily
     job runs at 1 or 2 AM there, a push then would wake the phone), leads the scraper wrote and Calendly bookings every 15 minutes. Each
     keeps its state in cronGates and is never fatal. */
  const sweeps = { overdue: 0, leads: 0, booked: 0, canceled: 0 };
  const gatePatch = {};
  if (prefs.bills && atOrAfter(nowMs, OVERDUE_AT.h, OVERDUE_AT.min)) { const r = await runOverdueInvoices(db, nowMs, gateDoc); Object.assign(gatePatch, r.patch); sweeps.overdue = r.pushed; }
  { const r = await runLeadSweep(db, nowMs, gateDoc); Object.assign(gatePatch, r.patch); sweeps.leads = r.found; }
  { const r = await runCalendlyPoll(db, nowMs, gateDoc); Object.assign(gatePatch, r.patch); sweeps.booked = r.booked; sweeps.canceled = r.canceled; }
  if (runQueue || runRules || Object.keys(gatePatch).length) {
    await queueGate.updateOne({ _id: 'cronGates' }, { $set: { ...(runQueue ? { queueLastRunAt: now.toISOString() } : {}), ...(runRules ? { rulesLastRunAt: now.toISOString() } : {}), ...gatePatch }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  }

  /* Client pushes (portal prompt 4): one batched push per client with a device, six hours apart at most; the gate is
     per client, inside the sweep, so this is cheap to call every minute. */
  let clientPushes = { checked: 0, sent: 0 };
  try { clientPushes = await clientPushSweep(db, nowMs); } catch { /* next run */ }

  /* Health: lastRunAt plus the last twelve run times, now a minute apart. */
  const healthSet = { 'crons.reminders.lastRunAt': nowIso, 'crons.reminders.checked': allDue.length + staleKeys.length, 'crons.reminders.sent': sentCount + digestSent, 'crons.reminders.tasks': taskDue.length, 'crons.reminders.skippedStale': staleKeys.length + taskStale.length, 'crons.reminders.failed': failedNow.length + digestFailed, 'crons.reminders.retrying': retrying, 'crons.reminders.emails': emails, 'crons.reminders.rules': rules };
  if (lastDevices !== null) healthSet['crons.reminders.devices'] = lastDevices;
  if (sentCount + digestSent > 0) { healthSet['crons.reminders.lastPushAt'] = nowIso; if (!lastError) healthSet['crons.reminders.lastPushError'] = ''; }
  if (lastError) healthSet['crons.reminders.lastPushError'] = lastError;
  await settings.updateOne({ _id: 'health' }, { $set: healthSet, $push: { 'crons.reminders.runs': { $each: [nowIso], $slice: -12 } }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });

  return { ok: true, checked: allDue.length, sent: sentCount, digest: digestSent, tasks: taskDue.length, failed: failedNow.length + digestFailed, retrying, clientPushes: clientPushes.sent, emails, rules, sweeps };
}

export async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-cron-secret'] || '');
  const sha = (s) => createHash('sha256').update(String(s)).digest();
  if (!secret || !timingSafeEqual(sha(given), sha(secret))) return res.status(401).json({ error: 'unauthorized' });
  const db = await getDb();
  const out = await runReminders(db, Date.now());
  return res.status(200).json(out);
}
