import { useMemo, useState } from 'react';
import { COPY } from '../shared/copy';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import { Sheet, Stack, Row, Grid, Select, Button, Table, Pill, Textarea, EmptyState } from '../ui';
import { PRINT_ORDER_STATUSES, PRINT_ORDER_STATUS_IDS } from '../shared/semantics';
import { money } from '../shared/format';
import { fmtDate, dayKey } from '../shared/dates';
import { parseItemsString, importKey, dueDateFor, itemSummary, orderSubtotal, uid } from '../lib/orders';

/* Orders CSV import (Prompt 12): the same preview and dedupe pattern as the
 * device import. Paste or drop a CSV, map the columns, preview, create. */

/** Small RFC 4180 reader: quoted cells, doubled quotes, CRLF. */
export function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
const FIELDS = [['name', 'Customer name'], ['email', 'Email'], ['phone', 'Phone'], ['items', 'Items'], ['subtotal', 'Subtotal'], ['date', 'Date'], ['status', 'Status'], ['notes', 'Notes']];
const guess = (h) => { const k = String(h).toLowerCase(); if (/name|customer/.test(k)) return 'name'; if (/mail/.test(k)) return 'email'; if (/phone|tel/.test(k)) return 'phone'; if (/item|product|order/.test(k)) return 'items'; if (/total|amount|price/.test(k)) return 'subtotal'; if (/date|created|when/.test(k)) return 'date'; if (/status|stage/.test(k)) return 'status'; if (/note/.test(k)) return 'notes'; return ''; };

export default function OrdersImport({ existing = [], onClose, onCreate }) {
  const [text, setText] = useState('');
  const [map, setMap] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const rows = useMemo(() => parseCsv(text), [text]);
  const header = rows[0] || [];
  const mapping = map || Object.fromEntries(header.map((h, i) => [i, guess(h)]));
  const plan = useMemo(() => {
    if (rows.length < 2) return [];
    const col = (name) => Number(Object.entries(mapping).find(([, v]) => v === name)?.[0]);
    const get = (r, name) => { const i = col(name); return Number.isFinite(i) ? String(r[i] ?? '').trim() : ''; };
    const seen = new Set(); const have = new Set(existing.map(o => o.importKey || importKey(o)));
    return rows.slice(1).map(r => {
      const items = parseItemsString(get(r, 'items') || '');
      const explicit = Number(String(get(r, 'subtotal')).replace(/[^0-9.]/g, ''));
      const subtotal = Number.isFinite(explicit) && explicit > 0 ? explicit : orderSubtotal({ items, rush: false });
      const when = get(r, 'date'); const created = when && !Number.isNaN(new Date(when).getTime()) ? new Date(when).toISOString() : new Date().toISOString();
      const st = get(r, 'status').toLowerCase();
      const doc = { source: 'import', status: PRINT_ORDER_STATUS_IDS.includes(st) ? st : st === 'pending' ? 'new' : st === 'done' || st === 'completed' ? 'delivered' : 'new', customer: { name: get(r, 'name'), email: get(r, 'email').toLowerCase(), phone: get(r, 'phone') }, items: items.length ? items : [{ id: uid(), productId: '', name: 'Imported line', label: '', qty: 1, options: {}, artworkLink: '', priceTotal: subtotal || null, quote: !subtotal }], subtotal, rush: false, dueAt: dueDateFor(created, false), notes: get(r, 'notes') || 'Imported from CSV.', paid: null, createdAt: created };
      const key = importKey({ ...doc, createdAt: created }); doc.importKey = key;
      const dup = have.has(key) || seen.has(key); seen.add(key);
      return { doc, key, skip: dup || !doc.customer.name, reason: dup ? 'Already in Orders' : !doc.customer.name ? 'No customer name' : '' };
    });
  }, [rows, mapping, existing]);
  const run = async () => {
    setBusy(true); let created = 0; let failed = 0;
    for (const r of plan) { if (r.skip) continue; const item = await onCreate?.(r.doc); if (item) created++; else failed++; }
    setBusy(false); setResult({ created, skipped: plan.filter(r => r.skip).length, failed });
  };
  const readFile = (file) => { const fr = new FileReader(); fr.onload = () => { setText(String(fr.result || '')); setMap(null); }; fr.readAsText(file); };
  return (
    <Sheet open onClose={onClose} title="Import orders from CSV" description="Paste rows or drop a file, map the columns, and preview before anything is created." tall width={760}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button><Button loading={busy} disabled={!plan.some(r => !r.skip) || !!result} icon={Download01} onClick={run}>Create {plan.filter(r => !r.skip).length}</Button></>}>
      <Stack gap={3}>
        {result ? <p className="dt-muted">{result.created} imported, {result.skipped} skipped{result.failed ? `, ${result.failed} failed` : ''}.</p> : null}
        <Row gap={2} wrap align="end"><input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} aria-label="CSV file" className="oi-file" /></Row>
        <Textarea label="Or paste CSV" rows={4} value={text} onChange={(e) => { setText(e.target.value); setMap(null); }} placeholder="Name,Email,Phone,Items,Subtotal,Date,Status" />
        {header.length > 0 && (
          <Grid minColumnWidth={180} gap={2}>
            {header.map((h, i) => <Select key={i} label={h || `Column ${i + 1}`} value={mapping[i] || ''} onChange={(e) => setMap({ ...mapping, [i]: e.target.value })} options={[{ id: '', label: 'Skip' }, ...FIELDS.map(([id, label]) => ({ id, label }))]} />)}
          </Grid>
        )}
        {plan.length ? (
          <Table aria-label="Orders to import" density="sm" columnChooser={false} rows={plan} rowKey={(r) => r.key + r.doc.customer.email + r.doc.createdAt}
            columns={[
              { id: 'customer', label: 'Customer', always: true, render: (r) => r.doc.customer.name || r.doc.customer.email || 'Unknown' },
              { id: 'date', label: 'Date', render: (r) => fmtDate(r.doc.createdAt) },
              { id: 'items', label: 'Items', render: (r) => itemSummary(r.doc) },
              { id: 'subtotal', label: 'Subtotal', align: 'end', render: (r) => money(r.doc.subtotal) },
              { id: 'status', label: 'Status', render: (r) => <Pill id={r.doc.status} list={PRINT_ORDER_STATUSES} size="sm" /> },
              { id: 'result', label: 'Result', render: (r) => (r.skip ? <Pill tone="neutral" label={r.reason || 'Skip'} size="sm" icon={false} /> : <Pill tone="booked" label="Create" size="sm" icon={false} />) },
            ]} />
        ) : text.trim() ? <EmptyState size="sm" icon="Package" title={COPY.empty['orders.import.csv'].title} description={COPY.empty['orders.import.csv'].description} /> : null}
      </Stack>
    </Sheet>
  );
}
