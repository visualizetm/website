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
    /* Next up (the first screen) */
    'dashboard.next': { title: 'Nothing next', description: 'No callbacks, meetings, invoices or reviews waiting. Start a call session.', action: 'Start call session' },
    'dashboard.today': { title: 'All caught up', description: 'No callbacks, meetings, or new leads waiting. Start a call session.', action: 'Start call session' },
    'dashboard.activity': { title: 'Nothing yet', description: 'Calls, briefs, wins, and orders show up here the moment they land.', action: 'Start call session' },
    /* Content Planner (planner prompt 2) */
    'planner.month': { title: 'No posts for this month yet', description: 'Add the first one, or copy last month across and edit from there.', action: 'Add post' },
    'planner.off': { title: 'The planner is off for this client', description: 'Turn it on above and they get a private link to read captions, approve posts, and ask for changes.', action: 'Turn it on' },
    /* Leads */
    'leads.none': { title: 'No open leads', description: 'Add one, import a spreadsheet, or check Booked and Clients. Everyone might just be further down the pipeline.', action: 'Add lead', secondary: 'Import spreadsheet' },
    'leads.filter': { title: 'Nothing matches', description: 'Loosen a filter or clear the search.', action: 'Clear all' },
    /* Dial lists (CRM revamp, step 3) */
    'lists.none': { title: 'No lists yet', description: 'Build one from the leads you want to call this week, then start when it is full.', action: 'New list' },
    'lists.empty': { title: 'Nothing on this list', description: 'Add leads from their cards, or fill it from the filters.', action: 'Fill from filters' },
    'lists.picker': { title: 'No open lists', description: 'Make one below and this lead goes on it.' },
    'calls.lists': { title: 'No lists to run', description: 'Build a list on Lists, or run a quick session from the filters.', action: 'Quick session' },
    'leads.declined': { title: 'Nothing declined', description: 'Decline a lead from its menu when it is not worth a call. It lands here with the reason, and Bring back returns it to triage.' },
    'leads.nurture': { title: 'Nobody in nurture', description: 'A lead that is not ready now sits here until its day comes or you bring it back to triage.' },
    /* Triage (CRM revamp, step 4) */
    'triage.none': { title: 'Triage is clear', description: 'New leads from the scraper, the site and imports land here. Capture one from the plus button.', action: 'Capture a lead' },
    'leads.dupes': { title: 'No duplicates found', description: 'No two leads share a phone number or a business name in the same industry.', action: 'Back to all leads' },
    'leads.column': { title: 'Nothing waiting here', description: 'Leads land in this column as their status changes.' },
    'leads.detail.pricing': { title: 'No pricing options yet', description: 'Build up to three from the packages. Anything over $750 shows its payment plan.', action: 'Add option' },
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
    /* Projects (CRM revamp, step 7) */
    'projects.none': { title: 'No projects yet', description: 'A project starts when a deal is paid, or from a client record. It lands here with its next action and its next invoice.', action: 'Open Clients' },
    /* Deals (CRM revamp, step 5) */
    'deals.none': { title: 'No deals yet', description: 'Book a meeting from the Call Console and it lands here. The checkpoints carry it from the call to the first payment.', action: 'Open Call Console' },
    'deals.column': { title: 'Nothing here', description: 'A deal moves into this column when its checkpoint ticks.' },
    'deals.invoices': { title: 'No invoices yet', description: 'Add the first one from the package or the plan. Mark paid on it makes the client and the project.', action: 'Add invoice' },
    'booked.none': { title: 'No booked leads yet', description: 'Book one from the Call Console. A booked outcome lands it here for meeting prep.', action: 'Open Call Console' },
    'booked.filter': { title: 'Nothing booked in this filter', description: 'Every booked lead is under All.', action: 'Show all' },
    /* Calendar */
    'calendar.day': { title: 'Nothing scheduled', description: 'A clear day. Book something or set a callback.', action: 'Start call session', secondary: 'Add a callback' },
    'calendar.range': { title: 'Nothing on the calendar', description: 'Meetings, callbacks, and Calendly bookings all land here.', action: 'Start call session' },
    /* Clients */
    'clients.none': { title: 'No clients yet', description: 'Win a booked meeting, or add a walk in with the button above.', action: 'Open Deals' },
    'clients.filter': { title: 'No clients in this filter', description: 'Every client is under All.', action: 'Show all' },
    'clients.projects': { title: 'No projects yet', description: 'Start one from a package, an add-on set, or a custom total. The payment schedule fills itself in.', action: 'New project' },
    'clients.payments': { title: 'No project to bill', description: 'Create a project and its schedule shows up here.', action: 'New project' },
    'clients.schedule': { title: 'No invoices', description: 'This project has no invoice lines. Add one.' , action: 'Add invoice' },
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
    /* Concepts, rebuilt as a client presentation (docs/CONCEPTS-AUDIT.md). */
    'concepts.none': { title: 'No concepts out right now', description: 'Build one from a lead: open the record and tap Concepts.', action: 'Open Leads' },
    'concepts.filter': { title: 'Nothing in this status', description: 'Every set is under All.', action: 'Show all' },
    'concepts.lead': { title: 'No concepts for this record yet', description: 'Start a set, add a direction or three with images, and send them the link.', action: 'Start a set' },
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
    lists: { title: 'The lists did not load', description: 'The dial lists could not be fetched. Try again.', action: 'Try again' },
    sets: { title: 'The concepts did not load', description: 'The concept sets could not be fetched. Try again.', action: 'Try again' },
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
    heading: 'Your planner',
    tabs: { home: 'Home', posts: 'Posts', ads: 'Ads', ideas: 'Ideas' },
    /* Home. The strip is the one accent on the screen: it says how many things
       wait for them, or that nothing does. */
    needs: (n) => (n === 1 ? '1 thing needs you.' : `${n} things need you.`),
    caughtUp: 'You are all caught up.',
    review: 'Have a look',
    suggest: 'Suggest an idea',
    progress: (done, of) => `${done} of ${of} ready`,
    progressMonth: (month) => `${month}`,
    comingUp: 'Coming up',
    nothingComing: 'Nothing is planned yet. I will fill this in.',
    how: {
      title: 'How this works',
      lines: [
        'I make your posts and ads. They land here.',
        'When one needs your yes, it says Needs you. Approve it or ask me for a change.',
        'You post the posts. I run the ads for you.',
        'Got an idea? Tell me under Ideas and I will make it.',
      ],
      close: 'Got it',
      open: 'How this works',
    },
    /* Kinds and their helper lines: who does what with it. */
    kinds: { post: 'Post', ad: 'Ad', video: 'Video' },
    kindHelp: { post: 'You post this', ad: 'I run this for you' },
    /* Statuses in the client's words, one list per kind. "Needs you" is the
       only accent besides Live. */
    status: {
      post: { making: 'Making', review: 'Needs you', approved: 'Approved', posted: 'Posted' },
      ad: { making: 'Planned', review: 'Needs you', approved: 'Approved', live: 'Live', finished: 'Finished' },
    },
    /* The line under a settled item, when there is nothing left to press. */
    settled: {
      post: {
        making: 'I am working on this one. It lands here when it is ready for you.',
        approved: 'You approved this. Post it on its date.',
        posted: 'This one is up.',
      },
      ad: {
        making: 'I am building this ad. It lands here when it is ready for you.',
        approved: 'You approved this. I start it on its date.',
        live: 'This ad is running now.',
        finished: 'This ad has finished.',
      },
    },
    views: { calendar: 'Calendar', list: 'List' },
    /* Empty states. First time: nothing at all yet. This month: they are
       looking at a month with nothing in it. */
    empty: {
      postsFirst: { title: 'Your first posts are on the way', body: 'I am making them now. They land here when they are ready for you.' },
      postsMonth: { title: 'No posts this month', body: 'Look at another month, or ask me for one under Ideas.' },
      adsFirst: { title: 'No ads yet', body: 'When I plan one for you it shows here: what it says, who sees it and how it did.' },
      adsMonth: { title: 'No ads this month', body: 'Look at another month, or ask me for one under Ideas.' },
      ideasFirst: { title: 'Tell me what you want next', body: 'A post, an ad or a video. I read every idea and tell you here what happened to it.' },
    },
    detail: {
      when: 'When to post',
      where: 'Where',
      caption: 'Caption',
      hashtags: 'Hashtags',
      copy: 'Copy',
      copied: 'Copied',
      fromRob: 'From Rob',
      yourNote: 'What you asked for',
      approve: 'Approve',
      change: 'Ask for a change',
      close: 'Close',
      changeLabel: 'What should change?',
      changePlaceholder: 'Swap the photo, change the date, fix a word',
      changeHint: 'Tell me what to fix and I will redo it.',
      send: 'Send',
      sending: 'Sending',
      needNote: 'Add a line about what to change and I will redo it.',
      saving: 'Saving',
      saved: 'Saved.',
      hold: 'Press and hold the picture, then Save to Photos.',
      holdVideo: 'Press and hold the video, then Save.',
      openFile: 'Open the file instead',
      imageSoon: 'Picture coming',
      imageBroken: 'The picture did not load',
      videoSoon: 'Video coming soon',
      concept: 'The idea',
      length: (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} sec` : ''}`.trim() : `${s} sec`),
    },
    ad: {
      says: 'What it says',
      sees: 'Who sees it',
      shows: 'Where it shows',
      runs: 'When it runs',
      cost: 'Cost',
      results: 'Results',
      button: 'Button',
      goal: 'The goal',
      range: (a, b) => (a && b ? `${a} to ${b}` : a || b || 'Dates to come'),
      budget: (n) => `$${Number(n).toLocaleString()} in total`,
      spend: (n) => `$${Number(n).toLocaleString()} spent so far`,
      reach: (n) => `${Number(n).toLocaleString()} people reached`,
      clicks: (n) => `${Number(n).toLocaleString()} click${n === 1 ? '' : 's'}`,
      messages: (n) => `${Number(n).toLocaleString()} message${n === 1 ? '' : 's'}`,
      noResultsYet: 'Results show here once it has run.',
    },
    ideas: {
      title: 'Ideas',
      lead: 'Tell me what you want next and I will make it.',
      suggest: 'Suggest an idea',
      note: 'From Rob',
      sheet: {
        title: 'Suggest an idea',
        kind: 'What kind of thing?',
        subject: 'What is it about?',
        subjectPlaceholder: 'Our new Friday special',
        goal: 'What should it do?',
        details: 'Anything else I should know?',
        detailsPlaceholder: 'The offer, the day, who is in it',
        date: 'When should it go out?',
        optional: 'Optional',
        link: 'A link that helps',
        linkPlaceholder: 'https://',
        photos: 'Add photos',
        photosHint: 'Up to 3 pictures.',
        addLink: 'Add a link instead',
        uploadFailed: 'That picture did not upload.',
        send: 'Send it to Rob',
        sending: 'Sending',
        sent: 'Got it. I will read it and tell you here what happens next.',
        needSubject: 'Say what it is about and I can make it.',
        tooMany: 'That is a lot of ideas at once. Give it a moment.',
      },
    },
    toast: {
      approved: 'Approved. I will take it from here.',
      changeSent: 'Sent. I will redo it.',
      stale: 'That one is not waiting on you any more.',
      tooMany: 'That is a lot of changes at once. Give it a few minutes.',
      failed: 'That did not send. Try again in a moment.',
      saved: 'Saved.',
      downloaded: 'Downloading.',
      ideaSent: 'Sent. I will tell you here what happens next.',
    },
    error: {
      title: 'The planner did not load',
      body: 'Something went wrong on the way. Try again.',
      retry: 'Try again',
    },
  },
  /* Concepts (the client presentation and its editor). The public page's
   * strings are written to a business owner who is not a designer. */
  concepts: {
    dead: {
      title: 'This link is not active',
      body: 'Check with Rob for a current one.',
      email: 'contact@visualizeclients.com',
    },
    intro: {
      heading: (client) => `Concepts for ${client}`,
      hint: 'Scroll through each direction. Pick the one that feels like you, or tell me what to change.',
      round: (n) => `Round ${n}`,
    },
    direction: {
      label: (letter, of) => `Direction ${letter} of ${of}`,
      item: (n, of) => `${n} of ${of}`,
      approve: 'This is the one',
      change: 'Changes on this one',
      picked: 'You picked this one',
    },
    compare: { heading: 'Side by side', hint: 'Every direction at a glance. Tap one to see it big again.' },
    approve: {
      heading: (letter) => `Direction ${letter} it is?`,
      body: 'Rob starts on it from here. You can still send notes after.',
      name: 'Your name',
      note: 'Anything to add (optional)',
      confirm: 'Approve this direction',
      cancel: 'Not yet',
      done: (letter) => `You picked Direction ${letter}. Rob will take it from here.`,
    },
    changes: {
      heading: (letter) => `What should change on Direction ${letter}?`,
      body: 'Be as plain as you like. "Bigger", "less red", "closer to the second one" all work.',
      note: 'What to change',
      name: 'Your name',
      send: 'Send to Rob',
      cancel: 'Never mind',
      sent: 'Sent. Rob will work on it.',
      required: 'Say what should change first.',
    },
    feedback: {
      heading: 'Anything else I should know?',
      note: 'A note for Rob',
      name: 'Your name',
      send: 'Send',
      sent: 'Sent. Rob will read it.',
      afterApproval: 'You have picked a direction. Notes still reach Rob.',
    },
    viewer: { close: 'Close', prev: 'Previous image', next: 'Next image' },
    toast: {
      decided: 'This set is already decided.',
      tooMany: 'That is a lot at once. Give it a few minutes.',
      failed: 'That did not send. Try again in a moment.',
    },
    editor: {
      noImages: 'No images yet. Add a few, or paste a link.',
      sendHelp: 'Sending makes their link work and stamps the time. Until then nothing is visible to them.',
      sent: 'Sent. Their link works now; text it to them.',
      textIt: 'Text this to them. It opens their concepts, no password and no account.',
      previewDraft: 'Send it first. A draft never opens on the public site.',
      feedbackDraft: 'Nothing yet. Feedback arrives here once they open the link.',
      feedbackNone: 'Nothing yet. They have not answered.',
    },
  },
};

/** Convenience: the empty entry for a key, with a fallback so a typo never renders blank. */
export const emptyCopy = (key) => COPY.empty[key] || { title: 'Nothing here yet', description: '' };
export const errorCopy = (key) => COPY.error[key] || COPY.error.generic;
