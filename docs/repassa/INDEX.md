# RePassa — project knowledge base
Snapshot: main tree `f57b6907fb1992def0049b8cd9cfe76da0466cf7` (inspected 19/11/2026); [repository](https://github.com/imlucsz/Repassa-Serasa-Experian). Current site is a single Vite/React/TS Vasari-style film shelf, with motion math and an animated detail modal. No application backend, routing or auth found in inspected main. Root config/typecheck may include nested video/backend by default; fix scoped frontend include in UX foundation task after reproducing. `video/repassa-promo` is an already-developed separate promotional project; reference MP4s are tracked on main. Do not copy, re-publish or remove them automatically; owner should review license and repository hygiene separately. Root README still describes AI Studio and `.env.example` exists; update README in foundation PR after confirming actual setup. Do not expose Gemini keys or introduce AI dependency unless required.

| File | Purpose |
|---|---|
| PRD.md | product, audience, scoped deliverables |
| REQUIREMENTS.md | functional and nonfunctional requirements |
| BUSINESS_RULES.md | state machine, invariants and deadlines |
| SCREENS.md | routes, role and UI acceptance |
| USER_FLOWS.md | end-to-end scenarios and exceptions |
| DESIGN_SYSTEM.md | brand, layout, motion, accessibility |
| ARCHITECTURE.md | stack, integration, folder ownership |
| DATA_MODEL.md | entities, DB constraints and transactions |
| API.md / contracts/openapi.yaml | shared contract baseline v0.1 |
| SECURITY.md | auth, privacy, abuse, data handling |
| TESTING.md | executable and manual quality gates |
| GIT_WORKFLOW.md | branches, hooks, PRs, rulesets |
| ROADMAP.md / STATUS.md | tasks and evidence/progress |
| DECISIONS.md | confirmed vs proposed and unknown |
| DEMO.md | demo accounts, seed and rehearsal |
| agent-prompts/ | first prompts for both agents |

References (access not tested here, not needed to start): Figma prototype https://www.figma.com/design/4zTZ5C7YSC3yzqTdmuQkLG/Prot%C3%B3tipo-Projeto-Integrador---RePassa?node-id=0-1 ; Orrin inspiration https://motionsites.ai/?prompt=design-collage ; Vasari inspiration https://motionsites.ai/?prompt=vasari-vhs-hero . Use design principles and original assets, not third-party logo/art. Product flows and deadlines from owner conversation. Technical decisions marked as proposed are working defaults until owner approves changes. No real institution partnerships are assumed.
