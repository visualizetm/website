# Client app: progress

The job is docs/CLIENT-APP-PROMPT.md. Resume line: "Continue the client app job from docs/CLIENT-APP-PROMPT.md."

| Milestone | State | Commit | Notes |
| --- | --- | --- | --- |
| 1. Host and shell | done | ecbdde1 (2026-11-24) | Live after the push: https://app.visualizeclients.com/ 200 and /app.webmanifest 200, both Cache-Control no-store with the app CSP (read through Vercel's fetch: this sandbox's proxy refuses the host to curl) |
| 2. The code door | done | c88ce61 (2026-11-24) | client-app-test 70 checks, client-app-guard-proof 13 cuts |
| 3. The data doors move to the cookie | done | eb08935 (2026-11-24) | pushed with 4 (decision 14); migrated counts in decision 19 |
| 4. The client screens | done | see git log ("Client app, 4") | client-app-ui-test 60 checks; a11y over the app, portal and planner 138 rows, 0 violations |
| 5. Links, pushes and Rob's side | next | | |
| 6. The gate and the report | | | |

Next action: milestone 5, CLIENT_APP_BASE for every client URL, push deep links to app paths, the CRM's code status and Reset code, Rob's read only previews.
