import { Icon } from './icons';
/**
 * RoundCheck: the round "done" control of a row on the home's Next up cards. One real button with a 44px tap target around a
 * 26px ring; done is a filled red circle with a white check. It is a button, not a checkbox, because the same control also
 * opens something (the Log outcome sheet on a call, the record on a rule action) and a toggle that opens a sheet is not a checkbox.
 * @param {object} props
 * @param {string} props.label accessible name, e.g. "Mark done: Print the covers, Perspective Shift"
 * @param {boolean} [props.done] filled, and not pressable again (an Undo toast takes it back); it stays focusable (aria-disabled) so focus is not lost
 * @param {'neutral'|'danger'} [props.tone='neutral'] the ring's color (danger on an overdue row)
 * @param {Function} [props.onClick]
 */
export default function RoundCheck({ label, done = false, tone = 'neutral', className = '', onClick, ...rest }) {
  return (
    <button type="button" className={`v-rcheck v-rcheck--${tone}${done ? ' is-done' : ''} ${className}`.trim()} aria-label={label} aria-disabled={done || undefined} onClick={done ? undefined : onClick} {...rest}>
      <span className="v-rcheck-ring" aria-hidden="true"><Icon icon="Check" size={14} /></span>
    </button>
  );
}
export const roundCheckStyles = `
  .v-rcheck { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: var(--v-tap); height: var(--v-tap); padding: 0; border: 0; background: transparent; cursor: pointer; border-radius: 50%; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .v-rcheck-ring { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; box-sizing: border-box; border-radius: 50%; border: 2px solid var(--v-text-3); color: transparent; background: transparent; transition: background var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out), transform var(--v-dur-fast) var(--v-ease-spring); }
  .v-rcheck--danger .v-rcheck-ring { border-color: var(--v-status-danger-text); }
  .v-rcheck:hover:not(.is-done) .v-rcheck-ring { border-color: var(--v-red); background: color-mix(in srgb, var(--v-red) 14%, transparent); }
  .v-rcheck:active:not(.is-done) .v-rcheck-ring { transform: scale(0.92); }
  .v-rcheck:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .v-rcheck.is-done { cursor: default; }
  .v-rcheck.is-done .v-rcheck-ring { background: var(--v-red); border-color: var(--v-red); color: var(--v-text-on-red); }
`;
