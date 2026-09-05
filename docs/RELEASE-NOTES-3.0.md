# Visualize admin 3.0.0: release notes

What changed for you, screen by screen, in plain language, and the list of
things to set up once. 3.0 is the fifteen prompt rebuild of the admin CRM on
one component kit, one token sheet, and one API contract; the marketing site
is the same site, split into its own chunks.

## What is new, screen by screen

**Boot and sign in.** The shell paints as a skeleton frame before the app
downloads, so opening the admin on the phone never shows a blank screen. A
signed in device stays signed in: the cookie renews itself on every visit.
Ten wrong passwords from one address lock sign in for 15 minutes.

**Dashboard.** The greeting names you and says what today holds (callbacks
due, meetings, new leads, or that the queue is clear). The funnel strip,
eight stats with week and month trends, the Today card with the call ring
against your daily target (editable in place), revenue and retainer numbers,
and a recent activity feed. Every card opens the screen it counts. The ring
pulses once when you hit the target.

**Leads.** Kanban by call status on desktop, a card list on the phone, a
table with your own column choices, saved views, filters by status,
priority, industry, and data quality, bulk priority, status, delete, and
CSV export, a duplicates finder with a merge, and the lead detail with the
script, objections, close lines, intel, notes, checklists, history, and the
linked website submissions. Cards move between columns by drag, by the
card's menu, or with Shift and an arrow key on the keyboard.

**Call Console.** Build a session from status, priority, industry, best
window (Right now picks the window for this hour), and size, then a queue
and a call room with the big phone button and a timer, the script tabs, a
Before you dial checklist, and five outcomes on one bar. Booked opens the
meeting sheet, Callback the time picker, a no removes the lead with six
seconds of undo. The summary shows the session's numbers and what to do next.

**Booked.** Every booked lead with its meeting, the prep workspace (pricing
options built from the packages with payment plans, the concepts tracker,
the game plan, prep notes), the reschedule sheet, a calendar file to
download, and Mark as won or lost. Winning turns the lead into a client with
a pulse and a badge tick.

**Calendar.** Day, week, and month over meetings, callbacks, Calendly
bookings, new leads from the scraper, retainer bills, and final payments.
Callbacks reschedule from the calendar, Calendly bookings link to a lead or
create one, overdue callbacks sit at the top of the day.

**Clients.** The client list with filters for active, on retainer,
delivered, paused, owes a payment, and ready to deliver; the client record
with Projects (packages, custom totals, stages, revision rounds), Payments
(the schedule, Mark paid, manual payments, the ledger), Retainer (Site Care
and Content Kit, monthly delivery log, pause, resume, cancel with notice),
Deliverables (the Drive structure and the delivery checklist), links, brand
colors and fonts, notes, and history. Stripe payments land on the ledger by
themselves when the email, phone, or business name matches.

**Print Orders.** Shop orders from the website arrive as orders, walk ins
and client jobs start with New order, items come from the product list or a
custom line, rush and due dates, packaging, Mark paid, and stages from new
to delivered. Old orders saved in the print dashboard import from Settings.

**Concepts.** The library of prompt packs and image links you copy into
ChatGPT before a meeting, by industry and kind, linked to the lead they were
made for, and picked straight from a lead's concept list.

**Reviews.** Per client: the NFC card, the Google link, baseline and latest
counts, and every ask you log, with a reminder three days after a delivery.
Reviews posted through the website form land here to link.

**Submissions.** Every website form (briefs, contact, reviews, shop orders)
with filters, unread state, notes, socials, link to a lead, convert to a
lead, and CSV or JSON export.

**Notifications.** The bell holds today's callbacks, meetings, bills, review
asks, Calendly bookings, and a system line when the nightly jobs go quiet.
Mark read, snooze, and one morning digest push at 9am Eastern with the
day's callbacks (due today or overdue), meetings, bills, and review asks.

**Search.** Slash or the search box finds leads, clients, and screens; type
a phone number and it matches the lead that is calling, or offers to create
one.

**Settings.** Profile (name, business hours, theme, Reduce motion,
password), Notifications (push on this device, which reminders), Integrations
(Calendly, Stripe with reconcile, the scheduled tasks, the nightly jobs),
Data (imports, exports, backup, recently deleted), Automation (the two crons
and the app's own error log), Shortcuts, and the danger zone.

**Look and feel.** Dark by default with a light theme that keeps the black
sidebar, Reduce motion in the app and from the OS, skeletons that match the
loaded screen, empty and error states with one clear action, toasts with undo
where a mistake is possible, and every control at least 44 pixels on the phone.

**Offline.** The admin opens and reads offline from the last data it saw;
writes are refused with a clear message until the network is back.

## What you must set up

In this order. Every value goes into Vercel, Project, Settings, Environment
Variables (Production), then redeploy.

1. **Atlas.** In the Atlas project, delete the `sample_mflix` database if it
   is still there (Browse Collections, the trash icon next to the database;
   it is Atlas's demo data and only adds to the free tier's storage). Add
   Vercel's outbound addresses or 0.0.0.0/0 to Network Access. Copy the
   connection string with the database name `/visualize` in the path.
2. **MONGODB_URI**: that connection string. Unlocks every screen.
3. **SESSION_SECRET**: 32 or more random characters. Unlocks sign in.
   Rotating it signs every device out.
4. **ADMIN_PASSWORD**: the first password. After you change it from
   Settings, Profile, the hash in the database wins and this variable can stay.
5. **VAPID_PUBLIC_KEY** and **VAPID_PRIVATE_KEY**: `npx web-push generate-vapid-keys`
   once, paste both. Unlocks push on the phone (Settings, Notifications,
   This device). On iPhone the app must be installed to the Home Screen first.
6. **CRON_SECRET**: any random string. Unlocks the two scheduled tasks and
   the health document. Vercel sends it on its own; confirm both crons show
   in Vercel, Project, Settings, Cron Jobs after the deploy: `/api/cron/reminders`
   once a day at 13:00 UTC (9am Eastern, a morning digest of the day's
   callbacks, meetings, bills, and review asks; the Hobby plan only allows a
   daily schedule) and `/api/cron/daily` at 06:00 UTC. Settings, Automation
   shows their last run.
7. **CALENDLY_TOKEN**: Calendly, Integrations, API and webhooks, Personal
   access token. Unlocks Calendly bookings on the Calendar and in the bell.
8. **Stripe.** Dashboard, Developers, Webhooks, Add endpoint:
   `https://admin.visualizeclients.com/api/stripe/webhook`, events
   `charge.succeeded`, `invoice.paid`, `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy the signing secret into
   **STRIPE_WEBHOOK_SECRET**. Create a restricted key with read access to
   Events and put it in **STRIPE_SECRET_KEY**. Redeploy, send a test event
   from Stripe, and check Settings, Integrations, Stripe.
9. **WEB3FORMS_NOTIFY_KEY** (optional): the email copy of every website
   submission. **ADMIN_URL** only if the admin ever moves off
   admin.visualizeclients.com.
10. **Device print order import**: on the phone or laptop that ran the old
    print dashboard, open Settings, Data, Print orders saved on this device,
    review the preview, and import. It reads the old `vz_print_orders`
    storage on that device only; do it once per device before clearing site data.
11. **First backup**: Settings, Data, Download backup. Keep the file
    somewhere safe; it is the restore source.

Then the daily walk in docs/QA-CHECKLIST.md once on the phone.

## Behind the scenes (for the next prompt)

Every API route runs through one wrapper (method allow list, body cap, admin
guard, CSRF header, one try/catch), the session cookie renews, sign in is
rate limited, the Stripe webhook claims each event before writing, the admin
host sends a Content-Security-Policy, fonts are served from the app, the
screens are separate chunks with the shell and Dashboard first, the service
worker keeps the shell and the last data for offline reading, render errors
land in a per screen boundary and in Settings, Automation, and the release
gate is the audit set in docs/RUNBOOK.md (layout, feel, a11y, regression,
hex count, css orphans, dates).
