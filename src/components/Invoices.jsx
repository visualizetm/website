import { useMemo, useState } from 'react';
import { Card, Stack, Row, Grid, Button, Menu, Pill, Table, ListRow, Modal, Input, Textarea, EmptyState, useMediaQuery, useToast, useConfirm } from '../ui';
import { INVOICE_STATUSES } from '../shared/semantics';
import { money } from '../shared/format';
import { COPY } from '../shared/copy';
import { invoiceStatus, newInvoice, markSent, markPaid, replaceInvoice, withoutInvoice, sanitizeInvoice, invDayKey, invoicesTotal, invoicesPaid } from '../lib/invoices';
import { localDate } from '../lib/projects';

/* The Invoices card (CRM revamp, step 5): the one card a deal and a client
 * project share. Rows with the status computed on read (Draft grey, Sent
 * blue, Due amber, Past due red, Paid green), Add invoice, and per row
 * Mark sent, Mark paid (a day and a note in a small Modal), Edit, Delete.
 * Every write goes out as the whole list through onChange; the owner
 * decides where it lands (deal.invoices on the lead, invoices on the
 * project). onMarkPaid, when given, takes over the paid write (a deal's
 * first payment runs the conversion; a project writes the ledger). */
const fmtDay = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };
const blank = (defaults) => ({ label: defaults.label || '', amount: defaults.amount != null ? String(defaults.amount) : '', dueAt: invDayKey(new Date(Date.now() + 7 * 864e5)), note: '' });

export default function InvoicesCard({ invoices = [], onChange, onMarkPaid, onSendEmail = null, emailConnected = false, defaults = {}, readOnly = false, title = 'Invoices', description, className = '', pulseId = null, emptyKey = 'deals.invoices', level = 1 }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const wide = useMediaQuery('(min-width: 1440px)'); // the detail column is narrow below this; the rows stack
  const [form, setForm] = useState(null); // { mode: 'add' | 'edit', id, values }
  const [pay, setPay] = useState(null); // { inv, paidAt, note }
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => [...(invoices || [])].sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt))), [invoices]);
  const E = COPY.empty[emptyKey] || COPY.empty['deals.invoices'];
  const write = async (next, done) => {
    setBusy(true);
    const ok = await onChange(next);
    setBusy(false);
    if (!ok) { toast.error(COPY.error.save); return false; }
    done?.(); return true;
  };
  const saveForm = async () => {
    const v = form.values; const amount = Number(v.amount);
    if (!v.label.trim() || !(amount >= 0) || !v.dueAt) return;
    if (form.mode === 'add') await write([...(invoices || []), newInvoice({ label: v.label.trim(), amount, dueAt: v.dueAt, note: v.note.trim() })], () => { setForm(null); toast.success('Invoice added.'); });
    else { const cur = (invoices || []).find(i => i.id === form.id); if (!cur) return; await write(replaceInvoice(invoices, sanitizeInvoice({ ...cur, label: v.label.trim(), amount, dueAt: v.dueAt, note: v.note.trim() })), () => { setForm(null); toast.success('Invoice updated.'); }); }
  };
  const sent = (inv) => write(replaceInvoice(invoices, markSent(inv)), () => toast.success(`${inv.label || 'Invoice'} marked sent.`));
  const savePay = async () => {
    const { inv, paidAt, note } = pay;
    setBusy(true);
    const ok = onMarkPaid ? await onMarkPaid(inv, { paidAt, note: note.trim() }) : await onChange(replaceInvoice(invoices, markPaid(inv, { paidAt: paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : '', note: note.trim() })));
    setBusy(false);
    if (!ok) { toast.error(COPY.error.save); return; }
    setPay(null);
    if (!onMarkPaid) toast.success(`${money(inv.amount)} marked paid.`);
  };
  const remove = async (inv) => { if (!(await confirm({ title: `Delete ${inv.label || 'this invoice'}?`, body: 'The line goes. A paid line keeps its ledger entry on the client.', danger: true, confirmLabel: 'Delete' }))) return; await write(withoutInvoice(invoices, inv.id), () => toast.success('Invoice deleted.')); };
  const menuFor = (inv) => { const st = invoiceStatus(inv); return [
    ...(st === 'draft' ? [{ id: 'sent', label: 'Mark sent', icon: 'Check', onSelect: () => sent(inv) }] : []),
    ...(st !== 'paid' && onSendEmail ? [{ id: 'email', label: st === 'draft' ? 'Send the invoice email' : 'Send the invoice email again', icon: 'Send01', onSelect: () => onSendEmail(inv) }] : []),
    ...(st !== 'paid' ? [{ id: 'paid', label: 'Mark paid', icon: 'Check', onSelect: () => setPay({ inv, paidAt: invDayKey(), note: '' }) }] : []),
    { id: 'edit', label: 'Edit', icon: 'Edit02', onSelect: () => setForm({ mode: 'edit', id: inv.id, values: { label: inv.label || '', amount: String(inv.amount ?? ''), dueAt: inv.dueAt || '', note: inv.note || '' } }) },
    'divider',
    { id: 'del', label: 'Delete', icon: 'Trash01', danger: true, onSelect: () => remove(inv) },
  ]; };
  const pill = (inv) => <Pill id={invoiceStatus(inv)} list={INVOICE_STATUSES} size="sm" />;
  const primary = (inv) => { const st = invoiceStatus(inv); if (readOnly || st === 'paid') return null; return st === 'draft'
    ? (onSendEmail && emailConnected
      ? <Button variant="secondary" size="md" icon="Send01" onClick={() => onSendEmail(inv)} className="iv-email">Send</Button>
      : <Button variant="secondary" size="md" icon="Check" onClick={() => sent(inv)} className="iv-sent">Mark sent</Button>)
    : <Button variant="secondary" size="md" icon="Check" onClick={() => setPay({ inv, paidAt: invDayKey(), note: '' })} className="iv-paid">Mark paid</Button>; };
  const addBtn = !readOnly && <Button variant="secondary" size="md" icon="Plus" onClick={() => setForm({ mode: 'add', values: blank(defaults) })} className="iv-add">Add invoice</Button>;
  return (
    <Card className={`iv-card ${className}`.trim()} level={level}>
      <Row gap={2} justify="between" align="center" wrap>
        <Stack gap={0}><p className="pb-card-h" style={{ margin: 0 }}>{title}</p>{description !== undefined ? <span className="dt-muted">{description}</span> : rows.length > 0 && <span className="dt-muted">{money(invoicesPaid(rows))} paid of {money(invoicesTotal(rows))}</span>}</Stack>
        {addBtn}
      </Row>
      {!rows.length ? <EmptyState size="sm" icon="CurrencyDollar" title={E.title} description={E.description} action={!readOnly && E.action ? { label: E.action, icon: 'Plus', onClick: () => setForm({ mode: 'add', values: blank(defaults) }) } : undefined} />
        : wide ? (
          <Table aria-label={title} density="sm" columnChooser={false} rows={rows} rowKey={(r) => r.id} rowClassName={(r) => (r.id === pulseId ? 'cw-row-paid' : '')}
            columns={[
              { id: 'label', label: 'Item', always: true, render: (r) => <span title={r.note || undefined}>{r.label || 'Invoice'}</span> },
              { id: 'amount', label: 'Amount', align: 'end', render: (r) => money(r.amount) },
              { id: 'due', label: 'Due', render: (r) => fmtDay(r.dueAt) },
              { id: 'status', label: 'Status', render: pill },
            ]} rowActions={(r) => <Row gap={1} justify="end">{primary(r)}{!readOnly && <Menu label={`${r.label || 'Invoice'} actions`} items={menuFor(r)} />}</Row>} />
        ) : (
          <Stack gap={2}>{rows.map(r => <ListRow key={r.id} title={r.label || 'Invoice'} subtitle={`${money(r.amount)}, due ${fmtDay(r.dueAt)}${r.note ? `, ${r.note}` : ''}`} trailing={<Row gap={1} align="center" wrap justify="end">{pill(r)}{primary(r)}{!readOnly && <Menu label={`${r.label || 'Invoice'} actions`} items={menuFor(r)} />}</Row>} chevron={false} className={`cw-sched-row${r.id === pulseId ? ' v-pulse-won' : ''}`} />)}</Stack>
        )}
      {confirmDialog}
      {form && (
        <Modal open onClose={() => setForm(null)} title={form.mode === 'add' ? 'Add invoice' : 'Edit invoice'} label={form.mode === 'add' ? 'Add invoice' : 'Edit invoice'}
          footer={<><Button variant="ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</Button><Button loading={busy} icon="Check" onClick={saveForm} disabled={!form.values.label.trim() || !form.values.dueAt}>{form.mode === 'add' ? 'Add' : 'Save'}</Button></>}>
          <Stack gap={3}>
            <Input label="What for" value={form.values.label} onChange={(e) => setForm(f => ({ ...f, values: { ...f.values, label: e.target.value.slice(0, 120) } }))} placeholder="Month 1 of 6" data-autofocus />
            <Grid minColumnWidth={140} gap={2}>
              <Input label="Amount" type="number" inputMode="decimal" min={0} value={form.values.amount} onChange={(e) => setForm(f => ({ ...f, values: { ...f.values, amount: e.target.value } }))} />
              <Input label="Due" type="date" value={form.values.dueAt} onChange={(e) => setForm(f => ({ ...f, values: { ...f.values, dueAt: e.target.value } }))} />
            </Grid>
            <Textarea label="Note (optional)" rows={2} value={form.values.note} onChange={(e) => setForm(f => ({ ...f, values: { ...f.values, note: e.target.value.slice(0, 300) } }))} placeholder="Deposit, the rest on delivery." />
          </Stack>
        </Modal>
      )}
      {pay && (
        <Modal open onClose={() => setPay(null)} title="Mark paid" label="Mark paid" description={`${pay.inv.label || 'Invoice'}, ${money(pay.inv.amount)}`}
          footer={<><Button variant="ghost" onClick={() => setPay(null)} disabled={busy}>Cancel</Button><Button loading={busy} icon="Check" onClick={savePay} className="iv-pay-confirm">Mark paid</Button></>}>
          <Stack gap={3}>
            <Input label="Paid on" type="date" value={pay.paidAt} onChange={(e) => setPay(p => ({ ...p, paidAt: e.target.value }))} data-autofocus />
            <Input label="Note (optional)" value={pay.note} onChange={(e) => setPay(p => ({ ...p, note: e.target.value.slice(0, 300) }))} placeholder="Zelle, reference 4471" />
          </Stack>
        </Modal>
      )}
    </Card>
  );
}
export const invoicesStyles = `
  .iv-card { gap: var(--v-space-3); }
`;
