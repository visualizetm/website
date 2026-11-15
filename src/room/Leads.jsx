import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Stack, Row, Card, Button, Input, Chip, Checkbox, Pill, Icon, EmptyState, NoResults, StickyFooterBar, useDelayedLoading, useToast } from '../ui';
import DeclineSheet from '../components/DeclineSheet';
import { COPY } from '../shared/copy';
import { useRoom } from './RoomApp';
import { roomApi } from './roomApi';
import { RoomError, RowsSkeleton } from './parts';
import { PutOnListSheet, useListMove } from './sheets';
import { LEAD_CHIPS, filterLeads, chipCounts, subLine, listOf, isRobList, onRobList, plural } from './roomLib';

/* Leads (Billy's Call Room): every lead on his side of the line (triage, lead, nurture). A search (name, city, owner),
 * three chips with counts, and rows: a 44px checkbox, the name, "type · city · score" and the list it is on. Ticking
 * rows raises a bar: N selected, Add to list, Decline, Clear; whatever it does goes as one batch write. A lead on a list
 * Rob calls asks first (Move it or Leave it); when Rob switched the moves off it shows locked and cannot be ticked.
 * With a list in the making (New list, By hand) the bar's one action is Make list of N. */
export default function Leads({ footEl, draft, setDraft }) {
  const { me, leads, lists, loading, error, go, applyList } = useRoom();
  const toast = useToast();
  const move = useListMove();
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('all');
  const [checked, setChecked] = useState(() => new Set());
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const show = useDelayedLoading(loading);
  if (error) return <RoomError />;
  if (loading) return show ? <RowsSkeleton rows={6} /> : <div className="rm-wait" />;
  const c = COPY.room.empty.leads;
  if (!leads.length) return <EmptyState icon="Users01" title={c.title} description={c.description} />;

  const locked = (l) => me.moveOffRobLists === false && !!onRobList(l, lists);
  const rows = filterLeads(leads, lists, { q, chip });
  const counts = chipCounts(leads, lists, q);
  const picked = leads.filter(l => checked.has(l.id) && !locked(l));
  const toggle = (id, on) => setChecked(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });
  const clear = () => { setChecked(new Set()); if (draft) setDraft(null); };
  const failed = (r) => toast.error(r.status === 404 ? 'One of those is not yours to sort any more.' : r.data?.error || COPY.room.saveFailed);

  const addTo = async (pick) => {
    setSheet(null); setBusy(true);
    const r = await move.run({ leads: picked, targetId: pick.listId || '', targetName: pick.list?.name || pick.newList, fn: roomApi.batch, build: (ids, confirm) => ({ op: 'list', leadIds: ids, ...(pick.listId ? { listId: pick.listId } : { newList: pick.newList }), ...(confirm ? { confirm: true } : {}) }) });
    setBusy(false);
    if (r.left) return;
    if (!r.ok) { failed(r); return; }
    applyList(r.data?.list); setChecked(new Set());
    toast.success(`${plural(r.ids.length, 'lead')} on ${r.data?.list?.name || 'the list'}.`);
  };
  const decline = async (reason, note) => {
    setSheet(null); setBusy(true);
    const r = await move.run({ leads: picked, verb: 'decline', fn: roomApi.batch, build: (ids, confirm) => ({ op: 'decline', leadIds: ids, reason, note, ...(confirm ? { confirm: true } : {}) }) });
    setBusy(false);
    if (r.left) return;
    if (!r.ok) { failed(r); return; }
    setChecked(new Set());
    toast.success(`${plural(r.ids.length, 'lead')} declined.`);
  };
  const makeByHand = async () => {
    setBusy(true);
    const r = await move.run({ leads: picked, targetName: draft.name, fn: roomApi.list, build: (ids, confirm) => ({ op: 'create', name: draft.name, callerId: draft.callerId, fill: { mode: 'hand', leadIds: ids }, ...(confirm ? { confirm: true } : {}) }) });
    setBusy(false);
    if (r.left) return;
    if (!r.ok) { failed(r); return; }
    applyList(r.data?.list); setChecked(new Set()); setDraft(null);
    toast.success(`${draft.name} is made with ${plural(r.ids.length, 'lead')}.`);
    go('/?section=lists', { replace: true });
  };

  const chipLabel = LEAD_CHIPS.find(x => x.id === chip)?.label;
  return (
    <Stack gap={3} className="rm-leads">
      {draft && (
        <Card padding={3} className="rm-note" role="note" data-card="draft">
          <Row gap={3} align="center" justify="between" wrap>
            <p className="rm-note-text">Tick the leads for {draft.name}, then Make list.</p>
            <Button variant="ghost" onClick={() => setDraft(null)} className="rm-draft-cancel">Cancel</Button>
          </Row>
        </Card>
      )}
      <Input type="search" aria-label="Search leads" placeholder="Search by name, city or owner" value={q} onChange={(e) => setQ(e.target.value)} leading={<Icon icon="SearchMd" size="var(--v-icon-sm)" />} autoComplete="off" enterKeyHint="search" className="rm-search" />
      <div className="rm-chiprow" role="group" aria-label="Show">
        {LEAD_CHIPS.map(x => <Chip key={x.id} label={x.label} count={counts[x.id]} selected={chip === x.id} onClick={() => setChip(x.id)} data-chip={x.id} />)}
      </div>
      {!rows.length ? <NoResults noun="leads" query={q} filters={chip !== 'all' ? [chipLabel] : []} onClear={() => { setQ(''); setChip('all'); }} /> : (
        <ul className="rm-ul" aria-label="Leads">
          {rows.map(l => {
            const list = l.listId ? listOf(lists, l.listId) : null;
            const lock = locked(l);
            const on = checked.has(l.id) && !lock;
            return (
              <li key={l.id}>
                <Card padding={3} className={`rm-row rm-pick${on ? ' is-on' : ''}${lock ? ' is-locked' : ''}`} data-row-id={l.id}>
                  <button type="button" className="v-stretch" onClick={() => go(`/lead/${encodeURIComponent(l.id)}?from=leads`)} aria-label={`Open ${l.business || 'this lead'}`}>{`Open ${l.business || 'this lead'}`}</button>
                  <Row gap={3} align="center">
                    {lock
                      ? <span className="rm-lock" role="img" aria-label="Locked on Rob's list"><Icon icon="Lock01" size="var(--v-icon-md)" /></span>
                      : <span className="v-above rm-pick-box"><Checkbox checked={on} onChange={(v) => toggle(l.id, v)} aria-label={`Select ${l.business || 'this lead'}`} /></span>}
                    <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                      <p className="rm-row-name lay-truncate">{l.business || 'Unnamed'}</p>
                      <p className="rm-row-sub lay-truncate">{subLine(l)}</p>
                    </Stack>
                    {list ? <Pill label={list.name} tone={isRobList(list) ? 'neutral' : 'progress'} icon={false} size="sm" className="rm-list-pill" /> : <span className="rm-row-sub rm-nolist">No list</span>}
                  </Row>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {footEl && picked.length > 0 && createPortal(
        <StickyFooterBar className="rm-selbar">
          <Row gap={2} wrap align="center" className="rm-selbar-row">
            <span className="rm-selbar-n" role="status" aria-live="polite">{picked.length} selected</span>
            {draft
              ? <Button loading={busy} onClick={makeByHand} className="rm-sel-make">Make list of {picked.length}</Button>
              : <><Button loading={busy} onClick={() => setSheet('put')} className="rm-sel-add">Add to list</Button><Button variant="secondary" disabled={busy} onClick={() => setSheet('decline')} className="rm-sel-decline">Decline</Button></>}
            <Button variant="ghost" disabled={busy} onClick={clear} className="rm-sel-clear">Clear</Button>
          </Row>
        </StickyFooterBar>, footEl)}
      {sheet === 'put' && <PutOnListSheet title="Add to list" description={plural(picked.length, 'lead')} onClose={() => setSheet(null)} onConfirm={addTo} />}
      {sheet === 'decline' && <DeclineSheet lead={{ business: picked.length === 1 ? picked[0].business : plural(picked.length, 'lead') }} onClose={() => setSheet(null)} onConfirm={decline} />}
      {move.sheet}
    </Stack>
  );
}
