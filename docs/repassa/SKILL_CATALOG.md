# RePassa skill catalog

Use `$skill-name` in Codex or explicitly ask either agent to read `.agents/skills/<name>/SKILL.md`. Load the foundation skills and only the relevant additions. The project skill names are scoped to avoid collisions with installed ECC and user skills.

## Repository skills

| Skill | Use | Provenance |
| --- | --- | --- |
| [repassa-context](../../.agents/skills/repassa-context/SKILL.md) | Restore project context and hand off | Existing Agent Kit |
| [repassa-implement](../../.agents/skills/repassa-implement/SKILL.md) | Implement a scoped vertical slice | Existing Agent Kit |
| [repassa-review](../../.agents/skills/repassa-review/SKILL.md) | Review a RePassa diff | Existing Agent Kit |
| [repassa-context-efficiency](../../.agents/skills/repassa-context-efficiency/SKILL.md) | Limit searches, test noise and context | `token-efficient-workflow`, Creativebrook MIT, plus selective reading and evidence guidance from the source project |
| [repassa-design](../../.agents/skills/repassa-design/SKILL.md) | Scope screen states, visual direction and tokens | Adapted from `design`, `design-system`, `ui-ux-pro-max` and `ui-styling`, with reusable web-hero brief principles from `banner-design` |
| [repassa-motion](../../.agents/skills/repassa-motion/SKILL.md) | Specify motion and reduced-motion alternatives | Adapted from LottieFiles `motion-design` and RePassa's existing UI |
| [repassa-browser-qa](../../.agents/skills/repassa-browser-qa/SKILL.md) | Review a local render or existing Playwright journey | RePassa workflow using the source's visual inspection approach and ECC `browser-qa` / `e2e-testing` |
| [repassa-backend](../../.agents/skills/repassa-backend/SKILL.md) | NestJS/Fastify and contract-first implementation | ECC `nestjs-patterns`, `api-design`, `contract-first` |
| [repassa-database](../../.agents/skills/repassa-database/SKILL.md) | Prisma, PostgreSQL and atomic state | ECC `postgres-patterns`, `prisma-patterns`, `database-migrations` |
| [repassa-auth-security](../../.agents/skills/repassa-auth-security/SKILL.md) | Auth, authorization, isolation and private data | Defensive review guidance from ECC `nestjs-patterns` and `security-review` |
| [repassa-verification](../../.agents/skills/repassa-verification/SKILL.md) | TDD, verification and evidence for review | ECC `tdd-workflow`, `verification-loop` and the RePassa review workflow |

The new files are condensed adaptations in RePassa language. Their instructions are usable by both Codex and Devin. Relevant tools depend on the task: Git/Node for Git guard checks, an available local browser or pinned Playwright runner for browser QA, and disposable PostgreSQL for persistence tests. Attribution and license notices are in [third-party notices](../../.agents/THIRD_PARTY_NOTICES.md).

## Source inventory and migration decisions

Inspected the barbershop working copy (HEAD `2ab9cbe8`), including local skill manifests outside tracked Git files.

| Location in source | Exact skill | Compatibility and destination |
| --- | --- | --- |
| `.agents/skills/` | `barbearia-safe-change` | Project-specific stack, branch and orchestration policy. Reuse safe-change principles through original RePassa agreements and `repassa-context-efficiency` / `repassa-verification`. |
| `.agents/skills/` | `token-efficient-workflow` | MIT via Creativebrook, CLI-neutral by adaptation. Use `repassa-context-efficiency`. |
| `.agents/skills/` | `design` | Licensed design routing. The broad bundle also has creative scripts, external media providers and Python dependencies. UI workflow adapted into `repassa-design`. |
| `.agents/skills/` | `design-system` | Licensed token/component guidance plus slide tooling. Token and component principles adapted into `repassa-design`. |
| `.agents/skills/` | `ui-styling` | shadcn/Radix/Tailwind assumptions and conflicting MIT frontmatter/Apache 2.0 license file. Reuse general styling and accessibility principles within the existing stack in `repassa-design`. |
| `.agents/skills/` | `ui-ux-pro-max` | MIT upstream. The searchable Python datasets are optional for general UI decisions. Adapted to `repassa-design` as guidance without scripts or data. |
| `.agents/skills/` | `motion-design` | LottieFiles MIT. Reusable motion principles adapted to the existing animation stack through `repassa-motion`. |
| `.agents/skills/` | `banner-design` | Licensed bundle with browser/export/creative tool assumptions. Adapted the web-hero brief into `repassa-design`. |
| `.agents/skills/` | `brand` | Brand sync/scripts and assets for the source stack, with no separately established license for the local copy. RePassa's `DESIGN_SYSTEM.md` supplies brand context. |
| `.agents/skills/` | `slides` | Chart.js presentation workflows with no separately established license for the local copy. Presentation tooling falls outside this integration. |
| `.agents/skills/` | `img2threejs` | Apache-2.0 with a separate forge/tooling checkout and Three.js. Image-to-model reconstruction is unrelated to preserving the current shelf interaction. |
| `.github/copilot/skills/` | `premium-frontend-ui` | Copilot-specific skill with no verified source license. `repassa-design` and installed ECC cover equivalent frontend workflows. |
| `.github/copilot/skills/` | `web-design-reviewer` | Browser/URL workflow with no verified source license. Original `repassa-browser-qa` covers the equivalent task via ECC and the Agent Kit. |
| `.codex/skills/` | `graphify` | Local installed skill includes semantic extraction. Its linked references directory was inaccessible. Use the installed CLI in local AST mode as documented in [the toolchain](AGENT_TOOLCHAIN.md). |

Other source resources inspected include `AGENTS.md`, `PROJECT_EXCLUSIONS.md`, `.codex/hooks.json`, `.github/workflows/ci.yml` and `tools/codex-helpers/`. Creativebrook's PowerShell helpers (`find_usages.ps1`, `list_changed_files.ps1`, `search_symbol.ps1`, `summarize_file.ps1`) require Git/ripgrep and duplicate the portable targeted searches. The source graph is project data. The host RTK instructions are external to both repositories. No standalone `.claude/`, `.cursor/`, `skills/`, `agents/`, `hooks/` or `RTK.md` was present in the source root.

## Installed options used on demand

| Area | Host resources | Compatibility |
| --- | --- | --- |
| Frontend and design | ECC `frontend-design-direction`, `design-system`, `react-patterns`, `frontend-a11y` and local `framer`, `framer-code-components` | Prefer the RePassa design baseline. Framer requires an explicit Framer task and its connector. |
| Animation | ECC `motion-foundations`, `motion-patterns` and user GSAP skills `gsap-core`, `gsap-frameworks`, `gsap-performance`, `gsap-plugins`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-utils` | RePassa uses Motion. GSAP is host guidance for an explicitly scoped task with that dependency. |
| Browser and regression | ECC `browser-qa`, `e2e-testing`, Playwright and bundled browser tools | Local URL, synthetic fixtures and applicable tools. Project test runner dependencies must be verified. |
| Review and security | ECC `typescript-patterns`, `security-review`, `verification-loop`, user `review-agent` and Superpowers review and verification | On demand. Use defensive scope and actual RePassa contracts and checks. |
| Context and orchestration | RTK, Graphify, Headroom, Superpowers and ECC `context-budget` / `agent-harness-construction` | Optional host resources. Use the repository role catalog for specialized delegation with explicit path ownership. |
| Other user skills | `find-skills`, `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `remotion-to-hyperframes`, `reverse-any-video`, `style-sampling` | Discovery/media workflows are independent of this application and tooling PR. |
