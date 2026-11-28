# RePassa — Operations runbook (SH-02)

Audience: owner + agents deploying or demoing the integrated product.
Deployment topology and rationale: `DEPLOYMENT.md`. Staging checklist: `STAGING.md`.
Nothing here authorizes deploying, merging or mutating production — owner approval required.

## 1. Verified production state (RC-06, 28/11/2026)

| Item | Current verified/owner-confirmed state | Notes |
|------|------------------------------------------|-------|
| Current `origin/main` | `016a026e72d2a28133b4d0a301efde6b8ee2c3d4` | docs-only RC-05 evidence merge on top of application commit `17111e6` |
| Render application revision | owner-confirmed `17111e6` | exact SHA is not exposed in public HTTP evidence |
| Vercel revision | owner says latest commit; public asset hashes match the RC-05/`17111e6` build exactly | exact SHA/deployment id is not exposed as a commit in public HTTP evidence |
| Render plan | **Free: 0.1 CPU, 512 MB RAM** | owner-confirmed; differs from `render.yaml` starter reference |
| Render scaling/deploys | exactly one instance, autoscaling disabled, automatic deployments enabled | owner-confirmed; autodeploy differs from `render.yaml` manual reference |
| Frontend | `repassa-serasa-experian.vercel.app` 200 | Vercel + `vercel.json` |
| API | `repassa-serasa-experian.onrender.com` healthy | direct and proxied `/api/v1/health` return 200 `{"status":"ok"}` |
| API proxy | `/api/v1/*` reaches Render before SPA fallback | API responses carry `Cache-Control: no-store` |
| Swagger | `/api/docs` → 404 | consistent with `SWAGGER_ENABLED=false` |
| CORS | exact Vercel origin receives credentialed CORS; foreign origin receives no `Access-Control-Allow-Origin` | same-origin browser path does not require CORS |
| Storage | owner-confirmed Supabase `repassa-uploads`: private (`public=false`), zero Storage policies, JPEG/PNG/WebP | public image bytes are served through authorized backend proxy |
| Demo content | 12 public AVAILABLE materials at one institution | provenance/authorization review in `evidence/rc-06/` |

## 2. Deploy / redeploy steps

1. Owner confirms `main` is green (agent-guard, frontend-quality, backend-quality, Vercel).
2. Render production currently has owner-confirmed automatic deployments enabled. Treat every reviewed merge to `main` as deployment-impacting unless the owner changes that setting. The documented build command runs `npm ci && npm run build && npm run db:migrate:deploy` (migrations are versioned — no `db push`/`migrate reset` on shared DBs).
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
$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', (Read-Host 'DATABASE_URL' -AsSecureString)).Password
npx tsx scripts/reset-password.ts
Remove-Item Env:DATABASE_URL
```

POSIX shell:

```bash
cd backend
read -s -p 'DATABASE_URL: ' DATABASE_URL; printf '\n'
export DATABASE_URL
npx tsx scripts/reset-password.ts
unset DATABASE_URL
```

The script prompts for the account email twice, requires typing `REDEFINIR` for a non-local database, reads the new password twice without echoing it, updates only `passwordHash`, revokes all live refresh sessions in the same transaction, verifies that zero unrevoked sessions remain and writes `admin.password_reset` audit metadata (no password/hash/token). Never paste the connection string into chat, tickets or PRs. When the target is Supabase production, use the existing secret value from the approved secret store/dashboard; do not create a new database or run seed.

Immediate invalidation of already issued access tokens requires the API to run the credential-fingerprint revision introduced with this script. Against an older API revision, refresh sessions are revoked but existing access tokens remain valid until normal expiry (default ≤15 minutes).

## 4. Disposable validation stack (local, never production)

```
# 1) controlled disposable stack — one launcher owns PG16, migrations,
# admin provisioning, the local backend, local temp-disk object storage and the
# Vite proxy. It prints a one-time admin password and a manifest path.
node tests/live/start-disposable-stack.mjs

# 2) journeys — in a second shell, use the printed values. The mutating
# harnesses fail closed unless the launcher manifest and the live backend-login
# audit proof match the same disposable database.
export JOURNEY_STACK_MANIFEST=<printed-manifest>
export REPASSA_ADMIN_PASSWORD=<one-time>
node tests/live/sh02-journey.mjs
export JOURNEY_DB_URL=<disposable-url>
node tests/live/sh02-security.mjs

# 3) restart the backend controlled by the launcher, then:
... same env ... node tests/live/sh02-security.mjs --recovery
```

When overriding launcher ports, set the matching `JOURNEY_BASE`, `JOURNEY_API` and `JOURNEY_DB_URL` explicitly. A manually arranged lookalike stack is intentionally insufficient: the harness requires the controlled launcher manifest, loopback endpoints, local object-storage attestation, a non-redirecting frontend proxy and proof that the backend login mutation reached the disposable database. Each execution also performs one verification admin login and requires the disposable database audit count for that identity to increase by exactly one before any journey mutation.

`SEED_DEMO_PASSWORD` + `npx prisma db seed` only for demo environments with owner consent — **never** on the production DATABASE_URL.

## 5. Production blockers & discrepancies

1. **Service plan intentionally owner-confirmed as Free:** the old "unconfirmed plan" discrepancy is resolved. Free 0.1 CPU/512 MB means cold starts remain a demo risk. **Do not upgrade without owner approval** (paid infra); freeze the demo warm-up plan before 07/12.
2. **Blueprint/dashboard drift:** `render.yaml` still says starter, `autoDeploy: false` and a staging `ALLOWED_ORIGINS` placeholder, while the owner-confirmed dashboard state is Free, automatic deployments enabled and externally allows the production Vercel origin. Reconcile deliberately in an owner-approved config change; do not silently edit infrastructure.
3. **Rate limits per replica:** in-memory buckets — correct only for the owner-confirmed single instance. Scaling beyond one instance weakens them; do not scale horizontally without a shared-limiter design.
4. **Supabase bucket privacy:** owner-confirmed private (`public=false`) with zero Storage policies. Keep it private; uploads must render only through `GET /uploads/:key` authorization.
5. **Migrations on boot:** `db:migrate:deploy` runs inside the build command — a failed migration fails the deploy (safe), but roll-forward is the recovery path (see §6). Exact production migration rows cannot be verified externally and remain an owner-only read-only check.
6. **Cold starts on free plan:** first request after idle can take tens of seconds — unacceptable mid-demo without warm-up; keep a tab open or upgrade plan (owner decision).

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
