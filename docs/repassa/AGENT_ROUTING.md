# RePassa agent routing

Start with `repassa-context`. Design uses `repassa-design`, with `repassa-motion` for interaction or animation and `repassa-browser-qa` for rendered changes. Implementation uses `repassa-implement` and `repassa-verification`, plus `repassa-backend`, `repassa-database` or `repassa-auth-security` where applicable. Review uses `repassa-review` and the skill for the changed surface. [Skill catalog](SKILL_CATALOG.md)

Use one specialist when it can resolve a distinct question, own an independent slice, or provide useful separation between author and reviewer. The lead assigns exclusive write paths, shares the baseline and acceptance check, and integrates the result. Readers may inspect those same paths. Sequence shared files, including API contracts, and follow the Agent Kit for coordination with Devin. Give each agent a small context packet and let the host select a model unless the task calls for a different capability.

In a trusted RePassa checkout, ask Codex for a role by its name and give it the task, paths, baseline and expected evidence. For example, “Use `accessibility-reviewer` to inspect keyboard focus in the changed catalog dialog and report findings with file and line.” The profiles live in [`.codex/agents/`](../../.codex/agents/). Roles with **Assigned edits** can write only when given an exclusive file list. **Read-only** means the profile directs the agent to avoid mutations. Codex 0.169.0 inherits permissions from the parent session, so use a read-only parent when filesystem enforcement is required. [Codex custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

## Primary team

| Role | Responsibility | Scope | Origin |
| --- | --- | --- | --- |
| `planner` | Scope and acceptance sequence | Read-only | ECC `planner` |
| `architect` | Architecture and contract boundaries | Read-only | ECC `architect` |
| `frontend-designer` | Frontend design direction and scoped UI implementation | Assigned edits | RePassa, ECC `frontend-design-direction` |
| `ui-ux-designer` | Usability, role flows, copy and interaction states | Read-only | RePassa, `repassa-design` |
| `creative-developer` | Expressive frontend and accessible shelf interactions | Assigned edits | RePassa, `repassa-design` / `repassa-motion` |
| `animation-specialist` | Motion, interruption and reduced-motion equivalents | Assigned edits | RePassa, ECC `motion-patterns` |
| `react-specialist` | React state, hooks and render correctness | Read-only | ECC `react-reviewer` |
| `accessibility-reviewer` | Keyboard, semantics, visible focus and equivalent controls | Read-only | ECC `a11y-architect` |
| `typescript-reviewer` | Type safety and actual runtime behavior | Read-only | ECC `typescript-reviewer` |
| `browser-qa` | Local render and interaction verification | Read-only | RePassa, ECC `browser-qa` skill |
| `e2e-runner` | Existing Playwright journeys and scoped test authoring | Assigned edits | ECC `e2e-runner` |
| `performance-reviewer` | Measured runtime, bundle and query regressions | Read-only | ECC `performance-optimizer` |
| `security-reviewer` | Defensive auth, authorization and private data review | Read-only | ECC `security-reviewer` |
| `database-reviewer` | PostgreSQL constraints, Prisma migration and concurrency | Read-only | ECC `database-reviewer` |
| `code-reviewer` | Changed behavior and verification gaps | Read-only | ECC `code-reviewer` |
| `build-error-resolver` | Narrow diagnosis and fix for build/type errors | Assigned edits | ECC `build-error-resolver` |

## Additional ECC roles

| Role | Responsibility | Scope |
| --- | --- | --- |
| `code-explorer` | Trace symbols, call paths and affected tests | Read-only |
| `docs-researcher` | Check the installed version against official documentation | Read-only |
| `pr-test-analyzer` | Map risk and changed behavior to existing test evidence | Read-only |
| `silent-failure-hunter` | Find swallowed errors and silent fallbacks | Read-only |
| `type-design-analyzer` | Review domain types and enforced invariants | Read-only |
| `tdd-guide` | Guide focused test-first changes | Read-only |
| `doc-updater` | Update assigned project documentation from evidence | Assigned edits |
| `react-build-resolver` | Fix narrow React and Vite build errors | Assigned edits |
| `refactor-cleaner` | Identify safe behavior-preserving improvements | Read-only |

These profiles adapt the relevant [ECC agent catalog](https://github.com/affaan-m/ECC/tree/4adeee6732a12d1540f49a4d50a38ce8c97f9a53/agents) and native `docs-researcher` role. The remaining upstream language-, platform- and workflow-specific agents fall outside RePassa's current stack or duplicate a role above. The TOML uses the host's model and permissions. Claude agent Markdown and tool lists stay upstream. Browser QA and E2E require the local tools described in [the toolchain](AGENT_TOOLCHAIN.md). Devin can use the linked portable skills directly.
