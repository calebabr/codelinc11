# Tests summary
_Updated 2026-10-03_

| Suite | Where | Count (verified 2026-10-03) |
|---|---|---|
| Backend unit and API tests | `backend/tests/` | 148 passed (17 of them database) |
| Frontend component tests | `frontend/src/App.test.tsx` | 10 passed |
| End-to-end, contract, fixtures | `tests/e2e`, `tests/contract`, `tests/fixtures` | empty folders (T13) |

Golden numbers are checked in `backend/tests/test_engine.py`. Engine property tests use seeded random inputs (`test_engine_props.py`). Tests need no internet, Ollama or paid API. CI is not set up (T16).
