# Model routing gateways (optional, inactive by default)

Scope: evaluating OmniRoute and Claude Code Router (CCR) as local gateways between
Codex and non-OpenAI providers. **Neither is activated by the installer.** Routing
the primary Codex model elsewhere is a separate owner decision; delegating bounded
tasks to external models (the `tools/agent-orchestrator` experiment) is different
from changing Codex's provider and does not require the config below.

## Hard rules

- **Never run OmniRoute and CCR at the same time.** One gateway experiment at a time.
- **Never change the default Codex model, provider or auth** during setup. Keep
  `model`/`model_provider` untouched; add a named provider only for an explicit,
  approved test.
- **Never route ChatGPT/Codex login credentials** (`~/.codex/auth.json`, OAuth
  tokens, session cookies) through any gateway. Use only explicitly authorized,
  documented provider API keys.
- Gateways bind to `127.0.0.1`/`localhost` only, with their own auth enabled.
- No remote install scripts (`curl | sh`) without reviewing them first.

## How Codex selects a provider (verified in the official config reference)

`model_provider` = id under `[model_providers.<id>]` in `~/.codex/config.toml`
(**user-level only** — Codex ignores `model_provider`/`model_providers` in a
project-local `.codex/config.toml`, so the RePassa repo config is never the right
place for this).

```toml
model_provider = "gateway-experiment"   # only while testing; revert after
model = "<model-id>"

[model_providers.gateway-experiment]
name = "Gateway experiment"
base_url = "http://127.0.0.1:20128/v1"  # OmniRoute example
env_key = "OMNIROUTE_API_KEY"           # key comes from env, never committed
wire_api = "responses"                  # only 'responses' is supported
```

- `wire_api` accepts only `responses` in the current reference — the gateway must
  serve an OpenAI **Responses API** endpoint, not just chat completions.
- `env_key` reads the key from an environment variable; `experimental_bearer_token`
  (inline secret) is discouraged and must not be used in committed files.
- `gateway_oauth` exists for gateway auth but is out of scope here.

## OmniRoute

- **Upstream:** `cheaper-inference/OmniRoute` (formerly `diegosouzapw/OmniRoute`),
  MIT, actively maintained (HEAD `332e93b`, 21/11/2026). npm package `omniroute`;
  OpenAI-compatible endpoint on `http://localhost:20128/v1` plus dashboard;
  advertises format translation including a Responses target format
  (`targetFormat openai-responses`), tool calls and streaming.
- **The `ChrisCompton/omniroute` fork is a stale snapshot** — merge base = upstream
  v3.6.1 (10/04/2026), ~7 months / hundreds of upstream commits behind. Do **not**
  install the fork; if this experiment proceeds, use the upstream project.
- It is a heavy Next.js/Electron app with its own DB — larger footprint than CCR.
- Its "SUBSCRIPTION tier" reuses locally stored CLI OAuth credentials of other
  agents. **That is prohibited here**: only API-key providers are allowed, and no
  provider is enabled until the owner supplies a key.

## Claude Code Router (CCR)

- `musistudio/claude-code-router` v3.1.6, Windows desktop installer + npm CLI
  (`npm install -g @musistudio/claude-code-router`, Node 22+; gateway on
  `127.0.0.1:3456`, UI on `:3458`).
- Supports OpenAI Chat/Responses upstreams and a dedicated **Codex** agent profile
  (CLI and desktop app). Use **"Only opened from CCR"** effect scope — never
  "System default" — so the stock Codex configuration is untouched.

## Activation test plan (before any adoption)

Run each against one authorized low-cost/free provider, all on localhost:

1. `orchestrator_health`-style connectivity + auth check.
2. Basic Codex tool-calling task through the gateway (verifies Responses tool calls).
3. A bounded multi-file coding task (verifies streaming + longer outputs).
4. An error-recovery task (provider offline / quota exhausted → clean failure, no
   retry storm, no silent fallback to another provider or to OpenAI auth).

Only if all pass: discuss a time-boxed provider switch with the owner. Restore by
removing the `model_provider`/`model_providers` additions or restoring the
installer backup of `~/.codex/config.toml`.
