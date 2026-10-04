# T44 ai: the assistant answers questions about reports

**Product owner (2026-10-04):** Claims, EOBs and copays are **synthetic data for the demo**; a separate page `/reports/ask` lets the user ask the assistant about them. Contract: `docs/sprints/SPRINT-2.md` section "A1 assistant for reports".

Read first: `agents/README.md`, `agents/ai-agent.md`, `docs/AI.md`, `backend/CLAUDE.md`. The reports backend is finished: `backend/app/reports.py` (parser and `explain` builder), `backend/app/engine/reports.py` (cents helpers and totals), `backend/app/db/store.py` (`list_report_items`, `get_report_item`), `backend/app/routers/reports.py` (the routes the tools should reuse, not duplicate). The frontend already sends `scope: "reports"` on `POST /chat` from `/reports/ask`.

## Build (edit only `backend/app/agent/`, `backend/app/rag/`, the chat router if the scope needs plumbing, `backend/tests/test_agent*.py` and new agent tests, `docs/AI.md`)
1. `POST /chat` accepts `scope: "reports"` (check how `scope` is already handled and whether the request model in `models.py` already allows it; if `models.py` needs one field, make the smallest append and say so in your report).
2. Tools `get_reports(kind?, from?, to?)` and `explain_report(id)`: return the stored values, totals (from the engine helper) and the explanation built in code. The model only rephrases. Every dollar amount in an answer must come from a tool result: the existing number guard (dollars and percentages) applies, so make sure amounts formatted from cents match what the guard expects (for example 925 and 925.00).
3. In reports scope, the system prompt is about explaining claims, EOBs and copays in plain language (8th grade), saying these are made-up sample documents, never giving medical advice, never telling someone to delay urgent care, offering the next step (for example "ask the office to resubmit the claim"). Out-of-network balance billing is explained plainly. No clarifying questions for "What do I owe right now?" (answer from `get_reports` totals, `you_owe_open`).
4. Deterministic pre-steps like the existing tips pre-step are allowed where the live model is unreliable ("What do I owe right now?", "Which visits are still unpaid?"), following the pattern in `backend/app/agent/loop.py`. Prompt-only instructions have failed before, so test with the fake model AND keep behaviour in code where possible.
5. Privacy: the assistant never receives email addresses, phone numbers or notes; never put raw uploaded text in a prompt.
6. Follow-up chips: return `done.followups` like the other scopes, for example "Explain my last EOB", "Why was this claim denied?".
7. Tests: fake-model tool loop for both tools, guard passes with amounts from tool results and blocks an invented amount, visibility (a member only gets reports they may see), scope plumbing, no contact details in the context, golden numbers untouched. Update `docs/AI.md`.

## Do not touch
`frontend/`, `database/`, `backend/app/engine/`, `backend/app/reports.py` (ask in your report if a change is needed), the golden numbers, `backend/.env`. No new dependencies. Never run git. Do not start servers on 8000 or 5173.

## Done when
`cd backend && .venv/Scripts/python -m pytest -p no:cacheprovider -q` passes entirely (the run prints only dots; check the exit code, or run once without `-q` to see the count) and `.venv/Scripts/python -m ruff check --no-cache .` is clean. Report in the format in `agents/README.md`, with a list of the exact prompts you checked and what the fake model returned.
