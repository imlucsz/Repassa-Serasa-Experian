# RePassa — Operations runbook (SH-02)

Audience: owner + agents deploying or demoing the integrated product.
Deployment topology and rationale: `DEPLOYMENT.md`. Staging checklist: `STAGING.md`.
Nothing here authorizes deploying, merging or mutating production — owner approval required.

## 1. Verified production state (25/11/2026)

| Item | Observed | Expected per blueprint |
|------|----------|------------------------|
| Frontend | `repassa-serasa-experian.vercel.app` 200 | Vercel + `vercel.json` |
| API | `repassa-serasa-experian.onrender.com` healthy | Render web service |
| API proxy | `vercel.json` rewrites `/api/v1/*` → Render before SPA fallback | same-origin, no public API secret |
| Swagger | `/api/docs` → 404 | `SWAGGER_ENABLED=false` |
| CORS | 401 via proxy; `allow-credentials: true`, exact origin | `ALLOWED_ORIGINS` = Vercel origin only |
| DB content | `/materials` `total:0` | no seed — correct for production |
| **Plan** | service **sleeps** (first request took ~26s); RC-01 re-audit found it **warm** (0.85s) — plan still unconfirmed | blueprint says `starter` — **discrepancy, see §5** |
| Storage | service boots ⇒ `STORAGE_DRIVER=supabase` valid (`local` aborts in production) | private Supabase bucket |
| Deployed rev (RC-01) | frontend: `.admin-nav` in served CSS ⇒ ≥ SH-03; backend: `/admin/institutions` ⇒ ≥ DEV-06 = latest backend on main | no drift detected — exact SHAs still unobservable |

## 2. Deploy / redeploy steps

1. Owner confirms `main` is green (agent-guard, frontend-quality, backend-quality, Vercel).
2. Render: `autoDeploy: false` ⇒ trigger deploy manually; build command already runs `npm ci && npm run build && npm run db:migrate:deploy` (migrations are versioned — no `db push`/`migrate reset` on shared DBs).
3. Post-deploy smoke: `cd backend && node scripts/smoke.mjs --base https://repassa-serasa-experian.vercel.app` (read-mostly; `--email/--password` only with owner-issued synthetic creds).
4. Confirm `/api/v1/health` = 200, `/api/docs` = 404, login returns generic 401.

## 3. Administrator provisioning (secure path, replaces old seed admin)

No ADMIN is seeded. Provision out-of-band against the target DB:

```
DATABASE_URL=<target> npx tsx backend/scripts/provision-admin.ts \
  --email <admin@org> --name "<Nome>" --generate
```

- Prints a **one-time** password — capture it immediately (never logged/stored in repo).
- `--elevate` promotes an existing user instead of creating one.
- Writes `admin.provision` to the audit trail.
- First login: admin lands on `/admin`; rotate to a personal password if a change flow exists, otherwise keep the generated one (≥20 chars).

### Out-of-band password reset (existing account)

Use only for an owner-approved operational reset. This mutates one existing account; it does not seed data and does not run migrations.

PowerShell on Windows (recommended terminal so hidden input is a real TTY):

```powershell
cd backend
$env:DATABASE_URL="<existing target DATABASE_URL>"
npx tsx scripts/reset-password.ts
Remove-Item Env:DATABASE_URL
```

POSIX shell:

```bash
cd backend
DATABASE_URL="<existing target DATABASE_URL>" npx tsx scripts/reset-password.ts
```

The script prompts for the account email twice, requires typing `REDEFINIR` for a non-local database, reads the new password twice without echoing it, updates only `passwordHash`, revokes all live refresh sessions in the same transaction, verifies that zero unrevoked sessions remain and writes `admin.password_reset` audit metadata (no password/hash/token). Never paste the connection string into chat, tickets or PRs. When the target is Supabase production, use the existing secret value from the approved secret store/dashboard; do not create a new database or run seed.

Immediate invalidation of already issued access tokens requires the API to run the credential-fingerprint revision introduced with this script. Against an older API revision, refresh sessions are revoked but existing access tokens remain valid until normal expiry (default ≤15 minutes).

## 4. Disposable validation stack (local, never production)

```
# 1) disposable PG16 (bundled binaries, temp cluster) — prints READY <databaseUrl>
cd backend && node test/helpers/pg-daemon.mjs 55434 &
# 2) schema + provision (NO seed — production path); use the printed URL
DATABASE_URL=<disposable-url> npm run db:migrate:deploy
DATABASE_URL=<disposable-url> \
  npx tsx scripts/provision-admin.ts --generate --email admin-jornada@example.com --name "Admin"
# 3) backend + frontend (api mode)
# ALLOWED_ORIGINS is REQUIRED: the dev fallback only allows
# http://localhost:3000 — any other vite port gets 403 on mutations.
PORT=3001 DATABASE_URL=<disposable-url> \
  ALLOWED_ORIGINS=http://127.0.0.1:4272 \
  node dist/main.js            # :3001 — build first: npm run build
VITE_DATA_MODE=api npm run dev -- --port 4272   # repo root
# 4) journeys — separate browser contexts per role
REPASSA_ADMIN_PASSWORD=<one-time> node tests/live/sh02-journey.mjs
JOURNEY_DB_URL=<disposable-url> \
  REPASSA_ADMIN_PASSWORD=<one-time> node tests/live/sh02-security.mjs
# 5) restart backend, then:
... same env ... node tests/live/sh02-security.mjs --recovery
```

`SEED_DEMO_PASSWORD` + `npx prisma db seed` only for demo environments with owner consent — **never** on the production DATABASE_URL.

## 5. Production blockers & discrepancies

1. **Service plan mismatch (owner action needed):** observed sleep/wake ≈ free plan; blueprint/DEPLOYMENT.md require `starter`. Sleep drops in-memory state (rate-limit buckets reset — acceptable) and costs ~25–30s cold starts during demos. **Do not upgrade without owner approval** (paid infra); at minimum freeze the demo plan before 07/12.
2. **Rate limits per replica:** in-memory buckets — scaling beyond one instance weakens them; document if Render scales horizontally.
3. **Supabase bucket privacy:** uploads only render via `GET /uploads/:key` authorization; confirm `repassa-uploads` bucket is **private** in the Supabase dashboard (service-role key is server-only).
4. **Migrations on boot:** `db:migrate:deploy` runs inside the build command — a failed migration fails the deploy (safe), but roll-forward is the recovery path (see §6).
5. **Cold starts on free plan:** first request after idle ≈ 26s — unacceptable mid-demo without warm-up; keep a tab open or upgrade plan (owner decision).

## 6. Rollback strategy

- **App regression:** redeploy previous Render commit (dashboard → deploy history) — schema stays compatible because migrations are additive for this MVP; verify with smoke.mjs.
- **Bad migration:** no `migrate reset` in shared/prod DBs; ship a corrective migration (`migrate dev` locally → PR → deploy). Snapshot/backup before any destructive statement.
- **Vercel regression:** instant rollback via deployment list → promote previous production deployment; `vercel.json` moves with the repo state.
- **Auth lockout after deploy:** access tokens are stateless JWT (≤15min); refresh families persist in DB — worst case users re-login, no data loss.

## 7. Demo preparation checklist (isolated environment)

- [ ] Disposable or staging DB migrated (`db:migrate:deploy`), **seed only with owner consent**
- [ ] Admin provisioned via §3 (password captured once, stored in password manager)
- [ ] Synthetic personas: student donor, institutional staff, reservist, second institution for tenant demo
- [ ] Institution registered → approved → member assigned (fresh audit trail visible in `/admin/auditoria`)
- [ ] One donation with photo + one without → staff receipt → catalog → reservation → code reveal → pickup
- [ ] Negative demos ready: STUDENT on `/admin` (forbidden), duplicate registration (409), reused pickup code (refused)
- [ ] Warm-up request ~30s before presenting (cold start), keep `/api/v1/health` tab
- [ ] Verify `/admin` metrics reflect the demo actions live
- [ ] Fallback ready: if the hosted backend is cold/unreachable mid-demo, the §4
      disposable stack is the backup environment — the same flow runs locally
      (`tests/live/sh02-journey.mjs` drives every demo step end-to-end)

### Cold-start mitigation (free plan, no paid resources)

The only free-tier mitigations are discipline, not infrastructure:

- Hit `/api/v1/health` ~30s before the demo and keep that tab open — a live
  request keeps the instance warm; every interaction during the demo resets
  the idle timer.
- Front-load the demo with the API-heavy steps while the warm-up completes
  in the background (show the catalog page, which needs no warm backend
  for its first paint).
- Never rely on an external keep-alive pinger — that is a recurring cost
  vector and out of scope; warm-up is a manual presenter action.
- If a cold start hits mid-demo anyway, narrate it (~25–30s) or switch to the
  local §4 stack — identical product, zero latency.

## 8. SH-02 verification summary

- Journey (real API + browser, 4 contexts): **17/17**
- Security/integration API checks: **21/21** + recovery **3/3**
- Unit: **41/41** · Playwright (Chrome): **57/57** (incl. axe WCAG2 A/AA on all admin routes, 0 violations) · typecheck/build/agent-guard: clean
- Evidence: `docs/repassa/evidence/sh-02/` (screenshots + this summary)

## 9. RC-01 rerun on integrated main (25/11/2026, `a2fb35d`)

Full §4 stack rerun post-SH-03 merge — both deliveries verified compatible:

- Journey: **17/17** · Security: **23/23** · Recovery (backend kill+restart): **3/3**
- Frontend: `npm run lint` clean · `npm run test:ci` **41/41** · `npm run build` clean
- Backend: `npm run build` clean · unit **51/51** · e2e **121/121** on disposable PG16 (both migrations applied fresh)
- Harness note: `ALLOWED_ORIGINS` is required for any non-3000 vite port (see §4)
- Hosted audit: no drift detected; blockers unchanged — see `evidence/rc-01/`
