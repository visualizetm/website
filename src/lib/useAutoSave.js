import { useEffect, useRef, useState } from 'react';
import { AUTOSAVE_MS, RETRY_MS } from './docSave';

/* Autosave for the three editors that used to have a Save bar (Planner, Showcase, Concepts; prompt 3 of 3, milestone 3), on the docs pattern:
 * about a second and a half after the last change the draft saves, the chip says Saving then Saved, a failed save says "Not saved, retrying"
 * and tries again with a growing wait, and one request runs at a time. The page owns the draft and its save(); this only decides when.
 *   dirty   the draft differs from the record (what autosave would write)
 *   saving  a request is in flight
 *   watch   the draft itself: each change restarts the wait
 *   save    async ({ quiet }) => boolean; quiet saves do not toast (the chip is the feedback)
 * Returns the status: 'saved' | 'dirty' | 'saving' | 'failed'. */
export const EDIT_AUTOSAVE_MS = AUTOSAVE_MS + 500;
export function useAutoSave({ dirty, saving, save, watch, delay = EDIT_AUTOSAVE_MS }) {
  const [failed, setFailed] = useState(false);
  const tries = useRef(0);
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => {
    if (!dirty || saving) return undefined;
    const wait = failed ? RETRY_MS[Math.min(Math.max(tries.current - 1, 0), RETRY_MS.length - 1)] : delay;
    const id = setTimeout(async () => {
      const ok = await saveRef.current({ quiet: true });
      if (ok === false) { tries.current += 1; setFailed(true); } else { tries.current = 0; setFailed(false); }
    }, wait);
    return () => clearTimeout(id);
  }, [dirty, saving, watch, failed, delay]);
  useEffect(() => { if (!dirty && failed) { tries.current = 0; setFailed(false); } }, [dirty, failed]);
  return saving ? 'saving' : dirty ? (failed ? 'failed' : 'dirty') : 'saved';
}

export const SAVE_CHIP_LABEL = { saved: 'Saved', dirty: 'Saving...', saving: 'Saving...', failed: 'Not saved, retrying' };
