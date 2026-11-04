import RoundCheck from './RoundCheck';
import IconButton from './IconButton';
import Button from './Button';
import Pill from './Pill';
import Menu from './Menu';
import SwipeRow from './SwipeRow';

/**
 * TaskRow (prompt 3 of 3, milestone 2): the one row for what is due, on Home's Next up, the Tasks page and the client and project
 * task lists. A round check (44px target), the title, the business, a time line with the kind pill, and the right action.
 * Swipe right is done and swipe left is snooze through SwipeRow; every swipe also exists as a button or a menu item.
 *
 * @param {object} props
 * @param {'li'|'div'} [props.as='li']
 * @param {string} props.title
 * @param {string} [props.biz] the business (or the checklist, on a client's task list)
 * @param {import('react').ReactNode} [props.when] the time line's words
 * @param {'late'|'done'|''} [props.whenTone]
 * @param {{tone: string, label: string}|null} [props.kind] the kind pill
 * @param {{label: string, onClick: Function, tone?: string}|null} props.check the round check
 * @param {Array<{icon: string, label: string, text?: string, onClick?: Function, href?: string, compact?: boolean, className?: string}>} [props.actions] the right actions: a text button, or an icon button when `compact` or no text
 * @param {Array|null} [props.menu] a more menu
 * @param {{done?: Function, snooze?: Function, hold?: Function, doneLabel?: string, snoozeLabel?: string}|null} [props.swipe]
 * @param {boolean} [props.swipeEnabled] false on a computer
 * @param {Function} [props.onOpen] the row's tap (the stretched button)
 * @param {string} [props.openLabel]
 * @param {import('react').ReactNode} [props.extra] under the time line (a progress bar)
 * @param {boolean} [props.done] [props.leaving] [props.overdue]
 * @param {'list'|'card'|'compact'} [props.variant='list'] list: a line in a card's list; card: its own card; compact: a card at one tap's height (a client's task list)
 */
export default function TaskRow({
  as: Tag = 'li', title, biz = '', when = null, whenTone = '', kind = null, check = null, actions = [], menu = null, swipe = null, swipeEnabled = false,
  onOpen, openLabel, extra = null, done = false, leaving = false, overdue = false, variant = 'list', className = '', children, ...rest
}) {
  const cls = `tr-row tr-row--${variant}${done ? ' is-done' : ''}${leaving ? ' is-leaving' : ''}${overdue ? ' is-overdue' : ''}${className ? ` ${className}` : ''}`;
  const body = (
    <div className="tr-inner">
      {onOpen && <button type="button" className="v-stretch" onClick={onOpen} aria-label={openLabel || `Open ${biz || title}`}>{openLabel || `Open ${biz || title}`}</button>}
      {check && <RoundCheck className="v-above" label={done ? `Done: ${title}${biz ? `, ${biz}` : ''}` : check.label} done={done} tone={check.tone || (overdue ? 'danger' : 'neutral')} onClick={check.onClick} />}
      <div className="tr-body">
        <span className="tr-title lay-truncate">{title}</span>
        {biz && <span className="tr-biz lay-truncate">{biz}</span>}
        <span className="tr-meta">
          {done ? <span className="tr-when is-done">Done</span> : when != null && when !== '' ? <span className={`tr-when${whenTone ? ` is-${whenTone}` : ''}`}>{when}</span> : null}
          {!done && kind && <Pill tone={kind.tone || 'neutral'} label={kind.label} size="sm" icon={false} variant="soft" />}
        </span>
        {extra}
      </div>
      {!done && !leaving && (actions.length > 0 || menu) && (
        <span className="tr-act v-above">
          {actions.map((a) => (a.text && !a.compact
            ? <Button key={a.label} variant="secondary" size="md" icon={a.icon} href={a.href} onClick={a.onClick} aria-label={a.label} className={a.className}>{a.text}</Button>
            : <IconButton key={a.label} icon={a.icon} label={a.label} variant="secondary" href={a.href} onClick={a.onClick} tooltip={false} className={a.className} />))}
          {menu && <Menu label={`${biz ? `${biz}, ` : ''}${title} actions`} items={menu} />}
        </span>
      )}
      {children}
    </div>
  );
  return (
    <Tag className={cls} {...rest}>
      {swipe ? (
        <SwipeRow enabled={swipeEnabled && !done && !leaving}
          right={swipe.done ? { label: swipe.doneLabel || 'Done', icon: 'Check', tone: 'primary', onCommit: swipe.done } : undefined}
          left={swipe.snooze ? { label: swipe.snoozeLabel || 'Snooze', icon: 'Clock', tone: 'callback', onCommit: swipe.snooze } : undefined}
          onHold={swipe.hold}>
          {body}
        </SwipeRow>
      ) : body}
    </Tag>
  );
}

export const taskRowStyles = `
  .tr-row { position: relative; min-width: 0; box-sizing: border-box; transition: opacity var(--v-dur-slow) var(--v-ease-out); }
  .tr-row--list { border-top: 1px solid var(--v-border); }
  .tr-row--card, .tr-row--compact { border: 1px solid var(--v-border); border-radius: var(--v-radius-lg); background: var(--v-surface-1); }
  .tr-inner { position: relative; display: flex; align-items: center; gap: var(--v-space-2); min-height: 88px; padding: var(--v-space-3) 0; box-sizing: border-box; min-width: 0; }
  .tr-row--list .tr-inner { min-height: 87px; } /* the row's 1px top rule makes 88 */
  .tr-row--compact .tr-inner { min-height: 56px; padding: var(--v-space-2) var(--v-space-3); }
  .tr-row--card .tr-inner { padding: var(--v-space-3); min-height: 80px; }
  .tr-row .v-stretch { border-radius: var(--v-radius-md); }
  .tr-row:has(.v-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: -2px; border-radius: var(--v-radius-md); }
  .tr-row .v-stretch:focus-visible { outline: 0; }
  .tr-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0; pointer-events: none; }
  .tr-title { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-semibold); color: var(--v-text); transition: color var(--v-dur-base) var(--v-ease-out); text-decoration: line-through transparent; text-decoration-thickness: 2px; }
  .tr-biz { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .tr-meta { display: flex; align-items: center; gap: var(--v-space-2); min-width: 0; min-height: 22px; }
  .tr-when { flex: 0 0 auto; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tr-meta .v-pill { flex: 0 1 auto; min-width: 0; overflow: hidden; }
  .tr-meta .v-pill-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .tr-when.is-late { color: var(--v-status-danger-text); font-weight: var(--v-weight-semibold); }
  .tr-when.is-done { color: var(--v-status-booked-text); font-weight: var(--v-weight-semibold); }
  .tr-act { display: inline-flex; align-items: center; gap: var(--v-space-2); flex-shrink: 0; }
  .tr-act .v-btn { padding: 0 var(--v-space-3); }
  @media (max-width: 767px) { .tr-act { gap: var(--v-space-1); } }
  .tr-row.is-done .tr-title { color: var(--v-text-3); text-decoration-color: var(--v-text-3); }
  .tr-row.is-leaving { opacity: 0; pointer-events: none; }
  .tr-row .v-swipe { border-radius: var(--v-radius-lg); }
`;
