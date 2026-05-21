$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$source = Join-Path $PSScriptRoot "game-radar-widget-icon-v3.png"
$sizes = @(192, 512)
$src = [System.Drawing.Image]::FromFile($source)

foreach ($size in $sizes) {
  $out = Join-Path $PSScriptRoot "icon-$size-v2.png"
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.DrawImage($src, 0, 0, $size, $size)
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Created $out"
}

$src.Dispose()
