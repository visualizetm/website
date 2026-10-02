# MOBILE APP UI DESIGN GUIDE

Source: Kole Jain's video "Everything you need to know about Mobile App UI's in 8 minutes (beginner friendly)".

Saved from the copy pasted into the session. Two edits only: em dashes became colons (CLAUDE.md bans them in docs) and the ASCII sketches that were drawn with box characters are described in words.

The purpose of this document is to turn the concepts taught in the video into a detailed design framework that an AI such as Claude can understand and consistently apply when creating, redesigning, evaluating, or converting interfaces for mobile applications. Treat it as a mobile UI design philosophy and implementation guide, not merely a visual-style reference.

The central lesson is: a mobile application should not be treated as a desktop application that has simply been compressed onto a smaller screen. Mobile requires changes to navigation, hierarchy, information density, screen responsibilities, interactions, gestures, and contextual controls.

---

## 1. CORE MOBILE DESIGN PHILOSOPHY

When converting an interface from desktop to mobile, do NOT begin by asking "Where can everything from the desktop interface fit?" Instead ask: "What does the user need to accomplish on this specific mobile screen?"

The mobile version should preserve functionality while reducing how much information and how many controls are visible simultaneously.

The goal is not desktop UI to smaller desktop UI. The goal is desktop functionality to a reorganized mobile experience.

A smaller display does not mean that every individual component should become smaller. Instead:

* show fewer things at once;
* create stronger hierarchy;
* separate tasks into screens;
* use navigation to move between functions;
* use gestures for contextual behavior;
* change available actions depending on the current task;
* preserve readable text;
* preserve comfortable touch areas;
* intentionally design states where content is missing.

The application should feel designed specifically for a phone.

---

## 2. NAVIGATION

Video section: approximately 0:20.

Desktop software commonly uses a permanent sidebar because there is enough horizontal space (Home, Notes, Templates, Files, Search, Settings, Account, Notifications, all at once). That approach usually does not translate directly to mobile. A phone does not have enough horizontal room to permanently display this amount of navigation, so mobile navigation must be reorganized.

### 2.1 Bottom navigation

Identify the application's most important destinations and place only those in the bottom navigation. The video suggests 3 to 4 destinations is ideal and 5 is approximately the practical maximum. Once more items are added, the navigation becomes crowded and increasingly difficult to use.

Claude should not automatically translate every desktop sidebar link into a mobile tab. A desktop navigation of Dashboard, Projects, Tasks, Messages, Calendar, Clients, Reports, Settings should NOT become an eight-button bottom navigation. An example mobile structure could be Home, Projects, Messages, More. The remaining functionality can exist deeper in the app. The mobile navigation should represent major destinations, not every available feature.

### 2.2 Touch target size

Mobile controls are operated with fingers rather than a precise mouse cursor. The video references roughly a 44 pixel touch target as a useful mobile target size. The lesson is not "make icons 44 pixels": the interactive area surrounding an icon must be large enough to tap comfortably. A visually small icon may exist inside a larger invisible or visible touch area.

Bad: a tiny icon with a 16 by 16 clickable region. Better: a 16 to 24px visual icon inside an approximately 44px comfortable tap region. Claude should distinguish between visual icon size and actual interactive touch area.

### 2.3 Full-page navigation as an alternative

Bottom navigation is not the only way to translate desktop navigation. Another option is transforming what would normally be a desktop sidebar into an entire mobile screen. Instead of a sidebar beside content, the mobile experience has a Navigation / Home screen followed by the Selected Destination.

This navigation screen can contain much more than simple links: recent notes at the top, then a workspace section with rows such as Notes (12), Projects (4), Templates, Archive (3), with counts or secondary information toward the right side of rows. This creates a functional mobile home/navigation screen rather than forcing a desktop sidebar onto a phone.

### 2.4 Reclaiming bottom screen space

If navigation does not require a traditional persistent bottom tab bar, that valuable area can be used for something more important: search, a major action, a prominent input, another frequently used control. Do not assume every mobile application requires the same navigation structure. Navigation should serve the application's priorities.

### 2.5 Top-bar actions

Mobile applications commonly contain actions in the upper-right area (notifications, overflow menu, more actions, contextual controls). These actions do not necessarily need to remain the same on every screen. Actions should respond to the current context. For example: Home shows Notifications and More; a document editor shows Share and More; template selection shows Close and Confirm.

The interface should not preserve controls simply because they existed on the previous screen. Controls should exist because they are relevant to the task the user is performing now. This becomes especially important in the section on dynamism.

---

## 3. SCALE

Video section: approximately 1:32.

One of the largest mistakes is assuming smaller screen means smaller everything. Mobile interfaces frequently use text as large as, or larger than, comparable desktop interfaces. The video compares iOS body text of 17 with macOS body text of 13. The lesson is that a smaller screen does not justify destroying readability.

### 3.1 Do not shrink the entire UI

When space becomes limited, do not solve the problem by reducing font size, button size, touch targets, padding, spacing, icon size or line height until everything technically fits. This creates a dense and uncomfortable interface. Instead, reduce the number of elements shown, the number of simultaneous actions, the number of visible navigation destinations, the number of columns, and the amount of secondary information.

Wrong strategy: desktop has 18px text, 48px buttons and comfortable spacing; mobile gets 11px text, 28px buttons and almost no spacing. Correct strategy: desktop shows lots of content simultaneously; mobile keeps comfortable type and controls and shows less content simultaneously.

### 3.2 Mobile design is an information-density problem

When space runs out, Claude should first ask: can something be removed, moved, collapsed, deferred, or placed on another screen? Only after that should minor dimensional adjustments be considered. The solution to mobile constraints is primarily hierarchy, not miniaturization.

---

## 4. CONTENT LAYOUT

Video section: approximately 2:13.

Desktop interfaces often expand simultaneously in two dimensions (a grid of cards in rows and columns). Mobile interfaces should usually simplify this.

### 4.1 Use one primary direction per content section

For mobile sections, choose primarily one direction: vertical (card, card, card) or horizontal (a row of cards continuing past the edge, revealed by swiping) rather than dense two-dimensional grids. When Claude encounters a desktop section of 3 columns by 3 rows, the first mobile solution should not be 3 tiny columns by 3 tiny rows. Consider a one-column vertical list or a horizontal carousel, depending on the content.

### 4.2 Do not mix scroll directions without purpose

For each section determine: does this content continue downward, or does it continue sideways? Do not create unnecessarily complex layouts that require users to visually process a miniature dashboard.

---

## 5. THE FOUR FUNDAMENTAL UI BUILDING BLOCKS

* **Cards** group related information and can contain other UI elements. Example: a card with "Project Alpha", "Due Friday", "6 tasks remaining".
* **Text and links** communicate information, move users between destinations or trigger actions. Text hierarchy should make it easy to distinguish primary information, secondary information, metadata, and action text.
* **Images** provide visual context. They should support the information hierarchy instead of becoming decoration that consumes scarce screen space without purpose.
* **Inputs** allow the user to provide information: search, text fields, forms, selectors, text areas. They may appear inside structured containers or as the primary focus of a screen.

---

## 6. CARDS SHOULD NOT CREATE UNNECESSARY NESTING

Avoid a card inside a card inside a card. Designers often use another card whenever they want to visually separate information. The video recommends using spacing instead. Instead of an outer card holding inner cards for the title and description, use one card with the title, the description, a divider, then secondary information. Whitespace itself can establish grouping. Not every grouping requires a background, border, rounded rectangle, shadow, or additional card.

### 6.1 Spacing is a design tool

Blank space is intentional and communicates relationships. Items positioned closely together appear related; larger spacing communicates separation. Use spacing before creating another visual container.

---

## 7. ONE SCREEN, ONE JOB

Video section: approximately 3:30. This is one of the most important principles in the video: one screen should have one primary job. The home screen can be somewhat broader because it often acts as an overview or starting point, but screens deeper in the application should become increasingly focused.

### 7.1 Settings example

If the user opens Settings, the purpose of that screen should primarily be "change settings". Do not unnecessarily mix in recent notes, recommendations, templates, unrelated statistics, promotional sections, or unrelated content. The user navigated there for a specific reason.

### 7.2 Editor example

If the user opens a note editor, the screen's primary responsibility becomes editing the note. Desktop might display Sidebar, Note Editor and Properties side by side. Mobile should not attempt a tiny sidebar, tiny editor and tiny properties panel. Instead: Notes List, then Note, then the Editing Experience. Additional functionality can appear when required.

### 7.3 Turn desktop panels into mobile screens

A desktop application may use simultaneous panels (sidebar, main content, inspector, properties, comments). On mobile, these can become different screens or temporary surfaces: Main Content to Properties, Main Content to Comments, Main Content to Share. Do not attempt to display everything simultaneously.

### 7.4 Depth replaces width

Desktop displays hierarchy spatially (left, center, right). Mobile often expresses the same hierarchy through navigation depth (screen, then screen, then screen). That is not a loss of functionality; it is a different organization model.

### 7.5 Focus increases as the user moves deeper

Home screens can be broad, destination screens narrower, task screens highly focused. Example: Home (many destinations), Projects (projects only), Project Details (one project), Edit Task (one task), Task Input (one specific operation). The deeper the user moves into a workflow, the fewer unrelated controls should remain visible.

---

## 8. REMOVE IRRELEVANT GLOBAL UI DURING FOCUSED TASKS

Persistent navigation is useful when navigating. It can become unnecessary during a highly focused operation. Normal application: Home, Search, Projects, Account. Opening a document may change the interface to Back and More with the document centered. Editing may produce Cancel and Save. The application does not need to permanently display global navigation during every possible task. This connects "one screen, one job" to the later concept of dynamic interfaces.

---

## 9. GESTURES

Video section: approximately 5:11. Touch allows designers to use gestures that desktop applications generally do not rely on to the same extent. These gestures can reveal functionality without permanently filling the interface with controls.

### 9.1 Swipe right to go back

The interface should react to the user's finger. The user should see the transition progress as they move their finger. The video shows the previous interface moving partially during the interaction (approximately a 35% movement relationship in the example). Treat this as an example animation behavior rather than a universal rule. The larger principle: gesture movement should create visual feedback. Do not wait until the gesture ends and suddenly replace the entire screen without visual connection. The movement helps users understand "I am returning to the previous layer."

### 9.2 Interactive transitions

Gestures should feel physically connected to the interface: the finger moves, the UI responds, a threshold is reached, the transition completes. If the user reverses direction or cancels the gesture, the interface should respond appropriately. The interface should feel manipulated rather than triggered by an invisible command.

### 9.3 Bottom sheets

A bottom sheet is a contextual surface that enters from the bottom edge of the display. The user can pull it. The background may subtly scale backward as the sheet moves forward, creating perceived depth: the sheet becomes the current layer while the underlying interface visually recedes. When the sheet is dismissed downward, the effect reverses. This communicates that the user temporarily moved into another interaction layer without completely leaving the underlying screen.

### 9.4 Bottom sheets are useful for contextual actions

They work well when an action belongs to the current screen but does not justify a completely separate permanent page: choose option, filter, sort, share, more actions, quick configuration. The lesson is about the interaction pattern rather than prescribing specific features.

### 9.5 Swipe-up interactions

The video references applications using upward gestures to reveal functions such as search (examples cited include Slack and Apple). Important secondary functionality can sometimes be accessed through natural mobile gestures rather than permanent controls. Claude should not interpret this as permission to hide every important function behind an invisible gesture. Use gestures when they fit established mobile patterns.

### 9.6 Long press

Long press is roughly the mobile equivalent of a desktop right-click. It can trigger additional commands, a contextual menu, a preview, an expanded item, or a temporary focus state. The video references iOS-style interactions where the background can become blurred or deemphasized while the selected content is brought forward.

### 9.7 Contextual previews

A long press does not have to reveal only a plain menu. In a normal list, the user long presses Item B, the background dims or blurs, Item B expands, and context actions appear. This allows access to secondary functions without permanently adding buttons to every row.

---

## 10. GESTURES REDUCE PERMANENT UI CLUTTER

Not every possible action needs a permanent visible button. A desktop environment may have space for Edit, Rename, Duplicate, Share, Archive, Delete, More. Mobile may expose the primary action visibly and the secondary actions through long press, swipe, or a contextual sheet. This keeps the default state cleaner.

---

## 11. DYNAMISM

Video section: approximately 6:02. The interface should dynamically change according to the user's current context. Controls, navigation, actions, and interface chrome do not need to remain identical throughout the application.

### 11.1 Controls should match the current task

Browsing notes: search, create, sort. Opening a specific note: edit, share, more. Editing the note: formatting, undo, done. The global controls should not remain simply because they were available one level earlier.

### 11.2 Navigation can disappear

Normal: Home, Notes, Search, Account. In the note editor: Back, Share, More. The bottom/global navigation may disappear. This increases focus and creates additional usable space.

### 11.3 Controls can be replaced rather than added

Do not continuously add more controls as the user goes deeper. Bad: global controls plus screen controls plus editing controls plus selection controls. Better: current-context controls only. The interface transforms.

### 11.4 Template-selection example

When selecting a template the controls can again become completely different: X on the left, Confirm on the right, then Template A, B, C. This screen does not necessarily need Home, Notifications, Account or global Search, because those controls have nothing to do with the current operation.

### 11.5 Animate state changes

Dynamic interfaces should not feel like disconnected images. Instead of a toolbar instantly disappearing and a new toolbar instantly appearing, use a subtle transition (fade, slide, scale, move, transform). The exact animation is less important than continuity. Animation should explain how the user moved from state A to state B.

### 11.6 Animation is communication

Animation should communicate navigation depth, hierarchy, where a panel came from, where it returned, what object became active, and which controls replaced others. It should support understanding, not decorate.

---

## 12. EMPTY STATES

Video section: approximately 6:27. A designer cannot assume that every screen already contains data. Empty states must be intentionally designed, especially because a new user's first experience may be an empty application.

### 12.1 Design the zero-content version

Designers often create "Notes: Meeting Notes, Shopping List, Project Plan, Vacation, Ideas" and forget to design "Notes: 0 notes". Every content-driven screen should be evaluated in at least two states: has content, and no content.

### 12.2 Empty states should guide the next action

A completely blank screen is rarely enough. An empty state should explain what the user should do next: "No notes yet. Create your first note to get started." with a prominent "+ Create Note" control. The user should not need to figure out why the page is empty.

### 12.3 Emphasize the primary creation action

If the user has no items yet, the control that creates the first item becomes extremely important. For example, the + button can be visually emphasized and the design should direct attention toward the first meaningful action.

### 12.4 First-time guidance

The video discusses a fuller empty state and potentially a short instructional popover. This guidance should be concise. The purpose is not to explain the entire application; it is to help the user complete their first meaningful action ("You don't have any notes yet. Tap + to create your first one.", with an arrow pointing at +).

---

## 13. DIFFERENT EMPTY STATES REPRESENT DIFFERENT PROBLEMS

There is a difference between a content empty state (the user has never created anything: 0 notes exist) and a search empty state (content exists, but nothing matches the current search: Search "abcdef", no matching notes). These situations require different messaging and actions.

### 13.1 First-time empty state

Goal: help the user create something. Structure: an illustration or visual, "No projects yet", "Create your first project to start organizing your work.", and a [Create Project] button.

### 13.2 Search-no-results state

Goal: help the user recover from an unsuccessful search. Structure: "No results", "We couldn't find anything matching 'abcdef.'", "Check the spelling or try another search.", and a [Clear Search] button. The video discusses acknowledging that no results were found, potentially using imagery, suggesting spelling correction, and providing a clear way out.

---

## 14. NEVER USE ONE GENERIC EMPTY STATE FOR EVERYTHING

Claude must determine why there is no content. Potential states: no items created, no search matches, no filtered matches, no internet, no permission, loading, error, archived collection empty. Do not display the same generic message for first-time and search-no-results states.

---

## 15. DESIGN RESEARCH AND MOBBIN

The video references Mobbin as a resource for researching existing interface patterns (examples referenced: Notion, Craft, Headspace). Instead of inventing every interaction from scratch, study existing patterns.

### 15.1 Research by problem

Instead of asking "What app should this look like?" ask "How do successful apps handle this interaction?" (filters, bottom sheets, first-time empty states, note creation, onboarding, contextual menus, mobile settings). Study the pattern rather than copying an entire application.

### 15.2 Research complete flows

Individual screenshots can be misleading because mobile UX depends heavily on what happens before and after a screen. Research screen A, interaction, screen B, interaction, screen C. Understanding flow is more useful than reproducing a beautiful isolated screenshot.

---

## 16. THE VIDEO'S MOBILE DESIGN MODEL

The concepts work together as one system: small screen, then do not shrink everything, then show less at once, then simplify navigation, then focus each screen, then move secondary content deeper, then use contextual controls, then use gestures where appropriate, then animate changes, then handle empty states intentionally.

---

## 17. DESKTOP-TO-MOBILE CONVERSION PROCEDURE

1. **Identify the desktop navigation.** Primary, secondary, utility, settings and account destinations. Do not copy the entire sidebar.
2. **Determine the mobile top-level navigation.** About 3 to 4 primary destinations when a bottom navigation is appropriate; about five is the upper limit. Move secondary destinations deeper into More, Profile, Settings, a Home/navigation screen, or contextual menus.
3. **Identify every desktop panel.** Ask whether each deserves its own screen, a bottom sheet, a contextual panel, a modal, or a temporary overlay. Do not compress all panels into one phone screen.
4. **Define each mobile screen's job.** Write one sentence: "The purpose of this screen is to ______." If it needs several unrelated verbs, the screen is overloaded (for example: select a client, view analytics, edit settings, manage invoices, and see notifications). Split the responsibilities.
5. **Reduce simultaneous information.** Preserve essential information; move secondary information deeper; do not simply shrink it.
6. **Choose content direction.** For each section choose a vertical stack or a horizontal scroll. Avoid miniature multi-column dashboards.
7. **Preserve comfortable scale.** Readable typography, useful spacing, comfortable touch targets, clear buttons, breathing room.
8. **Remove unnecessary container nesting.** For every card ask whether the content actually requires another card. If not, use spacing, typography, dividers, alignment.
9. **Identify contextual controls.** For every screen ask what actions matter here, show only those, and remove or replace irrelevant global controls.
10. **Identify useful gestures.** Swipe back, swipe up, long press, bottom-sheet dragging. Do not add gestures merely for novelty.
11. **Define transitions.** How screens enter and exit, how bottom sheets and menus appear, how context changes. Use motion to preserve spatial and conceptual continuity.
12. **Design empty states.** For every data-driven screen define the normal state, the first-time empty state, and the search-no-results state, plus other application-specific states.

---

## 18. CLAUDE DESIGN RULES

1. Do not shrink a desktop interface to create the mobile version. Reorganize it.
2. Reduce information density before reducing component size.
3. Prefer approximately 3 to 4 major bottom navigation destinations. Avoid exceeding approximately five.
4. Design touch controls for fingers, not mouse cursors. Maintain comfortable touch areas around interactive controls.
5. Do not assume a permanent bottom navigation is always required. A full-screen navigation/home experience may sometimes be more appropriate.
6. Use primarily one content direction per section: vertical or horizontal, rather than dense two-dimensional arrangements.
7. Use cards intentionally. Do not wrap every information group in another card.
8. Use spacing to create hierarchy. Whitespace is structural.
9. Each non-home screen should have one dominant responsibility.
10. Convert desktop panels into separate mobile states or screens instead of compressing them.
11. Allow global navigation to disappear during focused workflows.
12. Show controls relevant to the user's current task. Do not preserve irrelevant actions.
13. Replace controls as context changes rather than continuously adding more controls.
14. Use established touch gestures when they improve natural mobile interaction.
15. Make gesture interactions visually responsive to the user's movement.
16. Use bottom sheets for temporary contextual interactions where appropriate.
17. Treat long press as a useful method for exposing contextual actions or previews.
18. Use animation to explain state changes, hierarchy, and navigation. Do not use motion only as decoration.
19. Design first-time empty states intentionally.
20. Make the next action obvious when content is empty.
21. Do not confuse a first-time empty state with a search-no-results state.
22. When a search fails, provide recovery guidance.
23. Research established interface patterns instead of unnecessarily reinventing common mobile interactions.

---

## 19. MOBILE SCREEN AUDIT

When asked to review a mobile screen, evaluate it using these questions.

* **Navigation:** Can the user immediately understand where they are? Is global navigation actually necessary on this screen? Are too many destinations visible? Could secondary destinations move deeper?
* **Scale:** Is text comfortably readable? Are controls comfortable to tap? Was anything made unnecessarily small simply to fit more information?
* **Content:** Is this screen attempting to display too much simultaneously? Could secondary information be moved elsewhere? Is the screen trying to reproduce a desktop grid?
* **Direction:** Does each content section have a clear scrolling direction? Is the interface unnecessarily dense in both dimensions?
* **Hierarchy:** Is the most important information obvious? Are secondary details visually secondary? Is whitespace being used effectively?
* **Cards:** Are there unnecessary cards inside cards? Could spacing replace some containers?
* **Screen responsibility:** Can the screen's purpose be explained in one sentence? Is there one obvious primary job? Are unrelated workflows competing for attention?
* **Context:** Do the visible actions make sense for exactly what the user is doing? Are irrelevant global controls still visible? Could controls transform when the state changes?
* **Gestures:** Could a familiar mobile gesture simplify a secondary interaction? Does the UI visually respond during gestures?
* **Motion:** Do transitions explain where content comes from and where it goes? Is animation helping comprehension?
* **Empty states:** What happens when this screen contains zero items? What happens when search returns zero results? Does the user understand what to do next?

---

## 20. COMMON FAILURES ACCORDING TO THIS DESIGN PHILOSOPHY

* **Tiny desktop dashboard:** desktop UI scaled to 40 percent. Wrong approach.
* **Eight bottom tabs:** too many top-level destinations. Simplify the architecture.
* **Tiny text:** do not sacrifice readability because the device is smaller.
* **Tiny buttons:** do not design touch interaction as though users had mouse pointers.
* **Miniature multi-column layouts:** convert them into vertical stacks or intentional horizontal sections.
* **Everything on one screen:** separate tasks.
* **Cards inside cards inside cards:** use spacing and hierarchy.
* **Permanent global controls everywhere:** allow controls and navigation to adapt to the current task.
* **Every action permanently visible:** secondary contextual actions can be exposed through menus, gestures, sheets, or long press.
* **Motion with no meaning:** animation should communicate state or hierarchy.
* **Blank empty screen:** explain why nothing exists and show what to do.
* **Same empty state for every situation:** "no content exists" and "your search found nothing" are different states.

---

## 21. DESIGN PRIORITY ORDER FOR CLAUDE

When tradeoffs are necessary, prioritize in approximately this order:

1. Screen purpose
2. Information hierarchy
3. Navigation simplicity
4. Readability
5. Touch usability
6. Content organization
7. Contextual controls
8. Gestures
9. Motion
10. Decorative styling

Do not sacrifice the first items in order to make the last item more visually interesting.

---

## 22. HOW CLAUDE SHOULD THINK WHEN SPACE RUNS OUT

Never immediately answer "Make everything smaller." Use this sequence:

1. Can this element be removed? If no:
2. Can it move to another screen? If no:
3. Can it become contextual? If no:
4. Can it appear inside a sheet or menu? If no:
5. Can this information be summarized? If no:
6. Can the section scroll vertically or horizontally? If no:
7. Only then consider modest size adjustments.

---

## 23. SCREEN-STATE MODEL

Think of a mobile application as a collection of states rather than one giant interface. Example: HOME contains NOTES LIST (which contains NOTE VIEW, which contains NOTE EDIT, and CREATE NOTE), SEARCH (which contains SEARCH RESULTS), and SETTINGS. Each state can have its own navigation, actions, toolbar, layout, and gesture behavior. Do not force all states to use identical interface chrome.

---

## 24. CONTEXTUAL ACTION MODEL

For every screen define the primary action, secondary actions, contextual actions, and global actions, then question whether each deserves permanent visibility. Example, notes list: primary is Create note; secondary is Search; contextual are Rename, Archive, Delete; global is Account. The default interface does not need four permanent buttons for every contextual command.

---

## 25. MOBILE UI SHOULD REVEAL COMPLEXITY PROGRESSIVELY

The video does not advocate removing functionality. It advocates controlling when functionality becomes visible. Instead of everything all the time, use essential first, then more when needed, then detailed controls when relevant. This allows sophisticated applications to remain powerful without becoming visually overwhelming.

---

## 26. HOME SCREEN EXCEPTION

The home screen is somewhat different from "one screen, one job". It often naturally performs several related functions: orientation, navigation, recent activity, quick access. It may show more variety than deeper screens, but it should still remain organized and should not become an excuse to dump the entire application onto one screen.

---

## 27. DEEPER SCREENS SHOULD BECOME CLEANER

Home is broad, a category is focused, an item is more focused, an editor is highly focused. The user should encounter fewer unrelated distractions as they move deeper into a workflow.

---

## 28. DESIGN MOBILE AROUND HUMAN HANDS

Desktop interfaces are designed around pointer, keyboard, large screen and precision. Mobile interfaces are designed around fingers, touch, small screen, movement and gestures. Mobile controls should feel physically usable. Do not create precision-dependent targets.

---

## 29. DESIGN MOBILE AROUND TEMPORARY ATTENTION

Users frequently enter a mobile application to accomplish something specific, so the interface should make that immediate task obvious. When the user enters an editor, editing should dominate. When the user enters search, searching should dominate. When the user enters settings, settings should dominate.

---

## 30. FINAL MOBILE DESIGN PHILOSOPHY

Do not compress the desktop experience; reinterpret it for mobile. That means: fewer permanent navigation choices; fewer simultaneous content areas; comfortable text and controls; one primary purpose per screen; one clear directional flow per section; less card nesting; more intentional spacing; context-dependent controls; natural touch gestures; motion that explains transitions; purpose-built empty states; research grounded in successful mobile patterns.

---

## 31. MASTER INSTRUCTION FOR CLAUDE

When creating or redesigning a mobile application, treat mobile as its own interaction environment rather than a reduced desktop layout. Preserve functionality, but reorganize when and where that functionality appears. Do not attempt to show every desktop control simultaneously. Identify the user's immediate task and make that task dominate the screen.

Keep typography readable and touch targets comfortable even though screen space is limited. Solve space constraints through hierarchy, navigation, progressive disclosure, separate screens, contextual actions, bottom sheets, gestures, and scrolling before reducing component sizes.

Keep primary mobile navigation focused on a small number of major destinations. Turn complex desktop sidebars and multi-panel layouts into mobile navigation flows. Use vertical stacks or intentional horizontal sections instead of miniature desktop grids. Use cards only when they meaningfully group content; prefer whitespace and typography over unnecessary containers. Aim for one major job per non-home screen. As users move deeper into workflows, remove unrelated interface elements and make the experience increasingly focused.

Allow navigation and controls to transform according to context. Use familiar mobile gestures such as swipe navigation, draggable sheets, and long press when appropriate, and make gesture-based transitions visually responsive. Use motion to explain relationships between interface states. Design every important content screen for both populated and empty conditions, treat first-time empty states and search-no-results states as different UX problems, and make the user's next action obvious. Study established application patterns when solving common interface problems instead of inventing unfamiliar behavior without reason.

The final interface should never feel like a desktop application squeezed onto a phone. It should feel like the product was conceived for touch, limited screen space, focused tasks, and mobile interaction from the beginning.

---

## 32. FINAL TEST

Before approving a mobile interface, ask:

* If I removed the visual styling entirely, would the structure still make sense?
* Can I explain this screen's purpose immediately?
* Is the main action obvious?
* Is anything here only because it existed on desktop?
* Is anything unnecessarily tiny?
* Am I displaying information that could wait?
* Does every permanent control deserve permanent visibility?
* Could spacing replace some of these containers?
* Does each section have a clear content direction?
* Do the controls match the current context?
* Are deeper workflows more focused than higher-level screens?
* Does touch interaction feel natural?
* Do transitions explain what is happening?
* What does this screen look like with zero data?
* What happens when a search returns nothing?
* Does the user always know what they can do next?

If the answers are strong, the interface is much closer to the mobile design philosophy taught throughout the video.
