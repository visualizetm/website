#!/usr/bin/env node
/* Rob's month board for a client's planner (Planner v2, part 2) in a browser, at 390 and 1280, against the audit fixtures (L11):
 *   the activity strip, the four columns on a computer and the column chips on a phone, the red lines, Send n for approval as one
 *   POST with Undo putting them back, a drag from Making to Waiting (a computer) that is the send, the card's menu, the calendar,
 *   the Ideas view stamping seen, the editor as a side sheet on a computer and its own path on a phone with Post, Reel, Ad, the
 *   caption count, a hashtag set chip, the amber change card and Preview as the client; and nothing approved or posted for the client
 *   by any drag.
 *   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/planner-board-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, leads } from './audit-fixtures.mjs';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };

/* A hashtag set on the client so the editor has a chip to press. */
const L11 = leads.find(l => l._id === 'L11');
L11.planner.hashtagSets = [{ id: 'hsA', name: 'Detailing', tags: '#detailing #ceramiccoating' }];

async function session(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch { /* none */ } });
  await mockRoutes(page, {});
  const writes = [];
  page.on('request', (r) => { if (!['GET', 'HEAD'].includes(r.method()) && /\/api\/admin\/(posts|suggestions|call-leads)/.test(r.url())) { let b = {}; try { b = JSON.parse(r.postData() || '{}'); } catch { /* none */ } writes.push({ url: r.url(), method: r.method(), body: b }); } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const opened = []; await ctx.exposeFunction('__opened', (u) => opened.push(u));
  await page.addInitScript(() => { const o = window.open; window.open = (u) => { window.__opened?.(String(u)); return null; }; void o; });
  return { ctx, page, writes, errors, opened };
}
const rel = (p) => new URL(p.url()).pathname.replace(/^\/admin/, '');
/* A drag the way a hand does it: press, move in steps, let go (one jump to the target never starts an HTML5 drag on this page). */
async function drag(p, from, to) {
  const a = await from.boundingBox(); const t = await to.boundingBox();
  if (!a || !t) return;
  const x0 = a.x + 24; const y0 = a.y + a.height / 2; const x1 = t.x + t.width / 2; const y1 = t.y + 60;
  await p.mouse.move(x0, y0); await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12); await p.waitForTimeout(25); }
  await p.mouse.up();
}

for (const width of [1280, 390]) {
  const phone = width < 768;
  console.log(`── ${width}px ──`);
  const S = await session(width); const p = S.page;
  await p.goto(`${BASE}/admin/clients/L11/planner`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.pb-card', { timeout: 8000 });

  /* The strip and the quiet line. */
  const strip = await p.locator('.pb-strip').innerText();
  ok(/Posts ready/.test(strip) && /Waiting on/.test(strip) && /Changes asked/.test(strip) && /New ideas/.test(strip), `the activity strip names its four tiles (${strip.replace(/\s+/g, ' ').slice(0, 120)})`);
  ok(/Quote asks from the live ad/.test(strip), 'the live ad\'s best result shows when there is one');
  ok(/Opened the planner/.test(await p.locator('.pl-quiet').innerText()), 'the quiet line says when they last opened it');

  /* Columns on a computer, chips on a phone. */
  if (!phone) {
    const heads = await p.locator('.pb-col-label').allInnerTexts();
    ok(heads.length === 4 && /^Making$/i.test(heads[0]) && /^Waiting on/i.test(heads[1]) && /^Approved$/i.test(heads[2]) && /^Posted or live$/i.test(heads[3]), `four columns, in order (${heads.join(' | ')})`);
    ok(await p.locator('.pb-flag', { hasText: 'Goes up today' }).count() === 1, 'the approved post dated today carries Goes up today');
  } else {
    ok(await p.locator('.pb-board').count() === 0 && await p.locator('.pb-chips .v-chip').count() === 4, 'a phone gets the chip row, never four squeezed columns');
    await p.locator('.pb-chips .v-chip').nth(1).click(); await p.waitForTimeout(300);
    ok(await p.locator('.pb-list .pb-card').count() >= 2, 'the Waiting chip shows the posts waiting');
    await p.locator('.pb-chips .v-chip').nth(0).click(); await p.waitForTimeout(300);
  }

  /* The batch send: one POST, Undo puts them back to Making. */
  const sendBtn = phone ? p.getByRole('button', { name: /^Send \d+ for approval$/ }) : p.locator('.pl-send-batch');
  ok(await sendBtn.count() === 1, 'Send n for approval is offered (the toolbar on a computer, the top bar on a phone)');
  S.writes.length = 0;
  await sendBtn.first().click(); await p.waitForTimeout(900);
  const sends = S.writes.filter(w => w.method === 'POST' && w.body.action === 'send-review');
  ok(sends.length === 1 && sends[0].body.leadId === 'L11' && Array.isArray(sends[0].body.ids) && sends[0].body.ids.length >= 1, `one request for the whole send (${JSON.stringify(sends.map(s => s.body))})`);
  ok(!S.writes.some(w => w.method === 'PATCH' && w.body?.set?.status === 'review'), 'no post is sent one PATCH at a time');
  const toast = p.locator('.v-toast', { hasText: /for approval/ });
  ok(await toast.count() >= 1, 'a toast says it went, with Undo');
  S.writes.length = 0;
  await toast.locator('.v-toast-action').first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(900);
  const undo = S.writes.filter(w => w.method === 'PATCH' && w.body?.set?.status === 'making');
  ok(undo.length === sends[0].body.ids.length, `Undo puts every one back to Making (${undo.length} of ${sends[0].body.ids.length})`);

  /* The card's menu, and a drag: neither approves nor posts on its own. */
  if (!phone) {
    const making = p.locator('.pb-col').nth(0).locator('.pb-card').filter({ hasNotText: 'Nov 30' }).first(); // not PO3: its change request is checked in the editor below
    const waiting = p.locator('.pb-col').nth(1);
    S.writes.length = 0;
    await drag(p, making, waiting); await p.waitForTimeout(2600);
    const moved = S.writes.filter(w => w.method === 'PATCH' && w.body?.set?.status === 'review');
    ok(moved.length === 1, `a drag from Making to Waiting is the send for approval, written once (${moved.length})`);
    S.writes.length = 0;
    const approved = p.locator('.pb-col').nth(2).locator('.pb-card').first();
    await drag(p, approved, p.locator('.pb-col').nth(3)); await p.waitForTimeout(2600);
    ok(!S.writes.some(w => w.body?.set?.status === 'posted'), 'a drag from Approved to Posted does nothing: only the menu marks a post posted');
    await p.locator('.pb-col').nth(2).locator('.pb-card button[aria-haspopup]').first().click();
    const items = await p.getByRole('menuitem').allInnerTexts();
    ok(items.some(t => /Mark posted/.test(t)) && items.some(t => /Back to Making/.test(t)), `the menu carries the other moves (${items.join(' | ')})`);
    await p.keyboard.press('Escape');
  }

  /* The calendar and the Ideas view. */
  await p.getByRole('radio', { name: 'Calendar' }).click(); await p.waitForTimeout(400);
  ok(await p.locator(phone ? '.pb-agenda .pb-chip' : '.pb-cal .pb-chip').count() >= 3, 'the calendar draws the month\'s items as chips');
  ok(await p.locator('.pb-chip--won').count() >= 1 && await p.locator('.pb-chip--progress').count() >= 1, 'waiting chips are red and ads blue');
  S.writes.length = 0;
  await p.getByRole('radio', { name: /^Ideas/ }).click(); await p.waitForTimeout(900);
  const seen = S.writes.filter(w => w.method === 'PATCH' && /suggestions/.test(w.url) && w.body?.set?.seenAt === true);
  ok(seen.length >= 1 && seen.every(w => w.body.id), `opening Ideas stamps each unseen idea seen (${seen.length})`);
  ok(await p.locator('.pl-idea').count() >= 1, 'the inbox is the Ideas view');
  await p.getByRole('radio', { name: 'Board' }).click(); await p.waitForTimeout(400);

  /* The editor: a side sheet on a computer, its own path on a phone. PO3 carries a change request. */
  if (phone) {
    await p.goto(`${BASE}/admin/clients/L11/planner/PO3`, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
    ok(rel(p) === '/clients/L11/planner/PO3' && await p.locator('.ps-page').count() === 1 && await p.locator('.v-sheet').count() === 0, 'on a phone the editor is its own screen at its own path');
  } else {
    await p.locator('.pb-card', { hasText: 'Nov 30 post' }).first().locator('.v-stretch').click().catch(() => {}); await p.waitForTimeout(700); // PO3, wherever the drag left it
    ok(await p.locator('.v-sheet--side').count() === 1, 'on a computer the editor is the side sheet');
  }
  const ed = p.locator(phone ? '.ps-page' : '.v-sheet');
  ok(await ed.getByRole('radio', { name: 'Post', exact: true }).count() === 1 && await ed.getByRole('radio', { name: 'Reel', exact: true }).count() === 1 && await ed.getByRole('radio', { name: 'Ad', exact: true }).count() === 1, 'Post, Reel and Ad at the top');
  ok(/\d+ \/ 2200/.test(await ed.innerText()), 'the caption counter reads n / 2200');
  const note = ed.locator('.ps-note.is-new');
  ok(await note.count() === 1 && /asked for a change|asked: /.test(await note.innerText()), 'the client\'s change request is the amber card at the top');
  S.writes.length = 0;
  await ed.locator('.ps-sets .v-chip', { hasText: 'Detailing' }).click().catch(() => {}); await p.waitForTimeout(2600);
  const tags = S.writes.filter(w => w.method === 'PATCH' && /posts/.test(w.url) && typeof w.body?.set?.hashtags === 'string');
  ok(tags.length === 1 && /#detailing/.test(tags[0].body.set.hashtags) && /#ceramiccoating/.test(tags[0].body.set.hashtags), `a hashtag set chip appends its tags, saved in one PATCH (${JSON.stringify(tags.map(t => t.body.set.hashtags))})`);
  await ed.locator('.ps-preview').click().catch(() => {}); await p.waitForTimeout(400);
  ok(S.opened.some(u => u === '/planner/plnrTESTtoken0123456789abcdEF'), `Preview as the client opens their own planner (${S.opened.join(', ')})`);
  ok(!S.writes.some(w => /planner/.test(w.url)), 'nothing here writes to the client\'s door');
  ok(S.errors.length === 0, `no page errors (${S.errors.join('; ').slice(0, 120)})`);
  await S.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `\nAll ${passes} planner board checks pass in the browser.`);
process.exit(fails ? 1 : 0);
