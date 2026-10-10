/* Server mirror of src/shared/portalModules.js (client portal, prompt 1): the same registry byte for byte below
 * PORTAL_MODULE_IDS; scripts/portal-test.mjs asserts it. */
export const PORTAL_MODULE_IDS = ['home', 'contact', 'book', 'documents', 'showcase'];
export const PORTAL_STATE_IDS = ['off', 'on', 'auto'];
export const PORTAL_TEMPLATE_IDS = ['brand', 'website', 'retainer'];
export const DOCUMENT_KIND_IDS = ['doc', 'sheet', 'pdf', 'drive', 'link'];
export const PORTAL_URL_BASE = 'https://visualizestudio.org/c/';

const STAGE_LABELS = { kickoff: 'Kickoff', design: 'Design', revisions: 'Revisions', build: 'Build', delivery: 'Delivery', delivered: 'Delivered' };
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const hexOf = (v) => { const raw = v && typeof v === 'object' ? v.hex : v; const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(raw ?? '').trim()); return m ? `#${(m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]).toLowerCase()}` : ''; };
/** The first brand colour on the record, as a hex or ''. The same reading as src/shared/color.js brandHexOf. */
export const portalBrandHex = (client) => { const b = client?.brand || {}; for (const c of [b.primary, ...(Array.isArray(b.colors) ? b.colors : [])]) { const h = hexOf(c); if (h) return h; } return ''; };
export const portalLogo = (client) => { const sh = client?.showcase || {}; return str(sh.brand?.logo?.dark || sh.brand?.logo?.light || sh.logoUrl, 600); };
export const portalFirstName = (client) => str(client?.askFor, 80).split(/[\s,]+/)[0] || '';
export const portalBusiness = (client) => str(client?.showcase?.displayName || client?.business, 120);
/** The newest active project: not archived, not a retainer, not delivered; newest first by createdAt. */
export const newestActiveProject = (client, projects) => (Array.isArray(projects) ? projects : [])
  .filter(p => p && String(p.leadId) === String(client?._id) && !p.archived && p.kind !== 'retainer' && p.stage !== 'delivered')
  .sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0))[0] || null;

export const PORTAL_MODULES = [
  {
    id: 'home', title: 'Home', order: 0, sensitive: false, defaultState: 'on', fixed: true,
    auto: 'Always on: their logo, a hello by first name, and where the newest project is.',
    fields: ['status'],
    resolve(client, projects) {
      const p = newestActiveProject(client, projects);
      return { status: p ? `${str(p.name, 80) || 'Your project'}: ${STAGE_LABELS[p.stage] || 'In progress'}` : 'All set' };
    },
  },
  {
    id: 'contact', title: 'Message Rob', order: 10, sensitive: false, defaultState: 'auto',
    auto: 'Shows when my phone or email is set under Settings, Profile.',
    fields: ['sms', 'mailto', 'instagram', 'hours'],
    resolve(client, projects, settings) {
      /* Ready hrefs, never the raw values: a card payload carries no phone or email field (portal-test's forbidden keys). */
      const pr = settings?.profile || {};
      const digits = str(pr.phone, 32).replace(/[^\d+]/g, ''); const email = str(pr.email, 120);
      if (!digits && !email) return null;
      return { sms: digits ? `sms:${digits}` : '', mailto: email ? `mailto:${email}` : '', instagram: 'visualizetm', hours: str(client?.portal?.hours, 120) || str(pr.hours, 120) };
    },
  },
  {
    id: 'book', title: 'Book a call', order: 20, sensitive: false, defaultState: 'auto',
    auto: 'Shows when a Calendly link is set under Settings, Profile, else the studio link from the config; off hides it.',
    fields: ['url'],
    resolve(client, projects, settings) {
      const url = str(settings?.profile?.calendlyLink, 400) || str(settings?.meetingLink, 400);
      return /^https:\/\//i.test(url) ? { url } : null;
    },
  },
  {
    id: 'documents', title: 'Your documents', order: 30, sensitive: false, defaultState: 'auto',
    auto: 'Shows when at least one document link is on the list.',
    fields: ['items'],
    resolve(client) {
      const items = (Array.isArray(client?.portal?.documents) ? client.portal.documents : [])
        .filter(d => d && /^https?:\/\//i.test(String(d.url || '')) && str(d.label, 120))
        .map(d => ({ id: str(d.id, 40), label: str(d.label, 120), url: str(d.url, 600), kind: DOCUMENT_KIND_IDS.includes(d.kind) ? d.kind : 'link' }));
      return items.length ? { items } : null;
    },
  },
  {
    id: 'showcase', title: 'Your showcase', order: 40, sensitive: false, defaultState: 'auto',
    auto: 'Shows when their showcase is published.',
    fields: ['url', 'slug', 'message'],
    resolve(client) {
      const sh = client?.showcase || {};
      if (!sh.published || !str(sh.slug, 80)) return null;
      const url = `https://visualizestudio.org/clients/${str(sh.slug, 80)}`;
      return { url, slug: str(sh.slug, 80), message: `New look for ${portalBusiness(client)}, made with Visualize: ${url}` };
    },
  },
];
export const PORTAL_TEMPLATES = {
  brand: { contact: 'auto', book: 'auto', documents: 'auto', showcase: 'auto' },
  website: { contact: 'auto', book: 'auto', documents: 'auto', showcase: 'auto' },
  retainer: { contact: 'auto', book: 'auto', documents: 'auto', showcase: 'auto' },
};
export const portalModuleOf = (id) => PORTAL_MODULES.find(m => m.id === id) || null;
/** The state a module is in for this client: the stored one, else its default; home is always on. */
export const portalStateOf = (client, id, mod = null) => { const m = mod || portalModuleOf(id); if (!m) return 'off'; if (m.fixed) return 'on'; const s = client?.portal?.modules?.[id]; return PORTAL_STATE_IDS.includes(s) ? s : m.defaultState; };
/** Only the whitelisted fields of a resolve's answer. */
export const cardOf = (m, data) => { const out = { id: m.id, title: m.title, sensitive: !!m.sensitive }; for (const k of m.fields) if (data && data[k] !== undefined) out[k] = data[k]; return out; };
/** Every card the page gets, in order: off never renders, on and auto render when resolve has data; a sensitive card is locked until the device unlocked it. */
export function portalCards(client, projects, settings, { unlocked = false, modules = PORTAL_MODULES } = {}) {
  const cards = [];
  for (const m of [...modules].sort((a, b) => a.order - b.order)) {
    if (portalStateOf(client, m.id, m) === 'off') continue;
    let data = null;
    try { data = m.resolve(client, projects, settings); } catch { data = null; }
    if (!data) continue;
    if (m.sensitive && !unlocked) { cards.push({ id: m.id, title: m.title, sensitive: true, locked: true }); continue; }
    cards.push(cardOf(m, data));
  }
  return cards;
}
/** What the page may know about the client, and nothing else. */
export const portalClient = (client) => ({ firstName: portalFirstName(client), business: portalBusiness(client), logoUrl: portalLogo(client), brandHex: portalBrandHex(client) });
export const portalUrl = (client) => (client?.portal?.token ? `${PORTAL_URL_BASE}${client.portal.token}` : '');
