# RePassa backend

NestJS + Fastify + Prisma + PostgreSQL 16 modular monolith. See `../docs/repassa/` for the contract, business rules and security model.

## Requirements

- Node >= 22.12
- PostgreSQL 16: `npm run db:up` (Docker) or any disposable instance via `DATABASE_URL`

## Setup

```bash
cp .env.example .env          # safe local defaults
npm ci                        # locked dependencies
npm run db:migrate:deploy     # apply versioned migrations
npm run db:seed               # optional synthetic demo data (non-production only)
npm run start:dev             # API at http://localhost:3001/api/v1
```

Swagger UI: `http://localhost:3001/api/docs` (disabled in production unless `SWAGGER_ENABLED=true`).

## Tests

```bash
npm run test        # unit tests (no DB)
npm run test:e2e    # e2e + migration checks against disposable Postgres
npm run test:ci     # both — what CI runs
```

`test:e2e` uses `TEST_DATABASE_URL` when set (CI postgres:16), otherwise boots an embedded disposable Postgres 16 (`test/helpers/pg-daemon.mjs`) and applies migrations before running.

Tests run in Jest ESM mode (`node --experimental-vm-modules`) because `@nestjs/*` ships ESM-only. E2E specs exercise the API over real HTTP (`fetch` against an ephemeral listener) rather than `fastify.inject()`: inject routes through `light-my-request`, a test-only path that cannot `require()` the ESM-only `cookie` package on Node 22. `--forceExit` is used to release the spawned Postgres daemon child promptly.

## Auth model (DEV-02)

- Access: short-lived HS256 JWT (default 900 s), issuer `repassa-api`, audience `repassa-web`. `JWT_ACCESS_SECRET` (>=32 chars) is **required in production**; dev/test generates an ephemeral per-process key and logs a warning. Each token carries a keyed credential fingerprint (`pcv`); changing the password hash invalidates previously issued access tokens immediately on the credential check.
- Refresh: opaque 256-bit token in the `repassa_refresh` cookie — `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age` = `REFRESH_TOKEN_TTL_DAYS` (default 7). Only a SHA-256 digest is stored. Rotation is atomic (`SELECT ... FOR UPDATE`); re-presenting a rotated/revoked token revokes the whole session family and writes an `auth.refresh_reuse` audit event — clients must single-flight refresh.
- Login verifies Argon2 outside the row lock, then re-reads the credential and creates the refresh session under `FOR UPDATE`; this serializes with administrative password reset without holding a user row locked during hashing.
- CSRF: all `/auth/*` POSTs require `X-Repassa-Request: 1`; a present `Origin` must be in `ALLOWED_ORIGINS`; JSON content-type enforced by Fastify. Private responses carry `Cache-Control: no-store`.
- Rate limits (in-memory fixed window, single replica): login 5/min per IP+email and 30/min per IP; register 5/min per IP+email and 10/min per IP; refresh/logout 60/min per IP. IPv6 collapses to /64.
- Roles are read from the database on every request — never trusted from the JWT. Public registration always creates `STUDENT`; staff/membership is seed/provisioning-only.

## Deployment (future Render hosting — requirements)

Render build/start: `npm ci && npm run build` then `npm run start` (`node dist/main.js`). Provision PostgreSQL 16 separately.

| Variable | Requirement |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Render Postgres connection string (`postgresql://...`) |
| `JWT_ACCESS_SECRET` | **required**, >=32 random chars (Render secret) |
| `ALLOWED_ORIGINS` | **required**, deployed UI origin, e.g. `https://app.example.com` |
| `TRUST_PROXY` | `true` — Render terminates TLS and proxies; needed for correct client-IP rate limiting |
| `COOKIE_SECURE` | forced `true` in production — env var cannot disable it |
| `PORT` | Render injects `PORT`; the app binds `HOST=0.0.0.0` by default |
| `SWAGGER_ENABLED` | defaults off in production; only enable deliberately |
| `ACCESS_TOKEN_TTL_SECONDS` / `REFRESH_TOKEN_TTL_DAYS` | optional overrides (900 s / 7 d defaults) |
| `PICKUP_CODE_SECRET` | required when DEV-04 pickup codes ship |

Release step: `npm run db:migrate:deploy` (roll-forward only; never `db push`/`migrate reset` against shared databases). Health checks: `GET /api/v1/health` (readiness incl. DB) / `GET /api/v1/health/live`. The public demo expects a same-origin `/api/v1` reverse proxy from the frontend host so the `Path=/api/v1/auth` cookie stays host-only and first-party; verify `Set-Cookie` passthrough and no response caching on the proxy.

## Scripts

| Script | Purpose |
|---|---|
| `npm run lint` | TypeScript typecheck (`tsc --noEmit`) |
| `npm run build` | `nest build` → `dist/` |
| `npm run db:migrate:dev` | create+apply dev migration (requires live `DATABASE_URL`) |
| `npm run db:migrate:deploy` | apply committed migrations (CI/prod-safe, roll-forward only) |
| `npm run db:seed` | idempotent synthetic seed; `SEED_DEMO_PASSWORD` opt-in demo credentials |
| `npm run db:up` / `db:down` | docker compose Postgres 16 |
| `DATABASE_URL=... npx tsx scripts/reset-password.ts` | interactive out-of-band password reset for an existing account; hidden password entry, remote-target confirmation, session revocation verification and `admin.password_reset` audit. Never pipe the password or commit real connection strings |

Operational note: the immediate access-token invalidation guarantee applies once the API is running a build that includes the credential-fingerprint check. If the reset is executed against a database serving an older API revision, refresh sessions are still revoked, but already issued access tokens remain valid until their normal expiry (default at most 15 minutes).
