$ErrorActionPreference = 'Stop'
$root = & git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { throw 'Execute dentro do repositorio Git RePassa.' }
Push-Location $root
try {
    if (-not (Test-Path 'AGENTS.md') -or -not (Test-Path 'scripts/agent-guard.mjs')) { throw 'Kit nao encontrado.' }
    & node --version
    if ($LASTEXITCODE -ne 0) { throw 'Node nao encontrado.' }
    $current = & git config --get core.hooksPath
    if ($LASTEXITCODE -gt 1) { throw 'Erro lendo hooksPath.' }
    if ($current -and $current -ne '.githooks') { throw 'Ja existe hooksPath diferente. Integre manualmente; nada foi sobrescrito.' }
    & node --test scripts/agent-guard.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Testes do guard falharam; hooks nao ativados.' }
    & git config --local core.hooksPath .githooks
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel configurar hooks.' }
    Write-Host 'Hooks ativados neste clone:'
    & git config --local --get core.hooksPath
} finally { Pop-Location }
