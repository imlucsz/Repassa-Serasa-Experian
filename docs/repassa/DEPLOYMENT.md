# RePassa — Deployment notes (DEV-04)

Status: documentation of known blockers. No production infrastructure has been
deployed; all items below require owner approval before implementation.

Target topology (DECISIONS.md): Vercel frontend + Render API, same-origin
`/api/v1` reverse proxy, Supabase Storage for images, managed PostgreSQL 16.

## 1. Render ephemeral disk — image uploads (BLOCKER)

DEV-03 stores material photos on local disk under `UPLOAD_DIR`
(default `storage/uploads`, see `backend/src/uploads/storage.service.ts`).

Exact risks on Render's standard (non-disk) web service filesystem:

- **Total loss on restart/redeploy**: Render containers run on an ephemeral
  filesystem. Every deploy, restart, crash, or autosleep wakes to a clean
  image — all uploaded photos are permanently deleted while their keys remain
  referenced by `material_photos` rows in Postgres, producing dangling 404s.
- **Multi-instance inconsistency**: if the service ever scales past one
  instance, a photo written to instance A is invisible to a request served by
  instance B. The DB says the photo exists; the serving instance disagrees.
- **No backup/DR**: ephemeral disk is outside snapshot/backup scope; there is
  no recovery path for user content.

The local-disk store is acceptable for development, tests and a single-node
demo where data loss is tolerable. It is **not** production-ready and must not
be presented as durable storage.

Mitigation notes for the interim demo, if needed: a Render persistent disk
mounted at `UPLOAD_DIR` preserves files across restarts on a single instance,
but still fails the multi-instance case and has weaker durability than object
storage — treat it as a stopgap, not the target design.

## 2. Follow-up task — durable object storage (Supabase Storage)

Separate follow-up task (not in this PR, per scope):

- Replace `StorageService` internals with Supabase Storage (decided in
  DECISIONS.md; alternatively S3-compatible object storage). The public
  surface of the service — `processAndStore(buffer, declaredType)` →
  `{ key, contentType, sizeBytes }` and `openReadStream(key)` — stays
  identical, so upload authorization, image re-encoding/EXIF stripping,
  pixel/size policy and the `material_photos` schema do not change.
- Keep serving photos through the authorized `GET /uploads/:key` route (or a
  signed-URL equivalent) so pending-material privacy and access checks are
  preserved. Do not switch to public bucket URLs for images attached to
  non-AVAILABLE materials.
- API contract (`docs/repassa/contracts/openapi.yaml`) is unchanged: the
  frontend still references photos via the same upload key/URL shape.
- Migration path: re-upload/re-key existing objects or accept loss of local
  dev fixtures; production has no stored photos yet.
- New secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, never
  exposed to the browser), optional bucket name. These go through env
  validation like the existing secrets.

## 3. Same-origin Vercel → NestJS proxy, cookies and CORS

The browser must call **relative URLs only** (`/api/v1/...`); Vercel rewrites
proxy them to the Render API. This is the ARCHITECTURE.md design and is
required for the refresh-cookie security model.

Requirements:

- **Vercel rewrite**: `vercel.json` rewrite `/api/v1/(.*)` →
  `https://<render-service>.onrender.com/api/v1/$1`. Must run after filesystem
  route resolution and before SPA fallback so API paths are never swallowed
  by `index.html`.
- **Refresh cookie**: `POST /auth/login`, `/auth/refresh`, `/auth/logout` set
  `refreshToken` as `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`.
  Because the proxy is same-origin, the cookie is a first-party cookie —
  `SameSite=Strict` works and no cross-site cookie exceptions are needed.
  `COOKIE_SECURE` is forced on in production.
- **Access token**: short-lived JWT in memory only — never in cookies or
  localStorage. `Authorization: Bearer` header set by the app.
- **CORS**: same-origin calls do not need CORS. `ALLOWED_ORIGINS` should
  contain only the Vercel origin(s) (`https://<app>.vercel.app`, custom
  domain) as a defense-in-depth list for direct cross-origin access;
  credentials remain enabled only for those origins. The bare Render origin
  should not accept browser traffic with credentials — block or restrict it
  so the cookie cannot be used cross-origin bypassing the proxy.
- **CSRF/request marker**: mutating requests require the
  `x-repassa-request: 1` header (existing convention). Keep enforcing it;
  combined with `SameSite=Strict` it covers CSRF for the cookie-bearing
  refresh path.
- **Headers/caching**: forward `Cookie`/`Set-Cookie` untouched; the API sends
  `Cache-Control: no-store` (existing) — the proxy must not cache API
  responses. Preserve request IDs.
- **HTTPS only**: production requires `https` origins; `TRUST_PROXY=true` on
  Render so `X-Forwarded-For` is honored for rate limiting behind the
  platform proxy.
- **Rate limiting caveat**: the current limiter is in-memory per process —
  correct for one Render instance. Multi-replica deployment needs shared
  storage (e.g. Redis) as a separate task.

## 4. Production env checklist (backend)

`DATABASE_URL` (managed Postgres), `JWT_ACCESS_SECRET` (≥32 chars),
`PICKUP_CODE_SECRET` (≥32 chars — required since DEV-04), `ALLOWED_ORIGINS`
(https origins only), `COOKIE_SECURE` (forced true), `TRUST_PROXY=true`,
`UPLOAD_DIR` (until object storage lands; treat contents as disposable),
`SWAGGER_ENABLED` off by default. `SEED_DEMO_PASSWORD` must not be set in
production.
