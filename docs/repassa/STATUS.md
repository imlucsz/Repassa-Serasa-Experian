# Status — initial snapshot 19/11/2026
Not a claim of completed implementation. Current GitHub inspection: frontend Vite/React 19/TypeScript with isolated visual prototype (film shelf/detailed reveal), no backend or route structure found on main; video subtree exists. `npm ci`, `lint`, `build` and baseline frontend behavior not run in this kit environment. Kit guard tests run separately; check final delivery notes. Deadlines: 07/12 integrated target, 12/12 presentation.

| ID | Status | Evidence / blocker |
|---|---|---|
| SH-01 | integrated into baseline | initial kit snapshot; absorbed into main history — no dedicated PR |
| DEV-01 | merged (PR #3) | NestJS/Fastify/Prisma/PG16 foundation; CI backend-quality green |
| DEV-02 | merged (PR #8, `b17e862`) | auth register/login/refresh/logout, GET/PATCH /me, /institutions + /me/institutions; Argon2id, HS256 access JWT, refresh rotation w/ replay revocation, CSRF marker + origin allowlist, per-IP/identity rate limits; 43 unit + 55 e2e on disposable PG16, 4/4 CI checks green |
| DEV-03..06 | merged (PRs #13/#17/#19/#21 `1cb095a`) | materials/donations/reservations/admin + security & concurrency review |
| UX-01..05 | merged (PRs incl. #20, #22, #23) | catalog, donations, reservations/pickup, admin experience + axe coverage |
| SH-02 | merged (PR #25, `a2fb35d`) | journey 17/17 + security 23/23 + recovery 3/3 on disposable PG16; see `evidence/sh-02/` and `RUNBOOK.md`; open blockers: Render plan (sleep observed vs starter blueprint), rate-limit per replica |
| SH-03 | merged (PR #24, `8b0fd31`) | admin experience refinement; admin.spec + admin-a11y 25/25 incl. 16 axe checks; see `evidence/sh-03/` |
| RC-01 | merged (PR #26, `9c8e626`) | release readiness on `a2fb35d`: hosted audit, full SH-02 harness rerun on post-SH-03 main (17/17 journey, 23/23 security, 3/3 recovery); see `evidence/rc-01/` and `RUNBOOK.md` |
| UX-06.1 | ready for owner review (PR #30, `feat/DEV-UX-06-1-qa`) | catalog QA on `796448b` + owner-authorized fixes: mobile shelf tap-to-open (pointerup activation), bounded caption title, pickup institution line; demo 11/11, api 52/52, unit 41/41, PERF-01 zero idle rAF; see `evidence/ux-06-1/` |

Update after each merged PR or link to active PR in handoff. Avoid concurrent edits to this file; prefer PR description and update at merge/owner coordination. For each task record branch/PR, actual tests and counts, known limitations, next dependency. Never mark completed from agent summary alone; use commit/check evidence and demo verification.
