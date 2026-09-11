# UX audit: declutter and duplicate entry

Written before anything was changed, then stamped with what was done. The
CRM works; this pass makes it faster to use. Every count below is either
read straight out of the live database (432 live leads, 6 clients, 2
booked, 5 lost, 40 live posts, 1 project, 1 concept pack, 0 submissions) or
counted by walking the screens at 390 and 1280 as Rob would.

Scope: docs/ARCHITECTURE.md, docs/COMPONENTS.md, docs/SECURITY-AUDIT.md,
every Admin*.jsx page, LeadDetail.jsx, ClientWorkspace.jsx, PostSheet.jsx,
AdminShowcase.jsx, AdminPlanner.jsx, and every sanitize() in api/_routes/.

Two rules carried from the security pass and kept throughout: every link or
image field keeps safeUrl() at sanitize and safeHref() at render, and no
field leaves sanitize() to leave the UI (old records must still read).
scripts/security-test.mjs stays at 852 checks.

## Part 1: what was found

### Duplicate entry

The same fact typed in two places, what the live data says about each, and
which one is the source.

| # | Fact | Where it is typed | Live use | Source | The other one becomes |
|---|---|---|---|---|---|
| D1 | The business's public name | `business` (Overview, Edit all) and `showcase.displayName` (Showcase editor, Card fields) | displayName set on 5 of 5 showcases, differs from business on 1 | `business` | Read only in the editor, "Edit in Overview", with one "Use a different public name" affordance that reveals the override. A record already holding a different name keeps it (read time). |
| D2 | The logo | `showcase.logoUrl` (editor), `showcase.brand.logo.light` and `.dark` (the pre dark-only pair the editor still blanks), `brand.logoLink` (Overview Brand card) | logoUrl 1, dark 3, light 3, brand.logoLink 0 of 432 | `showcase.logoUrl` (the endpoint reads dark, light, then logoUrl; the editor blanks the pair on save, so the newest write wins) | `brand.logoLink` leaves the Brand card (never used once); the Brand card shows the showcase logo read only with "Edit in Showcase". The pair stays readable at the endpoint. |
| D3 | The website URL | `socials.website` (imported, SocialFields), `links.website` (client Links card), `showcase.website.url` (editor) | socials.website 358, links.website 0, showcase.website.url 2 | `socials.website` | Links card shows it read only with "Edit in Overview". The editor shows it read only with the same link; the public endpoint falls back showcase.website.url, then socials.website, then links.website, so a record holding an override still serves it, and the editor shows that override with a Clear button rather than a second input. |
| D4 | Instagram | `socials.instagram` (imported), `links.instagram` (Links card), `showcase.instagram.url` and `.handle` (editor) | socials.instagram 188, links.instagram 0, showcase url 1, handle 2 | `socials.instagram` | Links card read only. Editor: URL derived, handle derived by parsing the URL (instagram.com/<handle>), both read only with "Edit in Overview"; the endpoint already falls back to socials.instagram for the URL and now derives the handle the same way when the showcase one is blank. A record holding its own handle keeps it. |
| D5 | The brand palette and fonts | `brand` on the lead (Overview Brand card); shown again in the Showcase editor's Brand block | primary 4, fontDisplay 1 | `brand` | Already read only in the editor with "Edit in Overview" (Site Prompt 7). Nothing to change; confirmed. |
| D6 | The contact name | `askFor`, labelled "Contact name" on the lead form and "Ask for" on the detail card | 252 of 432 | one field, two names | The detail fact is relabelled "Contact" so the same field reads the same everywhere. Not a duplicate in the data. |
| D7 | Posts a month | `planner.postsPerMonth` (Planner setup) and the retainer plan's `monthly.count` (Content Kit is 8) | postsPerMonth 1, retainer 0 | the retainer plan, when the client has one | The Planner setup shows the plan's count read only ("8 a month, from Content Kit, edit in Retainer") and only offers the input when there is no retainer. sanitize keeps the field; the endpoint keeps serving it. |
| D8 | The meeting | `meeting{date,time,type,location}` on the lead (set by the console's Booked outcome and the Meeting block), read by Booked and by the Calendar; the Calendly event is matched by `calendlyEventUri`, never typed | meeting.date 2, afterCall.meeting 3 (legacy free text), calendlyEventUri 0 | `meeting` | Already one source. `afterCall.meeting` is a legacy fallback the Meeting block shows as "logged as ..." with a Set date button and nothing writes it any more. Confirmed, nothing to change. |
| D9 | Services planned | `gamePlan[]` (Meeting block) and `servicesPlanned[]` (legacy, read only in the command bar) | gamePlan 2, servicesPlanned 25 | `gamePlan` | Already migrated at read (src/lib/booked.js). Confirmed. |

### Clutter

**Dashboard, 390 wide.** Above the fold (844px tall, after the top bar):
the greeting, the date line, two buttons, then the four card pipeline strip
scrolling sideways, then the Today panel's ring. Below it: eight stat cards
(Calls today, this week, this month, Not yet called, Booked, Callbacks
pending, New leads 48h, Connect rate), the Revenue card's four more stat
cards, then Recent activity. Sixteen numbers on one screen whose job is
"what do I do now"; Today is third, under a strip of four numbers that
change once a week. At 1280 the left column is header, strip, eight stats,
revenue; Today sits in the right column below the header line.

**Lead and client detail.** A lead: profile card (name, descriptor, four
pills, seven icon buttons, two buttons, nine facts) then five sections in
one long scroll (Overview: the angle, three intel cards, Before you dial;
Playbook: script, objections, close; Meeting when booked: five blocks;
Notes; History), with the tab strip as jump links. Every section is open.
A client adds Links, Brand, Projects, Payments, Retainer, Deliverables:
eleven sections, all open, and Projects (the thing Rob touches most) is the
fourth. Opening a client's projects: tap the row, tap Projects. The intel
cards are empty on 432 of 432 leads; Before you dial holds the same three
default lines on nearly every lead (1281 lines across 432 records is the
skeleton, three each).

**Showcase editor.** Nine cards: Publish, Card fields, Brand identity,
Website, Instagram, Business cards, Print and product, Landing page,
Testimonials. The five ShowcaseBlocks all open by default (`useState(true)`),
each with an upload row and an object list, so the page is a long scroll on
a phone before the landing toggles at the bottom, and there is no view of
what is filled versus missing except by scrolling.

**Settings.** Seven tabs. Profile (name, target, appearance, hours,
password note) and Notifications are touched; Data monthly for a backup;
Integrations and Automation are read once (they show whether keys are set
and when the crons ran); Shortcuts is a reference sheet; Danger zone is
rare by design.

**Forms.** The lead form: Business, Contact name, Phone, Phone note, Email,
Industry, Area, Best window, Priority, Descriptor, The angle. Best window
is filled on 9 of 432 leads. The detail card's Address fact is filled on 0
of 432 and has no form input. The showcase Year is 0 of 5.

### Repeated steps (taps, before)

Counted on the phone layout; a tap is a press, an OS file picker counts one.

| # | Action | Path today | Taps |
|---|---|---|---|
| T1 | Log a callback from the console | Outcome "Call back" (1), a quick chip (1), Set callback (1) | 3 |
| T2 | Set a callback from the lead detail | Callback due fact (1), chip (1), Save (1) | 3 |
| T3 | Publish a showcase and feature it on the landing page | Publish toggle (1), scroll past five open blocks, Feature toggle (1), Logo strip toggle (1), Save (1) | 4 plus a long scroll |
| T4 | Create a post, add its image, send it for approval | Add post (1), scroll past the client note to Image, Upload (1), pick file (1), scroll to Status, Send for approval (1), Done (1), Save (1) | 6 plus two scrolls |
| T5 | Mark a project delivered and send the review link | Advance to Delivered (1), Back (1), Showcase (1), Copy review link (1), Back (1), tick Review link sent (1) | 6 |
| T6 | Open a client's projects | Clients row (1), Projects tab (1) | 2 |
| T7 | Open a booked lead's meeting prep | Booked row (1), Meeting tab (1) | 2 |
| T8 | See what to do now on the Dashboard | Open, scroll past the strip to Today | 0 taps, 1 scroll |
| T9 | Set a retainer client's posts a month | Retainer sheet picks the plan (already done), Planner (1), Posts a month (1), type, Enter (1), Save (1) | 4 |
| T10 | Reach Settings, Integrations to check a key | Account menu (1), Settings (1), Integrations tab (1) | 3 |

### Dead weight (live database)

Fields empty across every record, and features with zero usage:

- `address`: 0 of 432 (a fact on the detail card, no form input) -> fact removed, sanitize kept
- `brand.logoLink`: 0 of 432 (superseded by the showcase logo) -> removed from the Brand card, sanitize kept
- `links.website`, `links.instagram`: 0 of 432, duplicates of socials -> derived (D3, D4), sanitize kept
- `links.drive`, `links.clickup`: 0 of 432 today, but the project flow prefills and reads them (the new project sheet, the Drive button on release) and there is one project so far -> kept, they are workflow fields not dead ones
- `showcase.year`: 0 of 5 -> removed from the editor, sanitize and the public page kept (a record with one still shows it)
- `conceptsTracker`: 2 of 432 and no screen reads it at all (grep: only the sanitize) -> nothing renders it, nothing to remove from a screen; noted
- `intel.accomplishments/gaps/dropLines`: 0 of 432 -> the three cards fold into one collapsed "Intel" block
- `beforeYouDial`: the three skeleton lines on every lead -> folds into the Playbook section rather than heading the Overview
- `bestWindow`: 9 of 432 -> stays on the form, moves below Phone note; not removed
- `prepNotes`: 1 -> part of the Meeting block, stays
- `reviews.asks`, `reviews.nfcCard`, `reviews.googleLink`, `reviews.testimonials`: 0 across every record -> the Reviews screen has not been used yet; it is the review workflow, not clutter on any daily screen; left as is
- `calendlyEventUri`: 0 (Calendly is not connected); left
- settings: one `rate:planner:<raw token>` document from before the limiter keyed on a hash; harmless and excluded from the backup already; the limiter now writes only hashed keys. Left for the next backup run to age out; noted here so nobody wonders.
- submissions: 0 documents in the live database; the screen stays, it is where the site's forms land

## Part 2: the principles applied

- One source per fact. The secondary place shows the value read only with
  a link to where it is edited; a record that already holds both keeps
  reading (migrate at read, never a migration).
- Progressive disclosure. Detail pages open on the section for the
  record's stage; everything else is a one line summary until tapped. The
  Showcase editor is a checklist with a meter, not a scroll.
- Sensible defaults. A new post starts with the image field in hand; a
  Delivered project starts with the review link on screen.
- Fewer taps on the common path. The landing toggles sit in the Publish
  card; Delivered opens one dialog with the link and the checklist;
  Projects and Meeting are where a client and a booked lead open.

## Part 3: what was implemented, in order

Twelve items. Commit hashes are filled in below as each landed.

| # | Item | Commit |
|---|---|---|
| 1 | D3 and D4: website and Instagram have one source (`socials`); Links card and Showcase editor derive them; endpoint fallback order; handle parsed from the URL | 8169a9d |
| 2 | D2: `brand.logoLink` leaves the Brand card, which shows the showcase logo read only | 7b5edf2 |
| 3 | D1: `showcase.displayName` is an override of `business`, read only until asked for | 1a51d3e |
| 4 | D7: `planner.postsPerMonth` derives from the retainer plan when there is one | 2c2cd50 |
| 5 | Dashboard: Today first, then four numbers, then the pipeline strip, then "More stats" | f5db293 |
| 6 | Detail pages open on the stage's section; the rest collapse to one line each | 1950216 |
| 7 | Showcase editor: blocks closed except Publish; completeness meter at the top | 395d20c |
| 8 | Publish card carries the landing toggles (one save) | 571e8d2 |
| 9 | New post: image first and focused | 9cb2b36 |
| 10 | Delivered: one dialog with the review link, copy, and the checklist | e9aff5a |
| 11 | Settings: Automation folds into Integrations, Shortcuts moves to the account menu | 20abe43 |
| 12 | Dead weight: Address fact, showcase Year, "Ask for" relabelled Contact, intel and Before you dial folded | b342164 |

### The four Dashboard numbers

Calls today (the daily target is the one thing measured every day), Callbacks
pending (the thing that slips), Booked (the thing that pays), and New leads
48h (the thing that goes cold). Everything else (calls this week and month,
connect rate, not yet called, the four revenue cards) is one tap away
behind "More stats", with the same trends and the same links.

## Deferred to a second pass, and why

- Logging an outcome from the lead detail. The console's Call back sheet
  already carries the time picker inline (T1 is 3 taps and one sheet), and
  the detail's own Callback fact is the same sheet. Adding an outcome
  logger to the detail would be a new feature, not a declutter.
- The Reviews screen and its fields (asks, NFC, Google link) have zero
  usage; whether that is because it is not needed or not yet reached is
  Rob's call, not a grep's.
- `conceptsTracker` has no UI and two records; removing the sanitize entry
  is exactly what the rules forbid, and there is no screen to remove it
  from.
- `bestWindow` (9 of 432) could leave the lead form; at two percent it is
  rare, not dead, and it is one field.
- A "log a contact" quick action on the client record (contactLog is
  written by 7 records and there is no obvious way in from the card).
- The Booked screen's own tab strip and the Calendar's day view were not
  touched; neither showed a duplicate or a competing first read.

## Part 4: the after counts

Same ten actions, same phone layout, counted on the built app after the
twelve items (the Delivered dialog, the fold defaults, the meter and the
Publish card were also driven in Chromium against the audit fixtures).

| # | Action | Before | After | What changed |
|---|---|---|---|---|
| T1 | Log a callback from the console | 3 | 3 | Already inline; unchanged |
| T2 | Set a callback from the lead detail | 3 | 3 | Unchanged |
| T3 | Publish and feature on the landing page | 4 plus a long scroll | 4, no scroll | The landing toggles sit in the Publish card (item 8); the blocks below are closed (item 7) |
| T4 | Create a post, add its image, send for approval | 6 plus two scrolls | 6, one scroll | The editor opens with Upload focused (item 9); the status picker is still at the end |
| T5 | Mark delivered and send the review link | 6 across two screens | 3 in one dialog | Delivered carries the link, Copy ticks the checklist (item 10) |
| T6 | Open a client's projects | 2 | 1 | A client opens on Projects (item 6) |
| T7 | Open a booked lead's meeting prep | 2 | 1 | A booked lead opens on Meeting (item 6) |
| T8 | See what to do now on the Dashboard | 0 taps, 1 scroll | 0 taps, 0 scroll | Today is straight under the greeting (item 5) |
| T9 | Set a retainer client's posts a month | 4 | 0 | Read from the retainer plan (item 4) |
| T10 | Check an integration key or a cron run | 3 (a fourth for the cron) | 3 | Crons live on the Integrations tab (item 11) |

Things typed twice before and once now: the website (three places to
one), Instagram (four to one, the handle never typed at all when the URL
is known), the logo (three to one), the public name (two to one unless an
override is wanted), posts a month for a retainer client (two to one).

Dashboard at 390, above the fold: was the greeting, two buttons, the
pipeline strip and the top of Today; now the greeting, two buttons, the
whole Today panel (ring, target, the day's rows). Numbers on the first
screen: sixteen before, four after, the rest one tap away.

Audit results are in the report.
