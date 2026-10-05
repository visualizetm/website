/* Autosave for a doc (docs job, milestone 3), framework free so scripts/docs-save-test.mjs can drive it with a fake clock.
 *
 * A saver holds the latest payload and one request at a time. dirty(payload) marks it unsaved and starts the debounce (about a second);
 * flush() saves now (Back, the tab hiding) and resolves true when everything typed has been stored. save() may answer 'rejected' for a refusal that
 * retrying cannot fix (a 400): the status reads 'rejected', nothing is retried, and the next edit sends again. A failed save keeps the payload in
 * memory, reports 'failed' ("Not saved, retrying") and retries with a growing wait until it lands, so nothing typed is ever dropped
 * because the network blinked. Anything typed while a request is in flight goes in the next one, in order.
 *
 * keep(id) / release: a saver that still holds unsaved text when its editor closes stays alive in the background (retrying) and gives
 * its payload back to the next open of the same doc (pendingFor), so leaving the screen never loses text. */
export const AUTOSAVE_MS = 1000;
export const RETRY_MS = [2000, 4000, 8000, 15000];

export function createSaver({ save, delay = AUTOSAVE_MS, retry = RETRY_MS, onStatus, timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) } }) {
  let latest = null; let sentSeq = 0; let seq = 0; let status = 'saved'; let timer = 0; let tries = 0; let inflight = null; let disposed = false;
  const setStatus = (s) => { if (status !== s) { status = s; onStatus?.(s); } };
  const clear = () => { if (timer) { timers.clear(timer); timer = 0; } };
  async function run() {
    if (inflight) return inflight;
    inflight = (async () => {
      while (!disposed && sentSeq < seq) {
        const mine = seq; const payload = latest;
        setStatus('saving');
        let res = false;
        try { res = await save(payload); } catch { res = false; }
        const ok = res !== false && res !== 'rejected';
        if (res === 'rejected') {
          /* The server said no and will keep saying it (a 400): not retried, the text stays in the editor, the next edit tries again. */
          setStatus('rejected'); inflight = null; return false;
        }
        if (ok) { sentSeq = mine; tries = 0; }
        else {
          setStatus('failed');
          const wait = retry[Math.min(tries, retry.length - 1)]; tries++;
          inflight = null;
          if (!disposed) timer = timers.set(() => { timer = 0; run(); }, wait);
          return false;
        }
      }
      inflight = null;
      if (sentSeq >= seq) setStatus('saved');
      return true;
    })();
    return inflight;
  }
  return {
    get status() { return status; },
    get latest() { return latest; },
    get unsaved() { return sentSeq < seq; },
    dirty(payload) { latest = payload; seq++; clear(); setStatus('dirty'); timer = timers.set(() => { timer = 0; run(); }, delay); },
    /** Save everything now; true when it is all stored (false when the request failed and a retry is waiting). */
    async flush() { clear(); if (sentSeq >= seq) return true; return (await run()) === true && sentSeq >= seq; },
    /** The network came back or the tab woke: try now instead of waiting out the backoff. */
    retryNow() { if (status === 'failed' && !inflight) { clear(); run(); } },
    dispose() { disposed = true; clear(); },
  };
}

/* Savers that outlive their editor because they still hold text: id -> saver. */
const kept = new Map();
export const pendingFor = (id) => { const s = kept.get(String(id)); return s && s.unsaved ? s.latest : null; };
/** Called when an editor closes: a saver with nothing left to save is disposed; one with unsaved text stays and retries until it lands. */
export function release(id, saver, onGone) {
  if (!saver.unsaved && saver.status === 'saved') { saver.dispose(); return; }
  const key = String(id);
  kept.set(key, saver);
  const poll = setInterval(() => { if (!saver.unsaved && saver.status === 'saved') { clearInterval(poll); saver.dispose(); if (kept.get(key) === saver) kept.delete(key); onGone?.(); } }, 500);
  saver.flush().then((ok) => { if (ok) { clearInterval(poll); saver.dispose(); if (kept.get(key) === saver) kept.delete(key); onGone?.(); } });
}
/** A new editor on the same doc takes over its kept saver's text (and ends that saver) so the two never write over each other. */
export function takeover(id) {
  const key = String(id); const s = kept.get(key);
  if (!s) return null;
  const payload = s.unsaved ? s.latest : null;
  s.dispose(); kept.delete(key);
  return payload;
}
