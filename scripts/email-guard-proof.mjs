#!/usr/bin/env node
/* Each guard the email system added, cut out of a copy of api/ in turn: with the cut in place the check that carries
 * that guard's name in scripts/email-lib.mjs must fail. A guard whose checks all still pass without it is reported as
 * not proven and the run exits 1.
 *   node scripts/email-guard-proof.mjs */
process.env.TZ = 'America/New_York';
import fs from 'fs';
import path from 'path';
import { runEmail, repoRoot } from './email-lib.mjs';

const CUTS = [
  { name: 'test-mode', file: '_lib/email/transport.js', from: "  if (!key) return { ok: true, test: true, status: 'test', providerId: '', error: '', attempts: 0 };", to: "  const useKey = key || 'none';" , also: [["const payload = { from: fromLine(sender), to,", "const payload = { from: fromLine(sender), to,"], ["let r = await post(payload, key);", "let r = await post(payload, useKey);"]] },
  { name: 'retry-5xx', file: '_lib/email/transport.js', from: "  if (retriable(r)) { attempts = 2; r = await post(payload, key); }", to: "" },
  { name: 'one-retry', file: '_lib/email/transport.js', from: "  if (retriable(r)) { attempts = 2; r = await post(payload, key); }", to: "  while (retriable(r) && attempts < 4) { attempts += 1; r = await post(payload, key); }" },
  { name: 'no-retry-4xx', file: '_lib/email/transport.js', from: "const retriable = (r) => r.status === 0 || r.status >= 500;", to: "const retriable = (r) => !(r.status >= 200 && r.status < 300);" },
  { name: 'scrub-key', file: '_lib/email/transport.js', from: "error: scrub(said, key), attempts, httpStatus: r.status };", to: "error: String(said).slice(0, 300), attempts, httpStatus: r.status };" },
  { name: 'rate-guard', file: '_lib/email/transport.js', from: "  if (limit.exceeded) return { ok: false, test: !emailConnected(), status: 'failed', providerId: '', error: LIMIT_MESSAGE, attempts: 0, limited: true, retryAfter: limit.retryAfter };", to: "" },
  { name: 'rate-count', file: '_lib/email/transport.js', from: "  await rateHit(db, RATE_KEY, limit.hits);", to: "" },
  { name: 'status-no-key', file: '_routes/email.js', from: "return res.status(200).json({ connected: emailConnected(), sender: settings.sender, from: fromLine(settings.sender), sentLastHour, limit: SENDS_PER_HOUR });", to: "return res.status(200).json({ connected: emailConnected(), key: process.env.RESEND_API_KEY || '', sender: settings.sender, from: fromLine(settings.sender), sentLastHour, limit: SENDS_PER_HOUR });" },
  { name: 'status-method', file: '_routes/email.js', from: "  if (!allow.includes(req.method)) { res.setHeader('Allow', allow.join(', ')); return res.status(405).json({ error: 'method not allowed' }); }", to: "" },
  { name: 'log-indexes', file: '_lib/email/log.js', from: "  for (const [spec] of INDEXES) { try { await col.createIndex(spec); } catch { /* exists, or the database is down; the write below says so */ } }", to: "  void col;" },
  { name: 'log-cap', file: '_lib/email/log.js', from: "subject: str(e.subject, 200), text: str(e.text, 20000), html: str(e.html, HTML_CAP),", to: "subject: String(e.subject ?? ''), text: String(e.text ?? ''), html: String(e.html ?? '')," },
  /* Milestone 2: the renderer, the send pipeline, the settings and the opt out door. */
  { name: 'escape', file: '_lib/email/render.js', from: "export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');", to: "export const esc = (s) => String(s ?? '');" },
  { name: 'js-url', file: '_lib/email/render.js', from: "export const safeLink = (u) => { const t = String(u || '').trim(); return isHttp(t) || isMailto(t) ? t.slice(0, 600) : ''; };", to: "export const safeLink = (u) => String(u || '').trim().slice(0, 600);" },
  { name: 'size-cap', file: '_lib/email/render.js', from: "missing: [...missing], warnings, bytes, tooBig: bytes > HTML_LIMIT };", to: "missing: [...missing], warnings: warnings.filter(w => !/90 KB/.test(w)), bytes, tooBig: false };" },
  { name: 'missing-refuses', file: '_lib/email/send.js', from: "  if (rendered.missing.length) return { status: 400, body: { error: `Fill in ${rendered.missing.join(', ')} first.`, missing: rendered.missing } };", to: "" },
  { name: 'optout-marketing', file: '_lib/email/send.js', from: "  if (marketing && !testToSelf && lead.emailOptOut) return", to: "  if (false && marketing && !testToSelf && lead.emailOptOut) return" },
  { name: 'optout-transactional', file: '_lib/email/send.js', from: "  if (marketing && !testToSelf && lead.emailOptOut) return", to: "  if (!testToSelf && lead.emailOptOut) return" },
  { name: 'duplicate', file: '_lib/email/send.js', from: "  if (!testToSelf && opts.confirmDuplicate !== true) {", to: "  if (false) {" },
  { name: 'test-no-tick', file: '_lib/email/send.js', from: "  if (testToSelf) return { status: 200, body: { ok: true, test: r.test, sentAt, logId: String(log._id), toSelf: true, message: r.test ? TEST_MESSAGE : `Test sent to ${sender.address}.` } };", to: "" },
  { name: 'checkpoint-tick', file: '_lib/email/send.js', from: "  const stamps = await applySendStamps(db, { lead, project, invoice: inv, kind: base.stamp || base.id, sentAt, note: `Sent ${base.name.toLowerCase()}` });", to: "  const stamps = { updatedAt: 1 }; void inv;" },
  { name: 'unsub-headers', file: '_lib/email/send.js', from: "    headers['List-Unsubscribe'] = `<${unsubscribeApiFor(token)}>`;\n    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';\n  }\n  const subject", to: "    void token; void unsubscribeApiFor;\n  }\n  const subject" },
  { name: 'unsub-sets', file: '_routes/unsubscribe-public.js', from: "{ $set: { emailOptOut: out, emailOptOutAt: out ? new Date().toISOString() : '', updatedAt: new Date() } }", to: "{ $set: { updatedAt: new Date() } }" },
  { name: 'unsub-404', file: '_routes/unsubscribe-public.js', from: "  if (!lead) return notFound(res);", to: "  const found = lead || { _id: null, business: '', askFor: '', emailOptOut: false };", also: [["  const shape = (l) =>", "  void notFound; const shape = (l) =>"], ["  if (req.method === 'GET') return res.status(200).json(shape(lead));", "  if (req.method === 'GET') return res.status(200).json(shape(found));"], ["  await leads.updateOne({ _id: lead._id },", "  await leads.updateOne({ _id: found._id },"]] },
  { name: 'reset', file: '_routes/email.js', from: "        if (clean === null) delete t[id]; else if (clean) t[id] = clean;", to: "        if (clean) t[id] = clean;" },
];

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
let bad = 0; let proven = 0;
for (const cut of CUTS) {
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'email-cut-')); const apiCopy = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiCopy, { recursive: true });
  const file = path.join(apiCopy, cut.file);
  let text = fs.readFileSync(file, 'utf8');
  const edits = [[cut.from, cut.to], ...(cut.also || [])];
  let missing = false;
  for (const [from, to] of edits) { if (!text.includes(from)) { missing = true; break; } text = text.replace(from, to); }
  if (missing) { console.log(`FAIL ${cut.name}: the guard's line is not in ${cut.file}`); bad++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  fs.writeFileSync(file, text);
  let results = [];
  try { results = await runEmail(apiCopy); } catch (e) { results = [{ ok: false, msg: `threw: ${e.message}`, guard: cut.name }]; }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const own = results.filter(r => r.guard === cut.name);
  const failed = own.filter(r => !r.ok);
  if (!own.length) { bad++; console.log(`FAIL ${cut.name}: no check carries this guard`); continue; }
  if (failed.length) { proven++; console.log(`ok   ${cut.name}: without the guard, ${failed.length} of ${own.length} check(s) fail (${failed[0].msg.slice(0, 90)})`); }
  else { bad++; console.log(`FAIL ${cut.name}: every check still passes with the guard cut out`); }
}
console.log(bad ? `\n${bad} guard(s) not proven.` : `\nEvery guard proven: ${proven} cut in turn, each one's check fails.`);
process.exit(bad ? 1 : 0);
