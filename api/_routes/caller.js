import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { clientIp } from '../_lib/handler.js';
import { rateKey, rateState, rateHit, rateClear } from '../_lib/limit.js';
import { signCaller, callerCookie } from '../_lib/auth.js';
import { BILLY, teamDoc, passcodeMatches, emailKey, logActivity, sanitizePrefs } from '../_lib/team.js';
import { callerMay, callerLead, callerList, callerBooked, callerIdOf } from '../_lib/callerView.js';
import { openHandList, putOnList, takeOffLists, listAfterOutcome, applyOutcome, syncCallbacksDue, CALLBACKS_DUE_NAME } from '../_lib/lists.js';
import { nextActionFor, resolveNextAction } from '../_lib/nextAction.js';
import { DECLINE_REASON_IDS, normalizeStage } from '../_semantics.js';
import { zoneStartOfDay, zoneTomorrowAt } from '../_lib/zone.js';
import { sendPush } from '../_lib/notify.js';
import { openTimes } from '../_lib/openTimes.js';
import { meetingOf, bookingDeal, whenLine, confirmationOverride } from '../_lib/booking.js';
import { draftEmail } from '../_lib/email/drafts.js';

/* Billy's Call Room (part 1): every caller endpoint, one route. The action
 * arrives as ?a= from the rewrite (/api/caller/<action>). `handler` sits
 * behind route({ role: 'caller' }); `door` is the sign in and sign out pair,
 * public and rate limited, the only two calls a caller makes without a
 * cookie.
 *
 * The line: Billy reads and writes a lead while it is triage, lead or
 * nurture. Every write re-reads the lead with that filter first, so a lead
 * booked or later answers the same 404 as one that does not exist. Every
 * response is built with the whitelist module (api/_lib/callerView.js).
 * Every write stamps { by: 'billy', at } on the server and appends one row
 * to team_activity. Nothing here sends an email or a text, deletes a
 * record, merges two or imports any.
 *
 *   GET  home       { me, leads, lists, booked, today }
 *   GET  session    { ok, name }
 *   POST triage     { leadId, decision: accept | decline | snooze, listId?, newList?, reason?, note?, confirm? }
 *   POST batch      { leadIds, op: list | decline, listId?, newList?, reason?, note?, confirm? }   one write for a selection
 *   POST list       { op: create | rename | skip, ... }
 *   POST contact    { leadId, phone?, owner? }                                phone and owner name only
 *   POST outcome    { leadId, outcome: no-answer | callback | no | wrong-number, note?, callbackAt?, voicemail?, reason? }
 *   POST session    { list, startedAt, endedAt, stats }                       the session record
 */

const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const actionOf = (req) => { const a = req.query?.a; return typeof a === 'string' ? a : Array.isArray(a) ? String(a[0] || '') : ''; };
const notFound = (res) => res.status(404).json({ error: 'not found' });
const BEYOND = ['booked', 'deal', 'client', 'declined', 'won', 'lost'];
const MAX_BATCH = 200;
const adminBase = () => String(process.env.ADMIN_URL || 'https://admin.visualizeclients.com').replace(/\/+$/, '');
const fmtDate = (v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

/* ── The door: sign in and sign out ───────────────────────────────────── */
const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 15 * 60e3;
export async function door(req, res) {
  const a = actionOf(req);
  if (a === 'logout') { res.setHeader('Set-Cookie', callerCookie('', 0)); return res.status(200).json({ ok: true }); }
  if (a !== 'login') return notFound(res);
  const db = await getDb();
  const key = rateKey('caller', clientIp(req));
  const limit = await rateState(db, key, { max: LOGIN_MAX, windowMs: LOGIN_WINDOW_MS });
  if (limit.exceeded) { res.setHeader('Retry-After', String(limit.retryAfter)); return res.status(429).json({ error: 'Too many tries. Wait a few minutes, or text Rob.' }); }
  /* The body only: a credential in the query string would land in the request log. */
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = typeof body.email === 'string' ? emailKey(body.email) : '';
  const passcode = typeof body.passcode === 'string' ? body.passcode : '';
  const doc = await teamDoc(db);
  const right = passcodeMatches(doc, passcode);
  const ok = !!doc && doc.canSignIn !== false && !!email && email === emailKey(doc.email) && right;
  if (!ok) { await rateHit(db, key, limit.hits); return res.status(401).json({ error: 'That email or passcode is not right.' }); }
  await rateClear(db, key);
  await db.collection('team').updateOne({ _id: BILLY }, { $set: { lastSeenAt: new Date().toISOString() } });
  res.setHeader('Set-Cookie', callerCookie(signCaller(doc.version)));
  return res.status(200).json({ ok: true, name: str(doc.name, 40) || 'Billy' });
}

/* ── Reads and writes shared by the actions ───────────────────────────── */
/** The lead, re-read with the stage filter: null for one that is missing, deleted, or booked and beyond. */
async function leadFor(db, id) {
  const _id = oid(id);
  if (!_id) return null;
  const lead = await db.collection('call_leads').findOne({ _id, deleted: { $ne: true } });
  return callerMay(lead) ? lead : null;
}
async function leadsFor(db, ids) {
  const out = [];
  for (const id of ids) { const lead = await leadFor(db, id); if (!lead) return null; out.push(lead); }
  return out;
}
const ctxFor = async (db) => {
  const [projects, sets] = await Promise.all([
    db.collection('projects').find({ archived: { $ne: true } }).project({ leadId: 1, stage: 1, schedule: 1, invoices: 1, delivery: 1, releasedAt: 1, deliveredAt: 1, revisions: 1, addonIds: 1, updatedAt: 1 }).toArray(),
    db.collection('concept_sets').find({ deleted: { $ne: true }, archived: { $ne: true } }).project({ leadId: 1 }).toArray(),
  ]);
  return { projects, sets };
};
/** One $set on one lead: the caller's stamp, and the next action recomputed on the server mirror unless the set names it. */
async function writeLead(db, lead, set, ctx, now) {
  const stamp = { by: BILLY, at: new Date(now).toISOString() };
  const one = { ...set, callerStamp: stamp, updatedAt: new Date(now) };
  if (!('nextAction' in one)) { const merged = { ...lead, ...one }; one.nextAction = resolveNextAction(merged, nextActionFor(merged, ctx, now)); }
  await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: one });
  return { ...lead, ...one };
}
/** The decline write (src/lib/decline.js): stage declined, the reason, the callback and the next action cleared, off its list. */
function declineSet(lead, reason, note, now) {
  const set = { stage: 'declined', declined: { reason, note: str(note, 300), at: new Date(now).toISOString(), by: BILLY }, callbackAt: '', nextAction: null, listId: '' };
  if (lead?.afterCall && typeof lead.afterCall === 'object' && lead.afterCall.nextAction) set.afterCall = { ...lead.afterCall, nextAction: '' };
  return set;
}
/** Where a lead stood before a decline, kept on the activity row so Rob's Undo can put it back. */
const beforeOf = (lead) => ({ id: String(lead._id), business: str(lead.business, 200), stage: normalizeStage(lead) });
/** Accept (the triage Keep): stage lead, parked no more. */
const acceptSet = (lead) => ({ stage: 'lead', priority: lead.priority || 'warm', nurture: null });

/* Moving a lead off a list Rob calls: refused when Rob switched it off, and never without the caller saying so. */
async function robListCheck(db, req, leads, targetListId = '') {
  const lists = await db.collection('lists').find({ status: 'open' }).toArray();
  const byId = new Map(lists.map(l => [String(l._id), l]));
  const off = leads.filter(l => l.listId && String(l.listId) !== String(targetListId) && byId.has(String(l.listId)) && !byId.get(String(l.listId)).system && callerIdOf(byId.get(String(l.listId))) === 'rob');
  if (!off.length) return null;
  if (req.caller.moveOffRobLists === false) return { status: 403, body: { error: 'Rob has locked his lists. Ask him to move it.' } };
  if (req.body?.confirm !== true) return { status: 409, body: { error: 'That one is on a list Rob calls.', confirm: true, onRobLists: off.map(l => ({ id: String(l._id), business: str(l.business, 200), list: str(byId.get(String(l.listId)).name, 80) })) } };
  return null;
}
/** A list Billy makes: his by default, Rob's when he says Rob calls it. */
async function makeList(db, name, callerId, now) {
  const clean = str(name, 80);
  if (!clean) return { error: 'Give the list a name.' };
  if (clean.toLowerCase() === CALLBACKS_DUE_NAME.toLowerCase()) return { error: 'That name is the system list. Pick another.' };
  const item = { name: clean, target: 25, window: 'any', leadIds: [], status: 'open', scheduledFor: '', system: false, createdBy: BILLY, callerId: callerId === 'rob' ? 'rob' : BILLY, createdAt: new Date(now), updatedAt: new Date(now) };
  const r = await db.collection('lists').insertOne(item);
  return { list: { ...item, _id: r.insertedId } };
}
/** Leads onto a list in one move: each one accepted if it was not yet a lead, the list and the listIds together, a list Billy made grows its total. */
async function addToList(db, leads, list, ctx, now) {
  for (const lead of leads) if (normalizeStage(lead) !== 'lead') await writeLead(db, lead, acceptSet(lead), ctx, now);
  const before = (list.leadIds || []).length;
  const put = await putOnList(db, leads.map(l => String(l._id)), list);
  if (list.createdBy === BILLY) await db.collection('lists').updateOne({ _id: list._id }, { $set: { target: Math.max(1, Math.min(500, (before ? Number(list.target) || before : 0) + (put.leadIds.length - before))) } });
  await db.collection('call_leads').updateMany({ _id: { $in: leads.map(l => l._id) } }, { $set: { callerStamp: { by: BILLY, at: new Date(now).toISOString() } } });
  return put;
}
const visibleLeads = async (db) => (await db.collection('call_leads').find({ deleted: { $ne: true }, stage: { $nin: BEYOND } }).sort({ createdAt: -1 }).limit(1000).toArray()).filter(callerMay);
const listView = async (db, list) => { const fresh = await db.collection('lists').findOne({ _id: list._id }); return callerList(fresh || list, null); };

export async function handler(req, res) {
  const db = await getDb();
  const a = actionOf(req);
  const now = Date.now();
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    if (a === 'session') return res.status(200).json({ ok: true, name: req.caller.name });
    if (a === 'home') {
      const leads = await visibleLeads(db);
      const visible = new Set(leads.map(l => String(l._id)));
      await syncCallbacksDue(db, now);
      const lists = await db.collection('lists').find({ status: 'open' }).sort({ createdAt: -1 }).limit(200).toArray();
      const booked = await db.collection('call_leads').find({ deleted: { $ne: true }, 'bookedBy.who': BILLY }).sort({ updatedAt: -1 }).limit(200).toArray();
      const rows = await db.collection('team_activity').find({ who: BILLY, at: { $gte: new Date(zoneStartOfDay(now)).toISOString() } }).toArray();
      const calls = rows.filter(r => r.kind === 'call' || r.kind === 'booked');
      const today = { calls: calls.length, talked: calls.filter(r => r.kind === 'booked' || !['no-answer', 'wrong-number'].includes(r.detail?.outcome)).length, booked: rows.filter(r => r.kind === 'booked').length };
      const team = await teamDoc(db);
      if (!team?.lastSeenAt || now - new Date(team.lastSeenAt).getTime() > 60e3) await db.collection('team').updateOne({ _id: BILLY }, { $set: { lastSeenAt: new Date(now).toISOString() } });
      return res.status(200).json({
        me: { name: req.caller.name, moveOffRobLists: req.caller.moveOffRobLists },
        leads: leads.map(callerLead),
        lists: lists.map(l => callerList(l, visible)),
        booked: booked.filter(l => l.bookedBy?.who === BILLY).map(callerBooked),
        today,
      });
    }
    /* Rob's open times for the next 14 days: instants only, never who the other meetings are with. */
    if (a === 'open-times') return res.status(200).json(await openTimes(db, await teamDoc(db), now));
    return notFound(res);
  }

  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'method not allowed' }); }
  const b = req.body && typeof req.body === 'object' ? req.body : {};

  /* The triage decision: accept (onto a list or straight to Leads), decline with a reason, or not now (to the back of the pile). */
  if (a === 'triage') {
    const lead = await leadFor(db, b.leadId);
    if (!lead) return notFound(res);
    if (normalizeStage(lead) !== 'triage') return res.status(409).json({ error: 'That one is already sorted.' });
    const ctx = await ctxFor(db);
    if (b.decision === 'snooze') {
      const after = await writeLead(db, lead, { triageSnoozedAt: new Date(now).toISOString() }, ctx, now);
      await logActivity(db, { kind: 'sort', leadIds: [lead._id], business: lead.business, detail: { op: 'snooze' } }, now);
      return res.status(200).json({ ok: true, lead: callerLead(after) });
    }
    if (b.decision === 'decline') {
      if (!DECLINE_REASON_IDS.includes(b.reason)) return res.status(400).json({ error: 'Pick a reason.' });
      const before = [beforeOf(lead)];
      await takeOffLists(db, [String(lead._id)]);
      await writeLead(db, lead, declineSet(lead, b.reason, b.note, now), ctx, now);
      await logActivity(db, { kind: 'sort', leadIds: [lead._id], business: lead.business, detail: { op: 'decline', reason: b.reason, note: str(b.note, 300), before } }, now);
      return res.status(200).json({ ok: true, lead: null });
    }
    if (b.decision === 'accept') {
      let list = null;
      if (b.listId) { list = await openHandList(db, b.listId); if (!list) return res.status(400).json({ error: 'That list is closed. Pick another.' }); }
      else if (b.newList !== undefined) { const made = await makeList(db, b.newList, BILLY, now); if (made.error) return res.status(400).json({ error: made.error }); list = made.list; }
      let after = await writeLead(db, lead, acceptSet(lead), ctx, now);
      if (list) { await addToList(db, [after], list, ctx, now); after = { ...after, listId: String(list._id) }; }
      await logActivity(db, { kind: 'sort', leadIds: [lead._id], business: lead.business, detail: { op: 'accept', list: list ? str(list.name, 80) : '' } }, now);
      return res.status(200).json({ ok: true, lead: callerLead(after), list: list ? await listView(db, list) : null });
    }
    return res.status(400).json({ error: 'unknown decision' });
  }

  /* A selection from Leads, one write: onto a list, or declined. */
  if (a === 'batch') {
    const ids = Array.isArray(b.leadIds) ? [...new Set(b.leadIds.filter(x => typeof x === 'string').map(x => str(x, 64)).filter(Boolean))].slice(0, MAX_BATCH) : [];
    if (!ids.length) return res.status(400).json({ error: 'Pick at least one lead.' });
    const leads = await leadsFor(db, ids);
    if (!leads) return notFound(res);
    const ctx = await ctxFor(db);
    const names = leads.length === 1 ? leads[0].business : `${leads.length} leads`;
    if (b.op === 'decline') {
      if (!DECLINE_REASON_IDS.includes(b.reason)) return res.status(400).json({ error: 'Pick a reason.' });
      const blocked = await robListCheck(db, req, leads);
      if (blocked) return res.status(blocked.status).json(blocked.body);
      const before = leads.map(beforeOf);
      await takeOffLists(db, ids);
      for (const lead of leads) await writeLead(db, lead, declineSet(lead, b.reason, b.note, now), ctx, now);
      await logActivity(db, { kind: 'sort', leadIds: ids, business: names, detail: { op: 'decline', reason: b.reason, note: str(b.note, 300), before } }, now);
      return res.status(200).json({ ok: true, declined: ids.length });
    }
    if (b.op === 'list') {
      let list = null;
      if (b.listId) { list = await openHandList(db, b.listId); if (!list) return res.status(400).json({ error: 'That list is closed. Pick another.' }); }
      const blocked = await robListCheck(db, req, leads, list ? String(list._id) : '');
      if (blocked) return res.status(blocked.status).json(blocked.body);
      if (!list) { const made = await makeList(db, b.newList, BILLY, now); if (made.error) return res.status(400).json({ error: made.error }); list = made.list; }
      const put = await addToList(db, leads, list, ctx, now);
      await logActivity(db, { kind: 'sort', leadIds: ids, business: names, detail: { op: 'list', list: str(list.name, 80), added: put.added } }, now);
      return res.status(200).json({ ok: true, added: put.added, list: await listView(db, list) });
    }
    return res.status(400).json({ error: 'unknown op' });
  }

  /* Lists: make one (filled by a filter, by hand, or empty), rename one Billy made, or send a lead to the back of one he calls. */
  if (a === 'list') {
    if (b.op === 'create') {
      const fill = b.fill && typeof b.fill === 'object' ? b.fill : {};
      const ctx = await ctxFor(db);
      let picked = [];
      if (fill.mode === 'hand') {
        const ids = Array.isArray(fill.leadIds) ? [...new Set(fill.leadIds.filter(x => typeof x === 'string').map(x => str(x, 64)).filter(Boolean))].slice(0, MAX_BATCH) : [];
        picked = ids.length ? await leadsFor(db, ids) : [];
        if (!picked) return notFound(res);
        const blocked = await robListCheck(db, req, picked);
        if (blocked) return res.status(blocked.status).json(blocked.body);
      } else if (fill.mode === 'filter') {
        /* Leads only (sorted and not parked), matching the chips; one already on a list stays where it is. */
        const types = new Set((Array.isArray(fill.types) ? fill.types : []).map(x => str(x, 80).toLowerCase()).filter(Boolean));
        const cities = new Set((Array.isArray(fill.cities) ? fill.cities : []).map(x => str(x, 160).toLowerCase()).filter(Boolean));
        const open = new Set((await db.collection('lists').find({ status: 'open' }).toArray()).filter(l => !l.system).flatMap(l => (l.leadIds || []).map(String)));
        picked = (await visibleLeads(db)).filter(l => normalizeStage(l) === 'lead' && (!types.size || types.has(str(l.industry, 80).toLowerCase())) && (!cities.size || cities.has(str(l.area, 160).toLowerCase())) && !open.has(String(l._id))).slice(0, 500);
      }
      const made = await makeList(db, b.name, b.callerId, now);
      if (made.error) return res.status(400).json({ error: made.error });
      const put = picked.length ? await addToList(db, picked, made.list, ctx, now) : { added: 0 };
      await logActivity(db, { kind: 'sort', leadIds: picked.map(l => l._id), business: made.list.name, detail: { op: 'new-list', list: made.list.name, added: put.added, calls: made.list.callerId } }, now);
      return res.status(200).json({ ok: true, added: put.added, list: await listView(db, made.list) });
    }
    const list = await openHandList(db, b.id || b.listId);
    if (!list) return notFound(res);
    if (b.op === 'rename') {
      if (list.createdBy !== BILLY) return res.status(403).json({ error: 'Rob made that list. Ask him to rename it.' });
      const name = str(b.name, 80);
      if (!name) return res.status(400).json({ error: 'Give the list a name.' });
      if (name.toLowerCase() === CALLBACKS_DUE_NAME.toLowerCase()) return res.status(400).json({ error: 'That name is the system list. Pick another.' });
      await db.collection('lists').updateOne({ _id: list._id }, { $set: { name, updatedAt: new Date(now), updatedBy: { by: BILLY, at: new Date(now).toISOString() } } });
      await logActivity(db, { kind: 'sort', business: name, detail: { op: 'rename', list: name, was: str(list.name, 80) } }, now);
      return res.status(200).json({ ok: true, list: await listView(db, list) });
    }
    if (b.op === 'skip') {
      if (callerIdOf(list) !== BILLY) return res.status(403).json({ error: 'Rob calls that list.' });
      const lead = await leadFor(db, b.leadId);
      if (!lead) return notFound(res);
      const next = applyOutcome(list.leadIds, lead._id, 'no-answer');
      if (next) await db.collection('lists').updateOne({ _id: list._id }, { $set: { leadIds: next, updatedAt: new Date(now) } });
      await logActivity(db, { kind: 'sort', leadIds: [lead._id], business: lead.business, detail: { op: 'skip', list: str(list.name, 80) } }, now);
      return res.status(200).json({ ok: true, list: await listView(db, list) });
    }
    return res.status(400).json({ error: 'unknown op' });
  }

  /* The contact fix: the phone and the owner's name, nothing else on the record. */
  if (a === 'contact') {
    const lead = await leadFor(db, b.leadId);
    if (!lead) return notFound(res);
    const set = {};
    if (typeof b.phone === 'string') set.phone = str(b.phone, 40);
    if (typeof b.owner === 'string') set.askFor = str(b.owner, 200);
    if (!Object.keys(set).length) return res.status(400).json({ error: 'nothing to update' });
    const after = await writeLead(db, lead, set, await ctxFor(db), now);
    await logActivity(db, { kind: 'contact', leadIds: [lead._id], business: lead.business, detail: { fields: Object.keys(set).map(k => (k === 'askFor' ? 'owner' : k)) } }, now);
    return res.status(200).json({ ok: true, lead: callerLead(after) });
  }

  /* The outcome of a call: the same write the console makes (src/lib/callOutcome.js), stamped Billy, with the list rule on the same beat. A booking has its own action. */
  if (a === 'outcome') {
    const lead = await leadFor(db, b.leadId);
    if (!lead) return notFound(res);
    const outcome = b.outcome;
    if (!['no-answer', 'callback', 'no', 'wrong-number'].includes(outcome)) return res.status(400).json({ error: 'unknown outcome' });
    /* A lead on a list Rob calls is Rob's to dial: Billy moves it to one of his own first (with the confirm), then calls. */
    if (lead.listId) { const on = await openHandList(db, lead.listId); if (on && callerIdOf(on) === 'rob') return res.status(403).json({ error: 'That one is on a list Rob calls. Move it to one of yours first.' }); }
    const at = new Date(now).toISOString();
    const before = [beforeOf(lead)];
    const voicemail = outcome === 'no-answer' && b.voicemail === true;
    const note = str(b.note, 1000);
    const entry = { at, outcome, note: voicemail ? (note ? `Left a voicemail. ${note}` : 'Left a voicemail.') : note, meeting: '', email: '', by: BILLY };
    const set = { callStatus: outcome, callLog: [...(Array.isArray(lead.callLog) ? lead.callLog : []), entry].slice(-200) };
    if (outcome === 'callback') {
      /* Tomorrow at 9:00 AM New York unless he picked a time, and never one in the past. */
      const picked = b.callbackAt ? new Date(String(b.callbackAt)).getTime() : zoneTomorrowAt(now, 9, 0);
      if (!Number.isFinite(picked) || picked <= now) return res.status(400).json({ error: 'Pick a time that has not passed.' });
      set.callbackAt = new Date(picked).toISOString();
    }
    if (outcome === 'wrong-number') set.phoneNote = `Wrong number (${fmtDate(at)})`;
    if (outcome === 'no') {
      if (!DECLINE_REASON_IDS.includes(b.reason)) return res.status(400).json({ error: 'Pick a reason.' });
      Object.assign(set, declineSet(lead, b.reason, note, now), { nurture: null });
      await takeOffLists(db, [String(lead._id)]);
    } else if (await listAfterOutcome(db, lead, outcome)) set.listId = '';
    const after = await writeLead(db, lead, set, await ctxFor(db), now);
    if (outcome === 'callback') await syncCallbacksDue(db, now);
    await logActivity(db, { kind: 'call', leadIds: [lead._id], business: lead.business, detail: { outcome, note: entry.note, ...(set.callbackAt ? { callbackAt: set.callbackAt } : {}), ...(voicemail ? { voicemail: true } : {}), ...(outcome === 'no' ? { reason: b.reason, before } : {}) } }, now);
    return res.status(200).json({ ok: true, lead: callerMay(after) ? callerLead(after) : null });
  }

  /* The booking: the lead crosses the line. The slot is checked at the write (409 when it is no longer open), the write is the
   * console's booked outcome stamped Billy, with bookedBy set once and never again. Rob gets a push (a booking is a meeting;
   * nothing writes to Calendly, so it tells him to add it) and a confirmation drafted through the drafts path. Nothing is sent. */
  if (a === 'book') {
    const lead = await leadFor(db, b.leadId);
    if (!lead) return notFound(res);
    if (lead.listId) { const on = await openHandList(db, lead.listId); if (on && callerIdOf(on) === 'rob') return res.status(403).json({ error: 'That one is on a list Rob calls. Move it to one of yours first.' }); }
    const atMs = typeof b.at === 'string' ? new Date(b.at).getTime() : NaN;
    if (!Number.isFinite(atMs) || atMs <= now) return res.status(400).json({ error: 'Pick a time that has not passed.' });
    const team = await teamDoc(db);
    const slot = new Date(atMs).toISOString();
    const open = await openTimes(db, team, now);
    if (!open.slots.includes(slot)) return res.status(409).json({ error: 'That time was just taken. Pick another.', taken: true });
    const at = new Date(now).toISOString();
    const meeting = meetingOf(atMs);
    const note = str(b.notes, 1000);
    const entry = { at, outcome: 'booked', note, meeting: `${meeting.date} ${meeting.time}`, email: '', by: BILLY };
    const set = { callStatus: 'booked', callLog: [...(Array.isArray(lead.callLog) ? lead.callLog : []), entry].slice(-200), stage: 'booked', meeting, afterCall: { ...(lead.afterCall || {}), meeting: entry.meeting, email: lead.afterCall?.email || '' } };
    if (!lead.deal) set.deal = bookingDeal(lead);
    if (!lead.bookedBy?.who) set.bookedBy = { who: BILLY, at };
    if (await listAfterOutcome(db, lead, 'booked')) set.listId = '';
    const ctx = await ctxFor(db);
    await writeLead(db, lead, set, ctx, now);
    await logActivity(db, { kind: 'booked', leadIds: [lead._id], business: lead.business, detail: { outcome: 'booked', at: slot, meeting: entry.meeting, note } }, now);
    let push = false;
    if (sanitizePrefs(team?.prefs).booked) {
      try { const r = await sendPush(db, { title: `${req.caller.name} booked ${str(lead.business, 80) || 'a lead'}`, body: `${whenLine(atMs)}. Add it to your calendar.`, url: `${adminBase()}/leads/${lead._id}`, tag: `booked-${lead._id}`, kind: 'event', category: 'meetings' }, { now }); push = (r?.delivered || 0) > 0; } catch { /* the booking stands; the push is a courtesy */ }
    }
    let draft = false;
    try {
      const d = await draftEmail(db, { recordId: String(lead._id), templateId: 'custom', override: confirmationOverride(lead, atMs, req.caller.name), auto: false, reason: `Booked by ${req.caller.name}` }, now);
      draft = d?.ok === true;
      /* The draft's task is the record's next step until Rob sends it, so the next action is worked out once more. */
      if (draft) { const fresh = await db.collection('call_leads').findOne({ _id: lead._id }); if (fresh) await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { nextAction: resolveNextAction(fresh, nextActionFor(fresh, ctx, now)) } }); }
    } catch { /* the booking stands; Rob can write the email from the record */ }
    return res.status(200).json({ ok: true, booked: { business: str(lead.business, 200), word: 'Booked', at: slot }, rob: { push, notes: !!note, draft } });
  }

  /* The session record: what one run of a list came to, and Rob's push when he asked for one. */
  if (a === 'session') {
    const n = (v) => Math.max(0, Math.min(9999, Math.round(Number(v)) || 0));
    const s = b.stats && typeof b.stats === 'object' ? b.stats : {};
    const stats = { calls: n(s.calls), talked: n(s.talked), booked: n(s.booked), callbacks: n(s.callbacks), noAnswer: n(s.noAnswer), notInterested: n(s.notInterested) };
    const iso = (v) => { const t = new Date(String(v || '')).getTime(); return Number.isFinite(t) ? new Date(t).toISOString() : ''; };
    const detail = { list: str(b.list, 80), startedAt: iso(b.startedAt), endedAt: iso(b.endedAt) || new Date(now).toISOString(), ...stats };
    await logActivity(db, { kind: 'session', business: detail.list, detail }, now);
    const team = await teamDoc(db);
    if (sanitizePrefs(team?.prefs).session) {
      try { await sendPush(db, { title: `${req.caller.name} finished a session`, body: `${stats.calls} call${stats.calls === 1 ? '' : 's'}, ${stats.talked} talked, ${stats.booked} booked${detail.list ? `, on ${detail.list}` : ''}.`, url: `${adminBase()}/settings/team/day`, tag: 'team-session', kind: 'event', category: 'team' }, { now }); } catch { /* the record is written; the push is a courtesy */ }
    }
    return res.status(200).json({ ok: true });
  }

  return notFound(res);
}
