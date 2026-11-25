# RC-01 — Release candidate & operational readiness evidence

Validated on `origin/main` `a2fb35d` (post-merge SH-02 PR #25 + SH-03 PR #24).
SH-02's harness was originally validated on a pre-SH-03 base (`16851d3`); this
session re-ran the entire harness on the integrated revision — the first real
compatibility check between the two deliveries.

## Reconciliation

- `main` = `a2fb35d`; no open PRs; CI green on both merges
  (`RePassa quality gates` success on `6ab6fef` and `8b0fd31`; Vercel check
  success on `a2fb35d`).
- SH-02 branch did **not** contain SH-03's commit — the merged integration was
  untested until this rerun.
- STATUS.md had stale rows (SH-02 "PR TBD", SH-03 "pending") — corrected.
- RUNBOOK §4 was missing `ALLOWED_ORIGINS` — documented (dev fallback only
  allows `http://localhost:3000`; any other vite port gets 403 on mutations).

## Full product journey — rerun → 17/17

Identical result to the original SH-02 run; all admin selectors used by the
harness still match SH-03's refined markup (`.admin-metrics`, `Aprovar
instituição`, `Vincular`, `Buscar por nome ou e-mail`). New screenshots in
this folder (01–08).

## Security — rerun → 23/23 + recovery 3/3

Same checks as the SH-02 run: RBAC on `/admin/*`, symmetric cross-tenant 403s
for a second institution created through the real flow, single-winner
reservation race (201/409), cross-tenant pickup refusal, lazy expiry +
`reservation.expire` audit, HttpOnly/SameSite=Strict refresh cookie + rotation,
pickup-code opacity, duplicate-institution 409, registration rate limit 429,
and post-restart persistence.

## Local verification on `a2fb35d`

| Check | Result |
|---|---|
| `npm run lint` (frontend, 2× tsc) | clean |
| `npm run test:ci` (frontend unit) | **41/41** |
| `npm run build` (frontend) | clean |
| `cd backend && npm run lint` | clean |
| `cd backend && npm run build` | clean |
| `cd backend && npm test` (unit) | **51/51** |
| `cd backend && npm run test:e2e` | **121/121** — both migrations applied fresh to disposable PG16 |
| `tests/live/sh02-journey.mjs` | **17/17** |
| `tests/live/sh02-security.mjs` | **23/23** + `--recovery` **3/3** |

Environment notes: `npm install` was needed locally (`react-router-dom` missing
from node_modules — lockfile unchanged); `npx prisma generate` was needed to
refresh a stale generated client (pre-DEV-06 schema). Neither affects the repo.

## Hosted audit (read-only, 25/11/2026)

| Probe | Observed |
|---|---|
| `GET /api/v1/health` (direct Render) | 200 `{"status":"ok"}` in **0.85s — warm** (includes DB check) |
| `GET /api/v1/health/live` | 200 (DEV-01 marker) |
| `GET /api/v1/admin/institutions` unauth | **401** — DEV-06 routes live = latest backend code on main |
| `POST /api/v1/institutions` unauth | 401 |
| `GET /api/v1/materials` via Vercel proxy | 200, `total:0` — empty DB, no seed, correct |
| Login wrong creds via proxy | 401 generic `UNAUTHENTICATED` |
| Mutation w/o `X-Repassa-Request` | **403** — CSRF marker enforced |
| CORS preflight from Vercel origin | 204, exact origin + credentials |
| CORS preflight from `evil.example.com` | **404** — rejected |
| `/api/docs`, `/api/docs-json`, `/api/v1/openapi.json` | 404 everywhere — Swagger off |
| Security headers | `no-store`, `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS |
| Frontend bundle | `index-B_PzBW6g.js` + lazy admin chunks; `admin-nav` CSS present ⇒ **≥ SH-03 (`8b0fd31`)**; Vercel status check succeeded on `a2fb35d` ⇒ deployed = main |
| Deployed backend SHA | **UNKNOWN but bounded** — contains DEV-06 routes; no backend commits exist after `1cb095a`, so deployed backend is functionally latest |
| Render plan | **UNKNOWN** — warm on first probe; SH-02 observed ~26s cold start ⇒ consistent with free. Owner must confirm in dashboard |
| Supabase bucket privacy | **UNVERIFIED** — needs dashboard; service boot implies `supabase` driver configured |
| Pending migrations | none — only `init` + `institution_approval_status` exist, both pre-DEV-06 |

## Deployment drift

None detected. Frontend serves post-SH-03 assets (Vercel deployed `a2fb35d`);
backend serves DEV-06 routes and no newer backend code exists on main.

## Known limitations / honest gaps

- Exact deployed commit SHAs are not observable from outside; bounds are
  feature-marker based (`.admin-nav` ⇒ ≥SH-03, `admin/institutions` ⇒ ≥DEV-06).
- Warm health response does **not** prove the plan changed — free plan stays
  warm briefly after traffic. Plan verification needs the Render dashboard.
- Supabase bucket privacy unverified (read-only constraint; no creds).
- Rate-limit buckets remain in-memory per replica (documented single-instance
  assumption).
- Screen-reader manual pass still pending (noted in SH-03 handoff).
