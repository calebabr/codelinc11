#!/bin/bash
# Update the backend on the instance to the latest commit of its branch, through SSM (no SSH).
# Usage: infra/aws/deploy-backend.sh <instance-id> [region]
set -euo pipefail
INSTANCE_ID="${1:?usage: deploy-backend.sh <instance-id> [region]}"
REGION="${2:-${AWS_REGION:-us-east-1}}"

CMD='set -e; cd /opt/dental; git fetch origin; git reset --hard origin/$(git rev-parse --abbrev-ref HEAD); backend/.venv/bin/pip install --no-cache-dir -r backend/requirements.txt; cp infra/aws/nginx.conf /etc/nginx/conf.d/dental.conf; cp infra/aws/dental-api.service /etc/systemd/system/dental-api.service; cp infra/aws/fetch-secrets.sh /usr/local/bin/dental-fetch-secrets; chmod 755 /usr/local/bin/dental-fetch-secrets; chown -R dental:dental backend; nginx -t; systemctl daemon-reload; systemctl restart dental-api; systemctl reload nginx; sleep 3; curl -fsS http://127.0.0.1:8000/health'

ID=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript --parameters "commands=[\"$CMD\"]" \
  --query Command.CommandId --output text)
echo "Command $ID sent. Waiting..."
aws ssm wait command-executed --region "$REGION" --command-id "$ID" --instance-id "$INSTANCE_ID" || true
aws ssm get-command-invocation --region "$REGION" --command-id "$ID" --instance-id "$INSTANCE_ID" \
  --query '{Status:Status,Output:StandardOutputContent,Errors:StandardErrorContent}' --output json
