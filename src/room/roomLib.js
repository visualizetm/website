/* Billy's Call Room, the pure half (part 1 of 2): everything the screens under src/room show is worked out here from
 * what GET /api/caller/home answered (leads through the server's whitelist, lists, the booked words, today's counts).
 * No React, no fetch, no storage; a `now` is passed in. scripts/room-test.mjs reads it. */
import { nyParts, nyAt } from '../shared/callScript.js';

export const CALLER = 'billy';
export const ROB = 'rob';
const pad = (n) => String(n).padStart(2, '0');
const ms = (v) => { const t = new Date(v || '').getTime(); return Number.isFinite(t) ? t : 0; };
const low = (v) => String(v || '').trim().toLowerCase();

/* ── Today ───────────────────────────────────────────────────────────── */
/** "Morning, Billy." before noon, "Afternoon, Billy." until five, "Evening, Billy." after (New York, the studio's clock). */
export function greeting(name, now = Date.now()) {
  const h = nyParts(now).h;
  return `${h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'}, ${String(name || 'there').trim() || 'there'}.`;
}
/** "Sunday, November 15" in New York. */
export const dateLine = (now = Date.now()) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(now));
export const nyDayKey = (t) => { const p = nyParts(t); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
/** Tomorrow at 9:00 AM New York: the default callback. */
export const tomorrowNine = (now = Date.now()) => new Date(nyAt(now, 1, 9, 0)).toISOString();
/** "Today 3:30 PM", "Tomorrow 9:00 AM", else "Thu, Nov 19 at 10:00 AM", in New York. */
export function whenLine(iso, now = Date.now()) {
  const t = ms(iso); if (!t) return '';
  const p = nyParts(t); const n = nyParts(now);
  const diff = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(n.y, n.m - 1, n.d)) / 864e5);
  const time = `${((p.h + 11) % 12) + 1}:${pad(p.min)} ${p.h >= 12 ? 'PM' : 'AM'}`;
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  if (diff === -1) return `Yesterday ${time}`;
  return `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(t))} at ${time}`;
}

/* ── Calls and callbacks: only what Billy set, only on leads he called ── */
export const myCalls = (lead) => (Array.isArray(lead?.callLog) ? lead.callLog : []).filter(e => e?.who === CALLER);
const lastEntry = (lead) => { const log = Array.isArray(lead?.callLog) ? lead.callLog : []; return log[log.length - 1] || null; };
/** A callback Billy set: the lead waits on a callback and the call that asked for it was his. */
export const isMyCallback = (lead) => lead?.callStatus === 'callback' && !!ms(lead.callbackAt) && lastEntry(lead)?.who === CALLER;
/** A retry on a lead he called: his last call rang out. */
export const isMyRetry = (lead) => lead?.callStatus === 'no-answer' && lastEntry(lead)?.who === CALLER;
/** The Callbacks tab: Due now, Later today, Tomorrow, anything further out, and "No answer, try again". */
export function callbackSections(leads, now = Date.now()) {
  const today = nyDayKey(now); const tomorrow = nyDayKey(nyAt(now, 1, 12, 0));
  const mine = (leads || []).filter(isMyCallback).sort((a, b) => ms(a.callbackAt) - ms(b.callbackAt));
  const dueNow = []; const laterToday = []; const tomorrowRows = []; const later = [];
  for (const l of mine) {
    const t = ms(l.callbackAt); const day = nyDayKey(t);
    if (t <= now) dueNow.push(l); else if (day === today) laterToday.push(l); else if (day === tomorrow) tomorrowRows.push(l); else later.push(l);
  }
  const retry = (leads || []).filter(isMyRetry).sort((a, b) => ms(lastEntry(a)?.at) - ms(lastEntry(b)?.at));
  return { dueNow, laterToday, tomorrow: tomorrowRows, later, retry };
}
export const callbacksDueNow = (leads, now = Date.now()) => callbackSections(leads, now).dueNow;
export const callbacksCount = (leads, now = Date.now()) => { const s = callbackSections(leads, now); return s.dueNow.length; };

/* ── Lists ───────────────────────────────────────────────────────────── */
export const isRobList = (list) => !!list && !list.system && list.callerId === ROB;
export const isMyList = (list) => !!list && !list.system && list.callerId === CALLER;
export const listLeft = (list) => (Array.isArray(list?.leadIds) ? list.leadIds.length : 0);
/** "N left of M": M is the list's total (its target), never under what is left. */
export const listTotal = (list) => Math.max(listLeft(list), Math.round(Number(list?.target)) || 0);
export const listProgress = (list) => { const total = listTotal(list); return total ? Math.round(((total - listLeft(list)) / total) * 100) : 0; };
export const leftLine = (list) => `${listLeft(list)} left of ${listTotal(list)}`;
export const callerPill = (list) => (list?.system ? 'Fills itself' : isRobList(list) ? 'Rob calls it' : 'Billy calls it');
/** The list Today offers: the newest list Billy calls that still has someone on it. */
export const yourList = (lists) => [...(lists || [])].filter(l => isMyList(l) && listLeft(l) > 0).sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0] || null;
/** Lists, newest first: the ones Billy calls, the ones Rob calls, then Callbacks due. */
export const listsInOrder = (lists) => { const by = (a, b) => ms(b.createdAt) - ms(a.createdAt); const all = lists || []; return [...all.filter(isMyList).sort(by), ...all.filter(isRobList).sort(by), ...all.filter(l => l.system)]; };
/** Where a lead can be put: open hand lists, newest first. */
export const targetLists = (lists) => [...(lists || [])].filter(l => !l.system).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
export const listOf = (lists, id) => (lists || []).find(l => String(l.id) === String(id)) || null;
/** Is this lead on a list Rob calls? Billy moves it (with the confirm) before he dials it; locked when Rob switched the moves off. */
export const onRobList = (lead, lists) => { const l = lead?.listId ? listOf(lists, lead.listId) : null; return isRobList(l) ? l : null; };

/** Start calling: the callbacks due now first, then the list, each lead once. */
export function startQueue(list, leads, now = Date.now()) {
  const byId = new Map((leads || []).map(l => [String(l.id), l]));
  const due = callbacksDueNow(leads, now).map(l => String(l.id));
  const rest = (list?.leadIds || []).map(String).filter(id => byId.has(id));
  return [...new Set([...due, ...rest])];
}

/* ── Triage ──────────────────────────────────────────────────────────── */
/** The pile, highest score first; a lead sent to the back with Not now waits behind every lead that was not, oldest snooze first. */
export function triagePile(leads) {
  const pile = (leads || []).filter(l => l.stage === 'triage');
  const fresh = pile.filter(l => !l.triageSnoozedAt).sort((a, b) => (b.score || 0) - (a.score || 0) || ms(b.found?.at) - ms(a.found?.at));
  const snoozed = pile.filter(l => l.triageSnoozedAt).sort((a, b) => ms(a.triageSnoozedAt) - ms(b.triageSnoozedAt));
  return [...fresh, ...snoozed];
}
export const WHERE = { scraper: 'the nightly scraper', import: 'an import', hand: 'added by hand' };
/** "Found Nov 12 by the nightly scraper". */
export function foundLine(lead) {
  const t = ms(lead?.found?.at);
  const day = t ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(new Date(t)) : '';
  const where = WHERE[lead?.found?.where] || WHERE.hand;
  return lead?.found?.where === 'hand' ? `Added by hand${day ? ` ${day}` : ''}` : `Found${day ? ` ${day}` : ''} by ${where}`;
}
/** "4.8 on 212 reviews", or '' when Google gave nothing. */
export const ratingLine = (lead) => (lead?.rating && lead?.reviews ? `${Number(lead.rating).toFixed(1)} on ${lead.reviews} review${lead.reviews === 1 ? '' : 's'}` : '');
/** The website in a few words, with the scan's own line about it when there is one. */
export function websiteLine(lead) {
  const gap = (lead?.intel?.gaps || []).find(g => /site|website|domain|page|load/i.test(String(g)));
  if (lead?.website === 'none') return 'No website';
  if (lead?.website === 'dead') return gap ? `Website is down: ${gap}` : 'Website is down';
  return gap ? `Has a website: ${gap}` : 'Has a website';
}
/** Before you dial: the lead's own bullets, then the scan's gaps and wins, each once. */
export const intelBullets = (lead, n = 6) => [...new Set([...(lead?.script?.beforeYouDial || []), ...(lead?.intel?.gaps || []), ...(lead?.intel?.accomplishments || []), ...(lead?.intel?.dropLines || [])].map(String).map(s => s.trim()).filter(Boolean))].slice(0, n);
export const subLine = (lead) => [lead?.type, lead?.city, `Score ${lead?.score || 0}`].filter(Boolean).join(' · ');

/* ── Leads ───────────────────────────────────────────────────────────── */
export const LEAD_CHIPS = [{ id: 'all', label: 'All' }, { id: 'nolist', label: 'No list' }, { id: 'rob', label: "Rob's list" }];
export const leadMatches = (lead, q) => { const s = low(q); return !s || [lead?.business, lead?.city, lead?.owner].some(v => low(v).includes(s)); };
export function leadChipMatch(lead, chip, lists) {
  if (chip === 'nolist') return !lead.listId || !listOf(lists, lead.listId);
  if (chip === 'rob') return !!onRobList(lead, lists);
  return true;
}
export const chipCounts = (leads, lists, q = '') => Object.fromEntries(LEAD_CHIPS.map(c => [c.id, (leads || []).filter(l => leadMatches(l, q) && leadChipMatch(l, c.id, lists)).length]));
export const filterLeads = (leads, lists, { q = '', chip = 'all' } = {}) => (leads || []).filter(l => leadMatches(l, q) && leadChipMatch(l, chip, lists)).sort((a, b) => (b.score || 0) - (a.score || 0) || low(a.business).localeCompare(low(b.business)));
/** The values a filter chip row offers for a field, most common first. */
export function facet(leads, key, max = 8) {
  const c = new Map();
  for (const l of leads || []) { const v = String(l?.[key] || '').trim(); if (v) c.set(v, (c.get(v) || 0) + 1); }
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([value, count]) => ({ value, count }));
}
/** A filter fill, counted before anything is written: who matches, who is on a list already (and stays), who will be added. The server applies the same rule. */
export function fillPreview(leads, lists, { types = [], cities = [], noList = false } = {}) {
  const t = new Set(types.map(low)); const c = new Set(cities.map(low));
  const onOpen = new Set((lists || []).filter(l => !l.system).flatMap(l => (l.leadIds || []).map(String)));
  const base = (leads || []).filter(l => l.stage === 'lead' && (!t.size || t.has(low(l.type))) && (!c.size || c.has(low(l.city))));
  const match = noList ? base.filter(l => !onOpen.has(String(l.id))) : base;
  const onList = match.filter(l => onOpen.has(String(l.id))).length;
  return { match: match.length, onList, add: match.length - onList };
}
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "34 leads match. 6 are on a list already and stay where they are. 28 will be added." */
export function fillLine(p) {
  if (!p.match) return 'No leads match yet.';
  return `${plural(p.match, 'lead')} match${p.match === 1 ? 'es' : ''}.${p.onList ? ` ${p.onList} ${p.onList === 1 ? 'is' : 'are'} on a list already and stay${p.onList === 1 ? 's' : ''} where ${p.onList === 1 ? 'it is' : 'they are'}.` : ''} ${p.add} will be added.`;
}

/* ── The session ─────────────────────────────────────────────────────── */
export const newSession = ({ list = null, ids = [], now = Date.now() } = {}) => ({ listId: list ? String(list.id) : '', list: list ? list.name : 'Callbacks', ids: ids.map(String), startedAt: new Date(now).toISOString(), logged: {}, texts: {} });
/** The next lead to dial: the first in the queue with no outcome yet. */
export const sessionNext = (session, after = '') => { const ids = session?.ids || []; const from = after ? ids.indexOf(String(after)) + 1 : 0; return [...ids.slice(from), ...ids.slice(0, from)].find(id => !session.logged?.[id]) || ''; };
export const sessionLogged = (session, id, outcome, extra = {}) => ({ ...session, ids: session.ids.includes(String(id)) ? session.ids : [...session.ids, String(id)], logged: { ...session.logged, [id]: outcome }, texts: extra.voicemail ? { ...session.texts, [id]: session.texts?.[id] || 'owed' } : session.texts });
export const sessionTexted = (session, id) => ({ ...session, texts: { ...session.texts, [id]: 'sent' } });
/** Skip for now: to the end of today's queue. */
export const sessionSkipped = (session, id) => ({ ...session, ids: [...session.ids.filter(x => x !== String(id)), String(id)] });
export function sessionStats(session) {
  const o = Object.values(session?.logged || {});
  const n = (k) => o.filter(x => x === k).length;
  const calls = o.length; const noAnswer = n('no-answer'); const wrong = n('wrong-number');
  return { calls, talked: Math.max(0, calls - noAnswer - wrong), booked: n('booked'), callbacks: n('callback'), noAnswer, notInterested: n('no') };
}
/** "12 calls in 1h 05m" */
export function sessionLine(session, now = Date.now()) {
  const s = sessionStats(session);
  const mins = Math.max(0, Math.round((now - ms(session?.startedAt)) / 60e3));
  return `${plural(s.calls, 'call')} in ${Math.floor(mins / 60)}h ${pad(mins % 60)}m`;
}
/** Still to do: the voicemail texts not sent yet, and how many callbacks this session scheduled. */
export const stillToDo = (session) => ({ texts: Object.entries(session?.texts || {}).filter(([, v]) => v === 'owed').map(([id]) => id), callbacks: sessionStats(session).callbacks });

/* ── Open times (booking) ────────────────────────────────────────────── */
/** Slots grouped by their New York day, in order: [{ key, label, slots: [{ iso, label }] }]. */
export function slotDays(slots, now = Date.now()) {
  const days = new Map();
  for (const iso of [...new Set(slots || [])].sort()) {
    const t = ms(iso); if (!t || t <= now) continue;
    const p = nyParts(t); const key = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
    if (!days.has(key)) days.set(key, { key, label: dayChip(t, now), slots: [] });
    days.get(key).slots.push({ iso, label: `${((p.h + 11) % 12) + 1}:${pad(p.min)} ${p.h >= 12 ? 'PM' : 'AM'}` });
  }
  return [...days.values()];
}
function dayChip(t, now) {
  const p = nyParts(t); const n = nyParts(now);
  const diff = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(n.y, n.m - 1, n.d)) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(t));
}
/** "Thu 10:00 AM" for the Book button and the time card. */
export function slotLine(iso, now = Date.now()) {
  const t = ms(iso); if (!t) return '';
  const p = nyParts(t);
  return `${dayChip(t, now)} ${((p.h + 11) % 12) + 1}:${pad(p.min)} ${p.h >= 12 ? 'PM' : 'AM'}`;
}
/** The line Billy texts the lead after a booking (he taps send himself). "I", never "we". */
export function bookedText(lead, iso, callerName = 'Billy', ownerName = 'Rob') {
  const first = String(lead?.owner || '').trim().split(/[\s,]+/)[0];
  const p = nyParts(ms(iso));
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(ms(iso)));
  return `Hey${first ? ` ${first}` : ''}, it's ${callerName} from Visualize. You're set with ${ownerName} for ${day} at ${((p.h + 11) % 12) + 1}:${pad(p.min)} ${p.h >= 12 ? 'PM' : 'AM'}. I'll make sure the concepts are ready. Talk soon.`;
}
