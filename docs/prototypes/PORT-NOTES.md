# Port Notes

Records what each integration task brought from a prototype into the main product. Newest first.

## T03: Caleb's backend (source: branch `proto/dental-prototype`, author: Caleb)

**Came over unchanged:** the whole `backend/app/` tree (money engine in `engine/`, `models.py`, `main.py`, `data.py`, `search.py`, `questions.py`, `treatment_parser.py`, `routers/`, the tool functions and number guard in `agent/`), `backend/data/cdt_codes.json`, `backend/requirements.txt`, and all tests. Endpoints and shapes are the same: `/estimate`, `/schedule`, `/benefits-status`, `/savings-tips`, `/questions`, `/treatment-plan/parse`, `/procedures`, `/plans`, `/reminders.ics`, `/health`, `/chat`.

**Changed:**
- **Plans (decision D6):** `demo_ppo` and `basic_ppo` replaced by three tiers, `basic`, `preferred`, `premium` (`backend/data/plans/`). `preferred` equals the old demo plan (deductible $50, max $1,500, 100/80/50), so G1-G6 and S2 ($2,300 to $1,405, saves $895) pass unchanged. All tiers keep cleanings 2 per year and `alternate_benefit: true`. Default plan id is now `preferred`.
- **New field `Plan.orthodontia_child`** (plan's share for children's braces: 0 / 0.5 / 0.6). It is data for the Plans page only; the engine does not use it yet. Vision is left out (D10).
- **Chat seam (decision D3):** the keyword fallback in `backend/app/agent/loop.py` is gone. `run_chat(req, client=None)` still yields the same SSE events. With no reachable model it says so plainly (mode `unavailable`); a refused answer (number guard failed) says it will not guess. `/health` `chat_mode` is now `"ollama" | "unavailable"` (was `"ollama" | "fallback"`). The tool functions (`tools.py`) and `guard.py` are kept for T06 to reuse.
- **Tests:** plan ids updated to the tiers; tests that needed a plan without the alternate-benefit rule now pass an inline plan with `alternate_benefit: false`; fallback tests replaced by "unavailable" tests; added tier-number tests. Golden expected values are untouched. One engine test now expects `ValueError` instead of a bare `Exception` (ruff B017); the checked values are unchanged.
- `ruff --fix` modernized `Optional[X]` to `X | None` in `models.py`.

**Dropped:** the keyword intent handler and its canned answers (D3). Caleb's `README.md`, `CLAUDE.md` and empty fixture folders were not copied.

**Resolved:** the two stale plan files were deleted by the orchestrator; `GET /plans` returns exactly three tiers and the suite passes (148 tests).
