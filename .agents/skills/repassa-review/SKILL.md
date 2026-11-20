---
name: repassa-review
description: Review a RePassa pull request for regressions, API drift, authorization, database consistency and frontend accessibility before integration.
---
Read changed files and base diff, applicable AGENTS.md and BUSINESS_RULES/SECURITY/TESTING. Check scope, secret/asset hygiene, contract compatibility, state transitions, real concurrency coverage, tenant checks, session handling, UI loading/errors/a11y and shelf regressions. Reproduce tests where possible; distinguish static review from execution. Prioritize actionable findings by severity and cite file/line. Do not claim no vulnerabilities or green tests without evidence. Do not bypass checks or self-approve. Owner controls merge.
