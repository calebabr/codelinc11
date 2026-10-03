# One-command local run: backend on 8000, frontend on 5173.
# Creates the backend venv and installs dependencies if missing, builds the demo
# database if missing. Never prints .env. Stop with Ctrl+C.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root 'backend\.venv\Scripts\python.exe'

if (-not (Test-Path $py)) {
    Write-Host 'Creating backend virtual environment...'
    python -m venv (Join-Path $root 'backend\.venv')
    & $py -m pip install -q -r (Join-Path $root 'backend\requirements.txt')
}

if (-not (Test-Path (Join-Path $root 'database\benefits.db'))) {
    Write-Host 'Building the demo database...'
    Push-Location (Join-Path $root 'backend'); & $py -m app.db --reset; Pop-Location
}

if (-not (Test-Path (Join-Path $root 'frontend\node_modules'))) {
    Write-Host 'Installing frontend packages...'
    Push-Location (Join-Path $root 'frontend'); npm ci; Pop-Location
}

$back = Start-Process -PassThru -NoNewWindow -WorkingDirectory (Join-Path $root 'backend') `
    -FilePath $py -ArgumentList '-m', 'uvicorn', 'app.main:app', '--port', '8000'
$front = Start-Process -PassThru -NoNewWindow -WorkingDirectory (Join-Path $root 'frontend') `
    -FilePath 'npm.cmd' -ArgumentList 'run', 'dev'

Write-Host ''
Write-Host 'Backend:  http://localhost:8000  (API docs at /docs)'
Write-Host 'Frontend: http://localhost:5173'
Write-Host 'Press Ctrl+C to stop both.'
try { Wait-Process -Id $back.Id, $front.Id }
finally {
    foreach ($p in $back, $front) {
        if ($p -and -not $p.HasExited) { taskkill /PID $p.Id /T /F | Out-Null }
    }
}
