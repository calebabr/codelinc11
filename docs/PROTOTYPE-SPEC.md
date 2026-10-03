# PROTOTYPE-SPEC.md: Shared Build Spec for the Prototype

Branch: `proto/dental-prototype` (never commit to `main`). **Only the orchestrator runs git.** Agents never run `git add/commit/push/switch`.

Stack: **React + Vite + TypeScript** (frontend) · **FastAPI + Pydantic v2** (backend) · **Ollama** (local open-source LLM for the chatbot, default model `llama3.2:3b`).

The contract is [`backend/app/models.py`](../backend/app/models.py). **Do not edit it.** If you think it needs a change, say so in your report instead.
Seed data: `backend/data/plans/*.json` (2 plans: `demo_ppo`, `basic_ppo`) and `backend/data/cdt_codes.json` (15 procedures). Do not edit seed values: the golden numbers depend on them.

## 1. File ownership (agents run in parallel in ONE working folder: stay in your lane)

| Agent | May create/edit | Must NOT touch |
|---|---|---|
| **backend** | `backend/app/**` (except `models.py`), `backend/.env.example`, `backend/pytest.ini` if needed | `backend/tests/`, `frontend/`, `docs/`, seed data |
| **frontend** | `frontend/src/**` (except `src/test/`, `*.test.tsx`), `frontend/index.html`, `frontend/.env.example` | `frontend/package.json`, lockfile, `vite.config.ts`, configs, `backend/`, `docs/` |
| **tests** | `backend/tests/**`, `frontend/src/test/**`, `frontend/src/**/*.test.tsx`, `frontend/vitest.config.ts` | everything else |
| **docs** | `docs/PROTOTYPE.md`, `backend/README.md`, `frontend/README.md`, root `README.md` | code, tests, other docs |

Dependencies are already installed (venv at `backend/.venv`, `frontend/node_modules` with vitest + Testing Library + jsdom). Run Python with `backend/.venv/Scripts/python`. Do not add dependencies; if you truly need one, report it.

## 2. Domain rules (the math)

Plan values come from `Plan`; fees from `Procedure`. All money rounded to 2 decimals.

**estimate(proc, plan, usage, in_network)** →  `EstimateResult`
1. `billed = fee_p50` in network, `fee_p80` out of network. `allowed = fee_p50` always (out-of-network pays on the in-network allowed amount; the dentist can bill the difference).
2. **Frequency limit:** if `plan.frequency.get(code)` exists and `usage.history.count(code) >= limit` → `covered=False`, `plan_pays=0`, `you_pay=billed`, `deductible_applied=0`, one trace step explaining the limit.
3. **Deductible:** 0 if category in `deductible_waived_for`; else `min(max(plan.deductible - usage.deductible_met, 0), allowed)`.
4. **Coinsurance:** `covered_amt = (allowed - deductible) * plan.coinsurance[category]`.
5. **Annual max:** `remaining = max(plan.annual_max - usage.max_used, 0)`; `plan_pays = min(covered_amt, remaining)`.
6. `you_pay = billed - plan_pays`; `balance_bill = billed - allowed`; `max_used_after = usage.max_used + plan_pays`.
7. `trace`: ordered `TraceStep`s in plain English: typical cost → deductible → plan share (%) → annual max limit (only if it capped) → you pay. `note` text must be friendly, no jargon without explanation.

`/estimate` returns **both** in-network and out-of-network results.

**run_year(procs, plan, usage)** → applies `estimate` in order, updating `usage` copy (`deductible_met += deductible_applied`, `max_used += plan_pays`, `history.append(code)`), returns `(results, final_usage)`.

**best_schedule** (Plan My Year): items are assigned to `year_offset` 0 (this plan year) or 1 (next plan year, fresh `Usage()`), then ordered and given months.
- Search: exhaustive over all 2^n assignments (n ≤ 10; reject larger with a clear error).
- Urgency propagates: if an urgent item has an `after` prerequisite, the prerequisite is treated as urgent too (transitively), so both are in year 0 with the prerequisite first.
- Feasible if: every `urgent` item is in year 0; if `item.after` is set, its prerequisite is in the same year (earlier in order) or an earlier year; (if `current_month == 12`, still allow year 0).
- Order within a year: urgent first, then respect `after`, then by **plan share ascending** (major before basic before preventive) so the deductible lands on the lowest-plan-share item, then fee descending.
- Months: year 0 uses months `current_month..12`; year 1 uses `1..12`. Assign one item per month in order, starting at the earliest available month; urgent items get `current_month`; when items exceed available months, later items share the last month.
- Score = total `you_pay` across both years + `0.01 * number of items in year 1` (tie-break prefers sooner care). Pick the minimum.
- `baseline` = all items in year 0 with the same ordering rule; `baseline_you_pay` is its total; `savings = max(baseline_you_pay - total_you_pay, 0)`.
- `reasons`: plain-English bullets, e.g. "Root canal stays this year because it's urgent.", "Crown moves to January: your plan year resets and you get a fresh $1,500 maximum.", "Only $400 of your maximum is left this year."
- Each `ScheduledItem.note` explains its placement.

**benefits_status**: remaining max/deductible, per-code frequency usage for codes in `plan.frequency`, `unused_preventive_value = sum(fee_p50 of remaining covered preventive visits)`, `months_left = 12 - current_month + 1`, `reminder` text when `current_month >= 10` and (`max_remaining > 0` or any preventive remaining), else `null`.

## 3. Golden numbers (demo_ppo; deductible $50 waived for preventive, max $1,500, 100/80/50)

| ID | Situation | Expected |
|---|---|---|
| G1 | D1110 cleaning, fresh usage | plan_pays 120, you_pay 0, deductible_applied 0 |
| G2 | D2392 filling, fresh usage | deductible 50, plan_pays 120, you_pay 80 |
| G3 | D2740 crown, `max_used=1100`, `deductible_met=0` | plan_pays 400 (capped from 575), you_pay 800 |
| G4 | D2740 crown, fresh usage | plan_pays 575, you_pay 625 |
| G5 | D2740 crown out-of-network, fresh | plan_pays 575, you_pay 925, balance_bill 300 |
| G6 | D1110 with `history=["D1110","D1110"]` | covered False, plan_pays 0, you_pay 120 |
| S2 | Sequencer: `max_used=1100`, `deductible_met=50`, `current_month=11`; items: D3330 urgent, D2740 after the root canal, two D2392 flexible | baseline_you_pay **2300**, total_you_pay **1405**, savings **895**; root canal in year 0; crown + both fillings in year 1 (months 1–3, crown first) |

S2 detail: year 0 = root canal only (plan 400, you 700). Year 1 (fresh usage): crown (ded 50, plan 575, you 625), fillings (plan 160 each, you 40 each) → you 705. Total 1405.
Benefits example: `max_used=1100`, history `["D1110"]`, month 11 → max_remaining 400, D1110 used 1 of 2, `reminder` is set.

## 4. API (all JSON; CORS allows `http://localhost:5173`)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/health` | | `HealthResponse` |
| GET | `/plans` | | `list[Plan]` |
| GET | `/plans/{id}` | | `Plan` (404 if unknown) |
| GET | `/procedures?q=` | `q` optional | `list[ProcedureMatch]` sorted by score; empty `q` returns all (score 1) |
| POST | `/estimate` | `EstimateRequest` | `EstimateResponse` (404 unknown plan/code; 422 validation) |
| POST | `/schedule` | `ScheduleRequest` | `ScheduleResponse` |
| POST | `/benefits-status` | `BenefitsStatusRequest` | `BenefitsStatus` |
| GET | `/reminders.ics?plan_name=&max_remaining=&month=` | query | `text/calendar` file with one all-day reminder on Dec 1 and one on Dec 15 ("Use your dental benefits before they reset") |
| POST | `/chat` | `ChatRequest` | `text/event-stream` (SSE) |

Plan resolution: `plan` (inline custom) wins over `plan_id`; if neither is given use `demo_ppo`.

Procedure search: case-insensitive; score from exact synonym/name match (1.0), substring match (0.8), word-overlap/difflib fuzzy match (≥0.5 kept). No external services.

### Chat SSE events
Each event: `event: <name>\ndata: <json>\n\n`. Names: `tool_start {name, args}`, `tool_end {name, result}`, `token {text}`, `done {mode}`, `error {message}`. `mode` is `"ollama"` or `"fallback"`.

### Chat design (Ollama + guaranteed fallback)
- Config (env, read with python-dotenv, defaults in parentheses): `OLLAMA_URL` (`http://localhost:11434`), `OLLAMA_MODEL` (`llama3.2:3b`), `OLLAMA_TIMEOUT` (60).
- `app/agent/ollama_client.py`: `OllamaClient` with `is_available() -> bool` (GET `/api/tags`, 1.5 s timeout, never raises), `chat(messages, tools=None) -> dict` (POST `/api/chat`, `stream=False`). All network errors become a handled `OllamaUnavailable` exception.
- `app/agent/tools.py`: tool schemas + functions that wrap the engine: `find_procedure(query)`, `estimate_cost(code)`, `plan_year_schedule(items)`, `get_benefits_status()`. Each returns a JSON-serializable dict. Plan/usage/month come from the request context, not from the model.
- `app/agent/loop.py`: `run_chat(req: ChatRequest, client=None) -> Iterator[dict]` yields event dicts `{"event": name, "data": {...}}`. If Ollama is available: tool-calling loop (max 5 steps), system prompt below, then stream the final answer as `token` events. If Ollama is unavailable, errors, or the answer fails the guard: **fallback mode**, a deterministic intent handler that calls the same tools (keyword intents: procedure words → estimate; "january", "wait", "schedule", "plan my year" → schedule with the mentioned procedures; "left", "remaining", "max", "benefits" → benefits status; otherwise a helpful menu of what it can do) and writes the answer from templates using only tool results.
- `app/agent/guard.py`: `check_numbers(answer: str, tool_results: list) -> list[str]` returns every `$` amount in `answer` that does not appear (within $1) in any number in the tool results. Non-empty → fall back to the template answer.
- **System prompt rules:** plain language; never state a dollar amount that did not come from a tool result; use tools for every number; if the procedure is unclear call `find_procedure` and ask a short question; never advise delaying urgent or painful care; end estimates with "This is an estimate, not a guarantee."
- **The LLM never computes money.** All math is in `app/engine/`.

## 5. Python interfaces (tests depend on these exact names)

```
app/data.py              load_plans() -> dict[str, Plan]; load_catalog() -> dict[str, Procedure]   (cached; reads backend/data)
app/engine/estimate.py   estimate(proc, plan, usage, in_network=True) -> EstimateResult
app/engine/annual.py     run_year(procs, plan, usage) -> tuple[list[EstimateResult], Usage]
app/engine/sequencer.py  best_schedule(req: ScheduleRequest, plan: Plan, catalog: dict[str, Procedure]) -> ScheduleResponse
app/engine/status.py     benefits_status(plan, usage, catalog, current_month) -> BenefitsStatus
app/search.py            search_procedures(query, catalog) -> list[ProcedureMatch]
app/agent/ollama_client.py   OllamaClient, OllamaUnavailable
app/agent/tools.py       find_procedure / estimate_cost / plan_year_schedule / get_benefits_status
app/agent/loop.py        run_chat(req, client=None) -> Iterator[dict]
app/agent/guard.py       check_numbers(answer, tool_results) -> list[str]
app/main.py              app: FastAPI
```

## 6. Frontend spec

Single-page app with **no router dependency** (use React state for navigation). Tabs/pages: **Landing → Setup → (Estimate | Plan My Year | My Benefits)** plus a **Chat drawer** (shadcn `Sheet`) on every page after Landing. Use the shadcn components already in `src/components/ui`, TanStack Query for API calls, Recharts for charts, Tailwind for layout. Brand: maroon `#6b0f2a`, orange `#f5591f`. Mobile friendly (works at 375 px). Never compute dollar amounts in the frontend: display API fields only; `src/lib/format.ts` may only format.

Files: `src/lib/types.ts` (hand-written TypeScript mirror of `models.py`), `src/lib/api.ts` (typed fetch functions, base URL from `import.meta.env.VITE_API_URL ?? "http://localhost:8000"`), `src/lib/format.ts`, `src/lib/chat.ts` (SSE client using `@microsoft/fetch-event-source`), `src/state/PlanContext.tsx` (selected plan or custom plan, usage, current month; persisted in `localStorage` inside try/catch), `src/pages/*`, `src/components/*`.

| Page | Contents |
|---|---|
| **Landing** | Headline "Know what you'll owe before you sit in the chair", short explainer, **Get started** and **Try the demo plan** buttons, estimate disclaimer |
| **Setup** | Step 1 pick a sample plan (cards from `GET /plans`) or enter a custom plan (deductible, annual max, preventive/basic/major %); Step 2 "what have you used this year?" (max used, deductible met, cleanings done) and "current month" select; Step 3 plain-English plan summary ("Your plan pays 100% of cleanings, 80% of fillings…") |
| **Estimate** | Big input with procedure autocomplete (`/procedures?q=`); on select call `/estimate`; show a large **"You pay $X"** card, "Plan pays", in-network vs out-of-network side by side (with balance billing), a waterfall-style Recharts bar of the trace, a "Show the math" accordion built from `trace`, and a glossary tooltip for deductible / coinsurance / annual max / balance billing |
| **Plan My Year** | Treatment list builder (procedure picker, urgency select, optional "after" select, remove), **Optimize** button → `/schedule`; month-by-month timeline with a "New plan year" divider between year 0 and year 1, chips colored by category; per-year max-used bars; savings banner "Doing everything now: $X → Optimized: $Y → You save $Z"; an "Everything now ↔ Optimized" toggle showing `baseline_items` vs `items`; `reasons` as a bullet list; a "Load demo case" button that fills the S2 scenario |
| **My Benefits** | Max gauge (Progress or radial), deductible bar, frequency usage (e.g. cleanings 1 of 2), reminder banner when `reminder` is set, **Add to calendar** link to `/reminders.ics`, and "Log a visit" (pick a procedure → `/estimate` → add `plan_pays` to `max_used`, add code to `history`; this updates context and refetches status) |
| **Chat drawer** | Floating button; message list; input; streams `/chat` SSE; shows tool chips ("Calculating…"); badge showing "AI: Ollama" or "AI: offline mode" from `/health`; suggested prompts ("What will a crown cost me?", "What if I wait until January?", "How much do I have left?") |

Every results screen shows: "This is an estimate, not a guarantee. Your actual cost depends on your dentist's charges and claim review."
Loading skeletons and friendly error states (including "Can't reach the server: is the backend running on port 8000?").

`npm run typecheck && npm run build` must pass.

## 7. Tests spec

- **Backend (pytest, `backend/tests/`):** `test_engine.py` (G1–G6, S2 exact), `test_engine_props.py` (property checks with plain `random` loops, no hypothesis: `plan_pays + you_pay == billed`, `0 ≤ plan_pays ≤ remaining max`, savings ≥ 0, urgent items always year 0), `test_search.py`, `test_api.py` (every endpoint with `TestClient`, golden numbers through HTTP, 404/422 cases, `.ics` content type), `test_chat.py` (guard unit tests; fake Ollama client scripted to request `estimate_cost`; fallback mode when client unavailable; SSE event order and `done` mode; a made-up dollar amount triggers fallback), `test_data.py` (seed files load into models, every procedure has ≥ 2 synonyms and `fee_p80 ≥ fee_p50`).
  Tests must **not** need Ollama or network. Golden expected values are copied from §3 and never adjusted to make code pass.
- **Frontend (Vitest + Testing Library, `frontend/src/**/*.test.tsx`)**: mock `fetch`; tests for `format.ts`, Estimate page renders "$800" from a mocked G3 response, Plan My Year shows savings banner "$895" from a mocked S2 response, Setup summary text, Chat drawer renders streamed tokens and mode badge. Add `"test": "vitest run"` already exists in package.json.

## 8. Run commands

```
# backend (from backend/)
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
.venv/Scripts/python -m pytest -q
# frontend (from frontend/)
npm run dev        # http://localhost:5173
npm run typecheck && npm run build && npm run test
# Ollama (optional, for the real chatbot)
ollama pull llama3.2:3b     # then `ollama serve` (the desktop app starts it automatically)
```

## 9. Reporting

Finish with a short report: files created, commands you ran and their results, anything blocked or assumed, and exactly what a human should check.
