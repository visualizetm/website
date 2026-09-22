# CONCEPTS: THE AUDIT BEFORE THE REBUILD

What Concepts is for: Rob builds a bundle of concept directions for a lead
or a client, sends one private link, and the client scrolls through a
presentation of the work, then approves a direction or asks for changes.
What was built (Prompt 11) is an internal prompt library (concept_packs
with prompts, tags, industry and kind chips, a PackPicker, a seeded
"Universal logo directions" pack) plus a status tracker on each lead. The
client never sees any of it. This is the record of what is there, what is
broken, and what the rebuild deletes and migrates.

## The bugs, reproduced

Reproduced on the built admin against the audit fixtures at 390 (touch)
and 1280, screenshots in the session's scratch folder. Each is a mistake
the rebuild must not repeat.

1. **The library grid, both widths.** A pack that says "3 images" shows
   no thumbnails: every image link is hidden the moment it fails to load
   (`onError` sets `display: none`), so a pack with three links to a
   Drive folder and two unreachable files looks exactly like a pack with
   none. Nothing says the links are broken.
2. **The library grid, both widths.** Two rows of filter chips (kind,
   industry) over a library of two packs, each chip counting 1. The
   filters outweigh the content, and "New pack" is the primary action
   although a pack with no lead attached is useless to a client.
3. **Pack detail at 390.** The sheet's title and the inline title editor
   both print the pack title, in the display face, uppercase, four lines
   each for "Auto detailing social grid Superlongunbrokenbus": eight
   lines of the same words before the first field.
4. **Pack detail, both widths.** "Mark shown to Lead": the button takes
   the first word of the business name, so it reads "Mark shown to Lead"
   for "Lead Business 8" and "Mark shown to Philly" for the detailer.
5. **Pack detail, both widths.** The tag chips render as selected filter
   chips with a check icon; tapping one deletes the tag, with no
   affordance that says so and no undo.
6. **Pack detail, both widths.** A prompt row prints its label twice: in
   the collapsed head and again as the first editable line of the open
   body. Copy prompt is the only control drawn as an icon button, so it
   reads as the primary action of a row whose point was the text.
7. **Pack detail and grid, both widths.** The kit's field controls
   (Search packs 308x42, Kind and Industry selects 127x42, Add tag
   154x42) are under the 44px target rule on every screen that has them.
   A kit issue, noted here because Concepts is where it was measured.
8. **The lead tracker at 390.** "Add the usual five" creates five cards
   of "Logo directions / Planned / From library / Paste a link", 174px
   each: 870px of cards that say nothing, a progress bar at zero, no
   image anywhere. On a phone that is a full screen of empty boxes
   between the meeting and the notes.
9. **The lead tracker, both widths.** The status pill is a menu trigger
   with no chevron. Its four states (planned, generating, ready, shown)
   describe Rob's process, not a decision; "shown" is also written from
   the pack side by Mark shown, so the two can disagree.
10. **From library, both widths.** Picking a pack with no images (the
    seed) links its id and leaves "Paste a link" on the card, which then
    grows a "Universal logo directions" pill and an "Open library" button
    that navigates away from the lead in the middle of the edit.
11. **From library at 390.** A tall sheet holding two rows and 430px of
    nothing, its search field autofocused so the keyboard rises over the
    two rows it was meant to search.
12. **Booked detail at 390.** The record's action bar truncates to
    "Mark a...", "Mark a...", "Resche...", which is the bar the tracker
    lives above. Pre-existing on the Booked screen; it stays on the list
    because the new Concepts entry point sits in that record.
13. **Nothing reaches the client.** There is no client page, no approval,
    no feedback, no notification. Concepts are shown on a screen share or
    by pasting a Drive link into the link field.
14. **A read that writes.** The first GET on an empty collection inserts
    the seed pack. The seed is now the only real pack in the database.

## The live data

Read through the Atlas connector on 2026-09-22, database `visualize`.

| What | Count |
|---|---|
| concept_packs, total | 2 |
| of which the seed ("Universal logo directions", leadId "", 3 prompt stubs, 0 images) | 1 |
| of which real | 1: "Steve" (kind brand-board, one empty prompt, 0 images, no lead, created 2026-09-17) |
| concept_packs with any image | 0 |
| concept_packs with a Cloudinary image | 0 |
| call_leads carrying concepts[] items | 2 |
| concepts[] items in total | 9 (All of A Sudden Desserts: 8, 5 Handy Bros: 1) |
| by status | planned 9, generating 0, ready 0, shown 0 |
| items with a link | 0 |
| items pointing at a pack | 2, both at the seed |

There is nothing to migrate with an image in it. The migration script
exists for the shape, is run here for its report, and reports zero.

## What the rebuild deletes, and what it migrates

Deleted from the UI and the code, with the sanitize entries left in place
so every old record still reads:

- The prompt library: prompts[] and its rows, Copy prompt, the seed pack
  and its seeding on an empty read, tags, the industry and kind chips, the
  grid of packs, the pack detail, New pack.
- PackPicker and every "From library" action on a lead.
- The concepts[] tracker on LeadDetail and its planned / generating /
  ready / shown statuses; the tracker's progress on the Booked meeting
  line. The status of concepts lives on the concept set now.
- The admin shell stops loading concept_packs. The route and its
  sanitize() stay registered so the two stored packs remain readable.

Migrated, through `scripts/migrate-concepts.mjs` (report first, writes
only with `--apply`):

- Every real concept_pack with at least one image and a linked lead
  becomes a draft concept_set for that lead: one direction per pack, the
  pack title as the direction's name, its images as items in order.
- Every lead concepts[] item with a link becomes an item in a draft set
  for that lead (one set per lead, one direction named after the item).
- Nothing is deleted from the database. concept_packs and the leads'
  concepts[] stay exactly as they are.

Live run, from the counts above: 0 sets from packs, 0 sets from lead
items. The seed and the "Steve" pack have no images and no lead; the nine
lead items have no links.

## What the new thing is

`concept_sets`, one document per presentation, with directions, items,
the client's feedback and an approval; a token that is the whole
credential, minted only server side; an admin editor on the Showcase and
Planner pattern; and a public presentation at /concepts/:token built on
the Scene engine. docs/ARCHITECTURE.md carries the schema once it is
built.
