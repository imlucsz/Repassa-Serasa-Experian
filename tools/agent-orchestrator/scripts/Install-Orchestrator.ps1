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
Check (Test-Path $entryJs -or $SkipBuild) "build output $entryJs" "dist\index.js missing; build will run"
Check (Test-Path $configSrc) "example config found" "orchestrator.config.example.json missing at $configSrc"
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
} else { Info "skipped (-SkipBuild)" }

Step "Orchestrator config"
if ($DryRun) {
  if (Test-Path $configDest) { Info "would keep existing $configDest" } else { Info "would copy $configSrc -> $configDest" }
} else {
  New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  if ((Test-Path $configDest) -and -not $ForceConfig) {
    Info "existing config kept: $configDest (use -ForceConfig to replace; a backup is made)"
  } else {
    if (Test-Path $configDest) {
      $bak = Join-Path $stateDir ("orchestrator.config.{0}.bak" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
      Copy-Item $configDest $bak; Info "backed up old config -> $bak"
    }
    Copy-Item $configSrc $configDest
    Info "wrote $configDest - edit providers/budget there"
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
    Add-Content -Path $codexCfg -Value $section -Encoding UTF8
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
