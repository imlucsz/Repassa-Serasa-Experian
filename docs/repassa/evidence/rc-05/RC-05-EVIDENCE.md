# RC-05 evidence — final integrated release-candidate validation

Date: 2026-11-28
Branch: `test/RC-05-integrated-release`
Exact tested commit: `17111e6b05bcb43975f7ce626fb8f2675c7e54f2`
Baseline: exact `origin/main`; no application source code was changed for this validation.

## 1. Verdict

**CONDITIONAL GO**

- **GO for the integrated application code at `17111e6`**: the complete controlled validation passed with no confirmed P0/P1/P2 application defect.
- **CONDITIONAL for production/deployment**: production was intentionally not mutated or deployed. Release remains conditional on the owner-approved production verification checklist in §11, especially the already documented hosting-plan mismatch, production object-storage configuration, secrets, migration smoke checks and demo rehearsal.

This is not a claim that production is currently correct; it is evidence that the exact integrated release candidate works correctly in a controlled local stack using the real frontend, compiled backend, disposable PostgreSQL 16 and controlled local object storage.

## 2. Scope and boundaries observed

Validated:

- anonymous visitor, student, staff and administrator journeys;
- official cinematic Home and original promotional film;
- catalog, 3D shelf, material detail, login/profile/history surfaces;
- institutional receipt/stock/pickup operations;
- administrative institutions/users/materials/reservations/audit operations;
- cross-institution isolation, reservation concurrency, cancellation and expiry;
- upload privacy and real object retrieval;
- password-reset credential/session invalidation;
- refresh rotation, replay protection, backend restart and persistence.

Not performed:

- no production mutation, deploy, infrastructure change or dependency upgrade;
- no feature development or redesign;
- no merge into `main`;
- no use of OmniRoute or external paid providers.

The main checkout and unrelated pre-existing worktrees/processes were not cleaned or modified. Validation ran in the isolated worktree `C:\Users\Administrator\Documents\Repassa-RC-05`.

## 3. Environment and dependency versions

Raw artifact: `logs/environment-versions.txt`.

| Component | Version / value |
|---|---|
| Commit | `17111e6b05bcb43975f7ce626fb8f2675c7e54f2` |
| Host shell | Windows/MSYS2 (`MINGW64_NT-10.0-26200`) |
| Node | v24.14.0; backend declares `>=22.12` |
| npm | 11.9.0 |
| Python | 3.13.15 |
| RTK | 1.2.1 |
| Vite | 8.3.7 |
| Playwright | 1.65.1 |
| Prisma / Prisma Client | 6.19.3 |
| embedded-postgres | 16.16.0-beta.19 |
| Disposable database | PostgreSQL 16, loopback only |

No `graphify-out/graph.json` or `.graphify/graph.json` existed in this exact checkout, so no graph output was used as evidence. RTK was available but exact raw outputs were preserved where failures/counts mattered.

## 4. Controlled disposable stack

Launcher: `tests/live/start-disposable-stack.mjs` at the exact baseline.

Observed controlled endpoints/resources:

- frontend: `http://127.0.0.1:5272` (port changed because 4272 was already occupied during validation);
- backend: `http://127.0.0.1:3001/api/v1`;
- PostgreSQL: loopback port `55434`, database `repassa_test`;
- object storage: launcher-owned temporary local directory;
- manifest: launcher-owned temporary `stack-manifest.json`.

Launcher verification flags were true for PostgreSQL readiness, migrations, backend-login proof against the disposable DB, local object storage, frontend proxy health and sanitized environment. Direct backend `/health` and frontend-proxied `/api/v1/health` both returned HTTP 200 `{"status":"ok"}` with no redirect. Raw bodies: `logs/api-health-body.json`, `logs/proxy-health-body.json`.

The controlled harness guard was not bypassed. It requires loopback endpoints, a disposable/test database name, manifest consistency, no redirects and proof that a fresh backend login mutates the exact disposable database. No inherited production database URL, Supabase configuration, auth secret or application deployment variable was used.

Both committed migrations were applied fresh by backend E2E setup:

- `20261120014024_init`
- `20261124230000_institution_approval_status`

## 5. Full regression results at this commit

Current RC-05 counts, not reused historical counts:

| Check | Current result | Artifact |
|---|---:|---|
| Frontend unit tests | **44/44 passed** | `logs/frontend-unit.txt` |
| Frontend typecheck (`npm run lint`) | pass | `logs/frontend-typecheck.txt` |
| Frontend production build | pass, Vite 8.3.7, 1717 modules | `logs/frontend-build.txt` |
| Complete Playwright browser suite | **112/112 passed** | `logs/frontend-playwright.txt` |
| Backend unit tests | **52/52 passed**, 6/6 suites | `logs/backend-unit.txt` |
| Backend E2E tests | **128/128 passed**, 13/13 suites | `logs/backend-e2e.txt` |
| Backend typecheck (`npm run lint`) | pass | `logs/backend-typecheck.txt` |
| Backend build | pass | `logs/backend-build.txt` |
| Harness safety tests | **18/18 passed** | `logs/harness-safety-tests.txt` |
| Agent-guard test suite | **8/8 passed** | `logs/agent-guard-tests.txt` |
| Frontend/root production dependency audit | **0 vulnerabilities** | `logs/frontend-npm-audit-production.txt` |
| Backend production dependency audit | **0 vulnerabilities** | `logs/backend-npm-audit-production.txt` |
| `git diff --check` / staged diff check | pass | command exit 0 |
| Final `node scripts/agent-guard.mjs staged` | pass | `logs/final-agent-guard.txt` |

Notes:

- Backend Jest prints the known experimental VM-modules warning and the configured E2E command exits through `--forceExit`; these are pre-existing test-runtime characteristics, not application failures.
- The Playwright `api` project does **not** use the real integrated backend: its API traffic is intercepted with synthetic fixtures. Therefore the 112/112 suite is browser/UI evidence in demo and intercepted-API modes, not live-backend integration evidence. Live-backend browser evidence is the journey plus the focused browser QA in §8.

## 6. Integrated live journey

Command: `node tests/live/sh02-journey.mjs` against the controlled launcher.

Result: **17/17 passed**. Sanitized raw artifact: `logs/live-journey.sanitized.txt`.

Validated real API/database outcomes:

1. public student registration;
2. institutional self-registration;
3. pending institution invisible publicly;
4. administrative approval persisted;
5. member assignment promoting the staff user;
6. two donations created;
7. pending donations invisible in the public catalog;
8. authorized staff receipt publishing both materials as `AVAILABLE`;
9. reservation creation and secure pickup-code revelation;
10. staff pickup confirmation;
11. reuse of the same pickup code refused;
12. reservation history containing one `COMPLETED` and one `CANCELED` reservation;
13. canceled material returned to the catalog;
14. administrator metric showing one completed pickup;
15. audit events covering registration, approval, membership assignment, donation, receipt, reservation, pickup, cancellation and logins.

Audit action sequence included `admin.provision`, `institution.register`, `admin.institution_approve`, `admin.membership_assign`, `material.donate`, `material.receive`, `reservation.create`, `reservation.pickup` and `reservation.cancel`.

Journey screenshots are under `screenshots/journey-*.png`. The screenshot that intentionally displayed the one-time pickup code was **excluded** from committed evidence.

## 7. Live security, session and recovery validation

### 7.1 Main security pass

Command: `node tests/live/sh02-security.mjs`.

Result: **24/24 passed**. Sanitized raw artifact: `logs/live-security.sanitized.txt`.

Validated:

- anonymous admin access → 401;
- STUDENT/STAFF admin access → 403;
- symmetric cross-institution staff isolation → 403;
- student forbidden from staff material management;
- concurrent reservation race produced exactly one 201 and one 409;
- winning reservation remained `ACTIVE` with a code;
- cross-tenant pickup refused without damaging the reservation;
- expiry helper expired exactly one reservation;
- expired material returned to `AVAILABLE`;
- owner history showed `EXPIRED` and `reservation.expire` was audited;
- refresh cookie was `HttpOnly`, `SameSite=Strict`, path `/api/v1/auth`, max-age 604800;
- refresh rotation produced a new access token;
- pickup code was not exposed in admin reservation views;
- duplicate institution registration → 409;
- institution-registration rate limiting produced 429 after the allowed burst.

### 7.2 Upload privacy, real retrieval and password-reset invalidation

Supplemental controlled probe: `rc05-supplemental-live-validation.mjs`.

Result: **21/21 passed**. Artifact: `logs/live-supplement.txt`.

Validated against real API responses and the local object store:

- authenticated PNG upload accepted;
- donation accepted only with the uploader's own `uploadId`;
- pending image returned 404 anonymously;
- pending image returned 200 with real PNG bytes to the donor;
- pending image returned 404 to an unrelated student;
- pending image returned 200 to authorized staff in the same institution;
- pending image returned 404 to staff in another institution;
- object existed in the controlled local object storage directory;
- administrative out-of-band password reset revoked all refresh sessions;
- an access token issued before reset was rejected immediately with 401;
- the pre-reset refresh cookie could not rotate;
- old password was rejected and new password accepted;
- a new access token could read the donor's still-private image;
- reset audit metadata existed without password, hash or token material;
- after authorized receipt, the `AVAILABLE` image became publicly retrievable with real bytes;
- donor history remained consistent after reset and receipt.

The immediate access-token invalidation is implemented through a keyed password-credential fingerprint in the JWT compared with the current credential server-side; it does not expose the password hash as a JWT claim.

### 7.3 Controlled backend restart and recovery

The backend process alone was restarted while preserving the same loopback database, upload directory, ports and sanitized environment. Script: `restart-controlled-backend.mjs`; artifact: `logs/backend-restart.txt`.

Command: `node tests/live/sh02-security.mjs --recovery`.

Result: **3/3 passed**. Artifact: `logs/live-recovery.sanitized.txt`.

Validated: post-restart health, login and persistence.

Additional opaque-session probe: `post-restart-session-validation.mjs`.

Result: **5/5 passed**. Artifact: `logs/post-restart-session.txt`.

Validated:

- refresh session issued before restart still rotated after restart;
- the replaced refresh cookie could not be replayed;
- the rotated access token authorized `/me`;
- persisted donation history remained accessible through the recovered session.

Restart note: the controlled restart intentionally generated a new local JWT signing secret, as a process crash/host restart would do. Opaque refresh sessions are database-backed and survived; pre-restart stateless access JWTs are not expected to survive a signing-secret rotation. This is a harness/environment property, not an application defect.

## 8. Integrated browser QA against the real backend

Focused live-browser probe: `rc05-live-browser-qa.mjs`.

Result: **12/12 passed**. Artifact: `logs/browser-qa-live.txt`; screenshots: `screenshots/*.png`.

Validated with real backend responses and no JavaScript page errors:

- official cinematic Home heading and original promotional film playback;
- catalog 3D shelf with live data and keyboard operation;
- material detail opened from catalog data;
- skip-link-first keyboard order on Home;
- mobile navigation at 390px with no horizontal overflow;
- reduced-motion final content, zero running animations and accessible grid default;
- real student login, profile and donation history;
- real reservation history without exposing a pickup code;
- staff dashboard, receipts, stock and pickup surfaces in the authorized institution scope;
- admin overview, institutions, users, materials, reservations and audit surfaces.

The first drafts of this ad-hoc QA probe failed because of probe-specific issues: a shelf element re-rendered after keyboard movement, ambiguous unscoped selectors matched duplicate/footer or duplicated card text, and the admin password environment variable was initially omitted. The probe was corrected to use fresh-page initial focus, scoped/semantic selectors and correct grid markup. No application code or assertion was weakened; the final 12/12 run passed unchanged application behavior. The pre-existing Playwright suite independently passed 112/112 and includes deeper axe, keyboard, responsive and reduced-motion checks in its intended demo/intercepted modes.

## 9. Error handling and negative paths

Evidence across the live journey, security suite, supplemental probe and browser QA covered:

- validation/conflict responses without false success;
- authentication 401 and authorization 403/404 boundaries;
- duplicate institution 409;
- concurrent reservation conflict 409;
- pickup-code reuse refusal;
- cross-tenant refusal;
- rate-limit 429;
- expired/canceled terminal states;
- refresh replay refusal;
- inaccessible private image returning 404 rather than leaking existence;
- browser loading/error/empty/unauthorized states in the 112-test suite.

No silent mock fallback was used in the controlled live journey: the frontend was served in API mode through the Vite proxy to the compiled backend.

## 10. Findings

### P0

None confirmed.

### P1

None confirmed.

### P2

None confirmed.

### Non-defect observations / limitations

1. The controlled live stack uses local object storage by design. Production must use a durable configured driver; `STORAGE_DRIVER=local` is intentionally refused in production.
2. The Playwright `api` project is intercepted-fixture evidence, not real-backend integration evidence.
3. Backend E2E uses the configured `--forceExit`; Jest suggests handle detection. This did not hide a failing test, but remains a test-runtime hygiene item.
4. Graphify graph artifacts were absent in this exact checkout, so graph evidence was not applicable.
5. The controlled stack ports are environment-specific; reproducibility requires using the manifest emitted by a fresh launcher run.
6. The validation stack and synthetic database are disposable and are not production-capacity/performance evidence.

## 11. Production verification checklist before owner-approved deploy

Do not treat this checklist as performed by RC-05.

1. Confirm the exact deployed commit is `17111e6b05bcb43975f7ce626fb8f2675c7e54f2` or a reviewed descendant.
2. Confirm Render/service plan and cold-start behavior; resolve the documented free-plan-sleep vs starter-blueprint mismatch before demo freeze.
3. Confirm production `DATABASE_URL` points to the intended production PostgreSQL/Supabase instance and never reuse the disposable URL.
4. Run `npm ci`, `npm run build` and `npm run db:migrate:deploy` in the production build path; confirm both migrations are already applied or apply only through the reviewed deploy path.
5. Confirm strong unique `JWT_ACCESS_SECRET` and `PICKUP_CODE_SECRET` in the approved secret store.
6. Confirm production `STORAGE_DRIVER=supabase` (or another reviewed durable driver), private bucket, correct service key scope and object retrieval authorization.
7. Confirm `ALLOWED_ORIGINS`, HTTPS-only origins, `COOKIE_SECURE=true` and `TRUST_PROXY=true` as documented for Render.
8. Confirm no seed/demo provisioning runs against production unless the owner explicitly approves a demo environment.
9. Smoke-test `/api/v1/health`, frontend proxy `/api/v1/health`, registration/login, one synthetic institution approval flow, one donation/upload/receipt/reservation/pickup flow and admin audit visibility.
10. Verify no pickup code, password, token, cookie or service key appears in logs, screenshots, tickets or PRs.
11. Confirm rollback path for Vercel/Render and database backup/restore ownership.
12. Rehearse the presentation with approved synthetic profiles and prepare the backup video.

## 12. Reproduction guide

Use a clean checkout/worktree at the exact commit. Do not export production configuration.

```bash
git fetch origin
git verify-tag 2>/dev/null || true
git rev-parse origin/main  # expect 17111e6b05bcb43975f7ce626fb8f2675c7e54f2

# frontend/backend dependencies and regression checks
npm ci
npm run lint
npm run test:ci
npm run build
npm run test:browser
npm audit --omit=dev

cd backend
npm ci
npm run lint
npm run build
npm run test
npm run test:e2e
npm audit --omit=dev
cd ..

node --test tests/live/harness-guard.test.mjs tests/live/controlled-env.test.mjs
node --test scripts/agent-guard.test.mjs

git diff --check
```

Controlled live stack:

```bash
node tests/live/start-disposable-stack.mjs
# Use only the loopback URLs, database URL, manifest path and one-time synthetic
# admin password printed by that launcher. Do not write them into tickets or PRs.

node tests/live/sh02-journey.mjs
node tests/live/sh02-security.mjs
node docs/repassa/evidence/rc-05/rc05-supplemental-live-validation.mjs
node docs/repassa/evidence/rc-05/restart-controlled-backend.mjs <stack-manifest.json>
node tests/live/sh02-security.mjs --recovery
node docs/repassa/evidence/rc-05/post-restart-session-validation.mjs
node docs/repassa/evidence/rc-05/rc05-live-browser-qa.mjs
```

The evidence scripts intentionally require the controlled manifest/environment and synthetic credentials; they print statuses only and do not print tokens, cookies, pickup codes, passwords or object keys.

## 13. Evidence inventory

- Main report: `docs/repassa/evidence/rc-05/RC-05-EVIDENCE.md`
- Validation scripts: `rc05-supplemental-live-validation.mjs`, `restart-controlled-backend.mjs`, `post-restart-session-validation.mjs`, `rc05-live-browser-qa.mjs`
- Logs: `logs/`
- Sanitized/safe screenshots: `screenshots/`

All committed screenshots use synthetic disposable data. The screenshot containing an issued pickup code was deliberately omitted; log artifacts containing raw codes were sanitized before copying.

## 14. RC-06 reconciliation addendum (2026-11-28)

RC-05 validated application commit `17111e6b05bcb43975f7ce626fb8f2675c7e54f2`. Current `origin/main` is now `016a026e72d2a28133b4d0a301efde6b8ee2c3d4`, the merge of this evidence PR; it is a documentation-only descendant and does not change application code.

Owner-confirmed production facts after RC-05:

- Render deployed application commit `17111e6`.
- Render uses the Free plan (0.1 CPU, 512 MB RAM), exactly one instance, autoscaling disabled and automatic deployments enabled.
- Supabase bucket `repassa-uploads` is private (`public=false`), has zero Storage policies and allows JPEG/PNG/WebP.
- Vercel deployed the latest commit according to the owner; RC-06 public asset hashes exactly match the RC-05 build output.
- The owner performed physical mobile-device testing independently.

The former hosting-plan uncertainty is therefore resolved as an intentional owner-confirmed Free-plan deployment, not as an unknown state. It remains operationally divergent from the repository's starter/manual-deploy reference blueprint and remains a demo cold-start risk.

RC-05 restart clarification: the controlled restart probe intentionally generated a **new local JWT signing secret** to model a worst-case local process replacement. That is why pre-restart stateless access JWTs could not survive that harness restart. An ordinary production process restart should preserve the configured `JWT_ACCESS_SECRET`; persistent opaque refresh sessions are still expected to survive because they are database-backed. RC-05 did not prove or disprove production secret persistence.

See `docs/repassa/evidence/rc-06/RC-06-EVIDENCE.md` for final read-only production validation and remaining release conditions.
