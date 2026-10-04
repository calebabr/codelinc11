# AI summary
_Updated 2026-10-03_

**Built:** `backend/app/agent/` with a provider interface (Anthropic by default, `claude-haiku-4-5`; Ollama optional; no keyword fallback, so with no model the chat says it is unavailable), a tool loop (max 5 steps), nine engine tools (`find_procedure`, `estimate_cost`, `plan_year_schedule`, `get_benefits_status`, `get_member_eligibility`, `get_household_coverage`, `get_savings_tips`, `get_dentist_questions`, `compare_plans`), per-person context from the database, suggested questions (up to 7), PDF upload (sample documents only) and a "what the assistant knows" panel. Streamed over SSE by `POST /chat`. A dollar-amount number guard checks every `$` figure came from a tool result; for plan comparisons a percentage guard (`guard.check_percents`) does the same for `NN%`. A deterministic pre-step in `loop.py` handles dentist-question and savings-tip requests and plan-comparison follow-ups, and the `done` event can carry `followups` ("Ask next" chips). The tool `compare_plans` returns `plan_terms` so the model quotes real coverage terms. `DELETE /members/{id}/chat` clears a person's saved chat.

**Cost protection:** chat is rate limited (12 a minute and 200 a day per household, `CHAT_GLOBAL_DAILY_CAP` 3,000 a day for everyone); see `backend/app/ratelimit.py`.

**Stand-in:** the odds the model reports from `compare_plans` are synthetic. Rate limits are in memory per process.

**Not built:** `backend/app/rag/` is an empty placeholder; no retrieval over plan documents and no evaluation set.

See `docs/AI.md`.
