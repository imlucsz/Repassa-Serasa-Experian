'
# Testing and acceptance
Do not claim green without actual commands/results. CI checks guard, root frontend `npm ci`, `npm run lint` (currently TS noEmit), `npm run build`, and `npm run test:ci` once tests exist. Root existing lint may traverse nested TS because tsconfig excludes only dist; frontend foundation fixes this and records baseline. Backend once `backend/package.json` exists must have lockfile and meaningful `lint`, `build`, `test:ci`, `db:migrate:deploy`. CI uses disposable Postgres 16. No shared DB credentials. Implement tests before declaring P0 done. UI E2E via Playwright in integration task, do not claim included yet; add reproducible CI command and browser install then.

| Case | Expected | Layer |
|---|---|---|
| signup with role/staff injection | reject, all public accounts STUDENT | API |
| bad login / disabled account | generic failure | API |
| refresh rotate/reuse/logout | revoked session fails, cookie correct | API |
| other student history / staff different institution | forbidden or hidden 404; no other data | API |
| donation pending | not in public catalog | DB/API/E2E |
| receive wrong institution / repeated receipt | 403/404 or 409, no duplicated events | API |
| receipt then catalog | visible only after confirm | E2E |
| 2+ simultaneous reservation attempts | exactly one active reservation + RESERVED | real PostgreSQL |
| reserve own item | reject | API |
| cancel/expire vs pickup race | one valid terminal outcome, no duplicate delivery | real PostgreSQL |
| exact expiry boundary | code invalid, availability restored | real PostgreSQL |
| wrong institution/invalid/expired/reused code | no mutation; scoped generic failure | API |
| unauthorized upload / invalid type / oversized | rejected safely, no orphan exposure | API |
| shelf N=0,1,2,12,>12 filters | no crash, no NaN, stable navigation | frontend unit |
| route change from shelf / forms | no hijacked wheel/keyboard/hidden pointer | UI |
| deep link, reload, login redirect | correct page/auth state | UI |
| complete cross-role flow | persists after reload; code single-use | E2E |
| 390/768/1440, reduced motion, keyboard | usable without shelf animation | UI/manual |
| error/slow API | explicit states, no fake success or silent mocked fallback | UI |

PR evidence: commands, actual pass/fail/skip counts and environment; screenshot for UX, API example/DB migration for BE, risks and follow-up. Manual demonstration includes real backend and synthetic data, no production. Security review cross-role, rate limiting and secret redaction. CI must require tests when new module exists; no empty test scripts. Manual QA on actual presentation device and network, keep offline recorded demo backup.
