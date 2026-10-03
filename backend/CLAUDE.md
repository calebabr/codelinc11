# Backend rules
@../docs/CONVENTIONS.md
@../docs/FEATURES.md

- Python 3.11, FastAPI, Pydantic v2. Run: `uvicorn app.main:app --reload`. Test: `pytest -q`. Lint: `ruff check .`
- Stay in your workstream's folders (docs/BACKEND.md table). Ask before touching others.
- models.py is the API contract: only workstream A changes it.
- NEVER compute dollar amounts outside app/engine/. NEVER edit tests/test_engine.py.
- You write the code AND the tests. Every new endpoint or tool needs a test. Run `pytest -q` before saying a task is done.
- Finish every task with a report: what changed, tests run and results, and exactly what your human should check (URL, request, expected number).
