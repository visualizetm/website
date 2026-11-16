import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell, ScrollArea, Stack, Row, Card, Button, IconButton, Chip, Input, Textarea, Toggle, Pill, ListRow, Sheet, Menu, Icon, EmptyState, NoResults, ErrorState, SkeletonBlock, SkeletonText, useToast, useMediaQuery, useConfirm } from '../ui';
import { useTopBar, useShell } from '../shell/ShellContext';
import { useSelection } from '../shell/nav-history';
import { apiFetch } from '../shared/api';
import { COPY } from '../shared/copy';
import { fmtDate } from '../shared/dates';
import { DEPOSIT_PCT, REVISION_ROUNDS, money } from '../shared/pricing';
import { dealOf } from '../lib/deal';
import { effectiveStage } from '../lib/booked';
import { matchesSearch } from '../lib/leads';
import { invoicesOf } from '../lib/invoices';
import { projectsOf, isActiveProject } from '../lib/projects';
import { safeHref } from '../lib/safeUrl';
import { useAutoSave } from '../lib/useAutoSave';
import { SaveChip, saveBarStyles } from '../components/SaveBar';
import ListSearch from '../components/ListSearch';
import { QUOTE_TONE } from './AdminQuotes';
import {
  quoteCatalog, searchCatalog, addRow, addCustom, patchLine, dropLine, lineKey, lineTotal, lineOffList, qtyOf, validLines, savedFromLine, swapForPackage,
  quoteSummary, quoteBody, quoteStatusOf, relistLines, quoteText, quoteEmail, quoteInvoice, dealQuoteOf, fmtMoney, retainerLine, FREE_LINE, QUOTE_STATUS, QUOTE_CAPS,
} from '../lib/quote';

/* The quote editor (/quotes/:id; the old builder's path, /leads/:id/quote, lands here). One draft, four steps:
 *   Who             an existing lead or client, or someone new (a lead, stage lead, source quote, through the normal lead POST)
 *   What they need  a search over everything on the price list and the saved items; a tap adds a line. A line has a quantity,
 *                   Rob's price for one (the list price under it), a Free switch, remove, and a menu (Save as an item, the
 *                   custom fields). A custom item is anything else: a name, a quantity, a price, and for Rob only a cost, a
 *                   supplier link and a note.
 *   Check           the total, the deposit, the plan over the cap, the honest package check, the terms, the client note; and,
 *                   marked Only you see this, what is off list, what was given free and the private note
 *   Send            the quote email as a draft into the send sheet (never sent from here), the deposit invoice, Copy as text,
 *                   the statuses, Duplicate
 * A phone shows an overview of the four rows and one step per screen (a history entry each, so Back is Back); a computer shows
 * the steps side by side with Check and Send pinned. The draft saves itself (src/lib/useAutoSave.js, the SaveChip) through
 * quotesApi.ops.save, which also leaves the summary on the lead's deal. What a client can receive is built in src/lib/quote.js
 * (quoteEmail, quoteText, quoteInvoice) from clientLine, so nothing of Rob's rides along. */
const STEPS = [{ id: 'who', label: 'Who' }, { id: 'need', label: 'What they need' }, { id: 'check', label: 'Check' }, { id: 'send', label: 'Send' }];
const GROUP_IDS = ['brand', 'web', 'print', 'packages', 'saved'];
const num = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));

function OnlyYou() { return <p className="qb-only"><Icon icon="Lock01" size="var(--v-icon-sm)" />Only you see this</p>; }

function WhoStep({ lead, leads, onPick, onNew }) {
  const [q, setQ] = useState('');
  const hits = q.trim() ? leads.filter(l => matchesSearch(l, q)).slice(0, 6) : [];
  return (
    <Card className="qb-card qb-who" data-step-card="who">
      <h2 className="qb-h">Who it is for</h2>
      {lead
        ? <div className="qb-who-now"><span className="qb-who-name lay-truncate">{lead.business}</span><span className="qb-hint lay-truncate">{[lead.askFor, lead.phone, lead.email].filter(Boolean).join(' · ') || 'No contact details yet'}</span></div>
        : <p className="qb-hint qb-who-none">No one yet. Search for them, or add someone new.</p>}
      <ListSearch value={q} onChange={setQ} placeholder="Search leads and clients" label="Search leads and clients" className="qb-who-search" />
      {q.trim() && (hits.length
        ? <ul className="qb-list">{hits.map(l => <li key={l._id}><ListRow title={l.business} subtitle={[l.askFor, l.phone].filter(Boolean).join(' · ') || undefined} chevron={false} onClick={() => { onPick(l); setQ(''); }} className="qb-who-hit" data-lead={String(l._id)} /></li>)}</ul>
        : <NoResults noun="leads or clients" query={q} onClear={() => setQ('')} />)}
      <Button variant="secondary" icon="Plus" onClick={onNew} className="qb-who-new">Someone new</Button>
    </Card>
  );
}

function NewWhoSheet({ open, onClose, onCreate }) {
  const [f, setF] = useState({ name: '', business: '', phone: '', email: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ name: '', business: '', phone: '', email: '' }); }, [open]);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const go = async () => { setBusy(true); try { await onCreate(f); } finally { setBusy(false); } };
  return (
    <Sheet open={open} onClose={onClose} title="Someone new" description="They are added as a lead, then this quote is theirs." className="qb-newwho"
      footer={<Row gap={2} justify="end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={go} loading={busy} disabled={!f.business.trim()} className="qb-newwho-add">Add and attach</Button></Row>}>
      <Stack gap={3}>
        <Input label="Business" value={f.business} onChange={set('business')} maxLength={160} required data-autofocus />
        <Input label="Name" value={f.name} onChange={set('name')} maxLength={120} autoComplete="off" />
        <Input label="Phone" value={f.phone} onChange={set('phone')} inputMode="tel" maxLength={40} />
        <Input label="Email" value={f.email} onChange={set('email')} inputMode="email" maxLength={200} />
      </Stack>
    </Sheet>
  );
}

/* Add a custom item, or edit one: the name, how many, the price for one; cost, supplier and note behind one tap, Rob's only. */
function CustomSheet({ open, line, onClose, onSave }) {
  const blank = { label: '', qty: 1, unit: '', cost: '', supplierUrl: '', note: '' };
  const [f, setF] = useState(blank);
  const [more, setMore] = useState(false);
  useEffect(() => { if (open) { setF(line ? { label: line.label, qty: line.qty, unit: line.unit, cost: line.cost ?? '', supplierUrl: line.supplierUrl || '', note: line.note || '' } : blank); setMore(!!(line && (line.cost !== undefined || line.supplierUrl || line.note))); } }, [open, line]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const badLink = !!String(f.supplierUrl).trim() && !/^https?:\/\/[^\s]+$/i.test(String(f.supplierUrl).trim());
  return (
    <Sheet open={open} onClose={onClose} title={line ? 'Edit the item' : 'Add a custom item'} description="Yard signs, shirts, a banner, anything that is not on the price list." className="qb-custom"
      footer={<Row gap={2} justify="end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!String(f.label).trim() || badLink} onClick={() => onSave({ ...f, qty: f.qty === '' ? 1 : f.qty, unit: f.unit === '' ? 0 : f.unit })} className="qb-custom-save">{line ? 'Save' : 'Add to the quote'}</Button></Row>}>
      <Stack gap={3}>
        <Input label="Name" value={f.label} onChange={set('label')} maxLength={QUOTE_CAPS.label} required data-autofocus className="qb-custom-name" />
        <Row gap={2} wrap={false} className="qb-custom-nums">
          <Input label="Quantity" type="number" inputMode="numeric" min={1} max={QUOTE_CAPS.qty} step={1} value={f.qty} onChange={set('qty')} className="qb-custom-qty" />
          <Input label="Price each" type="number" inputMode="decimal" min={0} max={QUOTE_CAPS.unit} step="any" value={f.unit} onChange={set('unit')} className="qb-custom-unit" />
        </Row>
        <Button variant="ghost" icon={more ? 'ChevronUp' : 'ChevronDown'} aria-expanded={more} onClick={() => setMore(m => !m)} className="qb-custom-more">Cost, supplier and note</Button>
        {more && (
          <Stack gap={3} className="qb-mine">
            <OnlyYou />
            <Input label="Cost each" type="number" inputMode="decimal" min={0} max={QUOTE_CAPS.unit} step="any" value={f.cost} onChange={set('cost')} className="qb-custom-cost" />
            <Input label="Supplier link" value={f.supplierUrl} onChange={set('supplierUrl')} inputMode="url" maxLength={400} placeholder="https://" error={badLink ? 'A link starts with http:// or https://' : undefined} className="qb-custom-link" />
            <Input label="Note" value={f.note} onChange={set('note')} maxLength={QUOTE_CAPS.lineNote} className="qb-custom-note" />
          </Stack>
        )}
      </Stack>
    </Sheet>
  );
}

function LineRow({ l, hasCents, onPatch, onRemove, onSaveItem, onEdit }) {
  const custom = l.kind === 'custom';
  const qty = qtyOf(l);
  const off = lineOffList(l);
  const fm = (n) => fmtMoney(n, hasCents || !Number.isInteger(Number(n)));
  const items = [
    { id: 'save', label: 'Save as an item', icon: 'Save01', onSelect: onSaveItem },
    ...(custom ? [{ id: 'edit', label: 'Cost, supplier and note', icon: 'Pencil01', onSelect: onEdit }] : []),
    ...(custom && l.supplierUrl ? [{ id: 'supplier', label: 'Open supplier', icon: 'LinkExternal01', onSelect: () => window.open(safeHref(l.supplierUrl), '_blank', 'noopener') }] : []),
  ];
  return (
    <li className={`qb-line${l.free ? ' is-free' : ''}`} data-line={l.id} data-kind={l.kind}>
      <div className="qb-line-top">
        <span className="qb-line-label"><strong className="lay-title">{l.label}</strong><span className="qb-hint">{custom ? 'Custom item' : l.kind === 'package' ? 'Package' : 'Price list'}{l.free ? ', on me' : off > 0 ? `, ${fm(off)} off list` : ''}</span></span>
        <span className="qb-line-total" aria-label={`Line total ${l.free ? 'free' : fm(lineTotal(l))}`}>{l.free ? 'On me' : fm(lineTotal(l))}</span>
        <Menu label={`${l.label} actions`} items={items} className="qb-line-menu" />
      </div>
      <div className="qb-line-ctl">
        {l.kind !== 'package' && (
          <div className="qb-qty" role="group" aria-label={`Quantity of ${l.label}`}>
            <span className="qb-fig-l" aria-hidden="true">Qty</span>
            <div className="qb-qty-row">
              <IconButton icon="Minus" label={`One less ${l.label}`} variant="secondary" disabled={qty <= 1} onClick={() => onPatch({ qty: qty - 1 })} className="qb-qty-less" />
              <Input aria-label={`Quantity of ${l.label}`} type="number" inputMode="numeric" min={1} max={QUOTE_CAPS.qty} step={1} value={qty} onChange={(e) => onPatch({ qty: e.target.value === '' ? 1 : e.target.value })} className="qb-qty-n" />
              <IconButton icon="Plus" label={`One more ${l.label}`} variant="secondary" onClick={() => onPatch({ qty: qty + 1 })} className="qb-qty-more" />
            </div>
          </div>
        )}
        <Input label="Price each" type="number" inputMode="decimal" min={0} max={QUOTE_CAPS.unit} step="any" value={l.free && !custom ? 0 : num(l.unit)} disabled={!!l.free} hint={custom ? 'Your price' : `List ${fm(l.listUnit)}`}
          onChange={(e) => onPatch({ unit: e.target.value === '' ? 0 : e.target.value })} className="qb-price" />
        <div className="qb-line-end">
          <Toggle label="Free" checked={!!l.free} onChange={(v) => onPatch({ free: v })} size="sm" className="qb-free" />
          <IconButton icon="Trash01" label={`Remove ${l.label}`} variant="ghost" onClick={onRemove} className="qb-remove" />
        </div>
      </div>
      {custom && l.supplierUrl && <Button variant="ghost" size="sm" icon="LinkExternal01" onClick={() => window.open(safeHref(l.supplierUrl), '_blank', 'noopener')} className="qb-supplier">Open supplier</Button>}
    </li>
  );
}

function NeedStep({ lines, saved, hasCents, onLines, onSaveItem }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('brand');
  const [sheet, setSheet] = useState(null); // { line } to edit, {} to add
  const cat = useMemo(() => quoteCatalog(saved), [saved]);
  const searching = !!q.trim();
  const shown = searching ? searchCatalog(cat, q) : cat.filter(g => g.id === group);
  const inQuote = (r) => lines.find(l => lineKey(l) === r.key);
  const saveCustom = (f) => { onLines(sheet?.line ? patchLine(lines, lineKey(sheet.line), f) : addCustom(lines, f)); setSheet(null); };
  return (
    <>
      <Card className="qb-card qb-pick" data-step-card="need">
        <h2 className="qb-h">What they need</h2>
        <ListSearch value={q} onChange={setQ} placeholder="Search everything I sell" label="Search the price list and saved items" className="qb-pick-search" />
        {!searching && <div className="qb-groups" role="group" aria-label="Show">{cat.filter(g => GROUP_IDS.includes(g.id)).map(g => <Chip key={g.id} label={g.label} selected={group === g.id} onClick={() => setGroup(g.id)} className={`qb-group qb-group--${g.id}`} />)}</div>}
        {searching && shown.length === 0 && <NoResults noun="items" query={q} onClear={() => setQ('')} />}
        {shown.map(g => (
          <section key={g.id} className="qb-group-sec" aria-label={g.label}>
            {searching && <p className="qb-group-h">{g.label}</p>}
            {g.rows.length === 0
              ? <p className="qb-hint qb-saved-none">Nothing saved yet. Save a line as an item from its menu.</p>
              : <ul className="qb-list">{g.rows.map(r => { const have = inQuote(r); return <li key={r.key}><ListRow title={r.label} subtitle={have ? `In the quote${qtyOf(have) > 1 ? `, ${qtyOf(have)}` : ''}` : undefined} meta={<span className="qb-row-p">{fmtMoney(r.price, !Number.isInteger(Number(r.price)))}</span>} chevron={false} onClick={() => onLines(addRow(lines, r))} className={`qb-row${have ? ' is-in' : ''}`} data-row={r.key} aria-label={`Add ${r.label}, ${fmtMoney(r.price, !Number.isInteger(Number(r.price)))}`} /></li>; })}</ul>}
          </section>
        ))}
        <Button variant="secondary" icon="Plus" onClick={() => setSheet({})} className="qb-add-custom">Add a custom item</Button>
      </Card>
      <Card className="qb-card qb-lines">
        <h2 className="qb-h">Lines<span className="qb-h-n">{lines.length}</span></h2>
        {lines.length === 0
          ? <p className="qb-hint qb-lines-none">No lines yet. Tap something on the price list, or add a custom item.</p>
          : <ul className="qb-line-list">{lines.map(l => <LineRow key={lineKey(l)} l={l} hasCents={hasCents} onPatch={(p) => onLines(patchLine(lines, lineKey(l), p))} onRemove={() => onLines(dropLine(lines, lineKey(l)))} onSaveItem={() => onSaveItem(l)} onEdit={() => setSheet({ line: l })} />)}</ul>}
      </Card>
      <CustomSheet open={!!sheet} line={sheet?.line || null} onClose={() => setSheet(null)} onSave={saveCustom} />
    </>
  );
}

/* Check is two cards: the totals (pinned beside the steps on a computer) and the terms and notes. */
function TotalsCard({ draft, sum, onSet }) {
  const fm = (n) => fmtMoney(n, sum.hasCents);
  return (
    <Card className="qb-card qb-totals" data-step-card="check">
      <h2 className="qb-h">Check</h2>
      <div className="qb-figs">
        <div><span className="qb-fig-l">Total</span><p className="qb-big qb-total">{fm(sum.total)}</p>{sum.plan && <p className="qb-hint qb-plan">or {money(sum.plan.monthly)} a month for {sum.plan.months} months</p>}</div>
        <div><span className="qb-fig-l">Deposit</span><p className="qb-big qb-deposit">{money(sum.deposit)}</p><p className="qb-hint">{DEPOSIT_PCT}% locks the price and the start</p></div>
      </div>
      {sum.check && (
        <div className="qb-check" role="note">
          <p className="qb-check-t">{sum.check.text}</p>
          <Button variant="secondary" size="sm" onClick={() => onSet({ lines: swapForPackage(draft.lines, sum.check.id) })} className="qb-check-use">Use {sum.check.label}</Button>
        </div>
      )}
      <div className="qb-mine">
        <OnlyYou />
        <div className="qb-figs">
          <div><span className="qb-fig-l">Off list</span><p className="qb-mid qb-off-total">{fm(sum.offList)}</p></div>
          <div><span className="qb-fig-l">Given free</span><p className="qb-mid qb-free-total">{fm(sum.givenFree)}</p></div>
        </div>
        {sum.givenFree > 0 && <p className="qb-hint qb-free-say">{FREE_LINE}</p>}
      </div>
    </Card>
  );
}
function TermsCard({ draft, sum, onSet }) {
  const pitch = retainerLine(sum.packageId);
  return (
    <Card className="qb-card qb-terms-card">
      <h2 className="qb-h">Terms and notes</h2>
      <p className="qb-hint qb-terms">{REVISION_ROUNDS} revision rounds are included.</p>
      <Input label="Good for, in days" type="number" inputMode="numeric" min={1} max={QUOTE_CAPS.validDays} step={1} value={num(draft.validDays)} onChange={(e) => onSet({ validDays: e.target.value === '' ? '' : Number(e.target.value) })} className="qb-days" />
      <Toggle label="Retainer pitch" description={pitch} checked={draft.retainerPitch !== false} onChange={(v) => onSet({ retainerPitch: v })} className="qb-retainer" />
      <Textarea label="Note to the client" rows={3} maxLength={QUOTE_CAPS.note} value={draft.note || ''} onChange={(e) => onSet({ note: e.target.value })} className="qb-note" />
      <div className="qb-mine">
        <OnlyYou />
        <Textarea label="Private note" rows={2} maxLength={QUOTE_CAPS.note} value={draft.privateNote || ''} onChange={(e) => onSet({ privateNote: e.target.value })} className="qb-private" />
      </div>
    </Card>
  );
}

function SendStep({ stored, status, busy, canSend, invoiceNote, onDraft, onInvoice, onCopy, onStatus, onDuplicate, onDelete }) {
  return (
    <Card className="qb-card qb-send" data-step-card="send">
      <h2 className="qb-h">Send<Pill tone={QUOTE_TONE[status]} label={QUOTE_STATUS[status]} size="sm" icon={false} className="qb-status" /></h2>
      <p className="qb-hint qb-send-line">{stored?.sentAt ? `Sent ${fmtDate(stored.sentAt)}.` : 'Nothing leaves from here. The email opens as a draft for you to read and send.'}{stored?.decidedAt ? ` ${QUOTE_STATUS[status]} ${fmtDate(stored.decidedAt)}.` : ''}</p>
      <Stack gap={2}>
        <Button icon="Mail01" loading={busy === 'draft'} disabled={!!busy || !canSend} onClick={onDraft} className="qb-draft">Draft the quote email</Button>
        <Button variant="secondary" icon="CurrencyDollar" loading={busy === 'invoice'} disabled={!!busy || !canSend} onClick={onInvoice} className="qb-invoice">Make the deposit invoice</Button>
        {invoiceNote && <p className="qb-hint qb-invoice-note">{invoiceNote}</p>}
        <Button variant="secondary" icon="Copy01" disabled={!!busy || !canSend} onClick={onCopy} className="qb-copy">Copy as text</Button>
      </Stack>
      {!canSend && <p className="qb-hint qb-send-need">Pick who it is for and add a line first.</p>}
      <div className="qb-marks" role="group" aria-label="Where it stands">
        {status === 'draft' && <Button variant="ghost" size="md" loading={busy === 'sent'} disabled={!!busy} onClick={() => onStatus('sent')} className="qb-mark-sent">Mark sent</Button>}
        {status !== 'accepted' && <Button variant="ghost" size="md" loading={busy === 'accepted'} disabled={!!busy} onClick={() => onStatus('accepted')} className="qb-mark-accepted">Mark accepted</Button>}
        {status !== 'declined' && <Button variant="ghost" size="md" loading={busy === 'declined'} disabled={!!busy} onClick={() => onStatus('declined')} className="qb-mark-declined">Mark declined</Button>}
        {status !== 'draft' && <Button variant="ghost" size="md" loading={busy === 'draft-again'} disabled={!!busy} onClick={() => onStatus('draft')} className="qb-mark-draft">Back to a draft</Button>}
      </div>
      <Row gap={2} wrap className="qb-more">
        <Button variant="ghost" size="md" icon="Copy01" loading={busy === 'dup'} disabled={!!busy} onClick={onDuplicate} className="qb-dup">Duplicate</Button>
        <Button variant="ghost" size="md" icon="Trash01" disabled={!!busy} onClick={onDelete} className="qb-del">Delete</Button>
      </Row>
    </Card>
  );
}

/* The loaded shape: on a phone the heading and four rows; on a computer the heading over Who and the picker, with Check and Send beside them. */
function QuoteSkeleton({ phone }) {
  if (phone) return (
    <div className="qb-body qb-over" aria-busy="true" aria-hidden="true">
      <div className="qb-head" style={{ minHeight: 48 }}><SkeletonBlock width={200} height={26} /></div>
      <Stack gap={2}>{STEPS.map(s => <SkeletonBlock key={s.id} height={60} radius="var(--v-radius-md)" />)}</Stack>
    </div>
  );
  return (
    <div className="qb-body qb-cols" aria-busy="true" aria-hidden="true">
      <div className="qb-col"><div className="qb-head"><SkeletonBlock width={240} height={26} /></div>{[224, 708].map((h, i) => <Card key={i} className="qb-card" style={{ minHeight: h }}><SkeletonText lines={3} /></Card>)}</div>
      <div className="qb-col qb-side">{[301, 436].map((h, i) => <Card key={i} className="qb-card" style={{ minHeight: h }}><SkeletonText lines={4} /></Card>)}</div>
    </div>
  );
}

export default function AdminQuote({ quoteId = '', quotesApi, leads = [], projects = [], loading = false, onPatchLead, onPatchProject, onCreateLead, onBack }) {
  const shell = useShell(); const toast = useToast();
  const [confirm, confirmEl] = useConfirm();
  const phone = useMediaQuery('(max-width: 767px)');
  const ops = quotesApi?.ops;
  const stored = (quotesApi?.quotes || []).find(x => String(x._id) === String(quoteId)) || null;
  const [draft, setDraft] = useState(null);
  const [savedJson, setSavedJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [newWho, setNewWho] = useState(false);
  const leadsRef = useRef(leads); leadsRef.current = leads;
  /* The draft is seeded once from the stored quote, with today's list prices (a line whose id has left the list becomes a custom line). */
  useEffect(() => {
    if (draft || !stored) return;
    const d = { ...quoteBody(stored), lines: relistLines(stored.lines) };
    setDraft(d); setSavedJson(JSON.stringify(quoteBody(stored)));
  }, [stored, draft]);
  const body = useMemo(() => (draft ? JSON.stringify(quoteBody(draft)) : ''), [draft]);
  const dirty = !!draft && body !== savedJson && (draft.lines.length === 0 || validLines(draft.lines));
  const draftRef = useRef(draft); draftRef.current = draft;
  const save = async () => {
    const d = draftRef.current; if (!d || !ops) return false;
    const sent = JSON.stringify(quoteBody(d));
    setSaving(true);
    try { const item = await ops.save({ ...d, _id: quoteId }); if (!item) return false; setSavedJson(sent); return true; } finally { setSaving(false); }
  };
  const status = useAutoSave({ dirty, saving, save, watch: body, delay: 600 });
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const flush = async () => (dirtyRef.current ? save() : true);
  /* Leaving by anything but Back (the sidebar, a tab, a link) inside the autosave wait: the last change still goes. */
  const opsRef = useRef(ops); opsRef.current = ops;
  useEffect(() => () => { if (dirtyRef.current && draftRef.current) opsRef.current?.save({ ...draftRef.current, _id: quoteId }); }, [quoteId]);
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));

  const lead = draft?.leadId ? leads.find(l => String(l._id) === String(draft.leadId)) || null : null;
  const full = useMemo(() => ({ ...(stored || {}), ...(draft || {}), business: lead?.business || stored?.business || '', person: lead?.askFor || stored?.person || '' }), [stored, draft, lead]);
  const sum = useMemo(() => quoteSummary(full), [full]);
  const st = quoteStatusOf(stored);
  const fm = (n) => fmtMoney(n, sum.hasCents);
  const canSend = !!lead && !!draft && validLines(draft.lines);
  const isClient = lead ? ['client', 'won'].includes(effectiveStage(lead)) : false;
  const openProject = lead && isClient ? projectsOf(projects, lead._id).find(isActiveProject) || null : null;

  const { selId: step, open: openStep, close: closeStep } = useSelection('quote-step');
  const inStep = phone && !!step && STEPS.some(s => s.id === step);
  const leave = async () => { await flush(); onBack?.(); };
  const title = lead?.business || stored?.business || (stored ? 'New quote' : 'Quote');
  useTopBar({ title: inStep ? STEPS.find(s => s.id === step).label : title, back: inStep ? closeStep : (onBack ? leave : undefined), actions: inStep ? [{ id: 'done', label: 'Done', icon: 'Check', onClick: closeStep }] : undefined });

  const createWho = async (f) => {
    const made = await onCreateLead?.({ business: f.business.trim(), askFor: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() });
    if (!made) { toast.error(COPY.error.create); return; }
    set({ leadId: String(made._id) }); setNewWho(false);
    toast.success(`${made.business} added as a lead.`);
  };
  const saveItem = async (l) => {
    const next = [savedFromLine(l), ...(quotesApi?.items || [])].slice(0, QUOTE_CAPS.savedItems);
    if (await ops.saveItems(next)) toast.success(`${l.label} saved as an item.`); else toast.error(COPY.error.save);
  };
  const draftEmail = async () => {
    setBusy('draft');
    try {
      if (!(await flush())) { toast.error(COPY.error.save); return; }
      const r = await apiFetch('/api/admin/email/send', { method: 'POST', body: { templateId: 'custom', recordId: String(lead._id), ...(lead.email ? { to: [lead.email] } : {}), override: quoteEmail(lead, full, { nextOpenStart: shell?.profile?.nextOpenStart }), reason: `Quote ${stored?.number || ''}`.trim() } });
      if (!r.ok) { toast.error(r.data?.error || COPY.error.save); return; }
      window.dispatchEvent(new CustomEvent('vz:drafts-changed'));
      if (r.data?.logId) await ops.patch(quoteId, { emailLogId: String(r.data.logId) });
      if (r.data?.logId && shell?.openSendSheet) shell.openSendSheet({ _id: r.data.logId }, { onChanged: () => { ops.refresh(quoteId); } }); else toast.success('The quote is in Drafts.');
    } finally { setBusy(''); }
  };
  const makeInvoice = async () => {
    if (isClient && !openProject) { toast.error('They have no open project. Start one from their record, then make the invoice.'); return; }
    setBusy('invoice');
    try {
      if (!(await flush())) { toast.error(COPY.error.save); return; }
      const inv = quoteInvoice(full);
      const cur = leadsRef.current.find(l => String(l._id) === String(lead._id)) || lead;
      const ok = openProject
        ? await onPatchProject(openProject._id, { invoices: [...invoicesOf(openProject), inv] })
        : await onPatchLead(cur._id, { deal: { ...dealOf(cur), quote: dealQuoteOf({ ...full, _id: quoteId }), invoices: [...(dealOf(cur).invoices || []), inv] } });
      if (!ok) { toast.error(COPY.error.save); return; }
      if (shell?.openCompose) shell.openCompose(cur, { templateId: 'invoice', invoice: inv, ...(openProject ? { project: openProject } : {}) }); else toast.success(`Deposit invoice ${money(inv.amount)} added.`);
    } finally { setBusy(''); }
  };
  const copyText = async () => {
    await flush();
    try { await navigator.clipboard.writeText(quoteText(full, lead, { nextOpenStart: shell?.profile?.nextOpenStart })); toast.success('Copied. Paste it into a text.'); } catch { toast.error('Copy did not work on this device.'); }
  };
  const mark = async (next) => {
    setBusy(next === 'draft' ? 'draft-again' : next);
    try { await flush(); if (await ops.setStatus({ _id: quoteId }, next)) toast.success(next === 'draft' ? 'Back to a draft.' : `Marked ${QUOTE_STATUS[next].toLowerCase()}.`); else toast.error(COPY.error.save); } finally { setBusy(''); }
  };
  const duplicate = async () => {
    setBusy('dup');
    try { await flush(); const item = await ops.duplicate({ _id: quoteId }); if (item) { toast.success(`${item.number} is a copy.`); quotesApi.openQuote(item); } else toast.error(COPY.error.create); } finally { setBusy(''); }
  };
  const del = async () => {
    if (!(await confirm({ title: 'Delete this quote?', body: `${stored?.number || 'It'} leaves the list. Emails already drafted or sent stay where they are.`, danger: true, confirmLabel: 'Delete' }))) return;
    if (await ops.remove(stored)) { toast.success('Deleted.'); onBack?.(); } else toast.error(COPY.error.save);
  };

  const shell_ = (inner) => (
    <PageShell className="aa-main aa-main--wide qb-page sb-host">
      <ScrollArea wide className="qb-scroll">{inner}</ScrollArea>
      {draft && <SaveChip status={status} />}
      {confirmEl}
      <style>{saveBarStyles}{qbStyles}</style>
    </PageShell>
  );
  if (loading) return shell_(<QuoteSkeleton phone={phone} />); // nothing has loaded yet (or the audits' forced loading state)
  if (!draft) {
    if (quotesApi?.error) return shell_(<Card><ErrorState title="The quote did not load" description="Nothing was lost. Try again." onRetry={quotesApi.reload} /></Card>);
    if (quotesApi?.loading || quoteId === 'new' || !quoteId) return shell_(<QuoteSkeleton phone={phone} />);
    return shell_(<EmptyState icon="Receipt" title="This quote is not here" description="It may have been deleted." action={{ label: 'All quotes', onClick: () => shell?.go?.('quotes') }} />);
  }

  const who = <WhoStep lead={lead} leads={leads} onPick={(l) => set({ leadId: String(l._id) })} onNew={() => setNewWho(true)} />;
  const need = <NeedStep lines={draft.lines} saved={quotesApi?.items || []} hasCents={sum.hasCents} onLines={(lines) => set({ lines })} onSaveItem={saveItem} />;
  const totals = <TotalsCard draft={draft} sum={sum} onSet={set} />;
  const terms = <TermsCard draft={draft} sum={sum} onSet={set} />;
  const check = <>{totals}{terms}</>;
  const invoiceNote = !lead ? '' : isClient ? (openProject ? `Goes on ${openProject.name || 'their open project'}.` : 'They have no open project. Start one from their record first.') : 'Goes on their deal.';
  const send = <SendStep stored={stored} status={st} busy={busy} canSend={canSend} invoiceNote={invoiceNote} onDraft={draftEmail} onInvoice={makeInvoice} onCopy={copyText} onStatus={mark} onDuplicate={duplicate} onDelete={del} />;
  const views = { who, need, check, send };
  const summaryOf = {
    who: lead ? [lead.business, lead.askFor].filter(Boolean).join(', ') : 'No one yet',
    need: draft.lines.length ? `${draft.lines.length} ${draft.lines.length === 1 ? 'line' : 'lines'}, ${fm(sum.total)}` : 'Nothing yet',
    check: `Total ${fm(sum.total)}, deposit ${money(sum.deposit)}`,
    send: `${QUOTE_STATUS[st]}${stored?.sentAt ? `, sent ${fmtDate(stored.sentAt)}` : ''}`,
  };
  return shell_(
    <>
      <p className="v-sr-only" aria-live="polite" role="status">Total {fm(sum.total)}, deposit {money(sum.deposit)}</p>
      {phone ? (
        inStep ? <div className="qb-body qb-step" data-step={step} data-v-enter>{views[step]}</div> : (
          <div className="qb-body qb-over" data-v-enter>
            <div className="qb-head">
              <Row gap={2} align="center" wrap={false} style={{ minWidth: 0 }}><h2 className="qb-title lay-title">{title}</h2><Pill tone={QUOTE_TONE[st]} label={QUOTE_STATUS[st]} size="sm" icon={false} /></Row>
              <p className="qb-sub">{[stored?.number, fm(sum.total)].filter(Boolean).join(' · ')}</p>
            </div>
            <Stack gap={2}>{STEPS.map(s => <ListRow key={s.id} title={s.label} subtitle={summaryOf[s.id]} onClick={() => openStep(s.id)} className="qb-step-row" data-step={s.id} />)}</Stack>
          </div>
        )
      ) : (
        <div className="qb-body qb-cols" data-v-enter>
          <div className="qb-col">
            <div className="qb-head"><Row gap={2} align="center" wrap><h1 className="qb-title lay-truncate">{title}</h1><Pill tone={QUOTE_TONE[st]} label={QUOTE_STATUS[st]} size="sm" icon={false} /><span className="qb-sub">{stored?.number}</span></Row></div>
            {who}{need}{terms}
          </div>
          <div className="qb-col qb-side">{totals}{send}</div>
        </div>
      )}
      <NewWhoSheet open={newWho} onClose={() => setNewWho(false)} onCreate={createWho} />
    </>,
  );
}

const qbStyles = `
  .qb-scroll { --v-scroll-extra: var(--sb-scroll-extra); }
  .qb-body { display: flex; flex-direction: column; gap: var(--v-space-4); }
  .qb-body[data-v-enter] { animation: v-enter var(--v-dur-enter) var(--v-ease-out) both; }
  @media (prefers-reduced-motion: reduce) { .qb-body[data-v-enter] { animation: none; } }
  .qb-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 400px); align-items: start; gap: var(--v-space-4); }
  .qb-col { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; }
  /* Pinned while it fits the screen; on a short window it scrolls with the page, so its last button is never out of reach. */
  @media (min-width: 1024px) and (min-height: 860px) { .qb-side { position: sticky; top: 0; } }
  @media (max-width: 1023px) { .qb-cols { grid-template-columns: minmax(0, 1fr); } }
  @media (min-width: 1024px) { .qb-pick .qb-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .qb-head { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; }
  .qb-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-xl); line-height: var(--v-lh-xl); min-width: 0; }
  .qb-sub { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); font-variant-numeric: tabular-nums; }
  .qb-card { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .qb-h { margin: 0; display: flex; align-items: center; gap: var(--v-space-2); font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .qb-h-n { font-size: var(--v-text-sm); color: var(--v-text-3); font-variant-numeric: tabular-nums; }
  .qb-hint { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .qb-who-now { display: flex; flex-direction: column; gap: 0; min-width: 0; }
  .qb-who-name { font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .qb-who-new, .qb-add-custom { align-self: flex-start; }
  .qb-list, .qb-line-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--v-space-2); }
  .qb-groups { display: flex; flex-wrap: wrap; gap: var(--v-space-2); }
  .qb-group-sec { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .qb-group-h { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-semibold); color: var(--v-text-3); }
  .qb-row .v-lrow-title { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .qb-row-p { font-variant-numeric: tabular-nums; color: var(--v-text); font-weight: var(--v-weight-semibold); }
  .qb-line { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-3); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); background: var(--v-surface-2); }
  .qb-line.is-free { border-style: dashed; }
  .qb-line-top { display: flex; align-items: flex-start; gap: var(--v-space-2); min-width: 0; }
  .qb-line-label { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
  .qb-line-total { flex: 0 0 auto; font-variant-numeric: tabular-nums; font-weight: var(--v-weight-semibold); color: var(--v-text); line-height: var(--v-lh-md); padding-top: var(--v-space-2); }
  .qb-line-ctl { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--v-space-3); }
  .qb-qty { display: flex; flex-direction: column; gap: var(--v-space-1); flex: 0 0 auto; }
  .qb-qty-row { display: flex; align-items: center; gap: var(--v-space-1); }
  .qb-line .qb-qty-n { width: 60px; flex: 0 0 60px; }
  .qb-line .qb-qty-n input { text-align: center; padding-left: 0; padding-right: 0; }
  .qb-line .qb-price { width: auto; flex: 1 1 104px; min-width: 104px; max-width: 168px; }
  .qb-line-end { display: flex; align-items: center; gap: var(--v-space-2); margin-left: auto; min-height: 44px; }
  .qb-free { min-height: 44px; }
  @media (min-width: 768px) { .qb-line-end { padding-top: calc(var(--v-lh-xs) + var(--v-space-1)); } }
  .qb-supplier { align-self: flex-start; }
  .qb-figs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--v-space-3); }
  .qb-fig-l { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-semibold); color: var(--v-text-3); }
  .qb-big { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); font-variant-numeric: tabular-nums; color: var(--v-text); }
  .qb-mid { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-variant-numeric: tabular-nums; color: var(--v-text); }
  .qb-check { display: flex; flex-wrap: wrap; align-items: center; gap: var(--v-space-2); padding: var(--v-space-3); border-radius: var(--v-radius-md); background: var(--v-surface-3); }
  .qb-check-t { margin: 0; flex: 1 1 200px; color: var(--v-text); }
  .qb-mine { display: flex; flex-direction: column; gap: var(--v-space-3); padding: var(--v-space-3); border: 1px dashed var(--v-border-2); border-radius: var(--v-radius-md); }
  .qb-only { margin: 0; display: flex; align-items: center; gap: var(--v-space-1); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-semibold); color: var(--v-text-3); }
  .qb-marks, .qb-more { display: flex; flex-wrap: wrap; gap: var(--v-space-2); }
  .qb-custom-nums > * { flex: 1 1 0; min-width: 0; }
  .qb-custom-more { align-self: flex-start; }
`;
