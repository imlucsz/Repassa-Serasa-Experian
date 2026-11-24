#Requires -Version 5.1
<#
.SYNOPSIS
  Installs the RePassa agent orchestrator MCP server for Codex Desktop (Windows).

.DESCRIPTION
  Idempotent bootstrapper. Steps:
    1. Verify prerequisites (Node >= 22.12, npm, Codex config presence).
    2. npm ci + build inside tools/agent-orchestrator.
    3. Copy orchestrator.config.example.json -> %LOCALAPPDATA%\RepassaOrchestrator\orchestrator.config.json
       (never overwrites an existing config without -ForceConfig).
    4. Back up ~/.codex/config.toml, then register [mcp_servers.repassa-orchestrator]
       (skipped if the section already exists).
  Does NOT change the Codex model, auth, or any other MCP server entry.

.PARAMETER DryRun
  Report what would happen without changing anything.

.PARAMETER RepoRoot
  Path to the RePassa repo clone (default: repo containing this script).

.PARAMETER SkipBuild
  Skip npm ci/build (use when already built).

.PARAMETER ForceConfig
  Overwrite an existing %LOCALAPPDATA% orchestrator.config.json (a backup is kept).
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [string]$RepoRoot,
  [switch]$SkipBuild,
  [switch]$ForceConfig
)

$ErrorActionPreference = 'Stop'
$toolDir  = Split-Path -Parent $PSScriptRoot
if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $toolDir '..\..')).Path }
$RepoRoot = (Resolve-Path $RepoRoot).Path
$stateDir = Join-Path $env:LOCALAPPDATA 'RepassaOrchestrator'
$configDest = Join-Path $stateDir 'orchestrator.config.json'
$configSrc  = Join-Path $toolDir 'orchestrator.config.example.json'
$codexCfg   = Join-Path $env:USERPROFILE '.codex\config.toml'
$entryJs    = Join-Path $toolDir 'dist\index.js'
$serverName = 'repassa-orchestrator'

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Info($msg) { Write-Host "    $msg" }
function Warn($msg) { Write-Warning $msg }

$failures = 0
function Check($ok, $okMsg, $badMsg) {
  if ($ok) { Info "OK   $okMsg" } else { Warn $badMsg; $script:failures++ }
}

Step "Prerequisites"
$node = Get-Command node -ErrorAction SilentlyContinue
Check ($null -ne $node) "node found at $($node.Source)" "node not on PATH (install Node 22+)"
$nodeVer = $null
if ($node) { $nodeVer = (node --version) }
if ($nodeVer) {
  $maj = [int]($nodeVer.TrimStart('v').Split('.')[0])
  $min = [int]($nodeVer.TrimStart('v').Split('.')[1])
  Check (($maj -gt 22) -or ($maj -eq 22 -and $min -ge 12)) "node $nodeVer >= 22.12" "node $nodeVer is older than 22.12 (MCP SDK requirement)"
}
Check ($null -ne (Get-Command npm -ErrorAction SilentlyContinue)) "npm on PATH" "npm not on PATH"
Check (Test-Path $configSrc) "example config found" "orchestrator.config.example.json missing at $configSrc"
if (Test-Path $entryJs) { Info "build output present: $entryJs" }
elseif ($SkipBuild) { Warn "dist\index.js missing but -SkipBuild was given - registration will fail"; $failures++ }
else { Info "dist\index.js not built yet - build step below will produce it" }
if (Test-Path $codexCfg) { Info "Codex config: $codexCfg" } else { Warn "No $codexCfg - will create a minimal file" }
if ($failures -gt 0 -and -not $DryRun) { throw "Prerequisites failed - fix and rerun." }
if ($DryRun) { Info "(dry-run: continuing to show planned actions even with failures)" }

Step "Install + build ($toolDir)"
if ($DryRun) {
  Info "would run: npm ci --no-audit --no-fund ; npm run build"
} elseif (-not $SkipBuild) {
  Push-Location $toolDir
  try {
    if (Test-Path (Join-Path $toolDir 'package-lock.json')) { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
    npm run build | Out-Null
  } finally { Pop-Location }
  Check (Test-Path $entryJs) "built $entryJs" "build produced no dist\index.js"
  if (-not (Test-Path $entryJs)) { throw "Build failed - cannot register a server with no entry point." }
} else { Info "skipped (-SkipBuild)" }

Step "Orchestrator config"
# Absolute paths are baked into the installed copy so repoRoot/rolesFile never
# depend on where the config file itself lives.
if ($DryRun) {
  if (Test-Path $configDest) { Info "would keep existing $configDest" }
  else { Info "would write $configDest with repoRoot=$RepoRoot and rolesFile=$toolDir\roles.json (absolute)" }
} else {
  New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  if ((Test-Path $configDest) -and -not $ForceConfig) {
    Info "existing config kept: $configDest (use -ForceConfig to replace; a backup is made)"
  } else {
    if (Test-Path $configDest) {
      $bak = Join-Path $stateDir ("orchestrator.config.{0}.bak" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
      Copy-Item $configDest $bak; Info "backed up old config -> $bak"
    }
    $cfgJson = Get-Content $configSrc -Raw | ConvertFrom-Json
    $cfgJson.repoRoot  = $RepoRoot
    $cfgJson.rolesFile = (Join-Path $toolDir 'roles.json')
    $cfgJson.stateDir  = (Join-Path $stateDir 'state')
    if ($cfgJson.workers) { $cfgJson.workers.worktreeRoot = (Join-Path $stateDir 'worktrees') }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($configDest, ($cfgJson | ConvertTo-Json -Depth 20), $utf8NoBom)
    Info "wrote $configDest (repoRoot=$RepoRoot) - edit providers/budget there"
  }
}

Step "Codex MCP registration ($codexCfg)"
$section = @"

[mcp_servers.$serverName]
command = "$($node.Source -replace '\\','\\')"
args = ["$($entryJs -replace '\\','\\')"]
startup_timeout_sec = 30
tool_timeout_sec = 300
env_vars = ["OMNIROUTE_API_KEY"]

"@
if ($DryRun) {
  Info "would append section [mcp_servers.$serverName] if absent:"
  Info $section
} else {
  $existing = if (Test-Path $codexCfg) { Get-Content $codexCfg -Raw } else { '' }
  if ($existing -match "(?m)^\[mcp_servers\.$([regex]::Escape($serverName))\]") {
    Info "section already registered - left untouched"
  } else {
    $backupDir = Join-Path $stateDir 'backups'
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    if (Test-Path $codexCfg) {
      $bak = Join-Path $backupDir ("config.toml.{0}.bak" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
      Copy-Item $codexCfg $bak; Info "backed up config.toml -> $bak"
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    if (Test-Path $codexCfg) { [System.IO.File]::AppendAllText($codexCfg, $section, $utf8NoBom) }
    else { [System.IO.File]::WriteAllText($codexCfg, $section.TrimStart(), $utf8NoBom) }
    Info "registered [mcp_servers.$serverName]"
  }
}

Step "Done"
Info "Astra/Codex keeps your current model and auth - nothing else was changed."
Info "Next steps:"
Info "  1. Edit $configDest : declare YOUR authorized providers/models (billing 'free' or 'paid')."
Info "  2. If using OmniRoute: setx OMNIROUTE_API_KEY `"<your-omniroute-key>`" then restart Codex Desktop."
Info "  3. Fully restart Codex Desktop, then run tools\agent-orchestrator\scripts\Test-Orchestrator.ps1"
Info "Rollback: scripts\Uninstall-Orchestrator.ps1"
if ($DryRun) { Info "(dry-run complete - no changes were made)" }
