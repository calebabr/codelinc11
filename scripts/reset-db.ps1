# Delete and rebuild the demo database (database/benefits.db) from the seed data.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root 'backend\.venv\Scripts\python.exe'
Push-Location (Join-Path $root 'backend')
try { & $py -m app.db --reset; Write-Host 'Demo database rebuilt.' }
finally { Pop-Location }
