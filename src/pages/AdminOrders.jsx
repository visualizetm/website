import { useEffect, useMemo, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import {
  PageShell, ScrollArea, Section, Stack, Row, Grid, Card, Chip, Pill, Avatar, Input, Textarea, Select, Button, IconButton, Menu, InlineEdit, Toggle, Checkbox, ListRow, Sheet, Modal, Table, EmptyState, ErrorState, Stagger, IconTile, SkeletonBlock, RecordSkeleton, useDelayedLoading, useMediaQuery, useToast, useConfirm, useRetry, durationMs,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar } from '../shell/ShellContext';
import LeadPicker from '../components/LeadPicker';
import LeadCard from '../components/LeadCard';
import { PRINT_ORDER_STATUSES, ORDER_SOURCES, printOrderStatusOf } from '../shared/semantics';
import { money } from '../shared/format';
import { fmtDate, fmtDateTime, countdownLabel } from '../shared/dates';
import { formatPhone, telHref } from '../shared/phone';
import { buildProject, localDate, today, uid } from '../lib/projects';
import {
  STEPPER, nextOrderStatus, isOpenOrder, lineTotal, orderSubtotal, hasQuoteItems, itemSummary, hasStickerItems, PACKAGING_STEPS, dueDateFor, customerName, customerOf, lineFromProduct, PRINT_PRODUCTS, RUSH_FEE, ORDER_FILTERS, orderPasses, matchesOrder,
} from '../lib/orders';

/* Print Orders (Prompt 11): the orders collection on the kit. List with chips
 * and a Table on desktop; detail in a right panel on desktop and a Sheet on
 * mobile. Rules live in src/lib/orders.js. */

const fmtDay = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };
const dueTone = (o, now = Date.now()) => { const t = localDate(o.dueAt)?.getTime(); if (!t || !isOpenOrder(o)) return 'neutral'; return t < now - 864e5 ? 'danger' : t <= now + 2 * 864e5 ? 'new' : 'neutral'; };

function Stepper({ status }) {
  const cur = STEPPER.indexOf(status);
  return (
    <ol className="cw-stepper" aria-label="Order stages">
      {STEPPER.map((s, i) => <li key={s} className={`cw-step${i < cur ? ' is-done' : ''}${i === cur ? ' is-current' : ''}`}><span className="cw-step-dot" aria-hidden="true">{i < cur ? <Check width={10} height={10} /> : i + 1}</span><span className="cw-step-label">{printOrderStatusOf(s).label}</span></li>)}
    </ol>
  );
}

export function OrderCard({ order: o, leads, onOpen, selected, compact = false }) {
  const c = customerOf(o, leads);
  return (
    <Card padding={3} interactive onClick={onOpen} selected={selected} className={`po-card${compact ? ' po-card--compact' : ''}`} aria-label={`Open order for ${c.name}`}>
      <Row gap={2} align="center"><Avatar name={c.name} size="sm" /><span className="po-card-name lay-truncate">{c.name}</span><Pill id={o.source} list={ORDER_SOURCES} size="sm" variant="outline" /><Pill id={o.status} list={PRINT_ORDER_STATUSES} size="sm" /></Row>
      {!compact && <>
        <span className="po-card-items lay-truncate">{itemSummary(o)}</span>
        <Row gap={2} wrap align="center">
          <span className="po-card-sub">{money(orderSubtotal(o))}{hasQuoteItems(o) ? ' plus quote' : ''}</span>
          {o.rush && <Pill tone="danger" label="Rush" size="sm" icon="Zap" />}
          {o.dueAt && <Pill tone={dueTone(o)} label={`Due ${fmtDay(o.dueAt)}, ${countdownLabel(localDate(o.dueAt))}`} size="sm" icon={false} variant="outline" />}
          {o.paid ? <Pill tone="booked" label="Paid" size="sm" icon="Check" /> : <Pill tone="neutral" label="Unpaid" size="sm" icon={false} variant="outline" />}
        </Row>
      </>}
    </Card>
  );
}
OrderCard.Skeleton = function OrderCardSkeleton() {
  return <Card padding={3} aria-busy="true"><Row gap={2}><SkeletonBlock width={32} height={32} radius="50%" /><SkeletonBlock width="50%" height={14} /><SkeletonBlock width={60} height={22} radius="var(--v-radius-pill)" /></Row><SkeletonBlock width="70%" height={12} /><Row gap={2}><SkeletonBlock width={60} height={14} /><SkeletonBlock width={110} height={22} radius="var(--v-radius-pill)" /></Row></Card>;
};

/* ── Product picker (new order and add item) ───────────────────── */
function ItemPicker({ onAdd }) {
  const [productId, setProductId] = useState(PRINT_PRODUCTS[1].id);
  const [sizeId, setSizeId] = useState('small');
  const [qty, setQty] = useState('1');
  const [custom, setCustom] = useState({ name: '', price: '' });
  const p = PRINT_PRODUCTS.find(x => x.id === productId);
  return (
    <Card level={2} padding={3} className="po-picker">
      <p className="pb-card-h">Add an item</p>
      <Grid minColumnWidth={150} gap={2}>
        <Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)} options={[...PRINT_PRODUCTS.map(x => ({ id: x.id, label: `${x.label} (${x.sizes ? `from ${money(x.sizes[0].price)}` : money(x.price)})` })), { id: 'custom', label: 'Custom line' }]} />
        {p?.sizes && <Select label="Size" value={sizeId} onChange={(e) => setSizeId(e.target.value)} options={p.sizes.map(s => ({ id: s.id, label: `${s.label} (${money(s.price)})` }))} />}
        {productId === 'custom' ? <><Input label="Name" value={custom.name} onChange={(e) => setCustom(c => ({ ...c, name: e.target.value }))} placeholder="Window decal" /><Input label="Price (blank for quote)" type="number" inputMode="decimal" value={custom.price} onChange={(e) => setCustom(c => ({ ...c, price: e.target.value }))} /></> : <Input label="Qty" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />}
      </Grid>
      <Row gap={2} justify="end"><Button variant="secondary" size="md" icon={Plus} onClick={() => { const n = Math.max(1, Number(qty) || 1); const line = productId === 'custom' ? lineFromProduct('', { custom: { name: custom.name.trim() || 'Custom line', priceTotal: custom.price === '' ? null : Number(custom.price) }, qty: 1 }) : lineFromProduct(productId, { sizeId, qty: n }); if (line) onAdd(line); setCustom({ name: '', price: '' }); }} className="po-add-item">Add item</Button></Row>
    </Card>
  );
}

/* ── New order sheet ───────────────────────────────────────────── */
function NewOrderSheet({ leads, onClose, onCreate, preset }) {
  const [lead, setLead] = useState(preset?.lead || null);
  const [pick, setPick] = useState(false);
  const [cust, setCust] = useState({ name: '', email: '', phone: '' });
  const [items, setItems] = useState([]);
  const [rush, setRush] = useState(false);
  const [dueAt, setDueAt] = useState(dueDateFor(today(), false));
  const [dueTouched, setDueTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dueTouched) setDueAt(dueDateFor(today(), rush)); }, [rush, dueTouched]);
  const draft = { items, rush };
  const valid = (lead || cust.name.trim()) && items.length > 0;
  return (
    <>
      <Sheet open onClose={onClose} title="New order" description={lead ? lead.business : 'Pick a client or type a customer'} tall width={600} className="po-sheet"
        footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!valid} icon={Check} onClick={async () => { setBusy(true); try { await onCreate({ source: lead ? 'client' : 'walk-in', leadId: lead ? String(lead._id) : '', customer: lead ? { name: lead.business, email: lead.email || '', phone: lead.phone || '' } : cust, items, subtotal: orderSubtotal(draft), rush, dueAt, notes: notes.trim(), paid: null }); } finally { setBusy(false); } }}>Create order</Button></>}>
        <Stack gap={4}>
          <Card level={2} padding={3}>
            <Row gap={2} justify="between" align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>Customer</p><Row gap={1}>{lead && <Button variant="ghost" size="md" onClick={() => setLead(null)}>Clear</Button>}<Button variant="secondary" size="md" icon="Briefcase01" onClick={() => setPick(true)} className="po-pick-client">{lead ? 'Change client' : 'Pick a client'}</Button></Row></Row>
            {lead ? <LeadCard lead={lead} compact /> : <Grid minColumnWidth={160} gap={2}><Input label="Name" value={cust.name} onChange={(e) => setCust(c => ({ ...c, name: e.target.value }))} data-autofocus /><Input label="Email" type="email" inputMode="email" value={cust.email} onChange={(e) => setCust(c => ({ ...c, email: e.target.value }))} /><Input label="Phone" inputMode="tel" value={cust.phone} onChange={(e) => setCust(c => ({ ...c, phone: e.target.value }))} /></Grid>}
          </Card>
          <ItemPicker onAdd={(line) => setItems(l => [...l, line])} />
          {items.length > 0 && <Stack gap={1}>{items.map(i => <ListRow key={i.id} title={`${i.qty} x ${i.name}`} subtitle={i.label || (i.quote ? 'By quote' : '')} meta={i.quote ? 'Quote' : money(lineTotal(i))} trailing={<IconButton icon={XClose} label="Remove item" variant="ghost" onClick={() => setItems(l => l.filter(x => x.id !== i.id))} />} chevron={false} />)}</Stack>}
          <Card level={2} padding={3}>
            <Toggle label="Rush" description={`Adds the ${money(RUSH_FEE)} rush line and moves the due date to 3 days.`} checked={rush} onChange={setRush} />
            <Grid minColumnWidth={160} gap={2}><Input label="Due" type="date" value={dueAt} onChange={(e) => { setDueAt(e.target.value); setDueTouched(true); }} hint={rush ? '3 day turnaround' : '7 day turnaround'} /></Grid>
            <div className="po-total"><span className="dt-fact-label">Subtotal</span><span className="dt-opt-n">{money(orderSubtotal(draft))}</span>{hasQuoteItems(draft) && <span className="dt-muted">Plus quote items</span>}</div>
          </Card>
          <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Artwork on the way, wants matte." />
        </Stack>
      </Sheet>
      {pick && <LeadPicker leads={leads} title="Pick a client" onClose={() => setPick(false)} onPick={(l) => { setLead(l); setPick(false); }} />}
    </>
  );
}

/* ── Order detail ──────────────────────────────────────────────── */
function OrderDetail({ order: o, leads, projects, onPatch, onPatchRaw, onPatchLead, onCreateProject, onClose }) {
  const toast = useToast();
  const [paidPulse, setPaidPulse] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const [pick, setPick] = useState(false);
  const [pay, setPay] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', at: today() });
  const [addItem, setAddItem] = useState(false);
  const c = customerOf(o, leads);
  const project = o.projectId ? projects?.find(p => String(p._id) === String(o.projectId)) : null;
  const pp = (set) => onPatch(o._id, set); // toasts on failure
  const ppRaw = (set) => (onPatchRaw || onPatch)(o._id, set); // for InlineEdit, which toasts itself
  const writeItems = (items) => pp({ items, subtotal: orderSubtotal({ ...o, items }) });
  const writeItemsRaw = (items) => ppRaw({ items, subtotal: orderSubtotal({ ...o, items }) });
  const setStatus = async (status) => {
    if (status === 'cancelled' && !(await confirm({ title: 'Cancel this order?', body: 'It stays in the list under Cancelled.', danger: true, confirmLabel: 'Cancel order' }))) return;
    const ok = await pp({ status });
    if (ok && status === 'delivered') toast.success('Delivered. Run the packaging checklist before it goes out.');
  };
  const linkClient = async (lead) => {
    setPick(false);
    const ok = await pp({ leadId: String(lead._id), source: o.source === 'walk-in' ? 'client' : o.source, customer: { name: lead.business, email: o.customer?.email || lead.email || '', phone: o.customer?.phone || lead.phone || '' } });
    if (!ok) return;
    if (onCreateProject && await confirm({ title: `Create a print project for ${lead.business}?`, body: 'A project of kind print keeps this order on their Clients record with its own schedule and deliverables.', confirmLabel: 'Create project', icon: 'Briefcase01' })) {
      const item = await onCreateProject(buildProject(String(lead._id), { custom: { name: `Print: ${itemSummary(o)}`, total: orderSubtotal(o), kind: 'print' } }));
      if (item) { await pp({ projectId: String(item._id) }); toast.success('Print project created.'); }
    }
  };
  const toggleRush = (v) => { const ruleDue = dueDateFor(o.createdAt, !!o.rush); pp({ rush: v, subtotal: orderSubtotal({ ...o, rush: v }), ...(o.dueAt === ruleDue ? { dueAt: dueDateFor(o.createdAt, v) } : {}) }); };
  const savePay = async () => {
    const amount = Number(payForm.amount) || 0; const at = payForm.at || today();
    const lead = c.lead;
    let ledgerId = '';
    if (lead && onPatchLead) {
      ledgerId = uid();
      const ok = await onPatchLead(lead._id, { purchases: [...(lead.purchases || []), { id: ledgerId, label: `Print order: ${itemSummary(o)}`, amount, at, notes: '', ...(o.projectId ? { projectId: o.projectId } : {}) }] });
      if (!ok) { toast.error(COPY.error.save); return; }
    }
    const ok = await pp({ paid: { at, ledgerId, amount } });
    if (ok) { toast.success(lead ? `${money(amount)} recorded on ${lead.business}.` : `${money(amount)} recorded on the order.`); setPay(false); setPaidPulse(true); setTimeout(() => setPaidPulse(false), durationMs('--v-dur-slow') * 2 + 50); }
  };
  return (
    <div className="po-detail">
    <Stagger className="v-stack" style={{ gap: 'var(--v-space-4)' }}>
      <Card className={`po-cust${paidPulse ? ' v-pulse-won' : ''}`}>
        <Row gap={3} align="start">
          <Avatar name={c.name} size="lg" />
          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
            <h2 className="po-cust-name">{c.name}</h2>
            <Row gap={1} wrap><Pill id={o.source} list={ORDER_SOURCES} size="sm" variant="outline" /><Pill id={o.status} list={PRINT_ORDER_STATUSES} size="sm" />{o.rush && <Pill tone="danger" label="Rush" size="sm" icon="Zap" />}{o.paid ? <Pill tone="booked" label={`Paid ${fmtDay(o.paid.at)}`} size="sm" icon="Check" /> : <Pill tone="neutral" label="Unpaid" size="sm" icon={false} variant="outline" />}</Row>
            <span className="dt-muted">Created {fmtDateTime(o.createdAt)}{o.submissionId ? ', from the shop' : ''}</span>
          </Stack>
          {onClose && <IconButton icon={XClose} label="Close" variant="ghost" onClick={onClose} />}
        </Row>
        <Row gap={1} wrap>
          <Button variant="secondary" size="md" icon="Phone" href={c.phone ? telHref(c.phone) : undefined} disabled={!c.phone}>{c.phone ? formatPhone(c.phone) : 'No phone'}</Button>
          <Button variant="secondary" size="md" icon="Mail01" href={c.email ? `mailto:${c.email}` : undefined} disabled={!c.email} className="po-email">{c.email || 'No email'}</Button>
          <Button variant={c.lead ? 'ghost' : 'secondary'} size="md" icon="Briefcase01" onClick={() => setPick(true)} className="po-link-client">{c.lead ? 'Change client' : 'Link to client'}</Button>
        </Row>
        {project && <p className="dt-muted">Project: {project.name}</p>}
      </Card>
      <Card>
        <Row gap={2} justify="between" align="center" wrap>
          <p className="pb-card-h" style={{ margin: 0 }}>Stage</p>
          <Row gap={1}>
            {nextOrderStatus(o) && o.status !== 'cancelled' && <Button size="md" iconEnd="ArrowRight" onClick={() => setStatus(nextOrderStatus(o))} className="po-advance">{printOrderStatusOf(nextOrderStatus(o)).label}</Button>}
            <Menu label="Set stage" items={PRINT_ORDER_STATUSES.map(s => ({ id: s.id, label: `Set stage: ${s.label}`, icon: s.icon, disabled: s.id === o.status, danger: s.id === 'cancelled', onSelect: () => setStatus(s.id) }))} />
          </Row>
        </Row>
        <Stepper status={o.status} />
        {o.status === 'delivered' && hasStickerItems(o) && (
          <Card level={2} padding={3} className="po-pack">
            <p className="pb-card-h">Packaging</p>
            <Stack gap={0}>{PACKAGING_STEPS.map(([id, label]) => <Checkbox key={id} label={label} checked={!!o.packaging?.[id]} onChange={(v) => pp({ packaging: { polyBag: false, headerCard: false, usageGuide: false, ...(o.packaging || {}), [id]: v } })} />)}</Stack>
            <p className="dt-muted">Sticker orders go out in a poly bag with the header card and the usage guide card.</p>
          </Card>
        )}
      </Card>
      <Card>
        <Row gap={2} justify="between" align="center" wrap><p className="pb-card-h" style={{ margin: 0 }}>Items, {money(orderSubtotal(o))}{hasQuoteItems(o) ? ' plus quote' : ''}</p><Button variant="ghost" size="md" icon={Plus} onClick={() => setAddItem(v => !v)}>{addItem ? 'Done' : 'Add item'}</Button></Row>
        {addItem && <ItemPicker onAdd={(line) => writeItems([...(o.items || []), line])} />}
        <Stack gap={1}>
          {(o.items || []).map(i => (
            <div key={i.id} className="po-item">
              <Row gap={2} align="center"><span className="po-item-qty">{i.qty} x</span><span className="po-item-name lay-truncate">{i.name}</span><span style={{ flex: 1 }} /><InlineEdit value={i.quote || i.priceTotal == null ? '' : String(i.priceTotal)} onSave={(v) => writeItemsRaw(o.items.map(x => (x.id === i.id ? { ...x, priceTotal: v.trim() === '' ? null : Number(v) || 0, quote: v.trim() === '' } : x)))} placeholder="Quote" type="number" inputMode="decimal" format={(v) => (v === '' ? 'Quote' : money(v))} label={`${i.name} price`} className="po-item-price" /><IconButton icon={XClose} label="Remove item" variant="ghost" onClick={() => writeItems(o.items.filter(x => x.id !== i.id))} /></Row>
              {(i.label || Object.keys(i.options || {}).length > 0) && <span className="dt-muted po-item-opts">{[i.label, ...Object.entries(i.options || {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(', ')}</span>}
              <span className="po-item-art"><span className="dt-fact-label">Artwork</span><InlineEdit value={i.artworkLink || ''} onSave={(v) => writeItemsRaw(o.items.map(x => (x.id === i.id ? { ...x, artworkLink: v } : x)))} placeholder="Paste a link" label={`${i.name} artwork link`} className="cw-deliv-edit" />{i.artworkLink && <IconButton icon="LinkExternal01" label="Open artwork" variant="ghost" onClick={() => window.open(i.artworkLink, '_blank', 'noopener')} />}</span>
            </div>
          ))}
          {!(o.items || []).length && <EmptyState size="sm" icon="Package" title={COPY.empty['orders.items'].title} description={COPY.empty['orders.items'].description} action={{ label: COPY.empty['orders.items'].action, icon: Plus, onClick: () => setAddItem(true) }} />}
        </Stack>
      </Card>
      <Card>
        <Toggle label="Rush" description={`${money(RUSH_FEE)} rush line, 3 day turnaround.`} checked={!!o.rush} onChange={toggleRush} className="po-rush" />
        <Grid minColumnWidth={160} gap={2}><Input label="Due" type="date" value={o.dueAt || ''} onChange={(e) => pp({ dueAt: e.target.value })} hint={o.dueAt ? countdownLabel(localDate(o.dueAt)) : undefined} /></Grid>
        <div className="v-field"><span className="v-field-label">Notes</span><InlineEdit value={o.notes || ''} onSave={(v) => ppRaw({ notes: v })} multiline placeholder="Add a note" label="Order notes" /></div>
        {o.paid ? <p className="dt-muted">Paid {money(o.paid.amount)} on {fmtDay(o.paid.at)}{o.paid.ledgerId ? ', on the client ledger' : ', on the order only'}.</p> : <Button icon={Check} onClick={() => { setPayForm({ amount: String(orderSubtotal(o)), at: today() }); setPay(true); }} className="po-mark-paid">Mark paid</Button>}
      </Card>
    </Stagger>
      {confirmDialog}
      {pick && <LeadPicker leads={leads} title="Link to client" description="Linking writes the client onto the order and can start a print project." onClose={() => setPick(false)} onPick={linkClient} />}
      <Modal open={pay} onClose={() => setPay(false)} title="Mark paid" description={c.lead ? `Goes on ${c.lead.business}'s ledger.` : 'No client linked: recorded on the order only.'}
        footer={<><Button variant="ghost" onClick={() => setPay(false)}>Cancel</Button><Button icon={Check} onClick={savePay}>Record payment</Button></>}>
        <Grid minColumnWidth={140} gap={2}><Input label="Amount" type="number" inputMode="decimal" value={payForm.amount} onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))} data-autofocus /><Input label="Paid on" type="date" value={payForm.at} onChange={(e) => setPayForm(f => ({ ...f, at: e.target.value }))} /></Grid>
      </Modal>
    </div>
  );
}

/* ── Screen ────────────────────────────────────────────────────── */
export default function AdminOrders({ orders = [], loading, error, onRetry, unimported = 0, leads = [], projects = [], onCreate, onPatch, onRefresh, onImportSubmissions, onPatchLead, onCreateProject, openId, createPreset }) {
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const E = (k) => COPY.empty[k];
  // AdminApp's onPatch is optimistic with rollback; this adds the failure toast for button and menu writes.
  const patch = async (id, set) => { const ok = await onPatch(id, set); if (!ok) toast.error(COPY.error.save); return ok; };
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [selId, setSelId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const showSkel = useDelayedLoading(loading);
  const pending = loading && !showSkel;
  const now = Date.now();
  useTopBar(null);
  useEffect(() => { if (openId?.id) setSelId(openId.id); }, [openId]);
  useEffect(() => { if (createPreset) setCreating(true); }, [createPreset]);

  const live = useMemo(() => orders.filter(o => !o.archived), [orders]);
  const counts = useMemo(() => Object.fromEntries(ORDER_FILTERS.map(([id]) => [id, live.filter(o => orderPasses(o, id, now)).length])), [live, now]);
  const list = useMemo(() => live.filter(o => orderPasses(o, filter, now) && matchesOrder(o, q, leads)).sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || String(a.dueAt || '9').localeCompare(String(b.dueAt || '9'))), [live, filter, q, leads, now]);
  const sel = selId ? live.find(o => String(o._id) === String(selId)) : null;
  const open = live.filter(isOpenOrder);
  const summary = `${live.length} order${live.length === 1 ? '' : 's'}, ${open.length} open, ${counts.rush} rush, ${money(open.reduce((n, o) => n + orderSubtotal(o), 0))} in progress`;
  const chipLabel = (id, label) => label || printOrderStatusOf(id).label;

  const runImport = async () => { setImporting(true); const n = await onImportSubmissions?.(); setImporting(false); if (n == null) toast.error('Import failed. Nothing was added.'); else toast.success(`${n} shop order${n === 1 ? '' : 's'} imported.`); };
  const create = async (doc) => { const item = await onCreate?.(doc); if (item) { toast.success('Order created.'); setCreating(false); setSelId(item._id); } else toast.error(COPY.error.create); };

  const columns = [
    { id: 'customer', label: 'Customer', always: true, render: (o) => <span className="cl-cell-biz"><Avatar name={customerName(o, leads)} size="sm" /><span className="lay-truncate">{customerName(o, leads)}</span></span> },
    { id: 'source', label: 'Source', width: 110, render: (o) => <Pill id={o.source} list={ORDER_SOURCES} size="sm" variant="outline" /> },
    { id: 'status', label: 'Status', width: 130, render: (o) => <Pill id={o.status} list={PRINT_ORDER_STATUSES} size="sm" /> },
    { id: 'items', label: 'Items', render: (o) => itemSummary(o) },
    { id: 'subtotal', label: 'Subtotal', align: 'end', render: (o) => `${money(orderSubtotal(o))}${hasQuoteItems(o) ? ' +' : ''}` },
    { id: 'rush', label: 'Rush', width: 80, render: (o) => (o.rush ? <Pill tone="danger" label="Rush" size="sm" icon="Zap" /> : <span className="cl-muted-cell">No</span>) },
    { id: 'due', label: 'Due', render: (o) => (o.dueAt ? `${fmtDay(o.dueAt)}, ${countdownLabel(localDate(o.dueAt))}` : <span className="cl-muted-cell">None</span>) },
    { id: 'paid', label: 'Paid', width: 90, render: (o) => (o.paid ? <Pill tone="booked" label="Paid" size="sm" icon="Check" /> : <span className="cl-muted-cell">Unpaid</span>) },
  ];

  const pendingOpen = !!openId?.id && loading && !sel; // deep link while the list resolves: the record shape, not the list skeleton
  const detail = pendingOpen ? (showSkel && <RecordSkeleton cards={3} headerHeight={300} heights={[116, 300, 150]} />) : sel && <OrderDetail order={sel} leads={leads} projects={projects} onPatch={patch} onPatchRaw={onPatch} onPatchLead={onPatchLead} onCreateProject={onCreateProject} onClose={desktop ? () => setSelId(null) : undefined} />;
  const panelOpen = !!sel || pendingOpen;
  return (
    <PageShell className={`aa-main aa-main--wide po-shell${panelOpen && desktop ? ' has-panel' : ''}`}>
      <div className="po-split">
        <ScrollArea wide className="po-page">
          <Section title="Print Orders" loading={loading} description={loading ? undefined : summary} action={<Button icon={Plus} onClick={() => setCreating(true)} className="po-new">New order</Button>}>
            <Stack gap={2}>
              <Input className="cl-search" placeholder="Search customer, item, note" value={q} onChange={(e) => setQ(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label="Search orders" trailing={q ? <button type="button" className="cl-clear" onClick={() => setQ('')} aria-label="Clear search"><XClose width={14} height={14} /></button> : undefined} />
              <Row gap={2} wrap className="po-chips">{ORDER_FILTERS.map(([id, label]) => <Chip key={id} label={chipLabel(id, label)} count={counts[id]} selected={filter === id} onClick={() => setFilter(id)} />)}</Row>
            </Stack>
          </Section>
          {unimported > 0 && !loading && (
            <Card level={2} padding={3} className="po-import" glow="progress">
              <Row gap={2} justify="between" align="center" wrap><Row gap={2} align="center"><IconTile icon="Package" tone="progress" size="sm" /><span className="po-import-text">{unimported} shop order{unimported === 1 ? '' : 's'} from submissions {unimported === 1 ? 'is' : 'are'} not in this list yet.</span></Row><Button size="md" icon={Download01} loading={importing} onClick={runImport} className="po-import-btn">Import {unimported} shop order{unimported === 1 ? '' : 's'}</Button></Row>
            </Card>
          )}
          {pending ? null : showSkel ? (
            desktop && !panelOpen ? <Table.Skeleton rows={5} cols={8} selectable={false} /> : <Stack gap={2} aria-busy="true">{[1, 2, 3].map(i => <OrderCard.Skeleton key={i} />)}</Stack>
          ) : error && !orders.length ? (
            <Card><ErrorState title={COPY.error.orders.title} description={COPY.error.orders.description} onRetry={retry} retrying={retrying} /></Card>
          ) : !live.length ? (
            <Card><EmptyState icon="Package" title={E('orders.none').title} description={E('orders.none').description} action={{ label: E('orders.none').action, icon: Plus, onClick: () => setCreating(true) }} /></Card>
          ) : !list.length ? (
            <Card><EmptyState size="sm" icon="SearchMd" title={E('orders.filter').title} description={E('orders.filter').description} action={{ label: E('orders.filter').action, onClick: () => { setFilter('all'); setQ(''); } }} /></Card>
          ) : desktop && !sel ? (
            <Table aria-label="Print orders" columns={columns} rows={list} rowKey={(o) => String(o._id)} onRowClick={(o) => setSelId(o._id)} storageKey="vz_orders_cols" className="po-table" />
          ) : (
            <Stagger className="cl-stack">{list.map(o => <OrderCard key={o._id} order={o} leads={leads} onOpen={() => setSelId(o._id)} selected={sel && String(sel._id) === String(o._id)} compact={!!sel && desktop} />)}</Stagger>
          )}
          {!loading && <Row gap={2} justify="end"><Button variant="ghost" size="md" icon="RefreshCw01" onClick={onRefresh}>Refresh</Button></Row>}
        </ScrollArea>
        {panelOpen && desktop && <aside className="po-panel" aria-label="Order"><ScrollArea bare className="po-panel-scroll">{detail}</ScrollArea></aside>}
      </div>
      {panelOpen && !desktop && <Sheet open onClose={() => setSelId(null)} title={sel ? customerName(sel, leads) : <SkeletonBlock width={140} height={22} />} description={sel ? itemSummary(sel) : <SkeletonBlock width={200} height={14} />} tall width={520} className="po-sheet">{detail}</Sheet>}
      {creating && <NewOrderSheet leads={leads} onClose={() => setCreating(false)} onCreate={create} preset={createPreset?.preset} />}
      <style>{poStyles}</style>
    </PageShell>
  );
}

const poStyles = `
  /* The list plus panel split (.po-split, .po-panel) ships in uiStyles (src/ui/lead.styles.js). */
  .po-card { gap: var(--v-space-2); text-align: left; align-items: stretch; }
  .po-card-name { flex: 1; min-width: 0; font-weight: var(--v-weight-bold); color: var(--v-text); }
  .po-card-items { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .po-card-sub { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text); font-variant-numeric: tabular-nums; }
  .po-import { gap: 0; }
  .po-import-text { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .po-detail { min-width: 0; }
  .po-cust { gap: var(--v-space-3); }
  .po-cust-name { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); overflow-wrap: anywhere; }
  .po-email { max-width: 100%; }
  .po-email .v-btn-label { overflow: hidden; text-overflow: ellipsis; }
  .po-picker { gap: var(--v-space-2); }
  .po-total { display: flex; flex-direction: column; gap: 2px; padding-top: var(--v-space-2); }
  .po-item { display: flex; flex-direction: column; gap: var(--v-space-1); padding: var(--v-space-2) 0; border-bottom: 1px solid var(--v-border); min-width: 0; }
  .po-item:last-child { border-bottom: 0; }
  .po-item-qty { font-size: var(--v-text-sm); color: var(--v-text-3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .po-item-name { font-weight: var(--v-weight-semibold); min-width: 0; }
  .po-item-price { font-variant-numeric: tabular-nums; font-weight: var(--v-weight-semibold); flex-shrink: 0; }
  .po-item-opts { overflow-wrap: anywhere; }
  .po-item-art { display: flex; align-items: center; gap: var(--v-space-2); min-width: 0; }
  .po-item-art .v-inline { flex: 1; min-width: 0; }
  .po-pack { gap: var(--v-space-2); }
`;
