/* The client portal, the CRM side (client portal, prompt 1). Pure helpers
 * over lead.portal: the link, the patches the Portal card and its sheet
 * send, the message in my voice, and the status line the workspace reads.
 * The token is minted by the server (api/_routes/call-leads.js) when
 * `portal` is first sent and on { regenerate: true }; nothing here invents
 * one. The registry (src/shared/portalModules.js) is the module list. */
import { PORTAL_MODULES, PORTAL_TEMPLATES, portalStateOf, portalUrl as sharedPortalUrl, DOCUMENT_KIND_IDS } from '../shared/portalModules.js';

export const portalOf = (lead) => lead?.portal || null;
export const portalUrl = (lead) => sharedPortalUrl(lead);
export const hasPortal = (lead) => !!portalOf(lead)?.token;
/** The patch that asks the server for a link (first time) or a fresh one (regenerate). */
export const generatePortalPatch = (lead, regenerate = false) => ({ portal: { regenerate: !!regenerate } });
/** The patch that stamps the link as sent. */
export const portalSentPatch = (lead, now = Date.now()) => ({ portal: { sentAt: new Date(now).toISOString() } });
/** One module's state; home has no control. */
export const modulePatch = (id, state) => ({ portal: { modules: { [id]: state } } });
/** A template sets every module to its defaults on the server. */
export const templatePatch = (id) => ({ portal: { template: id } });
/** Four digits set the PIN (hashed on the server), '' clears it. */
export const pinPatch = (pin) => ({ portal: { pin: /^\d{4}$/.test(String(pin)) ? String(pin) : '' } });
export const hoursPatch = (hours) => ({ portal: { hours: String(hours || '').trim() } });
export const documentsPatch = (documents) => ({ portal: { documents } });
export const documentsOf = (lead) => (Array.isArray(portalOf(lead)?.documents) ? portalOf(lead).documents : []);
export const newDocument = (label, url, kind = 'link', now = Date.now()) => ({ id: `d${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: String(label || '').trim(), url: String(url || '').trim(), kind: DOCUMENT_KIND_IDS.includes(kind) ? kind : 'link', addedAt: new Date(now).toISOString() });
export const DOCUMENT_KINDS = [['doc', 'Doc'], ['sheet', 'Sheet'], ['pdf', 'PDF'], ['drive', 'Drive folder'], ['link', 'Link']];
export const PORTAL_TEMPLATE_OPTIONS = [['brand', 'Brand'], ['website', 'Website'], ['retainer', 'Retainer']];
export const PORTAL_STATE_OPTIONS = [['off', 'Off'], ['on', 'On'], ['auto', 'Auto']];
/** The modules with a control, in order, each with its state for this client. */
export const moduleRows = (lead) => PORTAL_MODULES.filter(m => !m.fixed).sort((a, b) => a.order - b.order).map(m => ({ id: m.id, title: m.title, auto: m.auto, sensitive: !!m.sensitive, state: portalStateOf(lead, m.id) }));
export const templateHasModule = (template, id) => !!PORTAL_TEMPLATES[template]?.[id];
/** The message in my voice, the link included. */
export function portalMessage(lead) {
  const url = portalUrl(lead);
  const who = String(lead?.askFor || '').trim().split(/[\s,]+/)[0];
  return `Hey${who ? ` ${who}` : ''}! Here's your page with me: everything about your work in one place, and the quickest way to reach me. Save it to your home screen and it's always a tap away: ${url}`;
}
/** The workspace card's status: the link, the views, the last open, the PIN, the documents and how many modules are off. */
export function portalStatus(lead) {
  const p = portalOf(lead) || {};
  const rows = moduleRows(lead);
  return {
    on: !!p.token, views: Number(p.views) || 0, lastViewedAt: p.lastViewedAt || '', sentAt: p.sentAt || '', pinned: !!p.pin,
    template: p.template || '', documents: documentsOf(lead).length, off: rows.filter(r => r.state === 'off').length, modules: rows.length,
  };
}
