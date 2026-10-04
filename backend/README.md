# backend/

FastAPI service for Molar Money, the dental benefits copilot.

| Path | What it holds |
|---|---|
| `app/engine/` | The money engine. All dollar math lives here and nowhere else |
| `app/agent/` | Chat tool loop, number guard, model providers |
| `app/rag/` | Placeholder (empty; no retrieval over plan documents yet) |
| `app/ratelimit.py` | In-memory rate limits (429 with `Retry-After`); settings in `.env.example` |
| `app/db/` | SQLite access layer and per-visitor demo families (`sandbox.py`); schema lives in `../database/` |
| `app/routers/` | API routes; `app/main.py` wires the app; `app/models.py` is the API contract |
| `data/` | Plan, fee and procedure JSON (synthetic) |
| `fixtures/` | Sample inputs for tests and demos |
| `tests/` | pytest suites (391 tests), including the golden-number tests |

Run and test (from this folder):

```
.venv/Scripts/python -m uvicorn app.main:app --port 8000
.venv/Scripts/python -m pytest -q
```

36 routes; the table is in [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md). Lint: `.venv/Scripts/python -m ruff check --no-cache .`

Keys go in `backend/.env` (never committed). See [../docs/SETUP.md](../docs/SETUP.md) and [../docs/BACKEND.md](../docs/BACKEND.md).
