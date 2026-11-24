# RePassa Agent Orchestrator (local MCP delegation server)

Codex Desktop (Astra High) stays the main model and decision-maker. This MCP
server gives Astra **bounded, auditable delegation** to external models that the
owner explicitly approves, through a localhost gateway such as OmniRoute.

```
Codex Desktop / Astra High
  -> repassa-orchestrator (stdio MCP, this repo)
    -> OmniRoute @ http://127.0.0.1:20128 (your authorized provider keys)
      -> external models
    <- concise structured result (model identity + token usage)
  <- Astra reviews and decides
```

Delegation does NOT change Codex's model, auth, or subscription. Provider keys
live in OmniRoute; this server only reads `OMNIROUTE_API_KEY` from your env.

## Tools

| tool | purpose |
|---|---|
| `list_models` | policy-approved providers/models, billing class, capabilities, budget state |
| `delegate_task` | one bounded task (role + instructions + optional repo file context) |
| `delegate_parallel` | up to 6 independent tasks, bounded concurrency |
| `review_proposal` | second-model review of a proposal/diff |
| `get_task_result` | stored record: status, real model used, usage, error |
| `orchestrator_health` | gateway reachability, key presence, budget, mode |
| `delegate_worktree_task` | Phase 6 worker: isolated git worktree, allowlisted files, returns applied patch for review (disabled by default) |

## Safety model (defaults are strict)

- `safety.mode: "read-only"` - delegation only; workers need `"supervised"` + `workers.enabled`
- `safety.localhostOnly: true` - refuses non-local gateway URLs at startup
- **Egress scan**: outbound prompt+context is scanned for key/token patterns;
  `egress.onSecret: "block"` aborts the task before any network call
- **Policy-only routing**: only models declared in your
  `orchestrator.config.json` `providers[]` can run; default profile
  `free-only` rejects `billing: "paid"`/`"unknown"`
- **Budgets**: `dailyTokens`, `dailyCostUsd` (default `0` paid spend),
  `perTaskMaxOutputTokens`; a local ledger tracks daily usage
- **Loop prevention**: `maxDelegationDepth: 1` and workers refuse to re-delegate
- **No retries** by default (`maxRetries: 0`); no model output is executed
- File context: repo-root confined, `.env`/secrets/key files denied by built-in
  rules + `deniedPathGlobs`; per-file and total byte caps
- Workers never commit/push; patches are artifacts for human/Astra review

## Install (on the Windows machine)

```powershell
cd <repo>\tools\agent-orchestrator
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Install-Orchestrator.ps1 -DryRun   # preview
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Install-Orchestrator.ps1           # install
```

The installer: builds `dist/`, copies the example config to
`%LOCALAPPDATA%\RepassaOrchestrator\orchestrator.config.json` (never overwrites
without `-ForceConfig`), backs up `~/.codex/config.toml`, and appends:

```toml
[mcp_servers.repassa-orchestrator]
command = "C:\\<nodejs>\\node.exe"
args = ["<repo>\\tools\\agent-orchestrator\\dist\\index.js"]
startup_timeout_sec = 30
tool_timeout_sec = 300
env_vars = ["OMNIROUTE_API_KEY"]
```

Then:

1. `setx OMNIROUTE_API_KEY "<your omniroute key>"` (if using OmniRoute)
2. Edit `orchestrator.config.json`: declare your authorized `providers[]` +
   models and budgets. See `config/omniroute.example.md`.
3. Fully restart Codex Desktop.
4. Verify: `scripts\Test-Orchestrator.ps1` (add `-Deep` for the unit suite)

### Offline demo without a gateway

Set `"gateway": { "type": "mock" }` in your config to exercise the whole MCP
flow (tool listing, delegation, budget ledger, egress blocks) without any
external call. `test/fixtures/` does exactly this in CI.

## Verification protocol (from Codex Desktop)

1. `orchestrator_health` -> gateway reachable, mode `read-only`, key present.
2. `list_models` -> only your declared providers appear, with billing class.
3. `delegate_task` role `researcher` -> returns `done`, real `provider`/`model`,
   token `usage`.
4. `delegate_task` role `frontend-implementer` with `context` files -> proposal.
5. `review_proposal` on that output -> severity-ordered findings.
6. Failure safety: stop OmniRoute -> `delegate_task` returns structured
   `error` (no crash); `billing: "paid"` under `free-only` -> `blocked`.
7. Codex Desktop still runs your normal model normally afterward.

Measure Astra context usage for the delegation turn vs. doing the task inline;
the orchestrator reports per-task `usage` so totals are honest (not estimated
from compressed shell output).

## Roles

Defined in `roles.json`: `researcher`, `frontend-implementer` (writable),
`ux-reviewer`, `backend-reviewer`, `qa-reviewer`. Each pins a system prompt,
required capabilities, output cap and whether it may run worker tasks.

## Tests

```
npm ci && npm run build && npm test
```

19 tests: egress scanning, localhost enforcement, path/deny rules, routing
policy, budget/depth limits, mock end-to-end delegation, and a real stdio
JSON-RPC handshake exercising `tools/list` + `delegate_task`.

## Rollback

`scripts\Uninstall-Orchestrator.ps1` removes the `[mcp_servers.repassa-orchestrator]`
section (config.toml backed up first) and optionally `-RemoveState` deletes
`%LOCALAPPDATA%\RepassaOrchestrator` (task records, ledger, worker worktrees).

## What leaves the machine

Only: the role's system prompt, your `instructions`, and `context` items
(text snippets or allowlisted repo file contents) - after the secret scan.
Everything is logged in the task record (`stateDir/tasks/*.json`) so you can
audit exactly what was sent, to which model, and what came back.
Provider API keys are used only as a bearer header to the localhost gateway.
