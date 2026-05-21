$ErrorActionPreference = "Stop"

$appDir = $PSScriptRoot
$url = "http://localhost:4173/?v=11"
$edge = "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe"
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"

function Test-Server {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-Server)) {
  Start-Process -FilePath node `
    -ArgumentList "server.js" `
    -WorkingDirectory $appDir `
    -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

if (Test-Path -LiteralPath $edge) {
  Start-Process -FilePath $edge -ArgumentList "--app=$url", "--window-size=430,720"
  exit
}

if (Test-Path -LiteralPath $chrome) {
  Start-Process -FilePath $chrome -ArgumentList "--app=$url", "--window-size=430,720"
  exit
}

Start-Process $url
