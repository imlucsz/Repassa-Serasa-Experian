# Devin handoff after the toolchain PR merges

For the next authorized RePassa backend task, fetch current `origin/main` in your own checkout and read root `AGENTS.md`, `backend/AGENTS.md` when present, and [the Agent Kit](../INDEX.md). Keep ongoing work in its original checkout until you intentionally adopt the merged baseline under the project's Git policy.

Request a skill by name and include the file as context. For example:

> Use `repassa-backend` from `.agents/skills/repassa-backend/SKILL.md` and `repassa-verification` from `.agents/skills/repassa-verification/SKILL.md` for this assigned backend task. Load `repassa-database` for migrations or integrity, and `repassa-auth-security` for auth or scoped data. Follow the RePassa Agent Kit and OpenAPI, run applicable checks against disposable PostgreSQL, and record exact outcomes and blockers in the PR.

The [catalog](../SKILL_CATALOG.md) links each portable skill. Open the file directly if skill discovery is unavailable on the current client or checkout. No Codex plugin, custom agent, MCP server or Codex hook protocol is needed. Set up the existing Git checks on the Devin clone per [the Git workflow](../GIT_WORKFLOW.md). Coordinate shared contract changes and preserve the established autonomous branch/PR authorization.

See [Devin's repository skill documentation](https://docs.devin.ai/product-guides/skills).
