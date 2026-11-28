# RC-06 evidence — production readiness and release closure

Date: 2026-11-28
Branch: `test/RC-06-production-readiness`
Current verified `origin/main`: `016a026e72d2a28133b4d0a301efde6b8ee2c3d4`
Application baseline validated in RC-05: `17111e6b05bcb43975f7ce626fb8f2675c7e54f2`

## 1. Final recommendation

**CONDITIONAL GO**

The publicly observable production deployment is healthy, coherent with the RC-05 application build, and passes read-only browser/API validation. No production mutation, registration, login attempt, upload, reservation, database write or attack simulation was performed.

Release closure is **conditional**, not unconditional, because the owner still needs to resolve or explicitly accept the items in §10:

1. confirm authorization/provenance for the real institution/address, public demo materials and public cover images;
2. complete the owner-only environment/migration verification checklist without disclosing secret values;
3. explicitly accept or reconcile the Free-plan cold-start risk and the `render.yaml` blueprint/dashboard drift;
4. confirm concrete database/object-storage backup ownership and restore path before presentation-critical use.

No P0 defect was found. No application code change is proposed by RC-06.

## 2. Scope, boundaries and method

Validated read-only:

- public frontend/backend health endpoints;
- warm latency and one controlled idle-window cold-start probe;
- official cinematic Home and promotional film;
- public catalog, material detail and public image delivery through the backend proxy;
- HTTPS redirection, CORS behavior, security headers and caching policy;
- production static bundle exposure of secret-shaped material;
- public-facing JavaScript/console/network errors;
- responsive layout, keyboard basics, reduced motion and axe accessibility;
- deployment, migration, rollback and backup documentation;
- public demo content provenance indicators.

Not performed:

- no registration, login attempts, uploads, reservations, pickups, password resets or writes;
- no production security attack simulation;
- no local SH-02 mutating harness against production;
- no infrastructure/configuration/deployment change;
- no dashboard investigation already independently performed by the owner.

Validation host used for the external probes: Windows/MSYS shell (`MINGW64_NT-10.0-26200`), Node.js `v24.14.0`, npm `11.9.0`, Python `3.13.15` and Playwright `1.65.1`. The browser QA used Chromium in fresh anonymous contexts. No OmniRoute or paid external provider was used.

Representative reproducible read-only commands:

```bash
curl -sS -D - -o /dev/null https://repassa-serasa-experian.vercel.app/api/v1/health
curl -sS -D - -o /dev/null https://repassa-serasa-experian.onrender.com/api/v1/health
curl -sS -H 'Origin: https://example.invalid' -D - -o /dev/null https://repassa-serasa-experian.onrender.com/api/v1/health
node docs/repassa/evidence/rc-06/production-browser-qa.mjs
```

Do not use the optional authenticated branch of `backend/scripts/smoke.mjs` against production unless the owner separately approves a synthetic production account.

## 3. Revision and deployment evidence

| Item | Evidence |
|---|---|
| Current `origin/main` | `016a026e72d2a28133b4d0a301efde6b8ee2c3d4` |
| RC-05 application commit | `17111e6b05bcb43975f7ce626fb8f2675c7e54f2` |
| Render deployed revision | owner-confirmed `17111e6`; exact SHA is not publicly exposed |
| Vercel deployed revision | owner says latest commit; exact SHA is not publicly exposed |
| Frontend artifact comparison | **43/43 production JS/CSS assets byte-identical** to the RC-05 local build at `17111e6` |
| Main JS SHA-256 | `f966e8b53a5be459da45e15ed04887f5de44d4103497c6918ab388d13623d8e7` both production and RC-05 build |
| Main CSS SHA-256 | `04efdfcb9f1c35ac910086554fec36a6d95aaf5835372c7c4326286fe1d904f7` both production and RC-05 build |

Interpretation: current `main` is a documentation-only descendant of `17111e6` through PR #40. Byte-identical public assets are strong evidence that the public frontend application artifact corresponds to the RC-05-validated build. Exact Render/Vercel commit SHAs remain owner/dashboard-only because neither platform exposes them in public HTTP responses.

Artifacts: `artifacts/asset-revision-and-secret-scan.txt`, `artifacts/asset-hash-manifest.txt`.

## 3.1 Existing deployment and migration configuration

Read-only repository inspection confirms:

- `vercel.json` uses Vite, `npm ci`, `npm run build`, `dist` output, immutable `/assets/(.*)` caching, API rewrites to `https://repassa-serasa-experian.onrender.com/api/v1/:path*` before the SPA fallback, and a temporary redirect from the old cinematic preview route.
- `render.yaml` uses backend `rootDir`, Node runtime, build command `npm ci && npm run build && npm run db:migrate:deploy`, start command `npm run start`, and health check `/api/v1/health`.
- Both committed migrations remain the only migration files: `20261120014024_init` and `20261124230000_institution_approval_status`.
- Startup environment validation refuses `STORAGE_DRIVER=local` in production and requires production `DATABASE_URL`, `JWT_ACCESS_SECRET`, `PICKUP_CODE_SECRET`, Supabase storage configuration and HTTPS origins. Actual production values remain owner-only checks.

The actual owner-confirmed Render dashboard state intentionally diverges from `render.yaml` on plan, deploy mode and origin placeholder; see RC-06-B3. This is configuration drift requiring an explicit owner decision, not evidence that the running service is misconfigured.

## 4. Health, latency, cold start and warm behavior

Initial warm observations:

| Target | Status | Total time |
|---|---:|---:|
| direct Render `/api/v1/health` | 200 | 0.751s |
| Vercel proxy `/api/v1/health` | 200 | 0.876s |
| Vercel `/` HTML | 200 | 0.398s |

Representative warm API/catalog observations were approximately 0.23–0.89s. A sample public JPEG through the proxy took 1.11s for 282,070 bytes; direct backend delivery of the same bytes took 0.99s. Warm times are network-dependent and are not capacity benchmarks.

Controlled idle-window probe: no client traffic from this validation for 16.5 minutes (16:42:24Z–16:58:54Z). The first direct Render health response after that window returned 200 in **0.566s**; subsequent direct responses were 0.302–0.752s and proxy responses 0.310–0.338s. Therefore **no cold start was observed in RC-06**. This is inconclusive rather than evidence that cold starts cannot occur: the service is public, so owner/platform/health-check or third-party traffic may have kept the single instance warm. The owner-confirmed Free-plan cold-start risk remains an operational condition.

Artifacts: `artifacts/api-timings.txt`, `artifacts/detail-image-timings.txt`, `artifacts/coldstart-results.txt`.

## 5. HTTPS, CORS and security headers

### HTTPS

- `http://repassa-serasa-experian.vercel.app/` → 308 to HTTPS.
- `http://repassa-serasa-experian.onrender.com/api/v1/health` → 301 to HTTPS.
- Backend and frontend HTTPS responses include HSTS.

### CORS

Read-only observations with `Origin` headers:

- exact origin `https://repassa-serasa-experian.vercel.app` receives `Access-Control-Allow-Origin` with that exact origin plus `Access-Control-Allow-Credentials: true`;
- foreign origin `https://example.invalid` receives no `Access-Control-Allow-Origin`;
- allowed preflight returns 204 and permits only `GET, POST, PATCH, OPTIONS` plus `Content-Type, Authorization, X-Repassa-Request`;
- foreign preflight returns 404/no credentialed CORS headers.

This matches the documented same-origin proxy model. The bare Render origin remains technically reachable for public API reads, but credentialed browser access is origin-restricted.

Artifact: `artifacts/cors-results.txt`.

### Backend/API security headers

Observed on direct and proxied API responses:

- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: no-referrer`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `X-Permitted-Cross-Domain-Policies: none`
- `X-DNS-Prefetch-Control: off`
- HSTS

Artifacts: `artifacts/direct-health-headers.txt`, `artifacts/proxy-health-headers.txt`, `artifacts/proxy-image-headers.txt`.

### Frontend static security headers

The Vercel HTML/static responses include HSTS but did **not** include a Content Security Policy, `frame-ancestors`, `X-Frame-Options` or `X-Content-Type-Options` in the observed headers. This is a defense-in-depth hardening gap, not a demonstrated exploit. See P2-1.

## 6. Caching and revalidation

Validated:

- HTML `/`: `Cache-Control: public, max-age=0, must-revalidate` with ETag; conditional request returned **304** and `X-Vercel-Cache: HIT`.
- hashed JS/CSS/MP4 assets: `Cache-Control: public, max-age=31536000, immutable`; conditional request returned **304**.
- API health, catalog/detail and image proxy responses: `Cache-Control: no-store`.
- public image proxy returns exact bytes through both Vercel and Render with `Content-Type: image/jpeg` and no-store.

All 11 public catalog images decoded as progressive JPEGs. Combined byte size was 10,433,414 bytes; five were 3024×4032 originals. There is no resized thumbnail variant in the public API. This is a performance optimization concern, not a correctness failure.

This is the desired split: immutable hashed static assets, revalidated HTML, uncached API responses.

Artifacts: `artifacts/revalidation-results.txt`, `artifacts/public-image-dimensions.txt` and raw header artifacts.

## 7. Production bundle exposure

All 43 downloadable production JS/CSS assets were compared byte-for-byte with the RC-05 local build and scanned for secret-shaped material.

Zero occurrences found for:

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `PICKUP_CODE_SECRET`
- PostgreSQL URLs
- private-key blocks
- common GitHub/Google/Stripe/JWT-looking token patterns
- `service_role` / `sk_live`

No sourcemap links were exposed. The production API hostname was not hardcoded in the bundle; only relative `/api/v1` references appeared. This is correct for the same-origin proxy design.

Artifacts: `artifacts/asset-revision-and-secret-scan.txt`, `artifacts/asset-hash-manifest.txt`.

## 8. Read-only production browser validation

Script: `production-browser-qa.mjs`
Result: **16/16 passed**
Artifact: `artifacts/production-browser-qa.txt`
Screenshot: `screenshots/01-production-home-film-1440.png`

Validated in real production browser contexts:

- official cinematic Home renders;
- promotional film plays inline, 1080×1920, 22s, controls enabled and 7 Portuguese caption cues;
- keyboard starts at the skip link;
- public catalog loads 12 live materials;
- 3D shelf accepts keyboard operation;
- material detail opens from real production data;
- public detail image is delivered through `/api/v1/uploads/...` and decodes (`naturalWidth=1088` for the sampled image);
- controlled public 404 route renders;
- 390px mobile layout has no horizontal overflow;
- reduced-motion mode renders final content with zero running animations and defaults to accessible grid;
- axe WCAG 2 A/AA + 2.1 A/AA found zero serious/critical violations on Home, catalog/detail desktop and mobile catalog;
- no JavaScript page errors;
- no unexpected console errors;
- no non-cancelled document/media/API request failures;
- no state-changing application mutation was performed or observed. Browser traffic consisted of public GETs plus the normal unauthenticated `POST /auth/refresh` probe in fresh contexts; without a refresh cookie that probe cannot rotate or revoke a session.

Public catalog screenshots and downloaded cover images were **not copied into Git** because image provenance is unresolved; see §9. The single committed screenshot is the approved cinematic Home/film surface.

### Browser observations requiring triage

1. Fresh anonymous contexts issue `POST /api/v1/auth/refresh` even without a cookie. In this validation there were 8 such probes across pages/contexts. They are expected to fail 401 without mutation because no refresh cookie existed, but Chromium prints five public console resource errors. This is console-noise/efficiency polish, not a functional failure.
2. Three `net::ERR_ABORTED` request entries were client-side cancellations caused by navigation/media lifecycle, not server failures; all critical resources needed by the tested pages loaded successfully.

## 9. Public demo content and provenance review

Public catalog state:

- 12 `AVAILABLE` materials;
- one public institution: `Instituto Proa`;
- public address: `Av. Brig. Faria Lima, 4055 - 4º andar - Itaim Bibi, São Paulo - SP, 04538-133`;
- pickup instructions: `Balcão principal, seg - sex das 09:00 ás 18:00`;
- 11 image-bearing materials and one without an image;
- duplicate title `Quarta Asa` appears twice, one with an image and one without.

Artifact: `artifacts/public-content-summary.txt`.

### Provenance concerns — not proof of wrongdoing

1. **The institution and address are real, not obviously fictional.** Public web results from the official `proa.org.br` domain show `ASSOCIAÇÃO INSTITUTO PROA` at the same `Av. Brigadeiro Faria Lima, 4055 – 4º andar` address. The pickup hours also match commonly published Monday–Friday 09:00–18:00 hours. The project agreement says demo institutions/data are fictional unless explicitly confirmed by the owner. Therefore the owner must explicitly confirm authorization/consent to use this real institution name, address and operating hours in production demo data.
2. **Several images visually resemble publisher cover art or clean marketing cover images**, while others appear to be physical photographs of books. External validation cannot establish whether they are owner-created photographs, donor-uploaded photos, licensed images or copied cover art. The owner must confirm provenance/authorization rather than assume it.
3. **Material provenance cannot be externally verified.** Titles/descriptions look like real donated books, not synthetic fixtures. That may be intended, but the owner should confirm these are authorized demo/real donations and not unreviewed personal data.
4. **Demo data quality concerns:** one apparent book (`Introdução ao cálculo numerico`) is categorized as `SUPPLIES`; `Quarta Asa` appears duplicated with divergent descriptions/image presence; some descriptions are informal; pickup instructions use `ás` instead of `às`. These are content/demo-polish issues rather than application defects.

## 10. Concrete remaining blockers / release conditions

### RC-06-B1 — owner authorization/provenance confirmation required

Before treating public production demo content as release-ready, the owner must confirm in writing privately or in project documentation:

- whether Instituto PROA authorized use of its real name/address/pickup context;
- whether the public materials are intentional real demo donations or synthetic/owner-controlled fixtures;
- whether every public image is owner-created, donor-authorized, licensed or otherwise approved for use;
- whether duplicate/informal/misclassified content is intentional for the presentation.

No authorization is assumed by this report.

### RC-06-B2 — owner-only production environment and migration verification

These cannot be verified externally without privileged access. **Do not share secret values.** The owner should confirm existence/shape/state only:

- `NODE_ENV=production`;
- `DATABASE_URL` points to the intended managed PostgreSQL 16/Supabase database;
- `JWT_ACCESS_SECRET` exists, is at least 32 characters, is unique to production and is stable across ordinary restarts/redeploys;
- `PICKUP_CODE_SECRET` exists, is at least 32 characters, is unique to production and is stable across ordinary restarts/redeploys;
- the two secrets above are different and stored only in approved secret storage;
- `ALLOWED_ORIGINS` is exactly the intended Vercel origin or deliberate comma-separated origins;
- `COOKIE_SECURE=true` or is omitted so production defaults to true;
- `TRUST_PROXY=true`;
- `STORAGE_DRIVER=supabase`;
- `SUPABASE_URL` points to the intended project;
- `SUPABASE_SERVICE_ROLE_KEY` exists only server-side and is not exposed in browser/logs;
- `SUPABASE_STORAGE_BUCKET=repassa-uploads`;
- `SWAGGER_ENABLED=false`;
- `SEED_DEMO_PASSWORD` is absent in production;
- Render build command remains `npm ci && npm run build && npm run db:migrate:deploy`;
- latest Render deploy for the intended revision succeeded, including migration deploy.

Read-only migration-state query for the owner inside the approved database console only:

```sql
select migration_name, finished_at, rolled_back_at
from _prisma_migrations
order by started_at;
```

Expected migration names:

- `20261120014024_init`
- `20261124230000_institution_approval_status`

Both should have non-null `finished_at` and null `rolled_back_at`, with no additional failed row.

### RC-06-B3 — Free plan/cold-start and blueprint drift decision

Owner-confirmed production is Free (0.1 CPU, 512 MB), one instance, autoscaling disabled, automatic deployments enabled. `render.yaml` still describes starter, `autoDeploy:false` and a staging `ALLOWED_ORIGINS` placeholder. The owner must either:

- accept the Free/autodeploy dashboard state as intentional and update the repository blueprint in a separate owner-approved config PR; or
- change the dashboard to the stricter blueprint intentionally.

Do not upgrade paid infrastructure or edit infrastructure silently. Because automatic deployments are enabled, even merging this documentation-only PR may trigger a new production deployment of the same application artifact; owner review should treat merge timing as release timing. For the presentation, the Free plan requires a manual warm-up/backup-demo plan.

### RC-06-B4 — backup/restore ownership

Rollback documentation exists in RUNBOOK §6, but backup documentation remains high-level. Before presentation-critical production use, the owner should confirm privately:

- who owns Supabase/PostgreSQL backups;
- current backup schedule/retention;
- whether a pre-presentation snapshot/backup exists;
- who can restore it and the expected restore path;
- whether Supabase Storage objects are included or separately protected;
- whether rollback was rehearsed or at least walkthrough-reviewed.

No destructive restore test is requested or authorized.

## 11. Findings

### P0

None.

### P1

**P1-1 — Public production content provenance/authorization is not externally verifiable.** This is a release-content blocker until the owner explicitly resolves RC-06-B1. The concern is triggered by the exact real institution/address match and publisher-like cover imagery; it is not an accusation of unauthorized use.

### P2

1. **P2-1 — Frontend static security headers are thinner than backend headers.** HTML/static responses lack CSP/frame-ancestors/nosniff hardening. No exploit was demonstrated; backend API responses are stronger. Consider a follow-up hardening PR only after release review.
2. **P2-2 — Anonymous refresh probes create public console 401 noise.** Functional behavior is correct and no mutation occurs without a cookie, but the probe is noisy and unnecessary when no session hint exists.
3. **P2-3 — Demo content quality issues.** Duplicate `Quarta Asa`, a miscategorized book, informal descriptions and the `ás` typo may reduce presentation credibility.
4. **P2-4 — Exact deployed SHAs are not externally observable.** Artifact hash comparison mitigates this for the frontend, but exact platform revision proof remains dashboard-only.
5. **P2-5 — Public catalog images are large originals without thumbnail variants.** The 11 images total about 10.4 MB and five are 3024×4032. Lazy loading limits some initial cost, but scrolling the catalog can be expensive on mobile/free hosting. Do not change implementation in RC-06; consider thumbnails in a post-review performance task.

### Operational risk, not an application defect

- Free-plan cold starts can create tens-of-seconds delays after idle. RC-06 did not observe one; warm production responses were sub-second to ~1s in this session. See the inconclusive idle-window probe in §4.

## 12. Documentation reconciliation performed in RC-06

Documentation-only corrections made in this branch:

- `DEPLOYMENT.md` now records the owner-confirmed production topology facts and explicitly distinguishes them from the stricter repository blueprint.
- `RUNBOOK.md` production state, deployment instructions and blocker list now reflect owner-confirmed Free/single-instance/autodeploy state and private Supabase bucket facts.
- RC-05 evidence now has an RC-06 reconciliation addendum.
- RC-05 restart limitation clarified: the controlled local restart intentionally generated a new JWT signing secret. An ordinary production restart should preserve configured `JWT_ACCESS_SECRET`; database-backed opaque refresh sessions should survive. RC-05 did not prove production secret persistence.
- `STATUS.md` and `ROADMAP.md` were updated for PR #40 and RC-06.

`render.yaml` was intentionally **not** edited because it is deployment configuration, not documentation, and changing it could have infrastructure implications. The drift is documented instead.

## 13. Backup and rollback documentation assessment

Rollback coverage:

- Render previous-version redeploy documented;
- roll-forward corrective migration path documented;
- Vercel previous-deployment promotion documented;
- auth lockout behavior documented.

Gaps:

- no concrete backup owner/schedule/retention/restore drill is documented;
- no explicit Supabase Storage object backup/restore path is documented;
- no pre-presentation snapshot evidence exists in the repository.

This is why RC-06-B4 remains a release condition.

## 14. Evidence inventory

- `RC-06-EVIDENCE.md` — this report
- `production-browser-qa.mjs` — read-only browser validation script
- `artifacts/` — raw headers, timings, public-content summary, browser results and asset scan
- `screenshots/01-production-home-film-1440.png` — approved cinematic Home/film surface

No credentials, tokens, cookies, pickup codes or secret values are included.
