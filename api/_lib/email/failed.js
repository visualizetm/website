/* A send that failed (the email system, milestone 4): the one place a failure
 * becomes work for Rob. A task on the record's Emails checklist ("Email
 * failed: Intro call to Mike's Tacos", due 5pm today in New York, one per log
 * entry) and one push, so the Next up queue and the phone both say it. The
 * log entry itself keeps the error; a test to Rob that fails writes nothing. */
import { addTask } from '../taskRules.js';
import { sendPush } from '../notify.js';
import { zoneDayKey, zoneDateAt } from '../zone.js';
import { templateOf } from './templates.js';

export const FAILED_LIST = 'Emails';
export const failedTaskId = (logId) => `ef${String(logId).slice(-20)}`;

/** failedSendItem(db, { lead, logId, templateId, error }) -> { task, push }: the task once per log entry, the push every time. */
export async function failedSendItem(db, { lead, logId, templateId, error }, now = Date.now()) {
  if (!lead || !logId) return { task: false, push: false };
  const name = templateOf(templateId)?.name || 'Email';
  const business = String(lead.showcase?.displayName || lead.business || 'a lead').slice(0, 120);
  const said = String(error || 'It did not go out.').slice(0, 120);
  const id = failedTaskId(logId);
  const lists = Array.isArray(lead.checklists) ? lead.checklists : [];
  let task = false;
  if (!lists.some(l => (l?.items || []).some(it => it?.id === id))) {
    const due = zoneDateAt(zoneDayKey(now), 17, 0);
    const next = addTask(lists, lists.find(l => l?.name === FAILED_LIST)?.id || '', { id, text: `Email failed: ${name} to ${business}. ${said}`, due: new Date(due).toISOString(), source: 'manual', listName: FAILED_LIST, emailId: String(logId) });
    await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { checklists: next, updatedAt: new Date() } });
    lead.checklists = next;
    task = true;
  }
  let push = false;
  try {
    const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';
    await sendPush(db, { title: `Email failed: ${name}`, body: `${business}. ${said}`, url: `${base}/leads?open=${String(lead._id)}` });
    push = true;
  } catch { /* the task is written; a push failure must not undo that */ }
  return { task, push };
}
