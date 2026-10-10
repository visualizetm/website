import { useEffect, useMemo, useRef, useState } from 'react';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import {
  PageShell, ScrollArea, Section, Stack, Row, Grid, Card, Chip, Pill, Avatar, Input, Select, Button, InlineEdit, Toggle, ListRow, Sheet, EmptyState, NoResults, ErrorState, Stagger, IconTile, SkeletonBlock, RecordSkeleton, useDelayedLoading, useToast, useRetry,
  QrCode, useConfirm,
} from '../ui';
import { COPY } from '../shared/copy';
import ListSearch, { matchLine } from '../components/ListSearch';
import { useTopBar, useShell } from '../shell/ShellContext';
import { useSelection, useScreenOrigin, useRestore } from '../shell/nav-history';
import LeadPicker from '../components/LeadPicker';
import { REVIEW_CHANNELS, REVIEW_RESULTS, normalizeStage } from '../shared/semantics';
import { fmtDate, fmtDateTime, relativeTime } from '../shared/dates';
import { matchesSearch } from '../lib/leads';
import { today } from '../lib/projects';
import { reviewsOf, asksOf, lastAsk, reviewDelta, REVIEW_FILTERS, reviewPasses, askTexts, releasedProject, reviewAskDue, reviewUrl, visualizeOf, generateLinkPatch, markSentPatch, reviewMessage, submissionsOf, testimonialPatch } from '../lib/reviews';
import { projectsOf, deliveryStepsAfter } from '../lib/projects';
import { canApprove, quoteOf, REVIEW_PULL_MAX } from '../lib/reviewPublic';

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
    <Card as="div" padding={3} interactive selected={selected} className="rv-card" data-row-id={lead._id}>
      <button type="button" className="v-stretch" onClick={onOpen} aria-label={`Open reviews for ${lead.business}`}>{`Open reviews for ${lead.business}`}</button>
      <Row gap={2} align="center"><Avatar name={lead.business} size="sm" /><span className="rv-card-name lay-truncate">{lead.business}</span>{r.nfcCard && <Pill tone="callback" label="NFC" size="sm" icon="CreditCard01" />}{due && <Pill tone="new" label="Ask due" size="sm" icon="Bell01" />}</Row>
      <Row gap={2} wrap align="center" className="rv-counts">
        {r.latest ? <><span className="rv-num">{r.latest.count} review{r.latest.count === 1 ? '' : 's'}, {Number(r.latest.rating).toFixed(1)}</span>{d && (d.count || d.rating) ? <Pill tone={d.count < 0 || d.rating < 0 ? 'danger' : 'booked'} label={`${d.count >= 0 ? '+' : ''}${d.count}, ${d.rating >= 0 ? '+' : ''}${d.rating.toFixed(1)} since ${fmtDate(r.baseline.at)}`} size="sm" icon={false} /> : r.baseline ? <span className="dt-muted">Baseline {r.baseline.count} at {Number(r.baseline.rating).toFixed(1)}</span> : null}</> : <span className="dt-muted">No counts yet</span>}
      </Row>
      <span className="dt-muted rv-last">{la ? `Last ask ${relativeTime(la.at)} by ${channelLabel(la.channel).toLowerCase()}, ${la.result}` : 'Never asked'}</span>
      {r.googleLink ? <Button variant="secondary" size="md" full icon="Star01" iconEnd="LinkExternal01" href={r.googleLink} target="_blank" rel="noopener noreferrer" className="v-above rv-glink" onClick={(e) => e.stopPropagation()}>Open Google reviews</Button> : <span className="dt-muted">No Google link</span>}
    </Card>
  );
}
ReviewCard.Skeleton = function ReviewCardSkeleton() { return <Card padding={3} aria-busy="true" className="rv-skel"><Row gap={2}><SkeletonBlock width={32} height={32} radius="50%" /><SkeletonBlock width="50%" height={14} /></Row><SkeletonBlock width="60%" height={12} /><SkeletonBlock height={44} radius="var(--v-radius-md)" /></Card>; };


/* ── Review Visualize (review links job) ───────────────────────────
 * The link for this client to review me: minted on the server when the
 * button is pressed (src/lib/reviews.js generateLinkPatch), shown with
 * Copy, a QR to print, Open and Regenerate behind a confirm (the old link
 * dies). The message is in my voice; Share uses the phone's sheet. Marking
 * it sent stamps the link and ticks the newest project's review step. */
const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
function ReviewVisualizeCard({ lead, projects, onPatch, onPatchProject, preset }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState(false);
  const v = visualizeOf(lead);
  const url = reviewUrl(lead);
  const subs = submissionsOf(lead);
  const message = reviewMessage(lead);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const generate = async (regenerate = false) => {
    setBusy(true);
    const ok = await onPatch(lead._id, generateLinkPatch(lead, regenerate));
    setBusy(false);
    if (ok) toast.success(regenerate ? 'New link made. The old one is dead.' : 'Review link ready.');
    return ok;
  };
  /* The delivery hook: opened from a project's Send review link step with the link still missing. Once per request. */
  const did = useRef(0);
  useEffect(() => {
    const p = preset?.preset;
    if (!p?.generate || String(p.leadId) !== String(lead._id) || did.current === preset.n || v?.token) return;
    did.current = preset.n;
    generate(false);
  }, [preset, lead._id, v?.token]); // eslint-disable-line react-hooks/exhaustive-deps
  const regenerate = async () => {
    if (!(await confirm({ title: 'Make a new link?', body: 'The old link and the old QR stop working the moment the new one exists. Anyone who still has them sees the expired page.', danger: true, confirmLabel: 'Regenerate' }))) return;
    await generate(true);
  };
  const share = async () => { try { await navigator.share({ text: message }); } catch { /* cancelled */ } };
  const markSent = async () => {
    setBusy(true);
    const ok = await onPatch(lead._id, markSentPatch(lead));
    const latest = projectsOf(projects, lead._id)[0];
    if (ok && latest && onPatchProject) {
      const d = { driveShared: false, emailSent: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '', ...(latest.delivery || {}) };
      await onPatchProject(latest._id, { delivery: { ...d, reviewLinkSent: true, steps: deliveryStepsAfter(d, 'reviewLinkSent', true) } });
    }
    setBusy(false);
    if (ok) toast.success(latest ? `Marked sent, and ticked on ${latest.name}.` : 'Marked sent.');
  };
  if (!url) {
    return (
      <Card level={2} padding={3} className="rv-vz" data-card="review-visualize">
        <EmptyState size="sm" icon="Star01" title={COPY.empty['reviews.visualize'].title} description={COPY.empty['reviews.visualize'].description} action={{ label: COPY.empty['reviews.visualize'].action, onClick: () => generate(false), loading: busy }} />
        {confirmDialog}
      </Card>
    );
  }
  return (
    <Card level={2} padding={3} className="rv-vz" data-card="review-visualize">
      <p className="pb-card-h">The link</p>
      <Row gap={2} align="center" wrap={false} className="rv-vz-link"><span className="rv-vz-url lay-truncate">{url}</span><Button variant="secondary" size="md" icon={Copy01} onClick={() => copyText(toast, url, 'Link')} className="rv-vz-copy" aria-label="Copy the review link">Copy</Button></Row>
      <Row gap={3} align="start" wrap className="rv-vz-body">
        <QrCode value={url} size={160} icon label={`QR code for ${lead.business}'s review link`} downloadName={`${lead.showcase?.slug || String(lead.business || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-review-qr`} />
        <Stack gap={2} className="rv-vz-side">
          <p className="dt-muted rv-vz-stats">{Number(v.views) || 0} view{Number(v.views) === 1 ? '' : 's'}, {subs.length} submission{subs.length === 1 ? '' : 's'}{v.lastViewedAt ? `, last opened ${relativeTime(v.lastViewedAt)}` : ''}.</p>
          {v.sentAt ? <Pill tone="booked" label={`Sent ${fmtDate(v.sentAt)}`} size="sm" icon={false} /> : <Pill tone="neutral" label="Not sent yet" size="sm" icon={false} />}
          <Row gap={2} wrap>
            <Button variant="secondary" size="md" icon="LinkExternal01" href={url} target="_blank" rel="noopener noreferrer" className="rv-vz-open">Open</Button>
            <Button variant="ghost" size="md" icon="RefreshCw01" onClick={regenerate} loading={busy} className="rv-vz-regen">Regenerate</Button>
          </Row>
        </Stack>
      </Row>
      <p className="pb-card-h">Send it</p>
      <div className="rv-text"><p className="rv-text-body">{message}</p>
        <Row gap={2} wrap>
          <Button variant="secondary" size="md" icon={Copy01} onClick={() => copyText(toast, message, 'Message')} className="rv-vz-copy-msg">Copy</Button>
          {canShare && <Button variant="secondary" size="md" icon="Share01" onClick={share} className="rv-vz-share">Share</Button>}
          <Button size="md" icon={Check} onClick={markSent} loading={busy} className="rv-vz-sent">{v.sentAt ? 'Sent again' : 'Mark as sent'}</Button>
        </Row>
      </div>
      {confirmDialog}
    </Card>
  );
}

/* What came back through the link: pending first. The text is never edited;
 * the pull quote is the one line Rob writes for the card. Approve needs
 * consent (the server refuses it too); Hide takes it off the site; Feature
 * puts an approved one on the landing. */
function SubmissionsCard({ lead, onPatch, onPatchRaw }) {
  const toast = useToast();
  const subs = submissionsOf(lead);
  const write = async (id, set, said) => { const ok = await onPatch(lead._id, testimonialPatch(lead, id, set)); if (ok && said) toast.success(said); return ok; };
  const tone = (st) => (st === 'approved' ? 'booked' : st === 'hidden' ? 'neutral' : 'new');
  return (
    <Card level={2} padding={3} className="rv-subs" data-card="review-submissions">
      <p className="pb-card-h">What they said</p>
      {!subs.length ? <EmptyState size="sm" icon="Inbox01" title={COPY.empty['reviews.submissions'].title} description={COPY.empty['reviews.submissions'].description} /> : (
        <Stack gap={2}>
          {subs.map(t => (
            <Card key={t.id} level={3} padding={3} className="rv-sub" data-status={t.status}>
              <Row gap={2} align="center" justify="between" wrap>
                <span className="rv-sub-who"><strong>{t.name || 'Someone'}</strong>{t.role ? `, ${t.role}` : ''}{t.business && t.business !== lead.business ? `, ${t.business}` : ''}</span>
                <Row gap={1} align="center"><span className="rv-stars" aria-label={`${t.rating} of 5 stars`}>{STARS(t.rating || 0)}</span><Pill tone={tone(t.status)} label={t.status === 'approved' ? 'Approved' : t.status === 'hidden' ? 'Hidden' : 'Pending'} size="sm" icon={false} /></Row>
              </Row>
              <p className="rv-sub-text">{t.text}</p>
              <p className="dt-muted">{t.createdAt ? fmtDateTime(t.createdAt) : ''}{t.consent ? ', ok to share on the site' : ', not to be shared: read it, never publish it'}</p>
              {t.status === 'approved' && (
                <div className="v-field"><span className="v-field-label">Pull quote, {REVIEW_PULL_MAX} characters at most</span><InlineEdit value={t.pullQuote || ''} onSave={(val) => (onPatchRaw || onPatch)(lead._id, testimonialPatch(lead, t.id, { pullQuote: String(val).trim().slice(0, REVIEW_PULL_MAX) }))} placeholder={quoteOf(t)} label="Pull quote" multiline className="rv-sub-pull" /></div>
              )}
              <Row gap={2} wrap className="rv-sub-acts">
                {t.status !== 'approved' && <Button size="md" variant="secondary" icon={Check} disabled={!canApprove(t)} title={canApprove(t) ? undefined : 'No consent to share, so it cannot be approved'} onClick={() => write(t.id, { status: 'approved', approvedAt: new Date().toISOString() }, 'Approved. It shows on their showcase.')} className="rv-sub-approve">Approve</Button>}
                {t.status !== 'hidden' && <Button size="md" variant="ghost" icon="EyeOff" onClick={() => write(t.id, { status: 'hidden', featured: false }, 'Hidden.')} className="rv-sub-hide">Hide</Button>}
                {t.status === 'approved' && <Button size="md" variant={t.featured ? 'primary' : 'ghost'} icon="Star01" onClick={() => write(t.id, { featured: !t.featured }, t.featured ? 'Off the landing.' : 'On the landing.')} className="rv-sub-feature" aria-pressed={!!t.featured}>{t.featured ? 'Featured' : 'Feature'}</Button>}
                {!canApprove(t) && t.status === 'pending' && <span className="dt-muted rv-sub-note">No consent to share.</span>}
              </Row>
            </Card>
          ))}
        </Stack>
      )}
    </Card>
  );
}

function ReviewSheet({ lead, projects, onPatch, onPatchRaw, onPatchProject, preset, onClose }) {
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
        <div className="rv-half" data-half="theirs"><p className="rv-half-h">Their reviews</p><p className="rv-half-sub">{lead.business}'s own Google reviews: the link, the NFC card, the counts and every ask.</p></div>
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
        <div className="rv-half" data-half="visualize"><p className="rv-half-h">Review Visualize</p><p className="rv-half-sub">A link for {lead.business} to review me. What comes back lands below, pending until I approve it.</p></div>
        <ReviewVisualizeCard lead={lead} projects={projects} onPatch={onPatch} onPatchProject={onPatchProject} preset={preset} />
        <SubmissionsCard lead={lead} onPatch={onPatch} onPatchRaw={onPatchRaw} />
      </Stagger>
    </Sheet>
  );
}

export default function AdminReviews({ leads = [], projects = [], submissions = [], loading, error, onRetry, onPatch, onPatchSubmission, onPatchProject, preset }) {
  const toast = useToast();
  const shell = useShell();
  const [retry, retrying] = useRetry(onRetry);
  const E = (k) => COPY.empty[k];
  const patch = async (id, set) => { const ok = await onPatch(id, set); if (!ok) toast.error(COPY.error.save); return ok; };
  /* Back (done once): the open client rides on the history entry. */
  const { selId, open: openSel, close } = useSelection('reviews');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [linkSub, setLinkSub] = useState(null);
  const showSkel = useDelayedLoading(loading);
  const pending = loading && !showSkel;
  const now = Date.now();
  useTopBar(null);
  useScreenOrigin(() => ({ filters: { filter, q }, selectedId: selId }));
  useRestore((o) => { if (o.filters) { if (o.filters.filter) setFilter(o.filters.filter); setQ(o.filters.q || ''); } });
  const pendingOpen = !!selId && loading;
  /* Review links: a project's Send review link step lands here with the client to open (the card mints the link). */
  const openedPreset = useRef(0);
  useEffect(() => { const id = preset?.preset?.leadId; if (!id || openedPreset.current === preset.n) return; openedPreset.current = preset.n; if (String(selId) !== String(id)) openSel(id, { replace: true }); }, [preset, selId, openSel]);

  const clients = useMemo(() => leads.filter(l => normalizeStage(l) === 'client').sort((a, b) => (reviewAskDue(b, projects, now) ? 1 : 0) - (reviewAskDue(a, projects, now) ? 1 : 0) || String(a.business).localeCompare(String(b.business))), [leads, projects, now]);
  const counts = useMemo(() => Object.fromEntries(REVIEW_FILTERS.map(([id]) => [id, clients.filter(l => reviewPasses(l, projects, id, now)).length])), [clients, projects, now]);
  const list = useMemo(() => clients.filter(l => reviewPasses(l, projects, filter, now) && (!q.trim() || matchesSearch(l, q))), [clients, projects, filter, q, now]);
  const sel = selId ? leads.find(l => String(l._id) === String(selId)) : null;
  const forms = useMemo(() => submissions.filter(s => s.type === 'review' && !s.deleted), [submissions]);
  /* Published showcase slug -> the client it belongs to, for matching a
     review that came in through /review/<slug>. Published only: an
     unpublished slug is not a link anyone could have followed. */
  const bySlug = useMemo(() => new Map(clients.filter(l => l.showcase?.published && l.showcase?.slug).map(l => [l.showcase.slug, l])), [clients]);
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
        <Section title="Reviews" loading={loading} description={loading ? undefined : (q.trim() || filter !== 'all') ? matchLine(clients.length, 'clients', list.length) : summary}>
          <Stack gap={2}>
            <ListSearch className="cl-search" placeholder="Search clients" value={q} onChange={setQ} label="Search clients" />
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
          <Card><NoResults noun="clients" query={q} filters={filter !== 'all' ? [(REVIEW_FILTERS.find(([id]) => id === filter) || [])[1]] : []} onClear={() => { setFilter('all'); setQ(''); }} /></Card>
        ) : (
          <Stagger className="rv-grid">{list.map(l => <ReviewCard key={l._id} lead={l} projects={projects} onOpen={() => openSel(l._id)} selected={sel && String(sel._id) === String(l._id)} />)}</Stagger>
        )}
        {!loading && (
          <Section title="Form submissions" description={forms.length ? `${forms.length} from the website review form` : undefined}>
            {!forms.length && <Card><EmptyState size="sm" icon="Inbox01" title={E('reviews.forms').title} description={E('reviews.forms').description} /></Card>}
            {forms.length > 0 && <Stack gap={2}>{forms.map(s => {
              const linked = s.linkedLeadId ? leads.find(l => String(l._id) === String(s.linkedLeadId)) : null;
              /* The review prompt: a review sent from /review/<slug> carries
                 that slug, so the client it belongs to is already known and
                 Link to client is one tap rather than a picker. */
              const match = !linked && s.fields?.slug ? bySlug.get(s.fields.slug) : null;
              return <ListRow key={s._id} leading={<IconTile icon="Star01" tone="won" size="sm" glow={false} />} title={`${s.business || s.name}${s.fields?.rating ? `, ${s.fields.rating} stars` : ''}`} subtitle={s.fields?.text || s.name} meta={fmtDate(s.createdAt)} trailing={linked ? <Pill tone="booked" label={linked.business} size="sm" icon={false} /> : match ? <Row gap={2} align="center" wrap><Pill tone="new" label={match.business} size="sm" icon="Link01" /><Button variant="secondary" size="md" onClick={() => linkForm(s, match)} className="rv-link-form">Link to {match.business}</Button></Row> : <Button variant="secondary" size="md" onClick={() => setLinkSub(s)} className="rv-link-form">Link to client</Button>} chevron={false} className="rv-form-row" />;
            })}</Stack>}
          </Section>
        )}
      </ScrollArea>
      {pendingOpen && !sel && <Sheet open onClose={close} title={<SkeletonBlock width={140} height={22} />} tall width={520} className="rv-sheet">{showSkel && <RecordSkeleton cards={3} header={false} heights={[300, 220, 350]} />}</Sheet>}
      {sel && <ReviewSheet lead={sel} projects={projects} onPatch={patch} onPatchRaw={onPatch} onPatchProject={onPatchProject} preset={preset} onClose={close} />}
      {linkSub && <LeadPicker leads={leads} title="Link to client" description={`${linkSub.business || linkSub.name}: logs an ask with result left.`} filter={(l) => normalizeStage(l) === 'client'} onClose={() => setLinkSub(null)} onPick={(l) => linkForm(linkSub, l)} />}
      <style>{rvStyles}</style>
    </PageShell>
  );
}

const rvStyles = `
  @media (max-width: 767px) { .rv-skel { min-height: 148px; } }
  .rv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--v-space-3); min-width: 0; }
  .rv-grid > .v-stagger-item { display: contents; }
  .rv-card { gap: var(--v-space-2); text-align: left; align-items: stretch; }
  .rv-card:has(> .v-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .rv-card .v-stretch:focus-visible { outline: 0; }
  .rv-card-name { flex: 1; min-width: 0; font-weight: var(--v-weight-bold); color: var(--v-text); }
  .rv-num { font-size: var(--v-text-md); font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; }
  .rv-form-row .v-lrow-sub { white-space: normal; }
  .rv-text { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-3); background: var(--v-surface-3); border-radius: var(--v-radius-md); }
  .rv-text-body { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  .rv-link-edit .v-inline-text { overflow-wrap: anywhere; }
  /* The two halves of a client's sheet (review links job): Their reviews, then Review Visualize. */
  .rv-half { display: flex; flex-direction: column; gap: 2px; padding-top: var(--v-space-2); }
  .rv-half-h { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); color: var(--v-text); text-transform: uppercase; letter-spacing: var(--v-ls-lg); }
  .rv-half-sub { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .rv-vz { gap: var(--v-space-3); }
  .rv-vz-link { min-width: 0; }
  .rv-vz-url { flex: 1; min-width: 0; font-size: var(--v-text-sm); color: var(--v-text-2); font-variant-numeric: tabular-nums; }
  .rv-vz-body { min-width: 0; }
  /* A basis of 160 (not 0): the side wraps under the QR when the two do not fit, as at 320. */
  .rv-vz-side { flex: 1 1 160px; min-width: 0; }
  .rv-vz-stats { margin: 0; }
  .rv-subs { gap: var(--v-space-3); }
  .rv-sub { gap: var(--v-space-2); }
  .rv-sub-who { font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
  .rv-stars { color: var(--v-status-callback-text); letter-spacing: 1px; font-size: var(--v-text-sm); }
  .rv-sub-text { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text); white-space: pre-wrap; overflow-wrap: anywhere; }
  .rv-sub-acts { align-items: center; }
`;
