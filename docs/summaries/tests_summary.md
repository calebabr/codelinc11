# Tests summary
_Updated 2026-10-03_

| Suite | Where | Count (run 2026-10-03) |
|---|---|---|
| Backend unit and API tests | `backend/tests/` (31 files) | 516 passed in about 3 minutes on 2026-10-03 (T1 run). Organized by markers (`unit` 76, `api` 334, `contract` 22, `regression` 14, `agent` 75, `db` 211, `slow` 13); run groups with `scripts/test-backend.ps1` or `.sh`; guide in `backend/tests/README.md`. Line coverage of `backend/app` 96% (engine 98%, routers 97%, agent 94%, db 92%; weakest: `db/__main__.py` 0%, `agent/ollama_client.py` 55%). `test_regressions.py` holds one test per fixed bug. Includes the Monte Carlo plan comparison, saved comparisons, demo sandboxes (`test_sandboxes.py`), rate limits (`test_ratelimit.py`), CORS (`test_cors.py`), and the contract and demo flow tests |
| Backend lint | `cd backend && .venv/Scripts/python -m ruff check --no-cache .` | clean |
| Frontend component tests | `frontend/src/` (next to each page and feature; 17 files) | 151 tests; on my full run 150 passed and 1 timed out under load (`SessionContext.test.tsx`, passes alone, 6 of 6) |
| Frontend types and build | `npm run typecheck`, `npm run build` | clean |
| End-to-end, contract, fixtures | `tests/e2e`, `tests/contract`, `tests/fixtures` | empty folders; the contract and demo flows are tested from `backend/tests/` and `frontend/src/routes.smoke.test.tsx` |

Golden numbers are checked in `backend/tests/test_engine.py`. Engine property tests use seeded random inputs (`test_engine_props.py`). Tests need no internet, Ollama or paid API. The test suite turns rate limits off (`RATE_LIMIT_ENABLED=0` in `conftest.py`); `test_ratelimit.py` turns them on. The CI workflow (`.github/workflows/ci.yml`) is written but has not run on GitHub.
