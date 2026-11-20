---
name: repassa-database
description: Design or review RePassa Prisma migrations, PostgreSQL constraints, concurrency, expiry and data integrity.
---

# Preserve database invariants

1. Read [data model](../../../docs/repassa/DATA_MODEL.md), [business rules](../../../docs/repassa/BUSINESS_RULES.md) and the affected contract. Name the invariant and its database enforcement. Review foreign keys, uniqueness, appropriate indexes, transaction scope and existing data.
2. Inspect the generated migration SQL and preserve constraints Prisma cannot express, including the partial unique active-reservation index. Consider compatibility during rollout, existing records, lock duration and a safe roll-forward. Run the repo migration command in disposable PostgreSQL 16, including from the existing schema when the change affects upgrades.
3. For reservation, cancel, expiry and pickup, keep the documented material-first lock order and re-read state and database time after locking. Write related state and audit in one transaction. Handle constraint conflicts using the documented API status. Use parameterized raw queries where required.
4. Prove concurrent operations with independent requests/connections against disposable Postgres. Assert the committed invariant, audit count and losing result. Use synthetic, idempotent fixtures. Follow [testing](../../../docs/repassa/TESTING.md) and the Agent Kit for environments and migrations.
