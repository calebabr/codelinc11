# backend/

FastAPI service for the Dental Benefits Copilot.

| Path | What it holds |
|---|---|
| `app/engine/` | The money engine. All dollar math lives here and nowhere else |
| `app/agent/` | Chat tool loop, number guard, model providers |
| `app/rag/` | Procedure and plan-document search |
| `app/db/` | SQLite access layer (schema lives in `../database/`) |
| `app/routers/` | API routes; `app/main.py` wires the app; `app/models.py` is the API contract |
| `data/` | Plan, fee and procedure JSON (synthetic) |
| `fixtures/` | Sample inputs for tests and demos |
| `tests/` | pytest suites, including the golden-number tests |

Run and test (from this folder):

```
.venv/Scripts/python -m uvicorn app.main:app --port 8000
.venv/Scripts/python -m pytest -q
```

Keys go in `backend/.env` (never committed). See [../docs/SETUP.md](../docs/SETUP.md) and [../docs/BACKEND.md](../docs/BACKEND.md).
