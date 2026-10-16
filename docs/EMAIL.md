# The email system

The CRM's own emails: an engine that renders and sends through Resend, one
Compose screen, twenty four templates, and the rules that draft or send on
their own. Nothing here needs Zapier; once RESEND_API_KEY is set the four
old hooks are retired (RUNBOOK, Emails).

Read with docs/ARCHITECTURE.md (where the pieces live), docs/RUNBOOK.md
(setup, the retirement steps, the scripts) and docs/COMPONENTS.md (the
screens and pieces). History is in docs/MOBILE-PROGRESS.md and
docs/MOBILE-DECISIONS.md under "Email system".

## The shape

- The server renders every email it sends. A request carries a template id, a record and, when the template edits allow it, Rob's subject, preheader and blocks; the server resolves the variables from the records, renders, and refuses on a missing value. No HTML from a request is ever sent.
- `api/_lib/email/` is the engine: `transport.js` (Resend through fetch, test mode without the key, one retry on a 5xx or a network error, never on a 4xx, thirty sends an hour), `render.js` (the blocks to HTML and plain text, the 600px table skeleton, the 90 KB cap), `vars.js` (the variables from the records), `templates.js` (the registry, a mirror of src/shared/emailTemplates.js), `settings.js` (the emails settings document), `send.js` (loadContext, composeEmail, sendComposed, sendLogged), `log.js` (the email_log collection), `stamps.js` (what a send ticks), `queue.js` (Send tomorrow), `failed.js` (a failed send's task and push), `drafts.js` (a draft for Rob, sendDraft), `invoiceNumber.js` (INV-0001 and up), `rules.js` (what goes out on its own).
- `api/_routes/email.js` is the one admin route, dispatched on `/api/admin/email/<action>`: status, preview, send, log, settings. `api/_routes/unsubscribe-public.js` is the opt out door, on the showcase function.
- The client: `src/pages/AdminCompose.jsx` (Compose, send and template modes), `src/components/email/` (EmailEditor, EmailPreview, EmailLogSheet, EmailSettingsPanel), `src/components/record/EmailsSection.jsx` (the record's Emails section), `src/lib/compose.js` (the pure helpers), `src/lib/emailSend.js` (the old four buttons' client mirror).

## Blocks

A template (and an edited email) is a subject, a preheader and a list of blocks. Every string may hold `{{variable}}` tokens, `**bold**` and `[label](url)`.

| Block | Fields | Renders as |
|---|---|---|
| eyebrow | text | a small red label above the heading |
| heading | text | the headline, the red period added |
| text | text | a paragraph |
| button | label, url, style primary or secondary, optional | a red pill (or grey); `optional: true` drops the button quietly when its url is empty instead of refusing the send |
| lines | from, rows[] { label, sub, value } | labelled rows with a value on the right (`from: 'invoice.items'` draws the record's) |
| totals | from, rows[] { label, value, big } | a totals block, one row can be big (`from: 'invoice.totals'` or `'invoice.paidTotals'`) |
| list | from, title, items[] | red bullets (`from: 'package.includes'`, `'invoice.terms'`, `'client.items'`) |
| box | title, tone default or brand, blocks[] | an inner panel with a title holding more blocks |
| files | from: 'deliverables.groups', groups[] | file groups with a count |
| pay | from: 'invoice.pay' | the ways to pay the invoice: the card button with the invoice's own Stripe link, the portal for the other ways, or one button per method set in Settings |
| spacer | | 16px of air |

A `from` list draws what the record has and nothing when it is empty; a template that must not go out empty names the variable in its `needs`.

## Variables

Resolved once per record by `api/_lib/email/vars.js`; every value is a string (dates like "Oct 22, 2026" in New York, money like "$300") or a list a `from` block expands. The Insert field chips in Compose list them with where each one is set (`VAR_HOMES` in src/lib/compose.js).

- The person and the studio: firstName, fullName, business, email, rob, service (brand, web, combined, general), calendlyLink, startFormLink, siteLink, instagramLink.
- The links the record owns: portalLink, plannerLink, showcaseLink, reviewLink, contractLink, driveLink, conceptLink, conceptCount, conceptCover, meeting.time.
- The deal: package.name, package.price, package.includes, plan.count, plan.paid, plan.next, extrasLine, fees.extraDesign, fees.extraWeb.
- The invoice: invoice.number, invoice.kind, invoice.items, invoice.total, invoice.paidSoFar, invoice.dueNow, invoice.dueDate, invoice.leftAfter, invoice.leftLine, invoice.covers, invoice.totals, invoice.paidTotals, invoice.pay, invoice.stripeLink, invoice.otherPayLink, invoice.terms.
- The project: project.name, projects.count, revisions.used, revisions.max, rounds.max, revisions.roundLine, deliverables.groups, client.items, retainer.name, retainer.price, retainer.line, retainer.link.
- optOutUrl is added by the renderer on every marketing email and never typed.

A missing value is a refused send ("Fill in calendlyLink first.") and a greyed template in the picker with the reason; a preview still renders with the value blank so Rob sees the shape.

## The catalog

| Template | Group, class | When | Ticks | Needs | Automation default |
|---|---|---|---|---|---|
| Intro call | lead, marketing | After a yes on the phone or in the DMs | introSent | calendlyLink | off |
| Concepts in progress | lead, marketing | Concepts offered, no call booked yet (sending it stamps conceptsOffered) | | calendlyLink | off |
| Concepts ready | lead, marketing | A concept set exists and no meeting is booked (option: a peek at one direction) | | calendlyLink, conceptCount | off |
| Booking nudge | lead, marketing | Three days after an intro or concepts email with nothing booked, once a month at most | | calendlyLink | draft |
| Missed call | lead, marketing | The meeting passed and Rob logged a no show (the Meeting section's No show) | | calendlyLink | draft |
| Nurture check in | lead, marketing | A nurture lead resurfaces on its date | | calendlyLink | draft |
| Onboarding | deal, transactional | After the call, once they are in (a variant per service) | onboardingSent | startFormLink, package.name | off |
| Form nudge | deal, transactional | Three days after onboarding with no form back | | startFormLink | draft |
| Contract | deal, transactional | The form is in and the contract is ready to sign | contractSent | contractLink | off |
| Contract nudge | deal, transactional | Three days after the contract with no I agree | | contractLink | draft |
| Invoice | deal, transactional | A deposit, a plan payment, a final or a retainer month (the number is given on the first real send) | invoiceSent, the line sent | invoice.number, invoice.dueNow, invoice.dueDate | off |
| Invoice reminder | deal, transactional | Three days before an invoice is due | | the same | draft |
| Invoice past due | deal, transactional | The day after the due date, once | | the same | draft |
| Payment received | deal, transactional | A payment landed (a variant per kind: deposit, plan, final, general) | | invoice.paidSoFar, invoice.total | draft |
| Kickoff | client, transactional | The deposit landed and the project starts (the client's open items, an optional portal button) | | | off |
| Needs you | client, transactional | Something on the list is waiting on the client | | client.items, portalLink | off |
| Review ready | project, transactional | The first designs are ready to look at | | | off |
| Revision ready | project, transactional | A round of changes is back (the round line from the house rules) | | revisions.used, revisions.max | off |
| Delivery | project, transactional | Paid in full and the Drive folder is shared (the gate: paid in full, the Drive link, the Viewer box ticked) | delivery.emailSent, pitchSent, driveShared, deliveredAt, the two follow up tasks | driveLink, deliverables.groups | off |
| Plan complete | project, transactional | The last plan payment landed | | driveLink | draft |
| Retainer follow up | client, transactional | Three days after delivery, once (the one retainer to offer, its link from Settings) | | retainer.name, retainer.price, retainer.link | draft |
| Review request | client, transactional | Three days after the files are released (the review link is minted on the first send) | | reviewLink | draft |
| Retainer month ready | client, transactional | A retainer month's posts are ready in the planner | | plannerLink | off |
| Custom | any, transactional | Anything else, in Rob's words | | | off |

Every template's default lives in src/shared/emailTemplates.js (mirrored in api/_lib/email/templates.js below `TEMPLATE_GROUPS`). Rob's edits live in settings.emails.templates[id] (subject, preheader, blocks or a variant's blocks, options, auto); Reset to default deletes the override.

## The rules

`EMAIL_RULES` in src/shared/taskRules.js (mirrored in api/_lib/taskRules.js) says when each automatic email fits; `api/_lib/email/rules.js` runs them once a day from the reminders cron (13:00 UTC, 9am Eastern), over every live lead that is not Declined, Lost or Recently Deleted, and for a project rule over each live project (plus the deal while the record is still a deal).

| Rule | Template | Fires when | Cooldown |
|---|---|---|---|
| booking_nudge | Booking nudge | a lead, triage or booked record with nothing booked, three days after its newest intro or concepts email | 30 days |
| missed_call | Missed call | a no show was logged and no later meeting is set | 30 days |
| nurture_checkin | Nurture check in | a nurture record whose until date has come | 90 days |
| form_nudge | Form nudge | booked or deal, onboarding sent three days ago, no form | 7 days |
| contract_nudge | Contract nudge | booked or deal, contract sent three days ago, no I agree | 7 days |
| invoice_reminder | Invoice reminder | a sent line due in exactly three days | 7 days per line |
| invoice_past_due | Invoice past due | a sent line past its day | once per line |
| plan_invoice | Invoice | a plan month's draft line whose day has come (off until Rob turns the Invoice template on) | once per line |
| retainer_followup | Retainer follow up | the delivery email went three days ago, no active retainer | once |
| review_request | Review request | the files were released three days ago, no ask logged | once |
| plan_complete | Plan complete | every plan month is paid | once |

What a rule does is the template's Automation setting (Settings, Emails, a template's sheet; its default until Rob sets it):

- Off: nothing.
- Draft for me: the email is rendered and logged as a draft, auto true, with one task on the record's Emails checklist ("Email ready: Form nudge for Mike's Tacos. Three days with no form"); the run ends with one push, "N emails ready to send", to the Tasks screen. A draft's task carries the entry (`emailId`), so the Next up row's one control is Send and its menu has Edit email; the sent email sheet has Send now and Edit. A lead's drafted or failed email is its next step until it is sent or ticked (src/lib/nextAction.js); a client's follows the task rule like any task.
- Send for me: sent through the same pipeline a tap uses. A marketing email never goes to an opt out; a missing address or value makes a draft instead; a standing draft for the key is sent through sendDraft (one entry, its task ticked); the hour's rate guard ends the run; at most twenty go out per run and the rest are drafted. One push says "N emails went out for you".

The cooldown counts from the newest real send of the key to the record (the template, or the template and the invoice); a test to Rob and a failed send do not count. Every automatic email is logged with auto true, so Recent sends and the record's Emails section say so.

## Sending a draft

`POST /api/admin/email/log { id, send: true }` (and the rules' Send for me) goes through `sendDraft`: the email renders again from the record as it stands, so an invoice draft takes its number and its Stripe link with the send, never with the draft; the outcome lands on the draft's own entry (reuseLogId) and the task is ticked. A draft whose record still lacks a value is refused with the live list and stands. The ten minute duplicate guard holds across the door (409, then `confirmDuplicate: true`).

## Adding a template

1. Add it to `EMAIL_TEMPLATES` in src/shared/emailTemplates.js: id, name, group (lead, deal, client, project, any), class (marketing or transactional), when, the checkpoint it ticks and its stamp (api/_lib/email.js EMAIL_CHECKPOINT and api/_lib/email/stamps.js), autoDefault, needs, subject, preheader, blocks (or variants by service or by invoice kind), options.
2. Regenerate the mirror: `{ head -n 3 api/_lib/email/templates.js; sed -n '/^export const TEMPLATE_GROUPS/,$p' src/shared/emailTemplates.js; } > api/_lib/email/templates.js` (the test asserts they match).
3. Give it a rule in `EMAIL_RULES` when it should go out on its own, and a suggestion in `suggestEmail` when Compose should offer it.
4. Add a preview case in scripts/email-preview.mjs and run `npm run email:preview`; every case must render whole.
5. Add its checks to scripts/email-lib.mjs and a cut to scripts/email-guard-proof.mjs for every guard it adds; run both.

## Previews

`npm run email:preview` renders every template on a fixture record (Mike's Tacos: the deposit, the final, plan month 3 of 6, a retainer month, a brand and a web delivery, the last revision round) to docs/email-previews/<id>.html (a variant as <id>--<variant>.html), writes overview.html and its montage overview.png at 600 and 375 wide, and fails on an unfilled {{variable}}, a value the fixture lacks, "undefined", "null", the word AI or an em dash. scripts/email-test.mjs runs the same lint over the same fixtures (guard preview-lint).
