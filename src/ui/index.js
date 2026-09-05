/* The Visualize component kit. Screens import from '../ui' only.
 * uiStyles is the single stylesheet: tokens + every component, injected once
 * by each app shell (AdminApp, AdminCalls) via <style>{uiStyles}</style>. */
import { tokenStyles } from './tokens';
import PageShell, { pageShellStyles } from './PageShell';
import ScrollArea, { scrollAreaStyles } from './ScrollArea';
import StickyFooterBar, { stickyFooterBarStyles } from './StickyFooterBar';
import Stack, { stackStyles } from './Stack';
import Row, { rowStyles } from './Row';
import Grid, { gridStyles } from './Grid';
import Section, { sectionStyles } from './Section';
import Divider, { dividerStyles } from './Divider';
import Card, { cardStyles } from './Card';
import StatCard, { statCardStyles } from './StatCard';
import IconTile, { iconTileStyles } from './IconTile';
import Pill, { pillStyles } from './Pill';
import Badge, { badgeStyles } from './Badge';
import Avatar, { avatarStyles, initialsOf } from './Avatar';
import EmptyState, { emptyStateStyles } from './EmptyState';
import ErrorState, { errorStateStyles, useRetry } from './ErrorState';
import ErrorBoundary, { errorBoundaryStyles } from './ErrorBoundary';
import useOnline from './useOnline';
import ListRow, { listRowStyles } from './ListRow';
import Button, { buttonStyles } from './Button';
import IconButton, { iconButtonStyles } from './IconButton';
import Chip, { ChipGroup, chipStyles } from './Chip';
import FieldShell, { fieldShellStyles } from './FieldShell';
import Input from './Input';
import Textarea from './Textarea';
import Select, { selectStyles } from './Select';
import InlineEdit, { inlineEditStyles } from './InlineEdit';
import Toggle, { toggleStyles } from './Toggle';
import Checkbox, { checkboxStyles } from './Checkbox';
import SegmentedControl, { segmentedControlStyles } from './SegmentedControl';
import Tabs, { tabsStyles } from './Tabs';
import Table, { tableStyles } from './Table';
import { leadCardStyles } from './leadCard.styles';
import { leadHistoryStyles, leadNotesStyles, playbookStyles, leadFormStyles, leadDetailStyles, clientStyles } from './lead.styles';
import Collapsible, { collapsibleStyles } from './Collapsible';
import Sheet, { sheetStyles } from './Sheet';
import Modal, { modalStyles } from './Modal';
import ConfirmDialog, { useConfirm } from './ConfirmDialog';
import ToastProvider, { ToastHost, useToast, toastStyles } from './Toast';
import Tooltip, { tooltipStyles } from './Tooltip';
import Popover, { popoverStyles } from './Popover';
import Menu, { menuStyles } from './Menu';
import SkeletonBlock, { SkeletonText, SkeletonCircle, skeletonStyles } from './Skeleton';
import Stagger, { staggerStyles } from './Stagger';
import Reveal, { revealStyles } from './Reveal';
import ProgressRing, { progressRingStyles } from './ProgressRing';
import ProgressBar, { progressBarStyles } from './ProgressBar';
import Spinner, { spinnerStyles } from './Spinner';
import RecordSkeleton, { recordSkeletonStyles } from './RecordSkeleton';
import { durationMs, motionReduced } from './motion';
import useDelayedLoading from './useDelayedLoading';
import useOptimisticPatch from './useOptimisticPatch';
import useMediaQuery, { DESKTOP_QUERY, HOVER_QUERY } from './useMediaQuery';
import useFocusTrap from './useFocusTrap';
import useScrollLock from './useScrollLock';
import { Icon, ICONS, iconFor } from './icons';
import { entryOf, toneOf, resolveSemantic, TONES } from './semantic';

export const uiStyles = [
  tokenStyles, pageShellStyles, scrollAreaStyles, stickyFooterBarStyles,
  stackStyles, rowStyles, gridStyles, sectionStyles, dividerStyles,
  skeletonStyles, cardStyles, statCardStyles, iconTileStyles, pillStyles, badgeStyles, avatarStyles,
  emptyStateStyles, errorStateStyles, errorBoundaryStyles, listRowStyles,
  spinnerStyles, buttonStyles, iconButtonStyles, chipStyles, fieldShellStyles, selectStyles, inlineEditStyles,
  toggleStyles, checkboxStyles, segmentedControlStyles, tabsStyles, tableStyles,
  sheetStyles, modalStyles, toastStyles, tooltipStyles, popoverStyles, menuStyles,
  staggerStyles, revealStyles, progressRingStyles, progressBarStyles, recordSkeletonStyles, leadCardStyles, leadHistoryStyles, leadNotesStyles, playbookStyles, leadFormStyles, leadDetailStyles, clientStyles, collapsibleStyles,
].join('\n');

export {
  PageShell, ScrollArea, StickyFooterBar, Stack, Row, Grid, Section, Divider,
  Card, StatCard, IconTile, Pill, Badge, Avatar, initialsOf, EmptyState, ErrorState, ErrorBoundary, ListRow,
  Button, IconButton, Chip, ChipGroup, FieldShell, Input, Textarea, Select, InlineEdit, Toggle, Checkbox, SegmentedControl, Tabs, Table, Collapsible,
  Sheet, Modal, ConfirmDialog, useConfirm, ToastProvider, ToastHost, useToast, Tooltip, Popover, Menu,
  SkeletonBlock, SkeletonText, SkeletonCircle, RecordSkeleton, Stagger, Reveal, ProgressRing, ProgressBar, Spinner, durationMs, motionReduced,
  useDelayedLoading, useOptimisticPatch, useMediaQuery, DESKTOP_QUERY, HOVER_QUERY, useFocusTrap, useScrollLock, useRetry, useOnline,
  Icon, ICONS, iconFor, entryOf, toneOf, resolveSemantic, TONES,
};
