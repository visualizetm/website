import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';

// RFC 4180 escaping: always quote, double internal quotes. Handles commas,
// quotes, and line breaks inside answers.
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { type = 'submissions', format = 'csv', status, q, days } = req.query || {};
  const db = await getDb();
  const col = db.collection('submissions');

  // Same filter semantics as the list views, so "export respects the filter".
  const filter = { deleted: { $ne: true } };
  filter.type = type === 'orders' ? 'shop-order' : { $ne: 'shop-order' };
  if (status && status !== 'all') filter.status = String(status);
  if (days && Number(days) > 0) filter.createdAt = { $gte: new Date(Date.now() - Number(days) * 86400000) };
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { business: rx }, { email: rx }];
  }

  const items = await col.find(filter).sort({ createdAt: -1 }).limit(5000).toArray();
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `visualize-${type === 'orders' ? 'orders' : 'submissions'}-${stamp}`;

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.json"`);
    return res.status(200).send(JSON.stringify(items, null, 2));
  }

  // CSV: fixed columns first, then the union of every form-field key so each
  // answer gets its own column even when submissions asked different questions.
  const fieldKeys = [];
  for (const it of items) {
    for (const k of Object.keys(it.fields || {})) {
      if (!fieldKeys.includes(k)) fieldKeys.push(k);
    }
  }
  const fixed = ['Date', 'Type', 'Project Type', 'Name', 'Business', 'Email', 'Phone', 'Status', 'Read', 'Notes'];
  const header = [...fixed, ...fieldKeys].map(csvCell).join(',');

  const rows = items.map(it => {
    const fixedVals = [
      it.createdAt ? new Date(it.createdAt).toISOString() : '',
      it.type || '',
      it.projectType || '',
      it.name || '',
      it.business || '',
      it.email || '',
      it.phone || '',
      it.status || '',
      it.read ? 'read' : 'unread',
      it.notes || '',
    ];
    const fieldVals = fieldKeys.map(k => {
      const v = (it.fields || {})[k];
      // Flatten anything non-scalar sensibly rather than dumping [object Object].
      if (v == null) return '';
      if (Array.isArray(v)) return v.join('; ');
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });
    return [...fixedVals, ...fieldVals].map(csvCell).join(',');
  });

  // BOM so Excel opens UTF-8 answers (accents, dashes) correctly.
  const csv = '﻿' + [header, ...rows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
  return res.status(200).send(csv);
}
