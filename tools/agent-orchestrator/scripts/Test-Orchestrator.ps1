#Requires -Version 5.1
<#
.SYNOPSIS
  Verifies the local orchestrator installation (run on the Windows machine).

.DESCRIPTION
  Checks: node version, build output, user config JSON, Codex registration,
  live stdio MCP handshake (initialize + tools/list), gateway reachability and
  OMNIROUTE_API_KEY presence. Exits nonzero on failure.
#>
[CmdletBinding()]
param(
  [string]$RepoRoot,
  [switch]$Deep   # also run the repo test suite (npm test)
)

$ErrorActionPreference = 'Stop'
$toolDir  = Split-Path -Parent $PSScriptRoot
if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $toolDir '..\..')).Path }
$stateDir  = Join-Path $env:LOCALAPPDATA 'RepassaOrchestrator'
$configDest= Join-Path $stateDir 'orchestrator.config.json'
$codexCfg  = Join-Path $env:USERPROFILE '.codex\config.toml'
$entryJs   = Join-Path $toolDir 'dist\index.js'
$serverName= 'repassa-orchestrator'
$script:fail = 0
function Check($ok, $okMsg, $badMsg) {
  if ($ok) { Write-Host "  OK   $okMsg" -ForegroundColor Green }
  else    { Write-Host "  FAIL $badMsg" -ForegroundColor Red; $script:fail++ }
}

Write-Host "== Files and prerequisites =="
$node = Get-Command node -ErrorAction SilentlyContinue
Check ($null -ne $node) "node $($node.Source)" "node missing"
Check (Test-Path $entryJs) "dist\index.js present" "run Install-Orchestrator.ps1 first"
Check (Test-Path $configDest) "user config present" "orchestrator.config.json missing in $stateDir"
if (Test-Path $configDest) {
  try { $null = Get-Content $configDest -Raw | ConvertFrom-Json; Write-Host "  OK   config parses" }
  catch { Check $false "" "config JSON invalid: $($_.Exception.Message)" }
}

Write-Host "== Codex registration =="
if (Test-Path $codexCfg) {
  $toml = Get-Content $codexCfg -Raw
  Check ($toml -match "(?m)^\[mcp_servers\.$([regex]::Escape($serverName))\]") "section registered" "[mcp_servers.$serverName] missing from config.toml - run Install-Orchestrator.ps1"
  Check ($toml -notmatch '(?m)^\[mcp_servers\.omniroute\]') "no conflicting omniroute MCP entry" "found [mcp_servers.omniroute] - remove stale duplicate registrations"
} else { Check $false "" "$codexCfg not found" }

Write-Host "== Live stdio handshake =="
$probe = @'
const { spawn } = require("child_process");
const entry = process.argv[2];
const cfg = process.argv[3];
const p = spawn("node", [entry], { env: { ...process.env, ORCHESTRATOR_CONFIG: cfg }, stdio: ["pipe","pipe","pipe"] });
let buf = "";
const send = (method, params, id) => p.stdin.write(JSON.stringify(id===undefined?{jsonrpc:"2.0",method,params}:{jsonrpc:"2.0",id,method,params})+"\n");
p.stdout.on("data",(d)=>{ buf+=d.toString();
  let n; while((n=buf.indexOf("\n"))>=0){ const line=buf.slice(0,n).trim(); buf=buf.slice(n+1); if(!line)continue;
    let m; try{m=JSON.parse(line)}catch{continue}
    if(m.id===1){ send("notifications/initialized",{}); send("tools/list",{},2); }
    if(m.id===2){ const names=(m.result&&m.result.tools||[]).map(t=>t.name);
      console.log("TOOLS:"+names.join(",")); p.kill(); process.exit(names.length?0:1); } } });
send("initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"ps-probe",version:"1"}},1);
setTimeout(()=>{ console.log("TIMEOUT"); p.kill(); process.exit(1); }, 15000);
'@
$probeFile = Join-Path $env:TEMP 'orch-probe.js'
Set-Content -Path $probeFile -Value $probe -Encoding ASCII
$out = node $probeFile $entryJs $configDest 2>$null
Check ($out -match 'TOOLS:') "server answered tools/list" "no response from stdio server (check stderr manually)"
if ($out -match 'TOOLS:(.+)') {
  $names = $Matches[1] -split ','
  foreach ($t in 'list_models','delegate_task','delegate_parallel','review_proposal','get_task_result','orchestrator_health','delegate_worktree_task') {
    Check ($names -contains $t) "tool $t" "tool $t missing"
  }
}

Write-Host "== Gateway and key =="
if (Test-Path $configDest) {
  $cfg = Get-Content $configDest -Raw | ConvertFrom-Json
  if ($cfg.gateway.type -eq 'mock') {
    Write-Host "  OK   gateway type 'mock' - no real gateway or API key required"
  }
  else {
    $envName = $cfg.gateway.apiKeyEnv
    if (-not $envName) { $envName = 'OMNIROUTE_API_KEY' }
    $keyVal = [Environment]::GetEnvironmentVariable($envName,'User')
    if (-not $keyVal) { $keyVal = [Environment]::GetEnvironmentVariable($envName,'Machine') }
    if (-not $keyVal) { $keyVal = [Environment]::GetEnvironmentVariable($envName,'Process') }
    Check ([bool]$keyVal) "$envName present" "$envName not set (required when gateway type is openai-compatible)"
    try {
      $u = [uri]$cfg.gateway.baseUrl
      $tcp = Test-NetConnection -ComputerName $u.Host -Port $u.Port -WarningAction SilentlyContinue
      Check $tcp.TcpTestSucceeded "gateway port $($u.Host):$($u.Port) reachable" "gateway not listening at $($u.Host):$($u.Port) - is OmniRoute running?"
    } catch { Check $false "" "cannot parse gateway baseUrl" }
  }
}

if ($Deep) {
  Write-Host "== Repo test suite (npm test) =="
  Push-Location $toolDir
  try { npm test } finally { Pop-Location }
}
Write-Host ""
if ($script:fail -eq 0) { Write-Host "All checks passed. Restart Codex Desktop and ask Astra to 'list orchestrator models'." -ForegroundColor Green; exit 0 }
Write-Host "$($script:fail) check(s) failed." -ForegroundColor Red; exit 1
