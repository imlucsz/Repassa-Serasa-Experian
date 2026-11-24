# OmniRoute gateway example (no credentials)

This file documents the OmniRoute side of the delegation setup. OmniRoute
(upstream: `cheaper-inference/OmniRoute`; the `ChrisCompton/omniroute` fork is
stale as of 2026-11) runs as a localhost OpenAI-compatible gateway on your own
machine. All provider API keys live inside OmniRoute's own storage - the
orchestrator only ever sees the OmniRoute gateway key.

## Why not OmniRoute's own MCP server?

OmniRoute ships an MCP server, but its tools manage the gateway itself
(provider keys, combos, quota visibility). It does not expose a generic
"run a task on model X" tool, so this repo provides a minimal delegation MCP
(`tools/agent-orchestrator`) that calls OmniRoute's `/v1/chat/completions`.

## Expected OmniRoute setup

1. Install OmniRoute locally per upstream README. Default port `20128`.
2. In the OmniRoute dashboard, add ONLY the provider accounts you authorized.
   Free-tier availability is conditional - verify current provider terms; the
   orchestrator treats `billing: "free"` as your declaration, not a guarantee.
3. Create an OmniRoute API key (dashboard -> API Keys). Set it in your user
   environment so Codex can pass it to the stdio server:

   ```
   setx OMNIROUTE_API_KEY "or_xxxxxxxx"
   ```

   (restart the terminal/Codex after `setx`)

4. Point the orchestrator at it in
   `%LOCALAPPDATA%\RepassaOrchestrator\orchestrator.config.json`:

   ```json
   "gateway": {
     "type": "openai-compatible",
     "baseUrl": "http://127.0.0.1:20128/v1",
     "apiKeyEnv": "OMNIROUTE_API_KEY",
     "adminBaseUrl": "http://127.0.0.1:20128",
     "timeoutSec": 60,
     "maxRetries": 0
   }
   ```

5. Declare the models you approved in `providers[]`, e.g.:

   ```json
   { "id": "openrouter-free", "billing": "free",
     "models": [{ "id": "openrouter/google/gemini-2.0-flash-exp:free", "capabilities": ["text","code"] }] }
   ```

   The `id` sent to OmniRoute is whatever OmniRoute expects on the wire
   (provider/model combo or an OmniRoute "combo" name).

## Hard rules

- OmniRoute stays bound to `127.0.0.1` and auth-enabled. Never expose it.
- Never put your ChatGPT/Codex subscription credentials into OmniRoute or any
  gateway. Only explicit provider API keys.
- `safety.localhostOnly: true` refuses non-local `baseUrl` at server start.
- Start `safety.mode: "read-only"`. Enable `"supervised"` + `workers.enabled`
  only after read-only delegation has been validated (Phase 6).
- Never run OmniRoute and Claude Code Router gateways at the same time.
