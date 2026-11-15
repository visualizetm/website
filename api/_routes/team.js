import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { BILLY, teamDoc, publicTeam, newPasscode, hashPasscode, emailKey, sanitizeOpenTimes, sanitizePrefs } from '../_lib/team.js';
import { zoneStartOfDay } from '../_lib/zone.js';
import { normalizeStage } from '../_semantics.js';

/* Rob's side of Billy (Billy's Call Room, part 1): Settings > Team > Billy
 * and Billy's day. Admin only (route() in api/admin/index.js).
 *
 *   GET                       { billy }: the access page. Never the passcode hash, its salt or the cookie version.
 *   GET ?view=day&range=      { rows, stats }: team_activity for today, yesterday or the week (New York days), newest first.
 *   PATCH { set }             name, email, canSignIn, moveOffRobLists, openTimes, prefs. Can sign in off bumps the version.
 *   POST { action }           reset-passcode (a new passcode, answered once, the version bumped), pause (Can sign in off, the version bumped),
 *                             undo-decline { rowId, leadId } (a lead Billy declined goes back to the stage it had).
 *
 * The record lives in the team collection, outside the backup's whitelist, the admin's whole-document reads and the service
 * worker's cache. A version bump kills the caller's cookie on its next request (requireCaller in api/_lib/auth.js). */
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const DAY = 864e5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function save(db, doc, set, bump = false) {
  const version = Math.max(1, Math.round(Number(doc?.version)) || 1) + (bump && doc ? 1 : 0);
  await db.collection('team').updateOne({ _id: BILLY }, { $set: { ...set, version, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return teamDoc(db);
}

export async function handler(req, res) {
  const db = await getDb();
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    if (req.query?.view === 'day') {
      const now = Date.now();
      const today = zoneStartOfDay(now);
      const range = ['today', 'yesterday', 'week'].includes(req.query?.range) ? req.query.range : 'today';
      const from = range === 'today' ? today : range === 'yesterday' ? zoneStartOfDay(today - DAY / 2) : zoneStartOfDay(today - 6 * DAY - DAY / 2);
      const to = range === 'yesterday' ? today : now + 1000;
      const rows = await db.collection('team_activity').find({ at: { $gte: new Date(from).toISOString(), $lt: new Date(to).toISOString() } }).sort({ at: -1 }).limit(1000).toArray();
      const calls = rows.filter(r => r.kind === 'call' || r.kind === 'booked');
      const stats = { calls: calls.length, talked: calls.filter(r => r.kind === 'booked' || !['no-answer', 'wrong-number'].includes(r.detail?.outcome)).length, booked: rows.filter(r => r.kind === 'booked').length, callbacks: rows.filter(r => r.kind === 'call' && r.detail?.outcome === 'callback').length };
      return res.status(200).json({ range, rows: rows.map(r => ({ id: String(r._id), at: str(r.at, 40), who: str(r.who, 20), kind: str(r.kind, 20), leadIds: (r.leadIds || []).map(String), business: str(r.business, 200), detail: r.detail && typeof r.detail === 'object' ? r.detail : {}, undone: Array.isArray(r.undone) ? r.undone.map(String) : [] })), stats });
    }
    return res.status(200).json({ billy: publicTeam(await teamDoc(db)) });
  }

  if (req.method === 'PATCH') {
    const b = req.body?.set && typeof req.body.set === 'object' ? req.body.set : null;
    if (!b) return res.status(400).json({ error: 'set required' });
    const doc = await teamDoc(db);
    const set = {};
    if (b.name !== undefined) { set.name = str(b.name, 40); if (!set.name) return res.status(400).json({ error: 'Give him a name.' }); }
    if (b.email !== undefined) { set.email = emailKey(b.email); if (!EMAIL.test(set.email)) return res.status(400).json({ error: 'That email does not look right.' }); }
    if (b.canSignIn !== undefined) { set.canSignIn = b.canSignIn === true; if (set.canSignIn) set.pausedAt = ''; }
    if (b.moveOffRobLists !== undefined) set.moveOffRobLists = b.moveOffRobLists === true;
    if (b.openTimes !== undefined) set.openTimes = sanitizeOpenTimes(b.openTimes);
    if (b.prefs !== undefined) set.prefs = sanitizePrefs({ ...sanitizePrefs(doc?.prefs), ...(b.prefs && typeof b.prefs === 'object' ? b.prefs : {}) });
    if (!Object.keys(set).length) return res.status(400).json({ error: 'nothing to update' });
    /* Can sign in switched off signs him out: the version moves, so the cookie he holds stops verifying. */
    const after = await save(db, doc, set, set.canSignIn === false && doc?.canSignIn !== false);
    return res.status(200).json({ ok: true, billy: publicTeam(after) });
  }

  if (req.method === 'POST') {
    const action = req.body?.action;
    const doc = await teamDoc(db);
    if (action === 'reset-passcode') {
      const passcode = newPasscode();
      const after = await save(db, doc, { ...hashPasscode(passcode), passcodeSetAt: new Date().toISOString() }, true);
      /* The one time the passcode exists outside its hash: this answer. Rob hands it over. */
      return res.status(200).json({ ok: true, passcode, billy: publicTeam(after) });
    }
    if (action === 'pause') {
      const after = await save(db, doc, { canSignIn: false, pausedAt: new Date().toISOString() }, true);
      return res.status(200).json({ ok: true, billy: publicTeam(after) });
    }
    if (action === 'undo-decline') {
      const rowId = oid(req.body?.rowId) || str(req.body?.rowId, 64);
      const row = rowId ? await db.collection('team_activity').findOne({ _id: rowId }) : null;
      const before = (Array.isArray(row?.detail?.before) ? row.detail.before : []).find(x => String(x?.id) === String(req.body?.leadId));
      const _id = oid(req.body?.leadId);
      if (!row || !before || !_id) return res.status(404).json({ error: 'not found' });
      const lead = await db.collection('call_leads').findOne({ _id, deleted: { $ne: true } });
      if (!lead || normalizeStage(lead) !== 'declined') return res.status(409).json({ error: 'That lead is not declined any more.' });
      const stage = ['triage', 'lead', 'nurture'].includes(before.stage) ? before.stage : 'lead';
      await db.collection('call_leads').updateOne({ _id }, { $set: { stage, declined: null, updatedAt: new Date() } });
      await db.collection('team_activity').updateOne({ _id: row._id }, { $set: { undone: [...new Set([...(Array.isArray(row.undone) ? row.undone : []).map(String), String(_id)])] } });
      return res.status(200).json({ ok: true, stage });
    }
    return res.status(400).json({ error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, PATCH, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
