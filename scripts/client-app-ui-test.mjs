#!/usr/bin/env node
/* The client app in a browser (client app job, milestone 4), at 390 and 1280, against the audit fixtures' mocked doors
 * (scripts/audit-fixtures.mjs: the code door, the portal and the planner, the session a vz_client cookie naming a link).
 *
 *   the skeleton while the door answers, the error with Retry, Sign in by phone or email (the identifier kept on the device,
 *   never the code), a wrong code said in the field, the panel (the portal's cards), Settings and Sign out (the next sign in
 *   asks only for the four digits), Set your code (a weak one refused, two that differ refused, the number pad and the
 *   password manager hints), the Add to Home Screen card once, a setup link on a device already signed in going straight
 *   in, a locked link's minutes, an expired link, a planner only client landing on the planner, a 401 from a data door
 *   sending the device back to Sign in, the Forgot it line as an sms: link that sends nothing, the iPhone in Safari line
 *   in place of the pings switch, and an old /c/ link landing in the app.
 *
 *   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/client-app-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, appSignIn, PORTAL_TOKEN, APP_PLANNER_TOKEN, APP_SET_TOKEN, APP_LOCK_TOKEN, APP_CODE, APP_IDENTIFIER } from './audit-fixtures.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
let passes = 0; let fails = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`ok   ${m}`); } else { fails++; console.log(`FAIL ${m}`); } };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

async function fresh(width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 500, serviceWorkers: 'block', userAgent: opts.ua });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`  page error: ${e}`));
  if (opts.noPush) await page.addInitScript(() => { try { delete window.PushManager; } catch { /* fine */ } });
  await mockRoutes(page, { session: !!opts.admin });
  await appSignIn(page, opts.client || '', BASE);
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(`${new URL(r.url()).pathname} ${r.postData() || ''}`); });
  return { ctx, page, posts };
}
const go = (page, p) => page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
const until = (page, sel, t = 6000) => page.waitForSelector(sel, { timeout: t }).then(() => true).catch(() => false);
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k).catch(() => null);

for (const width of [390, 1280]) {
  console.log(`\n${width}px`);

  /* The skeleton while the door answers, then the error with Retry. */
  {
    const { ctx, page } = await fresh(width);
    let hold = true;
    await page.route('**/api/app/me', async (r) => { if (hold) return; return r.fallback(); }, { times: 1 });
    await go(page, '/app');
    ok(await until(page, '.ca-door .v-skel', 4000), 'the door shows its skeleton while it asks who this is');
    hold = false;
    await page.unroute('**/api/app/me').catch(() => {});
    await page.route('**/api/app/me', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server error"}' }), { times: 1 });
    await go(page, '/app');
    ok(await until(page, 'text=That did not load.'), 'a failed read says so, with Try again');
    await page.getByRole('button', { name: 'Try again' }).click().catch(() => {});
    ok(await until(page, '.ca-door-title:has-text("Your panel.")'), 'Try again reads again and lands on Sign in');
    await ctx.close();
  }

  /* Sign in by phone or email, the panel, Settings, Sign out, and the next sign in with only the four digits. */
  {
    const { ctx, page, posts } = await fresh(width);
    await go(page, '/app');
    await until(page, '.ca-door');
    const code = page.getByLabel('Your code');
    ok(await code.getAttribute('inputmode') === 'numeric' && await code.getAttribute('autocomplete') === 'current-password' && await code.getAttribute('type') === 'password', 'the code field is the number pad, a password field a password manager can fill (current-password)');
    ok(await page.getByLabel('Phone or email').getAttribute('autocomplete') === 'username', 'the phone or email is the username a password manager pairs it with');
    const forgot = page.locator('.ca-door-link');
    ok(/^sms:5550100100\?&body=/.test(await forgot.getAttribute('href') || '') && /Forgot it\? Text me and I'll reset it\./.test(await forgot.innerText()), "Forgot it? Text me and I'll reset it. is an sms: link to Rob's number");
    await page.getByLabel('Phone or email').fill(APP_IDENTIFIER);
    await code.fill('7359');
    await page.getByRole('button', { name: 'Sign in' }).click();
    ok(await until(page, '.v-field-msg--error:has-text("did not match")') && await page.locator('.v-field-msg--error[role="alert"]').count() === 1, 'a wrong code is said in the field, in a live alert');
    await code.fill(APP_CODE);
    await page.getByRole('button', { name: 'Sign in' }).click();
    ok(await until(page, '.pt-cards') && /\/app$/.test(page.url()), 'the right code lands on the panel: the portal\'s cards');
    ok(await ls(page, 'vz_app_id') === APP_IDENTIFIER && !JSON.stringify(await page.evaluate(() => ({ ...localStorage }))).includes(APP_CODE), 'the phone or email is kept on the device, the code never is');
    await go(page, '/app');
    ok(await until(page, '.pt-cards'), 'a reload stays signed in');
    await page.locator('.pt-settings-link').click();
    ok(await until(page, '.ca-page') && /\/app\/settings$/.test(page.url()) && /Signed in as Damian/.test(await page.locator('.ca-who').innerText()), 'Settings opens from the panel and says who is signed in');
    const signOut = page.getByRole('button', { name: 'Sign out' });
    const last = await page.evaluate(() => { const els = [...document.querySelectorAll('.ca-page-body button, .ca-page-body a')]; return els[els.length - 1]?.textContent?.trim(); });
    ok(last === 'Sign out', 'Sign out is the last control in Settings, a text link at the bottom');
    await signOut.click();
    ok(await until(page, '.ca-door-title:has-text("Your panel.")') && /\/app$/.test(page.url()), 'Sign out lands on Sign in');
    ok(await page.getByLabel('Phone or email').count() === 0 && /Signing in as damian@/.test(await page.locator('.ca-door-help').first().innerText()), 'the next sign in asks only for the four digits');
    ok(posts.every(p => /^\/api\/app\/(signin|signout) /.test(p)), `nothing but the code door was posted to (${posts.length} posts)`);
    ok(!posts.some(p => /sms|email\/send|send-email/.test(p)), 'the Forgot it line sent nothing');
    await ctx.close();
  }

  /* Set your code from a setup link: weak, different, then good; the Home Screen card once; then straight in. */
  {
    const { ctx, page } = await fresh(width);
    await go(page, `/app/c/${APP_SET_TOKEN}`);
    await until(page, '.ca-door');
    const first = page.getByLabel('Four digits');
    ok(await first.getAttribute('autocomplete') === 'new-password' && await first.getAttribute('inputmode') === 'numeric', 'Set your code: the number pad, and new-password so a password manager offers to save it');
    await first.fill('1234');
    await page.getByRole('button', { name: 'Next' }).click();
    ok(await until(page, '.v-field-msg--error:has-text("Pick something harder to guess")'), 'a weak code is refused with one plain line');
    await first.fill('4831');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('The same four again').fill('4832');
    await page.getByRole('button', { name: 'Save my code' }).click();
    ok(await until(page, '.v-field-msg--error:has-text("did not match")') && await page.getByLabel('Four digits').count() === 1, 'two that differ start again from the first four');
    await page.getByLabel('Four digits').fill('4831');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('The same four again').fill('4831');
    await page.getByRole('button', { name: 'Save my code' }).click();
    ok(await until(page, 'text=Keep me on your Home Screen.'), 'once the code is set, the Add to Home Screen card shows');
    await page.getByRole('button', { name: 'Done' }).click();
    ok(await until(page, '.pt-cards') && await ls(page, 'vz_app_a2hs') === 'seen', 'Done lands on the panel and the card is gone for good on this device');
    await go(page, `/app/c/${PORTAL_TOKEN}`);
    ok(await until(page, '.pt-cards') && /\/app$/.test(page.url()), 'the same client\'s link on a signed in device goes straight in');
    await ctx.close();
  }

  /* A locked link, an expired link, a planner only client, and a 401 from a data door. */
  {
    const { ctx, page } = await fresh(width);
    await go(page, `/app/c/${APP_LOCK_TOKEN}`);
    ok(await until(page, '.v-field-msg--error:has-text("12 minutes")'), 'a locked code says how many minutes are left');
    await go(page, '/app/c/deadTOKENxxxxxxxxxxxxxxxx');
    ok(await until(page, 'text=This link expired.'), 'an expired link says so');
    await appSignIn(page, APP_PLANNER_TOKEN, BASE);
    await go(page, '/app');
    ok(await until(page, '.pl-needs') && /\/app\/planner$/.test(page.url()), 'a planner only client lands on the planner');
    await page.getByRole('button', { name: 'Alerts' }).click().catch(() => {});
    ok(await until(page, '.pl-alerts-settings'), 'the planner\'s Alerts sheet carries the Settings link');
    await appSignIn(page, '', BASE);
    await go(page, '/app/planner');
    ok(await until(page, '.ca-door-title:has-text("Your panel.")') && /\/app$/.test(page.url()), 'with no session the planner sends the device to Sign in');
    await ctx.close();
  }

  /* An iPhone in Safari: the one line instead of the pings switch. */
  {
    const { ctx, page } = await fresh(width, { client: PORTAL_TOKEN, noPush: true, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' });
    await go(page, '/app');
    await until(page, '.pt-cards');
    ok(await page.locator('.pt-card:has(#pt-push-h)').filter({ hasText: 'Add me to your Home Screen to get pings.' }).count() === 1 && await page.locator('.pt-switch').count() === 0, 'iPhone in Safari: the Notifications card is one line, Add me to your Home Screen to get pings, and no switch');
    await go(page, '/app/settings');
    ok(await until(page, 'text=Add me to your Home Screen to get pings.'), 'Settings says the same');
    await ctx.close();
  }

  /* Rob's side: the client's code on their portal sheet, Reset code behind a confirm, one write and nothing sent. */
  {
    const { ctx, page, posts } = await fresh(width, { admin: true });
    await go(page, '/admin/clients?open=L12');
    await page.locator('.rc-ws-card--portal .rc-ws-btn').first().click({ timeout: 8000 }).catch(() => {});
    ok(await until(page, '.ps-code-line') && /^Code: set /.test((await page.locator('.ps-code-line').innerText()).trim()), "the portal sheet says the client's code is set, and when");
    ok(await page.locator('.ps-pin-toggle').count() === 0 && await page.getByText('Ask for a PIN').count() === 0, 'the Set PIN control is gone');
    ok((await page.locator('.ps-url').innerText()).trim() === 'https://app.visualizeclients.com/c/prtlTESTtoken0123456789abcd' && await page.locator('.ps-open').getAttribute('href') === '/admin/preview/portal/L12', "the link Rob sends is the app's setup link, and Preview opens his read only preview");
    await page.locator('.ps-code-reset').click();
    ok(await until(page, '[role="dialog"] :text("Reset their code?")'), 'Reset code asks first, saying they set a new one from the link');
    await page.locator('.v-modal').getByRole('button', { name: 'Reset code' }).click().catch(() => {});
    ok(await until(page, '.ps-code-line:has-text("Code: not set yet")'), 'after the reset the line says not set yet');
    const resets = posts.filter(p => p.startsWith('/api/admin/client-app '));
    ok(resets.length === 1 && /"action":"reset-code"/.test(resets[0]) && /"id":"L12"/.test(resets[0]), `one reset-code write (${resets.length})`);
    ok(!posts.some(p => /email|send|sms|caller/.test(p)), `nothing was sent (${posts.map(p => p.split(' ')[0]).join(', ')})`);
    await ctx.close();
  }

  /* Rob's read only previews on the admin host: the same screens, no write control, nothing posted. */
  {
    const { ctx, page, posts } = await fresh(width);
    await go(page, '/admin/preview/portal/L12');
    ok(await until(page, '.pt-cards') && /Preview as the client/.test(await page.locator('.ca-preview-note').innerText()), "the portal preview draws the client's cards under the preview line");
    ok(await page.locator('[data-preview-card="approvals"]').count() === 1 && await page.getByRole('button', { name: 'Approve' }).count() === 0 && await page.locator('.pt-switch').count() === 0 && await page.locator('.pt-settings-link').count() === 0, 'the portal preview has no write control: approvals, reorder, a site change and pings show their title and one line');
    await go(page, '/admin/preview/planner/L11');
    ok(await until(page, '.pl-needs') && await page.getByRole('button', { name: 'Alerts' }).count() === 0, 'the planner preview draws the month, with no bell');
    await page.locator('.pl-review-now').click().catch(() => {});
    ok(await until(page, '.pl-review') && await page.locator('.pl-actionbar').count() === 0, 'Review mode in the preview has no approve or change bar');
    await go(page, '/admin/preview/planner/L11?tab=ideas');
    ok(await until(page, '.pl-ideas, .pl-screen') && await page.locator('.pl-composer').count() === 0, 'Ideas in the preview has no composer');
    ok(posts.length === 0, `nothing was posted from either preview (${posts.join(' | ')})`);
    await ctx.close();
  }

  /* An old link on the public site lands in the app (vercel.json does it at the edge; this is the page's own fallback). */
  {
    const { ctx, page } = await fresh(width);
    await go(page, `/c/${PORTAL_TOKEN}`);
    ok(await until(page, '.ca-door') && page.url().endsWith(`/app/c/${PORTAL_TOKEN}`), 'an old /c/ link lands on the app\'s door for that link');
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
