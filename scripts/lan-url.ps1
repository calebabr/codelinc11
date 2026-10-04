<#
 Print this computer's Wi-Fi/LAN address, the URL a phone should open (Mode A in docs/DEMO-PHONES.md),
 and write the QR code (qr-demo.png / qr-demo.svg) if Python and the qrcode package are available.
 Usage: .\scripts\lan-url.ps1 [-Port 5173]
#>
param([int]$Port = 5173)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# Prefer the adapter that has the default route (the one actually on Wi-Fi/Ethernet).
$ip = $null
try {
  $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Sort-Object RouteMetric | Select-Object -First 1
  if ($route) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex |
           Where-Object { $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
  }
} catch { }
if (-not $ip) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 |
         Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1" } |
         Select-Object -First 1).IPAddress
}
if (-not $ip) { Write-Host "Could not find a LAN address. Are you on Wi-Fi?"; exit 1 }

$url = "http://${ip}:${Port}/welcome"
Write-Host "Laptop LAN address: $ip"
Write-Host "Open on the phone:  $url"
Write-Host 'Start the app with: $env:VITE_API_URL="/api"; npm run dev:lan   (in frontend/), backend on port 8000'
Write-Host "This is plain HTTP: the phone microphone will not work in this mode."
Write-Host ""

$py = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $cmd = Get-Command python -ErrorAction SilentlyContinue; if ($cmd) { $py = $cmd.Source } else { $py = $null } }
if ($py) { & $py (Join-Path $root "scripts\make_qr.py") $url --out-dir $root }
else { Write-Host "Python not found, so no QR was made. Type the address above into the phone." }
