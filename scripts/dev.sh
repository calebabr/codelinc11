#!/usr/bin/env bash
# One-command local run: backend on 8000, frontend on 5173.
# Creates the backend venv and installs dependencies if missing, builds the demo
# database if missing. Never prints .env. Stop with Ctrl+C.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -x "$ROOT/backend/.venv/Scripts/python" ]; then PY="$ROOT/backend/.venv/Scripts/python"
else PY="$ROOT/backend/.venv/bin/python"; fi

if [ ! -x "$PY" ]; then
  echo "Creating backend virtual environment..."
  python3 -m venv "$ROOT/backend/.venv" 2>/dev/null || python -m venv "$ROOT/backend/.venv"
  if [ -x "$ROOT/backend/.venv/Scripts/python" ]; then PY="$ROOT/backend/.venv/Scripts/python"
  else PY="$ROOT/backend/.venv/bin/python"; fi
  "$PY" -m pip install -q -r "$ROOT/backend/requirements.txt"
fi

if [ ! -f "$ROOT/database/benefits.db" ]; then
  echo "Building the demo database..."
  (cd "$ROOT/backend" && "$PY" -m app.db --reset)
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend packages..."
  (cd "$ROOT/frontend" && npm ci)
fi

(cd "$ROOT/backend" && "$PY" -m uvicorn app.main:app --port 8000) &
BACK=$!
(cd "$ROOT/frontend" && npm run dev) &
FRONT=$!
trap 'kill $BACK $FRONT 2>/dev/null || true' EXIT INT TERM

echo
echo "Backend:  http://localhost:8000  (API docs at /docs)"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both."
wait
