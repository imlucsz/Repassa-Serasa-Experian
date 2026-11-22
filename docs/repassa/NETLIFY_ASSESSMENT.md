# RePassa — Netlify Server feasibility assessment (vs Render Free)

Date: 2026-11-22. Sources: docs.netlify.com/build/server (+ /get-started,
/limits, /configuration) and netlify.com/pricing, checked against this repo.
PoC branch: `feat/netlify-server-poc`.

## Verdict up front

**Feasible, but not clearly better than Render Free for the Dec 12 demo.**
Netlify Server runs our NestJS 12 + Fastify 5 app unmodified (proven locally),
but it is **not** always-on: on the Free plan it is hard-capped at 1 small
instance and **always scales to zero after 5 min of inactivity** — the same
cold-start problem Render Free has, plus Early Access and a 300-credit/month
budget that can hard-pause the whole site. Recommend Render as primary;
Netlify documented as a validated secondary option.

## What Netlify Server actually is (Early Access)

- A long-lived Node.js process per **instance** that Netlify provisions and
  scales. One entry file at `netlify/server/index.{ts,mts,js,mjs}`.
- Express/Fastify/Hono/Koa run **as they are** — no adapter; the app just
  `listen()`s on `process.env.PORT`.
- **Node.js ≥ 24 required** (server runs the build's Node version).
- Scale-to-zero: instance stops after **5 min without requests**; always on
  Free (`scale.min` must be 0 during EA).
- Instances: **1 max on Free/Personal**, 3 on Pro/Enterprise. Sizes: `small`
  only on Free (1 GB, shared vCPU, 32 concurrent requests).
- **20s** to send response headers (includes instance start + entry-file
  execution). 30 min max request duration. Instance replaced every 8h.
- **Outbound connections closed after 60s idle** — DB pool idle timeout must
  be < 60s or connections must reconnect.
- Regions: `cmh` (Ohio) or `fra` (Frankfurt) only.
- Routing: static/redirects/functions first, server gets the rest by default;
  `path` restricts it (we set `/api/v1/*`, `/api/docs*`).
- Warm deploys: a new deploy goes live only after the server starts — deploy
  cold starts eliminated; idle cold starts remain.
- Edge cache available but **not applicable** — our API is `no-store` by design.

## Free plan availability — confirmed

Netlify Server is available on credit-based plans incl. **Free**:
300 credits/month. Costs: compute 10 credits/GB-hour (small instance = 1 GB
→ ~10 credits per hour while running), web requests 2 credits/10k, production
deploys 15 credits each. **When credits run out the project pauses** until the
next cycle — a real hard-stop risk: ~20 production deploys or ~30
instance-hours consume the whole monthly budget. Fine for a demo, tight for
continuous staging traffic.

## Compatibility assessment (RePassa backend)

| Area | Verdict | Notes |
|---|---|---|
| NestJS 12 + Fastify 5 | ✅ proven | PoC entry boots `dist/main.js`; all routes mapped; listens on `PORT` |
| Node 24 requirement | ✅ compatible | `engines >=22.12` allows 24; app verified on Node 22 — no 24-only APIs needed; CI stays on 22 |
| Prisma 6.19 | ⚠️ likely OK | Classic binary engine; needs engine binary in the bundle → `includedFiles` for `.prisma`/`@prisma/engines` in netlify.toml. Not verified in Netlify's bundler — **top integration risk** |
| argon2 / sharp (native) | ⚠️ likely OK | Linux prebuilt binaries at build time; `includedFiles` covers `*.node`. Same bundler caveat |
| PostgreSQL connectivity | ✅ | real Node server → normal TCP. Outbound 60s idle close → set pool idle < 60s (Prisma reconnects on next query regardless) |
| Migrations | ✅ | `db:migrate:deploy` in `[build] command` — same as render.yaml |
| Secrets | ✅ | env vars scoped to Functions reach the server; service-role key stays server-only |
| Cookies / CSRF / CORS | ✅ unchanged | Vercel rewrite destination is the only change — same-origin semantics identical; `SameSite=Strict` still first-party |
| Request timeouts | ✅ | 20s header budget ≫ measured 1.47s cold boot; slowest paths (image re-encode, argon2) are ms-scale |
| Rate limiting | ⚠️ | in-memory limiter is per-instance — 1 instance on Free makes it *correct* here (same as single Render instance) |
| Uploads | ✅ | `STORAGE_DRIVER=supabase` is disk-free; no local-fs dependency in prod |
| API paths | ✅ | `path: ['/api/v1/*', '/api/docs*']` routes only API traffic to the server |

## PoC evidence (actually run on this branch)

- `netlify.toml` + `backend/netlify/server/index.mjs` (6-line entry:
  `path`/`region`/`size` config + `import '../../dist/main.js'`).
- Local execution (Node 22, disposable embedded PG 16, migrated):
  full Nest app booted via the entry file — every route mapped,
  Prisma connected, `GET /api/v1/health|live|materials` → 200.
- **Cold boot measured: 1.47 s** (module init → `listen()`), vs Netlify's
  20 s response-header budget — comfortable headroom even on a shared vCPU.
- `netlify dev` (CLI 27.20.1) tested: CLI works, but for a backend-only site
  it insists on a long-running framework dev server on `targetPort` — local
  harness friction, not a runtime blocker. Full bundler behavior
  (Prisma/native tracing) remains unverified until a real deploy.
- Render + Vercel configs untouched; `.netlify` gitignore added.

## Comparison vs Render Free

| | Netlify Server (Free) | Render Free |
|---|---|---|
| Cold starts | After **5 min idle**, always | After ~15 min idle (documented), always |
| Cold-start magnitude | Instance start + entry exec; our boot is ~1.5s | Container start; typically 30–60s observed for Node |
| Concurrency | 32 req/instance, 1 instance | 1 instance, normal Node concurrency |
| Instance size | 1 GB / shared vCPU | 512 MB RAM |
| Region | Ohio or Frankfurt only | several regions |
| Free quota | 300 credits/mo — **hard pause at 0**; deploys cost 15 | 750 instance-hours/mo; spins down, not billed |
| Maturity | **Early Access — behavior/APIs may change** | GA product |
| Ops complexity | vercel.json rewrite swap; entry file | existing render.yaml |
| Deploy coupling | backend lives in frontend's deploy platform (Netlify site would be backend-only anyway) | independent service |
| DB connectivity | outbound conns killed at 60s idle | persistent conns fine |

## Risks

1. **Bundler trace for Prisma/native deps** — unverified until a real deploy;
   `includedFiles` is the documented escape hatch.
2. **Credit exhaustion hard-pauses the site** mid-presentation if budget is
   spent elsewhere — monitor credit usage; keep deploy count low.
3. **Early Access** — limits/behavior may change before Dec 12.
4. **Idle cold start during the demo** — mitigate by hitting
   `/api/v1/health/live` ~1 min before presenting.
5. `netlify dev` local harness needs a frontend dev server — minor DX gap.

## Recommendation for the Dec 12 presentation

1. **Primary: keep Render** (per DEV-05 render.yaml; free plan acceptable,
   starter plan if budget allows to remove sleep entirely).
2. **Netlify Server: validated backup.** If Render Free proves flaky
   (sleep wake > acceptable), deploy this branch to a Netlify site,
   repoint the Vercel rewrite, and warm it before the demo. The same-origin
   cookie/CSRF model carries over unchanged.
3. Do **not** migrate now: EA maturity + credit hard-stop + unverified bundler
   outweigh the 5-min vs ~15-min idle advantage. Revisit if Netlify Server
   reaches GA or Render Free proves unreliable in staging.

## If Netlify is adopted later — required changes

- This branch's `netlify.toml` + `backend/netlify/server/index.mjs` (done).
- Set env vars on the Netlify site (Functions scope): `DATABASE_URL`,
  `JWT_ACCESS_SECRET`, `PICKUP_CODE_SECRET`, `ALLOWED_ORIGINS` (Vercel origin),
  `COOKIE_SECURE=true`, `TRUST_PROXY=true`, `STORAGE_DRIVER=supabase`,
  `SUPABASE_*`, `NODE_ENV=production`, `SWAGGER_ENABLED=false`.
- Update `vercel.json` rewrite destination to the Netlify site hostname.
- Verify bundler includes Prisma engine + native `.node` files (smoke
  register+upload after first deploy).
- Watch credit usage; keep instance warm before the demo.
