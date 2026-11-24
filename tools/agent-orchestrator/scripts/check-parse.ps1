$errs = $null
$fail = 0
Get-ChildItem (Join-Path $PSScriptRoot '*.ps1') | ForEach-Object {
  $e = $null
  [void][System.Management.Automation.PSParser]::Tokenize((Get-Content $_.FullName -Raw), [ref]$e)
  Write-Output ("{0}: {1} parse errors" -f $_.Name, $e.Count)
  if ($e.Count -gt 0) { $e | ForEach-Object { Write-Output ("   line {0}: {1}" -f $_.Token.StartLine, $_.Message) }; $fail = 1 }
}
exit $fail
