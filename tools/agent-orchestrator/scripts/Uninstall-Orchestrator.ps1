#Requires -Version 5.1
<#
.SYNOPSIS
  Removes the RePassa orchestrator MCP registration from Codex config.

.DESCRIPTION
  Backs up ~/.codex/config.toml, then deletes the [mcp_servers.repassa-orchestrator]
  section (header + its key lines up to the next [section]). Leaves the tool
  directory, state and your authorized provider config untouched unless
  -RemoveState is passed. Does not touch your Codex model or auth.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [switch]$DryRun,
  [switch]$RemoveState
)

$ErrorActionPreference = 'Stop'
$codexCfg   = Join-Path $env:USERPROFILE '.codex\config.toml'
$stateDir   = Join-Path $env:LOCALAPPDATA 'RepassaOrchestrator'
$serverName = 'repassa-orchestrator'

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Info($msg) { Write-Host "    $msg" }

Step "Remove MCP registration from $codexCfg"
if (-not (Test-Path $codexCfg)) { Info "no config.toml - nothing to remove" }
else {
  $lines = Get-Content $codexCfg
  $out = New-Object System.Collections.Generic.List[string]
  $inTarget = $false; $removed = $false
  foreach ($line in $lines) {
    if ($line -match '^\s*\[') {
      if ($line -match "^\s*\[mcp_servers\.$([regex]::Escape($serverName))\]") { $inTarget = $true; $removed = $true; continue }
      $inTarget = $false
    }
    if (-not $inTarget) { $out.Add($line) }
  }
  if (-not $removed) { Info "section [mcp_servers.$serverName] not present - nothing to remove" }
  elseif ($DryRun) { Info "dry-run: would remove section [mcp_servers.$serverName]" }
  else {
    $backupDir = Join-Path $stateDir 'backups'
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    $bak = Join-Path $backupDir ("config.toml.{0}.preremove.bak" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Copy-Item $codexCfg $bak; Info "backup -> $bak"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($codexCfg, ($out -join "`r`n") + "`r`n", $utf8NoBom)
    Info "removed [mcp_servers.$serverName] - restart Codex Desktop to apply"
  }
}

Step "State"
if ($RemoveState) {
  if ($DryRun) { Info "dry-run: would delete $stateDir" }
  elseif (Test-Path $stateDir) {
    Info "removing $stateDir (task records, budget ledger, worker worktrees, backups)"
    Remove-Item -Recurse -Force $stateDir
  }
} else {
  Info "kept $stateDir (pass -RemoveState to delete task records, ledger and backups)"
}

Info "Done. Codex model/auth and other MCP servers were not modified."
