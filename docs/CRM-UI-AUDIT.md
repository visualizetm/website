# Visualize CRM UI audit (repo 1a6b0b9, Oct 30 2026)

Read only. Line numbers are from the repo at that commit. Sizes: S is under an hour, M is half a day, L is a day or more. Pages run best wins first.

## Every place an email or message goes out

| Path | Who gets it | Confirm first? |
|---|---|---|
| Compose Send and Send tomorrow 9am, AdminCompose.jsx:162 and 309 | Client | Only the first send of that template to that record. After that, one tap. A 409 catches a repeat within minutes |
| Tasks row Send icon and menu Send email, AdminTasksHome.jsx:115 and 299 | Client | No confirm and no preview. Only the duplicate 409 |
| Email log sheet Send now (draft or queued), EmailLogSheet.jsx:56 | Client | No confirm, but the email is open on screen |
| Zapier fallback modal, SendEmailModal.jsx:38 | Client | Yes, the modal is the confirm. Only shows when Resend is not connected |
| Email rules in Send for me mode, api/_lib/email/rules.js | Client | None. Up to 20 per daily run. Switching a template to Send for me has no confirm (EmailSettingsPanel.jsx:141). Defaults are Off or Draft |
| Concepts editor Send, AdminConceptsEditor.jsx:319 | Makes the client link live, no email | No confirm |
| Reviews and Portal Mark as sent, AdminReviews.jsx:83, PortalSheet.jsx:151 | Nothing is sent. Copy link, then a manual stamp | No |
| Orders and Submissions email buttons, AdminOrders.jsx:176, AdminSubmissions.jsx:78 | mailto, Rob sends from the mail app | Not applicable |
| Settings tests, AdminSettings.jsx:202, EmailSettingsPanel.jsx:69, push test settings.js:184 | Rob | No, test only |
| Submission alert email, api/submissions.js:180 | Rob | Automatic, Settings toggle |
| Server pushes (portal, reviews, concepts answers, planner ideas, lead import, reminders, daily cron, email rules) | Rob's devices | Automatic, Settings toggles |

## Email safety (cuts across pages)

1. **Tasks: one tap sends a client email with no preview** (S). AdminTasksHome.jsx:115 wires the row's primary icon straight to onSendEmail, and :299 to :305 posts send: true. On a phone this icon sits on a swipeable card, so a stray tap emails a client. Fix: open a preview sheet (EmailPreview with the subject, recipient, Send and Edit), or at least a confirm that names the recipient and subject.
2. **Compose only confirms the first time** (M). AdminCompose.jsx:162 to 167 skips the confirm when the log already has a send of that template. A second invoice email goes out on one tap. Fix: queue every send 10 seconds out (sendAt is already supported) and show a toast with Undo that cancels through the log endpoint.
3. **Send for me switches on silently** (S). EmailSettingsPanel.jsx:141 saves the SegmentedControl on change. Fix: confirm with "This sends to clients with no review, up to 20 a day."
4. **Concepts Send goes live with no confirm and no follow up** (S). AdminConceptsEditor.jsx:319 to 326 just sets status sent. Fix: confirm, then offer "Email it" (Compose on concepts_ready) and "Text it" (an sms: link with a body).
5. **Compose can only schedule for tomorrow 9am** (S). AdminCompose.jsx:310 has a single menu item. Fix: a small sheet with chips (Tonight 6pm, Tomorrow 9am, Monday 9am) plus a date and time.

## Home (Analytics)

6. **The cron alarm opens the Settings root** (S). AdminAnalytics.jsx:142 calls shell.go('settings'). Fix: open /settings on the Notifications tab, as Settings itself does (AdminSettings.jsx:527).
7. **KPI taps land on the wrong screen** (S). Outstanding (:103) and MRR (:107) open the Clients dashboard, and Income (:102) opens Projects. Fix: open a filtered list: unpaid invoices for Outstanding, Clients filtered to retainers for MRR.
8. **Three dashboards, two named "Dashboard"** (M). nav.js:19, :21 and :30. The funnel is built twice (AdminAnalytics.jsx:72, AdminPipeline.jsx:66). Fix: rename them Pipeline overview and Client overview, or fold both into sections on Home.

## Clients dashboard (Overview)

9. **The Unpaid and Planner stats go to the wrong place** (S). AdminOverview.jsx:75 and :77. Fix: Unpaid opens the Invoices list, Planner opens /clients?filter=planner.
10. **No Invoices screen** (L). Unpaid invoices exist only as a card on Overview (AdminOverview.jsx:37 to 45). Fix: a Money or Invoices list across projects and deals: due date order, Past due chip, swipe for Mark paid, and a row action to draft the reminder through Compose.

## Tasks and Next up

11. **Two Next up lists with different rules** (M). NextUpHome.jsx:18 to 25 vs AdminTasksHome.jsx:2 to 14. Fix: one shared row component and one rule set.
12. **No way to add a plain task** (S). Quick add (AppShell.jsx:203 to 210) has no task. Fix: add New task, which opens TaskSheet with a client picker.
13. **The task due date is two raw inputs** (S). TaskSheet.jsx:55 to 56. CallbackPicker.jsx:18 already has quick chips. Fix: reuse them (Today 5pm, Tomorrow 9am, Next Monday).
14. **No filters on Tasks** (S). Fix: chips for Calls, Emails, Money and Tasks, plus a client search.
15. **Swipe is written twice** (S). AdminTasksHome.jsx:52 to 65 vs src/ui/SwipeRow.jsx. Fix: use SwipeRow.

## Quick add

16. **"Log a call" only opens the Calls hub** (S). AppShell.jsx:206. Fix: rename it Start calling, or open the OutcomeSheet with a lead picker.

## Calls hub, Triage, Lists, Leads

17. **Leads is two screens** (M). AdminApp.jsx:752 and AdminCallsHub.jsx:85; nav.js:22 to 25 still lists three rows. Fix: send /leads into the hub too, one Calls row.
18. **The hub section lives only on the device** (S). AdminCallsHub.jsx:8 to 11 keeps the tab in localStorage. Fix: keep ?section= in the URL, show counts as small badges.
19. **Bulk edits send one request per lead** (M). AdminLeads.jsx:210. Fix: one PATCH with an id array through the existing handler.

## Lead and client record

20. **Edit lead loses changes with no warning** (S). LeadDetail.jsx:336, LeadForm.jsx:21 to 36. Fix: confirm before discarding, or save each field on blur.
21. **The lead form is a 12 field wall on a phone** (S). LeadForm.jsx:46 to 62. Fix: Business, contact, phone and email first, the rest under More details. New lead as a 2 step sheet.
22. **Back from a deep link skips the record** (M). nav-history.js:157 sends any entry with no origin to the section root. Pushes link to /clients/:id/planner, /clients/:id/tasks, /leads/:id/concepts. Fix: with no origin, fall back to the parent record, then the root.
23. **Some fallback Backs point at the wrong section** (S). AdminApp.jsx:840, :824, :834. Fix: fall back to the record each one came from.

## Deals

24. **Can't filter to stalled deals** (S). AdminDeals.jsx:97 to 98. Fix: a Stalled (n) chip, stalled sorted first.

## Clients and Projects

25. **Projects has search and Show archived only** (S). AdminProjects.jsx:110. Fix: stage chips plus Unpaid and Overdue.
26. **Two titles on the same screen** (M). AppShell.jsx:186 plus page Section titles (AdminClients.jsx:131, AdminDeals.jsx:97, AdminConcepts.jsx:34, AdminDocs.jsx:121 to 122 with a second Back). Fix: one header rule. The top bar holds the title and Back; the page shows only the count line.

## Planner, Showcase, Concepts editor

27. **Three editors use a Save bar, Docs autosaves** (L). AdminPlanner.jsx:387, AdminShowcase.jsx:767, AdminConceptsEditor.jsx:271 vs AdminDoc.jsx:28. Fix: all three to the docSave autosave pattern.
28. **Planner can't tell the client the month is ready** (S). retainer_month_ready exists (emailTemplates.js:115) but AdminPlanner never calls openCompose. Fix: a button that drafts it.

## Orders

29. **The push says "Send the payment link", but Orders has no way to** (M). portal-public.js:192 vs AdminOrders.jsx:175 to 176. Fix: a Draft payment link action through Compose, or Copy link with Mark sent.

## Reviews and Portal links

30. **Sending a link takes three steps across two apps** (S). AdminReviews.jsx:24, 83, 122; PortalSheet.jsx:151, 188. Fix: a Text it button (sms: prefilled) and navigator.share, stamping sent when the share succeeds.

## Submissions

31. **The Email button is mailto** (S). AdminSubmissions.jsx:78. Fix: once linked to a lead, open Compose.

## Concepts list

32. **No search** (S). AdminConcepts.jsx:22 to 46. Fix: ListSearch on client and title.

## Calendar and Call console

33. **10px text on a phone** (S). AdminCalendar.jsx:284, 295, 301, 307, 308; AdminCalls.jsx:782, 822. Fix: --v-text-xs (12px) everywhere, and an Agenda list view on the phone.

## Settings, More, Design

34. **Stale and duplicated settings** (M). Zapier card shows Retired with setup text (AdminSettings.jsx:410 to 419); old print dashboard import (:479, copy.js:92); push categories (:336) overlap reminder toggles (:348 to 353); long env var paragraphs (:404); Design system reachable from four places, mislabeled Back (AdminDesign.jsx:133), kicker reads Visualize Dark (:125). Fix: delete retired cards, merge the toggles into one list, collapse setup text into a How to connect fold, keep Design under Settings only.

## Screenshots and desktop gaps

docs/screens has 16 files from Oct 29 and 30: Home, the Calls hub tabs, the tab bar and the Add to list sheet, at 390 and some at 1280. docs/crm-screens has 50 files from Oct 21, before the nav revamp, out of date. Nothing current at 1280 for Projects, Docs, the doc editor, Concepts, Compose, Tasks, the Pipeline and Clients dashboards, List fill, Project new. Next step: rerun the capture at 390 and 1280 for every nav entry and delete the Oct 21 set.
