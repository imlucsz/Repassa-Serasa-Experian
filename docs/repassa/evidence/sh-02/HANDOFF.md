# SH-02 — Integration & deployment readiness evidence

Validated on `origin/main` (post-merge of DEV-06 `1cb095a`, UX-04, UX-05 + a11y PR #23) against a disposable PostgreSQL 16 (`backend/test/helpers/pg-daemon.mjs`) with the real backend build (`dist/main.js`), real browser (Chrome via Playwright driver) and `provision-admin.ts` provisioning — no seed data.

## Full product journey — `tests/live/sh02-journey.mjs` → 17/17

Four independent browser contexts (donor, staff member, reservist, admin); state verified through the API after every step, not only through UI.

| # | Check | Result |
|---|-------|--------|
| 1 | Public student registration via UI | PASS (STUDENT role) |
| 2 | Institutional self-registration (`POST /institutions`) | PASS — "enviado para análise" |
| 3 | Pending institution invisible in public catalog | PASS `total=0` |
| 4 | Admin approval persisted (`APPROVED + isActive`) | PASS |
| 5 | Member assignment promoted Carla STUDENT→STAFF | PASS |
| 6–7 | Two donations via UI (one with real photo upload) | PASS `PENDING_RECEIPT` |
| 8 | Pending-receipt materials invisible publicly | PASS `total=0` |
| 9 | Staff receipt ×2 → both `AVAILABLE` in catalog | PASS `total=2` |
| 10 | Reservist reserves + pickup code revealed | PASS `XXXX-XXXX-XXXX` |
| 11 | Staff confirms pickup with code → COMPLETED | PASS |
| 12 | Same code reused → refused (single-use) | PASS |
| 13 | Second reservation cancelled → history 1 COMPLETED + 1 CANCELED | PASS |
| 14 | Cancelled material returns to catalog | PASS |
| 15 | Admin metrics: `Retiradas concluídas = 1` | PASS |
| 16 | Audit covers `admin.provision → institution.register → approve → membership_assign → donate → receive → reserve → pickup → cancel` | PASS |
| 17 | Separate browser contexts per role throughout | PASS |

## Security & integration — `tests/live/sh02-security.mjs` → 21/21 (+3 recovery)

- **RBAC**: anonymous→401, STUDENT→403, STAFF→403 on `/admin/*` (institutions, users, audit-events).
- **Tenant isolation**: institution B created via real flow (register→approve→assign); staff-B gets 403 on A's managed materials and dashboard, staff-A symmetrically on B's, STUDENT 403 on managed endpoints.
- **Concurrency**: two students raced `POST /materials/:id/reservations` on the last copy → exactly one `201`, loser `409` (atomic conditional update).
- **Cross-tenant pickup**: staff-B presenting institution A's valid code → refused; reservation remained `ACTIVE`.
- **Expiry**: `expires_at` forced to past via SQL → lazy reconciliation flipped material to `AVAILABLE`, reservation `EXPIRED`, `reservation.expire` audit event written (TTL is 72h server-side).
- **Sessions**: refresh cookie `repassa_refresh` observed `HttpOnly; Path=/api/v1/auth; SameSite=Strict; Max-Age=604800` (Secure in production); `POST /auth/refresh` rotates and returns a new access token.
- **Code opacity**: `/admin/reservations` never exposes `pickupCode`.
- **Abuse controls**: duplicate institution name+address → `409`; 6th registration within the hour → `429` (5/user/hour). Login limiter also observed live (429 → retry-after behavior handled by waiting 62s).
- **Recovery** (`--recovery` after killing and restarting the backend process): health 200, login works, all state persisted — access tokens are stateless JWT and Postgres is durable.

## Functional fix shipped in this PR

- Admin institution filter dropdowns (`/admin/materiais`, `/admin/reservas`) fetched only the first page (50 items); `listAllAdminInstitutions()` now aggregates every page. Covered by a unit test asserting two-page aggregation.

## Deployment verification (read-only probes, 25/11/2026)

| Check | Observed |
|-------|----------|
| `GET repassa-…onrender.com/api/v1/health` | 200 after ~26s cold start |
| `GET /api/v1/materials` | 200 `{"items":[],"total":0}` — empty DB, **no seed in production** |
| `GET /api/docs` | 404 — Swagger disabled per blueprint |
| Login via Vercel proxy `/api/v1/auth/login` | 401 (generic), CORS `allow-credentials: true`, no CORS wildcard |
| `vercel.json` | `/api/v1/:path*` proxied to Render before SPA fallback |
| `render.yaml` blueprint | `plan: starter`, `autoDeploy: false`, `STORAGE_DRIVER=supabase`, `SWAGGER_ENABLED=false` |
| Sleep/wake behavior | Consistent with **Render free plan**, not Starter — owner must confirm actual plan in dashboard (see RUNBOOK blockers) |
| `STORAGE_DRIVER=local` | Impossible in prod — env validation aborts boot; running service implies `supabase` driver active |

## Screenshots

`01-cadastro-instituicao.png` (pending state) · `02-admin-membros.png` · `03-doacoes.png` · `04-recebimentos.png` · `05-reserva-codigo.png` (code revealed) · `06-retirada-confirmada.png` · `07-admin-dashboard-final.png` (metrics) · `08-admin-auditoria.png`.

## How to reproduce

See `docs/repassa/RUNBOOK.md` § "Disposable validation stack". Both scripts are environment-driven (`JOURNEY_*`, `REPASSA_ADMIN_*`) and refuse to run without an admin password — never point them at production.

## Known limitations

- Reservation expiry is **lazy** (reconciled on availability reads/mutations) — a `EXPIRED` sweep timestamp appears only when traffic touches the scope; documented behavior, not a gap for MVP.
- Rate-limit buckets are **in-memory per replica** (`rate-limit.service.ts`) — multi-instance Render scaling would relax limits; single replica is the target plan.
- Rate limiting made full script reruns wait ~62s once (expected behavior, evidence of the limiter).
- 3D shelf (`/catalogo?vista=estante`) was exercised on desktop 1440px during the journey via the grid view; the shelf itself was validated in earlier UX suites.
