param(
  [ValidateSet('status', 'check', 'apply', 'restore')]
  [string]$Mode = 'status',
  [string]$InstallDir = ''
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
if (-not $InstallDir) {
  $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\t3code'
  if (-not (Test-Path -LiteralPath (Join-Path $InstallDir 'resources\server.asar'))) {
    $InstallDir = Join-Path $env:USERPROFILE 'AppData\Local\Programs\t3code'
  }
}
$appExe = Join-Path $InstallDir 'T3 Code (Beta).exe'
$patchScript = Join-Path $PSScriptRoot 'patch.mjs'
$previousRunAsNode = $env:ELECTRON_RUN_AS_NODE
try {
  if (Test-Path -LiteralPath $appExe) {
    # The official .t3/bin/t3.cmd uses this same bundled Node runtime.
    $env:ELECTRON_RUN_AS_NODE = '1'
    & $appExe $patchScript $Mode $InstallDir | Out-Host
  } else {
    $runtime = Get-Command node.exe -ErrorAction Stop
    & $runtime.Source $patchScript $Mode $InstallDir | Out-Host
  }
  $result = $LASTEXITCODE
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  $result = 1
} finally {
  $env:ELECTRON_RUN_AS_NODE = $previousRunAsNode
}
exit $result
