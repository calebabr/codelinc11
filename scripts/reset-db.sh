#!/usr/bin/env bash
# Delete and rebuild the demo database (database/benefits.db) from the seed data.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -x "$ROOT/backend/.venv/Scripts/python" ]; then PY="$ROOT/backend/.venv/Scripts/python"
else PY="$ROOT/backend/.venv/bin/python"; fi
cd "$ROOT/backend"
"$PY" -m app.db --reset
echo "Demo database rebuilt."
