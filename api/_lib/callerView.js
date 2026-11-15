/* The caller's field whitelist (Billy's Call Room, part 1): the one module
 * every caller response is built with. The line: Billy sees a lead while it
 * is triage, lead or nurture; from booked on it belongs to Rob and reads as
 * a lead that does not exist. Nothing here spreads a record: every key is
 * named, so a new field on a lead is out by default.
 *
 * Never in a response: money, quotes, the deal, invoices, Rob's notes,
 * concepts, docs, email drafts, settings. scripts/caller-lib.mjs runs
 * callerLead() over a fixture lead that carries every field and fails on a
 * key that is not in CALLER_LEAD_KEYS or a forbidden value that got out. */
import { normalizeStage } from '../_semantics.js';
import { websiteDead } from './score.js';

export const CALLER_STAGES = ['triage', 'lead', 'nurture'];
/** Is this lead on Billy's side of the line? */
export const callerMay = (lead) => !!lead && typeof lead === 'object' && lead.deleted !== true && CALLER_STAGES.includes(normalizeStage(lead));

export const CALLER_LEAD_KEYS = ['id', 'business', 'type', 'city', 'phone', 'owner', 'score', 'rating', 'reviews', 'website', 'instagram', 'hours', 'stage', 'found', 'script', 'intel', 'objections', 'listId', 'callbackAt', 'callStatus', 'callLog', 'note', 'triageSnoozedAt'];

const str = (v, max = 400) => String(v ?? '').slice(0, max);
const lines = (v, max = 30) => (Array.isArray(v) ? v.slice(0, max).map(x => str(typeof x === 'string' ? x : x?.text || x?.note || '', 600)).filter(Boolean) : []);
const qa = (v, max = 12) => (Array.isArray(v) ? v.slice(0, max).map(x => ({ say: str(x?.say, 300), respond: str(x?.respond, 800) })).filter(x => x.say || x.respond) : []);
const iso = (v) => { const d = v instanceof Date ? v : new Date(v || ''); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
const whoOf = (entry) => (entry?.by === 'billy' ? 'billy' : 'rob');

/** One lead as the Call Room may see it. */
export function callerLead(lead) {
  const l = lead || {};
  const s = l.script && typeof l.script === 'object' ? l.script : {};
  const c = l.close && typeof l.close === 'object' ? l.close : {};
  const r = l.reviews?.latest?.count ? l.reviews.latest : l.reviews?.baseline?.count ? l.reviews.baseline : null;
  const site = l.socials?.website ? (websiteDead(l) ? 'dead' : 'up') : 'none';
  return {
    id: String(l._id),
    business: str(l.business, 200),
    type: str(l.industry, 80),
    city: str(l.area, 160),
    phone: str(l.phone, 40),
    owner: str(l.askFor, 200),
    score: Math.max(0, Math.min(100, Math.round(Number(l.score)) || 0)),
    rating: r ? Math.max(0, Math.min(5, Number(r.rating) || 0)) : null,
    reviews: r ? Math.max(0, Math.round(Number(r.count)) || 0) : 0,
    website: site,
    instagram: str(l.socials?.instagram, 400),
    hours: str(l.bestWindow, 300),
    stage: normalizeStage(l),
    found: { at: iso(l.createdAt), where: l.sourceId ? 'scraper' : l.source === 'import' ? 'import' : 'hand' },
    script: {
      confirm: str(s.confirm, 400), intro: str(s.intro, 600), homework: str(s.homework, 600), question: str(s.question, 400),
      likelyAnswers: qa(s.likelyAnswers), hook: str(s.hook, 800), ask: str(s.ask, 400),
      lockIt: str(c.lockIt, 600), ifNo: str(c.ifNo, 600), noAnswer: str(c.noAnswer, 400),
      opener: str(l.angle, 1200), beforeYouDial: lines(l.beforeYouDial),
    },
    intel: { accomplishments: lines(l.intel?.accomplishments), gaps: lines(l.intel?.gaps), dropLines: lines(l.intel?.dropLines) },
    objections: qa(l.objections),
    listId: str(l.listId, 64),
    callbackAt: str(l.callbackAt, 40),
    callStatus: str(l.callStatus || 'not-called', 20),
    /* Who, when and what happened; the note only on the calls Billy made himself. */
    callLog: (Array.isArray(l.callLog) ? l.callLog.slice(-50) : []).map(e => ({ who: whoOf(e), at: str(e?.at, 40), outcome: str(e?.outcome, 20), ...(whoOf(e) === 'billy' ? { note: str(e?.note, 1000) } : {}) })),
    /* What Billy is typing in the call room, his own field (callerNote), never afterCall. */
    note: l.callerNote?.by === 'billy' ? str(l.callerNote.text, 3000) : '',
    triageSnoozedAt: str(l.triageSnoozedAt, 40),
  };
}

export const CALLER_LIST_KEYS = ['id', 'name', 'leadIds', 'target', 'system', 'callerId', 'madeBy', 'createdAt'];
/** Who calls a list: its callerId, else whoever made it (a list from before this field is Rob's). */
export const callerIdOf = (list) => (list?.callerId === 'billy' || list?.callerId === 'rob' ? list.callerId : list?.createdBy === 'billy' ? 'billy' : 'rob');
/** One open list as the Call Room may see it; `visible` is the Set of lead ids on Billy's side of the line. */
export function callerList(list, visible) {
  return {
    id: String(list._id),
    name: str(list.name, 80),
    leadIds: (Array.isArray(list.leadIds) ? list.leadIds : []).map(String).filter(id => !visible || visible.has(id)),
    target: Math.max(0, Math.round(Number(list.target)) || 0),
    system: list.system === true,
    callerId: list.system ? '' : callerIdOf(list),
    madeBy: list.createdBy === 'billy' ? 'billy' : 'rob',
    createdAt: iso(list.createdAt),
  };
}

/** Me > Booked: the lead Billy booked as one status word and nothing else about it. */
export function bookedWord(lead) {
  const stage = normalizeStage(lead);
  if (stage === 'booked') return 'Booked';
  if (stage === 'client' || stage === 'won') return 'Client';
  if (stage === 'deal') return (Array.isArray(lead?.deal?.invoices) ? lead.deal.invoices : []).some(i => i && (i.sentAt || i.status === 'sent' || i.status === 'paid' || i.paidAt)) ? 'Quoted' : 'Met';
  return 'Closed';
}
export const CALLER_BOOKED_KEYS = ['business', 'word', 'at'];
export const callerBooked = (lead) => ({ business: str(lead?.business, 200), word: bookedWord(lead), at: str(lead?.bookedBy?.at, 40) });
