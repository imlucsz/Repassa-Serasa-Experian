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

## Scripts

| Script | Purpose |
|---|---|
| `npm run lint` | TypeScript typecheck (`tsc --noEmit`) |
| `npm run build` | `nest build` → `dist/` |
| `npm run db:migrate:dev` | create+apply dev migration (requires live `DATABASE_URL`) |
| `npm run db:migrate:deploy` | apply committed migrations (CI/prod-safe, roll-forward only) |
| `npm run db:seed` | idempotent synthetic seed; `SEED_DEMO_PASSWORD` opt-in demo credentials |
| `npm run db:up` / `db:down` | docker compose Postgres 16 |
