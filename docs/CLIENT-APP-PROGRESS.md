# Client app: progress

The job is docs/CLIENT-APP-PROMPT.md. Resume line: "Continue the client app job from docs/CLIENT-APP-PROMPT.md."

| Milestone | State | Commit | Notes |
| --- | --- | --- | --- |
| 1. Host and shell | done | ecbdde1 (2026-11-24) | Live after the push: https://app.visualizeclients.com/ 200 and /app.webmanifest 200, both Cache-Control no-store with the app CSP (read through Vercel's fetch: this sandbox's proxy refuses the host to curl) |
| 2. The code door | done | see git log ("Client app, 2") | client-app-test 70 checks, client-app-guard-proof 13 cuts |
| 3. The data doors move to the cookie | next | | |
| 4. The client screens | | | |
| 5. Links, pushes and Rob's side | | | |
| 6. The gate and the report | | | |

Next action: milestone 3, /api/portal and /api/planner read the lead from the vz_client cookie.
