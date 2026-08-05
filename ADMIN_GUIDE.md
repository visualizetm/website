# Admin Panel & Notifications Guide

## The admin panel — `admin.visualizeclients.com`

The panel lives on its own subdomain. `https://admin.visualizeclients.com` opens
the login/dashboard directly; the Call Console is `/calls` and the print
dashboard is `/prints` on that subdomain. The public site no longer serves the
panel — `visualizestudio.org/admin` redirects to the homepage (blocked at the
edge via vercel.json). Localhost still serves `/admin` for development.

- Not linked anywhere public. Sign in **once** with the `ADMIN_PASSWORD` you set in Vercel.
- Sessions last 30 days per device (secure HttpOnly cookie — the password is never stored in the browser).
- **One password for everything.** The old print-shop dashboard used a separate
  `VITE_ADMIN_PASSWORD` — that's gone. `/admin/prints` now shares this same login;
  if you open it without being signed in, it bounces you to `/admin`.
- **Overview** (dashboard): time-based greeting, four stat cards (Total Leads,
  New/Unread, In Pipeline, Landed), an 8-week leads chart, a pipeline breakdown,
  and recent activity — the landing view.
- **Leads** tab: every `/start` brief and shop order, stored in MongoDB.
  - Status pipeline: New → Contacted → Replied → Landed / Denied
  - Private notes, read/unread, unread badge, search (name/business/email), filter by status, type, and date range.
- **Print Shop** button (top right) opens the print-orders dashboard at `/admin/prints` — no second sign-in.

## Turn on notifications on your iPhone (do this once)

iOS only delivers web push to sites installed on the Home Screen (iOS 16.4+):

1. Open **Safari** → `admin.visualizeclients.com`
2. Tap **Share** (square with arrow) → **Add to Home Screen** → Add
3. Open the new **Visualize.** app icon from your Home Screen
4. Sign in, tap **Enable notifications**, and **Allow**

If you previously installed the app from visualizestudio.org, delete that icon
and re-install from the subdomain — push subscriptions are per-domain, and new
lead notifications now deep-link to the subdomain.

That's it. Every new submission now pushes to your phone with the business
name and service type. Tapping the notification opens the admin panel
directly on that submission.

Desktop Chrome/Edge also works: just visit `/admin` and click Enable
notifications (no install required).

## Email backup — always on

Every submission is also emailed to **contact@visualizeclients.com** (via the
Web3Forms key in `WEB3FORMS_NOTIFY_KEY`), so nothing is missed even if push
fails or you get a new phone. The email includes a direct "Open in Admin" link.

## Environment variables (already set in Vercel)

`MONGODB_URI` · `ADMIN_PASSWORD` · `SESSION_SECRET` · `VAPID_PUBLIC_KEY` ·
`VAPID_PRIVATE_KEY` · `WEB3FORMS_NOTIFY_KEY`

**Delete `VITE_ADMIN_PASSWORD`** from Vercel — nothing uses it anymore. Both
`/admin` and `/admin/prints` now authenticate against `ADMIN_PASSWORD`
server-side only. (The old value shipped inside the public JS bundle, which was
readable by anyone; that hole is now closed.)
