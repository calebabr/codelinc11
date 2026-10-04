# Backend tests

All backend tests run with plain `pytest`: no server, no internet, no Ollama, no paid API key.
Rate limits are switched off for the suite by `conftest.py` (`test_ratelimit.py` turns them on).

## How to run each group

From the repo root (works from any folder):

| Group | PowerShell | bash | Same thing in `backend/` |
|---|---|---|---|
| Everything | `scripts\test-backend.ps1` | `scripts/test-backend.sh` | `pytest` |
| Fast (skips `slow`) | `scripts\test-backend.ps1 fast` | `scripts/test-backend.sh fast` | `pytest -m "not slow"` |
| One marker | `scripts\test-backend.ps1 api` | `scripts/test-backend.sh api` | `pytest -m api` |
| Marker mix | `scripts\test-backend.ps1 "api and not slow"` | same with `.sh` | `pytest -m "api and not slow"` |
| With coverage | `scripts\test-backend.ps1 coverage` | `scripts/test-backend.sh coverage` | `pytest --cov=app --cov-report=term-missing:skip-covered` |
| Slowest 10 | add `--durations=10` to any command | | |

Install coverage once with `pip install -r requirements-dev.txt` (adds `pytest-cov`). Lint: `ruff check --no-cache .`

## Markers (registered in `backend/pytest.ini`, strict: a typo fails the run)

| Marker | Meaning | Counts (516 tests, 2026-10-03) |
|---|---|---|
| `unit` | pure logic: engine, data, search, questions, tips, simulation | 76 |
| `api` | goes through the FastAPI app with `TestClient` | 334 |
| `contract` | API shapes and golden numbers the frontend relies on | 22 |
| `regression` | one test per fixed bug (`test_regressions.py`) | 14 |
| `agent` | the assistant: tools, guards, loop, with a scripted fake model | 75 |
| `db` | the SQLite layer and demo sandboxes | 211 |
| `slow` | takes more than 3 seconds | 13 |
| `feature("F5")` | optional: which feature a test covers; add it by hand with `@pytest.mark.feature("F5")` | 0 so far |

A test can have several markers (a sandbox API test is `db` and `api`). Markers are assigned from the
**file name** by `pytest_collection_modifyitems` in `conftest.py`, so a new file is marked automatically if it follows the naming rules:

| File name | Markers |
|---|---|
| `test_engine*.py`, `test_data.py`, `test_search.py`, `test_questions.py`, `test_tips.py`, `test_simulate.py`, `test_sequencer_urgency.py` | `unit` |
| `test_*api*.py`, `test_chat.py`, `test_treatment_plan.py`, `test_cors.py`, `test_ratelimit.py` | `api` |
| `test_contract_*.py` | `contract`, `api` |
| `test_agent_*.py` | `agent` |
| `test_db.py` | `db` |
| `test_saved_*.py`, `test_sandboxes.py`, `test_household_plan.py`, `test_profiles.py`, `test_notifications.py`, `test_t25.py`, `test_demo_accounts_status.py` | `api`, `db` |
| `test_regressions.py` | `regression` |

A file that matches nothing gets no marker: add a line to `_FILE_MARKERS` in `conftest.py`. Tests slower than 3 s are listed by name in `_SLOW` in the same file (their code is not changed).

## Naming rules
- One test file per area, named `test_<area>.py`. Test names say what is true: `test_crown_in_november_is_800`.
- Bug tests go in `test_regressions.py` and are named `test_regression_<what_was_wrong>`.
- Tests are repeatable: temporary databases (`tmp_path`), fixed seeds, no reliance on today's date (the app uses the demo clock).

## How to add a test
- **For a bug you fixed:** add `test_regression_<name>` to `test_regressions.py`. The docstring says what the bug was and the date. Assert the correct behavior through the engine, parser or API. It must fail without the fix.
- **For a new feature:** put tests in the area file (or a new `test_<area>.py` that follows the naming table), cover the happy path, the unhappy paths (bad input, unknown id, wrong person) and the exact numbers. Add `@pytest.mark.feature("F#")` if useful.
- Shared fixtures (`plans`, `catalog`, `demo`) are in `conftest.py`. Add to that file only, and keep changes additive.
- Run the fast group while working, then the full run and `ruff check --no-cache .` before you say you are done.

## The golden-number rule
Golden numbers (`docs/FEATURES.md` section 2: G1 to G6, S2 $2,300 to $1,405 saving $895, Preferred crown $625 / $800 / $925) are the expected values in `test_engine.py`, `test_api.py`, `test_contract_*.py` and `test_regressions.py`. **Nobody edits an expected number to make code pass.** If a golden test fails, fix the code, or tell the math owner (M) the number may be wrong. Only the engine agent edits `test_engine.py`, with M's approval.

## Coverage (measured 2026-10-03, full run, `pytest --cov=app`)

| Package | Statements | Covered |
|---|---|---|
| `app/engine` | 535 | 98.3% |
| `app/routers` | 625 | 97.0% |
| `app/db` | 621 | 92.3% |
| `app/agent` | 787 | 94.4% |
| `app` top level (main, models, data, search, questions, parser, rate limits) | 968 | 98.9% |
| **Total** | 3,536 | **96%** (131 lines missed) |

Weakest modules (all small): `app/db/__main__.py` 0% (the command-line reset tool, not tested), `app/agent/ollama_client.py` 55% (the real Ollama HTTP client; tests use fakes), `app/agent/tools.py` 91%, `app/routers/session.py` 93% and `app/db/core.py` 90%. Coverage counts lines run, not whether the assertions are good: it is a guide to gaps, not a grade.

## Slowest tests (one full run; times vary with machine load)
`test_ratelimit.py` (four tests that loop many requests, 6 to 41 s depending on the machine), `test_agent_compare_plans.py::test_overrides_and_known_codes_change_the_result` 5 s, `test_simulate.py` (two Monte Carlo tests) 4 s each, `test_saved_simulations.py::test_cap_of_20` 5 s, `test_contract_api.py::test_every_documented_endpoint_is_in_openapi` 4 s, the two chat streaming tests 3 to 4 s. All are marked `slow`; the fast group skips them.
