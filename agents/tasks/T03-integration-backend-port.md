# Task T03: Port Caleb's backend onto main

**Role:** integration
**Read first:** agents/README.md, agents/integration-agent.md, agents/tasks/PLAN.md, `docs/prototypes/README.md`, `docs/decisions/README.md` (D6 tiers)

## Goal
`main`'s backend is an empty skeleton. Bring over Caleb's tested backend (engine, API, tips, questions, quote parser) so every other task has a working base, and switch the plan data to the three tiers.

## Scope
- Source, read-only: branch `proto/dental-prototype`, folders `backend/app/`, `backend/tests/`, `backend/data/`, `backend/requirements.txt`.
- This is the one place a wholesale port is right: the target is empty, and the code is already tested and consistent.

## You may edit
`backend/` only: `app/`, `tests/`, `data/`, `requirements.txt`, `.env.example` entries for the backend.

## You must not touch
`frontend/`, `database/` (T04), `backend/app/db/` (T04), `docs/` other than a port note, the prototype branch.

## Interfaces
- Keep Caleb's endpoints and shapes unchanged (`/estimate`, `/schedule`, `/benefits-status`, `/savings-tips`, `/questions`, `/treatment-plan/parse`, `/procedures`, `/plans`, `/reminders.ics`).
- Drop the keyword fallback in the chat code (decision D3): leave a clear seam for the AI agent (T06) to replace `backend/app/agent/`. Do not delete the tool functions.
- **Plans:** replace `demo_ppo` / `basic_ppo` with three tiers (`basic`, `preferred`, `premium`) using the numbers in `docs/decisions/README.md` D6. **Preferred must equal the old demo plan** (deductible $50) so golden numbers hold. Keep `Plan.alternate_benefit` and frequency limits (cleanings 2 per year) on all tiers.
- Adding ortho coverage for children to the tier data is allowed; vision is out (D10).
- **Running at the same time:** T01, T02, T04. T04 owns `backend/app/db/`.

## Acceptance checks
- `pytest -q` from `backend/` passes (carry over all tests, updating plan ids from `demo_ppo` to `preferred`).
- Golden numbers pass exactly (G1–G6 and the plan-year scenario S2: $2,300 to $1,405, saves $895), now on the `preferred` plan.
- `GET /plans` returns the three tiers; `ruff check .` is clean.

## Docs to update
A short port note in `docs/prototypes/PORT-NOTES.md`: what came over, what was changed (tiers, chat seam), what was dropped and why.

## Report
Format in agents/README.md, plus the port note.
