import { useEffect, useMemo, useState } from 'react';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import {
  PageShell, ScrollArea, Section, Stack, Row, Grid, Card, Chip, Pill, Avatar, Input, Select, Button, IconButton, InlineEdit, Toggle, ListRow, Sheet, EmptyState, ErrorState, Stagger, IconTile, SkeletonBlock, RecordSkeleton, useDelayedLoading, useToast, useRetry,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar, useShell } from '../shell/ShellContext';
import LeadPicker from '../components/LeadPicker';
import { REVIEW_CHANNELS, REVIEW_RESULTS, normalizeStage } from '../shared/semantics';
import { fmtDate, fmtDateTime, relativeTime } from '../shared/dates';
import { matchesSearch } from '../lib/leads';
import { today } from '../lib/projects';
import { reviewsOf, asksOf, lastAsk, reviewDelta, REVIEW_FILTERS, reviewPasses, askTexts, releasedProject, reviewAskDue } from '../lib/reviews';

/* Reviews (Prompt 11): Google reviews per client, NFC cards, asks, and the
 * website review form submissions. */

const copyText = async (toast, text, what) => { try { await navigator.clipboard.writeText(text); toast.success(`${what} copied.`); } catch { toast.error(COPY.error.copy); } };
const channelLabel = (id) => REVIEW_CHANNELS.find(c => c.id === id)?.label || id;

export function ReviewCard({ lead, projects, onOpen, selected }) {
  const r = reviewsOf(lead);
  const d = reviewDelta(lead);
  const la = lastAsk(lead);
  const due = reviewAskDue(lead, projects);
  return (
    <Card as="div" padding={3} interactive onClick={onOpen} selected={selected} className="rv-card" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }} aria-label={`Open reviews for ${lead.business}`}>
      <Row gap={2} align="center"><Avatar name={lead.business} size="sm" /><span className="rv-card-name lay-truncate">{lead.business}</span>{r.nfcCard && <Pill tone="callback" label="NFC" size="sm" icon="CreditCard01" />}{due && <Pill tone="new" label="Ask due" size="sm" icon="Bell01" />}</Row>
      <Row gap={2} wrap align="center" className="rv-counts">
        {r.latest ? <><span className="rv-num">{r.latest.count} review{r.latest.count === 1 ? '' : 's'}, {Number(r.latest.rating).toFixed(1)}</span>{d && (d.count || d.rating) ? <Pill tone={d.count < 0 || d.rating < 0 ? 'danger' : 'booked'} label={`${d.count >= 0 ? '+' : ''}${d.count}, ${d.rating >= 0 ? '+' : ''}${d.rating.toFixed(1)} since ${fmtDate(r.baseline.at)}`} size="sm" icon={false} /> : r.baseline ? <span className="dt-muted">Baseline {r.baseline.count} at {Number(r.baseline.rating).toFixed(1)}</span> : null}</> : <span className="dt-muted">No counts yet</span>}
      </Row>
      <span className="dt-muted rv-last">{la ? `Last ask ${relativeTime(la.at)} by ${channelLabel(la.channel).toLowerCase()}, ${la.result}` : 'Never asked'}</span>
      {r.googleLink ? <Button variant="secondary" size="md" full icon="Star01" iconEnd="LinkExternal01" href={r.googleLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rv-glink">Open Google reviews</Button> : <span className="dt-muted">No Google link</span>}
    </Card>
  );
}
ReviewCard.Skeleton = function ReviewCardSkeleton() { return <Card padding={3} aria-busy="true"><Row gap={2}><SkeletonBlock width={32} height={32} radius="50%" /><SkeletonBlock width="50%" height={14} /></Row><SkeletonBlock width="60%" height={12} /><SkeletonBlock height={44} radius="var(--v-radius-md)" /></Card>; };

function ReviewSheet({ lead, projects, onPatch, onPatchRaw, onClose }) {
  const toast = useToast();
  const r = reviewsOf(lead);
  const [counts, setCounts] = useState({ count: r.latest?.count ?? '', rating: r.latest?.rating ?? '' });
  const [ask, setAsk] = useState({ channel: r.nfcCard ? 'nfc' : 'text', result: 'asked', note: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCounts({ count: r.latest?.count ?? '', rating: r.latest?.rating ?? '' }); }, [lead._id]); // eslint-disable-line react-hooks/exhaustive-deps
  const write = (next) => onPatch(lead._id, { reviews: { ...r, ...next } }); // toasts on failure
  const writeRaw = (next) => (onPatchRaw || onPatch)(lead._id, { reviews: { ...r, ...next } }); // InlineEdit toasts itself
  const saveCounts = async () => {
    const latest = { count: Math.max(0, Math.round(Number(counts.count)) || 0), rating: Math.max(0, Math.min(5, Number(counts.rating) || 0)), at: new Date().toISOString() };
    setBusy(true);
    await write({ latest, baseline: r.baseline || latest }); // the counts line is the confirmation
    setBusy(false);
  };
  const logAsk = async () => {
    setBusy(true);
    const ok = await write({ asks: [...asksOf(lead), { at: new Date().toISOString(), channel: ask.channel, result: ask.result, note: ask.note.trim() }] });
    setBusy(false);
    if (ok) { toast.success('Ask logged.'); setAsk(a => ({ ...a, note: '' })); }
  };
  const rp = releasedProject(lead, projects);
  return (
    <Sheet open onClose={onClose} title={lead.business} description={rp ? `${rp.name} released ${fmtDate(rp.releasedAt)}` : undefined} tall width={520} className="rv-sheet">
      <Stagger className="v-stack" style={{ gap: 'var(--v-space-4)' }}>
        <Card level={2} padding={3}>
          <div className="v-field"><span className="v-field-label">Google link</span><InlineEdit value={r.googleLink || ''} onSave={(v) => writeRaw({ googleLink: v.trim() })} placeholder="Paste the review link" label="Google review link" className="rv-link-edit" /></div>
          {r.googleLink && <Button variant="secondary" size="md" full icon="Star01" iconEnd="LinkExternal01" onClick={() => window.open(r.googleLink, '_blank', 'noopener')}>Open Google reviews</Button>}
          <Toggle label="NFC card" description={r.nfcCard ? `Given ${fmtDate(r.nfcGivenAt) || 'a while ago'}.` : 'Tap to record that they have the card.'} checked={!!r.nfcCard} onChange={(v) => write({ nfcCard: v, nfcGivenAt: v ? (r.nfcGivenAt || today()) : r.nfcGivenAt })} className="rv-nfc" />
          {r.nfcCard && <Grid minColumnWidth={140} gap={2}><Input label="Given on" type="date" value={(r.nfcGivenAt || '').slice(0, 10)} onChange={(e) => write({ nfcGivenAt: e.target.value })} /></Grid>}
        </Card>
        <Card level={2} padding={3}>
          <p className="pb-card-h">Counts</p>
          {r.baseline && <p className="dt-muted">Baseline {r.baseline.count} at {Number(r.baseline.rating).toFixed(1)}, {fmtDate(r.baseline.at)}.{r.latest ? ` Latest ${r.latest.count} at ${Number(r.latest.rating).toFixed(1)}, ${fmtDate(r.latest.at)}.` : ''}</p>}
          <Grid minColumnWidth={120} gap={2}><Input label="Reviews" type="number" inputMode="numeric" min={0} value={counts.count} onChange={(e) => setCounts(c => ({ ...c, count: e.target.value }))} /><Input label="Rating" type="number" inputMode="decimal" min={0} max={5} step="0.1" value={counts.rating} onChange={(e) => setCounts(c => ({ ...c, rating: e.target.value }))} /></Grid>
          <Row gap={2} justify="end"><Button size="md" icon={Check} loading={busy} onClick={saveCounts} className="rv-save-counts">{r.baseline ? 'Update counts' : 'Set baseline'}</Button></Row>
        </Card>
        <Card level={2} padding={3}>
          <p className="pb-card-h">Log an ask</p>
          <Grid minColumnWidth={140} gap={2}><Select label="Channel" value={ask.channel} onChange={(e) => setAsk(a => ({ ...a, channel: e.target.value }))} options={REVIEW_CHANNELS.map(c => ({ id: c.id, label: c.label }))} /><Select label="Result" value={ask.result} onChange={(e) => setAsk(a => ({ ...a, result: e.target.value }))} options={REVIEW_RESULTS.map(c => ({ id: c.id, label: c.label }))} /></Grid>
          <Input label="Note (optional)" value={ask.note} onChange={(e) => setAsk(a => ({ ...a, note: e.target.value }))} placeholder="Handed the card at pickup" />
          <Row gap={2} justify="end"><Button size="md" icon="Send01" loading={busy} onClick={logAsk} className="rv-log-ask">Log ask</Button></Row>
          {asksOf(lead).length > 0 && <ul className="cw-rev-log">{asksOf(lead).slice(-5).reverse().map((a, i) => <li key={i}><span className="cw-rev-when">{fmtDateTime(a.at)}</span><Pill id={a.result} list={REVIEW_RESULTS} size="sm" /><span className="cw-rev-note">{channelLabel(a.channel)}{a.note ? `, ${a.note}` : ''}</span></li>)}</ul>}
        </Card>
        <Card level={2} padding={3}>
          <p className="pb-card-h">Ask text</p>
          {askTexts(lead).map(t => <div key={t.id} className="rv-text"><p className="rv-text-body">{t.text}</p><Button variant="secondary" size="md" icon={Copy01} onClick={() => copyText(toast, t.text, t.label)} className="rv-copy">Copy {t.label.toLowerCase()}</Button></div>)}
          {!r.googleLink && <p className="dt-muted">Add the Google link above and it is appended to both texts.</p>}
        </Card>
      </Stagger>
    </Sheet>
  );
}

export default function AdminReviews({ leads = [], projects = [], submissions = [], loading, error, onRetry, onPatch, onPatchSubmission, openId }) {
  const toast = useToast();
  const shell = useShell();
  const [retry, retrying] = useRetry(onRetry);
  const E = (k) => COPY.empty[k];
  const patch = async (id, set) => { const ok = await onPatch(id, set); if (!ok) toast.error(COPY.error.save); return ok; };
  const [selId, setSelId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [linkSub, setLinkSub] = useState(null);
  const showSkel = useDelayedLoading(loading);
  const pending = loading && !showSkel;
  const now = Date.now();
  useTopBar(null);
  useEffect(() => { if (openId?.id) setSelId(openId.id); }, [openId]);
  const pendingOpen = !!openId?.id && loading;

  const clients = useMemo(() => leads.filter(l => normalizeStage(l) === 'client').sort((a, b) => (reviewAskDue(b, projects, now) ? 1 : 0) - (reviewAskDue(a, projects, now) ? 1 : 0) || String(a.business).localeCompare(String(b.business))), [leads, projects, now]);
  const counts = useMemo(() => Object.fromEntries(REVIEW_FILTERS.map(([id]) => [id, clients.filter(l => reviewPasses(l, projects, id, now)).length])), [clients, projects, now]);
  const list = useMemo(() => clients.filter(l => reviewPasses(l, projects, filter, now) && (!q.trim() || matchesSearch(l, q))), [clients, projects, filter, q, now]);
  const sel = selId ? leads.find(l => String(l._id) === String(selId)) : null;
  const forms = useMemo(() => submissions.filter(s => s.type === 'review' && !s.deleted), [submissions]);
  const left = clients.reduce((n, l) => n + asksOf(l).filter(a => a.result === 'left').length, 0);
  const summary = `${clients.length} client${clients.length === 1 ? '' : 's'}, ${counts.nfc} with the NFC card, ${left} review${left === 1 ? '' : 's'} logged as left`;
  const linkForm = async (sub, lead) => {
    setLinkSub(null);
    const ok1 = await onPatchSubmission?.(sub._id, { linkedLeadId: String(lead._id) });
    const r = reviewsOf(lead);
    const ok2 = await onPatch(lead._id, { reviews: { ...r, asks: [...asksOf(lead), { at: sub.createdAt ? new Date(sub.createdAt).toISOString() : new Date().toISOString(), channel: 'email', result: 'left', note: `Website review form${sub.fields?.rating ? `, ${sub.fields.rating} stars` : ''}` }] } });
    if (ok1 !== false && ok2) toast.success(`Linked to ${lead.business} and logged as left.`); else toast.error(COPY.error.save);
  };

  return (
    <PageShell className="aa-main aa-main--wide cl-shell rv-shell">
      <ScrollArea wide className="cl-page">
        <Section title="Reviews" loading={loading} description={loading ? undefined : summary}>
          <Stack gap={2}>
            <Input className="cl-search" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label="Search clients" trailing={q ? <button type="button" className="cl-clear" onClick={() => setQ('')} aria-label="Clear search"><XClose width={14} height={14} /></button> : undefined} />
            <Row gap={2} wrap className="rv-chips">{REVIEW_FILTERS.map(([id, label]) => <Chip key={id} label={label} count={counts[id]} selected={filter === id} onClick={() => setFilter(id)} />)}</Row>
          </Stack>
        </Section>
        {pending ? null : showSkel ? (
          <Grid minColumnWidth={260} gap={3} aria-busy="true">{[1, 2, 3].map(i => <ReviewCard.Skeleton key={i} />)}</Grid>
        ) : error && !leads.length ? (
          <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>
        ) : !clients.length ? (
          <Card><EmptyState icon="Star01" title={E('reviews.none').title} description={E('reviews.none').description} action={{ label: E('reviews.none').action, onClick: () => shell?.go('clients') }} /></Card>
        ) : !list.length ? (
          <Card><EmptyState size="sm" icon="SearchMd" title={E('reviews.filter').title} description={E('reviews.filter').description} action={{ label: E('reviews.filter').action, onClick: () => { setFilter('all'); setQ(''); } }} /></Card>
        ) : (
          <Stagger className="rv-grid">{list.map(l => <ReviewCard key={l._id} lead={l} projects={projects} onOpen={() => setSelId(l._id)} selected={sel && String(sel._id) === String(l._id)} />)}</Stagger>
        )}
        {!loading && (
          <Section title="Form submissions" description={forms.length ? `${forms.length} from the website review form` : undefined}>
            {!forms.length && <Card><EmptyState size="sm" icon="Inbox01" title={E('reviews.forms').title} description={E('reviews.forms').description} /></Card>}
            {forms.length > 0 && <Stack gap={2}>{forms.map(s => { const linked = s.linkedLeadId ? leads.find(l => String(l._id) === String(s.linkedLeadId)) : null; return <ListRow key={s._id} leading={<IconTile icon="Star01" tone="won" size="sm" glow={false} />} title={`${s.business || s.name}${s.fields?.rating ? `, ${s.fields.rating} stars` : ''}`} subtitle={s.fields?.text || s.name} meta={fmtDate(s.createdAt)} trailing={linked ? <Pill tone="booked" label={linked.business} size="sm" icon={false} /> : <Button variant="secondary" size="md" onClick={() => setLinkSub(s)} className="rv-link-form">Link to client</Button>} chevron={false} className="rv-form-row" />; })}</Stack>}
          </Section>
        )}
      </ScrollArea>
      {pendingOpen && !sel && <Sheet open onClose={() => setSelId(null)} title={<SkeletonBlock width={140} height={22} />} tall width={520} className="rv-sheet">{showSkel && <RecordSkeleton cards={3} header={false} heights={[300, 220, 350]} />}</Sheet>}
      {sel && <ReviewSheet lead={sel} projects={projects} onPatch={patch} onPatchRaw={onPatch} onClose={() => setSelId(null)} />}
      {linkSub && <LeadPicker leads={leads} title="Link to client" description={`${linkSub.business || linkSub.name}: logs an ask with result left.`} filter={(l) => normalizeStage(l) === 'client'} onClose={() => setLinkSub(null)} onPick={(l) => linkForm(linkSub, l)} />}
      <style>{rvStyles}</style>
    </PageShell>
  );
}

const rvStyles = `
  .rv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--v-space-3); min-width: 0; }
  .rv-grid > .v-stagger-item { display: contents; }
  .rv-card { gap: var(--v-space-2); text-align: left; align-items: stretch; }
  .rv-card-name { flex: 1; min-width: 0; font-weight: var(--v-weight-bold); color: var(--v-text); }
  .rv-num { font-size: var(--v-text-md); font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; }
  .rv-form-row .v-lrow-sub { white-space: normal; }
  .rv-text { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-3); background: var(--v-surface-3); border-radius: var(--v-radius-md); }
  .rv-text-body { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  .rv-link-edit .v-inline-text { overflow-wrap: anywhere; }
`;
