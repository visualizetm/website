import { useState } from 'react';
import { Sheet, Stack, Button, Input, Pill, Icon, ChipGroup, SegmentedControl, useToast } from '../ui';
import { useRoom } from './RoomApp';
import { roomApi } from './roomApi';
import { targetLists, isRobList, leftLine, onRobList, facet, fillPreview, fillLine, plural } from './roomLib';

/* The sorting sheets (Billy's Call Room): where a lead goes (Put it on a list), a new list (New list), and the confirm
 * before a lead leaves a list Rob calls. The walls are on the server (api/_routes/caller.js): a move off Rob's list needs
 * `confirm: true` and is refused outright when Rob switched it off; these sheets only ask the question first. */

/** One row of a single choice (a radio): a title, a line under it, a pill at the right. */
function Choice({ on, onPick, title, sub, pill = null, ...rest }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`rm-choice${on ? ' is-on' : ''}`} onClick={onPick} {...rest}>
      <span className="rm-choice-main"><span className="rm-choice-title">{title}</span>{sub && <span className="rm-choice-sub">{sub}</span>}</span>
      {pill}
      <span className="rm-choice-tick" aria-hidden="true">{on && <Icon icon="Check" size="var(--v-icon-sm)" />}</span>
    </button>
  );
}

/** Put it on a list: the open lists, most recent first (Rob's marked), a New list row, and for Triage "No list yet". */
export function PutOnListSheet({ title = 'Put it on a list', description = '', cta = 'Add to list', allowNone = false, exceptId = '', busy = false, onClose, onConfirm }) {
  const { lists } = useRoom();
  const open = targetLists(lists).filter(l => String(l.id) !== String(exceptId));
  const [pick, setPick] = useState(() => (open.find(l => !isRobList(l)) || open[0])?.id || 'new');
  const [name, setName] = useState('');
  const ready = pick !== 'new' || !!name.trim();
  const confirm = () => onConfirm(pick === 'new' ? { newList: name.trim() } : pick === 'none' ? { none: true } : { listId: pick, list: open.find(l => l.id === pick) });
  return (
    <Sheet open onClose={onClose} title={title} description={description} label={title} className="rm-put"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!ready} onClick={confirm} className="rm-put-go">{cta}</Button></>}>
      <Stack gap={3}>
        <div role="radiogroup" aria-label="Where it goes" className="rm-choices">
          {open.map(l => <Choice key={l.id} on={pick === l.id} onPick={() => setPick(l.id)} title={l.name} sub={leftLine(l)} pill={isRobList(l) ? <Pill label="Rob calls it" tone="neutral" icon={false} size="sm" /> : null} data-choice={l.id} />)}
          <Choice on={pick === 'new'} onPick={() => setPick('new')} title="New list" sub="Name it and it is yours to call" data-choice="new" />
          {allowNone && <Choice on={pick === 'none'} onPick={() => setPick('none')} title="No list yet, just add it to Leads" data-choice="none" />}
        </div>
        {pick === 'new' && <Input label="List name" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} maxLength={80} autoComplete="off" data-autofocus />}
      </Stack>
    </Sheet>
  );
}

/** Before a lead leaves a list Rob calls: Move it or Leave it. `verb` is move or decline. */
export function MoveConfirmSheet({ rows, target, verb = 'move', onMove, onLeave }) {
  const one = rows.length === 1;
  const title = one ? "That one is on Rob's list." : "Those are on Rob's lists.";
  const ask = verb === 'decline' ? (one ? 'Take it off and decline it?' : 'Take them off and decline them?') : `Move ${one ? 'it' : 'them'} to ${target}?`;
  const body = one ? `${rows[0].business} is on ${rows[0].list}, which Rob calls. ${ask}` : `${rows.length} leads are on lists Rob calls. ${ask}`;
  return (
    <Sheet open onClose={onLeave} title={title} label={title} className="rm-move"
      footer={<><Button variant="ghost" onClick={onLeave} className="rm-move-leave">Leave {one ? 'it' : 'them'}</Button><Button onClick={onMove} className="rm-move-go">{verb === 'decline' ? `Decline ${one ? 'it' : 'them'}` : `Move ${one ? 'it' : 'them'}`}</Button></>}>
      <Stack gap={3}>
        <p className="rm-text-body">{body}</p>
        <p className="cs-hint">Rob will see this in your day.</p>
      </Stack>
    </Sheet>
  );
}

/** A write that may take leads off a list Rob calls: the question comes first, the server checks it again.
 *  run({ leads, targetId, targetName, verb, fn, build }) where build(ids, confirm) is the body. Leave it drops those leads
 *  and carries on with the rest; the answer is { ok, left } when nothing was left to write. */
export function useListMove() {
  const { lists, write } = useRoom();
  const [ask, setAsk] = useState(null);
  const run = async ({ leads, targetId = '', targetName = 'the new list', verb = 'move', fn, build }) => {
    let ids = leads.map(l => l.id);
    let confirm = false;
    const settle = async (rows) => {
      const answer = await new Promise(resolve => setAsk({ rows, target: targetName, verb, resolve }));
      setAsk(null);
      if (answer === 'move') { confirm = true; return true; }
      ids = ids.filter(id => !rows.some(r => r.id === id));
      return ids.length > 0;
    };
    const known = leads.map(l => ({ l, on: onRobList(l, lists) })).filter(x => x.on && String(x.on.id) !== String(targetId)).map(x => ({ id: x.l.id, business: x.l.business, list: x.on.name }));
    if (known.length && !(await settle(known))) return { ok: false, left: true, ids: [] };
    let r = await write(fn, build(ids, confirm));
    if (r.status === 409 && r.data?.confirm && Array.isArray(r.data.onRobLists) && !confirm) {
      if (!(await settle(r.data.onRobLists))) return { ok: false, left: true, ids: [] };
      r = await write(fn, build(ids, confirm));
    }
    return { ...r, ids };
  };
  return { run, sheet: ask ? <MoveConfirmSheet rows={ask.rows} target={ask.target} verb={ask.verb} onMove={() => ask.resolve('move')} onLeave={() => ask.resolve('leave')} /> : null };
}

const FILLS = [{ id: 'filter', label: 'A filter' }, { id: 'hand', label: 'By hand' }, { id: 'empty', label: 'Empty' }];
const WHO = [{ id: 'billy', label: 'Me' }, { id: 'rob', label: 'Rob' }];

/** New list: a name, what fills it (a filter counted before anything is written, by hand in Leads, or nothing), who calls it. */
export function NewListSheet({ onClose, onByHand, onMade }) {
  const { leads, lists, write, applyList } = useRoom();
  const toast = useToast();
  const [name, setName] = useState('');
  const [mode, setMode] = useState('filter');
  const [types, setTypes] = useState(() => new Set());
  const [cities, setCities] = useState(() => new Set());
  const [noList, setNoList] = useState(false);
  const [who, setWho] = useState('billy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sorted = leads.filter(l => l.stage === 'lead');
  const preview = fillPreview(leads, lists, { types: [...types], cities: [...cities], noList });
  const n = mode === 'filter' ? preview.add : 0;
  const clean = name.trim();
  const make = async () => {
    if (!clean) { setError('Give the list a name.'); return; }
    if (mode === 'hand') { onByHand({ name: clean, callerId: who }); return; }
    setBusy(true);
    const r = await write(roomApi.list, { op: 'create', name: clean, callerId: who, fill: mode === 'filter' ? { mode: 'filter', types: [...types], cities: [...cities] } : { mode: 'empty' } });
    setBusy(false);
    if (!r.ok) { setError(r.data?.error || 'That did not save. Try again in a moment.'); return; }
    if (r.data?.list) applyList(r.data.list);
    toast.success(`${clean} is made${r.data?.added ? ` with ${plural(r.data.added, 'lead')}` : ''}.`);
    onMade(r.data?.list);
  };
  const cta = mode === 'hand' ? 'Pick the leads' : mode === 'filter' ? `Make list of ${n}` : 'Make empty list';
  return (
    <Sheet open onClose={onClose} title="New list" label="New list" className="rm-newlist"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} disabled={mode === 'filter' && !n} onClick={make} className="rm-newlist-go">{cta}</Button></>}>
      <Stack gap={4}>
        <Input label="Name" value={name} onChange={(e) => { setName(e.target.value.slice(0, 80)); setError(''); }} maxLength={80} autoComplete="off" error={error} placeholder="Dover barbers" data-autofocus />
        <Stack gap={2}>
          <p className="rm-k" id="rm-fill-k">Fill it with</p>
          <SegmentedControl full size="sm" label="Fill it with" options={FILLS} value={mode} onChange={setMode} />
        </Stack>
        {mode === 'filter' && (
          <Stack gap={3} className="rm-fill">
            {facet(sorted, 'type').length > 0 && <Stack gap={1}><p className="rm-row-sub">Business type</p><ChipGroup label="Business type" options={facet(sorted, 'type').map(f => ({ id: f.value, label: f.value, count: f.count }))} value={types} onChange={setTypes} className="rm-fill-chips" /></Stack>}
            {facet(sorted, 'city').length > 0 && <Stack gap={1}><p className="rm-row-sub">City</p><ChipGroup label="City" options={facet(sorted, 'city').map(f => ({ id: f.value, label: f.value, count: f.count }))} value={cities} onChange={setCities} className="rm-fill-chips" /></Stack>}
            <ChipGroup label="On a list" options={[{ id: 'nolist', label: 'No list yet' }]} value={noList ? new Set(['nolist']) : new Set()} onChange={(v) => setNoList(v.has('nolist'))} allWhenEmpty={false} className="rm-fill-chips" />
            <p className="rm-fill-line" role="status" aria-live="polite">{fillLine(preview)}</p>
          </Stack>
        )}
        {mode === 'hand' && <p className="cs-hint">Leads opens with checkboxes. Tick the ones you want, then Make list.</p>}
        {mode === 'empty' && <p className="cs-hint">The list starts with nobody on it. Add leads from Triage or Leads.</p>}
        <Stack gap={2}>
          <p className="rm-k">Who calls it</p>
          <SegmentedControl full size="sm" label="Who calls it" options={WHO} value={who} onChange={setWho} />
        </Stack>
      </Stack>
    </Sheet>
  );
}

/** Rename a list Billy made. */
export function RenameListSheet({ list, onClose }) {
  const { write, applyList } = useRoom();
  const [name, setName] = useState(list.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    const r = await write(roomApi.list, { op: 'rename', id: list.id, name: name.trim() });
    setBusy(false);
    if (!r.ok) { setError(r.data?.error || 'That did not save. Try again in a moment.'); return; }
    if (r.data?.list) applyList(r.data.list);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Rename the list" description={list.name} label="Rename the list"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!name.trim() || name.trim() === list.name} onClick={save}>Save</Button></>}>
      <Input label="Name" value={name} onChange={(e) => { setName(e.target.value.slice(0, 80)); setError(''); }} maxLength={80} autoComplete="off" error={error} data-autofocus />
    </Sheet>
  );
}
