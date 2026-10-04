# Run the backend tests by group.
#   scripts\test-backend.ps1 [all|fast|coverage|<marker>] [extra pytest args]
# Groups: all (everything), fast (not slow), coverage (all + coverage report),
# or any marker: unit api contract regression agent db slow  (e.g. "api", or "api and not slow").
param(
    [string]$Group = 'all',
    [Parameter(ValueFromRemainingArguments = $true)] [string[]]$Extra
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $py)) { $py = 'python' }
if (-not $env:ASSISTANT_PROVIDER) { $env:ASSISTANT_PROVIDER = 'none' }
Push-Location (Join-Path $root 'backend')
try {
    switch ($Group) {
        'all'      { & $py -m pytest @Extra }
        'fast'     { & $py -m pytest -m 'not slow' @Extra }
        'coverage' { & $py -m pytest --cov=app '--cov-report=term-missing:skip-covered' @Extra }
        default    { & $py -m pytest -m $Group @Extra }
    }
    exit $LASTEXITCODE
}
finally { Pop-Location }
