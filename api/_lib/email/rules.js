/* The email rules (the email system, milestone 8): what goes out on its own.
 * Once a day the reminders cron runs every rule in EMAIL_RULES
 * (src/shared/taskRules.js, mirrored in api/_lib/taskRules.js) over every
 * live lead (never Declined, Lost or Recently Deleted) and, for a project
 * rule, each of its live projects, plus the deal while the record is still a
 * deal. A rule fires on its day and not before; the newest real send of its
 * key to the record (the template, or the template and the invoice) holds it
 * for the rule's cooldown. What happens then is the template's Automation
 * setting (Settings, Emails; a template's autoDefault until Rob sets it):
 *   off     nothing
 *   draft   an email written and logged as a draft with one task on the record
 *           (drafts.js); the run ends with one push, "N emails ready to send",
 *           to the Drafts screen
 * The Drafts rule (email safety, prompt 1 of 3): a rule never sends. The old
 * Send for me mode is gone; a saved 'send' reads as draft (settings.js), and
 * a marketing email is not even drafted for an opt out. Every automatic draft
 * is logged with auto true, so the Drafts screen and the record's Emails
 * section say a rule wrote it. */
import { EMAIL_RULES, sentKeys } from '../taskRules.js';
import { zoneDayKey } from '../zone.js';
import { sendPush } from '../notify.js';
import { templateOf } from './templates.js';
import { readEmailSettings, automationModeOf } from './settings.js';
import { isMarketing } from './send.js';
import { draftEmail } from './drafts.js';

const DAY_MS = 864e5;
const stageOf = (r) => r.stage || (r.callStatus === 'booked' ? 'booked' : '');
/** A template's Automation setting: Rob's, else the template's default, else off. */
export const automationOf = (settings, tpl) => (tpl ? automationModeOf(settings?.automation?.[tpl.id] || tpl.autoDefault || 'off') : 'off');
/** The rules that are on, each with its template and mode. */
export const liveRules = (settings) => EMAIL_RULES.map(rule => ({ rule, tpl: templateOf(rule.template), mode: automationOf(settings, templateOf(rule.template)) })).filter(x => x.tpl && x.mode !== 'off');
export const emptyRun = () => ({ checked: 0, fired: 0, drafted: 0, sent: 0, skipped: 0, failed: 0, limited: false, capped: false });

/** runEmailRules(db, now) -> { checked, fired, drafted, sent, skipped, failed, limited, capped } */
export async function runEmailRules(db, now = Date.now()) {
  const settings = await readEmailSettings(db);
  const live = liveRules(settings);
  const out = emptyRun();
  if (!live.length) return out;
  const todayKey = zoneDayKey(now);
  const leads = await db.collection('call_leads').find({ deleted: { $ne: true }, stage: { $nin: ['declined', 'lost'] } }).toArray();
  const projects = live.some(x => x.rule.scope === 'project') ? await db.collection('projects').find({ archived: { $ne: true } }).toArray() : [];
  const logRows = await db.collection('email_log').find({ status: { $in: ['sent', 'test', 'queued'] }, toSelf: { $ne: true } }).project({ recordId: 1, templateId: 1, invoiceId: 1, status: 1, sentAt: 1, createdAt: 1, toSelf: 1 }).toArray();
  const byRecord = new Map();
  for (const e of logRows) { const k = String(e.recordId); if (!byRecord.has(k)) byRecord.set(k, []); byRecord.get(k).push(e); }
  const drafted = [];
  for (const lead of leads) {
    const sent = sentKeys(byRecord.get(String(lead._id)) || []);
    const own = projects.filter(p => String(p.leadId) === String(lead._id));
    /* The deal's own lines count while the record is a deal; once it is a client the project carries them. */
    const dealToo = !['client', 'won'].includes(stageOf(lead));
    for (const { rule, tpl, mode } of live) {
      const targets = rule.scope === 'project' ? [...own, ...(dealToo ? [null] : [])] : [null];
      for (const project of targets) {
        out.checked++;
        let hit = false;
        try { hit = rule.when(lead, { project, sent, todayKey }, now); } catch { hit = false; }
        if (!hit) continue;
        const invoice = hit && typeof hit === 'object' && hit.invoice ? hit.invoice : null;
        const key = invoice ? `${rule.template}:${invoice.id}` : rule.template;
        const last = Date.parse(sent[key] || '');
        if (last && last + rule.cooldownDays * DAY_MS > now) { out.skipped++; continue; }
        out.fired++;
        const target = { recordId: String(lead._id), projectId: project ? String(project._id) : '', invoiceId: invoice ? String(invoice.id) : '', templateId: rule.template };
        /* A marketing email is never drafted for an opt out; everything else that fires is a draft for Rob (mode is draft or nothing). */
        if (isMarketing(tpl) && lead.emailOptOut) { out.skipped++; continue; }
        if (mode !== 'draft') { out.skipped++; continue; }
        const r = await draftEmail(db, { ...target, auto: true, reason: rule.reason }, now);
        if (r.ok && !r.already) { out.drafted++; drafted.push(target); } else if (r.ok) out.skipped++; else out.failed++;
      }
    }
  }
  return finish(db, out, drafted);
}

/** The run's one push: the drafts, to the Drafts screen. Nothing went out, so nothing says it did. */
async function finish(db, out, drafted) {
  const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';
  const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  if (drafted.length) { try { await sendPush(db, { title: `${n(drafted.length, 'email')} ready to send`, body: 'Written for you from today\'s rules. Read each one in Drafts and tap Send.', url: `${base}/drafts`, category: 'email' }); } catch { /* the drafts and their tasks are written */ } }
  return out;
}
