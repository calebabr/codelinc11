# ARCHITECTURE

How the pieces fit. Everything below is built and connected; checked against the code and the running app on 2026-10-03.

## System diagram

```mermaid
flowchart LR
  subgraph Browser
    UI[React app<br/>landing, login, pages (Home to Reports),<br/>member switcher, assistant button]
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

**Demo families (sandboxes):** the landing page and `/login` have a one-tap **Try the demo** button. It calls `POST /auth/demo-login` with `{member_id, sandbox: true, household_id}`. The server (`db/sandbox.py`) clones the template Lincoln household into a private copy: every id gets a `.xxxxxx` suffix (for example `hh-rivera.a1b2c3`), chat memory starts empty, and the plan is Preferred. The response carries `sandbox: {household_id, expires_at}`; the browser keeps the `household_id` and sends it back on later sign-ins to reuse the same copy. `GET /auth/demo-accounts?household_id=` lists that copy's accounts (with each person's status, such as pending). A copy lives 24 hours (`DEMO_SANDBOX_TTL_HOURS`); at most 300 exist at once (`DEMO_MAX_SANDBOXES`); each is about 4.4 KB. An unknown or expired copy answers 410. `POST /demo/reset` puts only the caller's own copy back to the seed. `PUT /households/{id}/names` (primary only, copies only, never the shared template) renames people and the family: person names 1 to 24 characters (the form lets the family name run to 30), letters, spaces, apostrophes, hyphens and periods only. This is a stand-in for real accounts: there are no passwords, and anyone with the link can start a copy.

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
| `GET /members/{id}/notifications?unread=1` | Makes any new notifications from the person's data (benefits expiring, unused checkups and cleanings, appointments and reminders within `NOTIFY_WINDOW_DAYS` (default 45) days, warning when due in 7 days or fewer, saved treatment plans, deductible met, a denied or pending claim, an EOB with a balance owed; amounts from the benefits engine or the stored document; idempotent through `dedupe_key`), then lists them newest first with `unread_count`. Same visibility as the overview. Allowed in the shared template family |
| `POST /members/{id}/notifications/{nid}/read` · `POST /members/{id}/notifications/read-all` | Mark one or all read |
| `GET` / `PUT /members/{id}/notification-prefs` | In-app (default on), email and text (default off), and which kinds. Email or text needs a valid contact on the profile (plain 422 otherwise). PUT: demo families only (403 for the template) |
| `POST /members/{id}/notifications/test` | `{channel: app\|email\|sms}`: a sample in-app notification, or a delivery preview to the stored contact. Demo families only; rate limited (compute bucket) |
| `GET /members/{id}/outbox` | Delivery previews, newest first. Status is always `preview`: no email or text is ever sent (`Notifier` interface, default `PreviewNotifier`, in `backend/app/notifier.py`) |
| `GET /providers?zip=&radius_mi=25&network=all\|in\|out&specialty=&accepting=&q=&code=&member_id=` | Synthetic dentists near a ZIP, nearest first (max 50, radius 1 to 100 miles). Each has `distance_mi` (haversine between approximate ZIP centres), `in_network` for the household's CURRENT plan, and with `code` an `estimate` `{you_pay, plan_pays, in_network, balance_bill, note}` from the engine for that member's current usage (in-network or out-of-network pricing; provider specific fees are not modeled). No `zip`: the member's profile ZIP; unknown ZIP is 422 with a plain message. `member_id` defaults to the signed-in person (same visibility rules: 403 for someone you may not see). Rate limited (compute bucket) |
| `GET /providers/{id}` | One provider (same fields; `distance_mi` when a ZIP is given or on the member's profile; `estimate` with `code`). 404 unknown id |
| `PATCH /members/{id}/profile` | Edit name, date of birth, email, phone, ZIP, notes, `primary_dentist_id` (a provider id; null or empty clears; 422 if the provider does not exist) (primary: anyone in the household; adult: self; demo families only, 403 for the shared template; plain 422 messages) |
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
| `POST /treatment-plan/parse` | Read pasted dentist-quote text into treatments. The response also has `provider_match` (which directory practice the quote header names; `in_network` for `plan_id` when it is a plan tier; unmatched is priced out of network) |
| `GET /reports/samples` | Five synthetic sample documents (a paid claim, an EOB with a deductible, an out-of-network EOB with balance billing, a denied claim, a copay visit), each with `id`, `title`, `kind`, `description` and `text` in the template that upload accepts |
| `POST /members/{id}/reports/samples/{sample_id}` | Add a sample to a person's reports (demo family only; max 100 per person) |
| `POST /members/{id}/reports/upload?kind=&filename=` | Save a document from a raw `text/plain` body (max 20 KB) in the sample template. Anything else: 422 "Demo accepts the sample documents only." Demo family only |
| `GET /members/{id}/reports?kind=&from=&to=&order=asc\|desc` | The person's synthetic claims, EOBs and copay visits by service date, with `totals {billed, allowed, plan_paid, you_paid, you_owe_open}` added up in code from the stored values. Same visibility as the overview |
| `GET /members/{id}/reports/{item_id}` · `GET .../{item_id}/explain` | One document; its plain-language explanation built in code (steps billed, allowed, deductible, plan paid, you owe; what to do next; a balance billing note when out of network). No model |
| `POST /members/{id}/reports/{item_id}/mark-paid` · `DELETE /members/{id}/reports/{item_id}` | Mark what you owe as paid; remove a document (demo family only) |
| `GET /treatment-plan/samples` | Three synthetic dentist quotes (in-network practice, out-of-network practice, unknown practice) whose headers use directory names, phones and ZIPs |
| `POST /chat`, `GET /chat/suggestions`, `POST /chat/attachments`, `GET /members/{id}/assistant-context`, `DELETE /members/{id}/chat` | Assistant (streamed), suggested questions (up to 7), PDF upload, context, clear a person's saved chat |

57 routes in all. Any route can answer 429 with a `Retry-After` header when a rate limit is hit (see below).

The API contract is `backend/app/models.py`. Live docs: http://localhost:8000/docs.

## Folder map

| Path | What is there |
|---|---|
| `backend/app/main.py` | FastAPI app, core routes, CORS |
| `backend/app/routers/` | `auth`, `households`, `members`, `saved_plans`, `saved_simulations`, `notifications`, `profiles`, `providers`, `reports`, `annual_cost`, `simulate`, `chat`, `session`, `tips`, `questions`, `treatment_plan` |
| `backend/app/engine/` | `estimate.py`, `annual.py`, `sequencer.py`, `status.py`, `tips.py`, `simulate.py`, `reports.py` (totals and line checks for claims and EOBs) |
| `backend/app/agent/` | `providers.py` (Anthropic, Ollama), `loop.py`, `tools.py`, `guard.py`, `context.py`, `suggestions.py` |
| `backend/app/db/` | `core.py`, `store.py`, `sandbox.py` (per-visitor demo families), `__main__.py` (SQLite access layer, `python -m app.db --reset`) |
| `backend/data/` | `plans/{basic,preferred,premium}.json`, `cdt_codes.json` |
| `backend/app/reports.py`, `quote_match.py` | Sample documents, template parser and plain-language explanation for the Reports page; matching a pasted quote to a directory practice |
| `backend/app/notifications.py`, `notifier.py` | Makes notifications from a person's data; `Notifier` interface (email and text are previews only) |
| `backend/app/ratelimit.py` | In-memory rate limits (see "Rate limiting" below) |
| `backend/tests/` | 391 tests (about 2 minutes) |
| `infra/aws/` | CloudFormation kit, runbook and deploy scripts (a reference; not run in AWS) |
| `scripts/` | `dev.ps1` / `dev.sh`, `reset-db.*`, `lan-url.*` (phone address), `make_qr.py` (QR code) |
| `frontend/src/pages/Join/` | `/join` "Scan to try" QR page |
| `frontend/public/` | `manifest.webmanifest`, icons (Add to Home Screen) |
| `database/` | `migrations/`, `seeds/demo_household.json` |
| `frontend/src/pages/` | `Landing.tsx`, `Login/`, `Join/`, `Home/`, `Plans/`, `Family/`, `Costs/`, `PlanYear/`, `Assistant/`, `Notifications/` (`/notifications`), `StyleGuide.tsx` |
| `frontend/src/features/` | Page building blocks: `home`, `plans`, `family`, `costs`, `planYear`, `assistant`, `notifications` (bell in the top bar, settings, Home card) |
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
