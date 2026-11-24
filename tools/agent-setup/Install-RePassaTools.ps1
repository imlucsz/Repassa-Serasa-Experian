# RePassa agent tooling bootstrapper (Windows).
# Installs optional, token-saving tools for the local Codex CLI/Desktop environment:
#   - RTK binary + `rtk init --global --codex` (command-output compression hook)
#   - uv + `graphifyy` + `graphify install --platform codex` (local AST knowledge graph)
#   - ccusage availability check via npx (reads local session logs; nothing installed)
#   - Optional, inactive-only: OmniRoute and Claude Code Router npm installs
#
# Safety contract:
#   * Idempotent: already-satisfied steps are skipped.
#   * -DryRun prints every planned action and changes nothing.
#   * Every executable install, PATH change, global config write or hook registration
#     requires typed confirmation unless -Yes is passed explicitly.
#   * Existing files are backed up before modification into
#     $env:LOCALAPPDATA\RepassaTools\backups\<timestamp>\ and recorded in a manifest.
#   * Never reads/copies ~/.codex/auth.json, session tokens, .env files or any secret.
#   * Never changes the Codex default model, provider or authentication.
#   * Gateways (OmniRoute/CCR) are installed but never started or wired into config.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\agent-setup\Install-RePassaTools.ps1 [-DryRun] [-Yes]
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Yes,
    [string]$RtkVersion = '1.2.1',
    [switch]$SkipRtk,
    [switch]$SkipGraphify,
    [switch]$SkipCcusage,
    [switch]$InstallOmniroute,
    [switch]$InstallClaudeCodeRouter,
    [switch]$EnableCodexMultiAgent
)
$ErrorActionPreference = 'Stop'
$script:Actions = @()
$script:Failures = @()

function Write-Step([string]$Text) { Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Info([string]$Text) { Write-Host "  $Text" }
function Write-Warn2([string]$Text) { Write-Host "  WARN: $Text" -ForegroundColor Yellow }
function Write-Fail([string]$Text) { Write-Host "  FAIL: $Text" -ForegroundColor Red; $script:Failures += $Text }
function Add-Action([string]$Id, [string]$Status, [hashtable]$Extra = @{}) {
    $script:Actions += (@{ id = $Id; status = $Status; at = (Get-Date).ToString('o') } + $Extra)
}
function Find-CodexCli {
    $p = Get-CommandPath 'codex'
    if ($p) { return $p }
    # WindowsApps cannot be enumerated; ask the AppX package for its install location.
    try {
        $pkg = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($pkg -and $pkg.InstallLocation) {
            $candidate = Join-Path $pkg.InstallLocation 'app\resources\codex.exe'
            if (Test-Path $candidate) { return $candidate }
        }
    } catch { }
    $fallback = Get-ChildItem 'C:\Program Files\WindowsApps\OpenAI.Codex_*\app\resources\codex.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($fallback) { return $fallback.FullName }
    return $null
}
function Confirm-Step([string]$Description) {
    if ($DryRun) { Write-Info "[dry-run] would ask approval for: $Description"; return $false }
    if ($Yes) { Write-Info "Approved via -Yes: $Description"; return $true }
    $answer = Read-Host "$Description`nType YES to approve, anything else to skip"
    return ($answer -eq 'YES')
}
function Get-CommandPath([string]$Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}
function Invoke-Logged([string]$File, [string[]]$Arguments, [string]$What) {
    if ($DryRun) { Write-Info "[dry-run] would run: $File $($Arguments -join ' ')"; return 0 }
    & $File @Arguments
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "$What failed (exit $code): $File $($Arguments -join ' ')" }
    return $code
}

# --- Detection ----------------------------------------------------------------
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$ToolsRoot = Join-Path $env:LOCALAPPDATA 'RepassaTools'
$RtkDir = Join-Path $ToolsRoot 'rtk'
$StateFile = Join-Path $ToolsRoot 'agent-setup-state.json'
$BackupDir = Join-Path $ToolsRoot ('backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))

Write-Step 'Environment detection'
Write-Info "Codex home : $CodexHome"
Write-Info "Tools root : $ToolsRoot"
Write-Info "Dry run    : $($DryRun.IsPresent)"
if (-not (Test-Path $CodexHome)) { Write-Warn2 "Codex home not found; Codex CLI/Desktop may not be installed." }

$CodexCli = Find-CodexCli
if ($CodexCli) { Write-Info "Codex CLI  : $CodexCli" } else { Write-Warn2 'codex executable not found on PATH or in the Codex Desktop package.' }

foreach ($tool in 'git', 'node', 'npm', 'python') {
    $p = Get-CommandPath $tool
    if ($p) { Write-Info "$tool       : $p" } else { Write-Warn2 "$tool not found on PATH." }
}

# --- Backup -------------------------------------------------------------------
$backupTargets = @(
    (Join-Path $CodexHome 'config.toml'),
    (Join-Path $CodexHome 'hooks.json'),
    (Join-Path $CodexHome 'RTK.md')
) + @(
    (Join-Path $CodexHome 'skills\graphify'),
    (Join-Path $env:USERPROFILE '.agents\skills\graphify')
)
$existingTargets = @()
foreach ($t in $backupTargets) { $existingTargets += [pscustomobject]@{ Path = $t; Existed = (Test-Path $t) } }
if ($DryRun) {
    Write-Step 'Backup plan'
    Write-Info "[dry-run] would create backup dir $BackupDir and copy existing config/hook/skill files."
} else {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    $i = 0
    foreach ($t in $existingTargets | Where-Object Existed) {
        $i++
        $dest = Join-Path $BackupDir ("file{0}" -f $i)
        Copy-Item $t.Path $dest -Recurse -Force
        Add-Action 'backup-file' 'done' @{ source = $t.Path; backup = $dest }
    }
    Add-Action 'backup' 'done' @{ dir = $BackupDir }
    Write-Step 'Backup'
    Write-Info "Backed up existing files to $BackupDir"
}

# --- RTK binary ----------------------------------------------------------------
if (-not $SkipRtk) {
    Write-Step 'RTK binary'
    $rtkPath = Get-CommandPath 'rtk'
    if ($rtkPath) {
        Write-Info "Already installed: $rtkPath"
        Add-Action 'rtk-binary' 'already-present' @{ path = $rtkPath }
    } else {
        $asset = "rtk-x86_64-pc-windows-msvc.zip"
        $base = "https://github.com/rtk-ai/rtk/releases/download/v$RtkVersion"
        Write-Info "Not on PATH. Planned: download $asset (v$RtkVersion) + checksums.txt from $base"
        if (Confirm-Step "Download and install the RTK $RtkVersion Windows binary into $RtkDir and add it to your USER PATH?") {
            $tmp = Join-Path ([IO.Path]::GetTempPath()) ('rtk-' + [Guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Path $tmp | Out-Null
            try {
                $zip = Join-Path $tmp $asset
                $sums = Join-Path $tmp 'checksums.txt'
                Invoke-WebRequest -Uri "$base/$asset" -OutFile $zip -UseBasicParsing
                Invoke-WebRequest -Uri "$base/checksums.txt" -OutFile $sums -UseBasicParsing
                $expected = (Get-Content $sums | Where-Object { $_ -match [regex]::Escape($asset) } |
                    ForEach-Object { ($_ -split '\s+')[0] }) | Select-Object -First 1
                $actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
                if (-not $expected -or $actual -ne $expected.ToLowerInvariant()) {
                    throw "SHA256 mismatch for $asset (expected $expected, got $actual). Aborted."
                }
                New-Item -ItemType Directory -Path $RtkDir -Force | Out-Null
                Expand-Archive $zip -DestinationPath $RtkDir -Force
                $exe = Get-ChildItem $RtkDir -Recurse -Filter rtk.exe | Select-Object -First 1
                if (-not $exe) { throw "rtk.exe not found inside $asset" }
                Write-Info "Installed $($exe.FullName)"
                & $exe.FullName --version
                Add-Action 'rtk-binary' 'installed' @{ path = $exe.DirectoryName; version = $RtkVersion; sha256 = $actual }

                $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
                if (($userPath -split ';') -notcontains $exe.DirectoryName) {
                    if (Confirm-Step "Add $($exe.DirectoryName) to the USER Path environment variable?") {
                        [Environment]::SetEnvironmentVariable('Path', ($exe.DirectoryName + ';' + $userPath), 'User')
                        $env:Path = $exe.DirectoryName + ';' + $env:Path
                        Add-Action 'user-path' 'modified' @{ added = $exe.DirectoryName }
                        Write-Info 'PATH updated for future shells and this session.'
                    } else {
                        Write-Warn2 "PATH not updated; call rtk via $($exe.FullName) or add the directory manually."
                    }
                }
            } finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
        } else {
            Write-Info 'Skipped RTK binary install.'
            Add-Action 'rtk-binary' 'skipped'
        }
    }

    # --- RTK Codex integration -------------------------------------------------
    $rtkExe = Get-CommandPath 'rtk'
    if (-not $rtkExe -and (Test-Path (Join-Path $RtkDir 'rtk.exe'))) { $rtkExe = Join-Path $RtkDir 'rtk.exe' }
    if ($rtkExe) {
        Write-Step 'RTK Codex integration (global hook)'
        Write-Info 'Preview of what `rtk init --global --codex` writes (no changes):'
        if (-not $DryRun) { & $rtkExe init --global --codex --dry-run } else { Write-Info "[dry-run] would run: $rtkExe init --global --codex --dry-run" }
        Write-Info "This registers a PreToolUse hook and RTK.md inside $CodexHome. It never touches auth, model or provider settings."
        if (Confirm-Step "Register the RTK Codex hook globally under $CodexHome?") {
            Invoke-Logged $rtkExe @('init', '--global', '--codex') 'rtk init'
            Add-Action 'rtk-codex-hook' 'installed' @{ scope = 'global'; codexHome = $CodexHome }
            Write-Info 'Restart Codex Desktop/CLI sessions so the hook loads; trust the hook when prompted.'
        } else {
            Add-Action 'rtk-codex-hook' 'skipped'
        }
    } else { Write-Warn2 'rtk executable unavailable; skipping Codex hook registration.' }
}

# --- ccusage (npx, no install) -------------------------------------------------
if (-not $SkipCcusage) {
    Write-Step 'ccusage availability check'
    Write-Info 'ccusage reads local ~/.codex session logs and reports ESTIMATED tokens/costs.'
    Write-Info 'These numbers are local estimates, not your subscription quota balance.'
    if (Confirm-Step 'Run `npx -y ccusage@latest codex daily --last 1` to verify reporting works (downloads the package to the npm cache)?') {
        try {
            & npx -y 'ccusage@latest' codex daily --last 1
            Add-Action 'ccusage' 'verified'
        } catch { Write-Warn2 "ccusage run failed: $($_.Exception.Message)"; Add-Action 'ccusage' 'failed' }
    } else { Add-Action 'ccusage' 'skipped' }
}

# --- uv + Graphify --------------------------------------------------------------
if (-not $SkipGraphify) {
    Write-Step 'uv (Python package/tool runner)'
    $uv = Get-CommandPath 'uv'
    if ($uv) { Write-Info "Already installed: $uv"; Add-Action 'uv' 'already-present' @{ path = $uv } }
    elseif (Get-CommandPath 'python') {
        if (Confirm-Step 'Install uv via `python -m pip install --user uv`?') {
            Invoke-Logged 'python' @('-m', 'pip', 'install', '--user', 'uv') 'pip install uv'
            $uv = Get-CommandPath 'uv'
            if (-not $uv) {
                $scripts = Join-Path (python -c "import sysconfig; print(sysconfig.get_path('scripts', 'nt_user'))") 'uv.exe'
                if (Test-Path $scripts) { $uv = $scripts; Write-Warn2 "uv at $scripts (user Scripts dir not on PATH)" }
            }
            Add-Action 'uv' 'installed' @{ path = $uv }
        } else { Add-Action 'uv' 'skipped' }
    } else { Write-Warn2 'python not found; cannot install uv/graphify.'; Add-Action 'uv' 'blocked-no-python' }

    if ($uv) {
        Write-Step 'Graphify CLI (graphifyy)'
        $graphify = Get-CommandPath 'graphify'
        if ($graphify) { Write-Info "Already installed: $graphify"; Add-Action 'graphify-cli' 'already-present' }
        elseif (Confirm-Step 'Install the graphifyy CLI via `uv tool install graphifyy`?') {
            Invoke-Logged $uv @('tool', 'install', 'graphifyy') 'uv tool install graphifyy'
            $graphify = Get-CommandPath 'graphify'
            if (-not $graphify) { Write-Warn2 'graphify not on PATH yet; open a new shell or add the uv tools dir to PATH.' }
            Add-Action 'graphify-cli' 'installed'
        } else { Add-Action 'graphify-cli' 'skipped' }

        Write-Step 'Graphify Codex skill'
        $skillPaths = @((Join-Path $CodexHome 'skills\graphify'), (Join-Path $env:USERPROFILE '.agents\skills\graphify'))
        $existing = $skillPaths | Where-Object { Test-Path $_ }
        if ($existing) {
            Write-Warn2 "Existing graphify skill found at: $($existing -join ', ')  -  will NOT overwrite."
            Add-Action 'graphify-codex-skill' 'preserved-existing' @{ paths = @($existing) }
        } elseif ($graphify -and (Confirm-Step 'Run `graphify install --platform codex` to install the user-level Codex skill ($graphify invocation)?')) {
            Invoke-Logged $graphify @('install', '--platform', 'codex') 'graphify install'
            $created = $skillPaths | Where-Object { Test-Path $_ }
            Add-Action 'graphify-codex-skill' 'installed' @{ paths = @($created) }
            Write-Info 'Invoke inside Codex with $graphify.'
        } else { Add-Action 'graphify-codex-skill' 'skipped' }

        Write-Info "Optional: [features] multi_agent = true in $CodexHome\config.toml enables graphify parallel extraction."
        if ($EnableCodexMultiAgent -and (Confirm-Step "Add multi_agent = true under [features] in $CodexHome\config.toml?")) {
            $cfg = Join-Path $CodexHome 'config.toml'
            $content = if (Test-Path $cfg) { Get-Content $cfg -Raw } else { '' }
            if ($content -notmatch '(?m)^\[features\][ \t]*\r?$') { Add-Content $cfg "`n[features]`nmulti_agent = true`n" }
            elseif ($content -notmatch '(?m)^\s*multi_agent\s*=') { $content = $content -replace '(?m)^\[features\][ \t]*\r?$', "[features]`nmulti_agent = true"; Set-Content $cfg $content -NoNewline }
            Add-Action 'codex-multi-agent' 'enabled'
        } else { Add-Action 'codex-multi-agent' 'skipped' }
    }
}

# --- Optional gateways (installed but NEVER activated) --------------------------
foreach ($gw in @(
    @{ Flag = $InstallOmniroute; Id = 'omniroute'; Package = 'omniroute'; Note = 'Upstream: cheaper-inference/OmniRoute. The ChrisCompton/omniroute fork is stale (v3.6.1, Apr 2026). Install only; never start or wire into Codex config here.' },
    @{ Flag = $InstallClaudeCodeRouter; Id = 'claude-code-router'; Package = '@musistudio/claude-code-router'; Note = 'v3.x gateway on 127.0.0.1:3456. Install only; never apply a Codex profile as system default here.' }
)) {
    Write-Step "Optional gateway: $($gw.Id)"
    Write-Info $gw.Note
    if (-not $gw.Flag) { Write-Info 'Not requested (flag absent). Skipped.'; Add-Action $gw.Id 'not-requested'; continue }
    if (-not (Get-CommandPath 'npm')) { Write-Warn2 'npm missing; cannot install.'; Add-Action $gw.Id 'blocked-no-npm'; continue }
    if (Confirm-Step "Run 'npm install -g $($gw.Package)' (package only; no config changes, no service start)?") {
        Invoke-Logged 'npm' @('install', '-g', $gw.Package) "npm install $($gw.Package)"
        Add-Action $gw.Id 'installed-inactive'
        Write-Info "Installed inactive. Activation/config is a separate, manual decision  -  see docs/repassa/MODEL_ROUTING.md."
    } else { Add-Action $gw.Id 'skipped' }
}

# --- Manifest + summary ---------------------------------------------------------
Write-Step 'Summary'
foreach ($a in $script:Actions) { Write-Info ("{0,-24} {1}" -f $a.id, $a.status) }
if ($script:Failures) { foreach ($f in $script:Failures) { Write-Fail $f } }
if (-not $DryRun) {
    New-Item -ItemType Directory -Path $ToolsRoot -Force | Out-Null
    $manifest = @{ version = 1; updatedAt = (Get-Date).ToString('o'); codexHome = $CodexHome; backupDir = $BackupDir; actions = $script:Actions }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content $StateFile -Encoding UTF8
    Write-Info "Manifest written to $StateFile"
}
Write-Info 'Done. Verify with Test-RePassaTools.ps1; revert with Restore-RePassaTools.ps1.'
if ($script:Failures) { exit 1 }
