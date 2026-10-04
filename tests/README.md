# tests/

Cross-cutting tests: the checks that look at the whole product, not one file. The Tests agent (`agents/tests-agent.md`) owns this folder.

```
tests/
├── e2e/        real user flows in a browser against the running app
├── contract/   frontend API expectations match what the backend returns
├── fixtures/   shared synthetic members, plans and quotes
└── README.md
```

## Where every kind of test lives

| Kind | Location | Written by |
|---|---|---|
| Backend unit tests (engine, API, chat) | `backend/tests/` (organized by markers; see [backend/tests/README.md](../backend/tests/README.md)) | The agent that writes the backend code; the Tests agent owns the regression file and the markers |
| Frontend unit and component tests | next to the code, `frontend/src/**/*.test.ts(x)` | The Frontend agent |
| End-to-end flows | `tests/e2e/` | Tests agent |
| API contract checks | `tests/contract/` | Tests agent |
| Golden numbers | engine tests plus `tests/fixtures/` | Engine tests hold them; the Tests agent adds regression checks |

## The golden numbers
The correct answers for the demo plan are in `docs/FEATURES.md` section 2 (cleaning $0, crown fresh year $625, crown late in the year $800, out-of-network crown $925 with $300 balance billing, plan-year scenario $2,300 to $1,405 saving $895). Tests check these exactly. **No one changes an expected value to make code pass.**

## Rules
- Tests must not need Ollama, a paid API or the internet. Chat is tested with a scripted fake model and the "model unavailable" path.
- Tests are repeatable: fixed seeds and no reliance on today's date unless it's passed in.
- Check exact numbers and unhappy paths (server down, empty input, unknown ids, quotes with junk lines, one family member's data never showing up for another).

## Contract and demo tests (T13)
These run with the normal backend and frontend commands (no extra setup, no servers, no model):

| File | What it proves |
|---|---|
| `backend/tests/test_contract_api.py` | Every documented endpoint is in `/openapi.json`; response shapes for sign-in, household, overview, schedule, estimate, Plan My Year and annual cost; primary sees all, an adult only themself, Maya cannot sign in, bad tokens get 401; golden numbers G1-G6 and S2 ($2,300 to $1,405, saves $895) through HTTP |
| `backend/tests/test_contract_demo.py` | Demo flow: sign in as Alex, $400 left, Plan My Year golden numbers, assistant (scripted fake model) says only tool-sourced dollar amounts; "model unavailable" path invents no numbers |
| `frontend/src/routes.smoke.test.tsx` | The six routes render for a signed-in session with a mocked API and write nothing to `console.error` or `console.warn` |

## Other tests that guard the demo (run 2026-10-03)
These also run with the normal commands:

| File | What it proves |
|---|---|
| `backend/tests/test_sandboxes.py` | Every visitor gets their own demo family (ids suffixed, 24 hour expiry, cap, 410 for expired); resetting or renaming one family never touches another; the shared template cannot be renamed |
| `backend/tests/test_ratelimit.py` | Limits answer 429 with `Retry-After` and a plain sentence; counts are per household or per address; the global chat cap |
| `backend/tests/test_simulate.py`, `test_simulate_api.py`, `test_saved_simulations.py` | The plan comparison is repeatable with a seed, shares add to 100, saved comparisons are recomputed by the server |
| `backend/tests/test_agent_compare_plans.py`, `test_agent_sim_followups.py` | The `compare_plans` tool, follow-up chips and the percentage guard, with a scripted fake model |
| `backend/tests/test_cors.py`, `test_demo_accounts_status.py` | CORS settings for phones and tunnels; demo accounts carry member status |
| `frontend/src/state/DemoFamily.test.tsx`, `frontend/src/pages/Join/JoinPage.test.tsx`, `frontend/src/components/shell/mobile.test.tsx` | One-tap demo, naming the family, the QR page, and the phone rules (viewport meta, manifest, 16 px inputs, 44 px chips) |

Counts: backend 391 passed, frontend 151 tests (17 files). All suites need no network or key. One frontend test (`SessionContext.test.tsx`, "sends a signed-out visitor to the login page...") timed out once on a full run under load and passes alone.

## Commands
- Backend by group: `scripts/test-backend.ps1 [all|fast|coverage|<marker>]` (or `.sh`). Markers: `unit`, `api`, `contract`, `regression`, `agent`, `db`, `slow`. Regression tests for fixed bugs are in `backend/tests/test_regressions.py` (14 tests). Last full run: 516 passed (473 when coverage was measured), 96% line coverage of `backend/app`.
- Backend: `cd backend && .venv/Scripts/python -m pytest -q` and `ruff check .`
- Frontend: `cd frontend && npm run test`
- Browser end-to-end (`tests/e2e/`): not built yet. The demo flow is covered at the API level by `test_contract_demo.py`; a Playwright run of the same flow is the next step.
