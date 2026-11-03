import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell, ScrollArea, Section, Stack, Row, Grid, Card, Button, IconButton, Chip, Input, Checkbox, EmptyState, ErrorState, SkeletonText, useToast } from '../ui';
import { useTopBar, useShell } from '../shell/ShellContext';
import { apiFetch } from '../shared/api';
import { COPY } from '../shared/copy';
import { PACKAGES, CATALOG, money } from '../shared/pricing';
import { dealOf } from '../lib/deal';
import { PRINT_IDS, PACKAGE_ITEMS, lineFor, addLine, removeLine, toggleFree, setPrice, quoteTotals, suggestPackageFor, quoteFromLines, quoteOverride, depositInvoice, validQuote, FREE_LINE, retainerLine } from '../lib/quote';

/* The quote builder (prompt 2 of 3, milestone 4): /leads/:id/quote, a sub screen of the record (Back goes to the record). The
 * service list from pricing.js (the packages, then the print and a la carte items, then the rest of the catalog), each line's
 * price editable with a Free toggle; the "given free" total with the script line; the package the lines add up to; the retainer
 * pitch on by default; the total, the deposit and the same two buttons as the presenter. The quote saves on the deal (deal.quote,
 * src/lib/quote.js builds and guards it: every price from pricing.js) and feeds the deposit invoice and the quote email. */
export default function AdminQuote({ lead, loading = false, error = false, onRetry, onPatch, onBack, pkgId = '' }) {
  const shell = useShell(); const toast = useToast();
  const saved = lead?.deal?.quote || null;
  const [lines, setLines] = useState(() => (saved?.lines?.length ? saved.lines : pkgId && lineFor(pkgId) ? [lineFor(pkgId)] : []));
  const [retainerPitch, setRetainerPitch] = useState(() => (saved ? saved.retainerPitch !== false : true));
  const [busy, setBusy] = useState('');
  const seeded = useRef(!!lead);
  useEffect(() => { if (!seeded.current && lead) { seeded.current = true; const q = lead.deal?.quote; if (q?.lines?.length) { setLines(q.lines); setRetainerPitch(q.retainerPitch !== false); } else if (pkgId && lineFor(pkgId)) setLines([lineFor(pkgId)]); } }, [lead, pkgId]);
  useTopBar({ title: lead?.business || 'Quote', back: onBack });
  const totals = useMemo(() => quoteTotals(lines), [lines]);
  const fit = useMemo(() => suggestPackageFor(lines), [lines]);
  const pkgLine = lines.find(l => l.kind === 'package');
  const quote = () => quoteFromLines(lines, { packageId: pkgLine?.id || fit?.id || '', retainerPitch });
  /* Autosave: 600ms after the last change, the whole quote on the deal. */
  const first = useRef(true);
  useEffect(() => {
    if (!lead || !onPatch) return undefined;
    if (first.current) { first.current = false; return undefined; }
    if (!validQuote(lines)) return undefined;
    const t = setTimeout(() => { onPatch(lead._id, { deal: { ...dealOf(lead), quote: quote() } }); }, 600);
    return () => clearTimeout(t);
  }, [lines, retainerPitch]); // eslint-disable-line react-hooks/exhaustive-deps
  const draftQuote = async () => {
    if (!validQuote(lines)) { toast.error('Add at least one line first.'); return; }
    setBusy('quote');
    try {
      const q = quote();
      if (!(await onPatch(lead._id, { deal: { ...dealOf(lead), quote: q } }))) { toast.error(COPY.error.save); return; }
      const r = await apiFetch('/api/admin/email/send', { method: 'POST', body: { templateId: 'custom', recordId: String(lead._id), ...(lead.email ? { to: [lead.email] } : {}), override: quoteOverride(lead, q, { nextOpenStart: shell?.profile?.nextOpenStart }), reason: 'Quote from the builder' } });
      if (!r.ok) { toast.error(r.data?.error || COPY.error.save); return; }
      window.dispatchEvent(new CustomEvent('vz:drafts-changed'));
      if (r.data?.logId && shell?.openSendSheet) shell.openSendSheet({ _id: r.data.logId }); else toast.success('The quote is in Drafts.');
    } finally { setBusy(''); }
  };
  const makeInvoice = async () => {
    if (!validQuote(lines)) { toast.error('Add at least one line first.'); return; }
    setBusy('invoice');
    try {
      const q = quote(); const inv = depositInvoice(q); const deal = dealOf(lead);
      if (!(await onPatch(lead._id, { deal: { ...deal, quote: q, invoices: [...(deal.invoices || []), inv] } }))) { toast.error(COPY.error.save); return; }
      if (shell?.openCompose) shell.openCompose(lead, { templateId: 'invoice', invoice: inv }); else toast.success(`Deposit invoice ${money(inv.amount)} added.`);
    } finally { setBusy(''); }
  };
  const has = (id) => lines.some(l => l.id === id);
  const rest = CATALOG.filter(c => !PRINT_IDS.includes(c.id));
  if (!lead && error) return <PageShell className="aa-main aa-main--wide"><ErrorState title={COPY.error.load} onRetry={onRetry} /></PageShell>;
  if (!lead && loading) return <PageShell className="aa-main aa-main--wide"><ScrollArea wide><div className="lay-content"><SkeletonText lines={6} /></div></ScrollArea></PageShell>;
  if (!lead) return <PageShell className="aa-main aa-main--wide"><EmptyState icon="Users01" title="No lead here" description="The link names a lead that is not loaded." action={onBack ? { label: 'Back', onClick: onBack } : undefined} /></PageShell>;
  return (
    <PageShell className="aa-main aa-main--wide qb-page">
      <ScrollArea wide>
        <Stack gap={4} className="lay-content">
          <Section title="Quote" description={`${lines.length} line${lines.length === 1 ? '' : 's'}, every price from the price list`} />
          <Card>
            <p className="pb-card-h">Start from a package</p>
            <Row gap={1} wrap>{PACKAGES.map(p => <Chip key={p.id} label={`${p.label} ${money(p.price)}`} selected={has(p.id)} onClick={() => setLines(ls => (has(p.id) ? removeLine(ls, p.id) : addLine(ls.filter(l => l.kind !== 'package'), p.id)))} />)}</Row>
            {pkgLine && <p className="cs-hint">{(PACKAGE_ITEMS[pkgLine.id] || []).map(id => CATALOG.find(c => c.id === id)?.label).filter(Boolean).join(', ')}.</p>}
          </Card>
          <Card>
            <p className="pb-card-h">Print and a la carte</p>
            <Row gap={1} wrap>{PRINT_IDS.map(id => CATALOG.find(c => c.id === id)).filter(Boolean).map(c => <Chip key={c.id} label={`${c.label} ${money(c.price)}`} selected={has(c.id)} onClick={() => setLines(ls => (has(c.id) ? removeLine(ls, c.id) : addLine(ls, c.id)))} />)}</Row>
            <p className="pb-card-h" style={{ marginTop: 'var(--v-space-3)' }}>Everything else</p>
            <Row gap={1} wrap>{rest.map(c => <Chip key={c.id} label={`${c.label} ${money(c.price)}`} selected={has(c.id)} onClick={() => setLines(ls => (has(c.id) ? removeLine(ls, c.id) : addLine(ls, c.id)))} />)}</Row>
          </Card>
          <Card className="qb-lines">
            <p className="pb-card-h">Lines</p>
            {lines.length === 0 ? <p className="cs-hint">Tap a package or an item above.</p> : (
              <Stack gap={2}>
                {lines.map(l => (
                  <Grid key={l.id} minColumnWidth={120} gap={2} className={`qb-line${l.free ? ' is-free' : ''}`} data-line={l.id}>
                    <span className="qb-line-label"><strong>{l.label}</strong><span className="cs-hint">List {money(l.listPrice)}</span></span>
                    <Input label="Price" type="number" min={0} step={5} value={l.free ? 0 : l.price} disabled={l.free} onChange={(e) => setLines(ls => setPrice(ls, l.id, e.target.value))} />
                    <Row gap={2} align="center">
                      <Checkbox label="Free" checked={!!l.free} onChange={() => setLines(ls => toggleFree(ls, l.id))} className="qb-free" />
                      <IconButton icon="Trash01" label={`Remove ${l.label}`} variant="ghost" onClick={() => setLines(ls => removeLine(ls, l.id))} />
                    </Row>
                  </Grid>
                ))}
              </Stack>
            )}
          </Card>
          <Card className="qb-totals">
            <Grid minColumnWidth={140} gap={3}>
              <div><span className="dt-fact-label">Total</span><p className="qb-big">{money(totals.total)}</p>{totals.plan && <p className="cs-hint">or {money(totals.plan.monthly)} a month for {totals.plan.months} months</p>}</div>
              <div><span className="dt-fact-label">Deposit</span><p className="qb-big">{money(totals.deposit)}</p><p className="cs-hint">locks the price and the start</p></div>
              <div><span className="dt-fact-label">Given free</span><p className="qb-big qb-free-total">{money(totals.givenFree)}</p>{totals.givenFree > 0 && <p className="cs-hint">{FREE_LINE}</p>}</div>
            </Grid>
            {fit && !pkgLine && <p className="cs-line qb-fit">These lines add up to {fit.label}, {money(fit.price)}. Say it as the package.</p>}
            <Checkbox label="Pitch the retainer" checked={retainerPitch} onChange={(v) => setRetainerPitch(!!v)} className="qb-retainer" />
            {retainerPitch && <p className="cs-hint">{retainerLine(pkgLine?.id || fit?.id || '')}</p>}
            <Row gap={2} wrap>
              <Button icon="Mail01" loading={busy === 'quote'} disabled={!!busy || !lines.length} onClick={draftQuote} className="qb-draft">Draft the quote email</Button>
              <Button variant="secondary" icon="CurrencyDollar" loading={busy === 'invoice'} disabled={!!busy || !lines.length} onClick={makeInvoice} className="qb-invoice">Make the Stripe invoice</Button>
            </Row>
          </Card>
        </Stack>
      </ScrollArea>
      <style>{quoteStyles}</style>
    </PageShell>
  );
}

const quoteStyles = `
  .qb-line { align-items: end; padding: var(--v-space-2) 0; border-bottom: 1px solid var(--v-border); }
  .qb-line:last-child { border-bottom: 0; }
  .qb-line.is-free .qb-line-label strong { text-decoration: line-through; color: var(--v-text-2); }
  .qb-line-label { display: grid; gap: 2px; }
  .qb-big { font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: 1.1; margin: 0; }
  .qb-totals { display: grid; gap: var(--v-space-3); }
  .cs-line { font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: var(--v-lh-lg); }
  .cs-hint { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
`;
