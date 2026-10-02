import { isSectionRoot } from './nav-history';

/* Chrome modes (CRM mobile revamp, milestone 3): what surrounds a phone screen.
 *
 *   tabs     a section root or a list: the tab bar is shown and the top bar offers the global controls
 *            (Search, Quick add, Notifications).
 *   focused  a record opened from a list, an editor, a setup page, the Call Console's room, queue and
 *            summary, a create form: the tab bar is hidden, the top bar is Back and the title and only
 *            the controls the screen declares through useTopBar({ actions }).
 *
 * The rule is one function of the history entry, so it cannot drift from the navigation model: an entry
 * that carries an open or a create request, or a path deeper than a section root, is focused. Back
 * (nav-history.js) returns to a tabs screen and the tab bar slides back. Desktop (768 and up) has no
 * tab bar and its top bar is unchanged; the mode is still computed so the audits can read it.
 * docs/ARCHITECTURE.md, "Chrome modes". */
export const CHROME = { TABS: 'tabs', FOCUSED: 'focused' };

export function chromeOf(location) {
  const st = location?.state;
  if (st?.open || st?.create) return CHROME.FOCUSED;
  return isSectionRoot(location?.pathname || '/') ? CHROME.TABS : CHROME.FOCUSED;
}
