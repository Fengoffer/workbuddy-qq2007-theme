# WorkBuddy QQ 2007 Theme - Windows Uninstaller / Rollback
[CmdletBinding()]
param(
  [string]$AppPath = "",
  [string]$RestoreAsar = "",
  [switch]$Kill
)
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Fail($msg) { Write-Host "✖ $msg" -ForegroundColor Red; exit 1 }

$app = $AppPath
if (-not $app) {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\WorkBuddy"),
    (Join-Path $env:ProgramFiles "WorkBuddy"),
    $env:LOCALAPPDATA
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path (Join-Path $c "resources\app.asar"))) { $app = $c; break }
  }
}
if (-not $app) { Fail "找不到 WorkBuddy，请用 -AppPath 指定。" }

$resources = if (Test-Path (Join-Path $app "resources\app.asar")) { Join-Path $app "resources" } else { $app }
$asar = Join-Path $resources "app.asar"
$index = Join-Path $resources "app.asar.unpacked\renderer\index.html"

$proc = Get-Process -Name "WorkBuddy" -ErrorAction SilentlyContinue
if ($proc) {
  $proc | ForEach-Object { $_.CloseMainWindow() | Out-Null }
  Start-Sleep -Seconds 4
  $proc = Get-Process -Name "WorkBuddy" -ErrorAction SilentlyContinue
  if ($proc) {
    if ($Kill) { $proc | Stop-Process -Force; Start-Sleep -Seconds 2 }
    else { Fail "WorkBuddy 仍在运行，请先退出，或加 -Kill。" }
  }
}

if ($RestoreAsar) {
  $bak = Join-Path $RestoreAsar "app.asar"
  if (-not (Test-Path $bak)) { Fail "备份中找不到 app.asar: $bak" }
  Copy-Item $bak "$asar.restore-tmp" -Force
  Move-Item "$asar.restore-tmp" $asar -Force
  Write-Host "app.asar 已从备份恢复。"
}

if (Test-Path $index) {
  $fs = [IO.File]::OpenRead($asar)
  try {
    $br = New-Object IO.BinaryReader($fs)
    $fs.Position = 12; $hs = $br.ReadUInt32(); $fs.Position = 16
    $h = ([Text.Encoding]::UTF8.GetString($br.ReadBytes([int]$hs))) | ConvertFrom-Json
    $target = [int]$h.files.renderer.'index.html'.size
  } finally { $fs.Dispose() }
  $text = [IO.File]::ReadAllText($index, (New-Object Text.UTF8Encoding($false)))
  $text = ([regex]'[ \t]*<link[^>]*qq2008-skin\.css[^>]*>\r?\n?').Replace($text, '')
  $text = ([regex]'[ \t]*<script[^>]*qq2008-notify\.js[^>]*>\s*</script>\r?\n?').Replace($text, '')
  $text = ([regex]'<!--QQ2007-THEME-PAD[\s\S]*?-->').Replace($text, '')
  $bytes = [Text.Encoding]::UTF8.GetBytes($text)
  if ($bytes.Length -lt $target) {
    $need = $target - $bytes.Length
    $prefix = '<!--QQ2007-THEME-PAD '; $suffix = '-->'
    if ($need -ge ($prefix.Length + $suffix.Length)) {
      $pad = $prefix + (' ' * ($need - $prefix.Length - $suffix.Length)) + $suffix
      $text = $text.Replace('</head>', $pad + '</head>')
      $bytes = [Text.Encoding]::UTF8.GetBytes($text)
    }
  }
  [IO.File]::WriteAllBytes("$index.qq7tmp", $bytes)
  Move-Item "$index.qq7tmp" $index -Force
  Write-Host "index.html 已清理主题注入。"
}

$assets = Join-Path $resources "app.asar.unpacked\renderer\assets"
foreach ($f in @("qq2008-skin.css","qq2008-583-adapter.css","qq2007-chrome.css","qq2007-chrome.js","qq2008-notify.js",
                 "qq-penguin-user.png","qq7-icons.png","qq7-penguin.png","qq7-show.png","qq-message.wav","qq-failure.wav")) {
  Remove-Item (Join-Path $assets $f) -Force -ErrorAction SilentlyContinue
}
Remove-Item (Join-Path $assets "qq7pet") -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✅ 已卸载主题。重新打开 WorkBuddy 即恢复原版。"
