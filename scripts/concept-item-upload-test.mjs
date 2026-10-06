#!/usr/bin/env node
/* Concepts editor: tap a blank image to upload it. Needs a build made with the upload env vars set
 *   VITE_CLOUDINARY_CLOUD_NAME=demo VITE_CLOUDINARY_UPLOAD_PRESET=p npx vite build --outDir <dir>
 * served on AUDIT_BASE (default 4336). Cloudinary is mocked at the network: a good upload, then a 400.
 * Checks at 390: the blank box is one 44px button, the picked file lands in that item, caption, kind and the item count
 * do not change, a failed upload toasts and leaves the box tappable, a filled item is not a button. */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4336';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL_OK = 'https://res.cloudinary.com/demo/image/upload/picked.jpg';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
await mockRoutes(page, { session: true });
let mode = 'ok', uploads = 0;
await page.route('https://api.cloudinary.com/**', r => { uploads++; return mode === 'ok' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secure_url: URL_OK }), headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Invalid upload preset' } }), headers: { 'access-control-allow-origin': '*' } }); });
await page.route('https://res.cloudinary.com/**', r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>' }));
await page.goto(`${BASE}/admin/leads/L11/concepts`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /^Direction A/ }).first().click(); // on a phone a direction is a row that opens its own step
await page.waitForSelector('.ce-item');

const pick = page.getByRole('button', { name: 'Add the image for A2' });
ok(await pick.count() === 1, 'the blank item is one button, "Add the image for A2"');
const box = await pick.boundingBox();
ok(box && box.width >= 44 && box.height >= 44, `the button is at least 44 x 44 (${Math.round(box.width)} x ${Math.round(box.height)})`);
ok(await page.getByRole('button', { name: 'Add the image for A1' }).count() === 0, 'a filled item is not a button');
ok(/Tap to add the image/.test(await page.locator('.ce-item-hint').first().innerText()), 'the box says "Tap to add the image"');
const before = { items: await page.locator('.ce-item').count(), caption: await page.locator('.ce-item').nth(1).locator('input[type=text], input:not([type])').last().inputValue().catch(() => '') };

// A failed upload first.
mode = 'bad';
let [chooser] = await Promise.all([page.waitForEvent('filechooser'), pick.click()]);
await chooser.setFiles({ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('x') });
await page.waitForSelector('text=/Cloudinary refused the upload \\(400\\)/', { timeout: 5000 }).then(() => ok(true, 'a failed upload toasts what Cloudinary said'), () => ok(false, 'a failed upload toasts what Cloudinary said'));
ok(await page.getByRole('button', { name: 'Add the image for A2' }).isEnabled(), 'after a failure the box is tappable again');
ok(await page.locator('.ce-item').nth(1).locator('img').count() === 0, 'after a failure the box is still blank');

// Then a good one.
mode = 'ok';
[chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Add the image for A2' }).click()]);
await chooser.setFiles({ name: 'b.png', mimeType: 'image/png', buffer: Buffer.from('x') });
await page.waitForSelector('.ce-item:nth-child(2) img', { timeout: 5000 }).then(() => ok(true, 'the picked file lands in that item'), () => ok(false, 'the picked file lands in that item'));
ok((await page.locator('.ce-item').nth(1).locator('img').getAttribute('src')) === URL_OK, 'the item holds the uploaded URL');
ok(await page.locator('.ce-item').count() === before.items, `the item count is unchanged (${before.items})`);
ok(await page.getByRole('button', { name: /Add the image for A2/ }).count() === 0, 'a filled item is no longer a button');
ok(uploads === 2, `two uploads were made (${uploads})`);
const caption = await page.locator('.ce-item').nth(1).getByLabel('Caption').inputValue();
ok(caption === 'A broken link', `the caption is untouched ("${caption}")`);
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nconcept-item-upload-test: all passed');
process.exit(fails ? 1 : 0);
