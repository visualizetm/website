import { Button, Checkbox, EmptyState, Icon, Pill, ProgressBar, SkeletonBlock } from '../../ui';
import { relativeTime } from '../../shared/dates';
import { showcaseStatus, plannerStatus, tasksStatus, conceptsStatus, docsStatus } from '../../lib/workspace';
import DocRow from '../docs/DocRow';
import { COPY } from '../../shared/copy';
import { completePatch, taskDueLabel, isOverdue } from '../../lib/taskWrite';
import { safeHref } from '../../lib/safeUrl';

/* The workspace (client page workspace redesign, section 2): four cards,
 * one per thing Rob does for a client. Each shows a status line, a tiny
 * visual and one primary action; the whole card opens the full view (one
 * stretched button, the controls inside it sit above). Every number comes
 * from src/lib/workspace.js, the same selectors the menu used, so the card
 * and any other line that names it can never disagree. */

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const DIR_STATE = { approved: 'Approved', changes: 'Needs changes', pass: 'Passed', picked: 'Picked', waiting: 'Waiting', reference: 'For reference' };

/* Docs (client docs job, part 1): full width under the four cards (it spans the whole grid at every width), the count, New doc, the three
 * most recently edited rows with the pinned ones first, and All docs. One stretched button per row opens that doc. The count and the rows
 * come from src/lib/workspace.js, the same list the More page and search read. */
function DocsCard({ rec }) {
  const { lead, shell, readOnly } = rec;
  const api = shell?.docsApi;
  if (!api) return null;
  const st = docsStatus(api.docs, lead._id);
  const now = Date.now();
  const newDoc = () => api.newDoc(lead);
  return (
    <section className="rc-ws-card rc-docs" data-ws="docs" aria-label="Docs">
      <div className="rc-docs-head">
        <div className="rc-ws-head"><Icon icon="File02" size={16} className="rc-ws-icon" /><h3 className="rc-ws-title">Docs</h3>{st.count > 0 && <span className="rc-docs-count" aria-label={`${st.count} docs`}>{st.count}</span>}</div>
        {!readOnly && <Button variant="secondary" size="md" icon="Plus" onClick={newDoc} className="rc-docs-new">New doc</Button>}
      </div>
      {api.loading ? (
        <div className="rc-docs-rows" aria-hidden="true">{[0, 1, 2].map(i => <SkeletonBlock key={i} height={56} radius="var(--v-radius-md)" />)}</div>
      ) : api.error ? (
        <div className="rc-docs-err" role="alert"><span>Docs did not load.</span><Button variant="secondary" size="md" onClick={api.reload}>Retry</Button></div>
      ) : st.count === 0 ? (
        <EmptyState size="sm" className="rc-docs-empty" title={COPY.empty['clients.docs'].title} description={COPY.empty['clients.docs'].description} action={readOnly ? undefined : { label: 'New doc', icon: 'Plus', onClick: newDoc }} />
      ) : (
        <>
          <ul className="rc-docs-rows" aria-label="Recent docs">
            {st.rows.map(d => <DocRow key={d._id} doc={d} now={now} onOpen={api.openDoc} />)}
          </ul>
          <div className="rc-docs-foot v-above"><Button variant="secondary" size="md" onClick={() => api.openClientDocs(lead)} className="rc-docs-all rc-ws-btn">{st.more > 0 ? `All docs, ${st.count}` : 'All docs'}</Button></div>
        </>
      )}
    </section>
  );
}

function CardShell({ id, title, icon, open, openLabel, children, action }) {
  return (
    <div className={`rc-ws-card rc-ws-card--${id}`} data-ws={id}>
      <button type="button" className="v-stretch" onClick={open} aria-label={openLabel}>{openLabel}</button>
      <div className="rc-ws-head"><Icon icon={icon} size={16} className="rc-ws-icon" /><span className="rc-ws-title">{title}</span></div>
      <div className="rc-ws-body">{children}</div>
      <div className="rc-ws-foot v-above">{action}</div>
    </div>
  );
}

export default function WorkspaceCards({ rec }) {
  const { lead, shell, readOnly, patch } = rec;
  const sc = showcaseStatus(lead);
  const pl = plannerStatus(shell?.posts || [], lead);
  const tk = tasksStatus(lead, 2);
  const cc = conceptsStatus(shell?.sets || [], lead._id);
  const ctx = { projects: shell?.projects || [], sets: shell?.sets || [] };
  const now = Date.now();
  const openShowcase = () => shell?.openShowcase?.(lead);
  const openPlanner = () => shell?.openPlanner?.(lead);
  const openTasks = () => shell?.openTasks?.(lead);
  const openConcepts = () => shell?.openConcepts?.(lead);
  const plannerLine = pl.total
    ? [pl.inReview ? `${pl.inReview} in review` : '', pl.approved ? `${pl.approved} approved` : '', pl.live ? `${pl.live} live` : ''].filter(Boolean).join(', ') || `${plural(pl.total, 'item')} this month`
    : 'Nothing this month yet';
  return (
    <div className="rc-ws-grid" role="group" aria-label="Workspace">
      <CardShell id="showcase" title="Showcase" icon="Image01" open={openShowcase} openLabel="Open showcase"
        action={<Button variant="secondary" size="md" full onClick={openShowcase} className="rc-ws-btn">Open showcase</Button>}>
        <div className="rc-ws-row">
          {sc.cover && <span className="img-fit img-fit--1x1 rc-ws-thumb"><img src={safeHref(sc.cover)} alt="" width={40} height={40} loading="lazy" decoding="async" /></span>}
          <Pill tone={sc.empty ? 'new' : sc.state === 'published' ? 'booked' : sc.state === 'ready' ? 'progress' : 'neutral'} label={sc.empty ? 'No images yet' : sc.state === 'none' ? 'None yet' : sc.state[0].toUpperCase() + sc.state.slice(1)} size="sm" icon={false} variant={sc.state === 'published' && !sc.empty ? 'solid' : 'soft'} />
        </div>
        <p className="rc-ws-line">{sc.state === 'none' ? 'Nothing built yet.' : sc.empty ? 'Published, no images yet.' : sc.state === 'published' ? `${plural(sc.images, 'image')} on the page.` : `${sc.done} of ${sc.total} filled, ${plural(sc.images, 'image')}.`}</p>
      </CardShell>

      <CardShell id="planner" title="Planner" icon="Calendar" open={openPlanner} openLabel="Open planner"
        action={<Button variant="secondary" size="md" full onClick={openPlanner} className="rc-ws-btn">Open planner</Button>}>
        <div className="rc-ws-row">
          <Pill tone={pl.enabled ? 'booked' : 'neutral'} label={pl.enabled ? 'Link on' : 'Link off'} size="sm" icon={false} variant="soft" />
          {pl.inReview > 0 && <Pill tone="new" label={`${pl.inReview} in review`} size="sm" icon={false} variant="solid" />}
        </div>
        <p className="rc-ws-line">{plannerLine}</p>
        {pl.total > 0 && <p className="rc-ws-sub">{plural(pl.posts, 'post')}, {plural(pl.ads, 'ad')}</p>}
      </CardShell>

      <CardShell id="tasks" title="Tasks" icon="CheckDone01" open={openTasks} openLabel="All tasks"
        action={<Button variant="secondary" size="md" full onClick={openTasks} className="rc-ws-btn">All tasks</Button>}>
        {tk.total
          ? <ProgressBar value={tk.pct} size="sm" tone={tk.done === tk.total ? 'booked' : 'progress'} label={`${tk.done} of ${tk.total} done`} className="rc-ws-bar" />
          : <p className="rc-ws-line">No tasks yet.</p>}
        {tk.next.length > 0 && (
          <div className="rc-ws-tasks v-above">
            {tk.next.map(t => (
              <Checkbox key={t.id} checked={false} disabled={readOnly} className={`rc-ws-task${isOverdue(t, now) ? ' is-overdue' : ''}`}
                onChange={() => patch(completePatch(lead, t.id, true, ctx, now))}
                label={<span className="rc-ws-task-text"><span className="rc-ws-task-title">{t.text}</span>{taskDueLabel(t, now) && <span className="rc-ws-task-due">{taskDueLabel(t, now)}</span>}</span>} />
            ))}
          </div>
        )}
      </CardShell>

      <CardShell id="concepts" title="Concepts" icon="LayersThree01" open={openConcepts} openLabel={cc.set ? 'Open concepts' : 'Make a concept set'}
        action={<Button variant="secondary" size="md" full onClick={openConcepts} className="rc-ws-btn">{cc.set ? 'Open concepts' : 'Make a concept set'}</Button>}>
        <div className="rc-ws-row">
          {cc.status ? <Pill tone={cc.status.tone} label={cc.status.label} size="sm" icon={false} variant={cc.status.id === 'approved' ? 'solid' : 'soft'} /> : <Pill tone="neutral" label="None yet" size="sm" icon={false} variant="soft" />}
        </div>
        <p className="rc-ws-line">{cc.review ? `${cc.review}.` : cc.set ? `${plural(cc.count, 'set')}, ${plural(cc.items, 'item')} in round ${cc.set.round || 1}.` : 'Nothing to show them yet.'}</p>
        {cc.rows.length > 0 && (
          <ul className="rc-ws-dirs" aria-label="Directions">
            {cc.rows.map(r => <li key={r.id} className={`rc-ws-dir is-${r.state}`}><span className="rc-ws-dir-name">{r.name}</span><span className="rc-ws-dir-state">{DIR_STATE[r.state]}</span></li>)}
          </ul>
        )}
        {cc.set && <p className="rc-ws-sub">{cc.answeredAt ? `Answers sent ${relativeTime(cc.answeredAt)}` : cc.lastViewedAt ? `Viewed ${relativeTime(cc.lastViewedAt)}` : cc.set.status === 'draft' ? 'Not sent yet' : 'Not opened yet'}</p>}
      </CardShell>

      <DocsCard rec={rec} />
    </div>
  );
}
