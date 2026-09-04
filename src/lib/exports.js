/* Client side CSV exports (Prompt 12), generated from the data the shell has
 * already loaded. Every file is RFC 4180: cells quoted when needed, quotes
 * doubled, UTF-8 with a BOM so Excel reads accents. */
import { normalizeStage, displayIndustry } from '../shared/semantics';
import { formatPhone } from '../shared/phone';
import { fmtDate, fmtDateTime, dayKey } from '../shared/dates';
import { lastCall } from './leads';
import { scheduleTotal, paidTotal, projectsOf, lifetimeValue } from './projects';
import { orderSubtotal, itemSummary, customerName } from './orders';

const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (columns, rows) => [columns.map(c => cell(c.label)).join(','), ...rows.map(r => columns.map(c => cell(c.get(r))).join(','))].join('\r\n');

export function downloadText(name, text, type = 'text/csv') {
  const blob = new Blob([type === 'text/csv' ? `﻿${text}` : text], { type: `${type};charset=utf-8` });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const stamp = () => dayKey(new Date());

export const LEAD_COLUMNS = [
  { id: 'business', label: 'Business', get: (l) => l.business },
  { id: 'stage', label: 'Stage', get: (l) => normalizeStage(l) },
  { id: 'industry', label: 'Industry', get: (l) => (l.industry ? displayIndustry(l.industry) : '') },
  { id: 'priority', label: 'Priority', get: (l) => l.priority || 'warm' },
  { id: 'callStatus', label: 'Call status', get: (l) => l.callStatus || 'not-called' },
  { id: 'phone', label: 'Phone', get: (l) => formatPhone(l.phone) || '' },
  { id: 'askFor', label: 'Contact', get: (l) => l.askFor || '' },
  { id: 'email', label: 'Email', get: (l) => l.email || '' },
  { id: 'area', label: 'Area', get: (l) => l.area || '' },
  { id: 'website', label: 'Website', get: (l) => l.socials?.website || '' },
  { id: 'instagram', label: 'Instagram', get: (l) => l.socials?.instagram || '' },
  { id: 'lastCall', label: 'Last call', get: (l) => (lastCall(l) ? `${fmtDateTime(lastCall(l).at)} ${lastCall(l).outcome}` : '') },
  { id: 'calls', label: 'Calls', get: (l) => (l.callLog || []).length },
  { id: 'callbackAt', label: 'Callback due', get: (l) => (l.callbackAt ? fmtDateTime(l.callbackAt) : '') },
  { id: 'meeting', label: 'Meeting', get: (l) => (l.meeting?.date ? `${l.meeting.date} ${l.meeting.time || ''}`.trim() : '') },
  { id: 'source', label: 'Source', get: (l) => (l.sourceId ? 'scraper' : 'manual') },
  { id: 'createdAt', label: 'Added', get: (l) => fmtDate(l.createdAt) },
];
export const CLIENT_COLUMNS = (projects) => [
  { id: 'business', label: 'Business', get: (l) => l.business },
  { id: 'contact', label: 'Contact', get: (l) => l.askFor || '' },
  { id: 'phone', label: 'Phone', get: (l) => formatPhone(l.phone) || '' },
  { id: 'email', label: 'Email', get: (l) => l.email || '' },
  { id: 'since', label: 'Since', get: (l) => fmtDate(l.clientSince) },
  { id: 'status', label: 'Client status', get: (l) => l.clientStatus || 'active' },
  { id: 'lifetime', label: 'Lifetime value', get: (l) => lifetimeValue(l) },
  { id: 'projects', label: 'Projects', get: (l) => projectsOf(projects, l._id).length },
  { id: 'retainer', label: 'Retainer', get: (l) => (l.retainer ? `${l.retainer.planId} ${l.retainer.status} ${l.retainer.amount}` : '') },
  { id: 'nextBill', label: 'Next bill', get: (l) => l.retainer?.nextBillAt || '' },
  { id: 'drive', label: 'Drive', get: (l) => l.links?.drive || '' },
  { id: 'website', label: 'Website', get: (l) => l.links?.website || l.socials?.website || '' },
];
export const PROJECT_COLUMNS = (leads) => [
  { id: 'client', label: 'Client', get: (p) => leads.find(l => String(l._id) === String(p.leadId))?.business || p.leadId },
  { id: 'name', label: 'Project', get: (p) => p.name },
  { id: 'kind', label: 'Kind', get: (p) => p.kind },
  { id: 'stage', label: 'Stage', get: (p) => p.stage },
  { id: 'total', label: 'Total', get: (p) => scheduleTotal(p) },
  { id: 'paid', label: 'Paid', get: (p) => paidTotal(p) },
  { id: 'plan', label: 'Plan', get: (p) => (p.plan ? `${p.plan.monthly} x ${p.plan.months}` : '') },
  { id: 'rounds', label: 'Revision rounds', get: (p) => (p.revisions?.log || []).length },
  { id: 'released', label: 'Released', get: (p) => fmtDate(p.releasedAt) },
  { id: 'created', label: 'Started', get: (p) => fmtDate(p.createdAt) },
  { id: 'archived', label: 'Archived', get: (p) => (p.archived ? 'yes' : '') },
];
export const ORDER_COLUMNS = (leads) => [
  { id: 'customer', label: 'Customer', get: (o) => customerName(o, leads) },
  { id: 'email', label: 'Email', get: (o) => o.customer?.email || '' },
  { id: 'phone', label: 'Phone', get: (o) => formatPhone(o.customer?.phone) || '' },
  { id: 'source', label: 'Source', get: (o) => o.source },
  { id: 'status', label: 'Status', get: (o) => o.status },
  { id: 'items', label: 'Items', get: (o) => itemSummary(o) },
  { id: 'subtotal', label: 'Subtotal', get: (o) => orderSubtotal(o) },
  { id: 'rush', label: 'Rush', get: (o) => (o.rush ? 'yes' : '') },
  { id: 'due', label: 'Due', get: (o) => o.dueAt || '' },
  { id: 'paid', label: 'Paid', get: (o) => (o.paid ? `${o.paid.amount} on ${o.paid.at}` : '') },
  { id: 'created', label: 'Created', get: (o) => fmtDate(o.createdAt) },
];
/** Every purchases[] entry across every lead, with the client name. */
export function ledgerRows(leads, projects) {
  const out = [];
  for (const l of leads) for (const p of (l.purchases || [])) out.push({ ...p, business: l.business, project: p.projectId ? projects.find(x => String(x._id) === String(p.projectId))?.name || '' : '' });
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
export const LEDGER_COLUMNS = [
  { id: 'at', label: 'Date', get: (r) => r.at || '' },
  { id: 'business', label: 'Client', get: (r) => r.business },
  { id: 'label', label: 'Label', get: (r) => r.label || '' },
  { id: 'amount', label: 'Amount', get: (r) => r.amount },
  { id: 'project', label: 'Project', get: (r) => r.project },
  { id: 'source', label: 'Source', get: (r) => r.source || 'manual' },
  { id: 'stripe', label: 'Stripe event', get: (r) => r.stripeEventId || '' },
  { id: 'notes', label: 'Notes', get: (r) => r.notes || '' },
];

export const EXPORTS = [
  { id: 'leads', label: 'Leads', description: 'Every live lead with its stage, status, contact, and last call.', file: () => `visualize-leads-${stamp()}.csv`, build: ({ leads }) => toCsv(LEAD_COLUMNS, leads) },
  { id: 'clients', label: 'Clients', description: 'Clients with lifetime value, retainer, and links.', file: () => `visualize-clients-${stamp()}.csv`, build: ({ leads, projects }) => toCsv(CLIENT_COLUMNS(projects), leads.filter(l => normalizeStage(l) === 'client')) },
  { id: 'projects', label: 'Projects', description: 'Every project with totals, paid, plan, and stage.', file: () => `visualize-projects-${stamp()}.csv`, build: ({ leads, projects }) => toCsv(PROJECT_COLUMNS(leads), projects) },
  { id: 'orders', label: 'Print orders', description: 'Every order with items, subtotal, due date, and payment.', file: () => `visualize-orders-${stamp()}.csv`, build: ({ leads, orders }) => toCsv(ORDER_COLUMNS(leads), orders) },
  { id: 'ledger', label: 'Purchases ledger', description: 'Every payment on every client, with the source and Stripe event.', file: () => `visualize-ledger-${stamp()}.csv`, build: ({ leads, projects }) => toCsv(LEDGER_COLUMNS, ledgerRows(leads, projects)) },
];
