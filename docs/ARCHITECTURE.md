# ARCHITECTURE

How the pieces fit. Everything below is built and connected; checked against the code and the running app on 2026-10-03.

## System diagram

```mermaid
flowchart LR
  subgraph Browser
    UI[React app<br/>landing, login, six pages,<br/>member switcher, assistant button]
  end
  subgraph Backend[FastAPI backend]
    MAIN[main.py and routers/]
    ENG[engine/<br/>all money math]
    DATA[data.py, search.py<br/>plans and procedure codes]
    AGENT[agent/<br/>tool loop, number guard,<br/>per-person context]
    DB[(db/ SQLite<br/>households, members, usage,<br/>visits, saved plans, chat memory)]
  end
  UI -->|HTTP + bearer token, SSE for chat| MAIN
  MAIN --> ENG
  MAIN --> DATA
  MAIN --> DB
  MAIN --> AGENT
  AGENT --> ENG
  AGENT --> DB
  AGENT -->|default| ANT[Anthropic<br/>claude-haiku-4-5]
  AGENT -.->|optional| OLL[Ollama local model]
```

## Data flow

**Sign-in:** `/login` lists `GET /auth/demo-accounts`; tapping one calls `POST /auth/demo-login`, which returns a signed session token (lifetime `SESSION_TTL_HOURS`, default 12). Every household and chat call sends it as `Authorization: Bearer`. The primary account holder sees everyone; an adult sees only themselves; children have no login and are managed by a parent. Another person's data returns 403; chat without a token returns 401.

**Demo families (sandboxes):** the landing page and `/login` have a one-tap **Try the demo** button. It calls `POST /auth/demo-login` with `{member_id, sandbox: true, household_id}`. The server (`db/sandbox.py`) clones the template Rivera household into a private copy: every id gets a `.xxxxxx` suffix (for example `hh-rivera.a1b2c3`), chat memory starts empty, and the plan is Preferred. The response carries `sandbox: {household_id, expires_at}`; the browser keeps the `household_id` and sends it back on later sign-ins to reuse the same copy. `GET /auth/demo-accounts?household_id=` lists that copy's accounts (with each person's status, such as pending). A copy lives 24 hours (`DEMO_SANDBOX_TTL_HOURS`); at most 300 exist at once (`DEMO_MAX_SANDBOXES`); each is about 4.4 KB. An unknown or expired copy answers 410. `POST /demo/reset` puts only the caller's own copy back to the seed. `PUT /households/{id}/names` (primary only, copies only, never the shared template) renames people and the family: person names 1 to 24 characters (the form lets the family name run to 30), letters, spaces, apostrophes, hyphens and periods only. This is a stand-in for real accounts: there are no passwords, and anyone with the link can start a copy.

**Rate limiting:** `backend/app/ratelimit.py` counts requests in memory with sliding windows (one server process; counts reset on restart). The key is the household in the signed token, or the client IP (the first `X-Forwarded-For` address only when `TRUST_PROXY=1`). Creating a demo family: `RATE_LOGIN_PER_MINUTE` 10 and `RATE_LOGIN_PER_HOUR` 60 per IP. Chat: `RATE_CHAT_PER_MINUTE` 12 and `RATE_CHAT_PER_DAY` 200 per household, plus `CHAT_GLOBAL_DAILY_CAP` 3000 for everyone, which protects the Anthropic key. PDF upload: `RATE_ATTACH_PER_MINUTE` 5. Estimate, schedule, annual cost, simulate and visits: `RATE_COMPUTE_PER_MINUTE` 60. Demo reset: `RATE_RESET_PER_MINUTE` 5. `RATE_LIMIT_ENABLED=0` turns it off (the tests do that, except `test_ratelimit.py`). Over a limit the answer is HTTP 429, a `Retry-After` header and `{"detail": "<plain sentence>", "retry_after": <seconds>}`. Because the counts live in one process's memory, running several servers would give each its own counts.

**A member's numbers:** `GET /members/{id}/overview` reads that person's usage from SQLite and runs the engine (`engine/status.py`) for what is left. `POST /members/{id}/visits` saves a visit and every page updates.

**An estimate:** `POST /estimate` with a procedure code, a plan (id or inline) and usage -> `engine/estimate.py` applies frequency limit, deductible, coinsurance and the yearly maximum, in and out of network -> both results with a `trace` of plain-English steps.

**A plan-year run:** `POST /schedule` with treatments (code, urgency, optional "after") -> `engine/sequencer.py` tries every "this year or next year" split (up to 10 treatments), orders each year, runs it through `engine/annual.py` -> schedule, yearly totals, the "everything now" baseline, savings and reasons. Plans can be saved per person (`/members/{id}/saved-plans`).

**A plan comparison:** the Plans page "Which plan fits us?" sends `POST /simulate` with each person's age, care level and any known care -> `engine/simulate.py` draws 5,000 simulated years once (seeded, `random.Random`), then prices the same years under every plan through `run_year()` / `estimate()` one person at a time -> per plan: share of years it is cheapest, median and 90th percentile totals (premiums included), a shared histogram, and reasons. About 0.1 to 0.2 seconds. The odds are synthetic placeholders. The assistant tool `compare_plans` calls the same function. Details: [MATH.md](MATH.md).

**A chat message:** `POST /chat` with `member_id` -> `agent/context.py` loads only that person's data -> `agent/loop.py` asks the model, which calls engine tools (`find_procedure`, `estimate_cost`, `plan_year_schedule`, `get_benefits_status`, `get_member_eligibility`, `get_household_coverage`, `get_savings_tips`, `get_dentist_questions`, `compare_plans`), at most 5 steps -> `agent/guard.py` checks every dollar figure (and, for plan comparisons, every percentage) came from a tool result -> the answer streams back as server-sent events (`tool_start`, `tool_end`, `token`, `done`, `error`). With no model, the answer says it is unavailable. Details: [AI.md](AI.md).

## API endpoints

| Method and path | Purpose |
|---|---|
| `GET /health` | Server up, `chat_mode` (`anthropic`, `ollama` or `unavailable`) |
| `GET /auth/demo-accounts[?household_id=]`, `POST /auth/demo-login` | Demo sign-in; `sandbox: true` gives each visitor their own copy of the demo family (`hh-rivera.<sid>`), reused by `household_id`, 410 when expired |
| `PUT /households/{id}/names` | Rename people and the family (primary, sandbox families only) |
| `PATCH /members/{id}/profile` | Edit name, date of birth, email, phone, ZIP, notes (primary: anyone in the household; adult: self; demo families only, 403 for the shared template; plain 422 messages) |
| `POST /households/{id}/members` | Add a person (primary, demo family only, max 8; under 18 becomes a managed member) |
| `DELETE /households/{id}/members/{member_id}` | Remove a person and every row stored for them (primary, demo family only, never the primary) |
| `GET /households/{id}` | Household and members (what the viewer may see) |
| `PUT /households/{id}/plan` | Primary switches the family plan |
| `POST /households/{id}/invites` | Invite an adult to their own account |
| `GET /members/{id}/overview`, `GET /members/{id}/schedule` | One person's numbers and booked care |
| `POST /members/{id}/visits` | Save a visit |
| `GET/POST /members/{id}/saved-simulations`, `PUT/DELETE /members/{id}/saved-simulations/{sim_id}` | Saved "Which plan fits us?" comparisons. The client sends only its choices; the server runs `simulate()` and stores the headline |
| `GET/POST /members/{id}/saved-plans`, `PUT/DELETE /members/{id}/saved-plans/{plan_id}` | Saved Plan My Year plans |
| `POST /demo/reset` | Restore the caller's own demo family (primary only) |
| `GET /plans`, `GET /plans/{plan_id}` | Three tiers: `basic`, `preferred`, `premium` |
| `GET /procedures?q=` | Search procedure codes by plain words |
| `POST /estimate` | Cost of one procedure, in and out of network, with trace |
| `POST /schedule` | Plan My Year |
| `POST /annual-cost` | Yearly cost for a tier |
| `POST /simulate` | Monte Carlo plan comparison for a household ("Which plan fits us?") |
| `POST /benefits-status`, `GET /reminders.ics` | What is left; calendar reminder |
| `POST /savings-tips`, `POST /questions` | Ways to save; questions to ask your dentist |
| `POST /treatment-plan/parse` | Read pasted dentist-quote text into treatments |
| `POST /chat`, `GET /chat/suggestions`, `POST /chat/attachments`, `GET /members/{id}/assistant-context`, `DELETE /members/{id}/chat` | Assistant (streamed), suggested questions (up to 7), PDF upload, context, clear a person's saved chat |

36 routes in all. Any route can answer 429 with a `Retry-After` header when a rate limit is hit (see below).

The API contract is `backend/app/models.py`. Live docs: http://localhost:8000/docs.

## Folder map

| Path | What is there |
|---|---|
| `backend/app/main.py` | FastAPI app, core routes, CORS |
| `backend/app/routers/` | `auth`, `households`, `members`, `saved_plans`, `saved_simulations`, `annual_cost`, `simulate`, `chat`, `session`, `tips`, `questions`, `treatment_plan` |
| `backend/app/engine/` | `estimate.py`, `annual.py`, `sequencer.py`, `status.py`, `tips.py`, `simulate.py` |
| `backend/app/agent/` | `providers.py` (Anthropic, Ollama), `loop.py`, `tools.py`, `guard.py`, `context.py`, `suggestions.py` |
| `backend/app/db/` | `core.py`, `store.py`, `sandbox.py` (per-visitor demo families), `__main__.py` (SQLite access layer, `python -m app.db --reset`) |
| `backend/data/` | `plans/{basic,preferred,premium}.json`, `cdt_codes.json` |
| `backend/app/ratelimit.py` | In-memory rate limits (see "Rate limiting" below) |
| `backend/tests/` | 391 tests (about 2 minutes) |
| `infra/aws/` | CloudFormation kit, runbook and deploy scripts (a reference; not run in AWS) |
| `scripts/` | `dev.ps1` / `dev.sh`, `reset-db.*`, `lan-url.*` (phone address), `make_qr.py` (QR code) |
| `frontend/src/pages/Join/` | `/join` "Scan to try" QR page |
| `frontend/public/` | `manifest.webmanifest`, icons (Add to Home Screen) |
| `database/` | `migrations/`, `seeds/demo_household.json` |
| `frontend/src/pages/` | `Landing.tsx`, `Login/`, `Join/`, `Home/`, `Plans/`, `Family/`, `Costs/`, `PlanYear/`, `Assistant/`, `StyleGuide.tsx` |
| `frontend/src/features/` | Page building blocks: `home`, `plans`, `family`, `costs`, `planYear`, `assistant` |
| `frontend/src/components/` | `shell/` (top bar, nav, switcher, assistant button), `landing/`, `auth/`, `ui/` |
| `frontend/src/state/SessionContext.tsx` | Signed-in session, viewed member, household |
| `frontend/src/index.css` | Portal design tokens (landing keeps its own scoped `.landing` look) |
| `tests/` | End-to-end and contract folders (empty; see TASKS.md) |

## Key rules
- All money math is in `backend/app/engine/`. The frontend and the model only display numbers.
- Per-person data: one person's context is never returned under another person's id (`backend/app/db/store.py`, tested).
- Plans, fees and members are synthetic.

## Stand-ins and limits
- The odds in the plan comparison are synthetic, not claims data.
- Demo sign-in has no passwords. Rate limits are in memory, per process. Data lives in one SQLite file on one server.
- The AWS kit in `infra/aws/` is a reference and was not run in AWS; a teammate deploys `main`.
- Chat `done` events can carry `followups` (up to 4 short questions, shown as "Ask next" chips) after a plan comparison. See [AI.md](AI.md).
