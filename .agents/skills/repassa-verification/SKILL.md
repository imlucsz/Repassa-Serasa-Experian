---
name: repassa-verification
description: Plan focused regression tests, verify actual RePassa checks and prepare evidence for review on implementation or tooling changes.
---

# Verify the change and the evidence

1. Select checks from [testing](../../../docs/repassa/TESTING.md) and the actual package scripts/CI. For changed behavior, add a test that fails for the expected reason when feasible, implement the smallest change, run it again, then run adjacent checks.
2. For API or database changes, cover errors and authorization and use disposable PostgreSQL for data integrity and concurrency. For UI changes, run the relevant build, type check and tests, then use `repassa-browser-qa` for the affected flows.
3. Use `repassa-review` on the scoped diff. After staging the intended files run `node scripts/agent-guard.mjs staged` and `git diff --cached --check`. Keep pre-commit, pre-push and CI checks in place as described in [Git workflow](../../../docs/repassa/GIT_WORKFLOW.md).
4. Report exact commands and results with the revision, environment/fixture, and reasons for skipped checks. Review by severity with path, user impact, evidence and verification gaps. Keep generated reports and synthetic secrets out of Git.
