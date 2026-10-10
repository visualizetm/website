#!/usr/bin/env node
/* The CRM side of the client portal (src/lib/portal.js): the link, the patches, the message, the rows and the status.   node scripts/portal-crm-test.mjs */
import * as P from '../src/lib/portal.js';
import { PORTAL_MODULES } from '../src/shared/portalModules.js';
let bad = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const lead = { _id: 'x', business: 'Sharpless Detailing', askFor: 'Dan the owner', portal: { token: 'abcdefghijklmnopqrstuvwx', views: 3, lastViewedAt: '2026-10-01T00:00:00.000Z', pin: 'hash', template: 'brand', modules: { contact: 'off' }, documents: [{ id: 'd1', label: 'A', url: 'https://a.example', kind: 'pdf' }] } };
ok(P.portalUrl(lead) === 'https://visualizestudio.org/c/abcdefghijklmnopqrstuvwx' && P.portalUrl({}) === '', 'the link is the base plus the token, empty without one');
ok(JSON.stringify(P.generatePortalPatch(lead)) === '{"portal":{"regenerate":false}}' && JSON.stringify(P.generatePortalPatch(lead, true)) === '{"portal":{"regenerate":true}}', 'generate and regenerate send only the flag');
ok(P.portalSentPatch(lead, 0).portal.sentAt === '1970-01-01T00:00:00.000Z', 'mark sent stamps sentAt');
ok(JSON.stringify(P.modulePatch('contact', 'on')) === '{"portal":{"modules":{"contact":"on"}}}' && JSON.stringify(P.templatePatch('website')) === '{"portal":{"template":"website"}}', 'a module and a template patch carry one key');
ok(P.pinPatch('1234').portal.pin === '1234' && P.pinPatch('12').portal.pin === '' && P.pinPatch('').portal.pin === '', 'the PIN patch sends four digits or clears');
ok(P.portalMessage(lead).startsWith('Hey Dan!') && P.portalMessage(lead).endsWith(P.portalUrl(lead)) && !/\bwe\b/i.test(P.portalMessage(lead)), 'the message greets by first name, ends with the link, says I never we');
const rows = P.moduleRows(lead);
ok(rows.length === PORTAL_MODULES.length - 1 && !rows.some(r => r.id === 'home') && rows.find(r => r.id === 'contact').state === 'off' && rows.find(r => r.id === 'book').state === 'auto', 'the rows are every module but home, with the stored or the default state');
const st = P.portalStatus(lead);
ok(st.on && st.views === 3 && st.pinned && st.template === 'brand' && st.documents === 1 && st.off === 1 && st.modules === rows.length, `the status line reads the link, views, PIN, template, documents and the cards off (${JSON.stringify(st)})`);
ok(!P.portalStatus({}).on && P.portalStatus({}).off === 0, 'no portal: off, nothing off');
const d = P.newDocument(' Brand guide ', 'https://x.example/g', 'weird', 0);
ok(d.label === 'Brand guide' && d.kind === 'link' && d.addedAt === '1970-01-01T00:00:00.000Z' && d.id.startsWith('d'), 'a new document trims the label, defaults an unknown kind to link and stamps addedAt');
console.log(bad ? `\n${bad} failed.` : '\nAll checks pass.'); process.exit(bad ? 1 : 0);
