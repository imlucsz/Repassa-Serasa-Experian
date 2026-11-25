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
| **Plan** | service **sleeps** (first request took ~26s) | blueprint says `starter` — **discrepancy, see §5** |
| Storage | service boots ⇒ `STORAGE_DRIVER=supabase` valid (`local` aborts in production) | private Supabase bucket |

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

## 4. Disposable validation stack (local, never production)

```
# 1) disposable PG16 (bundled binaries, temp cluster) — prints READY <databaseUrl>
cd backend && node test/helpers/pg-daemon.mjs 55434 &
# 2) schema + provision (NO seed — production path); use the printed URL
DATABASE_URL=<disposable-url> npm run db:migrate:deploy
DATABASE_URL=<disposable-url> \
  npx tsx scripts/provision-admin.ts --generate --email admin-jornada@example.com --name "Admin"
# 3) backend + frontend (api mode)
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

## 8. SH-02 verification summary

- Journey (real API + browser, 4 contexts): **17/17**
- Security/integration API checks: **21/21** + recovery **3/3**
- Unit: **41/41** · Playwright (Chrome): **57/57** (incl. axe WCAG2 A/AA on all admin routes, 0 violations) · typecheck/build/agent-guard: clean
- Evidence: `docs/repassa/evidence/sh-02/` (screenshots + this summary)
