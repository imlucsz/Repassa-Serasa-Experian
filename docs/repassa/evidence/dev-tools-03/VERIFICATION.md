# DEV-TOOLS-03 verification — agent efficiency & design toolchain

Host audited 27/11/2026: **Devin Desktop on Windows**, checkout `Repassa-Serasa-Experian`,
branch `chore/DEV-TOOLS-03-agent-efficiency` from `origin/main` `fc9eee0`.
Node v24.14.0, npm 11.9.0, Python 3.13.15, Git 2.53.0.

## 1. Tool inventory (existing vs new)

| Tool | Status | Version / provenance |
| --- | --- | --- |
| RTK | INSTALLED_AND_WORKING (pre-existing) | rtk 1.2.1, `%LOCALAPPDATA%\Programs\rtk\rtk.exe`; Codex integration (`~/.codex/hooks.json` + `RTK.md`) already present |
| ccusage | INSTALLED_AND_WORKING (pre-existing) | npm global 20.1.1; reads this host's Codex logs only |
| OmniRoute | INSTALLED_BUT_UNVERIFIED (pre-existing) | npm global 3.8.54; `~/.omniroute` DB exists; gateway not running at audit (127.0.0.1:20128 unreachable) |
| RePassa orchestrator | INSTALLED_AND_WORKING (pre-existing) | `%LOCALAPPDATA%\RepassaOrchestrator\tool\dist`; registered for Codex in `~/.codex/config.toml`; now also `.devin/mcp_config.local.json` for Devin (stdio, `OMNIROUTE_API_KEY` env passthrough). Repo tests **32/32 pass** incl. real stdio MCP handshake + delegate_task (mock gateway) |
| Graphify CLI | NEWLY INSTALLED | `graphifyy` 0.9.121 via `uv tool install` (pinned PyPI); `~/.local/bin/graphify.exe` |
| uv | NEWLY INSTALLED | 0.13.10 via `pip install --user uv` (needed for isolated uv tools) |
| SkillSpector | NEWLY INSTALLED | `skillspector` 2.13.7 via `uv tool install` (pinned PyPI release; Python 3.13, `>=3.12,<3.16` declared) |
| Design skills | INSTALLED_AND_WORKING | `npm run design:setup` restored 24 skills into `.agents/skills/` (gitignored, discovered live); impeccable engine 0.1.31 checksum-verified into `~/.impeccable/bin/` |
| `gh` CLI, Docker, winget | MISSING | Not on PATH |
| Claude Code Router | REQUIRES_OWNER_APPROVAL | Documented option for independent Claude Code sessions; not installed (no demonstrated need inside Devin runtime) |
| Devin CLI binary | INCOMPATIBLE/PATH | `devin` not on this session's PATH; bundled docs read from install dir |

## 2. SkillSpector results (`--no-llm`, static only)

Reports in this folder (`*-scan.json`, sanitized for publication: absolute host paths replaced
with `<repo>`/`<host>`/`<tmp>` and long third-party `code_snippet` excerpts truncated to 200
chars; findings, severities, rule names, file:line locations and coverage ledgers are intact —
see `analysis_completeness` per skill). The scanner is an additional check, not proof.

| Target | Score | Coverage | Disposition after manual review |
| --- | --- | --- | --- |
| `cantos-apple` (staged, commit `4c15b53`, MIT) | 0 SAFE | 100% | Text-only SKILL.md; includes anti-injection guidance; installed |
| `write-swift` (omitted by the 32-skill aggregate budget; scanned separately) | 0 SAFE | 100% | clean |
| user-level `graphify` | 48 MEDIUM | 100% | findings: `rm -f .graphify/…` cleanup commands scoped to its own artifacts; agency phrasing. Benign |
| user-level `impeccable` | 100 CRITICAL | **91.3% partial** | reviewed: `~/.claude/settings.json` hits are in `reference/hooks.md` documentation (RePassa installs with `--no-hooks`); "never judge"/agency strings are reviewer-profile prose; `fetch('http://localhost:…')` is its own live-edit server; `Remove` is a keyboard-handler comment. No exfiltration |
| 33 project skills (recursive scan) | mixed | per skill below | All repassa-* scored 0 with full coverage. Flagged items reviewed below |

**Full-coverage scans (all files inspected, findings reviewed):** cantos-apple, write-swift,
graphify, animate, animate-expo, animation-performance, apple-design, ask-sonner, gestures,
improve-animations, learn-taste, pick-ui-library, remove-animations, repassa-* (all) —
every `analysis_completeness` at 100%.

**Partial static scans (findings reviewed; uninspected residue listed honestly):**
break-ui 66.7% (1 partial file), choreograph 33.3% (2), design-taste-frontend 93.2% (101,
mostly bundled reference CSV/HTML templates and assets), mobile-native 50% (1),
review-animations 66.7% (1), ui-ux-pro-max 79.7% (14, reference data + test scripts),
impeccable 91.3%. Partial coverage means the scanner's component budget ended before every
file was inspected — the reviewed dispositions below cover the findings that were reported;
the uninspected residue is mostly data/templates, but it is not claimed as fully reviewed.
Re-scan a partial skill individually (`skillspector scan <dir> --no-llm`) before relying on
its uninspected files.

Resolved CRITICAL reviews (all false positives or benign-in-context):

- `design-taste-frontend` (100): "Prompt injection" hits are HTML comment scaffolding in `assets/starter.html`/templates; "analysis-evasion" notes = scanner read referenced files only partially. Executable scripts launch headless Chrome on 127.0.0.1 and fetch from Google Fonts, Wikimedia Commons, picsum, icon CDNs (jsdelivr/simpleicons/lucide/github) — consistent with its documented purpose; env reads limited to `TASTE_SKILL_*`, `CC_*`, `CHROME*` paths. No credential access.
- `ui-ux-pro-max` (100): matches are strings inside CSV reference data (`.env.local`, "Override system", `npx astro`/`npx shadcn` mentions) and its Python **test** scripts (`dict(os.environ)` is a test asserting live font refresh fails closed without `GOOGLE_FONTS_API_KEY`; `subprocess`/`exec_module` are the test harness). Not execution paths in normal skill use.
- `choreograph` (85), `improve-animations` (66): the matched "ignore previous instructions" strings are the skills' own anti-injection rules; remaining hits are "(partial)" completeness notes.
- `review-animations` (43), `prototype` (21), misc LOW: same heuristic classes; reviewed.

## 3. Runtime skill-discovery evidence

Devin session skill list refreshed in-session: after install, `animate`, `choreograph`,
`design-taste-frontend`, `emil-design-eng`, `gestures`, `ui-ux-pro-max`, `apple-design`,
`cantos-apple` etc. appear as invocable skills — `.agents/skills/` discovery verified live,
no restart needed. User-level `~/.agents/skills/graphify` + `impeccable` also discovered.

## 4. RTK verification

- Identity: `rtk 1.2.1` (rtk.exe on PATH).
- Representative command: `rtk git status --short` — condensed output, correct.
- Exit-code preservation: `rtk git rev-parse --verify nonexistent-ref-xyz` → exit **128** with `fatal: Needed a single revision` (identical to raw git).
- `rtk proxy git status --short` → passthrough, exit 0.
- `rtk gain` works (8 commands recorded at audit; savings minimal so far — real numbers only).
- Limitation: no official Devin hook in 1.2.1 → explicit usage only; no custom adapter wired.

## 5. Graphify representative query

`graphify query "reservation pickup code" --budget 400 --graph graphify-out/graph.json`
resolved real current files: `backend/src/reservations/pickup-code.service.ts`
(`PickupCodeService`, `.codeForReservation()`, `.digestForSubmission()`),
`src/pages/PickupDesk.tsx`, `src/data/operations.ts` (`confirmPickup`, `pickupCodeFormat`).
Graph rebuilt at HEAD `fc9eee0`: 2,460 nodes / 5,141 edges / 161 communities, AST-only
(`graphify update .`), artifacts local in `graphify-out/` (now gitignored). The stale
`.graphify/` graph (765 nodes, built by a newer 0.10.x run at `1f36307`) remains for
reference; `graphify-out/graph.json` is the current one. Skill/CLI version skew noted:
installed user-level skill advertises 0.10.1 vs CLI 0.9.121 — queries still work; do not
run `graphify install` (would downgrade the skill).

## 6. Usage monitoring

- ccusage (observed): reads Codex logs — daily table shows gpt-6.2-astra/sol entries,
  ~78.7M total tokens, ~$54.74 estimated cost. It cannot see Devin sessions.
- Devin: native session usage + `/fusion` model breakdown are the authoritative meters;
  `/context` shows window state inside a session. Baseline/final numbers belong in PR
  descriptions when measurable — never estimated.

## 7. MCP and free-only routing

- Orchestrator: registered for Devin in `.devin/mcp_config.local.json` (local, gitignored);
  stdio to the existing `%LOCALAPPDATA%` install — no duplicate gateway.
- Verified via repo tests (32/32): `tools/list` handshake, `delegate_task` (mock gateway),
  free-only profile rejects paid, `billing:"unknown"` never callable, auto-routing never
  picks paid, localhost-only enforced, egress secret scan blocks before network calls,
  `maxDelegationDepth: 1`, `maxRetries: 0`, deniedPathGlobs cover `.env`/keys/`video/`.
- OmniRoute itself: installed, configured (`REQUIRE_API_KEY` set in `~/.omniroute/.env`),
  **not running** — owner starts `omniroute serve` when needed. Declared providers in
  `orchestrator.config.json`: `gemini-free` (gemini-3.1-flash-lite), `groq-free`
  (gpt-oss-120b, gpt-oss-20b, qwen3.8-27b), profile `free-only`, `dailyCostUsd: 0`.
- Devin session MCPs in use: canva, figma-remote, firecrawl (+native browser preview).
  No redundant browser/repo/compression servers added.

## 8. Compatibility matrix

| Item | Devin Desktop (this host) | Devin CLI | Devin Cloud | Codex (this host) |
| --- | --- | --- | --- | --- |
| `.agents/skills/` | verified live discovery | documented (same dirs) | project skills documented | verified (documented) |
| `~/.agents/skills/` | verified (graphify, impeccable) | documented | n/a | verified |
| Project hooks `.devin/hooks.v1.json` | documented format; not wired | documented | n/a | n/a (Codex format differs) |
| RTK | verified; explicit usage only | same binary | unknown | verified; `rtk hook codex` wired |
| graphify CLI 0.9.121 | verified query/extract | same binary | not installed | documented earlier (0.9.99) |
| skillspector 2.13.7 | verified scans | same binary | not installed | same host family |
| ccusage | verified (Codex logs only) | n/a | n/a | verified |
| orchestrator MCP | config written; handshake proven via tests | config documented | not registered | registered + working |

Where "documented" is used, the bundled Devin CLI docs (share/devin/docs) are the source;
runtime-verified items say so explicitly.

## 9. Rollback / uninstall

- Design skills: delete the installed dirs under `.agents/skills/` (all gitignored);
  `npm run design:setup` restores pinned versions. User-level impeccable:
  `npm exec -- impeccable uninstall --user` or remove `~/.agents/skills/impeccable`;
  engine cache `~/.impeccable/` can be deleted.
- graphify/skillspector: `python -m uv tool uninstall graphifyy skillspector`; remove
  `graphify-out/` and `.graphify/` artifacts (both gitignored, disposable).
- Devin orchestrator registration: delete `.devin/mcp_config.local.json`.
- Codex RTK integration (pre-existing, untouched): `rtk init --global --codex --uninstall`.
- No host config files were modified outside `.devin/mcp_config.local.json` (new file).

## 10. Limitations and owner actions

- OmniRoute gateway not running; owner decides when to `omniroute serve`. No provider
  keys were added or tested in this task; delegation stays fail-closed without them.
- `devin` CLI not on PATH in this session; CLI-level verification done via bundled docs.
- Graphify user-level skill (0.10.1) is newer than installed CLI (0.9.121); refresh the
  CLI (`uv tool upgrade graphifyy` to a matching release) only after reviewing it.
- ccusage cannot measure Devin; use native usage.
- The Devin hook mechanism could rewrite `exec` to `rtk` via `updatedInput`, but no
  official RTK Devin hook exists — left unimplemented pending owner review.
- PR creation: `gh` CLI not installed; push the branch and open the PR via the GitHub UI
  or add `gh` later. Branch: `chore/DEV-TOOLS-03-agent-efficiency`.

## 11. Task-start checklist (reusable)

1. `git fetch origin`; confirm branch, baseline revision, task scope.
2. Read `repassa-context`; consult `graphify-out/graph.json` before broad exploration
   (verify edges against source; refresh only when stale).
3. Load only the skills the task needs (`SKILL_CATALOG.md`, `AGENT_ROUTING.md`).
4. Use `rtk`/`rtk proxy` for noisy commands; raw output for exact diagnostics.
5. Use the cheapest capable authorized model; check the picker for free/paid status.
6. Targeted tests only; run `node scripts/agent-guard.mjs staged` + `git diff --check`.
7. Report real evidence (commands, counts, versions) and honest limitations.
8. Stop at acceptance criteria; update PR description, not wishful status.
