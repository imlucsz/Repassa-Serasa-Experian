# RePassa | Repository working agreement

## Mission and deadline
Build a real, accessible educational-material reuse platform. Students donate items to partner institutions; staff confirm physical receipt, then another student reserves and picks up using a one-time code. No direct peer-to-peer delivery, payment or marketplace. Presentation 2026-12-12; integrated MVP target 2026-12-07. UI in pt-BR. Demo institutions/data are fictional unless explicitly confirmed by the project owner.

## Read before working
Read `docs/repassa/INDEX.md`, `PRD.md`, `BUSINESS_RULES.md`, `API.md` and `contracts/openapi.yaml` before code (under docs/repassa). Read `ROADMAP.md`, `STATUS.md`, `DECISIONS.md`, `GIT_WORKFLOW.md`, `SECURITY.md`, `TESTING.md` and scoped `AGENTS.md` before relevant changes. Frontend: `SCREENS.md`, `DESIGN_SYSTEM.md`; backend: `DATA_MODEL.md`, `ARCHITECTURE.md`. Verify the current branch/files; documentation is the proposed baseline, not evidence of implementation. Explicit owner decisions supersede proposals; update the contract/docs alongside affected code. Resolve contradictory contracts before coding. Do not pretend uncertainty is decided.

## Agent tooling
Use the [toolchain guide](docs/repassa/AGENT_TOOLCHAIN.md), [skill catalog](docs/repassa/SKILL_CATALOG.md) and [role routing](docs/repassa/AGENT_ROUTING.md). Begin with `repassa-context`. Design requires `repassa-design`. Use `repassa-motion` for animation and `repassa-browser-qa` for rendered changes. Implementation requires `repassa-implement` and `repassa-verification`. Add the domain skill for affected backend, database or auth behavior. Review requires `repassa-review` plus the applicable topic skill. New third-party skills, hooks or MCP servers must pass a SkillSpector static scan plus manual source/license review before activation (see the security gate in [AGENT_TOOLCHAIN.md](docs/repassa/AGENT_TOOLCHAIN.md)); never enable unreviewed remote hooks. Design tasks must follow the mandatory workflow in [DESIGN_TOOLS.md](docs/repassa/DESIGN_TOOLS.md) (repassa-design first, then scoped critique/art-direction/motion skills, then browser verification). The Agent Kit, approved scope, contract and security rules take precedence over generic skills.

## Efficient-session policy
1. Verify the current branch, task scope and baseline before work; use the smallest context that answers the question.
2. Consult a current local graph (`graphify-out/graph.json` or `.graphify/graph.json`, see [toolchain](docs/repassa/AGENT_TOOLCHAIN.md)) before broad exploration; verify graph claims against source.
3. Use RTK for noisy Git/search/test output where installed; use `rtk proxy` or raw output whenever exact diagnostics, exit codes or failures matter — never hide failures through compression.
4. Load only task-relevant skills; never load every pack at once.
5. Use the cheapest capable authorized model; preserve paid/free boundaries — a paid lead or provider requires explicit owner selection. See [Fusion protocol](docs/repassa/AGENT_ROUTING.md#fusion-operating-protocol).
6. Run targeted tests only; report real evidence and observable usage — never invent savings or token counts.
7. Stop when acceptance criteria are met; record actual limitations and owner actions needed.

## Who owns what
Devin: `backend/`, API/DB changes, backend CI with coordination. Codex: `src/`, frontend `public/`, root frontend configs and tests. `docs/repassa/contracts/openapi.yaml` is shared: change only in a contract-focused PR coordinated with the other agent. Shared tooling, root config affecting both, security guards and data model require cross-review. Never edit `video/` without explicit owner request; approved MP4 and references are not app dependencies. Preserve the existing 3D shelf behavior, adapt it to materials, keep it testable. No wholesale rewrite, no unnecessary framework change.

## Autonomy and Git
Authorized autonomously: inspect, plan, edit own scope, install necessary pinned/locked dependencies, run local tests, create branches, fetch/pull, commit, push feature branches and open/update PRs. Start from clean up-to-date `origin/main`; use independent session clone/worktree and branch `feat/DEV-...` or `feat/UX-...`. `git fetch origin`, inspect `git status`, use `git pull --ff-only` on clean branch when appropriate; integrate main via a non-destructive merge on feature branch (avoid rebasing shared branches). Never reset another person's changes, use `git clean -fdx`, force-push, delete shared branches, push directly to main, bypass checks, falsify tests, disable guardrails, or silently resolve conflicts in another agent's scope. Main merges only via reviewed green PRs; owner controls release/production. If privileges or environments do not permit a task, report the blocker instead of working around security. Do not expose secrets, PII or private content to external tools. Do not purchase services or mutate production resources without owner approval.

## Implementation and acceptance
Use existing React 19/Vite/TS/Motion, NestJS + Fastify/Prisma/PostgreSQL, modular monolith. No microservices. Persist real demo flows; explicit mock mode during parallel UI work only, never silent fallback. Keep code small, typed, readable; validate accessible loading/empty/error and unauthorized states. Avoid unnecessary deps, pin compatible toolchain via lockfiles. Never weaken authorization to make UI pass. All critical DB mutations atomic; do not trust client role, institution, status or code. Never use `prisma db push`/`migrate reset` against shared databases. Run `node scripts/agent-guard.mjs staged` after staging; hooks active per clone. Read actual tests and run relevant commands; record raw failures/skips and reproduce. Test migration + authorization + concurrent reservations against real disposable Postgres before claiming done. Frontend build/typecheck and key screens/keyboard/mobile review. Do not commit generated videos, references, dependencies, secret files or test reports with sensitive data.

## Session loop
1. Read task/acceptance and current code. Fetch, inspect status, pick branch/scope. If another agent touches same file/contract, coordinate first.
2. Plan concise; small vertical slices; test incrementally. Add tests for bugs; no placeholders presented as production. Keep documentation current.
3. Commit focused changes with task ID, push feature branch, open PR with evidence, risks, migration/rollback notes and next dependencies. If not able to push/PR, say so.
4. Update progress through PR description and `STATUS.md` only when appropriate; avoid both agents racing to edit status. Report actual results and notable limitations; no claim of merge/deploy unless verified.

Decision hierarchy: owner instructions and approved scope, then this agreement and scoped guidance, then versioned contracts/specs. In case of conflict with security or data integrity, stop the unsafe operation and document the alternative.
