# Token optimization toolchain (Codex on Windows)

Goal: reduce command-output tokens the RePassa agents read, without changing the Codex
model, subscription, authentication or repository guardrails. Everything here is
optional and reversible; run `tools/agent-setup/Install-RePassaTools.ps1 -DryRun` first.

Audited host (24/11/2026): Windows, Codex Desktop `26.1111.2228.0` (MSIX,
`OpenAI.Codex_2p2nqsd0c76g0`) with bundled `codex-cli 0.169.0-alpha.11.1` at
`<InstallLocation>\app\resources\codex.exe`, signed in via ChatGPT. Node `v24.14.0`,
npm `11.9.0`, Python `3.13.15`, pip `26.2.1`. Not present at audit: `codex` on PATH,
`rtk`, `uv`, `graphify`, `ccusage`, `winget`, ECC, GitHub `gh` CLI, Docker.
`~/.codex/` contained `config.toml` only — no `hooks.json`, `RTK.md` or user
`AGENTS.md`. Do not confuse this machine with a Devin/Codex cloud workspace;
`docs/repassa/AGENT_TOOLCHAIN.md` describes an earlier, different host.

## Tool matrix (verified against official sources)

| Tool | What it does for Codex | Install | State on audited host |
| --- | --- | --- | --- |
| RTK | Compresses shell output via `PreToolUse` hook. `rtk init -g --codex` is the documented global Codex integration: writes `hooks.json` + `RTK.md` under `$CODEX_HOME` (`~/.codex`). `rtk hook codex` rewrites supported `Bash` calls; exit codes preserved; `rtk bypass`/`rtk proxy` for exact output; `rtk gain` reports savings (bytes/4 estimate). | `winget install rtk-ai.rtk` when winget exists; otherwise the official `rtk-x86_64-pc-windows-msvc.zip` GitHub release (verified against `checksums.txt`). Current release at audit: `v1.2.1` (19/11/2026). Apache-2.0 + BUSL-1.1. | Not installed |
| ccusage | Reads local `~/.codex` session logs; `npx ccusage@latest codex daily` prints estimated tokens/cost. **Estimates are not subscription quota balances.** | Nothing installed; `npx` on demand (npm cache). | Verified path only; run on demand |
| Graphify (`graphifyy`) | Local tree-sitter AST knowledge graph; `graphify install --platform codex` installs the user-level Codex skill (invoke `$graphify`). Optional `[features] multi_agent = true` in `~/.codex/config.toml` enables parallel extraction. `graphify hook install` (Git post-commit) is **not** used — RePassa hooks stay in versioned `.githooks/`. | `uv tool install graphifyy` (uv via `python -m pip install --user uv`, or `winget install astral-sh.uv`). Python 3.11.5–3.14 required; 3.13.15 OK. | Not installed |
| OmniRoute | Optional isolated gateway experiment. See [MODEL_ROUTING.md](MODEL_ROUTING.md). | `npm install -g omniroute` (opt-in flag; never auto-started). | Not installed; fork stale, use upstream |
| Claude Code Router | Optional installed-but-inactive alternative gateway. v3.1.6 supports Codex CLI & app via profiles scoped "Only opened from CCR". | `npm install -g @musistudio/claude-code-router` (opt-in flag). | Not installed |

## Scripts

| Script | Purpose |
| --- | --- |
| `tools/agent-setup/Install-RePassaTools.ps1` | Idempotent bootstrapper. `-DryRun` prints every planned action; `-Yes` pre-approves. Backs up `config.toml`/`hooks.json`/`RTK.md`/existing graphify skills into `%LOCALAPPDATA%\RepassaTools\backups\<timestamp>\` and records a manifest. Verifies RTK zip SHA256 before installing. Never touches `auth.json`, model/provider keys or repo files. |
| `tools/agent-setup/Test-RePassaTools.ps1` | Read-only verification: versions, hook registration, skill presence, ccusage run, inactive-gateway check, RePassa staged guard. Exit 1 on FAIL. |
| `tools/agent-setup/Restore-RePassaTools.ps1` | Rollback via manifest: `rtk init --global --codex --uninstall`, restores backups, removes only files the installer created, optional `-RemoveBinaries`. Never touches auth/sessions/repo. |

## Baseline command-output measurements (before RTK)

Measured on the `feat/DEV-toolchain` worktree (clean `origin/main`, bytes; est. tokens = bytes/4,
the same convention RTK `gain` uses). Command-output tokens ≠ total conversation tokens.

| Operation | Raw output | Est. tokens |
| --- | --- | --- |
| `git status` (clean worktree) | 114 B | ~29 |
| `git status` (main checkout, dirty) | 346 B | ~87 |
| `git log --oneline -20` | 1,425 B | ~356 |
| `git branch -a` | 1,055 B | ~264 |
| `git diff HEAD~1 --stat` (merged figma PR) | 6,172 B | ~1,543 |
| `git diff HEAD~1` (same, full) | 132,852 B | ~33,213 |
| `src/components/Shelf3D.tsx` read | 11,017 B | ~2,754 |
| `docs/repassa/contracts/openapi.yaml` read | 38,747 B | ~9,687 |
| `npm run lint` (frontend, pass) | 0 B | 0 |
| `npm run build` (frontend, pass) | 2,390 B | ~598 |
| `npm run test:ci` (frontend, pass) | 2,165 B | ~541 |
| `npm run lint` (backend, fail: prisma client not generated) | 9,319 B | ~2,330 |
| `npm test` (backend unit, 6 suites/51 tests, pass) | 1,662 B | ~416 |

Post-install "after" numbers are recorded in the PR only when actually measured on this
host (RTK filters are deterministic for `git`, `ls`, `npm`, `tsc`, `jest` and friends).

## Environment quirks found

- **Jest discovers zero tests under `~/.codex/worktrees/…`.** The dot-directory path
  component is skipped by jest's crawler: `npm test` reported `0 matches` in the
  Codex worktree while the identical suite passed 51/51 in the main checkout. Run
  backend jest suites from a non-dot path (main checkout) or copy the worktree
  elsewhere; CI on GitHub runners is unaffected.
- Backend `npm run lint` needs `npm run db:generate` first in a fresh checkout
  (Prisma client is generated, not vendored); CI does this via `npm ci` + deploy.
- The bundled `codex.exe` inside the MSIX package runs fine for read-only commands
  (`--version`, `features list`, `login status`); `plugin list` hung and was killed.
- Windows PowerShell 5.1 decodes BOM-less `.ps1` as ANSI: non-ASCII characters in
  scripts can become smart-quote delimiters. Keep scripts ASCII-only.
- `codex` is not on PATH; the installer detects the CLI via
  `Get-AppxPackage OpenAI.Codex` → `InstallLocation\app\resources\codex.exe`.

## Devin host (27/11/2026)

This Devin Desktop session runs on the same Windows machine as the Codex host above. What applies to Devin specifically:

- **RTK 1.2.1 works** (`rtk` on PATH; exit codes verified preserved, `rtk proxy` passthrough, `rtk gain` reporting) but there is **no official Devin hook target** in this version — `rtk init`/`rtk hook` support claude, codex, windsurf and others, not devin, and `rtk hook codex` does not emit Devin's `updatedInput` format. Use RTK explicitly (`rtk git`, `rtk rg`, `rtk test`, `rtk proxy <cmd>`) per the efficient-session policy; an unreviewed adapter hook is not wired.
- **ccusage 20.1.1 reads Codex logs only** on this host — it is not a Devin meter. For Devin usage use the native session usage and the `/fusion` model breakdowns. Distinguish observed usage, estimated compression (`bytes/4`), cached input, per-model usage, remaining quota and real cost; never present estimates as quota or invent percentages.
- **SkillSpector 2.13.7** (uv tool) gates new skills: `skillspector scan <path> --no-llm`, stdout redirected to a file (file `--output` unsupported on Windows).
- **Graphify** runs AST-only on demand; see [the toolchain](AGENT_TOOLCHAIN.md#devin-desktopcli-on-windows) for the current graph location and refresh policy.

## Usage rules (kept from repassa-context-efficiency)

- Prefer targeted reads/searches over wide dumps; RTK compresses output, not input.
- Use `rtk proxy <cmd>` when filtering could hide diagnostics (exact test failure
  text, exit codes, PR evidence). `rtk bypass <cmd>` for raw output.
- ccusage/`rtk gain` numbers are byte estimates; never present them as quota proof.
- Do not install community RTK pipelines or unreviewed skills.
