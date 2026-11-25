'
# Roadmap to 12/12/2026 (targets, not promises)
19–20 Nov: foundation docs/contract/guard approval and baseline (`SH-01`). 21–24 Nov: backend boot/auth, frontend routes/design and shelf extraction. 25 Nov–1 Dec: donations, stock, reservation flows. 29 Nov–4 Dec: staff UI/pickup and integration. 2–7 Dec: end-to-end integration and test/deploy. 8–10 Dec: fix bugs, visual polish, accessibility, rehearsal. 11 Dec freeze; 12 Dec presentation. If schedule slips, cut P1 and elaborate animation, never data integrity or cross-tenant checks.

| ID | Agent | Task | Dependencies / acceptance |
|---|---|---|---|
| SH-01 | Owner/both | merge docs/contract/guard | agree defaults, check CI baseline, protect main |
| DEV-01 | Devin | Nest bootstrap and Prisma migration | SH-01; health, DB migration, test scripts and CI pass |
| UX-01 | Codex | routes, layouts, tokens, scoped shelf | SH-01; preserve shelf behavior, responsive baseline, isolate TS config, tests |
| DEV-02 | Devin | auth, user, institution membership | DEV-01; role/ownership tests, auth cookies and session refresh |
| UX-02 | Codex | home, login/register, catalog/detail | UX-01; typed mock adapter explicit; accessible mobile/desktop; auth integration when ready |
| DEV-03 | Devin | donations/upload/receipt/stock | DEV-02; pending invisible, wrong tenant rejected, data persisted |
| UX-03 | Codex | donate, history, profile, staff receipt/stock | UX-01, API contract; integrate DEV-02/03 endpoints |
| DEV-04 | Devin | reserve/cancel/expiry/pickup/dashboard | DEV-03; real Postgres concurrency/security tests |
| UX-04 | Codex | reservations, pickup and staff dashboard | UX-03; integrate DEV-04, no fake state |
| SH-02 | both | integrated E2E + deployment | DEV-04/UX-04; full demo flow, smoke test and error handling — **verified 25/11**: journey 17/17, security 21/21, recovery 3/3 (`tests/live/`, `RUNBOOK.md`, `evidence/sh-02/`); deploy blockers list owner actions |
| SH-03 | owner/both | polish, freeze, rehearsal | SH-02; all P0 verified or limitations disclosed, backup video |

Do not assign 10 overlapping PRs at once. Two agents can run parallel within ownership. Each task leads to PR; close only with evidence. If backend foundation behind schedule, keep UI explicitly mock for development and prioritize auth + donation/receipt + reserve/pickup over secondary pages. Production rollout and paid services separate owner approval.
