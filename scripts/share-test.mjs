/* Save to photos (src/lib/share.js) with navigator.share and canShare
 * mocked: every outcome the button can reach, and the attachment link the
 * fallback hands over.
 *
 *   node scripts/share-test.mjs
 */
import { saveMedia, saveLabel, attachmentUrl, filenameFor, canShareFiles, MAX_SHARE_BYTES } from '../src/lib/share.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);

const IMG = 'https://res.cloudinary.com/vz/image/upload/v1/planner/peach.jpg';
const VID = 'https://res.cloudinary.com/vz/video/upload/v1/planner/reel.mp4';

/* A browser in miniature: fetch answers with bytes of a chosen size, the
   share sheet and the anchor record what reached them. */
function env({ bytes = 1024, status = 200, share = 'ok', canShare = true, hasShare = true, fetchThrows = false, type = 'image/jpeg' } = {}) {
  const log = { shared: [], clicks: [], revoked: 0 };
  const e = {
    File,
    fetch: async () => {
      if (fetchThrows) throw new TypeError('blocked');
      return { ok: status === 200, status, blob: async () => new Blob([new Uint8Array(bytes)], { type }) };
    },
    navigator: hasShare ? {
      canShare: ({ files }) => canShare && files.length === 1,
      share: async ({ files }) => {
        if (share === 'abort') { const err = new Error('cancelled'); err.name = 'AbortError'; throw err; }
        if (share === 'fail') throw new Error('share failed');
        log.shared.push(files[0]);
      },
    } : undefined,
    URL: { createObjectURL: () => 'blob:probe', revokeObjectURL: () => { log.revoked++; } },
    document: {
      body: { appendChild: () => {} },
      createElement: () => { const a = { click() { log.clicks.push({ href: a.href, download: a.download }); }, remove() {} }; return a; },
    },
    setTimeout: (fn) => fn(),
  };
  return { e, log };
}

console.log('share-test: the attachment link');
eq(attachmentUrl(IMG), 'https://res.cloudinary.com/vz/image/upload/fl_attachment/v1/planner/peach.jpg', 'the image URL gains fl_attachment after /upload/');
eq(attachmentUrl(VID), 'https://res.cloudinary.com/vz/video/upload/fl_attachment/v1/planner/reel.mp4', 'a video URL too');
eq(attachmentUrl(attachmentUrl(IMG)), attachmentUrl(IMG), 'applying it twice changes nothing');
eq(attachmentUrl('https://example.com/upload/x.jpg'), 'https://example.com/upload/x.jpg', 'a URL off Cloudinary is left alone');
eq(attachmentUrl(''), '', 'an empty URL stays empty');
eq(filenameFor(IMG), 'peach.jpg', 'the file name is the last segment');
eq(filenameFor('https://res.cloudinary.com/vz/image/upload/v1/abc?x=1'), 'photo.jpg', 'no extension: a plain photo name');
eq(filenameFor('https://x/y/z', 'video'), 'video.mp4', 'no extension on a video: a plain video name');

console.log('share-test: the label follows the device');
{
  const { e } = env();
  eq(saveLabel(e), 'Save to photos', 'a phone that can share files says Save to photos');
  eq(canShareFiles(e), true, 'canShareFiles is true there');
  const { e: desk } = env({ hasShare: false });
  eq(saveLabel(desk), 'Download', 'a computer with no share sheet says Download');
  const { e: noFiles } = env({ canShare: false });
  eq(saveLabel(noFiles), 'Download', 'a share sheet that cannot take files says Download');
  const { e: broken } = env();
  broken.navigator.canShare = () => { throw new Error('nope'); };
  eq(saveLabel(broken), 'Download', 'a canShare that throws reads as no');
}

console.log('share-test: save on a phone');
{
  const { e, log } = env();
  const r = await saveMedia({ url: IMG }, e);
  eq(r.outcome, 'shared', 'the file reaches the share sheet');
  eq(log.shared.length, 1, 'exactly one file was shared');
  eq(log.shared[0].name, 'peach.jpg', 'under its own name');
  eq(log.shared[0].type, 'image/jpeg', 'with the blob type');
  eq(log.clicks.length, 0, 'no download anchor was clicked');
  eq(r.href, attachmentUrl(IMG), 'the result still carries the attachment link');
}
{
  const { e, log } = env({ share: 'abort' });
  const r = await saveMedia({ url: IMG }, e);
  eq(r.outcome, 'cancelled', 'closing the share sheet is cancelled, not a failure');
  eq(log.clicks.length, 0, 'and nothing is downloaded behind their back');
}
{
  const { e } = env({ share: 'fail' });
  const r = await saveMedia({ url: IMG }, e);
  eq([r.outcome, r.reason], ['fallback', 'share'], 'a share that fails falls back to the picture');
}
{
  const { e, log } = env({ bytes: 2048, type: 'video/mp4' });
  const r = await saveMedia({ url: VID, kind: 'video' }, e);
  eq(r.outcome, 'shared', 'a video shares the same way');
  eq(log.shared[0].name, 'reel.mp4', 'with its own name');
}

console.log('share-test: save on a computer');
{
  const { e, log } = env({ hasShare: false });
  const r = await saveMedia({ url: IMG }, e);
  eq(r.outcome, 'downloaded', 'no share sheet: a normal download');
  eq(log.clicks.length, 1, 'one anchor click');
  eq(log.clicks[0].download, 'peach.jpg', 'with the original file name');
  eq(log.clicks[0].href, 'blob:probe', 'of the fetched bytes, never a rendition');
  eq(log.revoked, 1, 'the object URL is released');
}
{
  const { e, log } = env({ canShare: false });
  const r = await saveMedia({ url: IMG }, e);
  eq(r.outcome, 'downloaded', 'a share sheet that cannot take files downloads instead');
  eq(log.clicks.length, 1, 'through the anchor');
}
{
  const { e } = env({ hasShare: false });
  e.document.createElement = () => { throw new Error('no DOM'); };
  const r = await saveMedia({ url: IMG }, e);
  eq([r.outcome, r.reason], ['fallback', 'download'], 'a download that cannot start falls back');
}

console.log('share-test: when the bytes cannot be had');
{
  const { e } = env({ fetchThrows: true });
  const r = await saveMedia({ url: IMG }, e);
  eq([r.outcome, r.reason], ['fallback', 'fetch'], 'a blocked fetch (CORS or CSP) falls back');
  eq(r.href, attachmentUrl(IMG), 'with the attachment link to offer');
}
{
  const { e } = env({ status: 403 });
  const r = await saveMedia({ url: IMG }, e);
  eq([r.outcome, r.reason], ['fallback', 'fetch'], 'a refused fetch falls back too');
}
{
  const { e, log } = env({ bytes: MAX_SHARE_BYTES + 1, type: 'video/mp4' });
  const r = await saveMedia({ url: VID, kind: 'video' }, e);
  eq([r.outcome, r.reason], ['fallback', 'size'], 'a video over the limit is not pushed through the share sheet');
  eq(log.shared.length, 0, 'nothing was shared');
  eq(r.href, attachmentUrl(VID), 'the download link is the answer');
}
{
  const r = await saveMedia({ url: '' }, env().e);
  eq([r.outcome, r.reason], ['fallback', 'no-url'], 'no URL: nothing to save');
}

console.log(`\nshare-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
