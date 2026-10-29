/* The one idea of the CRM revamp (step 2): every record carries the one
 * thing Rob should do next. nextActionFor(record, ctx, now) is the pure
 * rule set, mirrored byte for byte in api/_lib/nextAction.js so the daily
 * cron repairs drift with the same answer the screens compute.
 *
 * A record is a lead (business, stage) or a project (leadId, schedule).
 * The shape stored on both: { kind, label (120), dueAt (ISO), auto, doneAt }.
 * auto false is a manual action (Set next action on the record, or a
 * snooze) that the recompute never overwrites; doneAt marks the computed
 * action as done, and the same action is not raised again until its kind
 * or its due changes. */
// .js on every import so scripts/next-action-test.mjs can load this file in plain Node.
import { normalizeStage, nextActionKindOf } from '../shared/semantics.js';
import { parseDate, dayKey } from '../shared/dates.js';
import { invoicesOf, invoiceStatus, invoicesPastDue } from './invoices.js';
import { dealOf } from './deal.js';
import { taskNextUp, taskAsAction } from '../shared/taskRules.js';

// Mirror of src/lib/booked.js meetingDate(), kept here so this module has no untyped import chain.
const meetingDate = (lead) => { const m = lead?.meeting; if (!m?.date) return null; const d = new Date(`${m.date}T${m.time || '09:00'}`); return Number.isNaN(d.getTime()) ? null : d; };

export const NEXT_ACTION_KEYS = ['checklists', 'stage', 'callStatus', 'callbackAt', 'meeting', 'bookedOutcome', 'reviews', 'schedule', 'invoices', 'delivery', 'releasedAt', 'deliveredAt', 'revisions', 'addonIds', 'archived', 'declined', 'deal', 'calendlyEventUri'];
const DAY = 864e5;
const HOUR = 3600e3;
const ASK_AFTER_DAYS = 3;
const PITCH_AFTER_DAYS = 3;
const ROUND_DAYS = 7;
const RUSH_EXTRA_DAYS = 3;
const iso = (t) => new Date(t).toISOString();
const act = (kind, dueAt, label) => ({ kind, label: label || nextActionKindOf(kind).label, dueAt: dueAt ? iso(dueAt) : '', auto: true, doneAt: '' });

export const isProject = (r) => !!r && typeof r === 'object' && 'leadId' in r && !('business' in r);
const ctxOf = (ctx) => (Array.isArray(ctx) ? { projects: ctx } : (ctx || {}));

/** The day before a meeting, 09:00 local. */
export function dayBeforeAt9(meetingIso) {
  const m = parseDate(meetingIso); if (!m) return null;
  return new Date(m.getFullYear(), m.getMonth(), m.getDate() - 1, 9, 0, 0, 0).getTime();
}

function leadAction(lead, ctx, now) {
  const stage = normalizeStage(lead);
  if (stage === 'declined' || stage === 'nurture') return null;
  if (stage === 'lead' && lead.callStatus === 'callback' && lead.callbackAt) {
    const at = parseDate(lead.callbackAt); if (at) return act('callback', at.getTime());
  }
  if (stage === 'booked' || stage === 'deal') {
    /* The deal (CRM revamp, step 5): the checkpoints say what comes next. */
    const d = dealOf(lead);
    const cp = (id) => d.checkpoints[id];
    const at = (id) => (cp(id)?.at ? parseDate(cp(id).at)?.getTime() || 0 : 0);
    const md = meetingDate(lead);
    if (!cp('callDone') && at('introSent') && at('introSent') + 2 * DAY <= now && !lead.calendlyEventUri) return act('custom', now, 'Confirm the call');
    if (stage === 'deal') {
      const late = invoicesPastDue(d.invoices || [], now);
      if (!cp('callDone')) return act('log-outcome', md ? Math.max(md.getTime() + HOUR, Math.min(now, md.getTime() + HOUR)) : now, 'Log the call');
      if (!cp('onboardingSent')) return act('send-onboarding', at('callDone'));
      if (!cp('formReceived') && at('onboardingSent') + 3 * DAY <= now) return act('chase-form', at('onboardingSent') + 3 * DAY);
      if (cp('formReceived') && !cp('contractSent')) return act('send-contract', at('formReceived') + DAY);
      if (cp('contractSent') && !cp('contractAgreed') && at('contractSent') + 3 * DAY <= now) return act('chase-contract', at('contractSent') + 3 * DAY);
      if (cp('contractAgreed') && !cp('invoiceSent')) return act('send-invoice', at('contractAgreed'));
      if (late.length) return act('chase-invoice', now);
      return null;
    }
  }
  if (stage === 'booked') {
    const md = meetingDate(lead);
    if (md) {
      if (md.getTime() + DAY <= now && !lead.bookedOutcome?.at) return act('log-outcome', now);
      const sets = (ctx.sets || []).filter(s => !s.deleted && !s.archived && String(s.leadId) === String(lead._id));
      if (!sets.length) return act('build-concepts', dayBeforeAt9(`${lead.meeting.date}T${lead.meeting.time || '09:00'}`) || now);
    }
  }
  if (stage === 'client') {
    const mine = (ctx.projects || []).filter(p => String(p.leadId) === String(lead._id) && !p.archived && p.releasedAt);
    const released = mine.sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt))[0];
    const asks = Array.isArray(lead.reviews?.asks) ? lead.reviews.asks : [];
    if (released && asks.length === 0) {
      const due = new Date(released.releasedAt).getTime() + ASK_AFTER_DAYS * DAY;
      if (due <= now) return act('review-ask', due);
    }
  }
  return null;
}

function projectAction(p, ctx, now) {
  if (p.archived) return null;
  // Invoices (CRM revamp, step 5): a sent line past its day is late; a draft is not.
  const lines = invoicesOf(p);
  const late = lines.filter(s => invoiceStatus(s, now) === 'past-due');
  if (late.length) return act('chase-invoice', now);
  /* The client side (CRM revamp, step 7): deliver once everything is paid, send the round back a week after it was logged (three more days on a rush job), pitch the retainer three days after delivery. */
  const allPaid = lines.length > 0 && lines.every(s => invoiceStatus(s, now) === 'paid');
  if (p.stage === 'delivery' && allPaid && !p.releasedAt) return act('deliver', now, 'Share the Drive folder and send the delivery email');
  if (p.stage === 'delivered' && p.delivery && p.delivery.pitchSent === false) {
    const base = parseDate(p.deliveredAt) || parseDate(p.releasedAt) || parseDate(p.updatedAt) || new Date(now);
    return act('retainer-pitch', base.getTime() + PITCH_AFTER_DAYS * DAY);
  }
  const log = Array.isArray(p.revisions?.log) ? p.revisions.log : [];
  if (log.length && p.stage !== 'delivered') {
    const last = log[log.length - 1];
    const at = parseDate(last?.at); if (at) return act('revision', at.getTime() + (ROUND_DAYS + ((p.addonIds || []).includes('rush') ? RUSH_EXTRA_DAYS : 0)) * DAY, `Send round ${log.length}`);
  }
  return null;
}

/** The action a record should carry right now, or null. ctx is { projects, sets } or the projects array. */
export function nextActionFor(record, ctx = {}, now = Date.now()) {
  if (!record || typeof record !== 'object') return null;
  const c = ctxOf(ctx);
  /* Tasks (the task system): on a client and on a project, the task due soonest is the Next up; the pipeline rules only speak when no task is open. A lead keeps the pipeline rules. */
  const stage = isProject(record) ? 'client' : normalizeStage(record);
  if ((stage === 'client' || stage === 'won') && !record.archived) { const t = taskNextUp(record, now); if (t) return taskAsAction(t, true); }
  /* The email system (milestone 8): a lead's drafted or failed email (a task carrying emailId, written by a rule or a failed send) is its next
     step until it is sent or ticked; the pipeline rule speaks again after. The same Next up rule, over the email tasks alone. */
  if (!isProject(record) && stage !== 'client' && stage !== 'won') { const t = taskNextUp({ checklists: (record.checklists || []).map(l => ({ ...l, items: (l?.items || []).filter(it => it && it.emailId) })) }, now); if (t) return taskAsAction(t, true); }
  return isProject(record) ? projectAction(record, c, now) : leadAction(record, c, now);
}

const sameDue = (a, b) => Math.abs((parseDate(a)?.getTime() || 0) - (parseDate(b)?.getTime() || 0)) < 60e3;
export const sameAction = (a, b) => (!a && !b) || (!!a && !!b && a.kind === b.kind && sameDue(a.dueAt, b.dueAt) && !!a.doneAt === !!b.doneAt && a.label === b.label && !!a.auto === !!b.auto && (a.taskId || '') === (b.taskId || ''));

/** What the record should store, given what it holds and what the rules say. */
export function resolveNextAction(record, computed) {
  const cur = record?.nextAction && typeof record.nextAction === 'object' && record.nextAction.kind ? record.nextAction : null;
  if (cur && cur.auto === false && !cur.doneAt) return cur;
  if (!computed) return null;
  if (cur && cur.doneAt && cur.kind === computed.kind && sameDue(cur.dueAt, computed.dueAt)) return cur;
  return computed;
}

/** The set a write should carry: the caller's set plus a recomputed nextAction when a relevant field changed. */
export function withNextAction(record, set, ctx = {}, now = Date.now()) {
  if (!record || !set || 'nextAction' in set) return set;
  if (!Object.keys(set).some(k => NEXT_ACTION_KEYS.includes(k))) return set;
  const merged = { ...record, ...set };
  const next = resolveNextAction(merged, nextActionFor(merged, ctx, now));
  if (sameAction(next, record.nextAction || null)) return set;
  return { ...set, nextAction: next };
}

/** The live action for a record: the manual one, the done one, or the rules' one. */
export const liveNextAction = (record, ctx = {}, now = Date.now()) => resolveNextAction(record, nextActionFor(record, ctx, now));

/* ── The Next up queue ───────────────────────────────────────────── */
export const NEXT_TONE = { call: 'progress', callback: 'callback', 'build-concepts': 'progress', 'log-outcome': 'new', 'send-onboarding': 'progress', 'chase-form': 'new', 'send-contract': 'progress', 'chase-contract': 'new', 'send-invoice': 'won', 'chase-invoice': 'danger', kickoff: 'booked', revision: 'callback', deliver: 'booked', 'retainer-pitch': 'won', 'review-ask': 'won', custom: 'neutral' };

/** Every open action across leads and projects, bucketed: overdue, today, later (the next seven days), beyond (dated past that) and undated (a custom action with no date). `all` stays overdue, today and later, which is what the badge and the drawer read. */
export function nextUpItems(leads = [], projects = [], sets = [], now = Date.now()) {
  const ctx = { projects, sets };
  const byId = new Map((leads || []).map(l => [String(l._id), l]));
  const items = [];
  const push = (record, lead, action) => {
    if (!action || action.doneAt || !lead || lead.deleted) return;
    const dated = parseDate(action.dueAt)?.getTime() || 0;
    const due = dated || now;
    const today = dated && dayKey(new Date(now)) === dayKey(new Date(due));
    const bucket = !dated ? 'undated' : due < now && !today ? 'overdue' : today ? 'today' : due <= now + 7 * DAY ? 'later' : 'beyond';
    items.push({ id: `${isProject(record) ? 'p' : 'l'}:${record._id}`, record, lead, project: isProject(record) ? record : null, action, due, bucket, tone: bucket === 'overdue' ? 'danger' : NEXT_TONE[action.kind] || 'neutral', icon: nextActionKindOf(action.kind).icon });
  };
  for (const l of leads || []) { if (l.deleted) continue; push(l, l, liveNextAction(l, ctx, now)); }
  for (const p of projects || []) { if (p.archived) continue; push(p, byId.get(String(p.leadId)), liveNextAction(p, ctx, now)); }
  items.sort((a, b) => a.due - b.due);
  const of = (b) => items.filter(i => i.bucket === b);
  return { overdue: of('overdue'), today: of('today'), later: of('later'), beyond: of('beyond'), undated: of('undated'), all: items.filter(i => i.bucket === 'overdue' || i.bucket === 'today' || i.bucket === 'later') };
}
export const nextUpBadge = (leads, projects, sets, now = Date.now()) => { const q = nextUpItems(leads, projects, sets, now); return q.overdue.length + q.today.length; };

/* ── The home's rows (the Next up block on the home page) ────────────
 * One pure answer for what a row on the home does, so the card, the tests and the audits read the same thing: what the check
 * does, whether Tomorrow is offered and how it writes, whether there is a Call button, and the words under the title.
 * The times are the browser's, like every other client mirror; only Tomorrow is pinned to America/New_York, because its 9:00 AM
 * is Rob's morning in the zone the server runs the reminders in. */
const NY_ZONE = 'America/New_York';
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: NY_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const nyParts = (ms) => { const o = {}; for (const p of nyFmt.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value); return { y: o.year, m: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, min: o.minute, s: o.second }; };
/** The instant of a New York wall clock time (a time inside the spring gap lands an hour on). */
function nyMs(y, m, d, h = 0, min = 0) {
  const want = Date.UTC(y, m - 1, d, h, min, 0);
  let guess = want;
  for (let i = 0; i < 3; i++) { const p = nyParts(guess); const diff = want - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s); if (!diff) break; guess += diff; }
  return guess;
}
/** The day after `now` in New York at 9:00 AM New York time, as an instant. Never the browser's zone. */
export function tomorrowNineNY(now = Date.now()) {
  const p = nyParts(now);
  const next = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
  return nyMs(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 9, 0);
}

const HOME_OPEN = { 'log-outcome': 'outcome', 'chase-invoice': 'payments', 'build-concepts': 'concepts' };
const daysBetweenKeys = (a, b) => { const [ya, ma, da] = a.split('-').map(Number); const [yb, mb, db] = b.split('-').map(Number); return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY); };

/** How late a row is: '' when it is not, "12m late" or "1h late" the same day, "Yesterday" or "3 days late" before that. */
export function lateLabel(item, now = Date.now()) {
  const at = parseDate(item?.action?.dueAt)?.getTime() || 0;
  if (!at || at >= now) return '';
  const days = daysBetweenKeys(dayKey(new Date(at)), dayKey(new Date(now)));
  if (days >= 2) return `${days} days late`;
  if (days === 1) return 'Yesterday';
  const mins = Math.floor((now - at) / 60e3);
  if (mins < 1) return '';
  return mins < 60 ? `${mins}m late` : `${Math.floor(mins / 60)}h late`;
}
/** The third line of a Today row: "10:00 AM", or "10:00 AM, 1h late" once it is past. */
export function homeTimeLabel(item, now = Date.now()) {
  const at = parseDate(item?.action?.dueAt)?.getTime() || item?.due || 0;
  if (!at) return '';
  const time = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const late = lateLabel(item, now);
  return late ? `${time}, ${late}` : time;
}

/**
 * What a home row does.
 *   check     'task'    a real task (a taskId): the check completes it through completePatch
 *             'manual'  a manual action with no task (a snooze, a task set by hand): the check stamps its doneAt, like the Tasks page
 *             'outcome' a call or a callback: the check never writes done, it opens the Log outcome sheet
 *             'open'    any other rule action: the check opens the record at that step
 *   tomorrow  'task' | 'callback' | 'manual' | null; null for an action whose date the rules derive, which gets Open instead
 *   open      the record section a tap opens: 'outcome', 'payments', 'concepts' or null (the record itself)
 *   call      a Call button: a call or a callback with a phone number
 */
export function homeRowAction(item, now = Date.now()) {
  const a = item?.action || {};
  const kind = a.kind;
  const task = !!a.taskId;
  const manual = a.auto === false && !task;
  const isCall = kind === 'call' || kind === 'callback';
  const check = task ? 'task' : isCall ? 'outcome' : manual ? 'manual' : 'open';
  const tomorrow = task ? 'task' : kind === 'callback' && !manual ? 'callback' : manual ? 'manual' : null;
  return {
    check, tomorrow, open: HOME_OPEN[kind] || null,
    call: isCall && !!item?.lead?.phone,
    late: lateLabel(item, now), time: homeTimeLabel(item, now),
    title: `${a.label || nextActionKindOf(kind).label}${item?.project ? `, ${item.project.name}` : ''}`,
  };
}
