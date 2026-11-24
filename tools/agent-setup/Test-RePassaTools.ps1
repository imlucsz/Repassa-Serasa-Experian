# RePassa agent tooling verification (Windows).
# Read-only: prints PASS/WARN/FAIL per check and exits 1 on any FAIL.
# Never reads auth.json contents, secrets, or modifies configuration.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\agent-setup\Test-RePassaTools.ps1
[CmdletBinding()]
param([switch]$Quiet)
$script:Failures = 0
function Check([string]$Name, [scriptblock]$Probe) {
    try { $result = & $Probe }
    catch { $result = @{ Status = 'FAIL'; Detail = $_.Exception.Message } }
    $color = @{ PASS = 'Green'; WARN = 'Yellow'; FAIL = 'Red'; SKIP = 'DarkGray' }[$result.Status]
    if (-not $Quiet -or $result.Status -eq 'FAIL') { Write-Host ("[{0,-4}] {1,-34} {2}" -f $result.Status, $Name, $result.Detail) -ForegroundColor $color }
    if ($result.Status -eq 'FAIL') { $script:Failures++ }
}
function Get-CommandPath([string]$Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$ToolsRoot = Join-Path $env:LOCALAPPDATA 'RepassaTools'
$StateFile = Join-Path $ToolsRoot 'agent-setup-state.json'

Write-Host "Codex home: $CodexHome`n"

Check 'git' { $p = Get-CommandPath 'git'; if ($p) { @{ Status = 'PASS'; Detail = $p } } else { @{ Status = 'FAIL'; Detail = 'not on PATH' } } }
Check 'node' { $p = Get-CommandPath 'node'; if ($p) { @{ Status = 'PASS'; Detail = (& node --version) } } else { @{ Status = 'FAIL'; Detail = 'not on PATH' } } }
Check 'python' { $p = Get-CommandPath 'python'; if ($p) { @{ Status = 'PASS'; Detail = (& python --version 2>&1) } } else { @{ Status = 'WARN'; Detail = 'not on PATH (needed only for graphify)' } } }

Check 'codex CLI' {
    $p = Get-CommandPath 'codex'
    if (-not $p) {
        try {
            $pkg = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($pkg -and $pkg.InstallLocation) { $c = Join-Path $pkg.InstallLocation 'app\resources\codex.exe'; if (Test-Path $c) { $p = $c } }
        } catch { }
    }
    if (-not $p) {
        $p = (Get-ChildItem 'C:\Program Files\WindowsApps\OpenAI.Codex_*\app\resources\codex.exe' -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1).FullName
    }
    if ($p) { $v = (& $p --version 2>$null | Select-Object -First 1); @{ Status = 'PASS'; Detail = "$v ($p)" } }
    else { @{ Status = 'FAIL'; Detail = 'not found on PATH or in the Codex Desktop package' } }
}
Check 'codex auth present' {
    if (Test-Path (Join-Path $CodexHome 'auth.json')) { @{ Status = 'PASS'; Detail = 'auth.json exists (not inspected)' } }
    else { @{ Status = 'WARN'; Detail = 'auth.json missing; sign in to Codex first' } }
}

Check 'rtk binary' {
    $p = Get-CommandPath 'rtk'
    if (-not $p) { $p = (Get-ChildItem (Join-Path $ToolsRoot 'rtk') -Recurse -Filter rtk.exe -ErrorAction SilentlyContinue | Select-Object -First 1).FullName }
    if ($p) { $v = (& $p --version 2>$null | Select-Object -First 1); @{ Status = 'PASS'; Detail = "$v ($p)" } }
    else { @{ Status = 'FAIL'; Detail = 'not installed' } }
}
Check 'rtk gain runs' {
    $p = Get-CommandPath 'rtk'; if (-not $p) { $p = (Get-ChildItem (Join-Path $ToolsRoot 'rtk') -Recurse -Filter rtk.exe -ErrorAction SilentlyContinue | Select-Object -First 1).FullName }
    if (-not $p) { @{ Status = 'SKIP'; Detail = 'rtk missing' } }
    else { & $p gain *> $null; if ($LASTEXITCODE -eq 0) { @{ Status = 'PASS'; Detail = 'rtk gain OK (bytes/4 estimate)' } } else { @{ Status = 'WARN'; Detail = "rtk gain exit $LASTEXITCODE" } } }
}
Check 'codex hook (rtk)' {
    $hooks = Join-Path $CodexHome 'hooks.json'
    if ((Test-Path $hooks) -and ((Get-Content $hooks -Raw) -match 'rtk')) { @{ Status = 'PASS'; Detail = $hooks } }
    else { @{ Status = 'WARN'; Detail = "no rtk hook in $hooks (run installer or 'rtk init --global --codex')" } }
}
Check 'RTK.md (codex home)' {
    $p = Join-Path $CodexHome 'RTK.md'
    if (Test-Path $p) { @{ Status = 'PASS'; Detail = $p } } else { @{ Status = 'WARN'; Detail = 'absent' } }
}

Check 'uv' {
    $p = Get-CommandPath 'uv'
    if ($p) { @{ Status = 'PASS'; Detail = $p } } else { @{ Status = 'WARN'; Detail = 'not installed (needed only for graphify)' } }
}
Check 'graphify CLI' {
    $p = Get-CommandPath 'graphify'
    if ($p) { $v = (& $p --version 2>$null | Select-Object -First 1); @{ Status = 'PASS'; Detail = "$v" } }
    else { @{ Status = 'WARN'; Detail = 'not installed (optional)' } }
}
Check 'graphify codex skill' {
    $candidates = @((Join-Path $CodexHome 'skills\graphify'), (Join-Path $env:USERPROFILE '.agents\skills\graphify'), (Join-Path $env:USERPROFILE '.claude\skills\graphify'))
    $found = $candidates | Where-Object { Test-Path $_ }
    if ($found) { @{ Status = 'PASS'; Detail = ($found -join ', ') } }
    else { @{ Status = 'WARN'; Detail = 'not installed; `graphify install --platform codex`, invoke with $graphify' } }
}

Check 'ccusage (npx)' {
    if (-not (Get-CommandPath 'npx')) { @{ Status = 'SKIP'; Detail = 'npx missing' } }
    else {
        $out = & npx -y 'ccusage@latest' codex daily --last 1 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) { @{ Status = 'PASS'; Detail = 'codex report OK  -  local estimate, NOT quota balance' } }
        else { @{ Status = 'WARN'; Detail = 'ccusage ran but reported no/error output' } }
    }
}

Check 'omniroute (inactive)' {
    $p = Get-CommandPath 'omniroute'
    $listening = Get-NetTCPConnection -LocalPort 20128 -State Listen -ErrorAction SilentlyContinue
    if ($p -and -not $listening) { @{ Status = 'PASS'; Detail = "installed at $p, not listening (inactive)" } }
    elseif ($listening) { @{ Status = 'WARN'; Detail = 'port 20128 listening  -  gateway active; ensure it is intentional' } }
    else { @{ Status = 'SKIP'; Detail = 'not installed (optional)' } }
}
Check 'claude-code-router (inactive)' {
    $p = Get-CommandPath 'ccr'
    $listening = Get-NetTCPConnection -LocalPort 3456 -State Listen -ErrorAction SilentlyContinue
    if ($p -and -not $listening) { @{ Status = 'PASS'; Detail = "installed at $p, not listening (inactive)" } }
    elseif ($listening) { @{ Status = 'WARN'; Detail = 'port 3456 listening  -  gateway active; ensure it is intentional' } }
    else { @{ Status = 'SKIP'; Detail = 'not installed (optional)' } }
}

Check 'repassa repo guard' {
    $repo = (git rev-parse --show-toplevel 2>$null)
    if ($repo -and (Test-Path (Join-Path $repo 'scripts\agent-guard.mjs'))) {
        Push-Location $repo; & node scripts/agent-guard.mjs staged *> $null; $code = $LASTEXITCODE; Pop-Location
        if ($code -eq 0) { @{ Status = 'PASS'; Detail = "staged guard clean in $repo" } } else { @{ Status = 'WARN'; Detail = 'staged guard reported findings or nothing staged' } }
    } else { @{ Status = 'SKIP'; Detail = 'not inside the RePassa checkout' } }
}

if (Test-Path $StateFile) { Write-Host "`nManifest: $StateFile" }
Write-Host ''
if ($script:Failures -gt 0) { Write-Host "$script:Failures check(s) FAILED" -ForegroundColor Red; exit 1 }
Write-Host 'All checks passed or are optional (WARN/SKIP).' -ForegroundColor Green
