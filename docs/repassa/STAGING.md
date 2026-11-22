# RePassa — Staging runbook (DEV-05)

Everything here is prepared but **not provisioned**. Owner approval is required
before creating any external resource or running any live deploy.

## 1. Owner actions (in order)

1. **Managed PostgreSQL 16** — create on Render (or Supabase Postgres). Free
   tier is fine for staging; note free Render Postgres expires after 90 days.
   Copy the external connection string (includes credentials — secret).
2. **Supabase project** — create project; create a **private** bucket named
   `repassa-uploads` (or set `SUPABASE_STORAGE_BUCKET` to your choice). Copy
   `SUPABASE_URL` (`https://<ref>.supabase.co`) and the **service_role** key —
   server-only, never the anon key and never in Vite env vars.
3. **Render web service** — apply `render.yaml` (Blueprint) or create manually
   with the same settings. Set the `sync: false` secrets in the dashboard:
   `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Verify
   `ALLOWED_ORIGINS` matches the final Vercel hostname.
4. **Vercel project** — deploy the repo; `vercel.json` rewrites already point
   to the live Render hostname `repassa-serasa-experian.onrender.com`. If the
   Render service is ever renamed, update the rewrite destination (coordinate
   with the frontend agent before merging that change).
5. **Seed (optional)** — run `npm run db:seed` against staging only with
   `SEED_DEMO_PASSWORD` set and owner consent; institutions/materials are
   fictional per AGENTS.md.
6. **Smoke test** — `cd backend && node scripts/smoke.mjs --base
   https://<vercel-app> --email smoke-<rand>@example.com --password <rand>`.

## 2. Potential costs (staging)

| Resource | Free tier | Caveat |
|---|---|---|
| Render web service | yes | sleeps after idle → cold starts; starter plan ≈ US$7/mo avoids it |
| Render Postgres | yes | free instance deleted after 90 days |
| Supabase | yes | 500 MB storage, shared limits — plenty for demo photos |
| Vercel | yes (hobby) | hobby plan is non-commercial |

Default blueprint uses `plan: starter` to avoid cold-start flakiness during
the demo; switch to `free` to spend nothing, accepting sleep/wake latency.

## 3. Staging deploy checklist

- [ ] Secrets entered in Render dashboard (never in repo): `DATABASE_URL`,
      `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. `JWT_ACCESS_SECRET` and
      `PICKUP_CODE_SECRET` use `generateValue: true`.
- [ ] `STORAGE_DRIVER=supabase`, bucket exists and is **private**.
- [ ] `vercel.json` rewrite destination = real Render hostname.
- [ ] `ALLOWED_ORIGINS` = exact Vercel origin(s), https only.
- [ ] `TRUST_PROXY=true`, `COOKIE_SECURE=true`, `SWAGGER_ENABLED=false`.
- [ ] Build ran `db:migrate:deploy` — migrations applied (check deploy logs).
- [ ] `GET https://<render>/api/v1/health` → 200 before pointing Vercel at it.
- [ ] `scripts/smoke.mjs` green through the Vercel origin (cookie attrs,
      no-store, CORS rejection, CSRF marker, session flow).
- [ ] Direct Render origin does not serve credentialed browser traffic
      (CORS allows only the Vercel origin).
- [ ] `SEED_DEMO_PASSWORD` unset in Render env.

## 4. End-to-end staging test plan

Run after smoke passes; two students (A donor, B reserver), one staff member.

| # | Journey | Steps | Expected |
|---|---|---|---|
| 1 | Register | A: `POST /api/v1/auth/register` | 201, accessToken, `Set-Cookie` HttpOnly+Secure+SameSite=Strict+Path=/api/v1/auth |
| 2 | Session restore | reload page → `POST /auth/refresh` with cookie | 200 new accessToken, rotated cookie |
| 3 | Upload photo | A: `POST /uploads` (multipart JPEG/PNG/WebP) | 201 `{uploadId}`; object in private bucket; EXIF stripped |
| 4 | Donate | A: `POST /api/v1/donations` with uploadId | 201 material `PENDING_RECEIPT`; image **not** publicly accessible (404 anonymous) |
| 5 | Receipt | staff: `POST /api/v1/institutions/{id}/materials/{id}/receive` | 200 → `AVAILABLE` |
| 6 | Catalog | anonymous: `GET /api/v1/materials` | item visible, `imageUrl` serves 200 |
| 7 | Reserve | B: `POST /materials/{id}/reservations` | 201, `pickupCode` `XXXX-XXXX-XXXX`, material hidden from catalog |
| 8 | Code visibility | B re-lists `/me/reservations` | code still present while ACTIVE; absent for others |
| 9 | Pickup | staff: `POST /institutions/{id}/pickups/confirm` `{code}` | 200 `COMPLETED`, material `DELIVERED`; replay → 404 |
| 10 | Dashboard | staff: `GET /institutions/{id}/dashboard` | counts reflect delivered material |
| 11 | Logout | B: `POST /auth/logout` | 204, cookie cleared, refresh family revoked |

### Failure cases to verify

- Login with wrong password → generic 401 (no oracle).
- `POST` auth endpoints without `x-repassa-request` → 403.
- Anonymous `GET /uploads/:key` for a pending photo → 404.
- Malformed pickup code → 400; wrong/unknown/expired code → 404; staff of
  another institution → 404 (same generic message).
- Cancel by non-owner → 404; cancel after completion → 409.
- Disabled user token → 401 on any endpoint.
- Expired reservation: after `expiresAt` the material reappears in catalog
  (reconciled on next read) and the code fails with 404.

### Concurrency (manual staging checks)

- Two students reserve the same material simultaneously → exactly one 201.
- Two staff confirm the same code simultaneously → exactly one 200.
- Cross-institution isolation: staff cannot see/confirm another institution's
  materials, reservations or codes (all generic 404/403).

### Storage-specific staging checks

- Upload → confirm object exists only via `GET /uploads/:key` (never a public
  Supabase URL); restart the Render service → photo still serves (durable).
- Supabase dashboard: bucket is private; no public URLs exist.
- Broken `SUPABASE_*` config → upload returns 503 `SERVICE_UNAVAILABLE`, not a
  stack trace or leaked credential.

## 5. Known limitations

- Render `plan: starter` keeps one instance; in-memory rate limiting and the
  session/audit flows are single-replica-safe only.
- Expiry reconciles on reads/mutations (no background sweeper).
- `autoDeploy: false` — deploys are deliberate.
- Migrations run in `buildCommand` (Render blueprints have no separate
  migrate hook on all plans); failure aborts the deploy before traffic shifts.
