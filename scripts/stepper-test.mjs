/* The call stepper in a browser (prompt 2 of 3, milestone 1): at 390 and 1280 against the mock routes.
 *   The record: Run the script opens the sheet at Did they answer?; Yes, the owner writes afterCall.answered and the step; every
 *   Next writes what the step collected; Money logs a counted objection; Two times offers the default times when Calendly has no
 *   slots; Book it is the booking write (callStatus booked, the meeting, the answers), drafts the invite (POST email/send, a custom
 *   override, never a stamp) and the night before text (POST email/drafts, channel text) and adds Build the concept due the night
 *   before at 8 PM New York. No answer logs the outcome with a callback later today and drafts the voicemail text. A lead with no
 *   phone starts at step 2. The Room's Open the stepper and the Queue's Dial and open the script open the same sheet.
 * Run: AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/stepper-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';
import { conceptTaskDue } from '../src/shared/callScript.js';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const WIDTHS = (process.env.AUDIT_WIDTHS || '390,1280').split(',').map(Number);
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

async function open(w, path, seed = null) {
  const phone = w < 768;
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block', timezoneId: 'America/New_York' }); // Rob's zone: the slots and the meeting agree, like his phone
  const page = await ctx.newPage();
  await page.addInitScript((s) => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); if (s) localStorage.setItem('vz_call_session', JSON.stringify(s)); else localStorage.removeItem('vz_call_session'); } catch { /* fine */ } }, seed);
  await mockRoutes(page, { session: true });
  const writes = []; const posts = [];
  await page.route('**/api/admin/call-leads**', (r) => { const req = r.request(); if (req.method() === 'GET') return r.fallback(); let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch { /* not JSON */ } writes.push({ method: req.method(), body }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, item: {} }) }); });
  await page.route('**/api/admin/email/send**', (r) => { let body = null; try { body = JSON.parse(r.request().postData() || 'null'); } catch { /* */ } posts.push({ url: 'send', body }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, draft: true, logId: 'EL-new' }) }); });
  await page.route('**/api/admin/email/drafts**', (r) => { if (r.request().method() === 'GET') return r.fallback(); let body = null; try { body = JSON.parse(r.request().postData() || 'null'); } catch { /* */ } posts.push({ url: 'drafts', body }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, logId: 'EL-text' }) }); });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  return { ctx, page, writes, posts };
}
const sheetTitle = async (page) => (await page.locator('.cs-sheet').locator('h2, [class*="title"]').first().textContent().catch(() => '')).trim();
const next = async (page) => { await page.locator('.cs-next').click(); await page.waitForTimeout(250); };
const lastAfter = (writes) => [...writes].reverse().find(w => w.body?.set?.afterCall)?.body.set.afterCall;

for (const w of WIDTHS) {
  console.log(`\n[${w}px]`);
  /* The record: book it. */
  {
    const { ctx, page, writes, posts } = await open(w, '/admin/leads/L3');
    await page.waitForSelector('.rc-primary:visible', { timeout: 10000 });
    ok((await page.locator('.rc-primary:visible').first().textContent()).includes('Run the script'), 'the record\'s primary is Run the script');
    await page.locator('.rc-primary:visible').first().click();
    await page.waitForSelector('.cs-sheet', { timeout: 5000 });
    ok((await sheetTitle(page)).includes('Did they answer?'), `opens at Did they answer? (${await sheetTitle(page)})`);
    ok(await page.locator('.cs-dial').count() === 1 && (await page.locator('.cs-dial').getAttribute('href') || '').startsWith('tel:'), 'the dial button is a tel: link');
    ok(await page.locator('.cs-prog .cs-seg').count() === 8, 'eight progress segments');
    await page.getByRole('button', { name: 'Yes, the owner' }).click(); await page.waitForTimeout(300);
    ok(lastAfter(writes)?.answered === 'owner' && lastAfter(writes)?.step === 1, `Yes, the owner writes afterCall.answered and step 1 (${JSON.stringify(lastAfter(writes))})`);
    ok((await sheetTitle(page)).includes('Who am I talking to?'), 'then Who am I talking to?');
    await page.getByRole('textbox', { name: 'Ask for' }).fill('Dana'); await next(page);
    ok(writes.at(-1)?.body?.set?.askFor === 'Dana' && lastAfter(writes)?.step === 2, 'Next writes askFor and step 2');
    ok((await sheetTitle(page)).includes('Say the line'), 'Say the line');
    ok((await page.locator('.cs-line').first().textContent()).trim() === 'Hi' && (await page.locator('.cs-line').nth(1).textContent()).trim() === 'Saw you', 'the intro and homework lines are the lead\'s own (the fixture\'s Hi and Saw you)');
    await page.getByRole('button', { name: 'Landed' }).click(); await next(page);
    ok(lastAfter(writes)?.homework === 'landed' && lastAfter(writes)?.answered === 'owner', 'Landed writes afterCall.homework and keeps answered');
    await page.getByRole('textbox', { name: 'What they said' }).fill('The site is from 2014'); 
    ok((await page.locator('.cs-sheet').textContent()).includes("So what I'm hearing is the site is from 2014"), 'the say it back line follows the words');
    await next(page);
    ok(lastAfter(writes)?.whatTheySaid === 'The site is from 2014', 'Next writes afterCall.whatTheySaid');
    await page.getByRole('textbox', { name: 'Their goal' }).fill('More jobs'); await next(page);
    ok(lastAfter(writes)?.goal === 'More jobs' && (await sheetTitle(page)).includes('Give the value'), 'Next writes afterCall.goal, then Give the value');
    await page.locator('.ob-card-btn', { hasText: 'Money' }).click(); await page.waitForTimeout(250);
    ok(lastAfter(writes)?.objection === 'money' && lastAfter(writes)?.objections?.money === 1, 'tapping Money logs the objection with a count');
    ok((await page.locator('.ob-line').textContent()).startsWith('Is $500 a lot right now?'), 'and shows the response');
    await next(page);
    ok((await sheetTitle(page)).includes('Two times'), 'Two times');
    await page.waitForSelector('.cs-sheet .v-chip', { timeout: 6000 });
    const chips = await page.locator('.cs-sheet .v-chip').allTextContents();
    ok(chips.length >= 3 && chips.some(c => c.includes('Pick a time')), `two slot chips and Pick a time (${chips.join(' | ')})`);
    ok((await page.locator('.cs-sheet').textContent()).includes('Default times'), 'the default times are named when Calendly has no slots');
    await page.locator('.cs-sheet .v-chip').first().click();
    await page.getByRole('button', { name: 'No, just them' }).click(); await next(page);
    ok(lastAfter(writes)?.partner === 'no' && (await sheetTitle(page)).includes('Lock it in'), 'the partner check writes afterCall.partner, then Lock it in');
    ok((await page.getByRole('textbox', { name: 'Email for the invite' }).inputValue()) === 'owner3@example.com', 'the email is prefilled from the lead');
    const before = writes.length;
    await page.locator('.cs-book').click();
    await page.waitForTimeout(900);
    const booked = writes.slice(before).find(x => x.body?.set?.callStatus === 'booked')?.body.set;
    ok(!!booked && booked.meeting?.date && booked.meeting?.time && booked.stage === 'booked', `Book it is the booking write (${JSON.stringify(booked?.meeting)}, stage ${booked?.stage}, keys ${Object.keys(booked || {}).join(',')})`);
    ok(booked?.afterCall?.goal === 'More jobs' && booked?.afterCall?.partner === 'no' && booked?.afterCall?.email === 'owner3@example.com' && booked?.afterCall?.cell, 'the booking carries the answers');
    const inv = posts.find(p => p.url === 'send'); const txt = posts.find(p => p.url === 'drafts');
    ok(inv && inv.body.templateId === 'custom' && inv.body.override?.blocks?.length >= 3 && !inv.body.approvedAt && !inv.body.send, 'the invite is drafted through email/send with no stamp');
    ok(txt && txt.body.channel === 'text' && /tomorrow/.test(txt.body.body), 'the night before text is drafted as a text');
    const task = writes.slice(before).find(x => x.body?.set?.checklists)?.body.set.checklists;
    const t = (task || []).flatMap(l => l.items).find(i => i.text === 'Build the concept');
    ok(!!t && t.due === conceptTaskDue(booked?.meeting), `Build the concept is due the night before at 8 PM New York (${t?.due})`);
    ok(await page.locator('.cs-sheet').count() === 0, 'the sheet closes after the booking');
    await ctx.close();
  }
  /* The record: no answer. */
  {
    const { ctx, page, writes, posts } = await open(w, '/admin/leads/L0');
    await page.waitForSelector('.rc-primary:visible', { timeout: 10000 });
    await page.locator('.rc-primary:visible').first().click();
    await page.waitForSelector('.cs-sheet', { timeout: 5000 });
    await page.getByRole('button', { name: 'No answer', exact: true }).click();
    ok(await page.locator('.cs-noanswer').count() === 1 && (await page.locator('.cs-vm').textContent()).length > 40, 'No answer shows the voicemail line and the log button');
    await page.locator('.cs-noanswer').click(); await page.waitForTimeout(700);
    const na = writes.find(x => x.body?.set?.callStatus === 'no-answer')?.body.set;
    ok(!!na && na.callbackAt && new Date(na.callbackAt).getTime() > Date.now(), `no answer logs the outcome with a callback later (${na?.callbackAt})`);
    const vm = posts.find(p => p.url === 'drafts');
    ok(vm && vm.body.channel === 'text' && /Rob from Visualize/.test(vm.body.body), 'the voicemail text is drafted');
    ok(await page.locator('.cs-sheet').count() === 0, 'the sheet closes');
    await ctx.close();
  }
  /* A lead with no phone starts at step 2. */
  {
    const { ctx, page } = await open(w, '/admin/leads/L17');
    await page.waitForSelector('.rc-primary:visible', { timeout: 10000 });
    await page.locator('.rc-primary:visible').first().click();
    await page.waitForSelector('.cs-sheet', { timeout: 5000 });
    ok((await sheetTitle(page)).includes('Who am I talking to?') && (await page.locator('.cs-pos').textContent()).startsWith('2 of 8'), 'no phone: the stepper starts at step 2');
    await ctx.close();
  }

  /* The concept call (milestone 2): Start the concept call on a booked lead, Clarify to The ask, the beliefs lock, the pillars in order, Asked. */
  {
    const { ctx, page, writes, posts } = await open(w, '/admin/deals/L8');
    await page.waitForSelector('.rc-closer:visible', { timeout: 10000 });
    await page.locator('.rc-closer:visible').first().click();
    await page.waitForSelector('.cl-sheet', { timeout: 5000 });
    ok((await sheetTitle(page)).includes('Clarify'), 'Start the concept call opens at Clarify');
    await page.getByRole('textbox', { name: 'Why they said yes' }).fill('Saw the concepts');
    await page.getByRole('textbox', { name: 'The goal' }).fill('More jobs');
    await next(page);
    const closerOf = () => [...writes].reverse().find(x => x.body?.set?.afterCall?.closer)?.body.set.afterCall.closer;
    ok(closerOf()?.why === 'Saw the concepts' && closerOf()?.goal === 'More jobs' && closerOf()?.step === 2, `Next writes afterCall.closer.why, goal and the step (${JSON.stringify(closerOf())})`);
    ok((await page.locator('.cl-sheet').textContent()).includes("So what I'm hearing is saw the concepts, and you want more jobs"), 'Label it says it back from their words');
    await page.getByRole('button', { name: 'They said yes' }).click(); await next(page);
    ok(closerOf()?.label === 'yes' && (await sheetTitle(page)).includes('Pain cycle'), 'They said yes writes closer.label, then the pain cycle');
    ok((await page.locator('.cl-nudge').textContent()).includes('0 of 2') && await page.locator('.cl-notonyou').count() === 0, 'the nudge asks for two rows and holds the not on you line');
    await page.getByRole('textbox', { name: 'Tried 1' }).fill('Fiverr'); await page.getByRole('textbox', { name: 'How long' }).first().fill('A month');
    await page.getByRole('textbox', { name: 'Tried 2' }).fill('A cousin'); await page.getByRole('textbox', { name: 'How it went' }).nth(1).fill('Never finished');
    ok(await page.locator('.cl-notonyou').count() === 1, 'two rows filled: the not on you line shows');
    await page.locator('.cl-addrow').click();
    ok(await page.getByRole('textbox', { name: 'Tried 3' }).count() === 1, 'Add a row adds a row');
    await next(page);
    ok(closerOf()?.pain?.length === 2 && closerOf()?.pain[0].tried === 'Fiverr' && (await sheetTitle(page)).includes('Three pillars'), 'Next writes the pain rows, then the pillars');
    const pillarBtns = page.locator('.cl-pillar .ob-card-btn');
    ok(await pillarBtns.nth(1).isDisabled() && await pillarBtns.nth(2).isDisabled() && !(await pillarBtns.nth(0).isDisabled()), 'the pillars go in order: only Look is tappable first');
    ok((await page.locator('.cl-clock').textContent()) === '3:00', 'the pitch clock waits at 3:00');
    await pillarBtns.nth(0).click(); await page.waitForTimeout(1300);
    ok(!!closerOf()?.pillars?.look, 'tapping Look stamps closer.pillars.look');
    ok(/^2:5\d$/.test(await page.locator('.cl-clock').textContent()), `the clock runs once the first pillar is told (${await page.locator('.cl-clock').textContent()})`);
    await next(page);
    ok((await sheetTitle(page)).includes('Three beliefs'), 'then the beliefs');
    await page.locator('.cl-belief--closer input').check(); await page.locator('.cl-belief--trust input').check();
    ok(await page.locator('.cs-next').isDisabled() && await page.locator('.cl-locked').count() === 1, 'two beliefs: the ask stays locked');
    await page.locator('.cl-belief--works input').check();
    ok(!(await page.locator('.cs-next').isDisabled()), 'three beliefs: the ask unlocks');
    await next(page);
    ok(closerOf()?.beliefs?.closer === true && closerOf()?.beliefs?.works === true && (await sheetTitle(page)).includes('The ask'), 'Next writes the beliefs, then The ask');
    await page.locator('.cl-asked').click(); await page.waitForTimeout(300);
    ok(closerOf()?.asks === 1, 'Asked bumps closer.asks');
    await page.locator('.cl-pushback').click();
    await page.waitForSelector('.ob-sheet', { timeout: 5000 });
    await page.locator('.ob-card-btn', { hasText: 'Stall' }).click(); await page.waitForTimeout(250);
    ok(lastAfter(writes)?.objection === 'stall' && lastAfter(writes)?.objections?.stall === 1, 'They pushed back: a card logs the objection with its count');
    await page.getByRole('button', { name: 'Handled, ask again' }).click(); await page.waitForTimeout(400);
    ok(closerOf()?.asks === 2, 'Handled, ask again bumps closer.asks');
    await page.waitForSelector('.cl-sheet', { timeout: 5000 });
    await page.locator('.cl-prices').click();
    await page.waitForSelector('.pp-sheet', { timeout: 5000 });
    ok((await page.locator('.pp-sentence').textContent()).includes("That's"), 'the price presenter opens with the gap sentence and a package');
    const rungs = await page.locator('.pp-rung-label').allTextContents();
    ok(rungs[0].startsWith('Build Plan') && rungs[1].startsWith('Launch Plan') && rungs.at(-1).startsWith('Brand review'), `the ladder reads highest first and ends on the brand review (${rungs.map(r => r.split(' ')[0]).join(',')})`);
    ok((await page.locator('.pp-sheet').textContent()).includes('I take two builds a month'), 'the start slot line');
    const before = posts.length;
    await page.locator('.pp-quote').click(); await page.waitForTimeout(700);
    const qsend = posts.slice(before).find(p => p.url === 'send');
    ok(qsend && qsend.body.templateId === 'custom' && !qsend.body.approvedAt && /quote/i.test(qsend.body.override?.subject || ''), 'Draft the quote email drafts through email/send with no stamp');
    const qw = [...writes].reverse().find(x => x.body?.set?.deal?.quote)?.body.set.deal.quote;
    ok(qw && qw.lines.length === 1 && qw.total > 0 && qw.deposit === Math.ceil(qw.total / 2), `the quote is saved on the deal (${qw?.total}, deposit ${qw?.deposit})`);
    await ctx.close();
  }
  /* The quote builder (milestone 4): /leads/:id/quote. */
  {
    const { ctx, page, writes, posts } = await open(w, '/admin/leads/L8/quote?pkg=brand-starter');
    await page.waitForSelector('.qb-lines', { timeout: 10000 });
    ok((await page.locator('.qb-line').count()) === 1 && (await page.locator('.qb-line[data-line="brand-starter"]').count()) === 1, 'the package from the link seeds the first line');
    await page.locator('.v-chip', { hasText: 'Business card design' }).click();
    ok((await page.locator('.qb-line').count()) === 2, 'a print item adds a line');
    await page.locator('.qb-line[data-line="card-design"] .qb-free input').check();
    ok((await page.locator('.qb-free-total').textContent()) === '$30' && (await page.locator('.qb-totals').textContent()).includes('The cards are on me'), 'Free counts the list price as given free and shows the script line');
    ok((await page.locator('.qb-big').first().textContent()) === '$350', 'the total leaves the free line out');
    await page.waitForTimeout(900);
    const q = [...writes].reverse().find(x => x.body?.set?.deal?.quote)?.body.set.deal.quote;
    ok(q && q.lines.length === 2 && q.givenFree === 30 && q.total === 350 && q.deposit === 175 && q.retainerPitch === true && q.lines.every(l => typeof l.listPrice === 'number'), `autosave writes deal.quote with its lines and totals (${JSON.stringify(q && { total: q.total, free: q.givenFree, deposit: q.deposit })})`);
    const before = writes.length;
    await page.locator('.qb-invoice').click(); await page.waitForTimeout(700);
    const dw = writes.slice(before).find(x => x.body?.set?.deal?.invoices)?.body.set.deal;
    ok(dw && dw.invoices.at(-1).amount === 175 && dw.invoices.at(-1).kind === 'deposit' && dw.invoices.at(-1).status === 'draft', 'Make the Stripe invoice adds the deposit line to the deal (the link is made on send)');
    ok(/\/email\/compose/.test(page.url()) && /template=invoice/.test(page.url()), `and opens Compose on the invoice template (${page.url().replace(BASE, '')})`);
    ok(posts.every(p => !p.body?.send && !p.body?.approvedAt), 'nothing on this page posts a send');
    await ctx.close();
  }

  /* Milestone 5: the Room's live line, the four buttons, the said box, the outcomes; the Queue's prep card; the Summary; the record's cards. */
  {
    const seed = { ids: ['L0', 'L3', 'L17'], idx: 0, stats: {}, logged: {}, startedAt: Date.now(), size: 3, mode: 'room' };
    const { ctx, page, writes } = await open(w, '/admin/calls/room/L0', seed);
    await page.waitForSelector('.cc-live-line', { timeout: 10000 });
    ok((await page.locator('.cc-live-line').textContent()).trim().length > 0, 'the Room shows the live script line');
    ok(await page.locator('.cc-four button').count() === 4 && (await page.locator('.cc-four').textContent()).includes('Objections') && (await page.locator('.cc-four').textContent()).includes('Two times'), 'four buttons: Objections, Say it back, Prices, Two times');
    await page.locator('.cc-open-sayback').click(); await page.waitForSelector('.cs-sheet', { timeout: 5000 });
    ok((await sheetTitle(page)).includes('What did they say?'), 'Say it back opens the stepper on What did they say?');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.locator('.cc-open-times').click(); await page.waitForSelector('.cs-sheet', { timeout: 5000 });
    ok((await sheetTitle(page)).includes('Two times'), 'Two times opens the stepper on Two times');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.locator('.cc-open-prices').click(); await page.waitForSelector('.pp-sheet', { timeout: 5000 });
    ok(await page.locator('.pp-ladder').count() === 1, 'Prices opens the presenter');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.locator('.cc-said textarea').fill('The site is old'); await page.locator('.cc-live-btn').focus(); await page.waitForTimeout(300);
    ok(lastAfter(writes)?.whatTheySaid === 'The site is old', 'the What they said box writes afterCall.whatTheySaid on blur');
    const big = await page.locator('.cc-outs .cc-out').allTextContents();
    ok(big.length === 3 && /Booked/.test(big[0]) && /Callback/.test(big[1]) && /No answer/.test(big[2]), `three large outcomes (${big.map(t => t.replace(/\d$/, '').trim()).join(', ')})`);
    const row2 = await page.locator('.cc-outbar-row2').textContent();
    ok(/Not interested/.test(row2) && /Skip/.test(row2), 'then Not interested and Skip');
    await page.locator('.cc-out--no-answer').click(); await page.waitForSelector('.cc-osheet', { timeout: 5000 });
    await page.locator('.cc-osheet .v-sheet-foot .v-btn').last().click(); await page.waitForTimeout(1400);
    ok(writes.some(x => x.body?.set?.callStatus === 'no-answer') && /\/calls\/room\/L3/.test(page.url()), `an outcome tap logs and moves to the next lead (${page.url().replace(BASE, '')})`);
    await ctx.close();
    /* A lead with no phone: the DM instead of the dial. */
    const r2 = await open(w, '/admin/calls/room/L17', { ...seed, idx: 2 });
    await r2.page.waitForSelector('.cc-dm', { timeout: 10000 });
    ok((await r2.page.locator('.cc-dm-text').textContent()).includes('Rob from Visualize') && await r2.page.locator('.cc-phone-btn').count() === 0, 'no phone: the DM script shows instead of Dial');
    await r2.page.waitForTimeout(600); await r2.page.locator('.cc-open-stepper').dispatchEvent('click'); await r2.page.waitForSelector('.cs-sheet', { timeout: 5000 });
    ok((await r2.page.locator('.cs-pos').textContent()).startsWith('2 of 8'), 'and the stepper starts at step 2');
    await r2.ctx.close();
    /* The Queue: the next lead's prep card on top; a done lead sinks. */
    const q = await open(w, '/admin/calls/queue', { ...seed, idx: 0, logged: { L0: 'no-answer' }, stats: { calls: 1, noAnswer: 1 }, mode: 'queue' });
    await q.page.waitForSelector('.cc-qprep', { timeout: 10000 });
    ok((await q.page.locator('.cc-qprep-biz').textContent()).includes('Lead Business 3'), 'the prep card names the next lead (the logged one is not next)');
    const prep = await q.page.locator('.cc-qprep .csh-grid').textContent();
    ok(/Google|Website|Best window|Instagram/.test(prep), `the prep card carries the facts (${prep.slice(0, 60)})`);
    const order = await q.page.locator('.cc-qcard').evaluateAll(els => els.map(e => e.classList.contains('is-done')));
    ok(order.length === 3 && order[0] === false && order[2] === true, 'done leads sink to the bottom with their outcome pill');
    ok(await q.page.locator('.cc-qcard.is-done .cc-qmark').count() === 1, 'the outcome pill on the done lead');
    await q.ctx.close();
    /* The Summary. */
    const sm = await open(w, '/admin/calls/summary', { ...seed, idx: 2, logged: { L0: 'booked', L3: 'callback', L17: 'no-answer' }, stats: { calls: 3, booked: 1, callbacks: 1, noAnswer: 1 }, mode: 'summary' });
    await sm.page.waitForSelector('.cc-askrate', { timeout: 10000 });
    const stats = await sm.page.locator('.cc-stat-l').allTextContents();
    ok(stats.includes('Dialed') && stats.includes('Answered') && stats.includes('Asked') && stats.includes('Booked'), `dialed, answered, asked, booked (${stats.join(',')})`);
    ok(/Ask rate/.test(await sm.page.locator('.cc-askrate').textContent()) || /No asks/.test(await sm.page.locator('.cc-askrate').textContent()), 'the ask rate line');
    ok((await sm.page.locator('.cc-booked-row').count()) === 1 && /Partner/.test(await sm.page.locator('.cc-booked-row').textContent()), 'the booked row carries the partner status');
    await sm.page.waitForTimeout(800);
    const fu = sm.posts.filter(p => p.url === 'drafts' && /No decision/.test(p.body?.reason || ''));
    ok(fu.length === 3 && fu.map(p => p.body.subject).join('|') === 'Follow up, day 1|Follow up, day 3|Follow up, day 7' && fu.every(p => p.body.channel === 'text'), `a no decision drafts the day 1, 3 and 7 texts (${fu.length})`);
    ok(await sm.page.locator('.cc-go-drafts').count() === 1 && await sm.page.locator('.cc-go-tasks').count() === 1, 'Drafted for you links to Drafts and Tasks');
    await sm.ctx.close();
  }
  /* The record's Call sheet and Prep cards; Edit all's discard warning; the two step form. */
  {
    const { ctx, page, writes } = await open(w, '/admin/leads/L0');
    await page.waitForSelector('[data-card="call-sheet"]:visible', { timeout: 10000 });
    ok(await page.locator('[data-card="call-sheet"]:visible').count() === 1 && await page.locator('[data-card="prep"]:visible').count() === 1, 'the record shows the Call sheet and the Prep card');
    ok(await page.locator('.csh-quote:visible').count() === 1, 'and a Quote button');
    await page.locator('.rc-primary:visible').first().click(); await page.waitForSelector('.cs-sheet', { timeout: 5000 });
    await page.getByRole('button', { name: 'Yes, the owner' }).click(); await page.waitForTimeout(300);
    await page.locator('.cs-sheet .v-sheet-x').click(); await page.waitForTimeout(700);
    ok(await page.locator('.cs-sheet').count() === 0, 'the stepper\'s X leaves it (what was saved stays)');
    ok((await page.locator('[data-card="call-sheet"]:visible').textContent()).includes('Owner'), 'the Call sheet shows the saved answer after leaving the stepper');
    await page.locator('[aria-label="More actions"]:visible').first().click();
    await page.getByRole('menuitem', { name: 'Edit all' }).click();
    await page.waitForSelector('.lf', { timeout: 5000 });
    ok(await page.locator('.lf .lf-more-btn').count() === 1 && await page.getByRole('textbox', { name: 'Industry' }).count() === 0, 'the form opens on who and how to reach them; the rest is under More details');
    await page.locator('.lf-more-btn').click(); await page.waitForTimeout(300);
    ok(await page.getByRole('textbox', { name: 'Industry' }).count() === 1, 'More details opens the rest');
    const n0 = writes.length;
    await page.getByRole('textbox', { name: 'Contact name' }).fill('Dana R');
    await page.getByRole('textbox', { name: 'Email' }).focus(); await page.waitForTimeout(500);
    ok(writes.length > n0 && writes.at(-1).body?.set?.askFor === 'Dana R', 'a changed field saves on blur');
    await page.getByRole('textbox', { name: 'Contact name' }).fill('Dana Q');
    await page.locator('.v-sheet .v-sheet-x').last().click(); await page.waitForTimeout(500);
    ok(/Discard the changes\?/.test(await page.locator('body').textContent()) && await page.locator('.lf').count() === 1, 'closing with unsaved text warns before discarding (the form stays)');
    await ctx.close();
  }
  /* Deals: the Stalled chip. Leads: a bulk edit is one PATCH with an id array. */
  {
    const { ctx, page } = await open(w, '/admin/deals');
    await page.waitForSelector('.dl-stalled-chip', { timeout: 10000 });
    ok(/Stalled \(\d+\)/.test(await page.locator('.dl-stalled-chip').textContent()), 'the Stalled (n) chip');
    await ctx.close();
    if (w < 768) {
      const l = await open(w, '/admin/calls?section=leads');
      await l.page.waitForSelector('.ld-select', { timeout: 10000 });
      await l.page.locator('.ld-select').click(); await l.page.waitForTimeout(300);
      const boxes = l.page.locator('.sh-content .v-check input');
      ok(await boxes.count() >= 2, `select mode shows a checkbox per lead (${await boxes.count()})`);
      await boxes.nth(0).click({ force: true }); await boxes.nth(1).click({ force: true }); await l.page.waitForTimeout(300);
      await l.page.waitForSelector('.ld-bulk', { timeout: 5000 });
      await l.page.getByRole('button', { name: 'Priority' }).click();
      await l.page.getByRole('menuitem', { name: 'Hot' }).click(); await l.page.waitForTimeout(600);
      const bulk = l.writes.filter(x => Array.isArray(x.body?.ids));
      const perId = l.writes.filter(x => x.body?.id && x.body?.set?.priority);
      ok(bulk.length === 1 && bulk[0].body.ids.length === 2 && bulk[0].body.set.priority === 'hot' && perId.length === 0, `a bulk priority change is one PATCH with an id array (${bulk.length} bulk, ${l.writes.length} writes: ${JSON.stringify(l.writes.map(x => ({ id: x.body?.id, ids: x.body?.ids, set: Object.keys(x.body?.set || {}) })))})`);
      await l.ctx.close();
    }
  }
  /* The Room and the Queue. */
  {
    const seed = { ids: ['L0', 'L3'], idx: 0, stats: {}, logged: {}, startedAt: Date.now(), size: 2, mode: 'room' };
    const { ctx, page } = await open(w, '/admin/calls/room/L0', seed);
    await page.waitForSelector('.cc-open-stepper', { timeout: 10000 });
    await page.waitForTimeout(600); await page.locator('.cc-open-stepper').dispatchEvent('click');
    await page.waitForSelector('.cs-sheet', { timeout: 5000 });
    ok((await sheetTitle(page)).includes('Did they answer?'), 'the Room\'s live line opens the stepper');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.locator('.cc-open-obj').click();
    await page.waitForSelector('.ob-sheet', { timeout: 5000 });
    ok(await page.locator('.ob-sheet .ob-card').count() === 6, 'the Room\'s Objections opens the six cards');
    await ctx.close();
    if (w < 768) {
      const q = await open(w, '/admin/calls/queue', { ...seed, mode: 'queue' });
      await q.page.waitForSelector('.cc-resume', { timeout: 10000 });
      ok((await q.page.locator('.cc-resume').textContent()).includes('Dial and open the script'), 'the Queue footer reads Dial and open the script');
      await q.page.locator('.cc-resume').click();
      await q.page.waitForSelector('.cs-sheet', { timeout: 6000 });
      ok(/\/calls\/room\//.test(q.page.url()) && (await sheetTitle(q.page)).includes('Did they answer?'), 'it opens the room with the stepper up');
      await q.ctx.close();
    }
  }
}
await browser.close();
console.log(`\nstepper-test: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
