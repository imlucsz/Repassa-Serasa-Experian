---
name: repassa-context-efficiency
description: Keep RePassa repository searches, debug sessions and handoffs focused while preserving contract evidence and complete test results when needed.
---

# Focus the evidence

1. Start with `repassa-context`. Confirm branch, baseline and scope with Git. Inspect only the relevant diff and paths. Read the relevant sections of the Agent Kit and OpenAPI before reasoning from a local shortcut.
2. Use a recent local Graphify index if available for a specific dependency question. Verify each edge against source. Otherwise use `rg --files`, `rg -n` for known symbols, and targeted file reads. Limit result lists and exclude generated directories and unrelated media.
3. Use RTK where available and configured. Use `rtk proxy <command>` when filtering would hide exact diagnostics, change formatting or lose test evidence. The Git and ripgrep commands work directly on hosts without RTK.
4. Keep one working summary of scope, decisions and evidence. Preserve exit status and actionable output from failed commands. Inspect raw failures on demand. Avoid routine context dumps, repeated checks of the same revision, unrelated repositories and private histories.
5. Before handoff, give the revision, changed paths, test evidence and specific follow-ups. Use [the project toolchain guide](../../../docs/repassa/AGENT_TOOLCHAIN.md) for local graph setup.
