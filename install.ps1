param(
  [ValidateSet('status', 'check', 'apply', 'restore', 'upgrade')]
  [string]$Mode = 'apply',
  [string]$InstallDir = '',
  [string]$DataDir = ''
)

# Download the current tool; keep backups outside the temporary source folder.
$ErrorActionPreference = 'Stop'
if (-not $DataDir) { $DataDir = $env:T3ZH_DATA_DIR }
if (-not $DataDir) { $DataDir = Join-Path $env:USERPROFILE '.t3\localization\zh-CN' }
$previousDataDir = $env:T3ZH_DATA_DIR
$tempDir = Join-Path ([IO.Path]::GetTempPath()) ('t3code-zh-cn-' + [guid]::NewGuid().ToString('N'))
$result = 1
try {
  New-Item -ItemType Directory -Path $tempDir | Out-Null
  $zipPath = Join-Path $tempDir 'source.zip'
  Write-Host '正在下载最新汉化工具…'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/Codepql/t3code-zh-cn/archive/refs/heads/main.zip' -OutFile $zipPath
  Expand-Archive -LiteralPath $zipPath -DestinationPath $tempDir
  $runner = Join-Path $tempDir 't3code-zh-cn-main\run.ps1'
  if (-not (Test-Path -LiteralPath $runner)) { throw '下载内容中没有找到 run.ps1。' }
  $env:T3ZH_DATA_DIR = [IO.Path]::GetFullPath($DataDir)
  Write-Host ('备份和状态目录：' + $env:T3ZH_DATA_DIR)
  $runnerArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runner, $Mode)
  if ($InstallDir) { $runnerArgs += @('-InstallDir', $InstallDir) }
  & powershell.exe @runnerArgs
  $result = $LASTEXITCODE
} catch {
  Write-Host ('操作停止：' + $_.Exception.Message) -ForegroundColor Red
} finally {
  $env:T3ZH_DATA_DIR = $previousDataDir
  # Only remove the uniquely named temporary folder created by this invocation.
  $resolvedTemp = [IO.Path]::GetFullPath($tempDir)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
  if ($resolvedTemp.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
      [IO.Path]::GetFileName($resolvedTemp) -match '^t3code-zh-cn-[a-f0-9]{32}$' -and
      (Test-Path -LiteralPath $resolvedTemp)) {
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
  }
}
if ($result -ne 0) { throw "汉化工具执行失败（退出码 $result）。" }
