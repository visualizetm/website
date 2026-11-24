/* Save to photos (planner dashboard, milestone 3).
 *
 * The client taps one button and the picture lands in their camera roll, or
 * the file lands in their downloads, whichever the device can do. The
 * decision is made from what the browser offers, never from a user agent
 * string:
 *
 *   share a file     navigator.canShare({ files }) is true, which is the one
 *                    path that reaches Photos on a phone. The button says
 *                    "Save to photos".
 *   download         no file sharing (a computer): the original bytes go out
 *                    as an ordinary download. The button says "Download".
 *   fallback         the fetch was blocked, the share failed, or the file is
 *                    too big to hand over: the caller shows the picture and
 *                    says "Press and hold the picture, then Save to Photos",
 *                    with a link to the original carrying Cloudinary's
 *                    attachment flag so a second tap downloads it instead.
 *   cancelled        they closed the share sheet. Nothing to say.
 *
 * The file is always the stored original: no rendition, nothing cropped.
 *
 * Every browser global is read from `env` so the whole decision can run in
 * node (scripts/share-test.mjs) with navigator.share and canShare mocked.
 */

/** Over this, a share sheet or a download is more likely to fail than to finish; the attachment link is the honest path. */
export const MAX_SHARE_BYTES = 50 * 1024 * 1024;

const CLOUDINARY_UPLOAD = /^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\//;

/** The same URL with Cloudinary's attachment flag, so the browser saves it instead of showing it. Any other URL comes back untouched. */
export function attachmentUrl(url) {
  const u = String(url || '');
  if (!CLOUDINARY_UPLOAD.test(u) || /\/upload\/fl_attachment/.test(u)) return u;
  return u.replace('/upload/', '/upload/fl_attachment/');
}

/** A file name from the URL's last segment when it has an extension, else a plain one. */
export function filenameFor(url, kind = 'image') {
  const base = String(url || '').split('?')[0].split('#')[0].split('/').pop() || '';
  if (/^[\w.-]+\.[a-z0-9]{2,5}$/i.test(base)) return base;
  return kind === 'video' ? 'video.mp4' : 'photo.jpg';
}

/** True when this browser can hand a file to the share sheet (the path that reaches Photos). */
export function canShareFiles(env = globalThis) {
  const nav = env.navigator;
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || typeof env.File !== 'function') return false;
  try { return !!nav.canShare({ files: [new env.File([''], 'probe.png', { type: 'image/png' })] }); }
  catch { return false; }
}

/** What the button says: the device's own word for what will happen. */
export const saveLabel = (env = globalThis) => (canShareFiles(env) ? 'Save to photos' : 'Download');

/**
 * Saves one picture or video.
 * @param {{ url: string, name?: string, kind?: 'image'|'video' }} media
 * @returns {Promise<{ outcome: 'shared'|'downloaded'|'cancelled'|'fallback', reason?: string, href: string }>}
 */
export async function saveMedia({ url, name = '', kind = 'image' } = {}, env = globalThis) {
  const href = attachmentUrl(url);
  if (!url) return { outcome: 'fallback', reason: 'no-url', href };

  let blob;
  try {
    const res = await env.fetch(url, { mode: 'cors' });
    if (!res || !res.ok) throw new Error(`status ${res && res.status}`);
    blob = await res.blob();
  } catch {
    return { outcome: 'fallback', reason: 'fetch', href };
  }
  if (!blob || blob.size > MAX_SHARE_BYTES) return { outcome: 'fallback', reason: 'size', href };

  const filename = name || filenameFor(url, kind);
  const type = blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const file = new env.File([blob], filename, { type });

  const nav = env.navigator;
  if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    let ok = false;
    try { ok = !!nav.canShare({ files: [file] }); } catch { ok = false; }
    if (ok) {
      try {
        await nav.share({ files: [file] });
        return { outcome: 'shared', href };
      } catch (e) {
        if (e && e.name === 'AbortError') return { outcome: 'cancelled', href };
        return { outcome: 'fallback', reason: 'share', href };
      }
    }
  }

  // A computer: the original bytes as an ordinary download.
  try {
    const doc = env.document;
    const a = doc.createElement('a');
    const obj = env.URL.createObjectURL(blob);
    a.href = obj;
    a.download = filename;
    a.rel = 'noopener';
    doc.body.appendChild(a);
    a.click();
    a.remove();
    env.setTimeout(() => env.URL.revokeObjectURL(obj), 4000);
    return { outcome: 'downloaded', href };
  } catch {
    return { outcome: 'fallback', reason: 'download', href };
  }
}

/** A carousel's file names (carousel job): <business>-<date>-01.jpg, -02, ... in slide order, the extension from filenameFor. */
export function carouselNames(urls, { business = '', date = '' } = {}) {
  const slug = String(business || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'post';
  const base = [slug, /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : ''].filter(Boolean).join('-');
  return (Array.isArray(urls) ? urls : []).map((u, i) => {
    const ext = ((filenameFor(u).match(/\.[a-z0-9]{2,5}$/i) || ['.jpg'])[0]).toLowerCase();
    return `${base}-${String(i + 1).padStart(2, '0')}${ext}`;
  });
}

/**
 * Saves a carousel's pictures in one go (carousel job), beside saveMedia and through it: no second share path.
 *  - Every picture as a file in one navigator.share({ files }) call when canShareFiles allows it and the whole set is under
 *    MAX_SHARE_BYTES (the one tap that reaches Photos with all of them).
 *  - Otherwise one after another through saveMedia, named in order (carouselNames).
 * onProgress(i, n) is called as each picture is fetched or saved (for "Saving 3 of 7"). `only` is the slide indexes to save
 * (a retry of the one that failed). A share sheet closed is cancelled, and nothing more is tried.
 * @returns {Promise<{ outcome: 'shared'|'downloaded'|'partial'|'cancelled'|'fallback', saved: number, failed: number[], hrefs: string[] }>}
 *   failed holds 1 based slide numbers; hrefs the attachment link of each picture, for the press and hold fallback.
 */
export async function saveMany({ urls = [], business = '', date = '', onProgress, only } = {}, env = globalThis) {
  const list = (Array.isArray(urls) ? urls : []).map(u => String(u || ''));
  const names = carouselNames(list, { business, date });
  const pick = (Array.isArray(only) && only.length ? only : list.map((_, i) => i)).filter(i => list[i]);
  const hrefs = list.map(attachmentUrl);
  const tell = (i) => { try { onProgress?.(i, pick.length); } catch { /* progress is a nicety */ } };
  if (!pick.length) return { outcome: 'fallback', saved: 0, failed: [], hrefs };

  /* One share sheet with every file: fetch them all first, and only if every one arrives and the set fits. */
  if (pick.length > 1 && canShareFiles(env)) {
    const files = []; let total = 0; let whole = true;
    for (let k = 0; k < pick.length; k++) {
      const i = pick[k];
      tell(k + 1);
      try {
        const res = await env.fetch(list[i], { mode: 'cors' });
        if (!res || !res.ok) throw new Error('status');
        const blob = await res.blob();
        total += blob.size;
        files.push(new env.File([blob], names[i], { type: blob.type || 'image/jpeg' }));
      } catch { whole = false; break; }
      if (total > MAX_SHARE_BYTES) { whole = false; break; }
    }
    let can = false;
    try { can = whole && !!env.navigator.canShare({ files }); } catch { can = false; }
    if (can) {
      try { await env.navigator.share({ files }); return { outcome: 'shared', saved: files.length, failed: [], hrefs }; }
      catch (e) { if (e && e.name === 'AbortError') return { outcome: 'cancelled', saved: 0, failed: [], hrefs }; }
    }
  }

  /* One after another, through saveMedia. */
  const failed = []; let saved = 0; let shared = false;
  for (let k = 0; k < pick.length; k++) {
    const i = pick[k];
    tell(k + 1);
    const r = await saveMedia({ url: list[i], name: names[i], kind: 'image' }, env);
    if (r.outcome === 'cancelled') return { outcome: 'cancelled', saved, failed, hrefs };
    if (r.outcome === 'fallback') failed.push(i + 1);
    else { saved++; if (r.outcome === 'shared') shared = true; }
  }
  const outcome = !failed.length ? (shared ? 'shared' : 'downloaded') : saved ? 'partial' : 'fallback';
  return { outcome, saved, failed, hrefs };
}
