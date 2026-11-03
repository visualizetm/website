import { useMemo, useState } from 'react';
import { Sheet, Stack, Row, Grid, Button, Chip, Input, Card, Checkbox } from '../../ui';
import { useToast } from '../../ui';
import { useShell } from '../../shell/ShellContext';
import { apiFetch } from '../../shared/api';
import { COPY } from '../../shared/copy';
import { PACKAGES, money } from '../../shared/pricing';
import { closerSet, CLOSER_LINES } from '../../shared/callScript';
import { dealOf } from '../../lib/deal';
import { suggestPackage, ladderFor, gapSentence, startSlotLine, retainerLine, lineFor, quoteFromLines, quoteOverride, depositInvoice } from '../../lib/quote';

/* The price presenter (prompt 2 of 3, milestone 4): a sheet over the lead. The gap builder (now, want, missing) renders the
 * diagnostic sentence and the suggested package from pricing.js; the ladder reads highest first (Build Plan, Launch Plan, the
 * fit package, Social Refresh, then "book a 30 minute brand review"); a real start slot line from Settings (two builds a month);
 * the retainer pitch line. Draft the quote email writes the quote on the deal and drafts the email (never sends); Make the
 * Stripe invoice adds the 50 percent deposit line to the deal's invoices and opens Compose on the invoice template, where the
 * existing per invoice Stripe link is made on send. Pick items opens the quote builder (/leads/:id/quote). No prepay discount. */
export default function PricePresenter({ open, lead, onClose, onPatch }) {
  const shell = useShell(); const toast = useToast();
  const closer = lead?.afterCall?.closer || {};
  const [gap, setGap] = useState(() => ({ now: closer.gap?.now || lead?.afterCall?.whatTheySaid || '', want: closer.gap?.want || closer.goal || lead?.afterCall?.goal || '', missing: closer.gap?.missing || '' }));
  const [pkgId, setPkgId] = useState(() => closer.gap?.packageId || suggestPackage(lead, gap));
  const [retainerPitch, setRetainerPitch] = useState(true);
  const [busy, setBusy] = useState('');
  const ladder = useMemo(() => ladderFor(pkgId), [pkgId]);
  const saveGap = (next) => onPatch(closerSet(lead, { gap: { ...next, packageId: pkgId } }, closer.step || 6));
  const setG = (k, v) => setGap(g => ({ ...g, [k]: v }));
  const quote = () => quoteFromLines([lineFor(pkgId)], { packageId: pkgId, retainerPitch });
  const saveQuote = async (q) => onPatch({ deal: { ...dealOf(lead), quote: q }, ...closerSet(lead, { gap: { ...gap, packageId: pkgId } }, closer.step || 6) });
  const draftQuote = async () => {
    setBusy('quote');
    try {
      const q = quote();
      if (await saveQuote(q) === false) return;
      const r = await apiFetch('/api/admin/email/send', { method: 'POST', body: { templateId: 'custom', recordId: String(lead._id), ...(lead.email ? { to: [lead.email] } : {}), override: quoteOverride(lead, q, { nextOpenStart: shell?.profile?.nextOpenStart }), reason: 'Quote from the price presenter' } });
      if (!r.ok) { toast.error(r.data?.error || COPY.error.save); return; }
      window.dispatchEvent(new CustomEvent('vz:drafts-changed'));
      onClose?.();
      if (r.data?.logId && shell?.openSendSheet) shell.openSendSheet({ _id: r.data.logId }); else toast.success('The quote is in Drafts.');
    } finally { setBusy(''); }
  };
  const makeInvoice = async () => {
    setBusy('invoice');
    try {
      const q = quote(); const inv = depositInvoice(q); const deal = dealOf(lead);
      const ok = await onPatch({ deal: { ...deal, quote: q, invoices: [...(deal.invoices || []), inv] }, ...closerSet(lead, { gap: { ...gap, packageId: pkgId } }, closer.step || 6) });
      if (ok === false) return;
      onClose?.();
      if (shell?.openCompose) shell.openCompose(lead, { templateId: 'invoice', invoice: inv }); else toast.success(`Deposit invoice ${money(inv.amount)} added. Send it from Money.`);
    } finally { setBusy(''); }
  };
  const pickItems = () => { onClose?.(); shell?.openQuote?.(lead, pkgId); };
  return (
    <Sheet open={open} onClose={onClose} title="Prices" description={lead.business} tall width={520} className="pp-sheet"
      footer={<><Button variant="ghost" onClick={onClose} disabled={!!busy}>Close</Button><Button variant="secondary" icon="CurrencyDollar" loading={busy === 'invoice'} disabled={!!busy} onClick={makeInvoice} className="pp-invoice">Make the Stripe invoice</Button><Button icon="Mail01" loading={busy === 'quote'} disabled={!!busy} onClick={draftQuote} className="pp-quote">Draft the quote email</Button></>}>
      <Stack gap={4}>
        <Card level={2} padding={3} className="pp-gap">
          <p className="pb-card-h">The gap</p>
          <Grid minColumnWidth={150} gap={2}>
            <Input label="Where they are" value={gap.now} onChange={(e) => setG('now', e.target.value)} onBlur={() => saveGap(gap)} placeholder="A Wix site from 2014" />
            <Input label="Where they want to be" value={gap.want} onChange={(e) => setG('want', e.target.value)} onBlur={() => saveGap(gap)} placeholder="Booked out three weeks ahead" />
            <Input label="What is missing" value={gap.missing} onChange={(e) => setG('missing', e.target.value)} onBlur={() => saveGap(gap)} placeholder="A site that works on a phone" />
          </Grid>
          <p className="cs-line pp-sentence">{gapSentence(gap, pkgId)}</p>
          <p className="cs-hint">The fit, from what is missing. Tap another to change it.</p>
          <Row gap={1} wrap>{PACKAGES.map(p => <Chip key={p.id} label={`${p.label} ${money(p.price)}`} selected={p.id === pkgId} onClick={() => setPkgId(p.id)} />)}</Row>
        </Card>
        <Card level={2} padding={3}>
          <p className="pb-card-h">Highest first</p>
          <ol className="pp-ladder">
            {ladder.map(r => <li key={r.id} className={`pp-rung${r.fit ? ' is-fit' : ''}`}><span className="pp-rung-label">{r.label}{r.price ? <strong> {money(r.price)}</strong> : null}</span><span className="pp-rung-line">{r.line}</span></li>)}
          </ol>
          <p className="cs-hint">Nobody leaves without a next step. Removing scope is the lever, never the price.</p>
        </Card>
        <Card level={2} padding={3}>
          <p className="pb-card-h">Say it</p>
          <p className="cs-line">{startSlotLine(shell?.profile?.nextOpenStart)}</p>
          <p className="cs-hint">{CLOSER_LINES.urgency.replace('{{date}}', 'date')}: set the next open start in Settings.</p>
          <Checkbox label="Pitch the retainer" checked={retainerPitch} onChange={(v) => setRetainerPitch(!!v)} />
          {retainerPitch && <p className="cs-line">{retainerLine(pkgId)}</p>}
        </Card>
        <Button variant="secondary" full icon="Rows01" onClick={pickItems} className="pp-pick">Pick items (build the quote)</Button>
      </Stack>
      <style>{pricePresenterStyles}</style>
    </Sheet>
  );
}

export const pricePresenterStyles = `
  .pp-gap { display: grid; gap: var(--v-space-3); }
  .pp-sentence { margin-top: var(--v-space-1); }
  .pp-ladder { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--v-space-2); counter-reset: rung; }
  .pp-rung { display: grid; gap: 2px; padding: var(--v-space-2) var(--v-space-3); border-radius: var(--v-radius-md); background: var(--v-surface-1); border: 1px solid var(--v-border); }
  .pp-rung.is-fit { border-color: var(--v-border-focus); }
  .pp-rung-label { font-weight: var(--v-weight-bold); }
  .pp-rung-line { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .cs-line { font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: var(--v-lh-lg); }
  .cs-hint { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
`;
