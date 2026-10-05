# Task T05: Household, auth and overview API

**Role:** backend
**Read first:** agents/README.md, agents/backend-agent.md, agents/tasks/PLAN.md ("API"), T04's report (access-layer functions), the ported backend from T03

## Goal
Expose households and members, a demo sign-in, a per-person overview, the upcoming schedule, invites, and a yearly-cost calculator, all computed per person by the engine.

## Scope
Decisions D1, D2, D6, F1 (demo sign-in on the real data model), and the kept features "annual cost calculator" and "upcoming schedule".

## You may edit
`backend/app/` (new `routers/households.py`, `routers/auth.py`, `routers/members.py`, `routers/annual_cost.py`, `engine/annual_cost.py`, `models.py`, `main.py`) and tests under `backend/tests/`.

## You must not touch
`backend/app/db/` (T04, call it only), `backend/app/agent/` and `rag/` (T06), `frontend/`, `database/`.

## Interfaces
- Endpoints and purposes are listed under "API" in agents/tasks/PLAN.md.
- **Demo sign-in:** `GET /auth/demo-accounts` lists the demo logins; `POST /auth/demo-login` takes a member id and returns a session token plus the member and household. No passwords. Sessions are simple signed tokens kept server-side in memory or the database.
- **Visibility rule:** the primary reads everyone in the household; an adult reads only themself; every request that names a member is checked against the session.
- `GET /members/{id}/overview` returns the member's plan tier, usage, benefits left (via the existing benefits-status engine), the reminder, and eligibility by service. It reads that **person's** usage from the database, never a household total.
- `POST /annual-cost` computes premiums (using the tier's monthly premium per covered person as given in the data) plus expected care through the real engine for a tier, number of covered people and expected care. Do **not** reuse Sai's invented factors (55% family premium step, flat $220 a visit, one shared maximum). Show assumptions in the response.
- **Running at the same time:** T06 (owns `agent/`, `rag/`). Do not touch its files.

## Acceptance checks
- Tests: the visibility rule (primary reads all; adult reads self only; wrong member gets 403), overview numbers for each demo member (Mary: $400 left of $1,500 on Preferred in November), annual cost matches a hand calculation for one case, invites create a pending record.
- Golden numbers still pass. `pytest -q` and `ruff check .` pass.
- OpenAPI (`/docs`) shows every endpoint.

## Docs to update
`docs/BACKEND.md` endpoint table (the Docs agent finalizes).

## Report
Format in agents/README.md, with a sample request and response for sign-in and overview.
