# RePassa agent toolchain

The [Agent Kit](INDEX.md), root agreement and scoped agreements still govern the repository. Start from current `origin/main` in an independent checkout. See [skills](SKILL_CATALOG.md) for the inventory and [routing](AGENT_ROUTING.md) for role selection.

## Codex on Windows

| Resource | Status and use |
| --- | --- |
| Codex CLI | 0.169.0 verified. Start a new chat or CLI session in the updated, trusted checkout to load the project config and roles. Use `codex --version` and `codex plugin list --json` to inspect the host. |
| ECC | Native `ecc@ecc` 2.2.3 was already installed and enabled. The cache checker resolved its manifest references. The reviewed manifest, hook and MCP definitions matched [upstream revision 4adeee67](https://github.com/affaan-m/ECC/tree/4adeee6732a12d1540f49a4d50a38ce8c97f9a53). Use the namespaced skills from the skill picker when they add detail. |
| ECC MCP | The manifest ships `chrome-devtools-mcp@1.10.1` through `npx -y`. The [trusted project config](../../.codex/config.toml) disables this plugin server for RePassa. Other host tools follow their existing settings. No MCP or telemetry is added by the repo. |
| Superpowers | 7.0.1 was already installed and enabled. Use its targeted planning, systematic debugging or verification skills for a specific need, within the Agent Kit and Git policy. |
| Browser and Playwright | Bundled browser/computer-use plugins and a configured Playwright tool were available on the audited host. Run local browser checks using `repassa-browser-qa`. The inspected application baseline had no root Playwright package. Automated E2E requires its project test config and matching browser binaries when introduced. |
| RTK | 0.44.2 ran successfully, including `rtk gain`. Where the host requires RTK, use `rtk` for terminal commands and `rtk proxy` when exact output matters. Git and ripgrep cover the portable workflow. |
| Headroom | Already available as a host MCP. Focused searches and selective context loading work in either runner with no compressor dependency. |

ECC install and update instructions are in the [official Codex plugin guide](https://github.com/affaan-m/ECC/blob/4adeee6732a12d1540f49a4d50a38ce8c97f9a53/.codex-plugin/README.md). Prefer the native marketplace installation on hosts that lack ECC. Inspect the cached manifest, scripts and integrations before trusting a hook. Avoid legacy sync alongside the native plugin.

## Hook inventory

| Source | Definition and status |
| --- | --- |
| RePassa Git | Versioned `.githooks/pre-commit` runs the staged guard. `.githooks/pre-push` runs the range/ref guard. For persistent activation in a clone, use the existing script in [GIT_WORKFLOW.md](GIT_WORKFLOW.md). A linked worktree normally shares that clone's local Git config. With an unset hooks path, the tooling publication can use `git -c core.hooksPath=.githooks` on its commit and push without changing the shared setting. |
| GitHub Actions | `.github/workflows/agent-quality.yml` defines guard, frontend and conditional backend jobs for incoming PRs. |
| ECC Codex plugin | `SessionStart`, matcher `.*`, group ID `session:start`, command index `0`. See the [exact installed definition](https://github.com/affaan-m/ECC/blob/4adeee6732a12d1540f49a4d50a38ce8c97f9a53/hooks/codex-hooks.json#L4-L15) (Git blob `1b7cbbdb9dca60f308f0dbc82f8fbe957dd628c5`). Codex reported it as enabled but **untrusted**. It invokes `node -e` with `PLUGIN_ROOT`, then ECC's `plugin-hook-bootstrap.js` and `session-start-bootstrap.js`. The latter runs the local session-start logic, which can load previous ECC context and write local session metadata. It is optional and stays skipped until the owner reviews that exact definition through `/hooks`. |
| Barbershop Codex | `PreToolUse` / `Bash` / `graphify hook-check` has no advertised command in local Graphify 0.9.99. `PostToolUse` / `^apply_patch$` / `rtk proxy git diff --check` duplicates the RePassa staged whitespace check and has a host prerequisite. Both remain in the source project. |
| Graphify Git automation | The CLI offers Git hook installation. Manual, bounded graph generation is used here so the existing Git protections retain control of commit/push and graphs refresh only on demand. |

The cached ECC Node files and hook chain were inspected statically. Listing trust state executes no hook. Versioned Git hooks and Codex hook trust are independent. [Codex hook documentation](https://learn.chatgpt.com/docs/hooks)

## Local Graphify

Graphify package `graphifyy` 0.9.99 was available via `uv tool list`. An AST-only extraction from RePassa's current main baseline extracted 20 source/script files and produced 91 nodes and 193 edges. A shelf query resolved `src/components/Shelf3D.tsx` and related symbols. The snapshot included tracked `src/` and `scripts/` from RePassa. Generated outputs are worktree-local under the Git metadata directory. Recreate them from the relevant revision after code changes. The graph supplements source review and can omit symbols, dynamic calls, or unsupported files.

To regenerate on Windows, run in the project checkout with Git, a supported Python Graphify install and RTK:

```powershell
$gitDir = rtk proxy git rev-parse --absolute-git-dir
$temp = Join-Path ([IO.Path]::GetTempPath()) ('repassa-ast-' + [Guid]::NewGuid().ToString('N'))
$snapshot = New-Item -ItemType Directory -Path (Join-Path $temp 'source')
rtk proxy git archive -o "$temp/source.zip" HEAD src scripts
if ($LASTEXITCODE -ne 0) { throw 'Git archive failed.' }
rtk proxy tar -xf "$temp/source.zip" -C $snapshot.FullName
if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed.' }
rtk proxy graphify extract $snapshot.FullName --code-only --out $gitDir --max-workers 2
if ($LASTEXITCODE -ne 0) { throw 'Graphify extraction failed.' }
rtk proxy graphify query Shelf3D --budget 500 --graph "$gitDir/graphify-out/graph.json"
```

Archive only the needed tracked code directories. Use the platform's equivalents for the terminal and temporary paths. Keep the graph and temporary source snapshot local. `--code-only` selects the local AST path. Semantic extraction, LLM labels, shared indexes and graph hooks are outside this setup.

## Validation and adoption

Use `node --test scripts/agent-guard.test.mjs`, `node scripts/agent-guard.mjs staged` and `git diff --cached --check` before publishing. The reviewed CLI can list repository skills and hook status through app-server `skills/list` and `hooks/list`. Static TOML validation and the runtime project config check cover different layers. See the PR for the actual results.

Use the [Devin handoff](agent-prompts/DEVIN-ECC-HANDOFF.md) on the next authorized backend task after merge. The portable skills have no plugin, MCP, hook or helper-script dependency.
