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
    blocks: [E('Invoice {{invoice.number}}'), H("Here's your invoice, {{firstName}}"), T('{{invoice.covers}}'), { type: 'lines', from: 'invoice.items' }, { type: 'totals', rows: [{ label: 'Package total', value: '{{invoice.total}}' }, { label: 'Paid so far', value: '{{invoice.paidSoFar}}' }, { label: 'Due now', value: '{{invoice.dueNow}}', big: true }] }, T('Due **{{invoice.dueDate}}**. {{invoice.leftLine}}'), B('Pay {{invoice.dueNow}} with card or Apple Pay', '{{invoice.stripeLink}}'), B('Cash App, Venmo or Zelle', '{{invoice.otherPayLink}}', 'secondary'), { type: 'box', title: 'The terms', tone: 'default', blocks: [{ type: 'list', from: 'invoice.terms' }] }],
  },
  {
    id: 'delivery', name: 'Delivery', group: 'project', class: 'transactional', when: 'Paid in full and the Drive folder is shared', stamp: 'delivery', autoDefault: 'off', needs: ['driveLink', 'deliverables.groups'],
    subject: "{{business}}: it's all yours", preheader: 'Your files are ready.',
    blocks: [E('Your files are ready'), H("It's all yours, {{firstName}}"), T("Everything for {{business}} is in your Drive folder. Here's what's in it:"), B('Open your files', '{{driveLink}}'), { type: 'files', from: 'deliverables.groups' }, T('Keep a copy somewhere safe. The folder stays up, but your own copy is yours forever.'), { type: 'box', title: 'Keep it running', tone: 'red', blocks: [T('**{{retainer.name}}**, {{retainer.price}} a month: {{retainer.line}}. Month to month, 30 day cancel.'), B('See {{retainer.name}}', '{{retainer.link}}', 'secondary')] }, T('{{extrasLine}}')],
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
 * variant's blocks, auto), then the variant picked by `service` when the template has one. An override of null or an
 * unknown template answers the default alone.
 */
export function effectiveTemplate(id, overrides = {}, { service = 'general' } = {}) {
  const base = templateOf(id);
  if (!base) return null;
  const o = overrides && typeof overrides === 'object' && overrides[id] && typeof overrides[id] === 'object' ? overrides[id] : null;
  const svc = SERVICE_IDS.includes(service) ? service : 'general';
  const variantBlocks = base.variants ? (o?.variants?.[svc] || base.variants[svc] || base.variants.general) : null;
  const blocks = variantBlocks || (Array.isArray(o?.blocks) ? o.blocks : base.blocks);
  return {
    ...base,
    subject: typeof o?.subject === 'string' && o.subject.trim() ? o.subject : base.subject,
    preheader: typeof o?.preheader === 'string' ? o.preheader : base.preheader,
    blocks, service: svc, edited: !!o, auto: o?.auto === true,
  };
}
