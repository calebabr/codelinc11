#!/usr/bin/env bash
# Print this computer's Wi-Fi/LAN address, the URL a phone should open (Mode A in docs/DEMO-PHONES.md),
# and write the QR code (qr-demo.png / qr-demo.svg) if Python and the qrcode package are available.
# Usage: scripts/lan-url.sh [port]      (default port 5173)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-5173}"

IP=""
if command -v ipconfig >/dev/null 2>&1 && ! command -v ip >/dev/null 2>&1; then
  # Git Bash on Windows: first IPv4 that is not a link-local 169.254.x.x or a virtual 172.x adapter
  IP="$(ipconfig 2>/dev/null | tr -d '\r' | grep -i 'IPv4' | sed 's/.*: *//' | grep -v '^169\.254\.' | head -n1 || true)"
elif command -v ip >/dev/null 2>&1; then
  IP="$(ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n1 || true)"
elif command -v ipconfig >/dev/null 2>&1; then
  IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [ -z "$IP" ]; then echo "Could not find a LAN address. Are you on Wi-Fi?" >&2; exit 1; fi

URL="http://$IP:$PORT/welcome"
echo "Laptop LAN address: $IP"
echo "Open on the phone:  $URL"
echo "Start the app with: VITE_API_URL=/api npm run dev:lan   (in frontend/), backend on port 8000"
echo "This is plain HTTP: the phone microphone will not work in this mode."
echo

if [ -x "$ROOT/backend/.venv/Scripts/python" ]; then PY="$ROOT/backend/.venv/Scripts/python"
elif [ -x "$ROOT/backend/.venv/bin/python" ]; then PY="$ROOT/backend/.venv/bin/python"
else PY="$(command -v python3 || command -v python || true)"; fi
if [ -n "$PY" ]; then "$PY" "$ROOT/scripts/make_qr.py" "$URL" --out-dir "$ROOT" || true
else echo "Python not found, so no QR was made. Type the address above into the phone."; fi
