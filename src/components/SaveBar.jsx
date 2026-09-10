import { Row, Button } from '../ui';

/* The floating "you have unsaved changes" bar, lifted out of AdminShowcase so
 * the Planner editor uses the same one rather than a second copy that would
 * drift from it.
 *
 * It is deliberately a child of PageShell rather than of the ScrollArea, so
 * nothing with overflow or a transform sits between it and the viewport and
 * its corners and shadow draw in full. It clears the tab bar by the tab bar's
 * own expression, --v-tabbar-h PLUS the home indicator inset, because that is
 * what TabBar.jsx sets its height to; lifting by the height alone put the bar
 * inside the tab bar on any phone with an indicator. It sits one below
 * --v-z-tabbar so the tab bar always wins.
 *
 * A page that shows this bar also has to reserve room for it at the bottom of
 * its scroller, through the kit's own --v-scroll-extra hook. --sb-h is the
 * bar's height (two rows on a phone, one on a desktop) and saveBarStyles sets
 * both, so a page only needs `--v-scroll-extra: var(--sb-scroll-extra)` on
 * its ScrollArea.
 */
export default function SaveBar({ open, onSave, onDiscard, saving, message = 'You have unsaved changes', saveLabel = 'Save changes' }) {
  return (
    <div className={`sb-bar${open ? ' is-open' : ''}`} role="status" aria-hidden={open ? undefined : 'true'}>
      <Row gap={2} align="center" wrap>
        <span className="sb-msg">{message}</span>
        <Row gap={2}>
          <Button variant="ghost" onClick={onDiscard} disabled={saving || !open}>Discard</Button>
          <Button onClick={onSave} loading={saving} disabled={!open}>{saveLabel}</Button>
        </Row>
      </Row>
    </div>
  );
}

export const saveBarStyles = `
  .sb-host { --sb-h: 72px; --sb-scroll-extra: calc(var(--sb-h) + var(--v-space-4)); }
  @media (max-width: 900px) { .sb-host { --sb-h: 104px; } }
  .sb-bar {
    position: fixed; right: var(--v-space-4);
    bottom: calc(var(--v-inset-bottom) + var(--v-space-4));
    z-index: calc(var(--v-z-tabbar) - 1);
    padding: var(--v-space-3) var(--v-space-4);
    background: var(--v-surface-2); border: 1px solid var(--v-border-2);
    border-radius: var(--v-radius-lg); box-shadow: var(--v-shadow-lg);
    transform: translateY(140%); opacity: 0;
    transition: transform var(--v-dur-enter) var(--v-ease-out), opacity var(--v-dur-enter) var(--v-ease-out);
    pointer-events: none;
  }
  .sb-bar.is-open { transform: none; opacity: 1; pointer-events: auto; }
  .sb-msg { font-size: var(--v-text-sm); font-weight: 600; color: var(--v-text-1); }
  @media (max-width: 900px) {
    .sb-bar { left: var(--v-space-3); right: var(--v-space-3); }
    .sb-bar > .v-row { justify-content: space-between; }
  }
  /* The tab bar exists below 768px only, and it is --v-tabbar-h tall PLUS the
     home indicator inset (TabBar.jsx sets exactly that height). */
  @media (max-width: 767.98px) {
    .sb-bar { bottom: calc(var(--v-tabbar-h) + var(--v-inset-bottom) + var(--v-space-3)); }
  }
`;
