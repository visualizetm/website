/* Every empty state, error state, and shell message in one table (Prompt 14).
 * Screens read these; nothing types "No data". Each empty entry says what will
 * appear here and how to make it happen, in Rob's voice, with one action.
 *
 *   import { COPY } from '../shared/copy';
 *   <EmptyState icon="Users01" title={COPY.empty.leads.title} description={COPY.empty.leads.description} action={{ label: COPY.empty.leads.action, onClick }} />
 *   <ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={onRetry} />
 *
 * Keys are screen.state. `action` is the one primary action's label;
 * `secondary` a link-style second choice where the screen offers one.
 */
export const COPY = {
  empty: {
    /* Dashboard */
    'dashboard.today': { title: 'All caught up', description: 'No callbacks, meetings, or new leads waiting. Start a call session.', action: 'Start call session' },
    'dashboard.activity': { title: 'Nothing yet', description: 'Calls, briefs, wins, and orders show up here the moment they land.', action: 'Start call session' },
    /* Content Planner (planner prompt 2) */
    'planner.month': { title: 'No posts for this month yet', description: 'Add the first one, or copy last month across and edit from there.', action: 'Add post' },
    'planner.off': { title: 'The planner is off for this client', description: 'Turn it on above and they get a private link to read captions, approve posts, and ask for changes.', action: 'Turn it on' },
    /* Leads */
    'leads.none': { title: 'No open leads', description: 'Add one, import a spreadsheet, or check Booked and Clients. Everyone might just be further down the pipeline.', action: 'Add lead', secondary: 'Import spreadsheet' },
    'leads.filter': { title: 'Nothing matches', description: 'Loosen a filter or clear the search.', action: 'Clear all' },
    'leads.dupes': { title: 'No duplicates found', description: 'No two leads share a phone number or a business name in the same industry.', action: 'Back to all leads' },
    'leads.column': { title: 'Nothing waiting here', description: 'Leads land in this column as their status changes.' },
    'leads.detail.pricing': { title: 'No pricing options yet', description: 'Build up to three from the packages. Anything over $750 shows its payment plan.', action: 'Add option' },
    'leads.detail.concepts': { title: 'No concepts tracked', description: 'Add the usual five before the meeting so the tracker fills as they get made.', action: 'Add the usual five' },
    'leads.detail.script': { title: 'No script yet', description: 'Add the opener, value, and ask on the lead.' },
    'leads.detail.objections': { title: 'No objections listed', description: 'Return to the ask after every one.' },
    'leads.detail.close': { title: 'No close lines yet', description: 'Lock it, if no, and no answer lines live here.' },
    'leads.detail.intel': { title: 'No intel yet', description: 'The nightly scan fills this in when it finds something.' },
    'leads.detail.history': { title: 'No calls yet', description: 'The first outcome you log lands here.' },
    'leads.detail.submissions': { title: 'No site submissions from them yet', description: 'When one matches their email, phone, or business name it shows up here to link.' },
    'leads.picker': { title: 'No match', description: 'Try the business name or a phone number.' },
    /* Call Console */
    'calls.builder': { title: 'No leads to dial', description: 'Add leads on the Leads page or import the notepads.', action: 'Import the notepads', secondary: 'Add a lead' },
    'calls.room': { title: 'Nothing left in this session', description: 'Every lead in this block has an outcome.', action: 'See the summary' },
    /* Booked */
    'booked.none': { title: 'No booked leads yet', description: 'Book one from the Call Console. A booked outcome lands it here for meeting prep.', action: 'Open Call Console' },
    'booked.filter': { title: 'Nothing booked in this filter', description: 'Every booked lead is under All.', action: 'Show all' },
    /* Calendar */
    'calendar.day': { title: 'Nothing scheduled', description: 'A clear day. Book something or set a callback.', action: 'Start call session', secondary: 'Add a callback' },
    'calendar.range': { title: 'Nothing on the calendar', description: 'Meetings, callbacks, and Calendly bookings all land here.', action: 'Start call session' },
    /* Clients */
    'clients.none': { title: 'No clients yet', description: 'Win a booked meeting, or add a walk in with the button above.', action: 'Open Booked' },
    'clients.filter': { title: 'No clients in this filter', description: 'Every client is under All.', action: 'Show all' },
    'clients.projects': { title: 'No projects yet', description: 'Start one from a package, an add-on set, or a custom total. The payment schedule fills itself in.', action: 'New project' },
    'clients.payments': { title: 'No project to bill', description: 'Create a project and its schedule shows up here.', action: 'New project' },
    'clients.schedule': { title: 'No schedule', description: 'This project has no payment lines.' },
    'clients.ledger': { title: 'Nothing paid yet', description: 'The first payment you record lands here, with the Stripe ones that match on their own.', action: 'Add manual payment' },
    'clients.retainer': { title: 'No retainer yet', description: 'Site Care for web work, Content Kit for everything else. Pitch it with the delivery.', action: 'Start a retainer' },
    'clients.retainer.cancelled': { title: 'Retainer cancelled', description: 'Start a new one when they are ready.', action: 'Start a retainer' },
    'clients.deliverables': { title: 'No deliverables listed', description: 'Prefill the Drive structure for this kind of project.', action: 'Add the usual set' },
    'clients.deliverables.noproject': { title: 'Nothing to deliver yet', description: 'Deliverables follow the project. Create one first.', action: 'New project' },
    /* Print Orders */
    'orders.none': { title: 'No print orders yet', description: 'Shop orders land here on their own. Walk ins and client jobs start with New order.', action: 'New order' },
    'orders.filter': { title: 'No orders in this filter', description: 'Every order is under All.', action: 'Show all' },
    'orders.items': { title: 'No items yet', description: 'Add a product line so the order has a subtotal and a due date.', action: 'Add item' },
    'orders.import.device': { title: 'Nothing saved on this device', description: 'The old print dashboard left no orders in this browser.' },
    'orders.import.csv': { title: 'Nothing to import yet', description: 'Add a header row and at least one order row.' },
    /* Concepts */
    'concepts.none': { title: 'No packs yet', description: 'A pack is a set of prompts and image links for one kind of concept. Start with the logo directions.', action: 'New pack' },
    'concepts.filter': { title: 'No packs in this filter', description: 'Every pack is under All.', action: 'Show all' },
    'concepts.prompts': { title: 'No prompts yet', description: 'The first prompt is the one you paste into ChatGPT before the meeting.', action: 'Add prompt' },
    'concepts.images': { title: 'No image links yet', description: 'Paste Drive or hosted links; images show as thumbnails on the card.', action: 'Add image link' },
    'concepts.picker': { title: 'No pack matches', description: 'Build one in Concepts first.' },
    /* Reviews */
    'reviews.none': { title: 'No clients yet', description: 'Reviews track per client. Win a booked meeting or add a client first.', action: 'Open Clients' },
    'reviews.filter': { title: 'No clients in this filter', description: 'Every client is under All.', action: 'Show all' },
    'reviews.forms': { title: 'Nothing from the website review form yet', description: 'When the site posts a review submission, it lands here to link.' },
    /* Landing */
    'landing.logostrip': { title: 'No logos on the strip', description: 'Turn on "Show in logo strip" on a client\'s Showcase tab and it lands here to order.' },
    'landing.work': { title: 'No featured work yet', description: 'Turn on "Feature in work" on a client\'s Showcase tab and it lands here to order. Nothing featured shows the newest published clients instead.' },
    'landing.testimonials': { title: 'No featured testimonials yet', description: 'Publish and feature a testimonial on a client\'s Showcase tab and it lands here to order.' },
    /* Submissions */
    'submissions.none': { title: 'No submissions yet', description: 'Briefs and contact forms from the website land here the moment they are sent.', action: 'Open the site form' },
    'submissions.filter': { title: 'No submissions in this filter', description: 'Every submission is under All.', action: 'Show all' },
    'submissions.fields': { title: 'No answers on this one', description: 'This submission carries only the contact details above.' },
    /* Settings */
    'settings.deleted': { title: 'Nothing in the bin', description: 'Deleted leads and submissions wait here for 30 days, then purge on their own.' },
    'settings.reconcile': { title: 'Nothing to reconcile', description: 'Every payment the webhook stored matched a client.' },
    /* Shell */
    'notifications.none': { title: 'All caught up', description: 'Nothing due, nothing new. Start a call session.', action: 'Open Call Console' },
  },
  error: {
    posts: { title: 'The planner did not load', description: 'The posts for this client could not be fetched. Try again.', action: 'Try again' },
    generic: { title: 'Could not load this', description: 'Check the connection and try again.' },
    leads: { title: 'Could not load your leads', description: 'The call_leads list did not come back. Try again; nothing was changed.' },
    submissions: { title: 'Could not load submissions', description: 'The website submissions did not come back. Try again.' },
    orders: { title: 'Could not load print orders', description: 'The orders list did not come back. Try again.' },
    packs: { title: 'Could not load the concept library', description: 'The packs did not come back. Try again.' },
    projects: { title: 'Could not load client projects', description: 'The projects did not come back, so payments and retainers are missing. Try again.' },
    settings: { title: 'Could not load settings', description: 'The settings document did not come back. Try again.' },
    calendar: { title: 'Could not load the calendar', description: 'Meetings and callbacks come from your leads, and those did not load. Try again.' },
    notifications: { title: 'Could not load notifications', description: 'They come from your leads, and those did not load. Try again.' },
    calls: { title: 'Could not load the console', description: 'The leads for this session did not come back. Try again.' },
    /* Writes */
    save: 'Could not save. Your change was undone.',
    saveOffline: 'You are offline. That change was not saved; try again once you are back.',
    del: 'Delete failed. Nothing was removed.',
    create: 'Could not create that. Nothing was saved.',
    restore: 'Could not restore that.',
    copy: 'Could not copy.',
  },
  offline: {
    banner: 'You are offline. Reading is fine; changes wait until you are back.',
    toast: 'You are offline. That change was not saved.',
    back: 'Back online.',
  },
  success: {
    targetHit: 'Target hit. Nice.',
  },
  /* The client facing Content Planner (planner prompt 3). This is the only
   * block here written to a business owner rather than to Rob, so it stays
   * plain: no CRM words, no jargon, and nothing that assumes they know how
   * any of this works. */
  planner: {
    dead: {
      title: 'This link is not active',
      body: 'Check with Rob for a current one.',
      email: 'contact@visualizeclients.com',
    },
    heading: 'Content planner',
    waiting: (n) => `${n} post${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} your approval.`,
    nothingWaiting: 'Nothing needs your approval right now.',
    planned: (n) => `${n} post${n === 1 ? '' : 's'} planned this month.`,
    progress: (done, of) => `${done} of ${of} posts ready`,
    emptyMonth: 'Nothing planned for this month yet.',
    emptyMonthSub: 'Check back, or look at another month.',
    views: { calendar: 'Calendar', list: 'List' },
    legend: [
      { id: 'making', label: 'Being made', text: 'Rob is working on it. Nothing for you to do.' },
      { id: 'review', label: 'Needs your approval', text: 'Read it and approve, or ask for a change.' },
      { id: 'approved', label: 'Approved and scheduled', text: 'You said yes. It goes out on its date.' },
      { id: 'posted', label: 'Posted', text: 'It is live.' },
    ],
    detail: {
      caption: 'Caption',
      copy: 'Copy caption',
      copyCaptionOnly: 'Caption only',
      copied: 'Caption copied.',
      fromRob: 'From Rob',
      yourNote: 'What you asked for',
      approve: 'Approve',
      change: 'Ask for a change',
      close: 'Close',
      changeLabel: 'What should change?',
      changeHint: 'Tell Rob what to fix and he will redo it.',
      send: 'Send',
      sending: 'Sending',
      needNote: 'Add a line about what to change and Rob will redo it.',
      states: {
        making: 'Rob is working on this one. You will get it here when it is ready.',
        approved: 'You approved this. It goes out on its date.',
        posted: 'This one is already live.',
      },
    },
    toast: {
      approved: 'Approved. Rob will schedule it.',
      changeSent: 'Sent. Rob will redo it.',
      stale: 'That post is not waiting for approval any more.',
      tooMany: 'That is a lot of changes at once. Give it a few minutes.',
      failed: 'That did not send. Try again in a moment.',
    },
    error: {
      title: 'The planner did not load',
      body: 'Something went wrong on the way. Try again.',
      retry: 'Try again',
    },
  },
};

/** Convenience: the empty entry for a key, with a fallback so a typo never renders blank. */
export const emptyCopy = (key) => COPY.empty[key] || { title: 'Nothing here yet', description: '' };
export const errorCopy = (key) => COPY.error[key] || COPY.error.generic;
