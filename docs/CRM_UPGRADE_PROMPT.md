# VISUALIZE CRM — full admin rebuild prompt

This is the working prompt for turning the Visualize admin dashboard into a
pipeline CRM. It was written by applying two design skills to Rob's brief and
this codebase, and it is the spec the implementation follows:

- **frontend-design** (Anthropic): subject-grounded design, hero-as-thesis,
  typography as personality, one signature element with quiet surroundings,
  real content over placeholder, writing as design material, quality floor
  (responsive, visible focus, reduced-motion) without announcement.
- **ui-ux-pro-max**: design-system reasoning per industry, resilient
  text/compact-UI rules (nothing clips at narrow widths or zoom, chips wrap,
  meaning never by color alone), pre-delivery checklist (no emoji as icons,
  cursor feedback, 4.5:1 contrast, focus states, test 375/768/1024/1440).

═══════════════════════════════════════════════════════════════════
CONTEXT — what exists and must keep working
═══════════════════════════════════════════════════════════════════
React 18 + Vite SPA, CSS-in-JSX, dark Visualize brand (#080808 base,
#121212/#1a1a1a surfaces, #d44c43 red reserved for primary actions/wins),
Barlow Condensed display + Inter body, Untitled UI icons only, zero emoji.
Admin shell `AdminApp.jsx` (icon rail desktop / bottom tabs mobile), layout
primitives in `AdminLayout.jsx` (PageShell / ScrollArea / StickyFooterBar,
tokens on .lay-root — every page renders through them, LAYOUT.md rules).
MongoDB via serverless `api/` (collections: call_leads, submissions,
settings, push_subscriptions). Lead stages already: lead → booked → won/lost.
Call Console (session dialing + reverse lookup) and Booked workspace exist.
Data rule: EVERY schema change is additive — never rename or drop fields;
all existing leads must render untouched.

═══════════════════════════════════════════════════════════════════
THE PIPELINE — three management pages, one stage machine
═══════════════════════════════════════════════════════════════════
Stage machine (additive): lead → booked → won → client (+ lost).
"client" = first invoice paid; a won lead sits in Clients as
"awaiting first invoice" until Rob taps **First invoice paid**.

1. **LEADS** (`/leads`) — manage leads BEFORE they're booked.
   Full-width list (search, priority/status/industry filters, sort) +
   detail pane: business hero, tap-to-call, socials, angle, notes editor,
   call history, checklists, linked submissions, edit/delete, and a
   "Dial in Call Console" affordance. This is where browsing/managing
   lives now — the console no longer doubles as the lead browser.

2. **BOOKED** (`/booked`) — exists; gains checklists + linked submissions.
   Won leads flow onward to Clients ("awaiting first invoice").

3. **CLIENTS** (`/clients`) — won + client stages.
   Won card: prominent **First invoice paid → Client** action (the red
   accent moment — this is scoring). Client detail: contact hero, services
   sold, the pricing option they took, checklists (project tasks),
   linked submissions, notes, call log. List shows won ("awaiting first
   invoice", amber) separated from paying clients.

═══════════════════════════════════════════════════════════════════
SUBMISSIONS ↔ PEOPLE — linking
═══════════════════════════════════════════════════════════════════
Submissions page stays the one place to triage site submissions, but each
submission can be LINKED to a lead/client (additive `linkedLeadId` on the
submission). Auto-suggest matches by email, phone digits (shared
normalizer), and business name; one tap links, one tap unlinks. Lead /
Booked / Client detail pages show that person's linked submissions inline
(type, date, status, key fields) — the full story of who sent what.

═══════════════════════════════════════════════════════════════════
CALL CONSOLE — a session builder, not a browser
═══════════════════════════════════════════════════════════════════
The console's queue screen becomes a focused SESSION BUILDER: big
selectable cards/chips for who to dial (Hot / Warm / Cold, Not called /
Callbacks, industry, include-no-phone), a live count ("32 leads match"),
recent-session stats, and one huge START button. No lead list — leads are
managed on /leads. Session view, outcome logging, reverse lookup ("/"),
and localStorage session persistence all stay exactly as they are.

═══════════════════════════════════════════════════════════════════
CHECKLISTS — optional task lists on every lead/booked/client
═══════════════════════════════════════════════════════════════════
Additive `checklists: [{ name, items: [{ text, done }] }]` on call_leads.
Default UI is just an **Add checklist** button; naming a list creates it;
more lists with different names can be added. Items toggle/add/remove
inline with optimistic saves. Progress shown as n/m. One shared component
used on all three detail pages.

═══════════════════════════════════════════════════════════════════
SHELL, GREETINGS, FULL SCREEN, MOBILE
═══════════════════════════════════════════════════════════════════
- Nav: Dashboard · Leads · Booked · Clients · Submissions · Orders ·
  Calls · Settings. Desktop icon rail shows all with badges (unread,
  booked count, awaiting-invoice count).
- Mobile: five thumb tabs — Leads, Booked, Clients, Calls, **More** —
  where More opens a bottom sheet with Dashboard, Submissions, Orders,
  Settings (with badges). Different device, different chrome; same data.
- Full screen: management pages use the full viewport beside the rail
  (wide list + detail split on desktop, drill-down on mobile), capped only
  on ultrawide. No dead right-side space.
- Dashboard hero-as-thesis: a rotating funny greeting addressed to Rob
  (claude.ai style: "Coffee and cold calls, Rob?", "Hey there, Rob'neH?")
  over a pipeline snapshot: Leads → Booked → Clients funnel counts, next
  meetings, unread. The greeting is the signature element; everything
  around it stays quiet.

═══════════════════════════════════════════════════════════════════
BACKEND — additive, admin-guarded, nothing public
═══════════════════════════════════════════════════════════════════
- call_leads sanitize: + 'client' stage, + `checklists` (≤10 lists × ≤50
  items, strings capped), + `clientSince` timestamp set on first-invoice.
- submissions PATCH whitelist: + `linkedLeadId` (string id or '' to unlink).
- Reuse existing GET/PATCH endpoints; optimistic UI with rollback and loud
  failure toasts everywhere; shared phone/email normalizers for matching.

═══════════════════════════════════════════════════════════════════
QUALITY BAR (from both skills — verify before shipping)
═══════════════════════════════════════════════════════════════════
- Zero emoji; Untitled UI SVGs only. Cursor feedback on everything
  clickable. Visible :focus-visible. prefers-reduced-motion respected.
- Nothing truncates that Rob reads on a call; chips wrap; badges never
  rely on color alone (text labels beside dots).
- No horizontal scroll at 320/375/390/768/1024/1440; run
  `scripts/layout-audit.mjs` (extended with /leads and /clients) to zero
  offenders; build passes; every page reachable on both form factors.
- Keep the dark brand exactly; red only for primary actions and wins.
