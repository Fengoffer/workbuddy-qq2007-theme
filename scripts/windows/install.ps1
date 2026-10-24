# WorkBuddy QQ 2007 Theme - Windows Installer (Windows 10/11, PowerShell 5.1+)
# 仅修改 WorkBuddy 安装目录 resources 下的主题资源，不触碰用户数据。
[CmdletBinding()]
param(
  [string]$AppPath = "",
  [switch]$Force,
  [switch]$NoLaunch,
  [switch]$Kill
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$ThemeDir = Join-Path $RepoDir "theme"

function Fail($msg) { Write-Host "✖ $msg" -ForegroundColor Red; exit 1 }

function Find-WorkBuddy {
  if ($AppPath) {
    if (Test-Path $AppPath) { return (Resolve-Path $AppPath).Path }
    Fail "指定的路径不存在: $AppPath"
  }
  $roots = @(
    (Join-Path $env:LOCALAPPDATA "Programs"),
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)},
    $env:LOCALAPPDATA
  ) | Where-Object { $_ -and (Test-Path $_) }
  foreach ($root in $roots) {
    $candidates = @(
      (Join-Path $root "WorkBuddy"),
      (Join-Path $root "workbuddy"),
      (Join-Path $root "WorkBuddy\resources")
    )
    foreach ($c in $candidates) {
      if (Test-Path (Join-Path $c "resources\app.asar")) { return (Resolve-Path $c).Path }
      if (Test-Path (Join-Path $c "app.asar")) { return (Resolve-Path $c).Path }
    }
    # 最多向下找 3 层，兼容 app-<version> 目录
    $found = Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $p = Join-Path $_.FullName "resources\app.asar"
      if (Test-Path $p) { return $_.FullName }
    } | Select-Object -First 1
    if ($found) { return (Resolve-Path $found).Path }
  }
  # 注册表兜底
  $regPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($rp in $regPaths) {
    $apps = Get-ItemProperty $rp -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match "WorkBuddy" }
    foreach ($app in $apps) {
      if ($app.InstallLocation -and (Test-Path (Join-Path $app.InstallLocation "resources\app.asar"))) {
        return $app.InstallLocation
      }
    }
  }
  Fail "找不到 WorkBuddy 安装目录。请用 -AppPath 指定（例如：-AppPath ""C:\Users\你\AppData\Local\Programs\WorkBuddy""）。"
}

function Read-IndexSize($asar) {
  $fs = [IO.File]::OpenRead($asar)
  try {
    $br = New-Object IO.BinaryReader($fs)
    $fs.Position = 12
    $headerSize = $br.ReadUInt32()
    $fs.Position = 16
    $jsonBytes = $br.ReadBytes([int]$headerSize)
    $json = [Text.Encoding]::UTF8.GetString($jsonBytes)
    $header = $json | ConvertFrom-Json
    return [int]$header.files.renderer.'index.html'.size
  } finally { $fs.Dispose() }
}

function Fit-Index($text, $target, $assetsRel) {
  $link = [regex]'[ \t]*<link[^>]*qq2008-skin\.css[^>]*>\r?\n?'
  $script = [regex]'[ \t]*<script[^>]*qq2008-notify\.js[^>]*>\s*</script>\r?\n?'
  $pad = [regex]'<!--QQ2007-THEME-PAD[\s\S]*?-->'
  $text = $link.Replace($text, '')
  $text = $script.Replace($text, '')
  $text = $pad.Replace($text, '')
  if ($text -notmatch '<div id="root"></div>') { throw "index.html 自检失败：缺少 #root" }
  if ($text -notmatch '</head>') { throw "index.html 中找不到 </head>" }

  $block = '  <link rel="stylesheet" href="' + $assetsRel + 'qq2008-skin.css">' + "`r`n" + '  <script defer src="' + $assetsRel + 'qq2008-notify.js"></script>' + "`r`n"
  $text = $text.Replace('</head>', $block + '</head>')

  $utf8 = New-Object Text.UTF8Encoding($false)
  $bytes = $utf8.GetBytes($text)
  $delta = $bytes.Length - $target
  if ($delta -gt 0) {
    $matches = [regex]::Matches($text, '<!--[\s\S]*?-->') | Sort-Object { $_.Length }
    $done = $false
    foreach ($m in $matches) {
      if ($m.Length -ge ($delta + 7)) {
        $replacement = '<!--' + (' ' * ($m.Length - $delta - 7)) + '-->'
        $text = $text.Substring(0, $m.Index) + $replacement + $text.Substring($m.Index + $m.Length)
        $done = $true
        break
      }
    }
    if (-not $done) { throw "需要缩减 $delta 字节，但找不到可压缩注释" }
  } elseif ($delta -lt 0) {
    $need = -$delta
    $prefix = '<!--QQ2007-THEME-PAD '
    $suffix = '-->'
    if ($need -lt ($prefix.Length + $suffix.Length)) { throw "需要填充 $need 字节，数值过小" }
    $padding = $prefix + (' ' * ($need - $prefix.Length - $suffix.Length)) + $suffix
    $text = $text.Replace('</head>', $padding + '</head>')
  }
  $bytes = $utf8.GetBytes($text)
  if ($bytes.Length -ne $target) { throw "字节数对齐失败：$($bytes.Length) != $target" }
  if ($text -notmatch '<div id="root"></div>') { throw "注入后 #root 丢失" }
  return $bytes
}

# ---------- main ----------
$app = Find-WorkBuddy
$resources = Join-Path $app "resources"
$asar = Join-Path $resources "app.asar"
if (-not (Test-Path $asar)) { $asar = Join-Path $app "app.asar"; $resources = $app }
$unpackedRenderer = Join-Path $resources "app.asar.unpacked\renderer"
$index = Join-Path $unpackedRenderer "index.html"
if (-not (Test-Path $index)) {
  Fail "当前 WorkBuddy 不是 unpacked renderer 结构，无法安全注入。安装器不会修改 app.asar，已停止，未做任何更改。"
}
$exe = Get-ChildItem -Path $app -Filter "WorkBuddy.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$version = if ($exe) { $exe.VersionInfo.ProductVersion } else { "unknown" }
Write-Host "WorkBuddy: $app"
Write-Host "版本: $version"

if ($version -notmatch '^5\.8\.3' -and -not $Force) {
  Fail "本主题主要在 WorkBuddy 5.8.3 上验证。确认继续请加 -Force。"
}

$proc = Get-Process -Name "WorkBuddy" -ErrorAction SilentlyContinue
if ($proc) {
  Write-Host "正在请求关闭 WorkBuddy ..."
  $proc | ForEach-Object { $_.CloseMainWindow() | Out-Null }
  Start-Sleep -Seconds 4
  $proc = Get-Process -Name "WorkBuddy" -ErrorAction SilentlyContinue
  if ($proc) {
    if ($Kill) { $proc | Stop-Process -Force; Start-Sleep -Seconds 2 }
    else { Fail "WorkBuddy 仍在运行。请先完全退出，或加 -Kill（会强制关闭，请自行确认没有未保存任务）。" }
  }
}

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $env:USERPROFILE "WorkBuddy\QQ2007ThemeBackups"
$backup = Join-Path $backupRoot $ts
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item $asar (Join-Path $backup "app.asar")
Copy-Item $index (Join-Path $backup "index.html")
$target = Read-IndexSize $asar
if ($target -le 0) { Fail "无法读取 asar 中的 index.html 大小" }
$meta = [ordered]@{
  app = $app; version = $version; createdAt = (Get-Date).ToUniversalTime().ToString("o")
  indexTargetSize = $target
  asarSha256 = (Get-FileHash $asar -Algorithm SHA256).Hash
  indexSha256 = (Get-FileHash $index -Algorithm SHA256).Hash
  themeVersion = "1.3.15"
}
$meta | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $backup "metadata.json")
Write-Host "备份目录: $backup"

$assets = Join-Path $unpackedRenderer "assets"
New-Item -ItemType Directory -Force -Path (Join-Path $assets "qq7pet") | Out-Null
$files = @("qq2008-skin.css","qq2008-583-adapter.css","qq2007-chrome.css","qq2007-chrome.js","qq2008-notify.js",
           "qq-penguin-user.png","qq7-icons.png","qq7-penguin.png","qq7-show.png","qq7-skin-shirt.png","qq-message.wav","qq-failure.wav")
$copied = @()
try {
  foreach ($f in $files) {
    Copy-Item (Join-Path $ThemeDir $f) (Join-Path $assets $f) -Force
    $copied += $f
  }
  Copy-Item (Join-Path $ThemeDir "qq7pet\*") (Join-Path $assets "qq7pet") -Recurse -Force
  $text = [IO.File]::ReadAllText($index, (New-Object Text.UTF8Encoding($false)))
  $bytes = Fit-Index $text $target "../../app.asar.unpacked/renderer/assets/"
  $tmp = "$index.qq7tmp"
  [IO.File]::WriteAllBytes($tmp, $bytes)
  Move-Item $tmp $index -Force
} catch {
  Write-Host "安装失败：$_" -ForegroundColor Red
  Copy-Item (Join-Path $backup "index.html") $index -Force
  foreach ($f in $copied) { Remove-Item (Join-Path $assets $f) -Force -ErrorAction SilentlyContinue }
  Remove-Item (Join-Path $assets "qq7pet") -Recurse -Force -ErrorAction SilentlyContinue
  Fail "已回滚 index.html。备份保留在: $backup"
}

if ((Get-Item $index).Length -ne $target) { Fail "index.html 大小校验失败" }
Write-Host "✅ 安装完成。"
Write-Host "回滚命令: powershell -ExecutionPolicy Bypass -File ""$ScriptDir\uninstall.ps1"" -AppPath ""$app"""
if (-not $NoLaunch -and $exe) { Start-Process $exe.FullName }
