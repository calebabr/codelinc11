#!/bin/bash
# Run by systemd (ExecStartPre, as root via "+") before the API starts.
# Writes /run/dental/secrets.env (mode 600, owned by the service user). Never prints values.
set -u
install -d -m 750 -o dental -g dental /run/dental
out=/run/dental/secrets.env
( umask 077; : > "$out" )
echo "SESSION_SECRET=$(cat /etc/dental/session_secret)" >> "$out"
region="${AWS_REGION:-us-east-1}"
key=$(aws ssm get-parameter --region "$region" --name /dental/ANTHROPIC_API_KEY \
        --with-decryption --query Parameter.Value --output text 2>/dev/null || true)
if [ -n "$key" ] && [ "$key" != "None" ]; then
  echo "ANTHROPIC_API_KEY=$key" >> "$out"
else
  echo "dental-fetch-secrets: no /dental/ANTHROPIC_API_KEY yet; chat will report unavailable" >&2
fi
chown dental:dental "$out"
chmod 600 "$out"
exit 0
