$ErrorActionPreference = "Stop"

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Game Radar.url"
$startup = [Environment]::GetFolderPath("Startup")
$startupScript = Join-Path $startup "Game Radar Server.cmd"

if (Test-Path -LiteralPath $startupScript) {
  Remove-Item -LiteralPath $startupScript
}

if (Test-Path -LiteralPath $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath
}

Write-Host "Uninstalled Game Radar local startup script and desktop shortcut."
