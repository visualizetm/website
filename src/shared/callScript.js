/* The call script and the close, in one place (prompt 2 of 3: the call console and the close).
 *
 * The cold call stepper (src/components/calls/CallStepper.jsx) reads a lead's own script lines first (script.*, close.*) and
 * falls back to the shared v2 line here, so a step never shows blank. The concept call stepper (CloserStepper.jsx), the
 * objection cards (ObjectionSheet.jsx) and the price presenter (PricePresenter.jsx) read the lines below, which are
 * docs/HORMOZI-CLOSE.md section 4 in Rob's voice, word for word. Pure: no React, no fetch, no browser clock except
 * where a `now` is passed in. Times are America/New_York like every other wall clock the app pins (the slots, the task). */

export const SCRIPT_VERSION = 'hormozi-v2-2026-10-22';

/* The shared v2 lines, one per step the stepper can show. A lead's own line (script.<key> or close.<key>) wins. */
export const V2 = {
  confirm: 'Hey, is this the owner? ... Perfect, I will keep this quick.',
  intro: "I'm Rob, I run Visualize, a small design studio here. I build brands and sites for local shops.",
  homework: "I looked you up before I called. The reviews are strong and the work's good, and the brand online doesn't match it yet.",
  question: 'Who handles the website and the socials for you right now?',
  goalQuestion: 'Where do you want the shop to be a year from now?',
  hook: "Here's the thing. I already made a couple of concepts for you, no charge, so you can see what I mean instead of taking my word for it. Fifteen minutes on a call and I walk you through them.",
  ask: 'I have two times. Which works better for you?',
  lockIt: "Perfect. What's the best cell for the reminder, and the email for the invite? I'll send both now.",
  ifNo: "No problem. Can I text you the concepts anyway? If they land, you know where I am.",
  noAnswer: "Hey, it's Rob from Visualize. I made a couple of concepts for your shop, no charge. I'll text them over. Call me back when you have a minute.",
  voicemail: "Hey, it's Rob from Visualize. I put together a couple of concepts for your shop, no charge. Reply here and I'll send them over, or call me back when you get a minute.",
  dm: "Hey {{first}}, Rob from Visualize here. I made a couple of concepts for {{business}}, no charge, just to show you what I mean. Want me to send them over?",
  nightBefore: "Hey, it's Rob. Looking forward to tomorrow. I'll have your concepts ready to walk through. If anyone else wants in on the call, bring them along.",
};

/** The line a step shows: the lead's own, else the shared v2 line, never blank. */
export function scriptLine(lead, key) {
  const own = String(lead?.script?.[key] || lead?.close?.[key] || '').trim();
  return own || V2[key] || '';
}

/* ── Objections (docs/HORMOZI-CLOSE.md section 4, Rob's voice) ─────────────────────────────────────────────────────
   Each card: what they said, Rob's line, the logic in one sentence. A lead's own objections[] (say, respond) come first
   on the sheet; these are the shared set beneath them. */
export const OBJECTIONS = [
  { id: 'money', label: 'Money', said: "That's a lot right now.",
    line: "Is $500 a lot right now? Good, that's why it'll get used. If all it did was bring three new customers a month, worth it? Then it's not the price, it's whether you believe I'll deliver. Let's talk about that.",
    logic: 'A price objection means the value is not built yet: move the talk from the number to belief.' },
  { id: 'time', label: 'Time', said: "I'm too busy for this right now.",
    line: "You're busy now and you'll be busy in spring. I build it. You give me 30 minutes on the form and two rounds of feedback.",
    logic: 'Busy is permanent; the work is on me, the ask of them is small and named.' },
  { id: 'fit', label: 'Fit', said: "I'm not sure this works for a shop like mine.",
    line: "If this were perfect for your shop, would you do it? ... So what's the gap between perfect and this?",
    logic: 'A no means a trust problem, back up; a yes means they cannot name the gap, so the issue is the decision.' },
  { id: 'partner', label: 'Partner', said: 'I have to run it by my partner.',
    line: "What do you think they'd say no to? ... Do they like how the shop looks online right now? Then why would they be against fixing it?",
    logic: 'The partner is not on the call: handle what they would object to, and book the two of them for the next time.' },
  { id: 'stall', label: 'Stall', said: 'Let me think about it.',
    line: "For sure. What's the main thing you're weighing? ... Do you think this gets you closer? Do you trust me to do what I say? Will it work for your shop? Then let's start.",
    logic: 'A stall means they do not know how to decide: three yeses leave only access to funds.' },
  { id: 'burned', label: 'Bad past experience', said: 'The last guy took my money and vanished.',
    line: "Don't let the last guy burn you twice. Two revision rounds, and the concept is already in your hands before you pay a dime.",
    logic: 'The concept in hand and the two rounds are the risk reversal.' },
];
export const objectionOf = (id) => OBJECTIONS.find(o => o.id === id) || null;
/** The card to show for an objection id: the lead's own line when one of its objections[] names the same thing, else the shared card. */
export function objectionCard(lead, id) {
  const base = objectionOf(id);
  if (!base) return null;
  const words = { money: /price|money|cost|afford|expensive|\$/i, time: /time|busy|season/i, fit: /work for|fit|my shop|different|sure/i, partner: /partner|wife|husband|boss|owner/i, stall: /think|later|call you|get back/i, burned: /last (guy|time|one)|burn|before/i }[id];
  const own = (lead?.objections || []).find(o => words && words.test(String(o?.say || '')) && String(o?.respond || '').trim());
  return own ? { ...base, said: String(own.say).trim(), line: String(own.respond).trim(), own: true } : base;
}

/* The objection writes: one objection logged with its count, the ask counter bumped (afterCall.asks on the cold call, afterCall.closer.asks on the concept call). */
export function objectionPatch(lead, id, now = Date.now()) {
  const ac = lead?.afterCall || {};
  const counts = { ...(ac.objections || {}) };
  counts[id] = (Number(counts[id]) || 0) + 1;
  return { afterCall: { ...ac, objection: id, objections: counts, objectionAt: new Date(now).toISOString() } };
}
export function askPatch(lead, key = 'asks') {
  const ac = lead?.afterCall || {};
  if (key === 'closer') { const c = ac.closer || {}; return { afterCall: { ...ac, closer: { ...c, asks: (Number(c.asks) || 0) + 1 } } }; }
  return { afterCall: { ...ac, asks: (Number(ac.asks) || 0) + 1 } };
}
export const objectionCount = (lead, id) => Number(lead?.afterCall?.objections?.[id]) || 0;


/* The cold call's eight steps and what a step's Next writes. */
export const CALL_STEPS = [
  { id: 'answer', title: 'Did they answer?' },
  { id: 'who', title: 'Who am I talking to?' },
  { id: 'line', title: 'Say the line' },
  { id: 'said', title: 'What did they say?' },
  { id: 'goal', title: 'Their goal' },
  { id: 'value', title: 'Give the value' },
  { id: 'times', title: 'Two times' },
  { id: 'lock', title: 'Lock it in' },
];
export const startStepFor = (lead) => (lead?.phone ? 1 : 2);

/** The $set a step's Next writes: the saved answers under afterCall plus the step reached; askFor is the lead's own field. */
export function stepSet(lead, fields, step) {
  const ac = lead?.afterCall || {};
  const { askFor, ...rest } = fields;
  const set = { afterCall: { ...ac, ...rest, step } };
  if (askFor !== undefined) set.askFor = askFor;
  return set;
}


/* ── The concept call (CLOSER) ───────────────────────────────────────────────────────────────────────────────────── */
export const CLOSER_LINES = {
  clarify: 'So what made you say yes to a call?',
  goal: "What's the goal right now? Why is that important to you?",
  label: "Got it. The work's good but the brand doesn't match it. That sound right?",
  pain: ["Have you tried fixing this before?", 'Who did it?', "How'd that go?", 'What else?'],
  notOnYou: "Honestly that's not on you. You were missing the piece that ties it together. Want me to show you what I'd do?",
  pillars: "A brand that looks like a real shop, a site people trust on their phone, and a Google listing that sends new customers.",
  gap: "You're here, you want to be here. The gap is a logo people remember, a site that works on a phone, and a Google listing that's set up. That's Web Essentials, $500.",
  highestFirst: 'Launch Plan is $1,200. Most people do $200 a month for six months.',
  urgency: 'I take two builds a month, next open start is the {{date}}.',
  referral: 'Who do you know that\'s as serious about their shop as you?',
  review: "Let's at least book a 30 minute brand review next week.",
};
/** "So what I'm hearing is ..." from their own words. */
export function sayItBack(said, goal = '') {
  const s = String(said || '').trim().replace(/\.$/, '');
  const g = String(goal || '').trim().replace(/\.$/, '');
  if (!s && !g) return "So what I'm hearing is the work's good but the brand doesn't match it. That sound right?";
  return `So what I'm hearing is ${s ? s.charAt(0).toLowerCase() + s.slice(1) : 'the brand is behind the work'}${g ? `, and you want ${g.charAt(0).toLowerCase() + g.slice(1)}` : ''}. That sound right?`;
}
/* Three pillars, each a 30 second client story (seeded from the doc; editable in Settings later). */
export const PILLARS = [
  { id: 'look', label: 'Look', line: 'A brand that looks like a real shop.', story: "A detailer I worked with had great work and a logo off a free site. New mark, new truck decal, and the next month he said people stopped asking if he was legit. Same work, same prices, they just believed it now." },
  { id: 'trust', label: 'Trust', line: 'A site people trust on their phone.', story: "A bakery had a site that took eight seconds to load on a phone and no way to order. One page, fast, a button that works. Orders went from the DMs to the site, and she stopped losing the ones who gave up waiting." },
  { id: 'leads', label: 'Leads', line: 'A Google listing that sends new customers.', story: "A barber had a listing with no photos and the wrong hours. We fixed the listing, added the work, got the reviews flowing. He said the walk-ins started saying they found him on Maps. That listing is the busiest page he has." },
];
export const PITCH_LIMIT_MS = 3 * 60 * 1000;
/* Three beliefs before the ask: the price step stays locked until all three are ticked. */
export const BELIEFS = [
  { id: 'closer', label: 'This gets them closer to the goal', ask: 'Do you think this gets you closer?' },
  { id: 'trust', label: 'They trust me to deliver', ask: 'Do you trust me to do what I say?' },
  { id: 'works', label: 'It works for their shop', ask: 'Will it work for your shop?' },
];
export const beliefsDone = (b) => BELIEFS.every(x => b?.[x.id] === true);

/* The concept call's six steps and its writes: everything under afterCall.closer. */
export const CLOSER_STEPS = [
  { id: 'clarify', title: 'Clarify' },
  { id: 'label', title: 'Label it' },
  { id: 'pain', title: 'Pain cycle' },
  { id: 'pillars', title: 'Three pillars' },
  { id: 'beliefs', title: 'Three beliefs' },
  { id: 'ask', title: 'The ask' },
];
export const emptyPainRow = () => ({ tried: '', howLong: '', result: '' });
export const painFilled = (rows) => (rows || []).filter(r => String(r?.tried || '').trim() && (String(r?.howLong || '').trim() || String(r?.result || '').trim())).length;
/** The $set a closer step writes: the fields under afterCall.closer, the step reached and the time. */
export function closerSet(lead, fields, step, now = Date.now()) {
  const ac = lead?.afterCall || {}; const c = ac.closer || {};
  return { afterCall: { ...ac, closer: { ...c, ...fields, step, at: new Date(now).toISOString() } } };
}
/** A pillar tapped: its stamp under closer.pillars (the first stamp starts the pitch clock). */
export function pillarPatch(lead, id, now = Date.now()) {
  const c = lead?.afterCall?.closer || {};
  return closerSet(lead, { pillars: { ...(c.pillars || {}), [id]: new Date(now).toISOString() } }, c.step || 4, now);
}
/** The pitch clock: ms since the first pillar was tapped, or null before it. */
export function pitchElapsed(closer, now = Date.now()) {
  const stamps = Object.values(closer?.pillars || {}).map(v => new Date(v).getTime()).filter(Number.isFinite);
  return stamps.length ? now - Math.min(...stamps) : null;
}
/** The price step is locked until all three beliefs are ticked (the stall close, docs/HORMOZI-CLOSE.md section 1). */
export const askUnlocked = (closer) => beliefsDone(closer?.beliefs);

/* ── Follow ups after "no decision": day 1, 3 and 7 drafts carrying the saved concern. */
export const FOLLOW_UP_DAYS = [1, 3, 7];
export function followUpText(lead, day, concern = '') {
  const first = String(lead?.askFor || '').trim().split(/[\s,]+/)[0];
  const hi = `Hey${first ? ` ${first}` : ''}, it's Rob.`;
  const c = String(concern || '').trim().replace(/\.$/, '');
  if (day === 1) return `${hi} Good talking yesterday. ${c ? `You said the main thing was ${c.charAt(0).toLowerCase() + c.slice(1)}. ` : ''}Happy to talk that through whenever. The concepts are yours either way.`;
  if (day === 3) return `${hi} Quick one. ${c ? `Still thinking on ${c.charAt(0).toLowerCase() + c.slice(1)}? ` : ''}If it helps, I can walk your partner through the concepts too. Ten minutes.`;
  return `${hi} Last nudge from me. My next open start is coming up and I'd rather it be your shop. If the timing's off, say so and I'll check back in a couple months.`;
}

/* ── New York wall clock (the same approach as src/lib/nextAction.js, kept here so this module stays pure and shared) ── */
const NY = 'America/New_York';
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: NY, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
export const nyParts = (ms) => { const o = {}; for (const p of fmt.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = p.type === 'weekday' ? p.value : Number(p.value); return { y: o.year, m: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, min: o.minute, s: o.second, wd: o.weekday }; };
export function nyMs(y, m, d, h = 0, min = 0) {
  const want = Date.UTC(y, m - 1, d, h, min, 0);
  let guess = want;
  for (let i = 0; i < 3; i++) { const p = nyParts(guess); const diff = want - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s); if (!diff) break; guess += diff; }
  return guess;
}
/** New York wall clock `h:min` on the day `offset` days after `now`'s New York day, as an instant. */
export function nyAt(now, offset, h, min = 0) { const p = nyParts(now); return nyMs(p.y, p.m, p.d + offset, h, min); }
/** The default two times when Calendly is slow or off: today 3:30 PM and tomorrow 10:00 AM New York (past 3:00 PM, tomorrow 10 and the day after 10). */
export function defaultSlots(now = Date.now()) {
  const p = nyParts(now);
  const late = p.h > 15 || (p.h === 15 && p.min > 0);
  const a = late ? nyAt(now, 1, 10) : nyAt(now, 0, 15, 30);
  const b = late ? nyAt(now, 2, 10) : nyAt(now, 1, 10);
  return [a, b].map(ms => new Date(ms).toISOString());
}
/** The slots the stepper offers: Calendly's when they came, else the defaults, each with its label and the source. */
export function slotsFor(calendly, now = Date.now()) {
  const live = Array.isArray(calendly) ? calendly.filter(s => Number.isFinite(new Date(s).getTime())).slice(0, 2) : [];
  const iso = live.length >= 2 ? live : defaultSlots(now);
  return { slots: iso.map(s => ({ iso: s, label: slotLabel(s, now) })), source: live.length >= 2 ? 'calendly' : 'default' };
}
/** "Today 3:30 PM", "Tomorrow 10:00 AM", else "Thu 10:00 AM", in New York. */
export function slotLabel(iso, now = Date.now()) {
  const ms = new Date(iso).getTime();
  const p = nyParts(ms); const n = nyParts(now);
  const dayDiff = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(n.y, n.m - 1, n.d)) / 864e5);
  const h12 = ((p.h + 11) % 12) + 1; const t = `${h12}:${String(p.min).padStart(2, '0')} ${p.h >= 12 ? 'PM' : 'AM'}`;
  return `${dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : p.wd} ${t}`;
}
/** A slot as the record's meeting fields (date, time in New York). */
export function slotToMeeting(iso) { const p = nyParts(new Date(iso).getTime()); return { date: `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`, time: `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`, type: 'call' }; }
/** A callback for later today: two hours on, or tomorrow 10:00 AM New York once that would land past 6 PM. */
export function laterToday(now = Date.now()) {
  const p = nyParts(now + 2 * 3600e3);
  if (p.h >= 18) return new Date(nyAt(now, 1, 10)).toISOString();
  return new Date(now + 2 * 3600e3).toISOString();
}
/** "Build the concept" is due the night before the meeting at 8:00 PM New York. */
export function conceptTaskDue(meeting) {
  const [y, m, d] = String(meeting?.date || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(nyMs(y, m, d - 1, 20, 0)).toISOString();
}
/** The texts the stepper drafts (never sends): the voicemail follow up and the night before reminder. */
export function voicemailText(lead) { return scriptLine(lead, 'voicemail'); }
export function nightBeforeText(lead, meeting) {
  const base = scriptLine(lead, 'nightBefore');
  const t = meeting?.time ? ` ${fmtTime12(meeting.time)}` : '';
  return meeting?.time ? base.replace('tomorrow', `tomorrow at${t}`) : base;
}
export function fmtTime12(hhmm) { const [h, m] = String(hhmm || '').split(':').map(Number); if (!Number.isFinite(h)) return ''; return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; }
/** The DM a lead with no phone gets instead of a dial (the Room shows it with a Copy button). */
export function dmText(lead) {
  const first = String(lead?.askFor || '').trim().split(/[\s,]+/)[0];
  return scriptLine(lead, 'dm').replace('{{first}}', first || 'there').replace('{{business}}', lead?.business || 'the shop').replace(/\s+,/g, ',');
}
/** The invite email the stepper drafts after a yes: the custom template with these blocks. */
export function inviteOverride(lead, meeting) {
  const first = String(lead?.askFor || '').trim().split(/[\s,]+/)[0] || 'there';
  const when = meeting?.date ? `${meeting.date}${meeting.time ? ` at ${fmtTime12(meeting.time)}` : ''}` : 'the time we picked';
  return {
    subject: `Good talking to you, ${first}`,
    preheader: `We're on for ${when}. I'll have your concepts ready.`,
    blocks: [
      { type: 'eyebrow', text: 'Next step' },
      { type: 'heading', text: `Good talking to you, ${first}` },
      { type: 'text', text: `We're on for ${when}. I'll call you then and walk you through a couple of concepts I made for ${lead?.business || 'the shop'}, no charge.` },
      { type: 'text', text: 'If anyone else is part of the decision, bring them along. Any questions before then, just reply here.' },
    ],
  };
}
