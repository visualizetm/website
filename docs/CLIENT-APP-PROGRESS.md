# Client app: progress

The job is docs/CLIENT-APP-PROMPT.md. Resume line: "Continue the client app job from docs/CLIENT-APP-PROMPT.md."

| Milestone | State | Commit | Notes |
| --- | --- | --- | --- |
| 1. Host and shell | done | ecbdde1 (2026-11-24) | Live after the push: https://app.visualizeclients.com/ 200 and /app.webmanifest 200, both Cache-Control no-store with the app CSP (read through Vercel's fetch: this sandbox's proxy refuses the host to curl) |
| 2. The code door | done | c88ce61 (2026-11-24) | client-app-test 70 checks, client-app-guard-proof 13 cuts |
| 3. The data doors move to the cookie | done | eb08935 (2026-11-24) | pushed with 4 (decision 14); migrated counts in decision 19 |
| 4. The client screens | done | 656ae09 (2026-11-24) | client-app-ui-test 60 checks; a11y over the app, portal and planner 138 rows, 0 violations |
| 5. Links, pushes and Rob's side | done | see git log ("Client app, 5") | client-app-test 91, guard proof 18 cuts, client-app-ui-test 86; after the 3 and 4 push: app.visualizeclients.com/api/app/me 200, visualizestudio.org/c/<token> 307 to the app host |
| 6. The gate and the report | next | | |

Next action: milestone 6, run every script in RULES THAT HOLD and every guard proof, fix what fails, the docs and reports/CLIENT-APP-REPORT.md.
