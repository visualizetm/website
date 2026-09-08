/* Cloudinary upload wiring, checked without a Cloudinary account.
 *
 * The module reads import.meta.env at load, which node cannot provide, so
 * the two files under test are read as text, their import.meta.env access
 * rewritten to a plain object, and the result imported from a data URL.
 * That keeps the assertions against the real source rather than a copy.
 *
 *   node scripts/cloudinary-test.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

let fails = 0;
const ok = (c, m, extra = '') => { console.log((c ? 'ok   ' : 'FAIL ') + m + (extra ? `  ${extra}` : '')); if (!c) fails++; };

async function loadModule(file, env = {}) {
  const src = readFileSync(path.resolve(file), 'utf8')
    .replace(/import\.meta\.env/g, JSON.stringify(env))
    .replace(/from '\.\.\/marketing\/showcase'/g, "from './showcase.js'");
  return import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
}

const ENV = { VITE_CLOUDINARY_CLOUD_NAME: 'visualize-test', VITE_CLOUDINARY_UPLOAD_PRESET: 'visualize' };

/* ── The upload call ─────────────────────────────────────────────── */
{
  const mod = await loadModule('src/lib/cloudinary.js', ENV);
  ok(mod.cloudinaryEnabled === true, 'both env vars present -> enabled');

  const off = await loadModule('src/lib/cloudinary.js', { VITE_CLOUDINARY_CLOUD_NAME: 'x' });
  ok(off.cloudinaryEnabled === false, 'one env var missing -> disabled (the Upload button never renders)');
  const offRes = await off.uploadToCloudinary(new File(['x'], 'a.png', { type: 'image/png' }));
  ok(!!offRes.error && !offRes.url, 'disabled upload returns an error, never a silent null');

  // Capture exactly what the browser would send.
  let seen = null;
  globalThis.fetch = async (url, init) => {
    seen = { url, method: init.method, body: init.body };
    return { ok: true, status: 200, json: async () => ({ secure_url: 'https://res.cloudinary.com/visualize-test/image/upload/v1/showcase/a.png' }) };
  };
  // A real File, not a stand-in: FormData stringifies anything that is not
  // a Blob, so a plain object would pass a shape check that a browser would
  // fail. node 20+ has File globally.
  const file = new File([new Uint8Array(1234)], 'a.png', { type: 'image/png' });
  const res = await mod.uploadToCloudinary(file);

  ok(seen?.url === 'https://api.cloudinary.com/v1_1/visualize-test/image/upload', `POSTs to the unsigned image endpoint (got ${seen?.url})`);
  ok(seen?.method === 'POST', 'method is POST');
  ok(seen?.body instanceof FormData, 'body is FormData, not JSON');
  ok(seen?.body.get('file') instanceof File && seen.body.get('file').name === 'a.png', 'FormData carries the file itself');
  ok(seen?.body.get('upload_preset') === 'visualize', 'FormData carries upload_preset');
  ok([...seen.body.keys()].sort().join(',') === 'file,upload_preset', `FormData carries nothing else (got ${[...seen.body.keys()].join(',')})`);
  ok(!/api_key|api_secret|signature|timestamp/i.test([...seen.body.keys()].join(',')), 'no api key, secret, signature or timestamp is sent');
  ok(res.url === 'https://res.cloudinary.com/visualize-test/image/upload/v1/showcase/a.png', 'secure_url is what comes back');

  // SVG goes through the same image endpoint.
  seen = null;
  const svg = await mod.uploadToCloudinary(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
  ok(seen?.url.endsWith('/image/upload'), 'an SVG uses the same /image/upload endpoint');
  ok(!!svg.url, 'an SVG upload succeeds');

  // Cloudinary's own message is passed through, not swallowed.
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Upload preset not found' } }) });
  const bad = await mod.uploadToCloudinary(file);
  ok(bad.error === 'Cloudinary: Upload preset not found', `Cloudinary's message reaches the toast (got ${JSON.stringify(bad.error)})`);

  globalThis.fetch = async () => { throw new Error('offline'); };
  const net = await mod.uploadToCloudinary(file);
  ok(/Could not reach Cloudinary/.test(net.error || ''), 'a network failure says so');

  // Validation happens before anything is sent.
  let called = false;
  globalThis.fetch = async () => { called = true; return { ok: true, status: 200, json: async () => ({ secure_url: 'x' }) }; };
  const big = await mod.uploadToCloudinary(new File([new Uint8Array(11 * 1024 * 1024)], 'huge.png', { type: 'image/png' }));
  ok(/limit is/.test(big.error || '') && !called, 'a file over the size limit is refused without a request');
  called = false;
  const wrong = await mod.uploadToCloudinary(new File(['x'], 'movie.mp4', { type: 'video/mp4' }));
  ok(/JPEG, PNG, WebP or SVG/.test(wrong.error || '') && !called, 'a wrong format is refused without a request');
  ok(mod.ACCEPT_ATTR === 'image/jpeg,image/png,image/webp,image/svg+xml', `the accept attribute is the four allowed types (got ${mod.ACCEPT_ATTR})`);
}

/* ── The width transform ─────────────────────────────────────────── */
{
  const src = readFileSync(path.resolve('src/marketing/showcase.jsx'), 'utf8');
  const start = src.indexOf('export const IMG_W');
  const end = src.indexOf('/** The list/preview card');
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src.slice(start, end)).toString('base64')}`);
  const { capImageWidth, IMG_W } = mod;

  const plain = 'https://res.cloudinary.com/visualize/image/upload/v1712345678/showcase/cover.jpg';
  ok(capImageWidth(plain, 800) === 'https://res.cloudinary.com/visualize/image/upload/c_limit,w_800/v1712345678/showcase/cover.jpg',
    `the transform lands right after /image/upload/ (got ${capImageWidth(plain, 800)})`);
  ok(capImageWidth(plain, IMG_W.instagramPost).includes('c_limit,w_600/'), 'each context can ask for its own width');

  const already = 'https://res.cloudinary.com/visualize/image/upload/c_limit,w_1600/v1/showcase/cover.jpg';
  ok(capImageWidth(already, 800) === already, 'a URL that already carries a transform is left alone');

  for (const other of [
    'https://drive.google.com/file/d/abc/view',
    '/showcase/fixtures/wide.svg',
    'https://example.com/image/upload/thing.jpg',
  ]) ok(capImageWidth(other, 800) === other, `a non-Cloudinary URL passes through untouched (${other.slice(0, 40)})`);

  ok(capImageWidth('', 800) === '' && capImageWidth(null, 800) === '' && capImageWidth({}, 800) === '',
    'an empty, null or non-string value degrades to an empty string, never a crash');

  const widths = Object.entries(IMG_W).map(([k, v]) => `${k}=${v}`).join(' ');
  ok(IMG_W.heroCover === 1600 && IMG_W.cardCover === 800 && IMG_W.gallery === 1600 && IMG_W.screenshot === 1600
    && IMG_W.instagramPost === 600 && IMG_W.logo === 400 && IMG_W.card === 1200,
    `the per-context widths are the ones the brief set (${widths})`);
}

console.log(fails ? `\n${fails} failing.` : '\nAll Cloudinary upload tests pass.');
process.exit(fails ? 1 : 0);
