# Task T06: Provider interface and per-person assistant

**Role:** ai
**Read first:** agents/README.md, agents/ai-agent.md, agents/tasks/PLAN.md, `docs/decisions/README.md` (D3, D9, D11, F4, F5), Caleb's agent code for reference (`git show proto/dental-prototype:backend/app/agent/loop.py`, `tools.py`, `guard.py`) and Wrigley's `chat.ts` for the product idea (suggestion chips, per-profile memory, "what the assistant knows")

## Goal
A real chat assistant for the active family member: it uses the Anthropic API by default (Ollama as the local option), calls the engine through tools for every number, remembers each person separately, offers suggested questions, and can read an uploaded sample PDF.

## You may edit
`backend/app/agent/`, `backend/app/rag/` (only if needed), `backend/tests/test_agent*.py`, `docs/AI.md`, the chat router file `backend/app/routers/chat.py`.

## You must not touch
The money engine, `backend/app/models.py` (ask the orchestrator for contract changes), `backend/app/db/`, `frontend/`.

## Interfaces
- **Provider interface** with two implementations, Anthropic and Ollama. Default from config: `ANTHROPIC_API_KEY` in `backend/.env` selects Anthropic; otherwise Ollama if reachable; otherwise return a clear "assistant unavailable" response (no scripted answers). Never hard-code a key.
- **Tools** wrap the engine (find procedure, estimate cost, plan-year schedule, benefits status, eligibility) and read the **active member's** plan and usage. **No dollar amount reaches the user unless a tool returned it.** Keep and extend Caleb's number check; on a mismatch, regenerate once, then answer with a plain template built from the tool results.
- **Per-person context** (from the T04 access layer): plan highlights, history, preferences and must-haves, chat memory. Load only the active member's context. Append each exchange to that member's chat memory. Never put one member's data in another's prompt.
- **Visibility:** the primary may ask about any household member; an adult only about themself. Use the session and the access layer to decide.
- `GET /chat/suggestions?member_id=` returns recommended questions personalized to that member (for example "Who's covered on my plan?", "What do I have left this year?", "What will a crown cost me?", "What if I wait until January?").
- `GET /members/{id}/assistant-context` (or part of chat) returns what the assistant knows, for the "what the assistant knows" panel.
- `POST /chat` streams events (`tool_start`, `tool_end`, `token`, `done`, `error`). `POST /chat/attachments` accepts a PDF (size-limited, PDF only) and passes it to the provider for reading. Demo uses sample documents only (D11, F5).
- Safety: say estimates are estimates; never advise delaying urgent or painful care; ask a short follow-up when unclear.
- **Running at the same time:** T05 (owns households and auth). Use the session helper it provides; agree the function name in your report.

## Acceptance checks
- Tests with no network and no real model: a scripted fake provider drives the tool loop; the "unavailable" path; the number check rejects an invented amount; member isolation (member A's memory never appears in B's prompt); primary vs adult visibility.
- With a real key (manual check by the orchestrator): "What will a crown cost me?" for Mary in November with $1,100 used returns **$800**; "What if I wait until January?" returns **$625 versus $800**.
- Suggestions differ by member (for example a child profile gets different ones from the primary).
- `pytest -q` and `ruff check .` pass.

## Docs to update
`docs/AI.md`: providers, tools, per-person context, the number check, how to set the key.

## Report
Format in agents/README.md, including five real sample answers to read for tone.
