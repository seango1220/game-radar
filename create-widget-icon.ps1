$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot "game-radar-widget-icon-v3.ico"
$preview = Join-Path $PSScriptRoot "game-radar-widget-icon-v3.png"
$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

function New-Brush($hex) {
  New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function Add-RoundRect($x, $y, $w, $h, $r, $brush) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.FillPath($brush, $path)
  $path.Dispose()
}

Add-RoundRect 0 0 256 256 48 (New-Brush "#111318")
Add-RoundRect 38 22 180 212 22 (New-Brush "#d7e0df")
Add-RoundRect 62 44 132 82 8 (New-Brush "#1b2527")
Add-RoundRect 74 56 108 58 4 (New-Brush "#7fd6c2")

$dark = New-Brush "#111318"
$g.FillRectangle($dark, 64, 166, 70, 22)
$g.FillRectangle($dark, 88, 142, 22, 70)
$g.FillEllipse((New-Brush "#ffbf69"), 142, 148, 44, 44)
$g.FillEllipse((New-Brush "#ff4d6d"), 172, 180, 44, 44)
Add-RoundRect 92 214 72 7 4 (New-Brush "#586365")

$bmp.Save($preview, [System.Drawing.Imaging.ImageFormat]::Png)

$pngStream = New-Object System.IO.MemoryStream
$bmp.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $pngStream.ToArray()
$pngStream.Dispose()

$fs = [System.IO.File]::Create($out)
$writer = New-Object System.IO.BinaryWriter($fs)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]1)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]32)
$writer.Write([UInt32]$pngBytes.Length)
$writer.Write([UInt32]22)
$writer.Write($pngBytes)
$writer.Close()
$fs.Close()
$g.Dispose()
$bmp.Dispose()

Write-Host "Created $out"
Write-Host "Preview $preview"
