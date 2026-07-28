# Admin Panel & Notifications Guide

## The admin panel — `/admin`

- Not linked anywhere public. Sign in with the `ADMIN_PASSWORD` you set in Vercel.
- Sessions last 30 days per device (secure HttpOnly cookie — the password is never stored in the browser).
- **Leads**: every `/start` brief and shop order lands here automatically, stored in MongoDB.
  - Status pipeline: New → Contacted → Replied → Landed / Denied
  - Private notes, read/unread, unread badge, search (name/business/email), filter by status, type, and date range.
- **Print Shop (legacy)** button opens the old print-orders dashboard at `/admin/prints`.

## Turn on notifications on your iPhone (do this once)

iOS only delivers web push to sites installed on the Home Screen (iOS 16.4+):

1. Open **Safari** → `visualizestudio.org`
2. Tap **Share** (square with arrow) → **Add to Home Screen** → Add
3. Open the new **Visualize.** app icon from your Home Screen
4. Go to `/admin`, sign in, tap **Enable notifications**, and **Allow**

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

After confirming `/admin` login works, **delete `VITE_ADMIN_PASSWORD`** from
Vercel — the old admin's password shipped inside the public JS bundle; the new
login checks the password server-side only.
