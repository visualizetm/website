#!/usr/bin/env node
/* Each guard the email system added, cut out of a copy of api/ (and the src/ pieces the compose checks read) in turn: with the cut in place the check that carries
 * that guard's name in scripts/email-lib.mjs must fail. A guard whose checks all still pass without it is reported as
 * not proven and the run exits 1.
 *   node scripts/email-guard-proof.mjs */
process.env.TZ = 'America/New_York';
import fs from 'fs';
import path from 'path';
import { runEmail, repoRoot } from './email-lib.mjs';

const CUTS = [
  { name: 'test-mode', file: 'api/_lib/email/transport.js', from: "  if (!key) return { ok: true, test: true, status: 'test', providerId: '', error: '', attempts: 0 };", to: "  const useKey = key || 'none';" , also: [["const payload = { from: fromLine(sender), to,", "const payload = { from: fromLine(sender), to,"], ["let r = await post(payload, key);", "let r = await post(payload, useKey);"]] },
  { name: 'retry-5xx', file: 'api/_lib/email/transport.js', from: "  if (retriable(r)) { attempts = 2; r = await post(payload, key); }", to: "" },
  { name: 'one-retry', file: 'api/_lib/email/transport.js', from: "  if (retriable(r)) { attempts = 2; r = await post(payload, key); }", to: "  while (retriable(r) && attempts < 4) { attempts += 1; r = await post(payload, key); }" },
  { name: 'no-retry-4xx', file: 'api/_lib/email/transport.js', from: "const retriable = (r) => r.status === 0 || r.status >= 500;", to: "const retriable = (r) => !(r.status >= 200 && r.status < 300);" },
  { name: 'scrub-key', file: 'api/_lib/email/transport.js', from: "error: scrub(said, key), attempts, httpStatus: r.status };", to: "error: String(said).slice(0, 300), attempts, httpStatus: r.status };" },
  { name: 'rate-guard', file: 'api/_lib/email/transport.js', from: "  if (limit.exceeded) return { ok: false, test: !emailConnected(), status: 'failed', providerId: '', error: LIMIT_MESSAGE, attempts: 0, limited: true, retryAfter: limit.retryAfter };", to: "" },
  { name: 'rate-count', file: 'api/_lib/email/transport.js', from: "  await rateHit(db, RATE_KEY, limit.hits);", to: "" },
  { name: 'status-no-key', file: 'api/_routes/email.js', from: "return res.status(200).json({ connected: emailConnected(), sender: settings.sender, from: fromLine(settings.sender), sentLastHour, limit: SENDS_PER_HOUR });", to: "return res.status(200).json({ connected: emailConnected(), key: process.env.RESEND_API_KEY || '', sender: settings.sender, from: fromLine(settings.sender), sentLastHour, limit: SENDS_PER_HOUR });" },
  { name: 'status-method', file: 'api/_routes/email.js', from: "  if (!allow.includes(req.method)) { res.setHeader('Allow', allow.join(', ')); return res.status(405).json({ error: 'method not allowed' }); }", to: "" },
  { name: 'log-indexes', file: 'api/_lib/email/log.js', from: "  for (const [spec] of INDEXES) { try { await col.createIndex(spec); } catch { /* exists, or the database is down; the write below says so */ } }", to: "  void col;" },
  { name: 'log-cap', file: 'api/_lib/email/log.js', from: "subject: str(e.subject, 200), text: str(e.text, 20000), html: str(e.html, HTML_CAP),", to: "subject: String(e.subject ?? ''), text: String(e.text ?? ''), html: String(e.html ?? '')," },
  /* Milestone 2: the renderer, the send pipeline, the settings and the opt out door. */
  { name: 'escape', file: 'api/_lib/email/render.js', from: "export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');", to: "export const esc = (s) => String(s ?? '');" },
  { name: 'js-url', file: 'api/_lib/email/render.js', from: "export const safeLink = (u) => { const t = String(u || '').trim(); return isHttp(t) || isMailto(t) ? t.slice(0, 600) : ''; };", to: "export const safeLink = (u) => String(u || '').trim().slice(0, 600);" },
  { name: 'size-cap', file: 'api/_lib/email/render.js', from: "missing: [...missing], warnings, bytes, tooBig: bytes > HTML_LIMIT };", to: "missing: [...missing], warnings: warnings.filter(w => !/90 KB/.test(w)), bytes, tooBig: false };" },
  { name: 'missing-refuses', file: 'api/_lib/email/send.js', from: "  if (composed.lacking.length) return { status: 400, body: { error: `Fill in ${composed.lacking.join(', ')} first.`, missing: composed.lacking } };", to: "" },
  { name: 'optout-marketing', file: 'api/_lib/email/send.js', from: "  if (marketing && !testToSelf && lead.emailOptOut) return", to: "  if (false && marketing && !testToSelf && lead.emailOptOut) return" },
  { name: 'optout-transactional', file: 'api/_lib/email/send.js', from: "  if (marketing && !testToSelf && lead.emailOptOut) return", to: "  if (!testToSelf && lead.emailOptOut) return" },
  { name: 'duplicate', file: 'api/_lib/email/send.js', from: "  if (!testToSelf && opts.confirmDuplicate !== true) {", to: "  if (false) {" },
  { name: 'test-no-tick', file: 'api/_lib/email/send.js', from: "  if (testToSelf) return { status: 200, body: { ok: true, test: r.test, sentAt, logId: String(log._id), toSelf: true, message: r.test ? TEST_MESSAGE : `Test sent to ${sender.address}.` } };", to: "" },
  { name: 'checkpoint-tick', file: 'api/_lib/email/send.js', from: "  const stamps = await applySendStamps(db, { lead, project, invoice, kind: base.stamp || base.id, sentAt, note: `Sent ${base.name.toLowerCase()}`, deliveryFull: true });", to: "  const stamps = { updatedAt: 1 };" },
  { name: 'unsub-headers', file: 'api/_lib/email/send.js', from: "    headers['List-Unsubscribe'] = `<${unsubscribeApiFor(token)}>`;\n    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';\n  }\n  const subject", to: "    void token; void unsubscribeApiFor;\n  }\n  const subject" },
  { name: 'unsub-sets', file: 'api/_routes/unsubscribe-public.js', from: "{ $set: { emailOptOut: out, emailOptOutAt: out ? new Date().toISOString() : '', updatedAt: new Date() } }", to: "{ $set: { updatedAt: new Date() } }" },
  { name: 'unsub-404', file: 'api/_routes/unsubscribe-public.js', from: "  if (!lead) return notFound(res);", to: "  const found = lead || { _id: null, business: '', askFor: '', emailOptOut: false };", also: [["  const shape = (l) =>", "  void notFound; const shape = (l) =>"], ["  if (req.method === 'GET') return res.status(200).json(shape(lead));", "  if (req.method === 'GET') return res.status(200).json(shape(found));"], ["  await leads.updateOne({ _id: lead._id },", "  await leads.updateOne({ _id: found._id },"]] },
  { name: 'reset', file: 'api/_routes/email.js', from: "        if (clean === null) delete t[id]; else if (clean) t[id] = clean;", to: "        if (clean) t[id] = clean;" },
  /* Milestone 3: Compose. The source and the availability the preview carries, the suggestion rule, the compose helpers, the log's toSelf. */
  { name: 'availability', file: 'api/_lib/email/send.js', from: "    out[base.id] = { available: lacking.length === 0, lacking };", to: "    out[base.id] = { available: true, lacking: [] };" },
  { name: 'source', file: 'api/_lib/email/send.js', from: "  return { tpl: draft, source: tpl, base,", to: "  return { tpl: draft, source: draft, base," },
  { name: 'log-toself', file: 'api/_lib/email/log.js', from: " auto: !!e.auto, toSelf: !!e.toSelf,", to: " auto: !!e.auto," },
  { name: 'dup-ignores-self', file: 'api/_lib/email/log.js', from: "status: { $in: ['sent', 'test'] }, toSelf: { $ne: true } }).sort({ createdAt: -1 }).limit(5)", to: "status: { $in: ['sent', 'test'] } }).sort({ createdAt: -1 }).limit(5)" },
  { name: 'suggest-cooldown', file: 'api/_lib/taskRules.js', from: "  const pick = (id) => (tsOf(sent[id]) + DAY_MS > now ? null : id);", to: "  const pick = (id) => id;" },
  { name: 'suggest-declined', file: 'api/_lib/taskRules.js', from: "  if (stage === 'declined' || stage === 'lost' || record.deleted) return null;", to: "" },
  { name: 'suggest-nudge-day', file: 'api/_lib/taskRules.js', from: "      if (!booked && at('introSent') + REMINDER_DAYS * DAY_MS <= now) return pick('booking_nudge');", to: "      if (!booked) return pick('booking_nudge');" },
  { name: 'suggest-form-day', file: 'api/_lib/taskRules.js', from: "    if (!at('formReceived')) return at('onboardingSent') + REMINDER_DAYS * DAY_MS <= now ? pick('form_nudge') : null;", to: "    if (!at('formReceived')) return pick('form_nudge');" },
  { name: 'suggest-delivery-paid', file: 'api/_lib/taskRules.js', from: "    case 'delivery': return allPaid && drive && !p.delivery?.emailSent ? pick('delivery') : null;", to: "    case 'delivery': return drive && !p.delivery?.emailSent ? pick('delivery') : null;" },
  { name: 'zapier-fallback', file: 'src/lib/compose.js', from: "export const sendDoor = (emails, kind) => (emails?.resend || !ZAPIER_KINDS.includes(kind) ? { compose: KIND_TEMPLATE[kind] || (templateOf(kind) ? kind : 'custom') } : { zapier: kind });", to: "export const sendDoor = (emails, kind) => ({ compose: KIND_TEMPLATE[kind] || (templateOf(kind) ? kind : 'custom') });" },
  { name: 'kind-template', file: 'src/lib/compose.js', from: "export const KIND_TEMPLATE = { intro: 'intro_call', onboarding: 'onboarding', invoice: 'invoice', delivery: 'delivery' };", to: "export const KIND_TEMPLATE = { intro: 'custom', onboarding: 'onboarding', invoice: 'invoice', delivery: 'delivery' };" },
  { name: 'picker-pins', file: 'src/lib/compose.js', from: "  return pinned ? [{ id: 'suggested', label: 'Suggested', rows: [pinned] }, ...groups] : groups;", to: "  void pinned; return groups;" },
  { name: 'draft-restore', file: 'src/lib/compose.js', from: "export function writeDraft(key, draft) { try { localStorage.setItem(key, JSON.stringify({ ...draft, at: new Date().toISOString() })); } catch { /* storage blocked: the draft lives in memory only */ } }", to: "export function writeDraft() { }" },
  { name: 'switch-asks', file: 'src/lib/compose.js', from: "export const needsConfirmToSwitch = (value, source) => !!value && !!source && !sameEmail(value, source);", to: "export const needsConfirmToSwitch = () => false;" },
  { name: 'send-disabled-missing', file: 'src/lib/compose.js', from: "=> !!value && !missing.length && to.length > 0 && !sending", to: "=> !!value && to.length > 0 && !sending" },
  { name: 'sent-map-self', file: 'src/lib/compose.js', from: "if (!e || e.toSelf || !['sent', 'test', 'queued'].includes(e.status)) continue;", to: "if (!e || !['sent', 'test', 'queued'].includes(e.status)) continue;" },
  { name: 'iframe-sandbox', file: 'src/components/email/EmailPreview.jsx', from: 'sandbox=""', to: 'sandbox="allow-scripts"' },
  /* Milestone 4: the queue's day rule, cancel, the failed send's task and push, Recent sends, the cron. */
  { name: 'queue-day', file: 'api/_lib/email/queue.js', from: "    return byDay ? zoneDayKey(at) <= today : at <= now;", to: "    return at <= now;" },
  { name: 'queue-cancel', file: 'api/_routes/email.js', from: "      await updateLog(db, _id, { status: 'draft', sendAt: '' });", to: "" },
  { name: 'fail-task', file: 'api/_lib/email/failed.js', from: "    await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { checklists: next, updatedAt: new Date() } });\n    lead.checklists = next;", to: "    void next;" },
  { name: 'fail-push', file: 'api/_lib/email/failed.js', from: "    await sendPush(db, { title: `Email failed: ${name}`, body: `${business}. ${said}`, url: `${base}/leads?open=${String(lead._id)}` });", to: "    void base;" },
  { name: 'recent-failures-first', file: 'api/_lib/email/log.js', from: "  return [...rows.filter(r => r.status === 'failed'), ...rows.filter(r => r.status !== 'failed')].slice(0, limit);", to: "  return rows.slice(0, limit);" },
  { name: 'cron-queue', file: 'api/_routes/cron-reminders.js', from: "  try { emails = await runQueuedSends(db, now.getTime(), { byDay: !FIFTEEN_MINUTE_MODE }); } catch { /* the digest still goes; the queue waits for the next run */ }", to: "  void runQueuedSends;" },
  /* Milestone 5: the contract's checkpoint, the concepts offer stamp, a template option, the lead route's fields. */
  { name: 'contract-tick', file: 'api/_lib/email.js', from: ", contract: 'contractSent' };", to: " };" },
  { name: 'offer-stamp', file: 'api/_lib/email/stamps.js', from: "  if (kind === 'concepts_in_progress' && !lead.conceptsOffered) set.conceptsOffered = sentAt;", to: "" },
  { name: 'option-blocks', file: 'api/_lib/email/templates.js', from: "  const blocks = extra.length ? [...own, ...extra] : own;", to: "  const blocks = own; void extra;" },
  { name: 'lead-fields', file: 'api/_routes/call-leads.js', from: "      noShowAt: str(b.meeting.noShowAt, 40), // the email system: Rob logged a no show, so the missed call email fits\n", to: "", also: [["    conceptsOffered: b.conceptsOffered !== undefined ? str(b.conceptsOffered, 40) : undefined,\n", ""]] },
  /* Milestone 6: the invoice number, the totals, the pay rows, the terms, the paid event's draft, the plan's bill day. */
  { name: 'invoice-number-atomic', file: 'api/_lib/email/invoiceNumber.js', from: "  const r = await db.collection('settings').findOneAndUpdate(\n    { _id: EMAIL_SETTINGS_ID },\n    { $inc: { invoiceCounter: 1 }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },\n    { upsert: true, returnDocument: 'after', includeResultMetadata: true },\n  );\n  const doc = r && typeof r === 'object' && 'value' in r ? r.value : r;", to: "  const cur = await db.collection('settings').findOne({ _id: EMAIL_SETTINGS_ID }); await new Promise(res => setTimeout(res, 1)); const n = (Number(cur?.invoiceCounter) || 0) + 1; await db.collection('settings').updateOne({ _id: EMAIL_SETTINGS_ID }, { $set: { invoiceCounter: n } }, { upsert: true }); const doc = { invoiceCounter: n };" },
  { name: 'invoice-number-kept', file: 'api/_lib/email/send.js', from: "  if (base.id === 'invoice' && !next.number && !testToSelf) next = { ...next, number: await allocateInvoiceNumber(db) };", to: "  if (base.id === 'invoice' && !testToSelf) next = { ...next, number: await allocateInvoiceNumber(db) };" },
  { name: 'invoice-number-preview', file: 'api/_lib/email/vars.js', from: "    v['invoice.number'] = str(invoice.number, 20) || nextInvoiceNumber(settings);", to: "    v['invoice.number'] = str(invoice.number, 20) || 'INV-0000'; void nextInvoiceNumber;" },
  { name: 'totals-math', file: 'api/_lib/email/vars.js', from: "    const left = Math.max(0, total - paid - (invoiceStatus(invoice, now) === 'paid' ? 0 : amount));", to: "    const left = Math.max(0, total - paid);" },
  { name: 'pay-set-only', file: 'api/_lib/email/vars.js', from: "    const others = methods.filter(m => m.id !== 'card');", to: "    const others = [...methods.filter(m => m.id !== 'card'), { id: 'venmo', name: 'Venmo', url: 'https://venmo.com/u/nobody' }];" },
  { name: 'pay-portal', file: 'api/_lib/email/vars.js', from: "    if (v.portalLink && others.length) pay.push({ label: 'Cash App, Venmo or Zelle', url: v.portalLink, style: 'secondary' });", to: "    if (false) pay.push({ label: 'Cash App, Venmo or Zelle', url: v.portalLink, style: 'secondary' });" },
  { name: 'pay-card', file: 'api/_lib/email/vars.js', from: "    if (card) pay.push({ label: `Pay ${money(amount)} with card or Apple Pay`, url: card.url, style: 'primary' });", to: "    void card;" },
  { name: 'terms-pricing', file: 'api/_lib/email/settings.js', from: "Extra rounds are ${money(EXTRA_ROUND.design)} for design or ${money(EXTRA_ROUND.web)} for web.", to: "Extra rounds are $55 for design or $80 for web." },
  { name: 'terms-vars', file: 'api/_lib/email/vars.js', from: "  if (Array.isArray(v['invoice.terms'])) v['invoice.terms'] = v['invoice.terms'].map(t => t.replace(", to: "  if (false) v['invoice.terms'] = v['invoice.terms'].map(t => t.replace(" },
  { name: 'paid-drafts-tap', file: 'api/_routes/projects.js', from: "    if (before) { for (const n of allowed.invoices) { if (n.status === 'paid' && !wasPaid.has(n.id)) {", to: "    if (false) { for (const n of allowed.invoices) { if (n.status === 'paid' && !wasPaid.has(n.id)) {" },
  { name: 'paid-drafts-deal', file: 'api/_routes/call-leads.js', from: "    if (paidBefore) { for (const n of allowed.deal.invoices) {", to: "    if (false) { for (const n of allowed.deal.invoices) {" },
  { name: 'paid-drafts-webhook', file: 'api/_lib/stripe.js', from: "      try { const { draftEmail } = await import('./email/drafts.js'); await draftEmail(db, { recordId: String(lead._id), projectId: String(p._id), invoiceId: item.id, templateId: 'payment_received' }); } catch { /* the ledger is written; the draft can be made from the record */ }", to: "" },
  { name: 'draft-task', file: 'api/_lib/email/drafts.js', from: "    await db.collection('call_leads').updateOne({ _id: ctx.lead._id }, { $set: { checklists: next, updatedAt: new Date() } });", to: "    void next;" },
  { name: 'plan-drafts-email', file: 'api/_routes/cron-daily.js', from: "    try { await draftEmail(db, { recordId: String(p.leadId), projectId: String(p._id), invoiceId: line.id, templateId: 'invoice' }); } catch { /* the line is drafted; the email can be made from the record */ }", to: "" },
  /* Milestone 7: the delivery gate and its stamps and tasks, the needs at send, the review link, optional buttons, the round line. */
  { name: 'delivery-paid', file: 'api/_lib/email/send.js', from: "  if (!paidInFull(ctx.project)) return 'The delivery email waits for full payment.';", to: "" },
  { name: 'delivery-checkbox', file: 'api/_lib/email/send.js', from: "  if (opts.driveShared !== true) return 'Tick \"The Drive folder is shared as Viewer\" first.';", to: "" },
  { name: 'delivery-drive', file: 'api/_lib/email/send.js', from: "  if (!/^https?:\\/\\//i.test(String(ctx.project.links?.drive || ''))) return 'Add the Drive folder link first.';", to: "" },
  { name: 'delivery-stamps', file: 'api/_lib/email/stamps.js', from: "emailSent: true, pitchSent: true, driveShared: true }, deliveredAt, checklists: lists, updatedAt: new Date() } });", to: "emailSent: true }, checklists: lists, updatedAt: new Date() } });" },
  { name: 'delivery-tasks', file: 'api/_lib/email/stamps.js', from: "    if (!has(`dlret${pid}`)) lists = addTask(lists, listId(), { id: `dlret${pid}`, text: 'Send the retainer follow up', due: dayAfter(deliveredAt, 3, 10), source: 'manual', listName: 'Delivery' });", to: "", also: [["    if (!has(`dlrev${pid}`)) lists = addTask(lists, listId(), { id: `dlrev${pid}`, text: 'Ask for a review', due: dayAfter(project.releasedAt || deliveredAt, 3, 10), source: 'manual', listName: 'Delivery' });", ""]] },
  { name: 'review-mint', file: 'api/_lib/email/send.js', from: "  if (base0?.id === 'review_request' && !testToSelf) await ensureReviewToken(db, ctx);", to: "" },
  { name: 'optional-button', file: 'api/_lib/email/render.js', from: "if (!url) { if (b.optional) return; missing.add(", to: "if (!url) { missing.add(" },
  { name: 'round-line', file: 'api/_lib/email/vars.js', from: "const fee = `Extra rounds are ${money(EXTRA_ROUND.design)} for design or ${money(EXTRA_ROUND.web)} for web.`;", to: "const fee = 'Extra rounds cost more.';" },
  { name: 'known-template', file: 'src/lib/compose.js', from: "export const knownTemplate = (id) => (id && templateOf(id) ? id : null);", to: "export const knownTemplate = (id) => id || null;" },
  /* Milestone 8: the rules (the day, the draft, the push, the send, the cooldown, the opt out, the stage, the address, the cap, the rate guard,
     per project, the cron), the draft send door, the task's entry, the Zapier retirement, the preview lint. */
  { name: 'rule-day', file: 'api/_lib/taskRules.js', from: "const REMINDER_DAYS = 3;", to: "const REMINDER_DAYS = 0;" },
  { name: 'rule-draft', file: 'api/_lib/email/rules.js', from: "        if (mode === 'draft') { await draft(); continue; }", to: "        if (mode === 'draft') { mode = 'send'; }", also: [["    for (const { rule, tpl, mode } of live) {", "    for (let { rule, tpl, mode } of live) {"]] },
  { name: 'rule-push', file: 'api/_lib/email/rules.js', from: "  if (drafted.length) { try { await sendPush(db, { title: `${n(drafted.length, 'email')} ready to send`,", to: "  if (false) { try { await sendPush(db, { title: `${n(drafted.length, 'email')} ready to send`," },
  { name: 'rule-send-draft', file: 'api/_lib/email/rules.js', from: "        if (standing) r = await sendDraft(db, standing, { auto: true }, now);\n        else {", to: "        void standing; void sendDraft;\n        {" },
  { name: 'rule-cooldown', file: 'api/_lib/email/rules.js', from: "        if (last && last + rule.cooldownDays * DAY_MS > now) { out.skipped++; continue; }", to: "        void last;" },
  { name: 'rule-optout', file: 'api/_lib/email/rules.js', from: "        if (isMarketing(tpl) && lead.emailOptOut) { out.skipped++; continue; }", to: "        void isMarketing;" },
  { name: 'rule-stage', file: 'api/_lib/email/rules.js', from: "find({ deleted: { $ne: true }, stage: { $nin: ['declined', 'lost'] } }).toArray();", to: "find({ deleted: { $ne: true } }).toArray();" },
  { name: 'rule-400-drafts', file: 'api/_lib/email/rules.js', from: "        else if (r.status === 400) await draft(); /* no address, a missing value: the draft and its task say what to fill in */", to: "        else if (r.status === 400) out.failed++;" },
  { name: 'rule-cap', file: 'api/_lib/email/rules.js', from: "        if (autoSent >= AUTO_SEND_CAP) { out.capped = true; await draft(); continue; }", to: "        void AUTO_SEND_CAP;" },
  { name: 'rule-limited', file: 'api/_lib/email/rules.js', from: "        else if (r.status === 429) { out.limited = true; return finish(db, out, drafted); }", to: "        else if (r.status === 429) out.failed++;" },
  { name: 'rule-per-project', file: 'api/_lib/email/rules.js', from: "      const targets = rule.scope === 'project' ? [...own, ...(dealToo ? [null] : [])] : [null];", to: "      const targets = rule.scope === 'project' ? [own[0] || null] : [null];" },
  { name: 'cron-rules', file: 'api/_routes/cron-reminders.js', from: "  try { rules = await runEmailRules(db, now.getTime()); } catch { /* the digest still goes; the rules run again tomorrow */ }", to: "  void runEmailRules;" },
  { name: 'send-draft-door', file: 'api/_routes/email.js', from: "      if (b.send === true) {\n        const r = await sendDraft(db, row, { confirmDuplicate: b.confirmDuplicate === true, driveShared: b.driveShared === true });", to: "      if (b.send === true) {\n        const r = await sendDraft(db, row, { confirmDuplicate: b.confirmDuplicate === true, driveShared: b.driveShared === true }); r.status = r.status === 200 ? 200 : r.status; if (r.status === 200) await db.collection('email_log').insertOne({ ...row, _id: undefined, status: 'draft' });" },
  { name: 'send-draft-only', file: 'api/_lib/email/drafts.js', from: "  if (!row || !['draft', 'queued'].includes(row.status)) return { status: 409, body: { error: 'Only a draft or a queued email can be sent now.' } };", to: "  if (!row) return { status: 409, body: { error: 'Only a draft or a queued email can be sent now.' } };" },
  { name: 'send-draft-renders', file: 'api/_lib/email/drafts.js', from: "  const r = await sendComposed(db, ctx, { templateId: row.templateId }, { auto: opts.auto === true, confirmDuplicate: opts.confirmDuplicate === true, driveShared: opts.driveShared === true, reuseLogId: row._id });", to: "  const r = await (async () => { const { sendLogged } = await import('./send.js'); const x = await sendLogged(db, row); return x.ok ? { status: 200, body: { ok: true, sentAt: x.sentAt } } : { status: 502, body: { error: x.error } }; })();" },
  { name: 'draft-task-done', file: 'api/_lib/email/drafts.js', from: "  if (r.status === 200 && !r.body.queued) r.body.taskDone = await finishDraftTask(db, ctx.lead._id, row._id, now);", to: "  if (r.status === 200 && !r.body.queued) r.body.taskDone = true; void finishDraftTask;" },
  { name: 'task-email-id', file: 'api/_lib/taskRules.js', from: "      emailId: str(it?.emailId, 40),\n", to: "" },
  { name: 'cron-unknown-job', file: 'api/cron/index.js', from: "const fn = typeof job === 'string' && Object.hasOwn(JOBS, job) ? JOBS[job] : null;", to: "const fn = JOBS[job];" },
  { name: 'zapier-410', file: 'api/_routes/send-email.js', from: "  if (emailConnected()) return res.status(410).json({ error: RETIRED, retired: true });", to: "  void emailConnected; void RETIRED;" },
  { name: 'preview-lint', file: 'api/_lib/email/templates.js', from: "    subject: 'Good talking to you, {{firstName}}', preheader: 'Grab a time and I will walk you through some ideas.',", to: "    subject: 'AI wrote this for {{firstName}}', preheader: 'Grab a time and I will walk you through some ideas.'," },
];

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
let bad = 0; let proven = 0;
for (const cut of CUTS) {
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'email-cut-')); const apiCopy = path.join(tmp, 'api'); const srcCopy = path.join(tmp, 'src');
  fs.cpSync(path.join(repoRoot, 'api'), apiCopy, { recursive: true });
  for (const d of ['lib', 'shared', 'components/email']) fs.cpSync(path.join(repoRoot, 'src', d), path.join(srcCopy, d), { recursive: true });
  const file = path.join(tmp, cut.file);
  let text = fs.readFileSync(file, 'utf8');
  const edits = [[cut.from, cut.to], ...(cut.also || [])];
  let missing = false;
  for (const [from, to] of edits) { if (!text.includes(from)) { missing = true; break; } text = text.replace(from, to); }
  if (missing) { console.log(`FAIL ${cut.name}: the guard's line is not in ${cut.file}`); bad++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  fs.writeFileSync(file, text);
  let results = [];
  try { results = await runEmail(apiCopy, srcCopy); } catch (e) { results = [{ ok: false, msg: `threw: ${e.message}`, guard: cut.name }]; }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const own = results.filter(r => r.guard === cut.name);
  const failed = own.filter(r => !r.ok);
  if (!own.length) { bad++; console.log(`FAIL ${cut.name}: no check carries this guard`); continue; }
  if (failed.length) { proven++; console.log(`ok   ${cut.name}: without the guard, ${failed.length} of ${own.length} check(s) fail (${failed[0].msg.slice(0, 90)})`); }
  else { bad++; console.log(`FAIL ${cut.name}: every check still passes with the guard cut out`); }
}
console.log(bad ? `\n${bad} guard(s) not proven.` : `\nEvery guard proven: ${proven} cut in turn, each one's check fails.`);
process.exit(bad ? 1 : 0);
