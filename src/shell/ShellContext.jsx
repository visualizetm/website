import { createContext, useContext, useEffect, useRef } from 'react';
/**
 * Shell context: what the shell exposes to screens.
 *   useShell()  -> { go(navId, preset?), openRecord, openCommand, openNotifications, newLead, newClient, setTopBar, events, calendly }
 *   preset: Leads accepts { status: [...callStatus ids], prio: [...], industry }, Call Console accepts { status: [...], prio: [...] }
 *   useTopBar({ title, back })  -> sets the top bar title and back button while mounted
 *
 * A screen with a detail view calls:
 *   useTopBar(sel ? { title: sel.business, back } : null);
 * Passing null (or unmounting) restores the nav label and hides the back button. Passing undefined touches nothing: a
 * list screen whose record is open passes undefined so its own null never overwrites the record's registration (both
 * mount in one commit on a cold open, and the child's effect runs first).
 */
export const ShellCtx = createContext(null);
export const useShell = () => useContext(ShellCtx);

export function useTopBar(spec) {
  const shell = useShell();
  const ref = useRef(spec);
  ref.current = spec;
  const title = spec?.title ?? null;
  const hasBack = !!spec?.back;
  /* actions: [{ id, label, icon, onClick, disabled }]; a focused phone screen shows these instead of the global controls. Compared by id and state so a screen can pass a fresh array each render. */
  const actions = spec?.actions || null;
  const actionKey = actions ? actions.map(a => `${a.id}:${a.disabled ? 1 : 0}`).join('|') : '';
  /* undefined: register nothing, but release a registration this same hook made before (a screen that owned the bar in a
     session mode and now stands down lets the nav label return; one that never registered leaves a child's bar alone). */
  const skip = spec === undefined;
  const mine = useRef(false);
  useEffect(() => {
    if (!shell) return undefined;
    if (skip) { if (mine.current) { mine.current = false; shell.setTopBar(null); } return undefined; }
    mine.current = !(title == null && !hasBack && !actions);
    const live = actions ? actions.map(a => ({ ...a, onClick: () => ref.current?.actions?.find(x => x.id === a.id)?.onClick?.() })) : null;
    shell.setTopBar(title == null && !hasBack && !live ? null : { title, back: hasBack ? () => ref.current?.back?.() : null, actions: live });
    return () => shell.setTopBar(null);
  }, [shell, title, hasBack, actionKey, skip]); // eslint-disable-line react-hooks/exhaustive-deps
}
