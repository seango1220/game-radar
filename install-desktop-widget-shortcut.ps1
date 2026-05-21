$ErrorActionPreference = "Stop"

$appDir = $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Game Radar Widget.lnk"
$target = "powershell.exe"
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$appDir\open-desktop-widget.ps1`""

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = $appDir
$shortcut.IconLocation = "$appDir\game-radar-widget-icon-v3.ico"
$shortcut.WindowStyle = 7
$shortcut.Save()

Write-Host "Created desktop widget shortcut:"
Write-Host $shortcutPath
