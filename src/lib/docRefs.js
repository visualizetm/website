import { conceptSetStatusOf, projectStageOf } from '../shared/semantics';
import { statusOf as conceptStatusOf, reviewLine } from './concepts';
import { invoicesOf, invoiceStatus, INVOICE_STATUS_LABELS } from './invoices';
import { taskDueLabel, isOverdue } from './taskWrite';
import { allTasks } from '../shared/taskRules';

/* Reference blocks (docs job): a doc can point at a record of the same client (a concept set, a project, a task, an invoice or a file) and
 * the chip shows what that record is right now. Nothing is copied into the doc but the kind, the id and a cached name; the name and the
 * status here are read live from what the shell already holds, so a doc never goes stale on a paid invoice. A record that is gone reads
 * "No longer there" with the cached name and opens nothing.
 *
 *   refInfo(ref, ctx)   { label, status, tone, gone, icon, kind }
 *   refOptions(ctx)     what the Reference sheet offers, grouped by kind
 *   ctx = { lead, projects (this client's), sets (this client's) }
 *
 * where a chip leads to is the screen's call (the editor passes the shell's openers); refTarget() says which of them. */
export const REF_KIND_LABELS = { concept: 'Concept set', project: 'Project', task: 'Task', invoice: 'Invoice', file: 'File' };
export const REF_ICONS = { concept: 'LayersThree01', project: 'Folder', task: 'CheckDone01', invoice: 'CreditCard01', file: 'Link01' };
const FILE_LINKS = [['drive', 'Google Drive'], ['website', 'Website'], ['instagram', 'Instagram']];
const money = (n) => `$${Number(n || 0).toLocaleString('en-US')}`;

const taskHome = (ctx, taskId) => {
  const own = allTasks(ctx.lead).find(t => t.id === taskId);
  if (own) return { task: own, project: null };
  for (const p of ctx.projects || []) { const t = allTasks(p).find(x => x.id === taskId); if (t) return { task: t, project: p }; }
  return null;
};
const invoiceHome = (ctx, id) => {
  const deal = (ctx.lead?.deal?.invoices || []).find(i => i.id === id);
  if (deal) return { inv: deal, project: null };
  for (const p of ctx.projects || []) { const inv = invoicesOf(p).find(i => i.id === id); if (inv) return { inv, project: p }; }
  return null;
};
const fileHome = (ctx, id) => {
  const link = FILE_LINKS.find(([k]) => k === id);
  if (link) {
    const l = ctx.lead || {};
    const v = id === 'drive' ? (l.links?.drive || ctx.projects?.find(p => p.links?.drive)?.links?.drive) : (l.links?.[id] || l.socials?.[id]);
    return { name: link[1], href: v || '', project: null };
  }
  for (const p of ctx.projects || []) { const d = (p.deliverables || []).find(x => x.id === id); if (d) return { name: d.label, href: d.link || '', done: !!d.done, deliverable: true, project: p }; }
  return null;
};

export function refInfo(ref, ctx, now = Date.now()) {
  const kind = ref?.kind; const id = ref?.id;
  const gone = (label) => ({ kind, label: label || REF_KIND_LABELS[kind] || 'Record', status: 'No longer there', tone: 'neutral', gone: true, icon: REF_ICONS[kind] });
  if (kind === 'concept') {
    const set = (ctx.sets || []).find(s => String(s._id) === String(id));
    if (!set) return gone(ref.label);
    const st = conceptSetStatusOf(conceptStatusOf(set));
    return { kind, label: set.title || `Concepts, round ${set.round || 1}`, status: reviewLine(set) || st.label, tone: st.tone || 'neutral', gone: false, icon: REF_ICONS.concept };
  }
  if (kind === 'project') {
    const p = (ctx.projects || []).find(x => String(x._id) === String(id));
    if (!p) return gone(ref.label);
    const st = projectStageOf(p.stage);
    return { kind, label: p.name || 'Project', status: p.archived ? 'Archived' : st.label, tone: p.archived ? 'neutral' : (st.tone || 'neutral'), gone: false, icon: REF_ICONS.project };
  }
  if (kind === 'task') {
    const h = taskHome(ctx, id);
    if (!h) return gone(ref.label);
    const t = h.task;
    return { kind, label: t.text || 'Task', status: t.done ? 'Done' : (taskDueLabel(t, now) || 'No date'), tone: t.done ? 'booked' : isOverdue(t, now) ? 'danger' : 'neutral', gone: false, icon: REF_ICONS.task };
  }
  if (kind === 'invoice') {
    const h = invoiceHome(ctx, id);
    if (!h) return gone(ref.label);
    const s = invoiceStatus(h.inv, now);
    return { kind, label: `${h.inv.label || 'Invoice'}${h.inv.amount ? `, ${money(h.inv.amount)}` : ''}`, status: INVOICE_STATUS_LABELS[s], tone: s === 'paid' ? 'booked' : s === 'past-due' ? 'danger' : s === 'due' ? 'new' : 'neutral', gone: false, icon: REF_ICONS.invoice };
  }
  if (kind === 'file') {
    const h = fileHome(ctx, id);
    if (!h) return gone(ref.label);
    return { kind, label: h.name, status: h.deliverable ? (h.done ? 'Ready' : 'Not ready') : (h.href ? 'Link set' : 'No link yet'), tone: h.deliverable ? (h.done ? 'booked' : 'neutral') : (h.href ? 'booked' : 'neutral'), gone: false, icon: REF_ICONS.file };
  }
  return gone(ref?.label);
}

/** Where tapping a chip goes: { to: 'concepts' | 'project' | 'tasks' | 'deal' | 'link', ... } or null for a record that is gone. */
export function refTarget(ref, ctx) {
  const info = refInfo(ref, ctx);
  if (info.gone) return null;
  if (ref.kind === 'concept') return { to: 'concepts', setId: ref.id };
  if (ref.kind === 'project') return { to: 'project', projectId: ref.id };
  if (ref.kind === 'task') { const h = taskHome(ctx, ref.id); return { to: 'tasks', projectId: h?.project?._id || '' }; }
  if (ref.kind === 'invoice') { const h = invoiceHome(ctx, ref.id); return h?.project ? { to: 'project', projectId: h.project._id } : { to: 'deal' }; }
  const h = fileHome(ctx, ref.id);
  return h?.href ? { to: 'link', href: h.href } : h?.project ? { to: 'project', projectId: h.project._id } : { to: 'profile' };
}

/** What the Reference sheet offers: [{ kind, label, items: [{ ref: { kind, id }, label, status }] }], only the kinds this client has something for. */
export function refOptions(ctx, now = Date.now()) {
  const mk = (kind, id) => ({ ref: { kind, id }, ...refInfo({ kind, id }, ctx, now) });
  const groups = [
    { kind: 'concept', items: (ctx.sets || []).map(s => mk('concept', String(s._id))) },
    { kind: 'project', items: (ctx.projects || []).map(p => mk('project', String(p._id))) },
    { kind: 'task', items: [...allTasks(ctx.lead).map(t => t.id), ...(ctx.projects || []).flatMap(p => allTasks(p).map(t => t.id))].filter(Boolean).map(id => mk('task', id)) },
    { kind: 'invoice', items: [...(ctx.lead?.deal?.invoices || []).map(i => i.id), ...(ctx.projects || []).flatMap(p => invoicesOf(p).map(i => i.id))].filter(Boolean).map(id => mk('invoice', id)) },
    { kind: 'file', items: [...FILE_LINKS.map(([k]) => k), ...(ctx.projects || []).flatMap(p => (p.deliverables || []).map(d => d.id))].filter(Boolean).map(id => mk('file', id)) },
  ];
  return groups.map(g => ({ ...g, label: REF_KIND_LABELS[g.kind], items: g.items.filter(i => !i.gone) })).filter(g => g.items.length);
}
