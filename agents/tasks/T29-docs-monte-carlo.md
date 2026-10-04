# Task T29: Docs for the Monte Carlo feature

**Role:** docs
**Read first:** agents/README.md, agents/docs-agent.md, docs/features/F7-choose-a-plan-monte-carlo.md, the T27 and T28 reports given by the orchestrator, and **the code** (`backend/app/engine/simulate.py`, `backend/app/routers/simulate.py`, `frontend/src/features/plans/`).

## Goal
Make every doc that mentions plan comparison, the engine, the API or the demo reflect the built feature, and nothing that is not verified.

## You may edit
`docs/features/F7-choose-a-plan-monte-carlo.md` (status, final numbers, what was built), `docs/FEATURES.md` (F7 section: tick what is done, fix the acceptance line to match), `docs/MATH.md` and `docs/AI.md` (only to fix errors against the code), `docs/ARCHITECTURE.md` (endpoint table and folder map), `docs/DEMO.md` (add an optional extra demo moment: "Which plan fits us?"), `docs/PRESENTATION.md` (one slide), `docs/TASKS.md`, `docs/PROJECT-STORY.md`, `README.md` (feature list and test counts), `frontend/README.md`, `backend/README.md`, `tests/README.md`, `docs/summaries/`.

## Rules
Verify each number by running the tests and one request through `TestClient`; quote the Rivera household result only as it actually comes out. Say plainly that the odds are synthetic placeholders. Update test counts from real runs.

## Report
Format in agents/README.md. List anything not verified.
