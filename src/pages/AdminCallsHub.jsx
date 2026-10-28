import { useEffect, useState } from 'react';
import { SegmentedControl } from '../ui';
import AdminCalls from './AdminCalls';
import AdminTriage from './AdminTriage';
import AdminLists from './AdminLists';
import AdminLeads from './AdminLeads';

const SECTION_KEY = 'vz_calls_hub_section';
const SECTIONS = ['triage', 'lists', 'leads'];
const readSection = () => { try { const v = localStorage.getItem(SECTION_KEY); return SECTIONS.includes(v) ? v : 'triage'; } catch { return 'triage'; } };
const writeSection = (v) => { try { localStorage.setItem(SECTION_KEY, v); } catch { /* the choice just does not survive a reload */ } };

/**
 * AdminCallsHub (/calls): Rob's one screen for the dial work. A SegmentedControl
 * switches between Triage, Lists and Leads (remembered per device, a count on
 * each); /lists and /triage redirect here (AdminApp.jsx) and carry which
 * section to open the first time. None of the three screens is forked: this
 * is layout and wiring around the same AdminTriage, AdminLists and AdminLeads
 * every other entry point already uses.
 *
 * The actual call session (AdminCalls: builder, queue, room, summary) stays
 * mounted underneath at all times, exactly as /calls has always worked, so a
 * resumed session, a "Start call session" deep link and the keyboard
 * shortcuts keep working unchanged. AdminCalls reports its own mode back
 * (onModeChange); while it is idle at the builder root this hub's own
 * Triage/Lists/Leads view is what shows, and the moment a list or a quick
 * session starts, AdminCalls' own queue/room/summary takes the screen back,
 * the same transition /lists already drove by navigating here.
 *
 * Desktop does not get the side by side Triage-and-Lists (Leads at 1280)
 * layout the brief describes: AdminTriage's and the kit's own keyboard
 * shortcuts (K/L/D/B/A, arrow keys) assume they are the only thing
 * listening on the page, so mounting more than one of these at once would
 * double fire on every keystroke. The SegmentedControl switch (one section
 * mounted at a time) avoids forking either screen's keyboard handling;
 * docs/MOBILE-DECISIONS.md has the full tradeoff.
 */
export default function AdminCallsHub({
  hubSection = '', counts = {},
  // AdminCalls passthrough (unchanged from the old /calls route)
  onDataChanged, builderPreset, forceLoading, lists, listsLoading, listsError, onRetryLists, listOps,
  // Triage
  leads, submissions, triageLoading, triageError, onRetryTriage, onPatchLead, onDeleteLead, onRestoreLeads, onCapture,
  // Lists (and Triage's own Add to list sheet)
  onOpenLead,
  // Leads
  onCreateLead, onBulkDeleteLeads, onRefreshLeads, onLinkSubmission, leadsCreatePreset, leadsFilterPreset,
}) {
  const [section, setSection] = useState(() => hubSection || readSection());
  const [callsMode, setCallsMode] = useState('builder');
  const [startPreset, setStartPreset] = useState(null);
  /* A preset handed in from outside (Start call session on the dashboard, a deep link) always wins over one the
     hub's own Lists section set a moment ago, so two sources never race. */
  const activePreset = builderPreset || startPreset;
  /* A path-driven open (the old /triage or /lists bookmark) wins over the remembered section, once. */
  useEffect(() => { if (hubSection) { setSection(hubSection); writeSection(hubSection); } }, [hubSection]);
  const choose = (id) => { setSection(id); writeSection(id); };
  /* Once AdminCalls has picked a hub-started preset up (mode left 'builder'), drop it: a later return to the
     builder root must not carry a stale reference around, even though it is inert either way. */
  useEffect(() => { if (callsMode !== 'builder' && startPreset) setStartPreset(null); }, [callsMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const showHub = callsMode === 'builder';
  const options = [
    { id: 'triage', label: `Triage${counts.triage ? ` (${counts.triage})` : ''}`, icon: 'Inbox01' },
    { id: 'lists', label: `Lists${counts.lists ? ` (${counts.lists})` : ''}`, icon: 'Rows01' },
    { id: 'leads', label: `Leads${counts.leads ? ` (${counts.leads})` : ''}`, icon: 'Users01' },
  ];

  return (
    <div className="ch-wrap">
      <div className="ch-top" style={{ display: showHub ? 'flex' : 'none' }}>
        <SegmentedControl label="Calls section" options={options} value={section} onChange={choose} />
      </div>
      <div className="ch-body" style={{ display: showHub ? 'flex' : 'none' }}>
        {section === 'triage' && (
          <AdminTriage leads={leads} submissions={submissions} loading={triageLoading} error={triageError} onRetry={onRetryTriage}
            onPatch={onPatchLead} onDelete={onDeleteLead} onRestore={onRestoreLeads} onCapture={onCapture} />
        )}
        {section === 'lists' && (
          <AdminLists lists={lists} leads={leads} loading={listsLoading || triageLoading} error={listsError} onRetry={onRetryLists} ops={listOps}
            onPatchLead={onPatchLead} onOpenLead={onOpenLead} onStart={(l) => setStartPreset({ section: 'calls', preset: { listId: String(l._id) }, n: Date.now() })} />
        )}
        {section === 'leads' && (
          <AdminLeads leads={leads} submissions={submissions} loading={triageLoading} error={triageError} onRetry={onRetryTriage}
            onPatch={onPatchLead} onCreate={onCreateLead} onDelete={onDeleteLead} onBulkDelete={onBulkDeleteLeads} onRestore={onRestoreLeads}
            onRefresh={onRefreshLeads} onLinkSubmission={onLinkSubmission} createPreset={leadsCreatePreset} filterPreset={leadsFilterPreset} />
        )}
      </div>
      <div style={{ display: showHub ? 'none' : 'contents' }}>
        <AdminCalls embedded onDataChanged={onDataChanged} builderPreset={activePreset} forceLoading={forceLoading}
          lists={lists} listsLoading={listsLoading} listsError={listsError} onRetryLists={onRetryLists} listOps={listOps}
          onModeChange={setCallsMode} />
      </div>
      <style>{hubStyles}</style>
    </div>
  );
}

const hubStyles = `
  .ch-wrap { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  .ch-top { flex-shrink: 0; padding: var(--v-space-4) var(--v-gutter-r) 0 var(--v-gutter-l); }
  @media (min-width: 768px) { .ch-top { padding-top: var(--v-space-5); } }
  .ch-body { flex: 1; min-width: 0; min-height: 0; display: flex; }
  .ch-body > * { flex: 1; min-width: 0; min-height: 0; }
`;
