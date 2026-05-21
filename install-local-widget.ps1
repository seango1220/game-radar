$ErrorActionPreference = "Stop"

$appDir = $PSScriptRoot
$nodePath = (Get-Command node).Source
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Game Radar.url"
$startup = [Environment]::GetFolderPath("Startup")
$startupScript = Join-Path $startup "Game Radar Server.cmd"

@"
@echo off
cd /d "$appDir"
"$nodePath" server.js
"@ | Set-Content -LiteralPath $startupScript -Encoding ASCII

Start-Process -FilePath $nodePath `
  -ArgumentList "server.js" `
  -WorkingDirectory $appDir `
  -WindowStyle Hidden

@"
[InternetShortcut]
URL=http://localhost:4173/?v=9
IconFile=$appDir\game-radar-widget-icon-v3.ico
IconIndex=0
"@ | Set-Content -LiteralPath $shortcutPath -Encoding ASCII

Write-Host "Installed Game Radar."
Write-Host "Startup script: $startupScript"
Write-Host "Shortcut: $shortcutPath"
Write-Host "Open the Game Radar desktop shortcut whenever you want the widget."
