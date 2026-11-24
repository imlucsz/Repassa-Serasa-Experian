# RePassa agent tooling rollback (Windows).
# Reverts changes recorded by Install-RePassaTools.ps1, using its manifest and backups:
#   1. `rtk init --global --codex --uninstall` (removes the global hook + RTK.md)
#   2. Restores backed-up config.toml / hooks.json / RTK.md / skill directories
#   3. Removes the graphify Codex skill directories that the installer created
#   4. Removes the USER Path entry added for RTK
#   5. With -RemoveBinaries: deletes RepassaTools binaries, `uv tool uninstall graphifyy`,
#      and `npm uninstall -g` for gateways the installer added
#
# Never touches: ~/.codex/auth.json, session data, Codex model/provider settings the
# installer did not add, repository files, or any other skills/hooks.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\agent-setup\Restore-RePassaTools.ps1 [-DryRun] [-Yes] [-RemoveBinaries]
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Yes,
    [switch]$RemoveBinaries,
    [string]$ManifestPath
)
$ErrorActionPreference = 'Stop'
function Write-Step([string]$Text) { Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Info([string]$Text) { Write-Host "  $Text" }
function Confirm-Step([string]$Description) {
    if ($DryRun) { return $false }
    if ($Yes) { Write-Info "Approved via -Yes: $Description"; return $true }
    $answer = Read-Host "$Description`nType YES to approve, anything else to skip"
    return ($answer -eq 'YES')
}
function Get-CommandPath([string]$Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$ToolsRoot = Join-Path $env:LOCALAPPDATA 'RepassaTools'
$RtkDir = Join-Path $ToolsRoot 'rtk'
if (-not $ManifestPath) { $ManifestPath = Join-Path $ToolsRoot 'agent-setup-state.json' }

$manifest = $null
if (Test-Path $ManifestPath) {
    $manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
    Write-Info "Manifest: $ManifestPath (backup dir: $($manifest.backupDir))"
} else {
    Write-Warning "No manifest at $ManifestPath  -  only generic RTK/graphify rollback steps can be attempted."
}

# --- 1. RTK Codex hook ----------------------------------------------------------
$rtkExe = Get-CommandPath 'rtk'
if (-not $rtkExe -and (Test-Path (Join-Path $RtkDir 'rtk.exe'))) { $rtkExe = Join-Path $RtkDir 'rtk.exe' }
Write-Step 'RTK Codex hook removal'
if ($rtkExe) {
    if ($DryRun) { Write-Info "[dry-run] would run: $rtkExe init --global --codex --uninstall" }
    elseif (Confirm-Step "Run 'rtk init --global --codex --uninstall' under $CodexHome?") {
        & $rtkExe init --global --codex --uninstall
        Write-Info "rtk uninstall exit: $LASTEXITCODE"
    }
} else { Write-Info 'rtk executable not found; hook removal must be done manually (delete rtk entries in hooks.json).' }

# --- 2. Restore backups ----------------------------------------------------------
$backupFiles = @()
if ($manifest) { $backupFiles = @($manifest.actions | Where-Object { $_.id -eq 'backup-file' -and $_.backup -and (Test-Path $_.backup) }) }
if ($backupFiles) {
    Write-Step 'Restore backed-up files'
    foreach ($b in $backupFiles) {
        if ($DryRun) { Write-Info "[dry-run] would restore $($b.backup) -> $($b.source)"; continue }
        if (Confirm-Step "Restore $($b.backup) to $($b.source) ?") {
            Copy-Item $b.backup $b.source -Recurse -Force
            Write-Info "Restored $($b.source)"
        }
    }
} else { Write-Info 'No backup entries recorded/found; skipping file restore.' }

# --- 3. Graphify Codex skill ------------------------------------------------------
Write-Step 'Graphify Codex skill removal'
$installedPaths = @()
if ($manifest) {
    $installedPaths = @($manifest.actions | Where-Object { $_.id -eq 'graphify-codex-skill' -and $_.status -eq 'installed' } |
        ForEach-Object { $_.paths } | Where-Object { $_ })
}
if (-not $installedPaths) {
    $installedPaths = @((Join-Path $CodexHome 'skills\graphify'), (Join-Path $env:USERPROFILE '.agents\skills\graphify')) |
        Where-Object { Test-Path $_ }
    if ($installedPaths) { Write-Info "No manifest record; found candidates: $($installedPaths -join ', ')" }
}
foreach ($p in $installedPaths) {
    if ($DryRun) { Write-Info "[dry-run] would remove $p (only if it is a graphify skill dir)"; continue }
    if ((Test-Path $p) -and (Test-Path (Join-Path $p 'SKILL.md')) -and (Confirm-Step "Remove graphify skill directory $p ?")) {
        Remove-Item $p -Recurse -Force
        Write-Info "Removed $p"
    }
}

# --- 4. USER Path entry ------------------------------------------------------------
Write-Step 'USER Path entry removal'
$addedPath = $null
if ($manifest) { $addedPath = @($manifest.actions | Where-Object { $_.id -eq 'user-path' } | Select-Object -Last 1).added }
if (-not $addedPath) { $addedPath = $RtkDir }
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -and (($userPath -split ';') -contains $addedPath)) {
    if ($DryRun) { Write-Info "[dry-run] would remove $addedPath from USER Path" }
    elseif (Confirm-Step "Remove $addedPath from the USER Path environment variable?") {
        $newPath = ($userPath -split ';' | Where-Object { $_ -and $_ -ne $addedPath }) -join ';'
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Write-Info 'Removed from USER Path (open a new shell to pick up the change).'
    }
} else { Write-Info "Path entry $addedPath not present; nothing to remove." }

# --- 5. Optional binary removal ------------------------------------------------------
Write-Step 'Binaries and packages'
if (-not $RemoveBinaries) { Write-Info 'Keeping installed binaries (pass -RemoveBinaries to uninstall them).' }
else {
    if (Test-Path $ToolsRoot) {
        if ($DryRun) { Write-Info "[dry-run] would remove $ToolsRoot" }
        elseif (Confirm-Step "Delete $ToolsRoot (RTK binary, manifests, backups)?") { Remove-Item $ToolsRoot -Recurse -Force; Write-Info "Removed $ToolsRoot" }
    }
    $uv = Get-CommandPath 'uv'
    if ($uv -and (Confirm-Step 'Run `uv tool uninstall graphifyy`?')) {
        if ($DryRun) { Write-Info '[dry-run] would run uv tool uninstall graphifyy' } else { & $uv tool uninstall graphifyy }
    }
    if ((Get-CommandPath 'npm')) {
        foreach ($pkg in 'omniroute', '@musistudio/claude-code-router') {
            $wasInstalled = -not $manifest -or @($manifest.actions | Where-Object { $_.status -eq 'installed-inactive' -and ($_.id -eq 'omniroute' -or $_.id -eq 'claude-code-router') }).Count -gt 0
            if ($wasInstalled -and (Confirm-Step "Run 'npm uninstall -g $pkg' if present?")) {
                if ($DryRun) { Write-Info "[dry-run] would run npm uninstall -g $pkg" } else { & npm uninstall -g $pkg }
            }
        }
    }
}

Write-Step 'Done'
Write-Info 'Rollback complete. Codex auth, sessions, model/provider settings and repository files were not touched.'
Write-Info 'Restart Codex to unload any still-registered hooks.'
