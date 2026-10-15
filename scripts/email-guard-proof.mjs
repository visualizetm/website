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
  { name: 'missing-refuses', file: 'api/_lib/email/send.js', from: "  if (rendered.missing.length) return { status: 400, body: { error: `Fill in ${rendered.missing.join(', ')} first.`, missing: rendered.missing } };", to: "" },
  { name: 'optout-marketing', file: 'api/_lib/email/send.js', from: "  if (marketing && !testToSelf && lead.emailOptOut) return", to: "  if (false && marketing && !testToSelf && lead.emailOptOut) return" },
  { name: 'optout-transactional', file: 'api/_lib/email/send.js', from: "  if (marketing && !testToSelf && lead.emailOptOut) return", to: "  if (!testToSelf && lead.emailOptOut) return" },
  { name: 'duplicate', file: 'api/_lib/email/send.js', from: "  if (!testToSelf && opts.confirmDuplicate !== true) {", to: "  if (false) {" },
  { name: 'test-no-tick', file: 'api/_lib/email/send.js', from: "  if (testToSelf) return { status: 200, body: { ok: true, test: r.test, sentAt, logId: String(log._id), toSelf: true, message: r.test ? TEST_MESSAGE : `Test sent to ${sender.address}.` } };", to: "" },
  { name: 'checkpoint-tick', file: 'api/_lib/email/send.js', from: "  const stamps = await applySendStamps(db, { lead, project, invoice: inv, kind: base.stamp || base.id, sentAt, note: `Sent ${base.name.toLowerCase()}` });", to: "  const stamps = { updatedAt: 1 }; void inv;" },
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
  { name: 'zapier-fallback', file: 'src/lib/compose.js', from: "export const sendDoor = (emails, kind) => (emails?.resend ? { compose: KIND_TEMPLATE[kind] || 'custom' } : { zapier: kind });", to: "export const sendDoor = (emails, kind) => ({ compose: KIND_TEMPLATE[kind] || 'custom' });" },
  { name: 'kind-template', file: 'src/lib/compose.js', from: "export const KIND_TEMPLATE = { intro: 'intro_call', onboarding: 'onboarding', invoice: 'invoice', delivery: 'delivery' };", to: "export const KIND_TEMPLATE = { intro: 'custom', onboarding: 'onboarding', invoice: 'invoice', delivery: 'delivery' };" },
  { name: 'picker-pins', file: 'src/lib/compose.js', from: "  return pinned ? [{ id: 'suggested', label: 'Suggested', rows: [pinned] }, ...groups] : groups;", to: "  void pinned; return groups;" },
  { name: 'draft-restore', file: 'src/lib/compose.js', from: "export function writeDraft(key, draft) { try { localStorage.setItem(key, JSON.stringify({ ...draft, at: new Date().toISOString() })); } catch { /* storage blocked: the draft lives in memory only */ } }", to: "export function writeDraft() { }" },
  { name: 'switch-asks', file: 'src/lib/compose.js', from: "export const needsConfirmToSwitch = (value, source) => !!value && !!source && !sameEmail(value, source);", to: "export const needsConfirmToSwitch = () => false;" },
  { name: 'send-disabled-missing', file: 'src/lib/compose.js', from: "=> !!value && !missing.length && to.length > 0 && !sending", to: "=> !!value && to.length > 0 && !sending" },
  { name: 'sent-map-self', file: 'src/lib/compose.js', from: "if (!e || e.toSelf || !['sent', 'test', 'queued'].includes(e.status)) continue;", to: "if (!e || !['sent', 'test', 'queued'].includes(e.status)) continue;" },
  { name: 'iframe-sandbox', file: 'src/components/email/EmailPreview.jsx', from: 'sandbox=""', to: 'sandbox="allow-scripts"' },
  { name: 'known-template', file: 'src/lib/compose.js', from: "export const knownTemplate = (id) => (id && templateOf(id) ? id : null);", to: "export const knownTemplate = (id) => id || null;" },
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
