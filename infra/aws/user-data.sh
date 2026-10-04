#!/bin/bash
# First-boot setup, run by the instance's user data from the cloned repo (/opt/dental).
# Installs Python, nginx and the backend; creates the systemd service. No secret values here.
set -euo pipefail

APP=/opt/dental
AWS_REGION="${AWS_REGION:?}"

dnf install -y python3.11 python3.11-pip nginx

python3.11 -m venv "$APP/backend/.venv"
"$APP/backend/.venv/bin/pip" install --no-cache-dir -r "$APP/backend/requirements.txt"

useradd --system --home-dir /var/lib/benefits --shell /sbin/nologin dental 2>/dev/null || true
install -d -o dental -g dental -m 750 /var/lib/benefits
install -d -o dental -g dental -m 750 "$APP/database"

# Non-secret settings
install -d -m 755 /etc/dental
cat > /etc/dental/dental.env <<ENV
AWS_REGION=${AWS_REGION}
BENEFITS_DB_PATH=/var/lib/benefits/benefits.db
ASSISTANT_PROVIDER=auto
ASSISTANT_ALLOW_ANONYMOUS=0
ENV
chmod 644 /etc/dental/dental.env

# SESSION_SECRET: generated once, kept on the volume (root-only file), never logged.
if [ ! -s /etc/dental/session_secret ]; then
  ( umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > /etc/dental/session_secret )
fi

cp "$APP/infra/aws/fetch-secrets.sh" /usr/local/bin/dental-fetch-secrets
chmod 755 /usr/local/bin/dental-fetch-secrets
cp "$APP/infra/aws/dental-api.service" /etc/systemd/system/dental-api.service
cp "$APP/infra/aws/nginx.conf" /etc/nginx/conf.d/dental.conf
# Disable the stock default server block so ours owns port 80.
python3.11 - <<'PY'
import re
p = "/etc/nginx/nginx.conf"
s = open(p).read()
i = s.find("server {")
if i != -1:
    depth, j = 0, i
    while j < len(s):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                s = s[:i] + s[j + 1:]
                break
        j += 1
    open(p, "w").write(s)
PY
chown -R dental:dental "$APP/backend"

nginx -t
systemctl daemon-reload
systemctl enable --now nginx
systemctl enable --now dental-api
