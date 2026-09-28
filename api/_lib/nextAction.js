/* Server mirror of src/lib/nextAction.js (CRM revamp, step 2): the same
 * rules, self contained because a serverless function cannot import from
 * src/. The daily cron recomputes every live lead and project with this so
 * a record that drifted (a write that skipped the shared helper) is put
 * right overnight. Keep the two files' rules identical. */
import { NEXT_ACTION_KIND_IDS, normalizeStage } from '../_semantics.js';

const DAY = 864e5;
const ASK_AFTER_DAYS = 3;
const PITCH_AFTER_DAYS = 3;
const LABELS = { call: 'Call', callback: 'Call back', 'build-concepts': 'Build concepts', 'log-outcome': 'Log the outcome', 'send-onboarding': 'Send onboarding', 'chase-form': 'Chase the form', 'send-contract': 'Send the contract', 'chase-contract': 'Chase the contract', 'send-invoice': 'Send the invoice', 'chase-invoice': 'Chase the invoice', kickoff: 'Kick off', revision: 'Revision round', deliver: 'Deliver', 'retainer-pitch': 'Pitch the retainer', 'review-ask': 'Ask for a review', custom: 'Custom' };
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' && DATE_ONLY.test(v)) { const [y, m, d] = v.split('-').map(Number); const local = new Date(y, m - 1, d); return Number.isNaN(local.getTime()) ? null : local; }
  const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d;
}
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const meetingDate = (lead) => { const m = lead?.meeting; if (!m?.date) return null; const d = new Date(`${m.date}T${m.time || '09:00'}`); return Number.isNaN(d.getTime()) ? null : d; };
const iso = (t) => new Date(t).toISOString();
const act = (kind, dueAt) => ({ kind, label: LABELS[kind] || kind, dueAt: dueAt ? iso(dueAt) : '', auto: true, doneAt: '' });
export const isProject = (r) => !!r && typeof r === 'object' && 'leadId' in r && !('business' in r);
const ctxOf = (ctx) => (Array.isArray(ctx) ? { projects: ctx } : (ctx || {}));
export function dayBeforeAt9(meetingIso) { const m = parseDate(meetingIso); if (!m) return null; return new Date(m.getFullYear(), m.getMonth(), m.getDate() - 1, 9, 0, 0, 0).getTime(); }

function leadAction(lead, ctx, now) {
  const stage = normalizeStage(lead);
  if (stage === 'declined' || stage === 'nurture') return null;
  if (stage === 'lead' && lead.callStatus === 'callback' && lead.callbackAt) { const at = parseDate(lead.callbackAt); if (at) return act('callback', at.getTime()); }
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
    if (released && asks.length === 0) { const due = new Date(released.releasedAt).getTime() + ASK_AFTER_DAYS * DAY; if (due <= now) return act('review-ask', due); }
  }
  return null;
}
function projectAction(p, ctx, now) {
  if (p.archived) return null;
  const today = dayKey(new Date(now));
  const late = (p.schedule || []).filter(s => s.status !== 'paid' && s.dueAt && String(s.dueAt).slice(0, 10) < today);
  if (late.length) return act('chase-invoice', now);
  if (p.stage === 'delivered' && p.delivery && p.delivery.pitchSent === false) {
    const base = parseDate(p.releasedAt) || parseDate(p.deliveredAt) || parseDate(p.updatedAt) || new Date(now);
    return act('retainer-pitch', base.getTime() + PITCH_AFTER_DAYS * DAY);
  }
  return null;
}
export function nextActionFor(record, ctx = {}, now = Date.now()) {
  if (!record || typeof record !== 'object') return null;
  const c = ctxOf(ctx);
  return isProject(record) ? projectAction(record, c, now) : leadAction(record, c, now);
}
const sameDue = (a, b) => Math.abs((parseDate(a)?.getTime() || 0) - (parseDate(b)?.getTime() || 0)) < 60e3;
export const sameAction = (a, b) => (!a && !b) || (!!a && !!b && a.kind === b.kind && sameDue(a.dueAt, b.dueAt) && !!a.doneAt === !!b.doneAt && a.label === b.label && !!a.auto === !!b.auto);
export function resolveNextAction(record, computed) {
  const cur = record?.nextAction && typeof record.nextAction === 'object' && record.nextAction.kind ? record.nextAction : null;
  if (cur && cur.auto === false && !cur.doneAt) return cur;
  if (!computed) return null;
  if (cur && cur.doneAt && cur.kind === computed.kind && sameDue(cur.dueAt, computed.dueAt)) return cur;
  return computed;
}
/** What sanitize accepts for the field: the whitelist both routes share. */
export function sanitizeNextAction(v, str) {
  if (v === null) return null;
  if (!v || typeof v !== 'object') return undefined;
  return { kind: NEXT_ACTION_KIND_IDS.includes(v.kind) ? v.kind : 'custom', label: str(v.label, 120), dueAt: str(v.dueAt, 40), auto: v.auto !== false, doneAt: str(v.doneAt, 40) };
}
