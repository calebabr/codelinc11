# Build the frontend for AWS and publish it.
# Usage: infra\aws\deploy-frontend.ps1 -Bucket <bucket> -DistributionId <id>
param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [Parameter(Mandatory = $true)][string]$DistributionId
)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Push-Location (Join-Path $root "frontend")
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
  $env:VITE_API_URL = "/api"
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "build failed" }
} finally {
  Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
  Pop-Location
}

aws s3 sync (Join-Path $root "frontend\dist") "s3://$Bucket" --delete
if ($LASTEXITCODE -ne 0) { throw "s3 sync failed" }
aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --query Invalidation.Id --output text
