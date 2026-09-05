import { useEffect, useMemo, useRef, useState } from 'react';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import CurrencyDollarCircle from '@untitled-ui/icons-react/build/esm/CurrencyDollarCircle';
import Briefcase01 from '@untitled-ui/icons-react/build/esm/Briefcase01';
import Zap from '@untitled-ui/icons-react/build/esm/Zap';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import Inbox01 from '@untitled-ui/icons-react/build/esm/Inbox01';
import Settings01 from '@untitled-ui/icons-react/build/esm/Settings01';
import Bell01 from '@untitled-ui/icons-react/build/esm/Bell01';
import {
  Stack, Row, Grid, Section, Divider, Card, StatCard, IconTile, Pill, Badge, Avatar, EmptyState, ErrorState, ListRow,
  Button, IconButton, Chip, ChipGroup, Input, Textarea, Select, InlineEdit, Toggle, Checkbox, SegmentedControl, Tabs,
  Sheet, Modal, ConfirmDialog, useToast, Tooltip, Popover, Menu,
  SkeletonBlock, SkeletonText, SkeletonCircle, Stagger, Reveal, ProgressRing, ProgressBar, Spinner, useDelayedLoading,
  TONES,
} from '../ui';
import { CALL_STATUSES, PRIORITIES, STAGES } from '../shared/semantics';

/* The Components section of /design: every primitive in every variant,
 * state, and size, each data component beside its skeleton. Proof surface
 * for Prompts 4 to 12. */

function Demo({ label, note, children, wide = false }) {
  return (
    <div className={`dc-demo${wide ? ' dc-demo--wide' : ''}`}>
      <div className="dc-demo-head"><span className="dc-demo-label">{label}</span>{note && <span className="dc-demo-note">{note}</span>}</div>
      <div className="dc-demo-body">{children}</div>
    </div>
  );
}

const LEADS = [
  { name: 'Garcia Landscaping', sub: 'Wilmington DE', status: 'not-called', prio: 'hot' },
  { name: 'Working Class Coffee', sub: 'Newark DE', status: 'callback', prio: 'warm' },
  { name: 'Brandywine Bakery', sub: 'Greenville DE', status: 'booked', prio: 'warm' },
  { name: 'Delmarva Detailing', sub: 'Dover DE', status: 'no-answer', prio: 'cold' },
  { name: 'First State Fitness', sub: 'Bear DE', status: 'no', prio: 'cold' },
];

function SampleDashboard({ loaded }) {
  const stats = [
    { icon: PhoneCall01, tone: 'won', value: 12, label: 'Calls today', trend: { value: '4 more than yesterday', direction: 'up' } },
    { icon: CurrencyDollarCircle, tone: 'booked', value: '$1,245', label: 'Money made', trend: { value: '$95 this month', direction: 'up' } },
    { icon: Briefcase01, tone: 'progress', value: 1, label: 'Clients on retainer', trend: { value: 'holding', direction: 'flat' } },
    { icon: Zap, tone: 'new', value: 3, label: 'Callbacks due', trend: { value: '1 overdue', direction: 'down' } },
  ];
  if (!loaded) {
    return (
      <Stack gap={4}>
        <Grid minColumnWidth={170}>{stats.map((_, i) => <StatCard.Skeleton key={i} trend />)}</Grid>
        <Stack gap={2}>{LEADS.map((_, i) => <ListRow.Skeleton key={i} />)}</Stack>
      </Stack>
    );
  }
  return (
    <Stack gap={4}>
      <Stagger className="v-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 'var(--v-space-3)' }}>
        {stats.map(s => <StatCard key={s.label} {...s} onClick={() => {}} />)}
      </Stagger>
      <Stagger className="v-stack" style={{ gap: 'var(--v-space-2)' }}>
        {LEADS.map(l => (
          <ListRow key={l.name} leading={<Avatar name={l.name} status={l.status === 'booked' ? 'booked' : undefined} />} title={l.name} subtitle={l.sub}
            meta="2h ago" trailing={<Pill id={l.status} list={CALL_STATUSES} size="sm" />} onClick={() => {}} />
        ))}
      </Stagger>
    </Stack>
  );
}

export default function DesignComponents() {
  const toast = useToast();
  const [dashLoaded, setDashLoaded] = useState(true);
  const [dashKey, setDashKey] = useState(0);
  const [pending, setPending] = useState(false);
  const delayed = useDelayedLoading(pending);
  const [sheet, setSheet] = useState(false);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [popOpen, setPopOpen] = useState(false);
  const popRef = useRef(null);
  const [chips, setChips] = useState(new Set(['hot']));
  const [single, setSingle] = useState('warm');
  const [seg, setSeg] = useState('kanban');
  const [tab, setTab] = useState('leads');
  const [toggle, setToggle] = useState(true);
  const [check, setCheck] = useState(true);
  const [ring, setRing] = useState(64);
  const [inlineVal, setInlineVal] = useState('Ask for Damian');
  const [phoneVal, setPhoneVal] = useState('(302) 555-0110');
  const saveCount = useRef(0);
  const [busyBtn, setBusyBtn] = useState(false);

  useEffect(() => { const t = setInterval(() => setRing(r => (r >= 96 ? 18 : r + 26)), 2200); return () => clearInterval(t); }, []);

  const flakySave = async () => {
    saveCount.current += 1;
    await new Promise(r => setTimeout(r, 700));
    if (saveCount.current % 3 === 0) throw new Error('simulated failure');
    return true;
  };
  const reload = () => { setDashLoaded(false); setTimeout(() => { setDashLoaded(true); setDashKey(k => k + 1); }, 1400); };
  const fakeFetch = (ms) => { setPending(true); setTimeout(() => setPending(false), ms); };

  const tabs = useMemo(() => [{ id: 'leads', label: 'Leads', count: 24 }, { id: 'booked', label: 'Booked', count: 3 }, { id: 'clients', label: 'Clients' }, { id: 'calls', label: 'Call log' }, { id: 'notes', label: 'Notes' }, { id: 'files', label: 'Files' }], []);

  return (
    <>
      {/* ── Loading system, first because it matters most ── */}
      <section className="ds-sec" id="components">
        <h2 className="ds-h">Components</h2>
        <p className="ds-p">Every primitive below is imported from <code>src/ui</code>. Data components sit next to their skeleton. Resize the window: the same code is the mobile and desktop rendering.</p>
      </section>

      <section className="ds-sec">
        <h2 className="ds-h">Loading system</h2>
        <p className="ds-p">Flip the sample dashboard between skeleton and loaded. The loaded state enters with Stagger: the first 8 items step in 40ms apart, the rest arrive together.</p>
        <Row gap={2} wrap>
          <Button variant="primary" icon={RefreshCw01} onClick={reload} loading={!dashLoaded}>Reload dashboard</Button>
          <Button variant="secondary" onClick={() => setDashLoaded(v => !v)}>{dashLoaded ? 'Show skeleton' : 'Show loaded'}</Button>
          <Divider vertical />
          <Button variant="ghost" onClick={() => fakeFetch(90)}>Fast fetch (90ms)</Button>
          <Button variant="ghost" onClick={() => fakeFetch(1200)}>Slow fetch (1.2s)</Button>
          <span className="dc-note">useDelayedLoading: {pending ? (delayed ? 'skeleton showing' : 'waiting 150ms, nothing shown') : 'idle'}</span>
        </Row>
        <div key={dashKey}><SampleDashboard loaded={dashLoaded} /></div>
        <div className="dc-grid">
          <Demo label="SkeletonBlock / SkeletonText / SkeletonCircle">
            <Row gap={4} align="start" wrap>
              <SkeletonCircle size={48} />
              <Stack gap={2} style={{ flex: 1, minWidth: 160 }}><SkeletonBlock height={18} width="60%" /><SkeletonText lines={3} /></Stack>
              <SkeletonBlock width={90} height={44} radius="var(--v-radius-md)" />
            </Row>
          </Demo>
          <Demo label="Reveal" note="single element, plays once">
            <Reveal key={dashKey}><Card level={2} padding={3}>Entered with fade and 8px rise</Card></Reveal>
          </Demo>
          <Demo label="ProgressRing" note="animates on mount and on change">
            <Row gap={5} wrap>
              <ProgressRing value={ring} tone="booked" />
              <ProgressRing value={100 - ring} tone="won" size={88} thickness={8}><span style={{ fontSize: 'var(--v-text-md)' }}>{Math.round(100 - ring)}%</span></ProgressRing>
              <ProgressRing value={ring} tone="new" size={44} thickness={5} />
              <ProgressRing value={ring} tone="progress" size={120} thickness={10}><Stack gap={0} align="center"><span style={{ fontSize: 'var(--v-text-3xl)' }}>{Math.round(ring / 10)}</span><span style={{ fontSize: 'var(--v-text-xs)', color: 'var(--v-text-3)', fontFamily: 'var(--v-font-body)' }}>of 10</span></Stack></ProgressRing>
            </Row>
          </Demo>
          <Demo label="ProgressBar">
            <Stack gap={4}>
              <ProgressBar value={ring} label="Checklist" tone="booked" />
              <ProgressBar value={100 - ring} tone="won" size="sm" />
              <ProgressBar indeterminate label="Importing" tone="progress" />
            </Stack>
          </Demo>
          <Demo label="Spinner" note="inline only">
            <Row gap={4}><Spinner size={14} /><Spinner /><Spinner size={22} /><Button variant="secondary" loading>Saving</Button></Row>
          </Demo>
        </div>
      </section>

      {/* ── Surfaces ── */}
      <section className="ds-sec">
        <h2 className="ds-h">Surfaces</h2>
        <div className="dc-grid">
          <Demo label="Card" note="levels 1, 2, 3 and interactive" wide>
            <Grid minColumnWidth={160}>
              <Card level={1}>Level 1 <span className="dc-dim">surface-1</span></Card>
              <Card level={2}>Level 2 <span className="dc-dim">surface-2</span></Card>
              <Card level={3}>Level 3 <span className="dc-dim">surface-3</span></Card>
              <Card interactive onClick={() => toast.info('Card pressed.')}>Interactive <span className="dc-dim">hover lift, press, focus ring</span></Card>
              <Card glow="booked" header={<strong>Header slot</strong>} footer={<span className="dc-dim">Footer slot</span>}>Glow: booked</Card>
              <Card selected>Selected</Card>
              <Card.Skeleton />
              <Card.Skeleton level={2} lines={2} />
            </Grid>
          </Demo>
          <Demo label="StatCard" note="loaded beside skeleton" wide>
            <Grid minColumnWidth={170}>
              <StatCard icon={PhoneCall01} tone="won" value={12} label="Calls today" trend={{ value: '4 more', direction: 'up' }} />
              <StatCard icon="CurrencyDollar" tone="booked" value="$1,245" label="Money made" />
              <StatCard icon="Briefcase01" tone="progress" value={1} label="On retainer" trend={{ value: 'holding', direction: 'flat' }} onClick={() => toast.info('Stat card tapped.')} />
              <StatCard.Skeleton trend />
            </Grid>
          </Demo>
          <Demo label="IconTile" note="sizes sm, md, lg; every tone">
            <Row gap={2} wrap>
              {TONES.map(t => <IconTile key={t} icon="Zap" tone={t} />)}
              <IconTile icon="Phone" tone="won" size="sm" /><IconTile icon="Phone" tone="won" size="lg" /><IconTile icon="Phone" tone="won" glow={false} /><IconTile.Skeleton />
            </Row>
          </Demo>
          <Demo label="Pill" note="soft, solid, outline, dot, sm; driven by semantics ids">
            <Stack gap={2}>
              <Row gap={2} wrap>{CALL_STATUSES.map(s => <Pill key={s.id} id={s.id} list={CALL_STATUSES} />)}</Row>
              <Row gap={2} wrap>{PRIORITIES.map(s => <Pill key={s.id} id={s.id} variant="solid" />)}</Row>
              <Row gap={2} wrap>{STAGES.map(s => <Pill key={s.id} id={s.id} variant="outline" />)}</Row>
              <Row gap={2} wrap><Pill id="booked" dot /><Pill id="callback" size="sm" /><Pill tone="won" label="Manual override" icon={false} /><Pill.Skeleton /></Row>
            </Stack>
          </Demo>
          <Demo label="Badge" note="count, 99+, dot, inline, on a control">
            <Row gap={5} wrap>
              <Badge count={3} inline /><Badge count={321} inline /><Badge count={5} tone="booked" inline /><Badge dot inline />
              <Badge count={2}><IconButton icon={Bell01} label="Notifications" variant="secondary" tooltip={false} /></Badge>
              <Badge dot><IconButton icon={Inbox01} label="Inbox" variant="secondary" tooltip={false} /></Badge>
              <IconButton icon={Bell01} label="Alerts" badge={7} variant="secondary" tooltip={false} />
            </Row>
          </Demo>
          <Demo label="Avatar" note="initials from the name, hue from the name, status dot, sizes">
            <Row gap={3} wrap align="end">
              {['xs', 'sm', 'md', 'lg', 'xl'].map(s => <Avatar key={s} name="Garcia Landscaping" size={s} />)}
              <Avatar name="Working Class Coffee" status="booked" size="lg" />
              <Avatar name="Rob" status="won" />
              <Avatar name="Delmarva Detailing" src="/logo.svg" />
              <Avatar.Skeleton size="lg" />
            </Row>
          </Demo>
          <Demo label="ListRow" note="tap, selected, skeleton" wide>
            <Stack gap={2}>
              <ListRow leading={<Avatar name="Garcia Landscaping" />} title="Garcia Landscaping" subtitle="Wilmington DE" meta="2h ago" trailing={<Pill id="callback" size="sm" />} onClick={() => toast.info('Row tapped.')} />
              <ListRow leading={<IconTile icon="Phone" tone="won" size="sm" />} title="A very long business name that keeps going past the edge of the row" subtitle="Truncates on one line per LAYOUT.md" trailing={<Menu items={[{ id: 'e', label: 'Edit', icon: Edit02, onSelect: () => toast.info('Edit') }, 'divider', { id: 'd', label: 'Delete', icon: Trash01, danger: true, onSelect: () => setConfirm(true) }]} />} selected />
              <ListRow.Skeleton />
            </Stack>
          </Demo>
          <Demo label="EmptyState">
            <Card><EmptyState icon={Inbox01} title="No callbacks today" description="When a lead asks you to call back, they land here with the time they asked for." action={{ label: 'Start a call session', icon: PhoneCall01, onClick: () => toast.info('Would open the console.') }} secondary={{ label: 'See all leads', onClick: () => {} }} /></Card>
          </Demo>
          <Demo label="ErrorState">
            <ErrorState title="Could not load leads" description="The request timed out after 10 seconds." onRetry={() => toast.success('Retried.')} details={'GET /api/admin/call-leads\n504 Gateway Timeout'} />
          </Demo>
        </div>
      </section>

      {/* ── Controls ── */}
      <section className="ds-sec">
        <h2 className="ds-h">Controls</h2>
        <div className="dc-grid">
          <Demo label="Button" note="variants, sizes, loading, disabled" wide>
            <Stack gap={3}>
              <Row gap={2} wrap>
                <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger" icon={Trash01}>Danger</Button><Button variant="icon" icon={Settings01} aria-label="Settings" />
              </Row>
              <Row gap={2} wrap>
                <Button size="lg" icon={PhoneCall01}>Start call session</Button><Button size="lg" variant="secondary">Large secondary</Button><Button size="lg" variant="icon" icon={Plus} aria-label="Add" />
              </Row>
              <Row gap={2} wrap>
                <Button loading={busyBtn} onClick={() => { setBusyBtn(true); setTimeout(() => setBusyBtn(false), 1500); }}>Save changes</Button>
                <Button variant="secondary" loading>Loading</Button><Button disabled>Disabled</Button><Button variant="secondary" iconEnd={SearchMd}>Icon end</Button><Button variant="ghost" href="#components">As link</Button>
              </Row>
              <Button full variant="primary" size="lg">Full width</Button>
            </Stack>
          </Demo>
          <Demo label="IconButton" note="tooltip on hover and focus (desktop)">
            <Row gap={2} wrap>
              <IconButton icon={Edit02} label="Edit" /><IconButton icon={Edit02} label="Edit" variant="secondary" /><IconButton icon={PhoneCall01} label="Call" variant="primary" /><IconButton icon={Trash01} label="Delete" variant="danger" /><IconButton icon={Zap} label="Hot" active /><IconButton icon={Plus} label="Add" size="lg" variant="secondary" /><IconButton icon={Edit02} label="Disabled" disabled />
            </Row>
          </Demo>
          <Demo label="Chip and ChipGroup" note="multi with nothing selected meaning all; single" wide>
            <Stack gap={3}>
              <ChipGroup label="Priority" options={PRIORITIES.map(p => ({ id: p.id, label: p.label, count: p.id === 'hot' ? 2 : 1, icon: p.icon }))} value={chips} onChange={setChips} />
              <ChipGroup label="Priority (single)" multi={false} options={PRIORITIES.map(p => ({ id: p.id, label: p.label }))} value={single} onChange={setSingle} />
              <Row gap={2} wrap><Chip label="Plain" /><Chip label="Selected" selected /><Chip label="Count" count={12} /><Chip label="Disabled" disabled /></Row>
            </Stack>
          </Demo>
          <Demo label="Input / Textarea / Select" note="shared field shell: label, hint, error, slots, inputmode" wide>
            <Grid minColumnWidth={220}>
              <Input label="Business" placeholder="Garcia Landscaping" hint="As it appears on their sign." />
              <Input label="Phone" inputMode="tel" defaultValue="(302) 555-0110" leading={<PhoneCall01 width={16} height={16} />} />
              <Input label="Email" type="email" error="That does not look like an email." defaultValue="rob@visualize" />
              <Input label="Search" placeholder="Search leads" leading={<SearchMd width={16} height={16} />} trailing={<Button variant="ghost" size="md" style={{ marginRight: -8 }}>Clear</Button>} />
              <Input label="Disabled" disabled defaultValue="Read only" />
              <Select label="Priority" options={PRIORITIES.map(p => ({ id: p.id, label: p.label }))} defaultValue="warm" />
              <Select label="Stage" placeholder="Pick a stage" options={STAGES.map(s => ({ id: s.id, label: s.label }))} defaultValue="" />
              <Textarea label="The angle" placeholder="Dead site, great reviews." rows={3} hint="One or two lines is plenty." />
            </Grid>
          </Demo>
          <Demo label="InlineEdit" note="tap to edit, Enter saves, Escape cancels; this one FAILS every third save to show the rollback and error toast" wide>
            <Card level={2}>
              <Stack gap={2}>
                <Row gap={3}><span className="dc-key">Ask for</span><InlineEdit value={inlineVal} onSave={flakySave} onChange={setInlineVal} label="Contact name" /></Row>
                <Row gap={3}><span className="dc-key">Phone</span><InlineEdit value={phoneVal} onSave={flakySave} onChange={setPhoneVal} label="Phone" inputMode="tel" /></Row>
                <Row gap={3}><span className="dc-key">Email</span><InlineEdit value="" onSave={flakySave} label="Email" placeholder="Add an email" /></Row>
                <Row gap={3} align="start"><span className="dc-key">Notes</span><InlineEdit value="Dead site, great reviews." onSave={flakySave} label="Notes" multiline /></Row>
                <span className="dc-note">Saves so far: {saveCount.current}. Multiline saves with Cmd or Ctrl + Enter.</span>
              </Stack>
            </Card>
          </Demo>
          <Demo label="Toggle and Checkbox">
            <Stack gap={1}>
              <Toggle checked={toggle} onChange={setToggle} label="Push notifications" description="New submissions and callbacks due." />
              <Toggle checked={!toggle} onChange={(v) => setToggle(!v)} label="Small" size="sm" />
              <Toggle checked disabled label="Disabled on" />
              <Checkbox checked={check} onChange={setCheck} label="Include leads without a phone" />
              <Checkbox indeterminate label="Some selected" onChange={() => {}} checked={false} />
              <Checkbox checked={false} disabled label="Disabled" onChange={() => {}} />
            </Stack>
          </Demo>
          <Demo label="SegmentedControl">
            <Stack gap={3}>
              <SegmentedControl label="View" options={[{ id: 'kanban', label: 'Kanban' }, { id: 'table', label: 'Table' }, { id: 'cards', label: 'Cards' }]} value={seg} onChange={setSeg} />
              <SegmentedControl label="Range" size="sm" options={[{ id: 'kanban', label: 'Week' }, { id: 'table', label: 'Day' }]} value={seg === 'kanban' ? 'kanban' : 'table'} onChange={setSeg} />
              <SegmentedControl label="Full" full options={[{ id: 'kanban', label: 'Kanban', icon: 'Users01' }, { id: 'table', label: 'Table', icon: 'Package' }, { id: 'cards', label: 'Cards', icon: 'Briefcase01' }]} value={seg} onChange={setSeg} />
            </Stack>
          </Demo>
          <Demo label="Tabs" note="underline, scrolls sideways on narrow screens" wide>
            <Tabs label="Lead detail" tabs={tabs} value={tab} onChange={setTab} />
          </Demo>
        </div>
      </section>

      {/* ── Overlays and feedback ── */}
      <section className="ds-sec">
        <h2 className="ds-h">Overlays and feedback</h2>
        <div className="dc-grid">
          <Demo label="Sheet / Modal / ConfirmDialog" note="Sheet is a bottom sheet on mobile and a side panel on desktop" wide>
            <Row gap={2} wrap>
              <Button variant="secondary" className="dc-open-sheet" onClick={() => setSheet(true)}>Open sheet</Button>
              <Button variant="secondary" className="dc-open-modal" onClick={() => setModal(true)}>Open modal</Button>
              <Button variant="danger" icon={Trash01} onClick={() => setConfirm(true)}>Delete something</Button>
            </Row>
          </Demo>
          <Demo label="Toast" note="stacked, bottom center above the tab bar on mobile, bottom right on desktop" wide>
            <Row gap={2} wrap>
              <Button variant="secondary" onClick={() => toast.success('Lead saved.')}>Success</Button>
              <Button variant="secondary" onClick={() => toast.error('Could not reach the server.', { description: 'Your change was undone.' })}>Error</Button>
              <Button variant="secondary" onClick={() => toast.info('Enrichment runs tonight at 2am.')}>Info</Button>
              <Button variant="secondary" onClick={() => toast.undo('Garcia Landscaping deleted.', () => toast.success('Restored.'), { seconds: 6 })}>Undo with countdown</Button>
              <Button variant="secondary" onClick={() => toast.show({ title: 'Callback due', description: 'Working Class Coffee asked for 3pm.', action: { label: 'Call', onClick: () => {} }, duration: 8000 })}>With action</Button>
            </Row>
          </Demo>
          <Demo label="Tooltip / Popover / Menu">
            <Row gap={3} wrap>
              <Tooltip label="Tooltips show on hover and focus, desktop only"><Button variant="secondary">Hover me</Button></Tooltip>
              <span ref={popRef}><Button variant="secondary" onClick={() => setPopOpen(o => !o)} aria-expanded={popOpen}>Popover</Button></span>
              <Popover open={popOpen} onClose={() => setPopOpen(false)} anchorRef={popRef} width={260} label="Command results">
                <Stack gap={0} style={{ padding: 'var(--v-space-1)' }}>
                  {LEADS.slice(0, 3).map(l => <ListRow key={l.name} leading={<Avatar name={l.name} size="sm" />} title={l.name} subtitle={l.sub} chevron={false} onClick={() => setPopOpen(false)} style={{ border: 0, background: 'transparent' }} />)}
                </Stack>
              </Popover>
              <Menu items={[{ id: 'edit', label: 'Edit lead', icon: Edit02, onSelect: () => toast.info('Edit') }, { id: 'call', label: 'Call now', icon: PhoneCall01, onSelect: () => {} }, 'divider', { id: 'del', label: 'Delete', icon: Trash01, danger: true, onSelect: () => setConfirm(true) }]} />
              <Menu label="Custom trigger" trigger={<Button variant="ghost" iconEnd="XClose">Menu with trigger</Button>} items={[{ id: 'a', label: 'One', onSelect: () => {} }, { id: 'b', label: 'Two (disabled)', disabled: true, onSelect: () => {} }]} />
            </Row>
          </Demo>
          <Demo label="Layout primitives" note="Stack, Row, Grid, Section, Divider" wide>
            <Section title="Section title" description="Optional description under the title." action={<Button variant="ghost" icon={Plus}>Action slot</Button>}>
              <Grid minColumnWidth={120} gap={2}>{[1, 2, 3, 4, 5, 6].map(i => <Card key={i} level={2} padding={3}>Grid {i}</Card>)}</Grid>
              <Divider label="Divider with label" />
              <Row gap={2} wrap><Card level={2} padding={3}>Row</Card><Divider vertical /><Card level={2} padding={3}>Row</Card></Row>
            </Section>
          </Demo>
        </div>
      </section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Garcia Landscaping" description="Bottom sheet on mobile, side panel on desktop. Drag the handle down to dismiss."
        footer={<><Button variant="ghost" onClick={() => setSheet(false)}>Close</Button><Button icon={PhoneCall01} onClick={() => { setSheet(false); toast.success('Calling.'); }}>Call now</Button></>}>
        <Stack gap={3}>
          <Row gap={3}><Avatar name="Garcia Landscaping" size="lg" status="booked" /><Stack gap={1}><strong>Garcia Landscaping</strong><span className="dc-dim">Wilmington DE</span></Stack></Row>
          <Row gap={2} wrap><Pill id="hot" /><Pill id="callback" list={CALL_STATUSES} /><Pill id="booked" list={STAGES} variant="outline" /></Row>
          <Input label="Ask for" defaultValue="Damian" />
          <Textarea label="Notes" defaultValue="Dead site, great reviews." />
          <ProgressBar value={ring} label="Checklist" />
          {Array.from({ length: 6 }, (_, i) => <ListRow key={i} title={`Call log entry ${i + 1}`} subtitle="Left a voicemail" meta="Aug 12" />)}
        </Stack>
      </Sheet>
      <Modal open={modal} onClose={() => setModal(false)} title="Add a purchase" description="Short forms and confirmations live in a modal."
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button onClick={() => { setModal(false); toast.success('Purchase added.'); }}>Add purchase</Button></>}>
        <Input label="What they paid for" placeholder="Full brand and website package" data-autofocus />
        <Grid minColumnWidth={140}><Input label="Amount" inputMode="decimal" leading="$" placeholder="750" /><Input label="Date" type="date" /></Grid>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} danger title="Delete Garcia Landscaping?" body="It moves to Recently deleted in Settings and can be restored for 30 days." confirmLabel="Delete"
        onConfirm={async () => { await new Promise(r => setTimeout(r, 800)); setConfirm(false); toast.undo('Garcia Landscaping deleted.', () => toast.success('Restored.')); }} />
      <style>{dcStyles}</style>
    </>
  );
}

const dcStyles = `
  .dc-grid { display: grid; grid-template-columns: 1fr; gap: var(--v-space-4); }
  @media (min-width: 900px) { .dc-grid { grid-template-columns: 1fr 1fr; } .dc-demo--wide { grid-column: 1 / -1; } }
  .dc-demo { display: flex; flex-direction: column; gap: var(--v-space-3); min-width: 0; padding: var(--v-space-4); border: 1px dashed var(--v-border-strong); border-radius: var(--v-radius-md); }
  .dc-demo-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--v-space-2); }
  .dc-demo-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-red-highlight); }
  .dc-demo-note { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }
  .dc-demo-body { min-width: 0; }
  .dc-dim { color: var(--v-text-3); font-size: var(--v-text-sm); }
  .dc-note { font-size: var(--v-text-sm); color: var(--v-text-3); }
  .dc-key { width: 72px; flex-shrink: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); padding-top: 14px; }
`;
