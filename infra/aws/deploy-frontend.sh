#!/bin/bash
# Build the frontend for AWS and publish it. Usage: infra/aws/deploy-frontend.sh <bucket> <distribution-id>
set -euo pipefail
BUCKET="${1:?usage: deploy-frontend.sh <bucket> <distribution-id>}"
DIST="${2:?usage: deploy-frontend.sh <bucket> <distribution-id>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

( cd "$ROOT/frontend" && npm ci && VITE_API_URL=/api npm run build )
aws s3 sync "$ROOT/frontend/dist/" "s3://$BUCKET" --delete
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" --query Invalidation.Id --output text
