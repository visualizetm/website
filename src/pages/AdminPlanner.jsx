import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Button, IconButton, Pill, Toggle, Textarea,
  InlineEdit, Menu, ProgressBar, EmptyState, ErrorState, Stagger, SkeletonText,
  useConfirm, useDelayedLoading, useToast, useMediaQuery, Icon, ListRow, SwipeRow } from '../ui';
import { COPY } from '../shared/copy';
import { RETAINERS } from '../shared/pricing';
import { isOnRetainer } from '../lib/projects';
import { useTopBar } from '../shell/ShellContext';
import { useSelection } from '../shell/nav-history';
import { platformOf, postStatusOf, postFormatOf, postKindOf, SUGGESTION_KINDS, SUGGESTION_GOALS, suggestionStatusOf } from '../shared/semantics';
import { relativeTime, fmtDateTime } from '../shared/dates';
import { postsOf, postsInReview, postDateLabel, postLabel, platformsOf, formatOf, kindOf, missingForReview, listPhrase, hashtagsOf, aspectNote } from '../lib/posts';
import { safeHref } from '../lib/safeUrl';
import { videoFieldStyles } from '../components/VideoField';
import SaveBar, { saveBarStyles } from '../components/SaveBar';
import { imageFieldStyles } from '../components/ImageField';
import PostSheet, { postSheetStyles } from '../components/PostSheet';

/* The Content Planner editor (planner prompt 2), one page per client at
 * /clients/:id/planner, built on the pattern AdminShowcase established: a
 * draft held here, an explicit save, and the shared save bar.
 *
 * Prompt 1's data layer is what this reads and writes:
 *   posts        the shell already loads /api/admin/posts; src/lib/posts.js
 *                is the pure logic over it, and nothing here reimplements it
 *   lead.planner a FULL REPLACEMENT object, so every save spreads the stored
 *                one and overrides only what changed. token, tokenCreatedAt
 *                and lastViewedAt are carried forward by the server and are
 *                never sent from here; revoking is { regenerate: true }, and
 *                there is deliberately no field that takes a token value.
 *
 * Drafted: the planner settings and every field of every post.
 * Immediate: adding a post and deleting one, because a half created post
 * sitting inside a draft is confusing rather than safe.
 */

const SITE = 'https://visualizestudio.org';
const DEFAULT_PLANNER = { enabled: false, postsPerMonth: 8, welcome: '' };

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const thisMonth = () => monthKey(new Date());
const shiftMonth = (m, by) => {
  const [y, mm] = String(m).split('-').map(Number);
  const d = new Date(y, (mm - 1) + by, 1);
  return monthKey(d);
};
const monthLabel = (m) => {
  const [y, mm] = String(m).split('-').map(Number);
  if (!y || !mm) return m;
  return new Date(y, mm - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
};
/** The same day next month, clamped to that month's length. */
const shiftDate = (date, by) => {
  const [y, m, d] = String(date || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const target = new Date(y, (m - 1) + by, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};

/** The planner record as the editor holds it: the three writable fields. */
const plannerDraftOf = (lead) => ({ ...DEFAULT_PLANNER, ...pickWritable(lead?.planner) });
function pickWritable(p) {
  if (!p || typeof p !== 'object') return {};
  return {
    enabled: !!p.enabled,
    postsPerMonth: Number(p.postsPerMonth) || 8,
    welcome: String(p.welcome || ''),
  };
}
const samePlanner = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* What a save actually sends. planner is a full replacement object, so this
 * spreads whatever else is stored on it and overrides the three writable
 * fields; token, tokenCreatedAt and lastViewedAt are stripped on the way out
 * because the server owns them, and a token is not settable from a request
 * at all. Revoking is a `regenerate: true` flag added by the caller, never a
 * token value. */
/* UX audit, D7: a client on a retainer owes what the plan says (the Content
 * Kit is eight a month), so the number is read from the plan, shown read
 * only, and written into the planner record on save so the client's own
 * page shows the same figure. Without a retainer it is typed on the page. */
function planCountOf(lead) {
  const plan = lead && isOnRetainer(lead) ? RETAINERS.find(r => r.id === lead.retainer?.planId) : null;
  return Number(plan?.monthly?.count) || 0;
}
function plannerPatch(lead, draft) {
  const { token, tokenCreatedAt, lastViewedAt, regenerate, ...rest } = lead?.planner || {};  
  const fromPlan = planCountOf(lead);
  return { ...rest, ...draft, ...(fromPlan ? { postsPerMonth: fromPlan } : {}) };
}

/* One post as the draft holds it: only the fields this editor writes, so a
 * save never sends a stamp the server owns (approvedAt, postedAt) unless the
 * status change is what set it. */
const POST_FIELDS = ['date', 'time', 'platform', 'platforms', 'format', 'imageUrl', 'caption', 'hashtags', 'status', 'note', 'order', 'kind', 'ad', 'video', 'concept', 'allowDownload'];
const POST_DEFAULT = { order: 0, platforms: [], kind: 'post', ad: null, video: null, allowDownload: true };
const postDraftOf = (p) => Object.fromEntries(POST_FIELDS.map(k => [k, p?.[k] ?? (k in POST_DEFAULT ? POST_DEFAULT[k] : '')]));
/* An idea's goal, in the ad's terms, when Rob makes an ad from it. */
const IDEA_GOAL = { calls: 'calls', offer: 'offer', work: 'awareness', slow: 'visits', other: 'awareness' };
const AD_FROM_IDEA = (s, date) => ({ name: s.subject || '', goal: IDEA_GOAL[s.goal] || 'awareness', audience: '', placements: ['feed'], buttonText: '', link: s.link || '', startDate: date, endDate: '', budget: '', showBudget: false, results: { reach: '', clicks: '', messages: '', spend: '' } });
const samePost = (a, b) => POST_FIELDS.every(k => JSON.stringify(a?.[k] ?? '') === JSON.stringify(b?.[k] ?? ''));

/* ── The invite card ──────────────────────────────────────────────── */
function InviteCard({ planner, url, onRegenerate, readOnly }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copied.'); }
    catch { toast.error(COPY.error.copy); }
  };
  const regenerate = async () => {
    const yes = await confirm({
      title: 'Make a new link?',
      body: 'The link they have stops working immediately. Anyone still holding the old one gets a not found page, and you will need to send them the new one.',
      confirmLabel: 'Make a new link',
      danger: true,
    });
    if (yes) onRegenerate();
  };
  return (
    <Card className="pl-invite">
      <p className="pb-card-h">Their link</p>
      <div className="v-field">
        <span className="v-field-label">Send them this</span>
        <Row gap={1} align="center" wrap>
          <a href={url} target="_blank" rel="noopener noreferrer" className="sc-url lay-truncate">{url}</a>
          <IconButton icon="Copy01" label="Copy planner link" variant="ghost" onClick={copy} />
        </Row>
        <p className="pl-note">Text this to them. It opens their planner, no password and no account.</p>
      </div>
      <span className="dt-muted">{planner.lastViewedAt ? `Last opened ${relativeTime(planner.lastViewedAt)}` : 'Not opened yet'}</span>
      {!readOnly && (
        <Row gap={2} wrap>
          <Button variant="secondary" size="md" icon="RefreshCw01" onClick={regenerate} className="pl-regen">Make a new link</Button>
        </Row>
      )}
      {confirmDialog}
    </Card>
  );
}

/* ── One row in the month ─────────────────────────────────────────── */
function PostRow({ post, draft, client, onOpen, onMove, onSendForApproval, first, last, readOnly, dragProps }) {
  const p = { ...post, ...draft };
  const st = postStatusOf(p.status);
  const fmt = postFormatOf(formatOf(p));
  const kind = kindOf(p);
  const kd = postKindOf(kind);
  const thumb = p.imageUrl || p.video?.poster || '';
  const label = kind === 'ad' && p.ad?.name ? p.ad.name : postLabel(p);
  /* Up to two platform icons on a row; a third and a fourth become "+1" and
     "+2" rather than four icons crowding the date. */
  const platforms = platformsOf(p).map(platformOf);
  const shown = platforms.slice(0, 2);
  const extra = platforms.length - shown.length;
  const missing = missingForReview(p);
  const [natural, setNatural] = useState(null);
  const mismatch = natural ? aspectNote(formatOf(p), natural.w, natural.h) : '';
  const note = post.clientNote;
  /* A note is news while the post is back in `making`; once it has gone up
   * for review again it stays on the record as history. */
  const noteIsNew = note && post.status === 'making';
  /* A phone: drag right sends a finished post for the client's approval (the same status change as the post sheet's, and the menu has it). */
  const canSend = !readOnly && p.status === 'making' && missing.length === 0 && !!onSendForApproval;
  return (
    <SwipeRow right={canSend ? { label: 'Send for approval', icon: 'Send01', tone: 'primary', onCommit: onSendForApproval } : undefined} enabled={!!onSendForApproval}>
    <Card as="div" padding={3} interactive className="pl-post" {...dragProps}>
      <button type="button" className="v-stretch" onClick={onOpen} aria-label={`Edit the ${label}${kind === 'ad' ? ' ad' : ''}`}>{`Edit the ${label}`}</button>
      <Row gap={3} align="start" wrap={false} style={{ minWidth: 0 }}>
        <span className={`img-fit ${fmt.aspect} pl-thumb`}>
          {thumb
            ? <img src={thumb} alt="" width={144} height={144} loading="lazy" decoding="async"
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            : <span className="pl-thumb-empty" aria-hidden="true"><Icon icon={formatOf(p) === 'video' ? 'Play' : 'Image01'} size="var(--v-icon-md)" /></span>}
        </span>
        <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
          <Row gap={2} align="center" wrap>
            <span className="pl-post-when">{postDateLabel(p.date) || 'No date'}{p.time ? `, ${p.time}` : ''}</span>
            <span className="pl-plats" title={platforms.map(x => x.label).join(', ')}>
              {shown.map(x => <span key={x.id} className="pl-plat" style={{ '--sc': x.color }}><Icon icon={x.icon} size={13} /></span>)}
              {extra > 0 && <span className="pl-plat pl-plat--more">+{extra}</span>}
              <span className="visually-hidden">{platforms.map(x => x.label).join(', ')}</span>
            </span>
            {kind === 'ad' && <Pill label={kd.label} icon={kd.icon} size="sm" variant="solid" style={{ '--sc': kd.color }} />}
            <Pill label={fmt.label} icon={fmt.icon} size="sm" variant="soft" style={{ '--sc': fmt.color }} />
            <Pill label={st.label} icon={st.icon} size="sm" variant={p.status === 'review' ? 'solid' : 'soft'} style={{ '--sc': st.color }} />
            {/* A post sitting with a client that they cannot act on is stuck,
                not waiting, so the row says so and names what it needs. */}
            {p.status === 'review' && missing.length > 0 && (
              <Pill tone="danger" label="Not ready" icon="AlertTriangle" size="sm" variant="solid" title={`Needs ${listPhrase(missing)}.`} />
            )}
          </Row>
          <span className="pl-post-label lay-truncate">{kind === 'ad' && p.ad?.startDate ? `${label}, ${postDateLabel(p.ad.startDate)}${p.ad.endDate ? ` to ${postDateLabel(p.ad.endDate)}` : ''}` : label}</span>
          {p.status === 'review' && missing.length > 0 && <span className="pl-missing">Needs {listPhrase(missing)}.</span>}
          {/* Not a problem, just worth knowing: he may have meant it. */}
          {mismatch && <span className="pl-mismatch">{mismatch}</span>}
          {note && (
            <div className={`pl-clientnote${noteIsNew ? ' is-new' : ''}`}>
              <Row gap={2} align="center" wrap>
                <Icon icon="MessageCircle01" size={14} />
                <span className="pl-clientnote-who">{noteIsNew ? `${client} asked for a change` : `${client} asked for a change, handled`}</span>
                {post.clientNoteAt && <span className="dt-muted">{fmtDateTime(post.clientNoteAt)}</span>}
              </Row>
              <p className="pl-clientnote-body">{note}</p>
            </div>
          )}
        </Stack>
        {!readOnly && (
          <Menu label={`${postLabel(p)} actions`} items={[
            { id: 'up', label: 'Move up', icon: 'ChevronLeft', disabled: first, onSelect: () => onMove(-1) },
            { id: 'down', label: 'Move down', icon: 'ChevronDown', disabled: last, onSelect: () => onMove(1) },
            'divider',
            ...(canSend ? [{ id: 'send', label: 'Send for approval', icon: 'Send01', onSelect: onSendForApproval }] : []),
            { id: 'edit', label: kind === 'ad' ? 'Edit ad' : 'Edit post', icon: 'Edit02', onSelect: onOpen },
          ]} />
        )}
      </Row>
    </Card>
    </SwipeRow>
  );
}

/* ── The ideas inbox (planner dashboard, milestone 4) ──────────────── */
/* What the client asked for from Ideas on their planner. One row per idea:
   the brief, then Make a post, an ad or a video (a draft prefilled from the
   brief, the idea marked In the plan) or Decline with a note they read. */
function IdeaRow({ s, busy, readOnly, onMake, onDecline }) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const st = suggestionStatusOf(s.status);
  const kind = SUGGESTION_KINDS.find(k => k.id === s.kind) || SUGGESTION_KINDS[0];
  const goal = SUGGESTION_GOALS.find(g => g.id === s.goal);
  const photos = Array.isArray(s.photos) ? s.photos.slice(0, 3) : [];
  const isNew = s.status === 'new';
  return (
    <Card as="div" padding={3} className={`pl-idea${isNew ? ' is-new' : ''}`}>
      <Stack gap={2}>
        <Row gap={2} align="center" wrap>
          <Pill label={kind.label} size="sm" variant="soft" icon={false} />
          <Pill label={st.label} tone={st.tone} size="sm" variant={isNew ? 'solid' : 'soft'} icon={false} />
          <span className="dt-muted">{relativeTime(s.createdAt)}</span>
        </Row>
        <span className="pl-idea-subject">{s.subject}</span>
        {(goal || s.preferredDate) && <span className="pl-idea-goal">{[goal?.label, s.preferredDate ? `Wants it ${postDateLabel(s.preferredDate)}` : ''].filter(Boolean).join('. ')}</span>}
        {s.details && <p className="pl-idea-details">{s.details}</p>}
        {(photos.length > 0 || s.link) && (
          <Row gap={2} align="center" wrap>
            {photos.map((u, i) => <a key={u} className="pl-idea-photo" href={safeHref(u)} target="_blank" rel="noopener noreferrer" aria-label={`Picture ${i + 1} they sent`}><img src={safeHref(u)} alt="" width={56} height={56} loading="lazy" decoding="async" /></a>)}
            {s.link && safeHref(s.link) && <a className="pl-idea-link" href={safeHref(s.link)} target="_blank" rel="noopener noreferrer">The link they sent</a>}
          </Row>
        )}
        {s.status === 'declined' && s.note && <p className="pl-idea-note">Your note: {s.note}</p>}
        {!readOnly && isNew && (declining ? (
          <Stack gap={2}>
            <Textarea label="Tell them why" rows={2} maxLength={500} value={note} autoFocus
              placeholder="Giveaways bring the wrong crowd. Let me do the Friday offer first."
              onChange={(e) => setNote(e.target.value.slice(0, 500))} hint="They read this under the idea." />
            <Row gap={2} wrap>
              <Button size="md" variant="secondary" onClick={() => setDeclining(false)} disabled={busy}>Back</Button>
              <Button size="md" danger icon="XClose" onClick={() => onDecline(s, note.trim())} loading={busy} className="pl-idea-decline">Decline</Button>
            </Row>
          </Stack>
        ) : (
          <Row gap={2} wrap className="pl-idea-actions">
            <Button size="md" icon="Image01" onClick={() => onMake(s, 'post')} loading={busy} className="pl-idea-make">Make a post</Button>
            <Button size="md" variant="secondary" icon="Zap" onClick={() => onMake(s, 'ad')} disabled={busy}>Make an ad</Button>
            <Button size="md" variant="secondary" icon="Play" onClick={() => onMake(s, 'video')} disabled={busy}>Make a video</Button>
            <Button size="md" variant="ghost" onClick={() => setDeclining(true)} disabled={busy}>Decline</Button>
          </Row>
        ))}
      </Stack>
    </Card>
  );
}

export default function AdminPlanner({
  lead, posts = [], loading = false, error = false, onRetry, leadsError = false, onRetryLeads, onPatch, onRefetchLead,
  onCreatePost, onPatchPost, onDeletePost, onBack, month: monthProp, readOnly = false,
  suggestions = [], onPatchSuggestion, openIdeas = false,
}) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const showSkel = useDelayedLoading(loading);
  const desktop = useMediaQuery('(hover: hover) and (pointer: fine)');

  const [month, setMonth] = useState(() => monthProp || thisMonth());
  const [openId, setOpenId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);

  const saved = useMemo(() => plannerDraftOf(lead), [lead]);
  const [draft, setDraft] = useState(saved);
  const mine = useMemo(() => postsOf(posts, lead?._id), [posts, lead]);
  const ideas = useMemo(() => suggestions.filter(s => String(s.leadId) === String(lead?._id) && !s.deleted).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))), [suggestions, lead]);
  const newIdeas = ideas.filter(s => s.status === 'new').length;
  /* The tag set from this client's most recent post that has any, so a set
     is reused rather than retyped. Newest by date, then by creation. A hook,
     so it lives up here with the others and never after the early return. */
  const lastHashtags = useMemo(() => {
    const withTags = mine.filter(p => hashtagsOf(p).length)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return withTags[0]?.hashtags || '';
  }, [mine]);
  const monthPosts = useMemo(
    () => mine.filter(p => p.month === month).sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.order || 0) - (b.order || 0) || String(a.time).localeCompare(String(b.time))),
    [mine, month],
  );

  /* Post edits live here, keyed by post id, so the save bar can count them
   * and Discard can drop them all at once. */
  const [postDrafts, setPostDrafts] = useState({});
  const changedPosts = useMemo(
    () => Object.entries(postDrafts).filter(([id, d]) => { const p = mine.find(x => String(x._id) === id); return p && !samePost({ ...postDraftOf(p), ...d }, postDraftOf(p)); }),
    [postDrafts, mine],
  );
  const dirty = !samePlanner(draft, saved) || changedPosts.length > 0;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  /* Re-seed when the record changes underneath, comparing against the record
   * the draft was seeded FROM rather than the one that just arrived: on a
   * deep link the first seed happens before the client list has loaded, and
   * reading that as unsaved work is what kept the Showcase editor showing a
   * blank record until it was fixed. */
  const seededFrom = useRef(saved);
  const seededId = useRef(lead?._id);
  useEffect(() => {
    if (seededFrom.current === saved && seededId.current === lead?._id) return;
    const prev = seededFrom.current;
    const sameLead = seededId.current === lead?._id;
    seededFrom.current = saved;
    seededId.current = lead?._id;
    setDraft(d => (!sameLead || samePlanner(d, prev) ? saved : d));
    if (!sameLead) setPostDrafts({});
  }, [saved, lead]);

  const setPlanner = useCallback((next) => setDraft(d => ({ ...d, ...next })), []);
  /* The one place a post edit is written. `platform` is kept in step with
     the first entry of `platforms` here rather than at each call site, so a
     record written today is still readable by anything still looking at the
     old single field. */
  const writePost = useCallback((id, next) => setPostDrafts(m => {
    const patch = { ...next };
    if (Array.isArray(patch.platforms) && patch.platforms.length) patch.platform = patch.platforms[0];
    return { ...m, [String(id)]: { ...m[String(id)], ...patch } };
  }), []);

  const save = useCallback(async () => {
    if (saving || !lead) return false;
    setSaving(true);
    /* planner is a full replacement object: spread what is stored, override
     * the three writable fields, and send nothing else. token,
     * tokenCreatedAt and lastViewedAt stay on the server's copy. */
    let ok = true;
    if (!samePlanner(draft, saved)) {
      ok = await onPatch(lead._id, { planner: plannerPatch(lead, draft) });
      /* The shell's patch merges what was sent, and what was sent has no
       * token in it, so the local copy would lose one until the next load.
       * Refetching is what puts the server's own planner object back, which
       * matters here because the invite card is drawn from it. */
      if (ok) await onRefetchLead?.();
    }
    for (const [id, d] of changedPosts) {
      const wrote = await onPatchPost(id, d);  
      if (!wrote) ok = false;
    }
    setSaving(false);
    if (ok) { setPostDrafts({}); toast.success(changedPosts.length ? `Saved. ${changedPosts.length} post${changedPosts.length === 1 ? '' : 's'} updated.` : 'Saved.'); }
    else toast.error(COPY.error.save);
    return ok;
  }, [saving, lead, draft, saved, changedPosts, onPatch, onPatchPost, onRefetchLead, toast]);

  const discard = useCallback(async () => {
    const yes = await confirm({ title: 'Discard changes?', body: 'Everything you changed since the last save goes back to what is stored.', confirmLabel: 'Discard', danger: true });
    if (yes) { setDraft(saved); setPostDrafts({}); }
  }, [confirm, saved]);

  const leave = useCallback(async () => {
    if (!dirtyRef.current) { onBack(); return; }
    const yes = await confirm({ title: 'Leave without saving?', body: 'Your changes to this planner have not been saved yet.', confirmLabel: 'Leave', danger: true });
    if (yes) onBack();
  }, [confirm, onBack]);
  /* A phone (milestone 4): the month and its posts stay on the overview (that is the job); Setup and the client link are rows that open
     their own screen with a Done. The draft lives here, so it carries across; Save is on the overview. */
  const phone = useMediaQuery('(max-width: 767px)');
  const { selId: step, open: openStep, close: closeStep } = useSelection('planner-step');
  const inStep = phone && !!step;
  useTopBar({ title: inStep ? step : undefined, back: inStep ? closeStep : leave, actions: inStep ? [{ id: 'done', label: 'Done', icon: 'Check', onClick: closeStep }] : undefined });
  /* The push for a new idea lands on ?ideas=1: on a phone that is the Ideas step, on a computer the inbox is already on the page. */
  const ideasOpened = useRef(false);
  useEffect(() => {
    if (!openIdeas || ideasOpened.current || !lead || !phone) return;
    ideasOpened.current = true;
    openStep('Ideas');
  }, [openIdeas, lead, phone, openStep]);

  // Cmd+S / Ctrl+S, and the browser's own guard for closing the tab.
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (dirtyRef.current) save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);
  useEffect(() => {
    const onUnload = (e) => { if (!dirtyRef.current) return undefined; e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  /* Adding and deleting are immediate: a post that exists only inside a
   * draft has no id to hang edits or an upload on. */
  // UX audit, item 9: the post just added opens with its image field focused.
  const [freshId, setFreshId] = useState(null);
  const addItem = useCallback(async ({ kind = 'post', format = 'portrait' } = {}) => {
    if (!lead || busy) return;
    setBusy(true);
    const date = `${month}-01`;
    const item = await onCreatePost({
      leadId: String(lead._id), month, date, platforms: ['instagram'], platform: 'instagram', format, kind, status: 'making', order: monthPosts.length, allowDownload: true,
      ...(kind === 'ad' ? { ad: AD_FROM_IDEA({ subject: '', goal: 'other' }, date) } : {}),
    });
    setBusy(false);
    if (item) { setFreshId(String(item._id)); setOpenId(String(item._id)); toast.success(kind === 'ad' ? 'Ad added.' : format === 'video' ? 'Video added.' : 'Post added.'); }
    else toast.error(COPY.error.save);
  }, [lead, busy, month, monthPosts.length, onCreatePost, toast]);
  const addPost = useCallback(() => addItem({}), [addItem]);

  /* An idea becomes a draft: the brief prefills it, the idea is marked In
     the plan with the post's id, and the editor opens on it. */
  const makeFromIdea = useCallback(async (s, what) => {
    if (!lead || busy) return;
    setBusy(true);
    const kind = what === 'ad' ? 'ad' : 'post';
    const format = what === 'video' ? 'video' : 'portrait';
    const date = s.preferredDate || `${month}-01`;
    const m = s.preferredDate ? String(s.preferredDate).slice(0, 7) : month;
    const item = await onCreatePost({
      leadId: String(lead._id), month: m, date, time: '', platforms: ['instagram'], platform: 'instagram', format, kind,
      imageUrl: Array.isArray(s.photos) && s.photos[0] ? s.photos[0] : '',
      caption: [s.subject, s.details].filter(Boolean).join('\n\n'), hashtags: '', status: 'making', note: '', order: monthPosts.length,
      concept: what === 'video' ? (s.details || s.subject || '') : '', allowDownload: true,
      ...(kind === 'ad' ? { ad: AD_FROM_IDEA(s, date) } : {}),
    });
    if (item) {
      const marked = await onPatchSuggestion?.(String(s._id), { status: 'planned', postId: String(item._id), seenAt: new Date().toISOString() });
      if (m !== month) setMonth(m);
      setFreshId(String(item._id)); setOpenId(String(item._id));
      toast.success(`${what === 'ad' ? 'Ad' : what === 'video' ? 'Video' : 'Post'} made from their idea.${marked === false ? ' The idea could not be marked.' : ' They see it as In the plan.'}`);
    } else toast.error(COPY.error.save);
    setBusy(false);
  }, [lead, busy, month, monthPosts.length, onCreatePost, onPatchSuggestion, toast]);
  const declineIdea = useCallback(async (s, note) => {
    if (busy) return;
    setBusy(true);
    const ok = await onPatchSuggestion?.(String(s._id), { status: 'declined', note, seenAt: new Date().toISOString() });
    setBusy(false);
    if (ok) toast.success('Declined. They see your note.'); else toast.error(COPY.error.save);
  }, [busy, onPatchSuggestion, toast]);

  const removePost = useCallback(async (post) => {
    const yes = await confirm({ title: 'Delete this post?', body: 'It disappears from their planner. You can still get it back from Recently deleted.', confirmLabel: 'Delete', danger: true });
    if (!yes) return;
    setOpenId(null);
    setPostDrafts(m => { const n = { ...m }; delete n[String(post._id)]; return n; });
    const ok = await onDeletePost(String(post._id));
    if (ok) toast.success('Post deleted.'); else toast.error(COPY.error.save);
  }, [confirm, onDeletePost, toast]);

  const copyLastMonth = useCallback(async () => {
    if (!lead || busy) return;
    const from = shiftMonth(month, -1);
    const source = mine.filter(p => p.month === from);
    if (!source.length) { toast.error(`Nothing in ${monthLabel(from)} to copy.`); return; }
    setBusy(true);
    let made = 0;
    for (const p of source) {
       
      const item = await onCreatePost({
        leadId: String(lead._id), month, date: shiftDate(p.date, 1), time: p.time,
        platforms: platformsOf(p), platform: platformsOf(p)[0], format: formatOf(p),
        imageUrl: p.imageUrl, caption: p.caption, hashtags: p.hashtags || '',
        status: 'making', note: p.note, order: p.order || 0,
      });
      if (item) made += 1;
    }
    setBusy(false);
    if (made) toast.success(`${made} post${made === 1 ? '' : 's'} copied from ${monthLabel(from)}, all set back to Making.`);
    else toast.error(COPY.error.save);
  }, [lead, busy, month, mine, onCreatePost, toast]);

  const movePost = useCallback((post, by) => {
    const i = monthPosts.findIndex(p => String(p._id) === String(post._id));
    const j = i + by;
    if (i < 0 || j < 0 || j >= monthPosts.length) return;
    const other = monthPosts[j];
    const mineOrder = (postDrafts[String(post._id)]?.order ?? post.order) || 0;
    const theirOrder = (postDrafts[String(other._id)]?.order ?? other.order) || 0;
    // Swapping equal orders would do nothing, so fall back to their indexes.
    const a = mineOrder === theirOrder ? i : mineOrder;
    const b = mineOrder === theirOrder ? j : theirOrder;
    writePost(post._id, { order: b });
    writePost(other._id, { order: a });
  }, [monthPosts, postDrafts, writePost]);

  if (!lead) {
    return (
      <PageShell className="aa-main aa-main--wide">
        <ScrollArea wide>
          {leadsError && !loading
            ? <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={onRetryLeads} /></Card>
            : loading
            ? <Section title="Planner" description=" " loading><Stack gap={3}>{[1, 2, 3].map(i => <Card key={i}><SkeletonText lines={3} /></Card>)}</Stack></Section>
            : <EmptyState icon="Calendar" title="Client not found" description="That client is not in the list any more." action={<Button onClick={onBack}>Back to clients</Button>} />}
        </ScrollArea>
      </PageShell>
    );
  }

  const name = lead.showcase?.displayName || lead.business || 'Client';
  const waiting = postsInReview(mine);
  const token = lead.planner?.token || '';
  const url = token ? `${SITE}/planner/${token}` : '';
  const plan = lead && isOnRetainer(lead) ? RETAINERS.find(r => r.id === lead.retainer?.planId) : null;
  const planCount = planCountOf(lead);
  const cap = planCount || Number(draft.postsPerMonth) || 8;
  const monthPostCount = monthPosts.filter(p => kindOf(p) !== 'ad').length;
  const monthAdCount = monthPosts.length - monthPostCount;
  const setupCard = (
              <Card className="pl-setup">
                <p className="pb-card-h">Setup</p>
                <Toggle checked={!!draft.enabled} onChange={(v) => setPlanner({ enabled: v })} disabled={readOnly}
                  label="Planner on for this client"
                  description="When this is on, the client can open their planner with the link below. Turning it off makes the link stop working without deleting anything." />
                <div className="v-field">
                  <span className="v-field-label">Posts a month</span>
                  {planCount
                    ? <Row gap={2} align="center" wrap><span className="dt-fact-ro">{planCount} a month, from {plan.label}</span>{!readOnly && <Button variant="ghost" size="md" onClick={onBack}>Edit in Retainer</Button>}</Row>
                    : <InlineEdit value={String(cap)} onSave={(v) => setPlanner({ postsPerMonth: Math.max(0, Math.min(60, Math.round(Number(v)) || 0)) || 8 })}
                        label="Posts a month" placeholder="8" readOnly={readOnly} className="dt-fact-edit" />}
                  <p className="pl-note">{planCount ? 'Their retainer plan sets this; the planner link shows the same number.' : 'What they are owed each month. The Content Kit is 8.'}</p>
                </div>
                <Textarea label="Welcome message" rows={3} maxLength={300} value={draft.welcome} disabled={readOnly}
                  onChange={(e) => setPlanner({ welcome: e.target.value.slice(0, 300) })}
                  hint={`Appears at the top of their planner. ${draft.welcome.length} of 300.`} />
              </Card>
  );
  const inviteCard = (draft.enabled && url) ? <InviteCard planner={lead.planner || {}} url={url} readOnly={readOnly}
                onRegenerate={async () => {
                  const ok = await onPatch(lead._id, { planner: { ...plannerPatch(lead, draft), regenerate: true } });
                  if (ok) { await onRefetchLead?.(); toast.success('New link made. The old one stopped working.'); }
                  else toast.error(COPY.error.save);
                }} /> : null;
  const open = openId ? monthPosts.find(p => String(p._id) === openId) || mine.find(p => String(p._id) === openId) : null;
  const ideasCard = (
              <Card className="pl-ideas">
                <Row gap={2} align="center" justify="between" wrap>
                  <p className="pb-card-h">Ideas{newIdeas ? `, ${newIdeas} new` : ''}</p>
                  <span className="dt-muted">What they asked for from their planner.</span>
                </Row>
                {!ideas.length
                  ? <p className="pl-note">No ideas yet. They send one from Ideas on their planner, and it lands here with a task on their Ideas checklist.</p>
                  : <Stack gap={2}>{ideas.map(s => <IdeaRow key={s._id} s={s} busy={busy} readOnly={readOnly} onMake={makeFromIdea} onDecline={declineIdea} />)}</Stack>}
              </Card>
  );

  return (
    <PageShell className="aa-main aa-main--wide pl-page sb-host">
      <ScrollArea wide className="pl-scroll">
        <div className="pl-topbar">
          <Row gap={2} align="center" justify="between" wrap>
            <Row gap={2} align="center" wrap style={{ minWidth: 0 }}>
              <Button variant="ghost" icon="ArrowLeft" onClick={leave} className="pl-back">Back</Button>
              <h1 className="pl-page-title lay-title">{name}</h1>
              <Pill tone={!draft.enabled ? 'neutral' : waiting ? 'new' : 'booked'} size="sm" icon={false}
                variant={draft.enabled && !waiting ? 'solid' : 'soft'}
                label={!draft.enabled ? 'Off' : waiting ? `${waiting} in review` : 'On'} />
              {newIdeas > 0 && <Pill tone="new" size="sm" icon="Lightbulb02" variant="solid" label={`${newIdeas} idea${newIdeas === 1 ? '' : 's'}`} className="pl-ideas-pill" />}
            </Row>
            <Button variant="secondary" icon="LinkExternal01" disabled={!url}
              onClick={() => window.open(`/api/planner?token=${encodeURIComponent(token)}&month=${month}`, '_blank', 'noopener')}>Preview</Button>
          </Row>
        </div>

        <div className="pl-page-body">
          {error && !mine.length ? (
            <Card><ErrorState title={COPY.error.posts.title} description={COPY.error.posts.description} onRetry={onRetry} /></Card>
          ) : showSkel ? (
            <Stack gap={3} aria-busy="true">{[1, 2, 3].map(i => <Card key={i}><SkeletonText lines={3} /></Card>)}</Stack>
          ) : (
            <Stagger className="v-stack" style={{ gap: 'var(--v-space-4)' }}>
              {(!phone || step === 'Setup') && setupCard}
              {(!phone || step === 'Link') && inviteCard}
              {((!phone && (ideas.length > 0 || draft.enabled)) || step === 'Ideas') && ideasCard}
              {phone && !step && (
                <Stack gap={2}>
                  <ListRow title="Setup" subtitle={!draft.enabled ? 'Off' : `On, ${cap} a month`} onClick={() => openStep('Setup')} />
                  {draft.enabled && url && <ListRow title="Client link" subtitle="Share or regenerate" onClick={() => openStep('Link')} />}
                  <ListRow title="Ideas" subtitle={newIdeas ? `${newIdeas} new` : ideas.length ? `${ideas.length} answered` : 'None yet'} onClick={() => openStep('Ideas')}
                    trailing={newIdeas ? <Pill tone="new" size="sm" icon={false} variant="solid" label={String(newIdeas)} /> : undefined} />
                </Stack>
              )}

              {!inStep && (<>
              <Card className="pl-month">
                <Row gap={2} align="center" justify="between" wrap>
                  <Row gap={1} align="center">
                    <IconButton icon="ChevronLeft" label="Previous month" variant="ghost" onClick={() => setMonth(m => shiftMonth(m, -1))} />
                    <span className="pl-month-name">{monthLabel(month)}</span>
                    <IconButton icon="ChevronDown" label="Next month" variant="ghost" className="pl-next" onClick={() => setMonth(m => shiftMonth(m, 1))} />
                  </Row>
                  {!readOnly && (
                    <Row gap={2} align="center" wrap>
                      <Menu label="Month actions" items={[
                        { id: 'copy', label: `Copy ${monthLabel(shiftMonth(month, -1))} across`, icon: 'Copy01', onSelect: copyLastMonth },
                        'divider',
                        { id: 'add', label: 'Add post', icon: 'Plus', onSelect: addPost },
                        { id: 'add-ad', label: 'Add ad', icon: 'Zap', onSelect: () => addItem({ kind: 'ad' }) },
                        { id: 'add-video', label: 'Add video', icon: 'Play', onSelect: () => addItem({ format: 'video' }) },
                      ]} />
                      <Button size="md" icon="Plus" onClick={addPost} loading={busy} className="pl-add">Add post</Button>
                    </Row>
                  )}
                </Row>
                <ProgressBar value={cap ? Math.min(100, (monthPostCount / cap) * 100) : 0}
                  tone={monthPostCount >= cap ? 'booked' : 'progress'}
                  label={`${monthPostCount} of ${cap} posts${monthAdCount ? `, ${monthAdCount} ad${monthAdCount === 1 ? '' : 's'}` : ''}`} />
              </Card>

              {!monthPosts.length ? (
                <Card><EmptyState icon="Calendar" title={COPY.empty['planner.month'].title} description={COPY.empty['planner.month'].description}
                  action={readOnly ? undefined : { label: COPY.empty['planner.month'].action, onClick: addPost }} /></Card>
              ) : (
                <Stack gap={2} className="pl-list">
                  {monthPosts.map((p, i) => (
                    <PostRow key={p._id} post={p} draft={postDrafts[String(p._id)]} client={name}
                      first={i === 0} last={i === monthPosts.length - 1} readOnly={readOnly}
                      onOpen={() => setOpenId(String(p._id))}
                      onSendForApproval={phone ? () => { writePost(p._id, { status: 'review' }); toast.info(`${postLabel(p)} is ready to send. Save to send it.`); } : undefined}
                      onMove={(by) => movePost(p, by)}
                      dragProps={!readOnly && desktop ? {
                        draggable: true,
                        onDragStart: () => { drag.current = i; },
                        onDragOver: (e) => e.preventDefault(),
                        onDrop: () => { const from = drag.current; drag.current = null; if (from == null || from === i) return; movePost(monthPosts[from], i - from); },
                      } : {}} />
                  ))}
                </Stack>
              )}
              </>)}
            </Stagger>
          )}
        </div>
      </ScrollArea>

      {open && (
        <PostSheet
          post={open}
          draft={postDrafts[String(open._id)] || {}}
          client={name}
          lastHashtags={lastHashtags}
          readOnly={readOnly}
          focusImage={!!freshId && String(open._id) === freshId}
          onWrite={(next) => writePost(open._id, next)}
          onDelete={() => removePost(open)}
          onClose={() => setOpenId(null)}
        />
      )}

      <SaveBar open={dirty && !inStep} saving={saving} onSave={save} onDiscard={discard} />
      {confirmDialog}
      <style>{saveBarStyles + imageFieldStyles + videoFieldStyles + postSheetStyles + plStyles}</style>
    </PageShell>
  );
}

const plStyles = `
  .pl-scroll { --v-scroll-extra: var(--sb-scroll-extra); }
  .pl-topbar {
    position: sticky; top: 0; z-index: 5;
    padding: var(--v-space-3) 0;
    background: var(--v-surface-1);
    border-bottom: 1px solid var(--v-border-1);
  }
  @media (max-width: 767px) { .pl-topbar .pl-back { display: none; } }
  .pl-page-title { font-size: var(--v-text-lg); font-weight: 700; color: var(--v-text-1); margin: 0; min-width: 0; }
  .pl-page-body { padding-top: var(--v-space-4); }
  .pl-note { margin: var(--v-space-1) 0 0; font-size: var(--v-text-xs); color: var(--v-text-3); }
  .pl-month-name { font-size: var(--v-text-md); font-weight: var(--v-weight-bold); color: var(--v-text-1); min-width: 8ch; }
  /* One chevron glyph, turned, rather than a second icon import. */
  .pl-next svg { transform: rotate(-90deg); }
  .pl-list { min-width: 0; }
  .pl-post { gap: var(--v-space-2); text-align: left; align-items: stretch; }
  .pl-post:has(> .v-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .pl-post .v-stretch:focus-visible { outline: 0; }
  .pl-thumb { width: 72px; flex: 0 0 72px; border: 1px solid var(--v-border); }
  .pl-plats { display: inline-flex; align-items: center; gap: 2px; }
  .pl-plat {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: var(--v-radius-sm);
    background: var(--v-surface-3); color: var(--sc, var(--v-text-2));
  }
  .pl-plat--more { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .pl-missing { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-status-danger-text); }
  .pl-mismatch { font-size: var(--v-text-xs); color: var(--v-status-new-text); }
  .pl-thumb-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--v-text-3); }
  .pl-post-when { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text-1); }
  .pl-post-label { font-size: var(--v-text-sm); color: var(--v-text-2); }
  /* The one thing on this page that is somebody else waiting on Rob. */
  .pl-clientnote {
    position: relative; z-index: 1;
    display: flex; flex-direction: column; gap: var(--v-space-1);
    padding: var(--v-space-2) var(--v-space-3);
    border-radius: var(--v-radius-md);
    background: var(--v-surface-3); color: var(--v-text-2);
  }
  .pl-clientnote.is-new { background: var(--v-status-danger-soft); color: var(--v-status-danger-text); }
  .pl-clientnote-who { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); }
  .pl-clientnote-body { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  /* The ideas inbox: a new idea is somebody waiting on Rob. */
  .pl-idea { gap: 0; }
  .pl-idea.is-new { border-color: var(--v-status-new-text); }
  .pl-idea-subject { font-size: var(--v-text-md); font-weight: var(--v-weight-bold); color: var(--v-text-1); overflow-wrap: anywhere; }
  .pl-idea-goal { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .pl-idea-details { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); white-space: pre-wrap; overflow-wrap: anywhere; }
  .pl-idea-note { margin: 0; padding: var(--v-space-2) var(--v-space-3); border-radius: var(--v-radius-md); background: var(--v-surface-3); font-size: var(--v-text-sm); color: var(--v-text-2); }
  .pl-idea-photo { display: inline-flex; width: 56px; height: 56px; border-radius: var(--v-radius-sm); overflow: hidden; border: 1px solid var(--v-border-1); }
  .pl-idea-photo img { width: 100%; height: 100%; object-fit: cover; }
  .pl-idea-link { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text-1); text-decoration: underline; min-height: var(--v-tap); display: inline-flex; align-items: center; }
`;
