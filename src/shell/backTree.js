/* One back stack (email safety, one back stack, the shell: milestone 2).
 *
 * Back goes up exactly one level in a fixed tree, whatever brought the screen up:
 *
 *   Home > section root > record > sub screen (planner, tasks, docs, concepts, quote, compose, showcase, a new project) > the planner's post editor on a phone > sheet
 *   Home > Quotes > a quote (/quotes/:id; the old /leads/:id/quote redirects there, quoteRedirect)
 *   Calls > Queue > Room; Summary backs to Calls
 *   Settings > Design system, Recently Deleted, an emails or notifications tab
 *
 * A screen reached from inside the app carries an origin (nav-history.js) and Back pops the history entry. A
 * screen with no origin (a deep link, a reload, a push notification, a bookmark) backs to its parent here, by a
 * replace, so the stack never grows from a Back. `parentOf` is pure: a path relative to the admin base and its
 * search, to the parent's relative path (with the search it needs), or null at the home. A record is an entry's
 * open state on a root, not a path, so `backTarget` reads the entry: an open or a create on a root backs to the
 * root itself (keeping only the Calls hub's ?section=), everything else goes through parentOf.
 *
 * A record is its own path (/clients/:id, /leads/:id, /deals/:id; an older ?open= link still resolves) and backs to its
 * list; its sub screens back to it. AdminApp moves a record to the section that owns its stage when a link names the
 * wrong one (a client's concepts land on /clients/:id, not /leads/:id).
 * Leads, Lists and Triage are sections of the Calls hub (/calls?section=), so their roots read as Calls.
 * Tested by scripts/back-test.mjs on every nav path and every push deep link. */

/* Section roots: a tab bar, no Back. The home is ''. Leads, lists and triage redirect into the Calls hub; booked
   became deals; design sits under Settings (one level in). */
export const ROOTS = ['', 'pipeline', 'calls', 'deals', 'calendar', 'overview', 'clients', 'projects', 'docs', 'drafts', 'invoices', 'quotes', 'tasks', 'orders', 'concepts', 'reviews', 'submissions', 'landing', 'settings', 'more', 'leads', 'lists', 'triage', 'booked'];
/* The hub's sections: a root of one of these is /calls?section=<it>. */
export const HUB_SECTIONS = ['triage', 'lists', 'leads'];

const norm = (rel) => { let p = String(rel || '/'); if (!p.startsWith('/')) p = `/${p}`; if (p.length > 1) p = p.replace(/\/+$/, ''); return p || '/'; };
const enc = (s) => encodeURIComponent(String(s));
const params = (search) => new URLSearchParams(String(search || '').replace(/^\?/, ''));

/** A section root (the tab bar shows, no Back): the home or one segment named in ROOTS. */
export function isRoot(rel) {
  const p = norm(rel);
  if (p === '/') return true;
  const segs = p.split('/').filter(Boolean);
  return segs.length === 1 && ROOTS.includes(segs[0]);
}

/* A record has its own path (prompt 1b): /clients/:id, /leads/:id, /deals/:id. The section in the path is the one that owns the
   record's stage; AdminApp moves a record to its owner when a link names the wrong one (a client's concepts back to /clients/:id). */
export const RECORD_SECTIONS = ['clients', 'leads', 'deals'];
export const recordPathOf = (section, id) => `/${section}/${enc(id)}`;
/** { section, id } when the path is a record, else null. */
export function recordOf(rel) {
  const m = norm(rel).match(/^\/(clients|leads|deals)\/([^/]+)$/);
  return m ? { section: m[1], id: decodeURIComponent(m[2]) } : null;
}
/** The root a hub section lives at, for a section id (leads, lists, triage) or any other section. */
export const rootPathOf = (section) => (HUB_SECTIONS.includes(section) ? `/calls?section=${section}` : section === 'dashboard' || !section ? '/' : `/${section}`);

/** The parent of a path, one level up the tree; null at the home. */
export function parentOf(rel, search = '') {
  const p = norm(rel);
  const q = params(search);
  if (p === '/') return null;
  if (isRoot(p)) return '/';
  let m;
  // The call console: Calls > Queue > Room; Summary backs to Calls.
  if (/^\/calls\/room\/[^/]+$/.test(p)) return '/calls/queue';
  if (p === '/calls/queue' || p === '/calls/summary') return '/calls';
  if (p.startsWith('/calls/')) return '/calls';
  // A record's sub screens back to the record; the record backs to its list (Leads is a section of the Calls hub).
  if ((m = p.match(/^\/clients\/([^/]+)\/(planner|tasks|docs|showcase)$/))) return recordPathOf('clients', m[1]);
  // Planner v2: the editor on a phone is the planner's own sub screen, /clients/:id/planner/:postId, and backs to the planner.
  if ((m = p.match(/^\/clients\/([^/]+)\/planner\/[^/]+$/))) return `${recordPathOf('clients', m[1])}/planner`;
  if ((m = p.match(/^\/clients\/([^/]+)\/projects\/new$/))) return recordPathOf('clients', m[1]);
  if ((m = p.match(/^\/leads\/([^/]+)\/(concepts|quote)$/))) return recordPathOf('leads', m[1]);
  if ((m = p.match(/^\/lists\/([^/]+)\/fill$/))) return `/calls?section=lists&open=${enc(m[1])}`;
  if (p.startsWith('/email/compose')) { const r = q.get('record'); return r ? recordPathOf('leads', r) : '/'; }
  if (/^\/leads\/[^/]+$/.test(p)) return '/calls?section=leads';
  if (/^\/(clients|deals)\/[^/]+$/.test(p)) return `/${p.split('/')[1]}`;
  if (p === '/projects/new') return '/projects';
  if (/^\/docs\/[^/]+$/.test(p)) return '/docs';
  // A quote backs to Quotes, or to the record it was opened for (?lead=, which the old builder's path carries over).
  if (/^\/quotes\/[^/]+$/.test(p)) { const l = q.get('lead'); return l ? recordPathOf('leads', l) : '/quotes'; }
  // Settings holds the design system, Recently Deleted and its tabs.
  if (p === '/design') return '/settings';
  // Billy's day is a page under Settings > Team > Billy, so it backs to the Team group, not to the Settings list.
  if (p === '/settings/team/day') return '/settings/team';
  if (p.startsWith('/settings/')) return '/settings';
  if (p.startsWith('/booked/')) return '/deals';
  // Anything else: one segment up.
  const segs = p.split('/').filter(Boolean);
  return segs.length <= 1 ? '/' : `/${segs.slice(0, -1).join('/')}`;
}

/** The old quote builder's path, /leads/:id/quote, is the Quotes page now: that lead's newest quote when it has one (its id is passed
 *  in), else a new quote for that lead with the package from the link. Both carry ?lead= so Back still lands on the record. null for
 *  any other path. */
export function quoteRedirect(rel, search = '', newestQuoteId = '') {
  const m = norm(rel).match(/^\/leads\/([^/]+)\/quote$/);
  if (!m) return null;
  const lead = decodeURIComponent(m[1]);
  if (newestQuoteId) return `/quotes/${enc(newestQuoteId)}?lead=${enc(lead)}`;
  const pkg = params(search).get('pkg');
  return `/quotes/new?lead=${enc(lead)}${pkg ? `&pkg=${enc(pkg)}` : ''}`;
}

/** Where Back lands for an entry with no origin: { rel, search, state } (rel relative to the base) to a relative path, or null at a root with nothing open. */
export function backTarget(rel, search = '', state = null) {
  const p = norm(rel);
  if (state?.open || state?.create) {
    if (isRoot(p)) {
      const section = params(search).get('section');
      return p === '/' ? '/' : (p === '/calls' && section && HUB_SECTIONS.includes(section) ? `/calls?section=${section}` : p);
    }
    return parentOf(p, search);
  }
  if (isRoot(p)) return null;
  return parentOf(p, search);
}

/** The console mode a path names: builder at /calls, queue, room or summary under it. */
export function callsModeOf(rel) {
  const p = norm(rel);
  if (p === '/calls/queue') return 'queue';
  if (/^\/calls\/room\/[^/]+$/.test(p)) return 'room';
  if (p === '/calls/summary') return 'summary';
  return 'builder';
}
/** The path of a console mode (the room needs the current lead's id). */
export const callsPathOf = (mode, id = '') => (mode === 'queue' ? '/calls/queue' : mode === 'room' ? `/calls/room/${enc(id || 'current')}` : mode === 'summary' ? '/calls/summary' : '/calls');

/* ── Billy's Call Room (/room on the admin host): its own small tree ────────────────────────────────────────────────
 *
 *   Calls (Today | Triage | Leads | Lists)   Callbacks   Me      three roots, each a tab; the hub's segment is ?section=
 *   Calls > a lead > the call room                               the lead card backs to where it was opened from, the call room to its lead
 *   Calls > a lead > booking                                     booking backs to the lead; once booked, the Booked screen backs to Calls
 *   Calls > the session summary                                  backs to Calls
 *
 * Paths are relative to the room's base. A root has no Back (roomParentOf answers null); every other screen is focused
 * (the tab bar hides). Tested by scripts/back-test.mjs. */
export const ROOM_ROOTS = ['', 'callbacks', 'me'];
export const ROOM_SECTIONS = ['today', 'triage', 'leads', 'lists'];
export function isRoomRoot(rel) {
  const segs = norm(rel).split('/').filter(Boolean);
  return segs.length === 0 || (segs.length === 1 && ROOM_ROOTS.includes(segs[0]));
}
/** The parent of a Call Room path, one level up; null at a root. `search` carries ?from= (the place a lead card was opened from). */
export function roomParentOf(rel, search = '') {
  const p = norm(rel);
  if (isRoomRoot(p)) return null;
  let m;
  if ((m = p.match(/^\/(call|book)\/([^/]+)$/))) return `/lead/${m[2]}`;
  if (/^\/lead\/[^/]+$/.test(p)) {
    const from = params(search).get('from');
    if (from === 'callbacks') return '/callbacks';
    return ROOM_SECTIONS.includes(from) && from !== 'today' ? `/?section=${from}` : '/';
  }
  return '/';
}
/** The chrome mode of a Call Room path: tabs on a root, focused everywhere else (the lead card, the call room, booking, the summary). */
export const roomChromeOf = (rel) => (isRoomRoot(rel) ? 'tabs' : 'focused');
/** The tab a Call Room path belongs to. */
export const roomTabOf = (rel) => { const seg = norm(rel).split('/').filter(Boolean)[0] || ''; return seg === 'callbacks' ? 'callbacks' : seg === 'me' ? 'me' : 'calls'; };
