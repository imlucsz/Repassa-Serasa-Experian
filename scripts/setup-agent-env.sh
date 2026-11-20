#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
[[ -f AGENTS.md && -f scripts/agent-guard.mjs ]] || { echo 'Run in the configured RePassa repo.' >&2; exit 1; }
node --version
current=$(git config --get core.hooksPath || true)
if [[ -n "$current" && "$current" != '.githooks' ]]; then
  echo 'Existing non-RePassa hooksPath; integrate manually, not overwriting.' >&2; exit 1
fi
chmod +x .githooks/pre-commit .githooks/pre-push
node --test scripts/agent-guard.test.mjs
git config --local core.hooksPath .githooks
printf 'Hooks active in this clone: '; git config --local --get core.hooksPath
