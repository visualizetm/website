# Client app: decisions

The job is docs/CLIENT-APP-PROMPT.md. Each call made without asking, with the rule that decided it.

1. (1) The dev switch is a path prefix, the way the admin's is: on localhost the client app lives under /app (APP_BASE, appPath() and isAppPath() in src/lib/adminPaths.js), and the pre-paint script treats /app like the app host. Plainer than a query flag, and the audits reach it on the preview server.
2. (1) Maintenance mode stays off the app host as it does the admin: a client's own panel is not the public site.
3. (1) The app host's CSP is the public site's own policy (images from any https host, media and connect only from Cloudinary, the pinned inline script, frame-ancestors 'none'), plus Cache-Control no-store. It is the strictest block the portal and the planner run under today; nothing they load needs more.
4. (1) Until the data doors move to the cookie (milestone 3), the app host serves /c/:token and /planner/:token with the existing pages, so the host works from its first deploy and nothing breaks in between.
5. (1) The app host's / no longer preloads the marketing Home chunk (the pre-paint script skips it on the app host).
6. (2) A lockout is counted on consecutive wrong codes: the 5th locks fifteen minutes, a try during that lock is refused unread and not counted, the 6th to 9th after it are counted without a new lock, the 10th locks until Rob resets it. Plainer than a lock on every multiple of five.
7. (2) The lock is told (423 with the minutes, or hard) only to someone holding the setup link or the right code. By phone or email a wrong code during a lock is the same 401 as any other miss, so locking a phone out never tells a stranger it belongs to a client.
8. (2) A hard lock does not sign out devices already in: the lock guards the door, and a stranger locking the code must not lock the real client out of a phone already signed in. Rob's Reset code does sign every device out.
9. (2) Rob's push on the hard lock uses category client (Client activity), the closest existing one: it is about one client's account, like an approval or an idea.
10. (2) Two clients sharing one phone or email both get the plain 401 by that identifier; each still signs in from their own link. Safer than guessing which one.
11. (2) The CRM's list read and the backup carry portal.code as its status only (set, setAt, locked, lockedUntil, fails), never the hash or the salt: four digits behind a leaked hash are ten thousand guesses away. Restore is out of scope, so a backup never needs the hash.
12. (2) Reset code lives on a new admin route, client-app (POST reset-code), behind route(); milestone 5 adds Rob's read only previews there. It ships in milestone 2 because the guard proof needs it.
13. (2) The code door's set step needs both fours (code and again) on the server too, not only on the screen.
