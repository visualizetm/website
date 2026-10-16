/* Compose (the email system, milestone 3): the pure helpers behind the
 * Compose screen and the shared editor. Nothing here renders an email; the
 * server does (POST /api/admin/email/preview). This file knows the block
 * shapes the renderer accepts, how to move and insert, where a draft lives
 * on the device and where each missing variable is set. */
import { EMAIL_TEMPLATES, templateOf, TEMPLATE_GROUPS } from '../shared/emailTemplates.js';

/** The old send kinds (the four Zapier buttons) and the template each one opens Compose on. */
export const KIND_TEMPLATE = { intro: 'intro_call', onboarding: 'onboarding', invoice: 'invoice', delivery: 'delivery' };
/** Where one of the four old buttons goes: Compose on its template once Resend is connected, the Zapier modal until then (the fallback switch). */
export const ZAPIER_KINDS = ['intro', 'onboarding', 'invoice', 'delivery'];
export const sendDoor = (emails, kind) => (emails?.resend || !ZAPIER_KINDS.includes(kind) ? { compose: KIND_TEMPLATE[kind] || (templateOf(kind) ? kind : 'custom') } : { zapier: kind });
/** Variables a chip never inserts into text: lists of objects a `from` block draws, and the opt out link the renderer adds itself. */
export const NO_INSERT = ['invoice.items', 'deliverables.groups', 'optOutUrl'];
export const isAddress = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
/** Tomorrow at 9am on this device, as an ISO instant (the one queued time Send's menu offers). */
export function tomorrowNine(now = new Date()) { const t = new Date(now); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); return t.toISOString(); }
/** The last real send per template from the record's log (test sends to Rob and failures do not count), for the suggestion's cooldown. */
export function sentMapOf(items = []) {
  const out = {};
  for (const e of items) { if (!e || e.toSelf || !['sent', 'test', 'queued'].includes(e.status)) continue; const at = e.sentAt || e.createdAt || ''; if (!out[e.templateId] || String(at) > String(out[e.templateId])) out[e.templateId] = at; }
  return out;
}
/** Send is live only with an email, every value the template needs, no opt out in the way, nothing in flight and a preview that rendered. */
export const canSendNow = ({ value, missing = [], to = [], sending = '', optedOut = false, previewOk = true }) => !!value && !missing.length && to.length > 0 && !sending && !optedOut && previewOk;
/** Switching templates asks first when the email differs from its source. */
export const needsConfirmToSwitch = (value, source) => !!value && !!source && !sameEmail(value, source);
export const BLOCK_LABELS = { eyebrow: 'Eyebrow', heading: 'Heading', text: 'Text', button: 'Button', lines: 'Lines', totals: 'Totals', list: 'List', box: 'Box', files: 'Files', spacer: 'Spacer', pay: 'Pay buttons' };
export const BLOCK_ICONS = { eyebrow: 'Type01', heading: 'Heading01', text: 'AlignLeft', button: 'CursorClick01', lines: 'List', totals: 'CurrencyDollar', list: 'Dotpoints01', box: 'Square', files: 'Folder', spacer: 'Minus', pay: 'CreditCard01' };
export const BLOCK_HINTS = { eyebrow: 'A small red label above the heading', heading: 'The headline; the red period is added', text: 'A paragraph; **bold** and [label](url) work', button: 'A red pill, or a grey one', lines: 'Labelled rows with a value on the right', totals: 'A totals block, one row can be big', list: 'Red bullets, one item a line', box: 'An inner panel with a title', files: 'File groups with a count', spacer: '16px of air', pay: 'The ways to pay the invoice, from the record' };
export const ADD_ORDER = ['text', 'heading', 'button', 'list', 'lines', 'totals', 'box', 'eyebrow', 'files', 'pay', 'spacer'];
export const SUBJECT_SOFT_MAX = 60;

/** A fresh block of a type, ready to edit. */
export function newBlock(type) {
  switch (type) {
    case 'eyebrow': return { type, text: '' };
    case 'heading': return { type, text: '' };
    case 'text': return { type, text: '' };
    case 'button': return { type, label: '', url: '', style: 'primary' };
    case 'lines': return { type, from: '', rows: [{ label: '', sub: '', value: '' }] };
    case 'totals': return { type, from: '', rows: [{ label: '', value: '', big: false }] };
    case 'list': return { type, from: '', items: [''] };
    case 'box': return { type, title: '', tone: 'default', blocks: [{ type: 'text', text: '' }] };
    case 'files': return { type, from: 'deliverables.groups', groups: [] };
    case 'pay': return { type, from: 'invoice.pay' };
    case 'spacer': return { type };
    default: return null;
  }
}
export const moveBlock = (blocks, i, dir) => { const j = i + dir; if (j < 0 || j >= blocks.length) return blocks; const next = blocks.slice(); const [b] = next.splice(i, 1); next.splice(j, 0, b); return next; };
export const removeBlock = (blocks, i) => blocks.filter((_, k) => k !== i);
export const updateBlock = (blocks, i, patch) => blocks.map((b, k) => (k === i ? { ...b, ...patch } : b));
export const insertBlock = (blocks, i, block) => { const next = blocks.slice(); next.splice(i, 0, block); return next; };
/** A block as the editor shows it: a one line summary for a phone's rows and the drag handle's name. */
export function blockSummary(b) {
  if (!b) return '';
  switch (b.type) {
    case 'button': return b.label || 'Button';
    case 'lines': case 'files': return b.from ? `From ${b.from}` : `${(b.rows || b.groups || []).length} rows`;
    case 'totals': return `${(b.rows || []).length} rows`;
    case 'list': return b.from ? `From ${b.from}` : `${(b.items || []).filter(Boolean).length} items`;
    case 'box': return b.title || 'Box';
    case 'spacer': return '16px of air';
    case 'pay': return 'The ways to pay, from the record';
    default: return String(b.text || '').slice(0, 80);
  }
}

/* Drafts: one per record and template on this device, so leaving Compose and coming back picks up where Rob left off. */
export const draftKey = (recordId, templateId) => `vz_email_draft:${recordId}:${templateId}`;
export function readDraft(key) { try { const raw = localStorage.getItem(key); const d = raw ? JSON.parse(raw) : null; return d && typeof d === 'object' && Array.isArray(d.blocks) ? d : null; } catch { return null; } }
export function writeDraft(key, draft) { try { localStorage.setItem(key, JSON.stringify({ ...draft, at: new Date().toISOString() })); } catch { /* storage blocked: the draft lives in memory only */ } }
export function clearDraft(key) { try { localStorage.removeItem(key); } catch { /* fine */ } }
/** The same email? Subject, preheader and blocks compared as data; the address list is not part of it. */
export const sameEmail = (a, b) => JSON.stringify([a?.subject || '', a?.preheader || '', a?.blocks || []]) === JSON.stringify([b?.subject || '', b?.preheader || '', b?.blocks || []]);

/** {{key}} dropped into a string at the caret: the new text and where the caret lands. */
export function insertToken(text, start, end, key) {
  const s = String(text || ''); const a = Math.max(0, Math.min(s.length, start ?? s.length)); const b = Math.max(a, Math.min(s.length, end ?? a));
  const token = `{{${key}}}`;
  return { text: s.slice(0, a) + token + s.slice(b), caret: a + token.length };
}
export const subjectCount = (s) => String(s || '').length;

/* Where each variable is set, for the Missing fields banner: the label of the chip and where it jumps. `go` is a record
 * section (a tab or a row on the record), a shell destination, or a page. */
export const VAR_HOMES = {
  firstName: { label: 'Add the contact name', go: 'profile' }, fullName: { label: 'Add the contact name', go: 'profile' }, business: { label: 'Add the business name', go: 'profile' }, email: { label: 'Add their email', go: 'profile' },
  calendlyLink: { label: 'Set the Calendly link in Settings', go: 'settings' },
  conceptLink: { label: 'Send a concept set first', go: 'concepts' }, conceptCount: { label: 'Send a concept set first', go: 'concepts' }, conceptCover: { label: 'Add an image to the concept set', go: 'concepts' },
  'meeting.time': { label: 'Set the meeting', go: 'meeting' },
  portalLink: { label: 'Generate the portal link', go: 'portal' }, plannerLink: { label: 'Turn the planner on', go: 'planner' }, showcaseLink: { label: 'Publish the showcase', go: 'showcase' }, reviewLink: { label: 'Generate the review link', go: 'reviews' },
  contractLink: { label: 'Paste the contract link on Checkpoints', go: 'checkpoints' }, driveLink: { label: 'Add the Drive folder link', go: 'files' },
  'package.name': { label: 'Pick the package on Checkpoints', go: 'checkpoints' }, 'package.price': { label: 'Pick the package on Checkpoints', go: 'checkpoints' }, 'package.includes': { label: 'Pick the package on Checkpoints', go: 'checkpoints' },
  'project.name': { label: 'Start the project', go: 'project' }, 'revisions.used': { label: 'Log a round on the project', go: 'project' }, 'revisions.max': { label: 'Start the project', go: 'project' },
  'invoice.number': { label: 'Pick an invoice on Money', go: 'money' }, 'invoice.items': { label: 'Pick an invoice on Money', go: 'money' }, 'invoice.total': { label: 'Pick an invoice on Money', go: 'money' }, 'invoice.paidSoFar': { label: 'Pick an invoice on Money', go: 'money' }, 'invoice.dueNow': { label: 'Pick an invoice on Money', go: 'money' }, 'invoice.dueDate': { label: 'Set the due date on Money', go: 'money' }, 'invoice.leftAfter': { label: 'Pick an invoice on Money', go: 'money' }, 'invoice.leftLine': { label: 'Pick an invoice on Money', go: 'money' }, 'invoice.covers': { label: 'Name what the invoice covers', go: 'money' }, 'invoice.stripeLink': { label: 'The Stripe link is made when the invoice goes out', go: 'money' }, 'invoice.otherPayLink': { label: 'Generate the portal link for the other ways to pay', go: 'portal' }, 'invoice.kind': { label: 'Pick an invoice on Money', go: 'money' }, 'invoice.terms': { label: 'Set the invoice terms in Settings', go: 'settings' },
  'plan.count': { label: 'The project needs a payment plan', go: 'money' }, 'plan.paid': { label: 'The project needs a payment plan', go: 'money' }, 'plan.next': { label: 'The project needs a payment plan', go: 'money' },
  'retainer.name': { label: 'Pick the package first', go: 'checkpoints' }, 'retainer.price': { label: 'Pick the package first', go: 'checkpoints' }, 'retainer.line': { label: 'Pick the package first', go: 'checkpoints' }, 'retainer.link': { label: 'Set the retainer link in Settings', go: 'settings' },
  'deliverables.groups': { label: 'Add the deliverables under Files', go: 'files' }, extrasLine: { label: 'Pick the package on Checkpoints', go: 'checkpoints' },
  optOutUrl: { label: 'The opt out link is made on the first send', go: '' },
};
export const homeOf = (key) => VAR_HOMES[key] || { label: `Fill in ${key}`, go: '' };

/** The picker's groups: every template with its availability, the suggestion pinned first. */
export function pickerGroups(availability = {}, suggestion = null) {
  const rows = EMAIL_TEMPLATES.map(t => ({ id: t.id, name: t.name, when: t.when, group: t.group, class: t.class, available: availability[t.id] ? availability[t.id].available !== false : true, lacking: availability[t.id]?.lacking || [], suggested: t.id === suggestion }));
  const groups = TEMPLATE_GROUPS.map(g => ({ ...g, rows: rows.filter(r => r.group === g.id && !r.suggested) })).filter(g => g.rows.length);
  const pinned = rows.find(r => r.suggested) || null;
  return pinned ? [{ id: 'suggested', label: 'Suggested', rows: [pinned] }, ...groups] : groups;
}
export const templateName = (id) => templateOf(id)?.name || 'Email';
/** The log's status pills (the Emails section, the sent email sheet, Recent sends). */
export const EMAIL_STATUS = { sent: { label: 'Sent', tone: 'booked' }, test: { label: 'Test', tone: 'neutral' }, queued: { label: 'Queued', tone: 'progress' }, failed: { label: 'Failed', tone: 'danger' }, draft: { label: 'Draft', tone: 'new' } };
export const statusOf = (s) => EMAIL_STATUS[s] || EMAIL_STATUS.draft;
/** One line for a log row: the template and the subject. */
export const logTitle = (e) => `${templateName(e?.templateId)}${e?.subject ? `: ${e.subject}` : ''}`;
/** The task on a record that carries an email (a draft or a failed send wrote it, milestone 8), by its id: { emailId, text, done } or null. */
export function emailTaskOf(record, taskId) {
  if (!record || !taskId) return null;
  const t = (record.checklists || []).flatMap(l => (l?.items || [])).find(it => it && it.id === taskId);
  return t && t.emailId ? { emailId: String(t.emailId), text: t.text || '', done: !!t.done } : null;
}
/** A suggestion the registry knows; the rule may name a template that lands in a later milestone, and the chip never opens Compose on one that does not exist yet. */
export const knownTemplate = (id) => (id && templateOf(id) ? id : null);
/** The reason a template is greyed, in one line. */
export const lackingLine = (lacking = []) => (lacking.length ? `Needs ${lacking.map(k => homeOf(k).label.replace(/^(Add|Set|Pick|Paste|Generate|Start|Send|Turn|Publish|Log|Name|The) /, '').replace(/ (in Settings|on Checkpoints|on Money|under Files|first|on the project)$/, '')).filter((x, i, a) => a.indexOf(x) === i).slice(0, 2).join(', ')}` : '');
