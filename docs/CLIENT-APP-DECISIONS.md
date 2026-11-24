# Client app: decisions

The job is docs/CLIENT-APP-PROMPT.md. Each call made without asking, with the rule that decided it.

1. (1) The dev switch is a path prefix, the way the admin's is: on localhost the client app lives under /app (APP_BASE, appPath() and isAppPath() in src/lib/adminPaths.js), and the pre-paint script treats /app like the app host. Plainer than a query flag, and the audits reach it on the preview server.
2. (1) Maintenance mode stays off the app host as it does the admin: a client's own panel is not the public site.
3. (1) The app host's CSP is the public site's own policy (images from any https host, media and connect only from Cloudinary, the pinned inline script, frame-ancestors 'none'), plus Cache-Control no-store. It is the strictest block the portal and the planner run under today; nothing they load needs more.
4. (1) Until the data doors move to the cookie (milestone 3), the app host serves /c/:token and /planner/:token with the existing pages, so the host works from its first deploy and nothing breaks in between.
