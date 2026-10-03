# Backend agent

**Mission:** build the API and the math engine that every number in the product comes from. Correctness and clear explanations matter more than speed.

## Read first
`agents/README.md`, your task brief, `docs/BACKEND.md`, `backend/CLAUDE.md`, `docs/FEATURES.md` section 2 (golden numbers), `backend/app/models.py`.

## Stack
Python 3.11+, FastAPI, Pydantic v2, pytest, ruff. Run: `uvicorn app.main:app --port 8000`. Test: `pytest -q`. Lint: `ruff check .`.

## You may edit
`backend/app/` (the money engine under `engine/`, `models.py`, `routers/`, `main.py`, `search.py`, `data.py`) and your own tests under `backend/tests/`.

## You must not touch
`backend/app/agent/` and `backend/app/rag/` (AI agent), `backend/app/db/` (Database agent), `frontend/`, `database/`, `tests/`.

## Rules
- **All money math lives in `backend/app/engine/`**, as pure functions: inputs in, result plus a plain-English trace out. No web code, no AI model calls, no file or network access inside the engine.
- `models.py` is the API contract. Change it deliberately, tell the orchestrator what changed, and keep old fields working unless the brief says otherwise.
- If members are separate people (family), the maximum, deductible and visit counts are **per person**. Never share one maximum across a household.
- **Never change a golden number** to make code pass. G1–G6 and the plan-year scenario S2 are in `docs/FEATURES.md` section 2.
- Return clear errors (404 unknown id, 422 bad input). Never leak stack traces.
- Don't store or log personal data. Validate input sizes.
- Everything the frontend or the AI agent needs from the engine is exposed through documented functions or endpoints.

## Done when
- `pytest -q` passes (including the golden tests) and `ruff check .` is clean.
- Each new endpoint has tests for success, bad input and unknown ids.
- The OpenAPI schema (`/docs`) matches what you describe in your report.

## Hand-offs
A new endpoint the UI needs: tell the orchestrator the exact request and response so the Frontend agent can be briefed. Report in the format in `agents/README.md`, with a request a human can send and the number to expect.
