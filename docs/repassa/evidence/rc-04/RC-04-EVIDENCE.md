# RC-04 evidence â€” dependency security, Prisma integrity and database reliability

Date: 2026-11-27
Branch: `fix/RC-04-prisma-integrity`
Base: `origin/main` `310226e`
Scope: backend dependency metadata, backend Prisma schema representation, disposable PostgreSQL verification. No production system was mutated.

## 1. Initial dependency audit

Baseline command: `npm ci` followed by `npm audit --json` and `npm audit --omit=dev --json` in `backend/`.

Raw artifacts: `baseline/npm-audit-all.json`, `baseline/npm-audit-prod.json`, `baseline/npm-explain.json`.

Baseline results:

| Audit target | Critical | High | Moderate | Total |
|---|---:|---:|---:|---:|
| All dependencies | 0 | 4 | 18 | 22 |
| Production-selected dependencies | 0 | 4 | 0 | 4 |

The four high-severity entries were four audited package entries, not four unique advisories:

- `deepmerge-ts` â€” directly affected package.
- `effect` â€” directly affected package.
- `@prisma/config` â€” inherits both through exact dependencies.
- `prisma` â€” inherits through `@prisma/config`.

There were therefore **two unique advisories** in the Prisma CLI dependency chain.

The 18 remaining moderate entries were development-only Jest/glob/minimatch chains and are outside this RC-04 scope.

## 2. Official advisory references

### deepmerge-ts â€” GHSA-ggr8-5vv4-36mx / CVE-2026-40345

Authoritative references:

- https://github.com/advisories/GHSA-ggr8-5vv4-36mx
- https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx
- https://www.cve.org/CVERecord?id=CVE-2026-40345

Verified properties:

- Affected: `< 8.0.0`.
- Patched: `>= 8.0.0`.
- Issue: uncontrolled recursion/stack exhaustion when merging recursive object graphs.
- Important prerequisite: plain JSON cannot create the recursive object graph; both merged values need self-references at the same property path.

### effect â€” GHSA-7589-6fvf-x4pw / CVE-2026-121707

Authoritative references:

- https://github.com/advisories/GHSA-7589-6fvf-x4pw
- https://github.com/Effect-TS/effect/security/advisories/GHSA-7589-6fvf-x4pw
- https://osv.dev/vulnerability/GHSA-7589-6fvf-x4pw

Verified properties:

- Affected: `<= 3.22.0`.
- Patched: `3.22.1`.
- Issue: cubic-backtracking ReDoS in `Schema.TemplateLiteral` when multiple string spans are compiled to ambiguous regex wildcards.
- Reachability requires application use of affected template-literal schemas on attacker-controlled input.

## 3. Actual dependency paths and versions

Before remediation:

```text
repassa-backend
â”œâ”€ prisma@6.19.3 (devDependency)
â”‚  â””â”€ @prisma/config@6.19.3
â”‚     â”œâ”€ deepmerge-ts@7.1.5
â”‚     â””â”€ effect@3.21.0
â””â”€ @prisma/client@6.19.3 (runtime dependency)
```

`@prisma/client` itself declares no runtime dependency on `@prisma/config`, `deepmerge-ts` or `effect`. The audit path exists because `prisma` is an optional peer of `@prisma/client` and is also explicitly present as the migration/generation CLI.

A temporary production-install verification using only the committed backend manifest and lockfile ran:

```text
npm ci --omit=dev --ignore-scripts
npm ls prisma @prisma/config deepmerge-ts effect --omit=dev
```

It confirmed that npm includes the optional Prisma CLI peer in this lockfile even with `--omit=dev`; see `after/production-install.txt`. Installed presence is not the same as runtime loading.

## 4. Runtime applicability assessment

Source inspection found application imports from `@prisma/client` only. No application source imports `prisma`, `@prisma/config`, `deepmerge-ts` or `effect` directly.

`@prisma/config` is used by the Prisma CLI/config loader:

- it dynamically imports `deepmerge-ts` and passes `deepmerge` as the `c12` merger;
- it uses Effect Schema to validate Prisma configuration shapes;
- no `Schema.TemplateLiteral` use was found in `@prisma/config`.

Consequently:

- normal API request handling does not decode untrusted input with Effect `Schema.TemplateLiteral`;
- normal API request handling does not merge attacker-controlled recursive object graphs with `deepmerge-ts`;
- the vulnerable code is primarily build/deployment tooling surface, not a demonstrated request-runtime exploit path;
- Prisma CLI **is required** in the documented Render build because `buildCommand` is `npm ci && npm run build && npm run db:migrate:deploy`.

This assessment does not mean the audit noise is acceptable: because the production installation materializes the vulnerable packages, remediation was still required.

## 5. Remediation alternatives and selection rationale

### A. Supported Prisma 6 patch/minor upgrade â€” not available

`prisma@6` and `@prisma/client@6` were both already at latest supported 6.x version `6.19.3`. Prisma `6.19.3` still depends on `@prisma/config@6.19.3`, which exactly depends on `deepmerge-ts@7.1.5` and `effect@3.21.0`.

### B. Narrow transitive update â€” partially applicable

`effect@3.22.1` is the minimal patched patch release. `deepmerge-ts` has no patched 7.x; the fix is only in 8.x.

### C. Scoped documented override â€” selected

Selected smallest feasible remediation:

```json
"overrides": {
  "@prisma/config": {
    "deepmerge-ts": "8.0.2",
    "effect": "3.22.1"
  }
}
```

Rationale:

- Prisma remains at supported `6.19.3`; no Prisma 7 migration was attempted.
- The override is scoped to `@prisma/config`, not global.
- `effect` moves only to the minimal patched patch release.
- `deepmerge-ts` requires a major bump because the maintainer fixed only 8.x. The v8 breaking change concerns Map deep-merge semantics; `@prisma/config` uses the stable variadic `deepmerge` function as a plain configuration merger for `c12`, whose merger signature is `(...sources) => config`. No Map-specific Prisma configuration path was identified.
- API compatibility was not merely assumed: Prisma validate, generate, migrate diff, fresh migrate deploy, redeploy, backend build and complete backend tests all passed with the overridden packages.

### D. Build/runtime dependency separation â€” not selected

The documented Render build needs Prisma CLI for `db:migrate:deploy`; removing it would break deployment unless deployment configuration changed. Render configuration changes are explicitly outside RC-04 scope. A separate production pruning strategy can be considered later, but it is not needed after the scoped override.

### E. Prisma major upgrade â€” not selected

Prisma 7/8-line major migration was explicitly prohibited as an automatic remediation and would be unnecessary risk for this release candidate.

## 6. Before/after vulnerability counts

After remediation raw artifacts: `after/npm-audit-prod.json`, `after/npm-audit-all.json`, `after/npm-ls-prisma-prod.txt`.

| Audit target | Before | After |
|---|---:|---:|
| Production critical/high | 0 critical / 4 high | 0 critical / 0 high |
| Production total | 4 | 0 |
| All-dependencies critical/high | 0 critical / 4 high | 0 critical / 0 high |
| All-dependencies total | 22 | 18 moderate |

Resolved installed versions:

```text
@prisma/config@6.19.3
â”œâ”€ deepmerge-ts@8.0.2 overridden
â””â”€ effect@3.22.1 overridden
```

The residual 18 moderate findings are development-only Jest/glob/minimatch chains. They are not Prisma findings and were not cosmetically suppressed.

## 7. Prisma schema and migration comparison

Confirmed drift before the change:

- migration `20261124230000_institution_approval_status` creates `institutions_status_idx` on `institutions(status)`;
- `model Institution` did not declare that index.

Schema-only reconciliation added:

```prisma
@@index([status], map: "institutions_status_idx")
```

No migration file was added or edited.

Diff evidence:

- Base schema (extracted from `HEAD`) compared to committed migrations produced exactly:

  ```sql
  CREATE INDEX "institutions_status_idx" ON "public"."institutions"("status" ASC);
  ```

  Artifact: `after/diff-base-schema-to-migrations.sql`.

- Corrected schema compared to committed migrations produced `-- This is an empty migration.`
  Artifact: `after/diff-fixed-schema-to-migrations.sql`.

- Live migrated disposable database compared to corrected schema also produced `-- This is an empty migration.`
  Artifact: `after/diff-live-db-to-fixed-schema.sql`.

This proves the correction is schema representation reconciliation, not a database-changing migration.

## 8. Disposable PostgreSQL verification results

Environment: embedded disposable PostgreSQL 16 on loopback, synthetic credentials and fictional data only. The database URL was explicitly loopback `127.0.0.1`; no production or remote database was used.

Verified on a fresh empty database:

- `npx prisma validate` â€” pass (`after/prisma-validate.txt`).
- `npx prisma generate` â€” pass, Prisma Client 6.19.3 (`after/prisma-generate.txt`).
- `npx prisma migrate deploy` â€” both committed migrations applied successfully (`after/migrate-deploy-fresh.txt`).
- `npx prisma migrate status` â€” database up to date (`after/migrate-status.txt`).
- Re-running `migrate deploy` against the already migrated database â€” `No pending migrations to apply` (`after/migrate-deploy-existing.txt`).
- A synthetic institution inserted before redeploy remained present afterward (`after/existing-record-after-redeploy.json`).

PostgreSQL catalog verification (`after/database-integrity.json`) confirmed:

- `institutions_status_idx` exists as `CREATE INDEX ... USING btree (status)`;
- partial unique index `reservation_one_active_per_material` exists with predicate `WHERE (status = 'ACTIVE'::reservation_status)`;
- all custom check constraints remain present, including reservation/refresh temporal checks and materials/users length checks;
- both rows in `_prisma_migrations` are finished.

Expected Prisma diff limitation: unsupported custom SQL objects (check constraints and the partial unique index) are not represented in the Prisma schema diff. They were therefore verified directly through PostgreSQL catalogs. The corrected schema diff is empty because Prisma does not report those unsupported objects as destructive drift; this is expected and was not treated as proof by itself.

Migration compatibility note: RC-04 adds no migration and leaves both migration files byte-for-byte unchanged. Compatibility with a database initialized from the previous main revision is therefore preserved by construction; the redeploy and existing-record checks provide additional evidence.

## 9. Regression test results

Commands were run in `backend/` after `npm ci` with the committed lockfile and overridden dependencies:

| Check | Result |
|---|---|
| `npm ci` | pass |
| `npm run lint` (TypeScript noEmit) | pass |
| `npm run build` | pass |
| `npm run test` | 52/52 unit tests passed, 6/6 suites |
| `npm run test:e2e` | 125/125 e2e tests passed, 13/13 suites |
| Production dependency audit | 0 findings |
| Startup smoke | HTTP 200 from `/api/v1/health` |
| `node scripts/agent-guard.mjs staged` | pass |
| `git diff --cached --check` | pass |

Raw artifacts: `after/typecheck.txt`, `after/build.txt`, `after/unit-tests.txt`, `after/e2e-tests.txt`, `after/startup-smoke.txt`, `after/startup-health.json`.

The E2E run itself applied both migrations to a fresh disposable PostgreSQL 16 service before running tests.

Test-count note: this branch intentionally does not include open PR #37/RC-03b changes. Therefore 125 E2E tests are expected here, rather than the 128 tests reported on the RC-03b branch. RC-04 touches only dependency metadata and the Prisma schema; it does not modify RC-03b-owned upload, password-reset, reservation test or live-harness files.

Startup smoke used the compiled `dist/main.js`, `NODE_ENV=test`, local storage and the disposable loopback database. It logged `Connected to PostgreSQL`, started successfully and returned:

```json
{"status":"ok"}
```

## 10. Deployment compatibility assessment

Read-only inspection of `render.yaml` and `.github/workflows/agent-quality.yml`:

- backend `engines` requires Node `>=22.12`;
- CI uses Node 22;
- local verification used Node v24.14.0, so CI remains the authoritative Node 22 verification;
- Render build command is `npm ci && npm run build && npm run db:migrate:deploy`;
- Render start command is `npm run start`;
- Prisma CLI remains available for migration deployment;
- `@prisma/client` and `prisma` remain aligned at `6.19.3`;
- `deepmerge-ts@8.0.2` requires Node `>=16.9.0`, compatible with Node 22+;
- no environment-variable contract, Render/Vercel/Supabase configuration, API contract or startup command was changed.

No production secrets were requested or printed.

## 11. Remaining risks and limitations

1. The override is evidence-backed but still an override across a `deepmerge-ts` major boundary. The risk is bounded to Prisma CLI configuration merging and was exercised through real CLI and migration operations. If a future Prisma 6 release adopts patched dependencies, prefer that supported release and remove the override.
2. Prisma emits a deprecation warning for `package.json#prisma` seed configuration. This existed before RC-04 and is part of a future controlled Prisma major migration, not introduced here.
3. The custom check constraints and partial unique index are not expressible in the Prisma schema. They require continued manual preservation in future migrations and direct catalog verification.
4. Local verification used Node 24; GitHub CI Node 22 result must be checked on the PR before merge.
5. Final integrated SH-02 harness was not run, per instruction. It remains a final release-candidate activity after pending PRs are merged.
6. Development-only moderate Jest/glob/minimatch advisories remain outside this scoped remediation.

## 12. Rollback instructions

No database rollback is required because no migration was added and the institution index already existed in committed migrations.

Preferred rollback: revert the RC-04 PR.

Targeted rollback:

1. Remove the `overrides` block from `backend/package.json`.
2. Remove `@@index([status], map: "institutions_status_idx")` only if reverting the schema reconciliation is explicitly desired.
3. Run `npm install --package-lock-only --ignore-scripts` in `backend/` and commit the restored lockfile.

Rolling back the override restores the previously audited vulnerable transitive versions; that should be treated as a security regression and only done if the override causes a concrete operational failure.

## 13. Skills and tools actually used

- RePassa skills: `repassa-context`, `repassa-implement`, `repassa-verification`, `repassa-review`.
- Graphify local graph for orientation; the graph was stale, so all graph claims were verified against current source and not used as sole evidence.
- npm audit/explain/ls/ci, official GitHub/OSV/CVE advisories, Prisma CLI, embedded PostgreSQL 16, PostgreSQL catalog queries, Node.js, TypeScript, Jest, curl, Git.
- No OmniRoute, external AI provider, paid fallback, production database or production deployment.

## 14. Recommendation

**GO for scoped RC-04 merge after green PR checks and owner review.**

Rationale: production Prisma-chain high-severity audit entries are reduced to zero without a Prisma major upgrade, Prisma schema drift is reconciled without a new migration, disposable PostgreSQL integrity is directly verified, and the complete backend regression suite passes.

Release-level conditions remain outside this PR: owner review, integration with PR #37/RC-03b, and the final integrated SH-02 harness on the selected release candidate.
