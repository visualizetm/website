import { useMemo } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import { Row, Stack, Grid, Card, Button, IconButton, Pill, InlineEdit, Select, Checkbox, Toggle } from '../../ui';
import { PACKAGES, RETAINERS, ADDONS, priceOption, planLine, defaultRetainer, money } from '../../shared/pricing';
import { COPY } from '../../shared/copy';
import EmptyLine from './EmptyLine';

/* Pricing: up to three options built from the packages, as they were. */
const uid = () => Math.random().toString(36).slice(2, 10);
const optionsOf = (lead) => (lead.pricingOptions || []).map(o => (o.packageId ? o : { id: o.id || uid(), packageId: '', addonIds: [], retainerId: '', recommended: false, note: [o.label, o.price ? money(o.price) : '', o.retainer, o.notes].filter(Boolean).join(', ') }));

export const pricingSummary = (rec) => { const n = optionsOf(rec.lead); return n.length ? `${n.length} option${n.length === 1 ? '' : 's'}${n.some(o => o.recommended) ? ', one recommended' : ''}` : 'None yet'; };

export default function PricingSection({ rec }) {
  const { lead, readOnly, patch } = rec;
  const options = useMemo(() => optionsOf(lead), [lead]);
  const writeOptions = (next) => patch({ pricingOptions: next.slice(0, 3).map(o => { const p = priceOption(o); return { ...o, label: p.pkg?.label || o.label || '', price: p.total, plan: p.plan ? (p.plan.months === 12 ? '12mo' : '6mo') : 'full', retainer: p.retainer ? `${p.retainer.label} ${money(p.retainer.price)}/mo` : '', notes: o.note || '' }; }) });
  const setOpt = (id, next) => writeOptions(options.map(o => (o.id === id ? { ...o, ...next, ...(next.packageId && !o.retainerId ? { retainerId: defaultRetainer(next.packageId) } : {}) } : next.recommended ? { ...o, recommended: false } : o)));
  const add = () => writeOptions([...options, { id: uid(), packageId: PACKAGES[2].id, addonIds: [], retainerId: defaultRetainer(PACKAGES[2].id), recommended: !options.length, note: '' }]);
  const E = COPY.empty['leads.detail.pricing'];
  if (!options.length) return <EmptyLine text={E.title} action={!readOnly ? { label: E.action, icon: Plus, onClick: add, className: 'dt-addopt' } : null} />;
  return (
    <div className="rc-pricing">
      {options.length < 3 && !readOnly && <Row gap={2} justify="end"><Button variant="ghost" size="md" icon={Plus} onClick={add} className="dt-addopt">Add option</Button></Row>}
      <Grid minColumnWidth={260} gap={3} className="dt-opts">
        {options.map((o, i) => { const p = priceOption(o); return (
          <Card key={o.id} level={2} className={`dt-opt${o.recommended ? ' is-rec' : ''}`} glow={o.recommended ? 'won' : undefined}>
            <Row gap={2} justify="between"><span className="rc-label">Option {i + 1}</span>{o.recommended && <Pill tone="won" label="Recommended" size="sm" icon="Star01" variant="solid" />}</Row>
            <Select label="Package" value={o.packageId} onChange={(e) => setOpt(o.id, { packageId: e.target.value })} options={PACKAGES.map(pk => ({ id: pk.id, label: `${pk.label} (${money(pk.price)})` }))} placeholder="Pick a package" disabled={readOnly} />
            {p.pkg && <ul className="pb-list">{p.included.map((x, j) => <li key={j}>{x}</li>)}</ul>}
            <div className="v-field"><span className="v-field-label">Add-ons</span><Stack gap={0}>{ADDONS.map(a => <Checkbox key={a.id} checked={(o.addonIds || []).includes(a.id)} onChange={(v) => setOpt(o.id, { addonIds: v ? [...(o.addonIds || []), a.id] : (o.addonIds || []).filter(x => x !== a.id) })} label={`${a.label} (${p.free.some(f => f.id === a.id) ? 'free' : money(a.price)})`} disabled={readOnly} />)}</Stack></div>
            <Select label="Retainer" value={o.retainerId || defaultRetainer(o.packageId)} onChange={(e) => setOpt(o.id, { retainerId: e.target.value })} options={RETAINERS.map(r => ({ id: r.id, label: `${r.label} (${money(r.price)} a month)` }))} disabled={readOnly} />
            <div className="dt-opt-total"><span className="dt-opt-n">{money(p.total)}</span>{p.plan && <span className="dt-opt-plan">{planLine(p.plan)}</span>}{p.free.length > 0 && <span className="dt-opt-gift">Free: {p.free.map(f => f.label).join(', ')}</span>}{p.retainer && <span className="dt-opt-ret">Retainer: {p.retainer.label}, {money(p.retainer.price)} a month</span>}</div>
            <InlineEdit value={o.note || ''} onSave={(v) => setOpt(o.id, { note: v })} placeholder="Add a note" label="Option note" multiline />
            <Row gap={2} justify="between"><Toggle size="sm" checked={!!o.recommended} onChange={(v) => setOpt(o.id, { recommended: v })} label="Recommended" disabled={readOnly} />{!readOnly && <IconButton icon={Trash01} label="Remove option" variant="danger" onClick={() => writeOptions(options.filter(x => x.id !== o.id))} />}</Row>
          </Card>); })}
      </Grid>
    </div>
  );
}
