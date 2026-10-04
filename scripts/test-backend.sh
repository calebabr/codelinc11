#!/usr/bin/env bash
# Run the backend tests by group.
#   scripts/test-backend.sh [all|fast|coverage|<marker> ...] [extra pytest args]
# Groups: all (everything), fast (not slow), coverage (all + coverage report),
# or any marker: unit api contract regression agent db slow  (e.g. "api", or "api and not slow").
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -x "$ROOT/backend/.venv/Scripts/python" ]; then PY="$ROOT/backend/.venv/Scripts/python"
elif [ -x "$ROOT/backend/.venv/bin/python" ]; then PY="$ROOT/backend/.venv/bin/python"
else PY="python"; fi
GROUP="${1:-all}"; [ $# -gt 0 ] && shift
export ASSISTANT_PROVIDER="${ASSISTANT_PROVIDER:-none}"
cd "$ROOT/backend"
case "$GROUP" in
  all)      "$PY" -m pytest "$@" ;;
  fast)     "$PY" -m pytest -m "not slow" "$@" ;;
  coverage) "$PY" -m pytest --cov=app --cov-report=term-missing:skip-covered "$@" ;;
  *)        "$PY" -m pytest -m "$GROUP" "$@" ;;
esac
