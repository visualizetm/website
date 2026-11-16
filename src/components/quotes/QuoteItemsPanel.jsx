import { useEffect, useState } from 'react';
import { Card, Stack, Row, Button, Input, ListRow, Sheet, EmptyState, ErrorState, SkeletonBlock, useToast } from '../../ui';
import { COPY } from '../../shared/copy';
import { fmtMoney, QUOTE_CAPS, cents } from '../../lib/quote';

/* Settings, Quotes: the saved items (settings.quoteItems), what Rob keeps for the things he quotes again (yard signs, shirts, a
 * banner). An item is a name, his price for one, and for him only a cost and a supplier link. It is added to a quote as a custom
 * line with the price copied, never linked, so editing one here changes no quote. At most 100; pricing.js is never touched. */
const blank = { id: '', label: '', unit: '', cost: '', supplierUrl: '' };
const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const money = (n) => fmtMoney(n, !Number.isInteger(Number(n)));

export default function QuoteItemsPanel({ quotesApi }) {
  const toast = useToast();
  const items = quotesApi?.items || [];
  const [edit, setEdit] = useState(null); // an item, or { id: '' } for a new one
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (edit) setF({ id: edit.id || '', label: edit.label || '', unit: edit.unit ?? '', cost: edit.cost ?? '', supplierUrl: edit.supplierUrl || '' }); }, [edit]);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const badLink = !!String(f.supplierUrl).trim() && !/^https?:\/\/[^\s]+$/i.test(String(f.supplierUrl).trim());
  const write = async (next, done) => {
    setBusy(true);
    try { if (await quotesApi.ops.saveItems(next)) { setEdit(null); toast.success(done); } else toast.error(COPY.error.save); } finally { setBusy(false); }
  };
  const save = () => {
    const it = { id: f.id || newId(), label: String(f.label).trim().slice(0, QUOTE_CAPS.label), unit: cents(f.unit), ...(f.cost === '' ? {} : { cost: cents(f.cost) }), ...(String(f.supplierUrl).trim() ? { supplierUrl: String(f.supplierUrl).trim() } : {}) };
    write(f.id ? items.map(x => (x.id === f.id ? it : x)) : [it, ...items].slice(0, QUOTE_CAPS.savedItems), f.id ? 'Saved.' : `${it.label} saved.`);
  };
  const remove = () => write(items.filter(x => x.id !== f.id), 'Removed.');

  let body;
  if (quotesApi?.error && !items.length) body = <ErrorState title="Saved items did not load" description="Nothing was lost. Try again." onRetry={quotesApi.reload} />;
  else if (quotesApi?.loading) body = <Stack gap={2} aria-busy="true" aria-hidden="true">{[0, 1, 2].map(i => <SkeletonBlock key={i} height={66} radius="var(--v-radius-md)" />)}</Stack>;
  else if (!items.length) body = <EmptyState icon="Receipt" size="sm" title="No saved items yet" description="Save a line as an item from its menu on a quote, or add one here." action={{ label: 'Add an item', icon: 'Plus', onClick: () => setEdit({ id: '' }) }} />;
  else body = (
    <ul className="qi-rows" data-v-enter>
      {items.map(it => <li key={it.id}><ListRow title={it.label} subtitle={[`${money(it.unit)} each`, it.cost !== undefined ? `costs ${money(it.cost)}` : '', it.supplierUrl ? 'supplier saved' : ''].filter(Boolean).join(' · ')} onClick={() => setEdit(it)} className="qi-row" data-item={it.id} /></li>)}
    </ul>
  );
  return (
    <Stack gap={3} className="st-stack qi-panel">
      <Card className="st-card">
        <Row gap={2} justify="between" align="center" wrap>
          <div style={{ minWidth: 0 }}><p className="pb-card-h" style={{ margin: 0 }}>Saved items{items.length ? `, ${items.length}` : ''}</p><p className="st-desc" style={{ margin: 0 }}>The things you quote again. A quote copies the price, so a change here changes no quote.</p></div>
          {items.length > 0 && <Button variant="secondary" icon="Plus" disabled={items.length >= QUOTE_CAPS.savedItems} onClick={() => setEdit({ id: '' })} className="qi-add">Add an item</Button>}
        </Row>
        {body}
      </Card>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={f.id ? 'Edit the item' : 'Add an item'} className="qi-sheet"
        footer={<Row gap={2} justify="between" wrap>{f.id ? <Button variant="ghost" icon="Trash01" disabled={busy} onClick={remove} className="qi-remove">Remove</Button> : <span />}<Row gap={2}><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} disabled={!String(f.label).trim() || badLink} onClick={save} className="qi-save">Save</Button></Row></Row>}>
        <Stack gap={3}>
          <Input label="Name" value={f.label} onChange={set('label')} maxLength={QUOTE_CAPS.label} required data-autofocus className="qi-name" />
          <Input label="Price each" type="number" inputMode="decimal" min={0} max={QUOTE_CAPS.unit} step="any" value={f.unit} onChange={set('unit')} className="qi-unit" />
          <Input label="Cost each" hint="Only you see this" type="number" inputMode="decimal" min={0} max={QUOTE_CAPS.unit} step="any" value={f.cost} onChange={set('cost')} className="qi-cost" />
          <Input label="Supplier link" hint="Only you see this" value={f.supplierUrl} onChange={set('supplierUrl')} inputMode="url" maxLength={400} placeholder="https://" error={badLink ? 'A link starts with http:// or https://' : undefined} className="qi-link" />
        </Stack>
      </Sheet>
      <style>{`
        .qi-rows { list-style: none; margin: var(--v-space-3) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--v-space-2); }
        .qi-rows[data-v-enter] > li { animation: v-enter var(--v-dur-enter) var(--v-ease-out) both; }
        @media (prefers-reduced-motion: reduce) { .qi-rows[data-v-enter] > li { animation: none; } }
      `}</style>
    </Stack>
  );
}
