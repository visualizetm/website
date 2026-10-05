import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageShell, ScrollArea, Button, Sheet, Input, Select, EmptyState, ErrorState, SkeletonBlock, useToast, useMediaQuery, useDelayedLoading } from '../ui';
import RowSheet from '../components/RowSheet';
import DocEditor from '../components/docs/DocEditor';
import TitleField from '../components/docs/TitleField';
import BlockView from '../components/docs/BlockView';
import { docEditorStyles } from '../components/docs/docs.styles';
import { copyText } from '../components/ClientWorkspace';
import { useTopBar, useShell } from '../shell/ShellContext';
import { DOC_TYPES, sanitizeTitle, docPlainText } from '../shared/docBlocks';
import { fetchDoc, patchDocBeacon, typeLabel } from '../lib/docs';
import { createSaver, release, takeover } from '../lib/docSave';
import { ensureBlock, tidy } from '../lib/docEdit';
import { refTarget } from '../lib/docRefs';
import { safeHref } from '../lib/safeUrl';
import { fmtDate } from '../shared/dates';
import { COPY } from '../shared/copy';

/* A doc (docs job, milestone 3), at /docs/:id: a focused screen on a phone (the tab bar hidden, Back through nav-history, the edge swipe),
 * a routed page on a computer. The title, the type, the blocks (src/components/docs/DocEditor.jsx), the save state in the header and the
 * header actions: Pin to card, Duplicate, Save as template, Export (copy as text, print or save as PDF through the browser's print sheet),
 * Move to Recently Deleted.
 *
 * Autosave is src/lib/docSave.js: about a second after the last key, "Saving" then "Saved"; a failed save keeps the text, says "Not saved,
 * retrying" and retries; Back saves first, and text that could not be saved stays in memory and is handed back to the next open of the doc.
 * A deleted doc opens read only with Restore. */

const SAVE_LABEL = { saved: 'Saved', dirty: 'Saving...', saving: 'Saving...', failed: 'Not saved, retrying', rejected: 'Not saved' };

export default function AdminDoc({ docId, leads, projects, sets, leadsLoading, docsApi, onBack, onOpenProject }) {
  const toast = useToast();
  const shell = useShell();
  const phone = useMediaQuery('(max-width: 767px)');
  const [load, setLoad] = useState({ state: 'loading', doc: null });
  const [title, setTitle] = useState('');
  const [type, setType] = useState('general');
  const [projectId, setProjectId] = useState('');
  const [pinned, setPinned] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [saveState, setSaveState] = useState('saved');
  const [sheet, setSheet] = useState(null); // 'more' | 'template'
  const saverRef = useRef(null);
  const live = useRef({});
  live.current = { title, type, blocks, docId };
  const ops = docsApi?.ops;
  const showSkel = useDelayedLoading(load.state === 'loading');

  /* Load the doc; text a closed editor could not save comes back with it and is sent again at once. */
  const fetchIt = useCallback(async () => {
    setLoad({ state: 'loading', doc: null });
    const r = await fetchDoc(docId);
    if (r.status === 404) { setLoad({ state: 'missing', doc: null }); return; }
    if (!r.ok) { setLoad({ state: 'error', doc: null }); return; }
    const doc = r.data.item;
    const back = takeover(docId);
    setTitle(back?.title ?? doc.title ?? ''); setType(back?.type ?? doc.type ?? 'general'); setProjectId(doc.projectId || ''); setPinned(!!doc.pinned);
    setBlocks(ensureBlock(back?.blocks ?? doc.blocks ?? []));
    setLoad({ state: 'ready', doc, recovered: !!back });
  }, [docId]);
  useEffect(() => { fetchIt(); }, [fetchIt]);

  const readOnly = !!load.doc?.deleted;
  /* The saver: one per open doc. */
  useEffect(() => {
    if (load.state !== 'ready' || readOnly || !ops) return undefined;
    const id = docId;
    const saver = createSaver({
      onStatus: setSaveState,
      save: async (p) => {
        const r = await ops.patch(id, p);
        if (r.ok) return true;
        if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) { toast.error(r.error || 'That did not save.'); return 'rejected'; }
        return false;
      },
    });
    saverRef.current = saver;
    if (load.recovered) saver.dirty({ title: live.current.title, type: live.current.type, blocks: tidy(live.current.blocks) });
    const hide = () => { if (document.visibilityState === 'hidden' && saver.unsaved && saver.latest) { patchDocBeacon(id, saver.latest); saver.flush(); } };
    const online = () => saver.retryNow();
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', hide); window.addEventListener('online', online);
    return () => {
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', hide); window.removeEventListener('online', online);
      release(id, saver);
      saverRef.current = null;
    };
  }, [load.state, load.recovered, readOnly, docId, ops]); // eslint-disable-line react-hooks/exhaustive-deps

  const touch = useCallback((patch = {}) => {
    const cur = { title: live.current.title, type: live.current.type, blocks: live.current.blocks, ...patch };
    saverRef.current?.dirty({ title: sanitizeTitle(cur.title) || 'Untitled', type: cur.type, blocks: tidy(cur.blocks) });
  }, []);
  const onBlocks = useCallback((next) => { setBlocks(next); touch({ blocks: next }); }, [touch]);
  const onTitle = (v) => { setTitle(v); touch({ title: v }); };
  const onType = (v) => { setType(v); touch({ type: v }); };

  const doc = load.doc;
  const lead = useMemo(() => leads.find(l => String(l._id) === String(doc?.leadId)) || null, [leads, doc]);
  const ctx = useMemo(() => ({ lead: lead || {}, projects: projects.filter(p => String(p.leadId) === String(doc?.leadId)), sets: sets.filter(s => String(s.leadId) === String(doc?.leadId)) }), [lead, projects, sets, doc]);

  const leave = useCallback(async () => {
    const ok = saverRef.current ? await saverRef.current.flush() : true;
    if (!ok) toast.info('Not saved yet. It keeps trying and your text is safe.');
    onBack();
  }, [onBack, toast]);
  const flushThen = async (fn) => { await saverRef.current?.flush(); fn(); };

  const pin = async () => {
    const next = !pinned; setPinned(next);
    const r = await ops.patch(docId, { pinned: next });
    if (!r.ok) { setPinned(!next); toast.error(COPY.error.save); } else toast.success(next ? 'Pinned to the card.' : 'Unpinned.');
  };
  const duplicate = async () => {
    await saverRef.current?.flush();
    const item = await ops.duplicate({ _id: docId });
    if (item) { toast.success('Duplicated.'); docsApi.openDoc(item); } else toast.error(COPY.error.save);
  };
  const copyAll = () => copyText(toast, docPlainText({ title: sanitizeTitle(title), blocks: tidy(blocks) }), 'Doc');
  const printIt = () => { setTimeout(() => window.print(), 50); };
  const remove = async () => {
    await saverRef.current?.flush();
    const d = { _id: docId, leadId: doc.leadId, title: sanitizeTitle(title) || doc.title };
    if (!(await ops.remove(d))) { toast.error(COPY.error.save); return; }
    toast.undo('Moved to Recently Deleted.', () => ops.restore(docId), { seconds: 6 });
    onBack();
  };
  const restore = async () => { if (await ops.restore(docId)) { toast.success('Restored.'); fetchIt(); } else toast.error(COPY.error.save); };
  const saveTemplate = async (name) => {
    const clean = tidy(blocks).filter(b => b.type !== 'ref');
    const item = await ops.create({ template: true, type, title: name, blocks: clean });
    if (item) toast.success('Saved as a template. Settings manages it.'); else toast.error(COPY.error.save);
    return !!item;
  };
  const openRef = async (b) => {
    const t = refTarget(b.ref, ctx);
    if (!t || !lead) return;
    await saverRef.current?.flush();
    if (t.to === 'concepts') shell.openConcepts(lead, t.setId);
    else if (t.to === 'project') (onOpenProject || docsApi.openProject)?.(t.projectId);
    else if (t.to === 'tasks') shell.openTasks(lead, t.projectId ? ctx.projects.find(p => String(p._id) === String(t.projectId)) : undefined);
    else if (t.to === 'deal') shell.openRecord(lead, 'payments');
    else if (t.to === 'link') window.open(safeHref(t.href), '_blank', 'noopener');
    else shell.openRecord(lead);
  };

  useTopBar(load.state === 'ready' ? {
    title: typeLabel(type), back: leave,
    actions: readOnly ? null : [
      { id: 'pin', label: pinned ? 'Unpin from card' : 'Pin to card', icon: 'Pin01', onClick: pin },
      { id: 'more', label: 'Doc actions', icon: 'DotsHorizontal', onClick: () => setSheet('more') },
    ],
  } : { title: 'Doc', back: leave });

  const moreItems = [
    { id: 'copy', label: 'Copy as text', icon: 'Copy01', onSelect: copyAll },
    { id: 'print', label: 'Print or save as PDF', icon: 'Printer', onSelect: printIt },
    { id: 'dup', label: 'Duplicate', icon: 'FilePlus01', onSelect: duplicate },
    { id: 'tpl', label: 'Save as template', icon: 'Save01', onSelect: () => setSheet('template') },
    'divider',
    { id: 'del', label: 'Move to Recently Deleted', icon: 'Trash01', danger: true, onSelect: remove },
  ];

  let body;
  if (load.state === 'loading') {
    body = showSkel ? (
      <div className="dd-skel" aria-busy="true" aria-hidden="true"><SkeletonBlock height={40} width="70%" radius="var(--v-radius-md)" /><SkeletonBlock height={28} width="45%" radius="var(--v-radius-md)" />{[0, 1, 2, 3, 4].map(i => <SkeletonBlock key={i} height={44} radius="var(--v-radius-md)" />)}</div>
    ) : null;
  } else if (load.state === 'missing') {
    body = <EmptyState icon="File02" title="This doc is not here" description="It may have been purged from Recently Deleted." action={{ label: 'Back', onClick: onBack }} />;
  } else if (load.state === 'error') {
    body = <ErrorState title={COPY.error.leads.title} description="The doc did not load. Nothing was lost." onRetry={fetchIt} />;
  } else {
    body = (
      <>
        {readOnly && <div className="dd-deleted" role="status"><span>In Recently Deleted. It is read only until you restore it.</span><Button variant="secondary" size="md" icon="ReverseLeft" onClick={restore} className="dd-restore">Restore</Button></div>}
        <div className="dd-head">
          <TitleField value={title} onChange={onTitle} readOnly={readOnly} onEnter={() => document.querySelector('.dc-rt')?.focus()} />
          <div className="dd-meta">
            <p className="dd-client">{lead ? <button type="button" className="dd-clientbtn" onClick={() => flushThen(() => shell.openRecord(lead))}>{lead.business}</button> : (leadsLoading ? <SkeletonBlock width={120} height={16} /> : 'Client not found')}</p>
            <p className={`dd-status is-${saveState}`} role="status" aria-live="polite" data-save={saveState}>{readOnly ? '' : SAVE_LABEL[saveState]}</p>
          </div>
          <div className="dd-selects">
            <Select label="Type" value={type} disabled={readOnly} onChange={(e) => onType(e.target.value)} options={DOC_TYPES.map(t => ({ id: t.id, label: t.label }))} className="dd-type" />
            {ctx.projects.length > 0 && (
              <Select label="Project" value={projectId} disabled={readOnly} onChange={async (e) => { const v = e.target.value; setProjectId(v); const r = await ops.patch(docId, { projectId: v }); if (!r.ok) toast.error(COPY.error.save); }}
                options={[{ id: '', label: 'None' }, ...ctx.projects.map(p => ({ id: String(p._id), label: p.name || 'Project' }))]} className="dd-project" />
            )}
          </div>
        </div>
        <DocEditor blocks={blocks} onChange={onBlocks} readOnly={readOnly} ctx={ctx} openRef={openRef} />
      </>
    );
  }

  const printDoc = load.state === 'ready' && typeof document !== 'undefined' ? createPortal(
    <div className="dp-doc" aria-hidden="true">
      <p className="dp-kicker">{typeLabel(type)}{lead ? `, ${lead.business}` : ''}</p>
      <h1 className="dp-title">{sanitizeTitle(title) || 'Untitled'}</h1>
      <p className="dp-date">{fmtDate(new Date().toISOString())}</p>
      <BlockView blocks={tidy(blocks)} ctx={ctx} />
    </div>, document.body) : null;

  return (
    <PageShell className="aa-main aa-main--wide dd-page">
      <ScrollArea wide className="dd-scroll">
        {!phone && (
          <div className="dd-topbar">
            <Button variant="ghost" icon="ArrowLeft" onClick={leave} className="dd-back">Back</Button>
            <span className="dd-topspace" />
            {load.state === 'ready' && !readOnly && <Button variant="ghost" icon="Pin01" onClick={pin} className="dd-pin" aria-pressed={pinned}>{pinned ? 'Pinned' : 'Pin to card'}</Button>}
            {load.state === 'ready' && !readOnly && <Button variant="secondary" icon="DotsHorizontal" onClick={() => setSheet('more')} className="dd-more">Doc actions</Button>}
          </div>
        )}
        <div className="dd-body">{body}</div>
      </ScrollArea>
      {sheet === 'more' && <RowSheet title={sanitizeTitle(title) || 'Untitled'} subtitle={`${typeLabel(type)}${lead ? `, ${lead.business}` : ''}`} items={moreItems} onClose={() => setSheet(null)} />}
      {sheet === 'template' && <TemplateNameSheet initial={sanitizeTitle(title)} onSave={saveTemplate} onClose={() => setSheet(null)} />}
      {printDoc}
      <style>{docEditorStyles}</style>
    </PageShell>
  );
}

function TemplateNameSheet({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial || '');
  const [busy, setBusy] = useState(false);
  const save = async () => { if (!name.trim() || busy) return; setBusy(true); try { if (await onSave(name.trim().slice(0, 160))) onClose(); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={onClose} title="Save as template" label="Save as template" width={440}
      footer={<div className="dd-sheetfoot"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="Check" onClick={save} disabled={!name.trim()} loading={busy} className="dd-template-save">Save template</Button></div>}>
      <Input label="Template name" value={name} onChange={(e) => setName(e.target.value.slice(0, 160))} required data-autofocus onKeyDown={(e) => { if (e.key === 'Enter') save(); }} hint="References to their records are left out. The words and the structure stay." />
    </Sheet>
  );
}

