# Task T27: Monte Carlo engine, API and assistant tool

**Role:** backend (with the ai agent's tool scope for the last item)
**Read first:** agents/README.md, agents/backend-agent.md, `docs/features/F7-choose-a-plan-monte-carlo.md` (the plan, decisions and the exact API contract), `docs/MATH.md`, `backend/app/engine/annual.py`, `annual_cost.py`, `estimate.py`, `backend/app/routers/annual_cost.py`, `backend/app/agent/tools.py`

## Goal
Build `simulate()` (Monte Carlo plan comparison), `POST /simulate`, and the assistant tool `compare_plans`, exactly as the F7 document and API contract describe.

## You may edit
`backend/app/engine/simulate.py` (new), `backend/app/models.py` (add `SimulateRequest`/`SimulateResponse` and helpers at the end only), `backend/app/routers/simulate.py` (new), `backend/app/main.py` (one `include_router` line), `backend/app/agent/tools.py` and `backend/app/agent/loop.py` (add the `compare_plans` tool, schema, system-prompt line and the template fallback), `backend/app/agent/suggestions.py` (one chip: "Which plan should we pick?"), `backend/tests/test_simulate.py`, `backend/tests/test_simulate_api.py`, `backend/tests/test_agent_compare_plans.py` (new), `docs/MATH.md` (Monte Carlo section), `docs/AI.md` (tool row), `docs/summaries/backend_summary.md` (short paragraph).

## You must not touch
`frontend/`, golden expectations in `backend/tests/test_engine.py`, any existing engine file except importing from it (`estimate`, `run_year`, `Usage`).

## Requirements
- No new dependency. `random.Random(seed)`, Knuth Poisson, rates and canonical order as in the F7 document. Care level rates table is in the document; children under 13 per the decisions section.
- Common random numbers: draw all people's years once, price the same years under every plan. **Cache pricing by (plan id, in_network, tuple of codes)** so n = 5,000 for 4 people and 3 plans runs in under 2 seconds (measure and report the time).
- Pricing only through `estimate()`/`run_year()`; no new money formulas. Totals are premiums plus what the family pays.
- Percentiles: nearest-rank on the sorted totals (document it). `cheapest_share` uses the largest-remainder method so shares sum to exactly 100; ties by lower premium then plan id.
- Histogram: shared bin edges (about 12 bins from the global min to max, rounded edges), per-plan counts.
- `reasons`: built from the numbers in code (premium difference; whether preventive, basic or major coverage explains the gap in a bad year). Plain language.
- `/simulate` needs a valid bearer token (reuse `Viewer` from `routers/session.py`); validation limits as in the contract (422); unknown plan id 404; unknown code 422.
- `compare_plans` tool: reads the household members the viewer may see from the store (primary sees all; an adult only themself), defaults every member to `average`, accepts overrides, runs `simulate()` with the same defaults as the page (n 5000, seed 42), and its numbers pass the number guard (check `guard.py` collects them as sources). The assistant must present percentages and totals only from the tool result, with the disclaimer and a "synthetic odds" note.
- Never change golden numbers.

## Tests (all must pass)
- Same seed gives identical output; a different seed changes numbers slightly.
- A zero-care profile makes Basic win 100% with totals equal to 12 x premium x people (use a test-only way to force zero rates, for example an internal parameter, not a public care level).
- A known crown for an adult raises Premium's `cheapest_share` versus no known care.
- Spot-check a few simulated years against `estimate()` directly.
- Shares sum to exactly 100; histogram counts sum to n for every plan.
- Limits (n above 20,000, no members, bad level) give 422; 401 without a token; unknown plan 404.
- Performance: Rivera household (4 people, n 5,000) under 2 seconds locally; assert under 5 seconds in the test for CI margin.
- The assistant tool returns the same shares as `simulate()`; the guard accepts them and rejects an invented figure.
- Full `pytest -q` and `ruff check --no-cache .` pass.

## Do not
Run git write commands; start or stop servers; read or print `backend/.env`.

## Report
Format in agents/README.md. Include the measured time for the Rivera household, the exact route contract if you changed anything, and the numbers for the Rivera household (average care, no known care) so the frontend and docs can quote them.
