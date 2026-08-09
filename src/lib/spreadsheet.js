// Spreadsheet → lead mapping for the Call Console importer.
// Parsing (CSV + XLSX) is done with SheetJS in the component; this file holds the
// pure column-mapping / normalization logic so it can be unit-tested.
import { last10 } from './phone';

// The 16 canonical columns Rob's sheet uses, in display order.
export const LEAD_FIELDS = [
  { key: 'id',               label: 'ID (ClickUp task id)' },
  { key: 'business',         label: 'Business name', required: true },
  { key: 'owner',            label: 'Owner' },
  { key: 'phone',            label: 'Phone' },
  { key: 'email',            label: 'Email' },
  { key: 'instagram',        label: 'Instagram' },
  { key: 'facebook',         label: 'Facebook' },
  { key: 'website',          label: 'Website' },
  { key: 'google',           label: 'Google' },
  { key: 'area',             label: 'Area' },
  { key: 'industry',         label: 'Industry' },
  { key: 'priority',         label: 'Priority' },
  { key: 'status',           label: 'Status' },
  { key: 'service_interest', label: 'Service interest' },
  { key: 'angle',            label: 'Angle' },
  { key: 'notes',            label: 'Notes' },
];

// Header aliases → canonical key (all compared after stripping non-alphanumerics).
const ALIASES = {
  taskid: 'id', clickupid: 'id', leadid: 'id',
  company: 'business', businessname: 'business', name: 'business',
  ownername: 'owner', contact: 'owner', contactname: 'owner',
  phonenumber: 'phone', tel: 'phone', mobile: 'phone',
  emailaddress: 'email',
  ig: 'instagram', insta: 'instagram',
  fb: 'facebook',
  site: 'website', url: 'website', web: 'website',
  googlemaps: 'google', maps: 'google', gmb: 'google', googlebusiness: 'google',
  location: 'area', city: 'area', region: 'area',
  category: 'industry', trade: 'industry', niche: 'industry',
  serviceinterest: 'service_interest', service: 'service_interest', interest: 'service_interest',
  note: 'notes', comments: 'notes',
};

export const normHeader = (h) => String(h ?? '').replace(/^﻿/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

// Auto-map: returns { fieldKey: columnIndex } best guess from the header row.
export function autoMap(headers) {
  const norm = headers.map(normHeader);
  const canonical = new Map(LEAD_FIELDS.map(f => [normHeader(f.key), f.key]));
  const out = {};
  norm.forEach((h, i) => {
    const key = canonical.get(h) || ALIASES[h];
    if (key && !(key in out)) out[key] = i;
  });
  return out;
}

const PRIORITIES = ['hot', 'warm', 'cold'];
export function normPriority(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return PRIORITIES.includes(s) ? s : 'warm';
}

// Spreadsheet status text → internal callStatus id.
export function normStatus(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const M = {
    not_called: 'not-called', notcalled: 'not-called', new: 'not-called', '': 'not-called',
    callback: 'callback', call_back: 'callback',
    booked: 'booked', meeting: 'booked',
    no: 'no', denied: 'no', dead: 'no',
    no_answer: 'no-answer', noanswer: 'no-answer', voicemail: 'no-answer',
  };
  return M[s] || 'not-called';
}

// Turn parsed rows (array-of-arrays) + a mapping into clean {field: value} objects.
export function mapRows(rows, mapping) {
  return rows.map((row) => {
    const o = {};
    for (const f of LEAD_FIELDS) {
      const idx = mapping[f.key];
      o[f.key] = (idx != null && idx >= 0) ? String(row[idx] ?? '').trim() : '';
    }
    return o;
  }).filter(o => Object.values(o).some(v => v !== '')); // drop fully blank rows
}

// Client-side match for the preview counts. Mirrors the server logic:
// match by id first, then business + phone (case-insensitive, digits-only phone).
// Phone comparison goes through the shared normalizer (src/lib/phone.js) so
// import dedupe matches exactly like the reverse lookup does.
const digits = (v) => last10(v);
const lower = (v) => String(v ?? '').trim().toLowerCase();

export function matchExisting(row, existing) {
  if (row.id) {
    const byId = existing.find(l => l.sourceId && String(l.sourceId) === String(row.id).trim());
    if (byId) return byId;
  }
  const b = lower(row.business);
  const p = digits(row.phone);
  if (!b) return null;
  return existing.find(l => lower(l.business) === b && (!p || !digits(l.phone) || digits(l.phone) === p)) || null;
}

// Summarize a mapped batch against existing leads for the preview panel.
export function summarize(mapped, existing) {
  let create = 0, update = 0, deleted = 0, invalid = 0;
  for (const row of mapped) {
    if (!row.business) { invalid++; continue; }
    const m = matchExisting(row, existing);
    if (!m) create++;
    else if (m.deleted) deleted++;
    else update++;
  }
  return { total: mapped.length, create, update, deleted, invalid };
}
