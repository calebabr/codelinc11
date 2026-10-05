# Tasks T34 (backend) and T35 (frontend): save a "Which plan fits us?" result to Plan My Year

**User request (2026-10-04):** "for every Best Monte Carlo simulation, users should be able to save it in Plan My Year."

## What the user sees
1. **Plans page, "Which plan fits us?" results:** a clear **"Save to Plan My Year"** button on the results (next to the plan marked "Best for your family"). Tapping it asks for a name inline (default: "<Winner> is best, <short date>"), saves, and shows "Saved. See it in Plan My Year" with a link.
2. **Plan My Year page, "My saved plans" area:** a second group **"Saved plan comparisons"**. One card per saved comparison: the name, "Best: Basic, cheapest in 82% of years" (the saved summary, labelled as saved), who is covered with their care levels, in or out of network, the date. Actions: **Open** (goes to the Plans page with those exact choices filled in and re-runs the live simulation), **Rename**, **Delete** (with a confirm step). Friendly empty, loading and error states.
3. Saved comparisons belong to the member who is active when saving (same visibility rules as saved treatment plans).

## Rules
- **No money or percentage math in the browser.** The server recomputes the saved summary itself by running `simulate()`; the client sends only the choices (so a saved result can never be forged or drift into browser math).
- Estimates carry the disclaimer; the odds are synthetic placeholders.

## Contract (all routes need the bearer token; same access rules as saved plans)
Table `saved_simulations(id text primary key, member_id text references members, name text, request_json text, summary_json text, created_at text, updated_at text)` in `database/migrations/003_saved_simulations.sql`.

- `GET /members/{id}/saved-simulations` -> list, newest first:
```json
[{"id": "ss-...", "member_id": "m-jordan", "name": "Basic is best, Oct 4",
  "request": {"members": [{"id": "m-alex", "name": "Mary", "age": 39, "care_level": "average",
                           "known_care": [{"code": "D2740", "count": 1}]}],
              "plan_ids": ["basic", "preferred", "premium"], "n": 5000, "seed": 42, "in_network": true},
  "summary": {"winner_plan_id": "basic", "winner_name": "Basic", "winner_share": 82,
              "plans": [{"plan_id": "basic", "name": "Basic", "cheapest_share": 82, "median": 1939.0, "p90": 3294.0}],
              "current_plan_id": "preferred"},
  "created_at": "2026-10-04T...", "updated_at": "2026-10-04T..."}]
```
- `POST /members/{id}/saved-simulations` body `{name (1-60 chars), request: <same shape as POST /simulate>}` -> 201 with the record above. The server validates `request` with the same limits as `/simulate`, **runs `simulate()` itself**, and stores the summary it computed (plus the household's current plan id). Max 20 per member (422 beyond).
- `PUT /members/{id}/saved-simulations/{sim_id}` body `{name?, request?}` -> record (recomputes the summary if `request` is given).
- `DELETE /members/{id}/saved-simulations/{sim_id}` -> 204.
- Errors: 401 no token, 403 outside the viewer's visibility (primary any member in the household, adult only themself, managed members denied), 404 unknown member or id, 422 invalid body or unknown plan or code.

## T34 backend scope (you may edit)
`database/migrations/003_saved_simulations.sql`, `backend/app/db/store.py` and `core.py` (list/create/update/delete, access rules like saved plans), `backend/app/routers/saved_simulations.py` (new) plus one `include_router` line in `backend/app/main.py`, `backend/app/models.py` (append models only), `backend/tests/test_saved_simulations.py` (new), `database/README.md`, `docs/summaries/backend_summary.md` (short paragraph), `docs/ARCHITECTURE.md` (endpoint table rows). Tests: create/list/rename/delete; the summary is computed server-side (matches `simulate()` for the same request, ignores any client-supplied numbers); visibility (Mary cannot read Abraham's, Abraham can read Mary's, Tad denied); limits and 422s; 401; cap of 20. Full `pytest -q` and `ruff check --no-cache .` pass.

## T35 frontend scope (you may edit)
`frontend/src/features/plans/` (WhichPlanFits.tsx, SimulateResults.tsx, new save components), `frontend/src/features/planYear/` (SavedPlans.tsx or a new SavedComparisons.tsx; PlanYearPage mounts it), `frontend/src/pages/Plans/PlansPage.tsx` and `frontend/src/pages/PlanYear/PlanYearPage.tsx` (small changes only), `frontend/src/lib/api/savedSimulations.ts` and `frontend/src/lib/types/savedSimulations.ts` (new), tests, `frontend/README.md`. "Open" navigates to `/plans` with router state `{ simulation: <request> }`; the Plans section reads it once per navigation, pre-fills the covered people, care levels, known care and network toggle, scrolls to the section and runs the live simulation. Mock the routes in tests (the backend agent builds them in parallel); on 404 show "Saving comparisons is not available on the server yet." Tests: save flow sends only choices (no numbers) with the token; success link; list renders the saved summary text from the API; Open navigates with the state and pre-fills; rename; delete with confirm; empty and error states. `npm run typecheck`, `npm run test` (twice), `npm run build` pass.

## Both
Never run git write commands; do not start or stop servers; never read `backend/.env`. Report in the format in agents/README.md.
