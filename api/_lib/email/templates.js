/* Server mirror of src/shared/emailTemplates.js (the email system): the same data and rules, self contained because
 * a serverless function cannot import src/. Keep everything below this header identical; scripts/email-test.mjs
 * asserts it. */
export const TEMPLATE_GROUPS = [
  { id: 'lead', label: 'Lead' }, { id: 'deal', label: 'Deal' }, { id: 'client', label: 'Client' }, { id: 'project', label: 'Project' }, { id: 'any', label: 'Any' },
];
export const AUTOMATION_OPTIONS = [{ id: 'off', label: 'Off' }, { id: 'draft', label: 'Draft for me' }, { id: 'send', label: 'Send for me' }];
export const SERVICE_IDS = ['brand', 'web', 'combined', 'general'];

const T = (text) => ({ type: 'text', text });
const H = (text) => ({ type: 'heading', text });
const E = (text) => ({ type: 'eyebrow', text });
const B = (label, url, style = 'primary') => ({ type: 'button', label, url, style });

export const EMAIL_TEMPLATES = [
  {
    id: 'intro_call', name: 'Intro call', group: 'lead', class: 'marketing', when: 'After a yes on the phone or in the DMs', checkpoint: 'introSent', stamp: 'intro', autoDefault: 'off', needs: ['calendlyLink'],
    subject: 'Good talking to you, {{firstName}}', preheader: 'Grab a time and I will walk you through some ideas.',
    blocks: [E('Next step'), H('Good talking to you, {{firstName}}'), T("Here's my calendar. Pick whatever works and I'll come with a few ideas for {{business}} ready to show you."), B('Book the call', '{{calendlyLink}}'), T('Any questions before then, just reply here.')],
  },
  {
    id: 'onboarding', name: 'Onboarding', group: 'deal', class: 'transactional', when: 'After the call, once they are in', checkpoint: 'onboardingSent', stamp: 'onboarding', autoDefault: 'off', needs: ['startFormLink', 'package.name'],
    subject: "Let's get {{business}} started", preheader: 'Three things and I get to work.',
    variants: {
      brand: [E('Welcome'), H("Let's get {{business}} started"), T("Good call. Here's the recap: **{{package.name}}** for {{package.price}}, which gets you:"), { type: 'list', from: 'package.includes' }, T("Next up, three things: the form so I know your story, the contract to sign, and the deposit that starts the clock. Then I'm sketching."), B('Fill out the form', '{{startFormLink}}')],
      web: [E('Welcome'), H("Let's get {{business}} started"), T("Good call. Here's the recap: **{{package.name}}** for {{package.price}}, which gets you:"), { type: 'list', from: 'package.includes' }, T("Next up, three things: the form so I know what the site has to do, the contract to sign, and the deposit that starts the build. Then I'm building."), B('Fill out the form', '{{startFormLink}}')],
      combined: [E('Welcome'), H("Let's get {{business}} started"), T("Good call. Here's the recap: **{{package.name}}**, {{package.price}}, which gets you:"), { type: 'list', from: 'package.includes' }, T("Next up, three things: the form so I know your story and what the site has to do, the contract to sign, and the first payment that starts the project. Then I'm on it."), B('Fill out the form', '{{startFormLink}}')],
      general: [E('Welcome'), H("Let's get {{business}} started"), T("Good call. Next up, three things: the form so I know your story, the contract to sign, and the deposit that starts the clock. Then I'm on it."), B('Fill out the form', '{{startFormLink}}')],
    },
    blocks: [],
  },
  {
    id: 'invoice', name: 'Invoice', group: 'deal', class: 'transactional', when: 'A deposit, a plan payment, a final or a retainer month', checkpoint: 'invoiceSent', stamp: 'invoice', autoDefault: 'off', needs: ['invoice.number', 'invoice.dueNow', 'invoice.dueDate'],
    subject: 'Invoice {{invoice.number}} for {{business}}', preheader: '{{invoice.dueNow}} due {{invoice.dueDate}}.',
    blocks: [E('Invoice {{invoice.number}}'), H("Here's your invoice, {{firstName}}"), T('{{invoice.covers}}'), { type: 'lines', from: 'invoice.items' }, { type: 'totals', from: 'invoice.totals' }, T('**Due {{invoice.dueDate}}.** {{invoice.leftLine}}'), { type: 'pay', from: 'invoice.pay' }, { type: 'box', title: 'The terms', tone: 'default', blocks: [{ type: 'list', from: 'invoice.terms' }] }],
  },
  {
    id: 'invoice_reminder', name: 'Invoice reminder', group: 'deal', class: 'transactional', when: 'Three days before an invoice is due', autoDefault: 'draft', needs: ['invoice.number', 'invoice.dueNow', 'invoice.dueDate'],
    subject: '{{invoice.number}} is due {{invoice.dueDate}}', preheader: '{{invoice.dueNow}}, the same ways to pay.',
    blocks: [E('Reminder'), H('Coming up, {{firstName}}'), T("{{invoice.number}} for {{invoice.dueNow}} is due {{invoice.dueDate}}. If it's already on its way, nothing to do."), { type: 'pay', from: 'invoice.pay' }, T('Questions? Just reply.')],
  },
  {
    id: 'invoice_past_due', name: 'Invoice past due', group: 'deal', class: 'transactional', when: 'The day after the due date, once', autoDefault: 'draft', needs: ['invoice.number', 'invoice.dueNow', 'invoice.dueDate'],
    subject: 'Heads up: {{invoice.number}} is past due', preheader: "Your files stay safe with me until it's settled.",
    blocks: [E('Past due'), H('Just a heads up, {{firstName}}'), T("{{invoice.number}} for {{invoice.dueNow}} was due {{invoice.dueDate}}. Your files stay safe with me until it's settled, and nothing else changes."), { type: 'pay', from: 'invoice.pay' }, T("If it's already on its way, ignore this. If something's off, reply and tell me.")],
  },
  {
    id: 'payment_received', name: 'Payment received', group: 'deal', class: 'transactional', when: 'A payment landed: the deposit, a plan month or the final', autoDefault: 'draft', needs: ['invoice.paidSoFar', 'invoice.total'], variantBy: 'kind',
    subject: 'Got it, {{firstName}}', preheader: 'Your payment landed.',
    variants: {
      deposit: [E('Payment received'), H('Got it, {{firstName}}'), T("Your deposit landed. I'm starting on {{business}} this week."), { type: 'totals', from: 'invoice.paidTotals' }, T('Next from me: the first look at the work.')],
      plan: [E('Payment received'), H('Got it, {{firstName}}'), T('Payment {{plan.paid}} of {{plan.count}} is in. Thank you.'), { type: 'totals', from: 'invoice.paidTotals' }, T('Your files unlock after the last one.')],
      final: [E('Payment received'), H('Got it, {{firstName}}'), T("That's the last payment. Your files are coming."), { type: 'totals', from: 'invoice.paidTotals' }],
      general: [E('Payment received'), H('Got it, {{firstName}}'), T('Your payment landed. Thank you.'), { type: 'totals', from: 'invoice.paidTotals' }],
    },
    blocks: [],
  },
  {
    id: 'delivery', name: 'Delivery', group: 'project', class: 'transactional', when: 'Paid in full and the Drive folder is shared', stamp: 'delivery', autoDefault: 'off', needs: ['driveLink', 'deliverables.groups'],
    subject: "{{business}}: it's all yours", preheader: 'Your files are ready.',
    blocks: [E('Your files are ready'), H("It's all yours, {{firstName}}"), T('Everything for {{business}} is in your Drive folder, shared with you as a viewer. Here is what is in it:'), B('Open your files', '{{driveLink}}'), { type: 'files', from: 'deliverables.groups' }, T("Keep a copy somewhere of your own too. The folder stays up, and your own copy is yours for good."), { type: 'box', title: 'Keep it running', tone: 'red', blocks: [T('{{retainer.name}}, {{retainer.price}} a month: {{retainer.line}}. Month to month, cancel anytime with 30 days notice.'), { type: 'button', label: 'Start the {{retainer.name}}', url: '{{retainer.link}}', style: 'primary', optional: true }] }, T('{{extrasLine}}'), T('Thank you for trusting me with {{business}}. Reply any time.')],
  },
  /* The client and project emails (milestone 7): transactional, sent to paying clients. */
  {
    id: 'kickoff', name: 'Kickoff', group: 'client', class: 'transactional', when: 'The deposit landed and the project starts', autoDefault: 'off', needs: [],
    subject: 'Kicking off {{business}}', preheader: "Here's what happens next.",
    blocks: [E('Kickoff'), H("Let's go, {{firstName}}"), T("Your project is live. Here's the shape of it:"), { type: 'list', items: ['A first look at the work, then your notes in one message', '{{rounds.max}} rounds of changes, one message per round', 'The final payment, then your files'] }, { type: 'list', from: 'client.items', title: 'Only you can give me these' }, { type: 'button', label: 'Open your portal', url: '{{portalLink}}', style: 'primary', optional: true }, T('Questions any time, just reply.')],
  },
  {
    id: 'needs_you', name: 'Needs you', group: 'client', class: 'transactional', when: 'Something on the list is waiting on the client', autoDefault: 'off', needs: ['client.items', 'portalLink'],
    subject: 'Need you on a few things, {{firstName}}', preheader: 'Waiting on you before I can keep going.',
    blocks: [E('Needs you'), H('A few things from you, {{firstName}}'), T('These are waiting on you before I can keep going on {{business}}:'), { type: 'list', from: 'client.items' }, B('Open your portal', '{{portalLink}}'), T('Reply here if any of it needs a hand.')],
  },
  {
    id: 'review_ready', name: 'Review ready', group: 'project', class: 'transactional', when: 'The first designs are ready to look at', autoDefault: 'off', needs: [],
    subject: 'First look at {{business}}', preheader: 'The first designs are ready.',
    blocks: [E('First look'), H('Have a look, {{firstName}}'), T('The first designs for {{business}} are ready. Take your time, then send me everything in one message: {{rounds.max}} rounds of changes are included, and one message per round keeps them clean.'), { type: 'button', label: 'Open your portal', url: '{{portalLink}}', style: 'secondary', optional: true }, T("I'll take it from there.")],
  },
  {
    id: 'revision_ready', name: 'Revision ready', group: 'project', class: 'transactional', when: 'A round of changes is back', autoDefault: 'off', needs: ['revisions.used', 'revisions.max'],
    subject: 'Round {{revisions.used}} of {{revisions.max}} is ready', preheader: 'Your changes are in.',
    blocks: [E('Round {{revisions.used}} of {{revisions.max}}'), H('Round {{revisions.used}} is ready, {{firstName}}'), T('Your changes are in. Have a look, then send the next batch in one message.'), T('{{revisions.roundLine}}'), { type: 'button', label: 'Open your portal', url: '{{portalLink}}', style: 'secondary', optional: true }],
  },
  {
    id: 'plan_complete', name: 'Plan complete', group: 'project', class: 'transactional', when: 'The last plan payment landed', autoDefault: 'draft', needs: ['driveLink'],
    subject: "That's the last payment, {{firstName}}", preheader: 'Your files are unlocked.',
    blocks: [E('Paid in full'), H("That's the last payment"), T("Your plan is paid in full and your files are unlocked. They're all in your Drive folder."), B('Open your files', '{{driveLink}}'), T('Thank you for trusting me with {{business}}.')],
  },
  {
    id: 'retainer_followup', name: 'Retainer follow up', group: 'client', class: 'transactional', when: 'Three days after delivery, once', autoDefault: 'draft', needs: ['retainer.name', 'retainer.price', 'retainer.link'],
    subject: 'Keep {{business}} moving', preheader: 'One retainer, month to month.',
    blocks: [E('Keep it running'), H('One more thing, {{firstName}}'), T('Now that {{business}} is out there, the {{retainer.name}} keeps it moving: {{retainer.line}}, for {{retainer.price}} a month. Month to month, cancel anytime with 30 days notice.'), B('Start the {{retainer.name}}', '{{retainer.link}}'), T("If it's not for you right now, no worries at all.")],
  },
  {
    id: 'review_request', name: 'Review request', group: 'client', class: 'transactional', when: 'Three days after the files are released', autoDefault: 'draft', needs: ['reviewLink'],
    subject: 'Would you leave a quick review?', preheader: 'It takes a minute and helps a lot.',
    blocks: [E('A small favor'), H('Would you leave a review, {{firstName}}?'), T("If you're happy with {{business}}, a quick review helps me more than you'd think. It takes a minute."), B('Leave a review', '{{reviewLink}}'), T('Thank you either way.')],
  },
  {
    id: 'retainer_month_ready', name: 'Retainer month ready', group: 'client', class: 'transactional', when: "A retainer month's posts are ready in the planner", autoDefault: 'off', needs: ['plannerLink'],
    subject: "This month's posts are ready", preheader: 'Open your planner.',
    blocks: [E('Your planner'), H('This month is ready, {{firstName}}'), T("This month's posts for {{business}} are in your planner. Have a look, save what you like to your phone, and leave me ideas there any time."), B('Open your planner', '{{plannerLink}}')],
  },
  /* The lead emails (milestone 5): marketing, so they carry the opt out link and stop at an opt out. */
  {
    id: 'concepts_in_progress', name: 'Concepts in progress', group: 'lead', class: 'marketing', when: 'Concepts offered, no call booked yet', autoDefault: 'off', needs: ['calendlyLink'],
    subject: 'Working on some ideas for {{business}}', preheader: "I'd rather show you than send them.",
    blocks: [E('Ideas in progress'), H("I'm already on it, {{firstName}}"), T("I'm putting together some ideas for {{business}} right now. I'd rather show you than send them, so grab a time and I'll walk you through what I'm seeing."), B('Pick a time', '{{calendlyLink}}'), T("No pressure either way. If the timing's off, just reply and tell me.")],
  },
  {
    id: 'concepts_ready', name: 'Concepts ready', group: 'lead', class: 'marketing', when: 'A concept set exists and no meeting is booked', autoDefault: 'off', needs: ['calendlyLink', 'conceptCount'],
    subject: 'Your concepts for {{business}} are ready', preheader: '{{conceptCount}} directions, ready to walk through.',
    blocks: [E('Concepts ready'), H('Your concepts are ready, {{firstName}}'), T("I made {{conceptCount}} directions for {{business}} and I want to walk you through them, not just send a link. Pick a time and I'll show you where each one could go."), B('Pick a time to see them', '{{calendlyLink}}'), T('Any questions before then, just reply.')],
    options: [{ id: 'teaser', label: 'Add a peek at one direction (the set\'s cover)', blocks: [B('Peek at one direction', '{{conceptCover}}', 'secondary')] }],
  },
  {
    id: 'booking_nudge', name: 'Booking nudge', group: 'lead', class: 'marketing', when: 'Three days after an intro or concepts email with nothing booked, once a month at most', autoDefault: 'draft', needs: ['calendlyLink'],
    subject: "Still here when you're ready, {{firstName}}", preheader: 'My calendar is open.',
    blocks: [H("Still here when you're ready"), T('Quick one: my calendar is open this week if you want to grab a time to talk about {{business}}.'), B('Book the call', '{{calendlyLink}}')],
  },
  {
    id: 'missed_call', name: 'Missed call', group: 'lead', class: 'marketing', when: 'The meeting passed and I logged a no show', autoDefault: 'draft', needs: ['calendlyLink'],
    subject: 'Missed you today, {{firstName}}', preheader: "No stress, here's my calendar again.",
    blocks: [H('Missed you, {{firstName}}'), T("Looks like the call didn't happen. No stress, it happens. Here's my calendar again, pick whatever works."), B('Pick a new time', '{{calendlyLink}}')],
  },
  {
    id: 'nurture_checkin', name: 'Nurture check in', group: 'lead', class: 'marketing', when: 'A nurture lead resurfaces at ninety days', autoDefault: 'draft', needs: ['calendlyLink'],
    subject: 'Checking in on {{business}}', preheader: 'Happy to pick it back up when the timing is right.',
    blocks: [H('Checking in, {{firstName}}'), T("A few months ago the timing wasn't right for {{business}}. If that's changed, I'd love to pick it back up. If not, no worries at all."), B('Grab a time', '{{calendlyLink}}')],
  },
  /* The deal emails (milestone 5): transactional from here on. */
  {
    id: 'form_nudge', name: 'Form nudge', group: 'deal', class: 'transactional', when: 'Three days after onboarding with no form back', autoDefault: 'draft', needs: ['startFormLink'],
    subject: 'One quick thing for {{business}}', preheader: 'The form takes about five minutes.',
    blocks: [H('One quick thing, {{firstName}}'), T("The form is the one thing I need before I can start on {{business}}. It takes about five minutes and it's where I learn what you're going for."), B('Fill out the form', '{{startFormLink}}'), T("Stuck on any of it? Reply and I'll help.")],
  },
  {
    id: 'contract', name: 'Contract', group: 'deal', class: 'transactional', when: 'The form is in and the contract is ready to sign', checkpoint: 'contractSent', stamp: 'contract', autoDefault: 'off', needs: ['contractLink'],
    subject: 'Your contract for {{business}}', preheader: 'Read it, sign it, reply with I agree.',
    blocks: [E('Contract'), H("Here's your contract, {{firstName}}"), T("Read it through, type your full name at the bottom, then reply to this email with **I agree**. That's your signature, and it's what gets the clock started."), B('Open the contract', '{{contractLink}}'), T("Questions on any line? Reply and I'll walk you through it.")],
  },
  {
    id: 'contract_nudge', name: 'Contract nudge', group: 'deal', class: 'transactional', when: 'Three days after the contract with no I agree', autoDefault: 'draft', needs: ['contractLink'],
    subject: 'Nudge on the contract, {{firstName}}', preheader: "One reply and I'm on it.",
    blocks: [H('Quick nudge, {{firstName}}'), T("Whenever you get a minute: read the contract, type your full name at the bottom, and reply here with **I agree**. Then I'm on it."), B('Open the contract', '{{contractLink}}')],
  },
  {
    id: 'custom', name: 'Custom', group: 'any', class: 'transactional', when: 'Anything else, in my words', autoDefault: 'off', needs: [],
    subject: 'A note from Rob', preheader: '',
    blocks: [H('Hey {{firstName}}'), T('Write it here.'), B('Open', '{{portalLink}}', 'secondary')],
  },
];
export const TEMPLATE_IDS = EMAIL_TEMPLATES.map(t => t.id);
export const templateOf = (id) => EMAIL_TEMPLATES.find(t => t.id === id) || null;
export const templatesIn = (group) => EMAIL_TEMPLATES.filter(t => t.group === group);
/** The service a record's package puts it on, for the onboarding switch: web, brand, combined (the plans) or general. */
export const serviceOf = (packageId) => (['launch-plan', 'build-plan'].includes(packageId) ? 'combined' : /^web-/.test(String(packageId || '')) ? 'web' : packageId ? 'brand' : 'general');
/**
 * The template as it stands for Rob: the default with his override merged over it (subject, preheader, blocks or a
 * variant's blocks, auto, options), then the variant picked by `service` (or by the invoice's kind) when the template has one. An override of null or an
 * unknown template answers the default alone.
 */
export function effectiveTemplate(id, overrides = {}, { service = 'general', kind = '' } = {}) {
  const base = templateOf(id);
  if (!base) return null;
  const o = overrides && typeof overrides === 'object' && overrides[id] && typeof overrides[id] === 'object' ? overrides[id] : null;
  const svc = SERVICE_IDS.includes(service) ? service : 'general';
  /* Variants are keyed by the service (onboarding) or, with variantBy 'kind', by the invoice's kind (payment received). */
  const key = base.variantBy === 'kind' ? (kind && base.variants && base.variants[kind] ? kind : 'general') : svc;
  const variantBlocks = base.variants ? (o?.variants?.[key] || base.variants[key] || base.variants.general) : null;
  const own = variantBlocks || (Array.isArray(o?.blocks) ? o.blocks : base.blocks);
  /* A template's options (a teaser button, say) are blocks appended only when Rob turned that option on in Settings. */
  const on = o?.options && typeof o.options === 'object' ? o.options : {};
  const extra = (Array.isArray(base.options) ? base.options : []).filter(op => op && on[op.id] === true).flatMap(op => (Array.isArray(op.blocks) ? op.blocks : []));
  const blocks = extra.length ? [...own, ...extra] : own;
  return {
    ...base,
    subject: typeof o?.subject === 'string' && o.subject.trim() ? o.subject : base.subject,
    preheader: typeof o?.preheader === 'string' ? o.preheader : base.preheader,
    blocks, service: svc, edited: !!o, auto: o?.auto === true, options: on,
  };
}
