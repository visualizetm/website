/* The record's pieces (UI simplification, part A). LeadDetail builds its
 * sections by mode from this registry: one component and one summary line
 * per section, all rendering from the same `rec` object. */
import CheckpointsSection, { checkpointsSummary } from './CheckpointsSection';
import MeetingSection, { meetingSummary } from './MeetingSection';
import PricingSection, { pricingSummary } from './PricingSection';
import MoneySection, { moneySummary } from './MoneySection';
import ProjectSection, { projectSummary } from './ProjectSection';
import FilesSection, { filesSummary } from './FilesSection';
import RetainerSection, { retainerSummary } from './RetainerSection';
import PlaybookSection, { playbookSummary } from './PlaybookSection';
import NotesSection, { notesSummary } from './NotesSection';
import HistorySection, { historySummary } from './HistorySection';
import DetailsSection, { detailsSummary } from './DetailsSection';
import TasksSection, { tasksSummary, tasksBar } from './TasksSection';
import ProfileSection, { profileSummary } from './ProfileSection';

export { tasksSummary, tasksBar } from './TasksSection';
export { default as ProfileCard } from './ProfileCard';
export { default as ProfileSection } from './ProfileSection';
export { default as WorkspaceCards } from './WorkspaceCards';
export { default as QuickActions } from './QuickActions';

export { default as RecordHeader } from './RecordHeader';
export { default as NextActionStrip } from './NextActionStrip';
export { default as FactsGrid, AnglePara } from './FactsGrid';
export { default as SectionRows } from './SectionRows';
export { default as SocialsStrip } from './SocialsStrip';
export { checkpointAction, runKeyFor } from './checkpointAction';

export const SECTIONS = {
  checkpoints: { label: 'Checkpoints', Component: CheckpointsSection, summary: checkpointsSummary },
  meeting: { label: 'Meeting', Component: MeetingSection, summary: meetingSummary },
  pricing: { label: 'Pricing', Component: PricingSection, summary: pricingSummary },
  money: { label: 'Money', Component: MoneySection, summary: moneySummary },
  project: { label: 'Project', Component: ProjectSection, summary: projectSummary },
  files: { label: 'Files', Component: FilesSection, summary: filesSummary },
  retainer: { label: 'Retainer', Component: RetainerSection, summary: retainerSummary },
  playbook: { label: 'Playbook', Component: PlaybookSection, summary: playbookSummary },
  tasks: { label: 'Tasks', Component: TasksSection, summary: tasksSummary, bar: tasksBar },
  notes: { label: 'Notes', Component: NotesSection, summary: notesSummary },
  history: { label: 'History', Component: HistorySection, summary: historySummary },
  details: { label: 'Details', Component: DetailsSection, summary: detailsSummary },
  /* The client's full profile (client page workspace redesign): a pushed screen on a phone, a side panel on a computer, never a tab or a row. */
  profile: { label: 'Profile', Component: ProfileSection, summary: profileSummary },
};

/* Sections by mode, in tab order. Details is a phone row only; on a computer its facts sit under the header. */
export const SECTIONS_BY_MODE = {
  lead: ['playbook', 'tasks', 'notes', 'history', 'details'],
  deal: ['checkpoints', 'meeting', 'pricing', 'money', 'tasks', 'playbook', 'notes', 'history', 'details'],
  /* A client (workspace redesign): the facts live in the profile card and the Profile screen, the tasks in the Tasks card; the Tasks tab and row stay as a redirect to the Tasks screen. */
  client: ['project', 'money', 'files', 'retainer', 'notes', 'history', 'profile'],
};
