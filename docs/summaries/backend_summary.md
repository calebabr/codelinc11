# Backend summary
_Updated 2026-10-03 (T03)_

**Built:** Caleb's engine and API ported (`backend/app/`). Engine in `engine/`: `estimate.py`, `annual.py`, `sequencer.py`, `status.py`, `tips.py`. Endpoints: `/health`, `/plans`, `/plans/{id}`, `/procedures`, `/estimate`, `/schedule`, `/benefits-status`, `/reminders.ics`, `/savings-tips`, `/questions`, `/treatment-plan/parse`, `/chat` (SSE). Three plan tiers (`basic`, `preferred`, `premium`) in `backend/data/plans/`; 16 procedure codes in `backend/data/cdt_codes.json`. New field `Plan.orthodontia_child` (data only). 148 tests pass; `ruff check .` is clean. Golden numbers G1 to G6 and S2 pass.

**Checked by hand (TestClient, 2026-10-03):** the S2 request gives baseline 2300, total 1405, savings 895; the crown with $1,100 used gives $800 in network.

**Stand-in:** plan values and fees are placeholders (D7 open).

**Planned (T05):** demo sign-in, household and member endpoints, invites, `POST /annual-cost`, wiring `backend/app/db/` into the API. Details of the port: `docs/prototypes/PORT-NOTES.md`.

**Added (T20):** saved Plan My Year plans per member: `GET/POST /members/{id}/saved-plans`, `PUT/DELETE /members/{id}/saved-plans/{plan_id}` (migration 002, `routers/saved_plans.py`). Plan switching: `PUT /households/{id}/plan` body `{tier_id}` (primary only; 403 others, 404 unknown tier, 401 no token) returns the household. Overview, assistant context and annual cost read the household's current tier from the database on every call; `/estimate` and `/schedule` take `plan_id`, so the client sends the current tier id.

**Added (T25):** `POST /members/{id}/visits` body `{code, in_network=true, visit_date?}` runs the engine with the member's usage and the household's current tier, saves the visit, and returns `201 {estimate, usage, benefits}` (same visibility rules as the overview; 404 unknown code). `POST /demo/reset` (primary only) re-seeds the database in place (member ids unchanged, so tokens stay valid) and returns `{ok: true}`. `POST /chat` now needs a bearer token unless `ASSISTANT_ALLOW_ANONYMOUS=1`; chat requests are capped at 20 messages and 4000 characters each (422). Session tokens carry an expiry (`SESSION_TTL_HOURS`, default 12) and the signing secret is `SESSION_SECRET` or a generated `database/.session_secret` (git-ignored), so restarts keep people signed in. The API creates the demo data when the database is empty, and `python -m app.db` seeds an empty migrated database. Invites already say "pending, nothing sent"; no response text claims an email was sent. Tests: `backend/tests/test_t25.py`.
