import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChevronUp from '@untitled-ui/icons-react/build/esm/ChevronUp';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Pill, Toggle, InlineEdit, ListRow, IconTile, Menu,
  EmptyState, ErrorState, Stagger, SkeletonBlock, useDelayedLoading, useMediaQuery, useToast, useRetry,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar } from '../shell/ShellContext';
import { apiFetch } from '../shared/api';
import { reviewsOf } from '../lib/reviews';

/* Landing (Site Prompt 2, Part 3): the admin controls for what the public
 * /api/showcase endpoint computes as "featured": the logo strip, featured
 * work, featured testimonials, and the four stat rows. Nothing here has its
 * own collection; it reads and writes into call_leads (showcase.featured,
 * reviews.testimonials) and one settings document (_id: 'landing').
 *
 * showcase.featured.order is ONE field per client, shared by the logo strip
 * and featured work lists (the schema has no second order field). A client
 * toggled into both lists uses the same position in both; reordering one
 * list can therefore move that client in the other too. Accepted, not
 * worked around, per the schema in api/_routes/call-leads.js. */

const MAX_FEATURED = 6;
const featuredOrder = (l) => Number(l.showcase?.featured?.order) || 0;
const byFeaturedOrder = (a, b) => featuredOrder(a) - featuredOrder(b);
const clientName = (l) => l.showcase?.displayName || l.business;
const hasLogo = (l) => !!(l.showcase?.brand?.logo?.dark || l.showcase?.brand?.logo?.light);
const logoSrc = (l) => l.showcase?.brand?.logo?.dark || l.showcase?.brand?.logo?.light || '';

function excerpt(s, max = 90) {
  const t = String(s || '').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}...` : t;
}

/* Live stat values, computed the same way api/showcase.js's computeStats()
 * does, from the leads and projects already loaded at the shell level. Kept
 * in step with that function on purpose so the number shown here next to an
 * override always matches what the toggle-on value would actually be, even
 * while a stat is toggled off (the public endpoint omits an off stat from
 * its payload entirely, so a second /api/showcase fetch could not show it). */
function computeLiveStats(leads, projects) {
  const clientsServed = leads.filter(l => l.stage === 'client').length;
  const projectsDelivered = projects.filter(p => p.stage === 'delivered').length;
  const published = leads.filter(l => l.showcase?.published);
  const sinceYears = published.map(l => l.clientSince && new Date(l.clientSince).getFullYear()).filter(y => Number.isFinite(y));
  const years = sinceYears.length ? Math.max(1, new Date().getFullYear() - Math.min(...sinceYears)) : 1;
  let sum = 0, n = 0;
  for (const l of leads) for (const t of (l.reviews?.testimonials || [])) { if (t.published && t.rating != null) { sum += Number(t.rating) || 0; n++; } }
  const averageRating = n ? Math.round((sum / n) * 10) / 10 : null;
  return { clientsServed, projectsDelivered, averageRating, years };
}

const mergeLanding = (s, partial) => ({
  stats: {
    toggles: { ...(s?.stats?.toggles || {}), ...(partial.stats?.toggles || {}) },
    overrides: { ...(s?.stats?.overrides || {}), ...(partial.stats?.overrides || {}) },
  },
});

/* Reorder mechanics shared by the logo strip and featured work lists (drag on
 * desktop, Move up/down everywhere), following the same draggable /
 * onDragStart / onDragOver / onDrop approach as LeadDetail's ListEditor. */
function useReorder(list, commit) {
  const dragRef = useRef(null);
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  const dragProps = (i, desktop) => (!desktop ? {} : {
    draggable: true,
    onDragStart: () => { dragRef.current = i; },
    onDragOver: (e) => e.preventDefault(),
    onDrop: () => {
      if (dragRef.current == null || dragRef.current === i) return;
      const next = [...list];
      const [x] = next.splice(dragRef.current, 1);
      next.splice(i, 0, x);
      dragRef.current = null;
      commit(next);
    },
  });
  return { move, dragProps };
}

function Thumb({ src, fallbackIcon = 'Image01' }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <IconTile icon={fallbackIcon} tone="neutral" size="sm" glow={false} />;
  return <img src={src} alt="" className="ld-thumb" width={40} height={40} loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

function rowTrailing({ name, published, cut, extraItems = [], onMoveUp, onMoveDown, atStart, atEnd, onOpen }) {
  return (
    <Row gap={1} align="center">
      {!published && <Pill tone="neutral" label="Unpublished" size="sm" icon={false} />}
      {cut && <Pill tone="new" label="Won't show" size="sm" icon={false} />}
      <Menu label={`${name} actions`} items={[
        { id: 'up', label: 'Move up', icon: ChevronUp, disabled: atStart, onSelect: onMoveUp },
        { id: 'down', label: 'Move down', icon: ChevronDown, disabled: atEnd, onSelect: onMoveDown },
        ...extraItems,
        ...(onOpen ? ['divider', { id: 'open', label: `Open ${name}`, icon: 'ArrowRight', onSelect: onOpen }] : []),
      ]} />
    </Row>
  );
}

/* ── Logo strip ────────────────────────────────────────────────── */
function LogoStripSection({ leads, desktop, onPatchLead, onOpenLead, toast }) {
  const list = useMemo(() => leads.filter(l => l.showcase?.featured?.logoStrip).sort(byFeaturedOrder), [leads]);
  const commit = useCallback(async (next) => {
    const ok = (await Promise.all(next.map((l, i) => (featuredOrder(l) === i ? true
      : onPatchLead(l._id, { showcase: { ...l.showcase, featured: { ...l.showcase.featured, order: i } } }))))).every(Boolean);
    if (!ok) toast.error(COPY.error.save);
  }, [onPatchLead, toast]);
  const { move, dragProps } = useReorder(list, commit);
  const missingLogo = list.filter(l => !hasLogo(l));
  const E = COPY.empty['landing.logostrip'];
  return (
    <Section title="Logo strip" description={`${list.length} client${list.length === 1 ? '' : 's'} on the site's logo strip`}>
      {!list.length ? (
        <Card><EmptyState size="sm" icon="Image01" title={E.title} description={E.description} /></Card>
      ) : (
        <Stack gap={2}>
          {list.map((l, i) => (
            <ListRow key={l._id} {...dragProps(i, desktop)}
              leading={<Thumb src={logoSrc(l)} />}
              title={clientName(l)}
              chevron={false}
              trailing={rowTrailing({
                name: clientName(l), published: !!l.showcase?.published, atStart: i === 0, atEnd: i === list.length - 1,
                onMoveUp: () => move(i, -1), onMoveDown: () => move(i, 1),
                onOpen: onOpenLead ? () => onOpenLead(l) : null,
              })}
            />
          ))}
        </Stack>
      )}
      {missingLogo.length > 0 && (
        <Card level={2} padding={3} className="ld-warn">
          <Row gap={2} align="start">
            <IconTile icon="AlertTriangle" tone="danger" size="sm" glow={false} />
            <Stack gap={1}>
              <p className="ld-warn-title">No logo uploaded, will not show correctly</p>
              <p className="dt-muted">{missingLogo.map(clientName).join(', ')}</p>
            </Stack>
          </Row>
        </Card>
      )}
    </Section>
  );
}

/* ── Featured work ─────────────────────────────────────────────── */
function FeaturedWorkSection({ leads, desktop, onPatchLead, onOpenLead, toast }) {
  const list = useMemo(() => leads.filter(l => l.showcase?.featured?.work).sort(byFeaturedOrder), [leads]);
  const commit = useCallback(async (next) => {
    const ok = (await Promise.all(next.map((l, i) => (featuredOrder(l) === i ? true
      : onPatchLead(l._id, { showcase: { ...l.showcase, featured: { ...l.showcase.featured, order: i } } }))))).every(Boolean);
    if (!ok) toast.error(COPY.error.save);
  }, [onPatchLead, toast]);
  const { move, dragProps } = useReorder(list, commit);
  const E = COPY.empty['landing.work'];
  return (
    <Section title="Featured work" description={`${list.length} client${list.length === 1 ? '' : 's'} featured, up to ${MAX_FEATURED} show on the site`}>
      <p className="dt-muted ld-note">When nothing is featured, the site shows the newest published clients instead.</p>
      {!list.length ? (
        <Card><EmptyState size="sm" icon="Image01" title={E.title} description={E.description} /></Card>
      ) : (
        <>
          {list.length > MAX_FEATURED && <p className="dt-muted">Only the first {MAX_FEATURED} by order show on the site.</p>}
          <Stack gap={2}>
            {list.map((l, i) => (
              <ListRow key={l._id} {...dragProps(i, desktop)}
                leading={<Thumb src={l.showcase?.cover} />}
                title={clientName(l)}
                subtitle={l.showcase?.type || l.industry || undefined}
                chevron={false}
                trailing={rowTrailing({
                  name: clientName(l), published: !!l.showcase?.published, cut: i >= MAX_FEATURED,
                  atStart: i === 0, atEnd: i === list.length - 1,
                  onMoveUp: () => move(i, -1), onMoveDown: () => move(i, 1),
                  onOpen: onOpenLead ? () => onOpenLead(l) : null,
                })}
              />
            ))}
          </Stack>
        </>
      )}
    </Section>
  );
}

/* ── Testimonials ──────────────────────────────────────────────── */
function TestimonialsSection({ leads, desktop, onPatchLead, onOpenLead, toast }) {
  const items = useMemo(() => {
    const out = [];
    for (const l of leads) for (const t of (l.reviews?.testimonials || [])) { if (t.published && t.featured) out.push({ lead: l, testimonial: t }); }
    return out.sort((a, b) => (Number(a.testimonial.order) || 0) - (Number(b.testimonial.order) || 0));
  }, [leads]);
  const commit = useCallback(async (next) => {
    const changesByLead = new Map();
    next.forEach((it, i) => {
      if ((Number(it.testimonial.order) || 0) === i) return;
      if (!changesByLead.has(it.lead._id)) changesByLead.set(it.lead._id, []);
      changesByLead.get(it.lead._id).push({ id: it.testimonial.id, order: i });
    });
    const results = await Promise.all([...changesByLead.entries()].map(([leadId, changes]) => {
      const lead = next.find(it => it.lead._id === leadId)?.lead;
      if (!lead) return true;
      const r = reviewsOf(lead);
      const nextT = (r.testimonials || []).map(t => { const c = changes.find(x => x.id === t.id); return c ? { ...t, order: c.order } : t; });
      return onPatchLead(leadId, { reviews: { ...r, testimonials: nextT } });
    }));
    if (!results.every(Boolean)) toast.error(COPY.error.save);
  }, [onPatchLead, toast]);
  const { move, dragProps } = useReorder(items, commit);
  const E = COPY.empty['landing.testimonials'];
  return (
    <Section title="Testimonials" description={`${items.length} featured, up to ${MAX_FEATURED} show on the site`}>
      {!items.length ? (
        <Card><EmptyState size="sm" icon="Star01" title={E.title} description={E.description} /></Card>
      ) : (
        <>
          {items.length > MAX_FEATURED && <p className="dt-muted">Only the first {MAX_FEATURED} by order show on the site.</p>}
          <Stack gap={2}>
            {items.map(({ lead: l, testimonial: t }, i) => (
              <ListRow key={t.id} {...dragProps(i, desktop)}
                title={excerpt(t.quote) || 'Untitled testimonial'}
                subtitle={`${t.author || 'Anonymous'}${t.role ? `, ${t.role}` : ''}, ${clientName(l)}`}
                chevron={false}
                trailing={rowTrailing({
                  name: `${t.author || 'testimonial'} for ${clientName(l)}`, published: !!l.showcase?.published, cut: i >= MAX_FEATURED,
                  atStart: i === 0, atEnd: i === items.length - 1,
                  onMoveUp: () => move(i, -1), onMoveDown: () => move(i, 1),
                  onOpen: onOpenLead ? () => onOpenLead(l) : null,
                })}
              />
            ))}
          </Stack>
        </>
      )}
    </Section>
  );
}

/* ── Stats ─────────────────────────────────────────────────────── */
const STAT_ROWS = [
  { key: 'clientsServed', label: 'Clients served' },
  { key: 'projectsDelivered', label: 'Projects delivered' },
  { key: 'averageRating', label: 'Average rating', format: (v) => (v == null ? null : Number(v).toFixed(1)) },
  { key: 'years', label: 'Years' },
];

function StatsSection({ landing, landingLoading, landingError, onRetryLanding, liveStats, onToggle, onSaveOverride }) {
  const [retry, retrying] = useRetry(onRetryLanding);
  const showSkel = useDelayedLoading(landingLoading);
  return (
    <Section title="Stats" description="Each number is live from your data unless you turn it off or set a fixed value.">
      {landingLoading && !showSkel ? null : showSkel ? (
        <Stack gap={2} aria-busy="true">{[1, 2, 3, 4].map(i => <SkeletonBlock key={i} height={64} radius="var(--v-radius-md)" />)}</Stack>
      ) : landingError && !landing ? (
        <Card><ErrorState title="Could not load stat settings" description="The landing settings did not come back. Try again." onRetry={retry} retrying={retrying} /></Card>
      ) : (
        <Stack gap={2}>
          {STAT_ROWS.map(({ key, label, format }) => {
            const on = landing?.stats?.toggles?.[key] !== false;
            const override = landing?.stats?.overrides?.[key];
            const liveRaw = liveStats?.[key];
            const liveShown = liveRaw == null ? 'not available yet' : (format ? format(liveRaw) : liveRaw);
            return (
              <Card key={key} padding={3}>
                <Row gap={4} align="center" wrap>
                  <Toggle checked={on} onChange={(v) => onToggle(key, v)} label={label} description={on ? `Live value: ${liveShown}` : 'Hidden on the site.'} className="ld-stat-toggle" />
                  <div className="ld-override">
                    <span className="v-field-label">Fixed value (optional)</span>
                    <InlineEdit
                      value={override != null ? String(format ? format(override) : override) : ''}
                      onSave={onSaveOverride(key)}
                      placeholder={`Live: ${liveShown}`}
                      label={`${label} fixed value`}
                      type="number" inputMode="decimal"
                      errorMessage="Enter a number, or clear it to use the live value."
                    />
                  </div>
                </Row>
              </Card>
            );
          })}
        </Stack>
      )}
    </Section>
  );
}

/* ── Screen ────────────────────────────────────────────────────── */
export default function AdminLanding({ leads = [], projects = [], loading, error, onRetry, onPatchLead, onOpenLead }) {
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const desktop = useMediaQuery('(hover: hover) and (pointer: fine)');
  const showSkel = useDelayedLoading(loading);
  const pending = loading && !showSkel;
  useTopBar(null);

  const logoStripCount = useMemo(() => leads.filter(l => l.showcase?.featured?.logoStrip).length, [leads]);
  const workCount = useMemo(() => leads.filter(l => l.showcase?.featured?.work).length, [leads]);
  const testimonialCount = useMemo(() => leads.reduce((n, l) => n + (l.reviews?.testimonials || []).filter(t => t.published && t.featured).length, 0), [leads]);
  const liveStats = useMemo(() => computeLiveStats(leads, projects), [leads, projects]);

  // Landing settings (_id: 'landing' on the existing /api/admin/settings route).
  const [landing, setLanding] = useState(null);
  const [landingError, setLandingError] = useState(false);
  const [landingLoading, setLandingLoading] = useState(true);
  const loadLanding = useCallback(async () => {
    setLandingLoading(true);
    const r = await apiFetch('/api/admin/settings');
    if (r.ok && r.data?.landing) { setLanding(r.data.landing); setLandingError(false); } else setLandingError(true);
    setLandingLoading(false);
  }, []);
  useEffect(() => { loadLanding(); }, [loadLanding]);

  // InlineEdit toasts its own failure (raw, no double toast); Toggle does not, so it gets a wrapper.
  const patchLandingRaw = useCallback(async (partial) => {
    const prev = landing;
    setLanding(s => mergeLanding(s, partial));
    const r = await apiFetch('/api/admin/settings', { method: 'PATCH', body: { set: { landing: partial } } });
    if (r.ok && r.data?.landing) { setLanding(r.data.landing); return true; }
    setLanding(prev);
    return false;
  }, [landing]);
  const toggleStat = useCallback(async (key, checked) => {
    const ok = await patchLandingRaw({ stats: { toggles: { [key]: checked } } });
    if (!ok) toast.error(COPY.error.save);
  }, [patchLandingRaw, toast]);
  const saveOverride = useCallback((key) => async (raw) => {
    const n = String(raw).trim();
    if (n !== '' && !Number.isFinite(Number(n))) return false;
    return patchLandingRaw({ stats: { overrides: { [key]: n === '' ? null : Number(n) } } });
  }, [patchLandingRaw]);

  const summary = `${logoStripCount} in the logo strip, ${workCount} featured work, ${testimonialCount} featured testimonial${testimonialCount === 1 ? '' : 's'}`;

  return (
    <PageShell className="aa-main aa-main--wide ld-shell">
      <ScrollArea wide className="ld-page">
        {/* No Section `loading` skeleton here: its injected placeholder line
            sits at a different position than a plain description paragraph,
            which shifts every row below it out of alignment with the real
            layout. A plain non-breaking space keeps the header's height
            steady without that extra element. */}
        <Section title="Landing" description={loading ? ' ' : summary} />
        {pending ? null : showSkel ? (
          // Shaped like the four real sections below (Section + row skeletons at
          // the same heights as ListRow/Card), so the fit check sees no jump.
          <Stack gap={6} aria-busy="true" className="ld-sections">
            <Section title="Logo strip" description=" "><Stack gap={2}><SkeletonBlock height={62} radius="var(--v-radius-md)" /><SkeletonBlock height={62} radius="var(--v-radius-md)" /></Stack></Section>
            <Section title="Featured work" description=" ">
              {/* A fixed spacer matching the real fallback note's footprint, tuned
                  against a direct measurement rather than guessed, so the row
                  below lands at the same position in both states. */}
              <div style={{ height: 36 }} aria-hidden="true" />
              <Stack gap={2}><SkeletonBlock height={62} radius="var(--v-radius-md)" /></Stack>
            </Section>
            <Section title="Testimonials" description=" "><Stack gap={2}><SkeletonBlock height={62} radius="var(--v-radius-md)" /></Stack></Section>
            <Section title="Stats" description=" "><Stack gap={2}>{[1, 2, 3, 4].map(i => <Card key={i} padding={3}><Row gap={4} wrap><SkeletonBlock height={44} radius="var(--v-radius-md)" style={{ flex: '1 1 220px' }} /><SkeletonBlock height={44} radius="var(--v-radius-md)" style={{ flex: '1 1 180px' }} /></Row></Card>)}</Stack></Section>
          </Stack>
        ) : error && !leads.length ? (
          <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>
        ) : (
          <Stagger className="ld-sections">
            <LogoStripSection leads={leads} desktop={desktop} onPatchLead={onPatchLead} onOpenLead={onOpenLead} toast={toast} />
            <FeaturedWorkSection leads={leads} desktop={desktop} onPatchLead={onPatchLead} onOpenLead={onOpenLead} toast={toast} />
            <TestimonialsSection leads={leads} desktop={desktop} onPatchLead={onPatchLead} onOpenLead={onOpenLead} toast={toast} />
            <StatsSection landing={landing} landingLoading={landingLoading} landingError={landingError} onRetryLanding={loadLanding} liveStats={liveStats} onToggle={toggleStat} onSaveOverride={saveOverride} />
          </Stagger>
        )}
      </ScrollArea>
      <style>{ldStyles}</style>
    </PageShell>
  );
}

const ldStyles = `
  .ld-sections { display: flex; flex-direction: column; gap: var(--v-space-6); min-width: 0; }
  .ld-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: var(--v-radius-sm); border: 1px solid var(--v-border); background: var(--v-surface-2); flex-shrink: 0; }
  .ld-warn { border-color: color-mix(in srgb, var(--v-status-danger-text) 40%, var(--v-border)); }
  .ld-warn-title { margin: 0; font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); color: var(--v-status-danger-text); }
  .ld-note { margin: calc(-1 * var(--v-space-2)) 0 0; }
  .ld-stat-toggle { flex: 1 1 220px; min-width: 220px; }
  .ld-override { display: flex; flex-direction: column; gap: var(--v-space-1); flex: 1 1 180px; min-width: 160px; }
`;
