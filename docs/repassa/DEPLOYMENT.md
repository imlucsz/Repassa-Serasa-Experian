# RePassa — Deployment notes

Status: DEV-05 implemented the durable-storage adapter, deploy configs and
staging runbook. No production infrastructure has been provisioned; owner
approval is required before creating any external resource. Staging checklist
and test plan live in `docs/repassa/STAGING.md`.

Target topology (DECISIONS.md): Vercel frontend + Render API, same-origin
`/api/v1` reverse proxy, Supabase Storage for images, managed PostgreSQL 16.

## 1. Render ephemeral disk — local storage is dev/test only

`STORAGE_DRIVER=local` stores processed photos under `UPLOAD_DIR`
(default `storage/uploads`, `backend/src/uploads/local-object-store.ts`).

Exact risks on Render's standard (non-disk) web service filesystem:

- **Total loss on restart/redeploy**: ephemeral containers wake to a clean
  image — all uploaded photos are permanently deleted while their keys remain
  referenced by `material_photos`/`uploads` rows, producing dangling 404s.
- **Multi-instance inconsistency**: a photo written to instance A is invisible
  to instance B; the DB says it exists, the serving instance disagrees.
- **No backup/DR**: ephemeral disk is outside snapshot/backup scope.

Env validation **refuses `STORAGE_DRIVER=local` in production** — ephemeral
storage cannot silently reach staging/production.

## 2. Durable object storage — implemented (DEV-05)

`ObjectStore` abstraction (`backend/src/uploads/object-store.ts`) with two
drivers selected by `STORAGE_DRIVER`:

- `local` → `LocalObjectStore` (filesystem; dev/test).
- `supabase` → `SupabaseObjectStore` (plain REST object API, no extra deps).

Invariants preserved for every driver:

- `StorageService.processAndStore` still performs magic-byte validation,
  dimension/pixel limits and re-encoding (EXIF/metadata stripped); keys stay
  server-generated `<uuid>.<ext>`.
- Objects are served **only** through the authorized `GET /uploads/:key`
  route — public while the material is AVAILABLE, otherwise donor / upload
  owner / member staff. The Supabase bucket must be **private**; the
  service-role key is server-only and never reaches clients or logs.
- Missing objects and storage failures collapse to safe responses (404 /
  503 with no upstream details). API response shapes are unchanged.

Required env when `STORAGE_DRIVER=supabase`: `SUPABASE_URL` (https),
`SUPABASE_SERVICE_ROLE_KEY` (≥32 chars, server-only),
`SUPABASE_STORAGE_BUCKET` (default `repassa-uploads`; create the bucket as
**private** in the Supabase dashboard before deploy).

Migration of pre-DEV-05 local objects: re-upload fixtures or accept loss —
no production data existed when the switch was made.

## 3. Same-origin Vercel → NestJS proxy, cookies and CORS

The browser calls **relative URLs only** (`/api/v1/...`); `vercel.json`
rewrites them to the Render API. Implemented in DEV-05:

- `vercel.json`: `/api/v1/:path*` (and `/api/docs*`) rewrites placed **before**
  the SPA `index.html` fallback so API paths are never swallowed. Update the
  destination hostname to the actual Render service before enabling.
- **Refresh cookie** (`repassa_refresh`): `HttpOnly; Secure; SameSite=Strict;
  Path=/api/v1/auth`. SameSite was **Lax** in code, **Strict** in this doc —
  DEV-05 resolved it to **Strict**: under the required same-origin proxy the
  cookie is first-party, every auth call is a same-origin `fetch`, and no
  supported flow needs cross-site cookie send. Strict removes the CSRF surface
  Lax tolerates for top-level navigations. If a future topology ever serves
  the SPA and API cross-origin, revisit — the proxy design makes that
  unsupported today.
- **Access token**: short-lived JWT in memory only — never in cookies or
  localStorage; sent as `Authorization: Bearer`.
- **CORS**: same-origin calls don't need CORS. `ALLOWED_ORIGINS` lists only
  the Vercel origin(s) as defense-in-depth; credentials enabled only for those
  origins. The bare Render origin should not serve credentialed browser
  traffic — it is reached via the proxy only.
- **CSRF/request marker**: `x-repassa-request: 1` required on mutations
  (enforced by `AuthCsrfGuard`); combined with `SameSite=Strict` it covers the
  cookie-bearing refresh path.
- **Headers/caching**: `Cache-Control: no-store` is set on all `/api/v1`
  responses by an `onSend` hook — the proxy must not cache API responses.
  `Cookie`/`Set-Cookie` pass through Vercel rewrites untouched. Request IDs
  preserved.
- **HTTPS only**: production requires https origins; `TRUST_PROXY=true` on
  Render so `X-Forwarded-For` drives rate limiting.
- **Rate limiting caveat**: the limiter is in-memory per process — correct for
  one Render instance; multi-replica needs shared storage (separate task).

## 4. Environment matrix (backend)

| Var | Dev/test | Staging/prod | Notes |
|---|---|---|---|
| `NODE_ENV` | development/test | `production` | |
| `DATABASE_URL` | local/disposable | managed PG16 string | secret |
| `PORT` | 3001 | Render-assigned (10000) | |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Vercel origin(s), https | required in prod |
| `JWT_ACCESS_SECRET` | ephemeral fallback | required ≥32 | secret |
| `PICKUP_CODE_SECRET` | ephemeral fallback | required ≥32 | secret |
| `COOKIE_SECURE` | optional | forced `true` | |
| `TRUST_PROXY` | `false` | `true` on Render | X-Forwarded-For |
| `STORAGE_DRIVER` | `local` | `supabase` | local refused in prod |
| `UPLOAD_DIR` | `storage/uploads` | unused under supabase | |
| `SUPABASE_URL` | — | required w/ supabase | https |
| `SUPABASE_SERVICE_ROLE_KEY` | — | required w/ supabase | server-only secret |
| `SUPABASE_STORAGE_BUCKET` | — | `repassa-uploads` | private bucket |
| `SWAGGER_ENABLED` | true | `false` | |
| `SEED_DEMO_PASSWORD` | optional | **never** | demo seed only |
| `LOG_LEVEL` | info | info | |

## 5. Deploy configs (applied by owner, not auto-provisioned)

- `render.yaml` — Render blueprint for `repassa-serasa-experian` (starter plan,
  `npm ci && npm run build && npm run db:migrate:deploy`, health check
  `/api/v1/health`, `autoDeploy: false`).
- `vercel.json` — same-origin `/api/v1` rewrites + SPA fallback (root config;
  frontend coordination required before enabling).
- `backend/scripts/smoke.mjs` — post-deploy smoke checks (health, no-store,
  CORS rejection, CSRF marker, optional auth/cookie/session flow).
- `docs/repassa/STAGING.md` — staging checklist, owner actions, cost notes
  and the end-to-end staging test plan.
